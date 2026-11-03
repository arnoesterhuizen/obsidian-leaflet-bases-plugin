import { Control, CRS, ImageOverlay, imageOverlay, LatLng, LatLngBounds, LayerGroup, layerGroup, TileLayer, tileLayer } from "leaflet";
import { BasesEntry, setIcon } from "obsidian";
import { ContextMenu } from "@plugin/bases/leaflet-map/contextMenu";
import { ControlContainer } from "@plugin/bases/leaflet-map/control/container";
import { GeoJsonManager } from "@plugin/bases/leaflet-map/geojson/geojsonManager";
import { ImageLoader } from "@plugin/bases/leaflet-map/imageLoader";
import { map, Map } from "@plugin/bases/leaflet-map/map/map";
import { MarkerManager } from "@plugin/bases/leaflet-map/marker/markerManager";
import { OverlayManager } from "@plugin/bases/leaflet-map/overlay/overlayManager";
import { PathManager } from "@plugin/bases/leaflet-map/path/pathManager";
import { RegionManager } from "@plugin/bases/leaflet-map/region/regionManager";
import { RiverManager } from "@plugin/bases/leaflet-map/river/riverManager";
import { ViewUtil } from "@plugin/bases/leaflet-map/viewUtil";
import { Constants as C } from "@plugin/constants";
import { BasesLeafletViewPlugin } from "@plugin/plugin";
import { Frontmatter } from "@plugin/properties/frontmatter";
import { StyleResolver } from "@plugin/styles/styleResolver";
import type { BaseLayerConfig, MapConfig } from "@plugin/types";
import { parseBounds, parseCoordinates } from "@plugin/util";

export class MapManager {
	private mapEl: HTMLElement;
	private leafletMap: Map;
	private config: MapConfig | undefined = undefined;
	private lastEmbedded: boolean | undefined = undefined;
	private initialized: boolean = false;

	// Layers
	private markerLayer: LayerGroup;
	private imageOverlay: ImageOverlay | undefined;
	private currentImage: MapConfig["image"] | undefined;
	private currentBounds: string | undefined;

	// Managers
	private styleResolver: StyleResolver;
	private markerManager: MarkerManager;
	private regionManager: RegionManager;
	private pathManager: PathManager;
	private imageLoader: ImageLoader;
	private geojsonManager: GeoJsonManager;
	private riverManager: RiverManager;
	private overlayManager: OverlayManager;
	private controls: ControlContainer;
	private layerControl: Control.Layers | undefined;
	private contextMenu: ContextMenu;

	// Base layer switching
	private baseLayerControl: Control.Layers | undefined;
	private baseLayerProxies: TileLayer[] = [];
	private activeBaseLayerIndex: number = 0;
	private baseLayerChangeHandler: ((e: { name: string }) => void) | undefined;

	/** Removes this view's subscription to map-tool setting changes on unload. */
	private unsubscribeToolSettings: () => void = () => {};

	constructor(plugin: BasesLeafletViewPlugin, containerEl: HTMLElement, viewUtil: ViewUtil) {
		this.mapEl = containerEl.createDiv("bases-leaflet-map");
		this.imageLoader = new ImageLoader(plugin.app);
		this.styleResolver = new StyleResolver();
		this.styleResolver.updateSettingsRules(plugin.settingsManager.settings.styleRules);
		this.geojsonManager = new GeoJsonManager(plugin.app, this.styleResolver);
		this.geojsonManager.updateColors(plugin.settingsManager.settings.geojsonDefaultColors);
		this.riverManager = new RiverManager(plugin.app);
		this.overlayManager = new OverlayManager(plugin.app);

		const frontmatter = new Frontmatter(plugin.app);

		// Map initialisation
		this.markerLayer = layerGroup();
		this.regionManager = new RegionManager();
		this.pathManager = new PathManager();
		this.leafletMap = map(this.mapEl, {
			crs: CRS.Simple,
			zoomSnap: C.map.default.zoomSnap,
			preferCanvas: true,
			layers: [this.overlayManager.getGroup(), this.riverManager.getGroup(), this.geojsonManager.getGroup(), this.regionManager.getGroup(), this.pathManager.getGroup(), this.markerLayer],
			closePopupOnClick: true,
			keyboard: false,
		});

		// Remove .leaflet-touch so Leaflet's touch-specific CSS overrides
		// (larger buttons, 2px radius) don't conflict with our custom styles.
		// Touch interactions (pinch-zoom, drag) still work — only the CSS class is removed.
		this.leafletMap.getContainer().classList.remove("leaflet-touch");

		this.controls = new ControlContainer(
			plugin.app,
			viewUtil,
			plugin.settingsManager.settings,
			frontmatter,
			() => this.fitToContent(),
		);
		this.controls.addTo(this.leafletMap);
		this.replaceZoomIcons();

		// Rebuild the toolbar live when a map-tool toggle changes in settings, so
		// the change takes effect immediately instead of only after a reload.
		this.unsubscribeToolSettings = plugin.settingsManager.onToolSettingsChanged(() =>
			this.refreshControls(),
		);

		this.contextMenu = new ContextMenu(plugin.app, viewUtil, this.leafletMap, frontmatter);
		this.contextMenu.addHooks();

		this.markerManager = new MarkerManager(
			plugin.app,
			this.leafletMap,
			this.markerLayer,
			frontmatter,
			this.styleResolver,
		);
	}

	/**
	 * Rebuild the map-tool toolbar from the current settings. The ControlContainer
	 * reads the live settings object in `onAdd`, so removing and re-adding it picks
	 * up toggled tools without tearing down the map. The stored MapConfig is
	 * re-applied so the fresh sub-controls get their per-view configuration.
	 */
	private refreshControls(): void {
		this.controls.remove();
		this.controls.addTo(this.leafletMap);
		if (this.config) this.controls.updateSettings(this.config);
	}

	unload(): void {
		this.unsubscribeToolSettings();
		this.markerManager.unload();
		this.regionManager.unload();
		this.pathManager.unload();
		this.geojsonManager.unload();
		this.riverManager.unload();
		this.overlayManager.unload();
		this.removeBaseLayerControl();
		this.layerControl?.remove();
		this.controls.onRemove(this.leafletMap);
		this.contextMenu.removeHooks();
		this.leafletMap.clearAllEventListeners();
		this.leafletMap.remove();
	}

	// --- Public API for view ---

	updateData(data: { data: BasesEntry[] }): void {
		this.markerManager.updateMarkers(data);
		this.regionManager.updateRegions(data);
		this.pathManager.updatePaths(data);
	}

	async updateSettings(config: MapConfig, embedded: boolean): Promise<void> {
		// Skip the entire update pipeline if config hasn't changed
		if (this.config && this.configEquals(this.config, config, embedded)) {
			return;
		}

		this.styleResolver.updateViewOverrides(config.styleOverrides);

		this.markerManager.updateConfig(config);
		this.regionManager.updateConfig(config);
		this.pathManager.updateConfig(config);

		// When the image changes, reset zoom constraints first so the new fitBounds
		// isn't clamped by the previous view's min/max zoom
		const activeLayer = this.getActiveBaseLayer(config);
		const effectiveImage = activeLayer?.image ?? config.image;
		const imageChanging = this.currentImage !== effectiveImage;
		if (imageChanging && !this.initialized) {
			this.leafletMap.setMinZoom(-100);
			this.leafletMap.setMaxZoom(100);
			this.leafletMap.setMaxBounds([[-1e5, -1e5], [1e5, 1e5]]);
		}

		// Build a temporary config with the active layer's image/overlays/geojson/rivers
		const effectiveConfig = this.buildEffectiveConfig(config);

		const imageChanged = await this.updateImageOverlay(effectiveConfig);
		await this.updateGeoJsonLayers(effectiveConfig);
		await this.riverManager.updateLayers(effectiveConfig);
		await this.overlayManager.updateLayers(
			effectiveConfig,
			this.imageOverlay ? this.imageOverlay.getBounds() : null,
		);
		this.updateZoom(config, imageChanged);
		this.updateHeight(config, embedded);

		// Apply tag filter after the map has a valid viewport (image + zoom are set)
		const layerTags = activeLayer?.tags ?? null;
		this.markerManager.applyTagFilter(layerTags);
		this.regionManager.applyTagFilter(layerTags);
		this.pathManager.applyTagFilter(layerTags);

		this.controls.updateSettings(config);
		this.updateBaseLayerControl(config);

		this.leafletMap.invalidateSize();

		this.config = config;
		this.lastEmbedded = embedded;
		this.initialized = true;
	}

	invalidateSize(): void {
		if (this.mapEl.isConnected) {
			this.leafletMap.invalidateSize();
		}
	}

	panTo(latLng: LatLng): void {
		this.leafletMap.panTo(latLng, { animate: false });
	}

	setZoom(zoom: number): void {
		this.leafletMap.setZoom(zoom, { animate: false });
	}

	getViewState(): { center: LatLng; zoom: number } | null {
		try {
			return {
				center: this.leafletMap.getCenter(),
				zoom: this.leafletMap.getZoom(),
			};
		} catch {
			return null;
		}
	}

	/** Returns the currently active base layer index (0 if no base layers). */
	getActiveBaseLayerIndex(): number {
		return this.activeBaseLayerIndex;
	}

	/**
	 * Switch to a specific base layer by index.
	 * Used to restore ephemeral state.
	 */
	async setActiveBaseLayer(index: number): Promise<void> {
		if (!this.config?.baseLayers || index < 0 || index >= this.config.baseLayers.length) return;
		if (index === this.activeBaseLayerIndex) return;

		this.activeBaseLayerIndex = index;

		// Update the radio button in the control
		if (this.baseLayerProxies[index]) {
			this.baseLayerProxies[index].addTo(this.leafletMap);
		}

		await this.switchToBaseLayer(index);
	}

	/**
	 * Fit the map view to encompass all current markers, regions, and paths with some padding.
	 * Called when no explicit center/zoom is configured, or when the user clicks "Fit to view".
	 *
	 * When base layers are active, only content visible on the current layer is considered.
	 */
	fitToContent(): void {
		const bounds = new LatLngBounds([]);

		const markerBounds = this.markerManager.getMarkerBounds();
		if (markerBounds?.isValid()) bounds.extend(markerBounds);

		const regionBounds = this.regionManager.getBounds();
		if (regionBounds?.isValid()) bounds.extend(regionBounds);

		const pathBounds = this.pathManager.getBounds();
		if (pathBounds?.isValid()) bounds.extend(pathBounds);

		if (!bounds.isValid()) return;

		this.leafletMap.fitBounds(bounds, {
			paddingTopLeft: [30, 60],
			paddingBottomRight: [30, 20],
			animate: false,
		});
	}

	// --- Base layer management ---

	/**
	 * Get the currently active base layer config, or undefined if no base layers.
	 */
	private getActiveBaseLayer(config: MapConfig): BaseLayerConfig | undefined {
		if (!config.baseLayers || config.baseLayers.length === 0) return undefined;

		// Clamp index to valid range
		if (this.activeBaseLayerIndex >= config.baseLayers.length) {
			this.activeBaseLayerIndex = 0;
		}

		return config.baseLayers[this.activeBaseLayerIndex];
	}

	/**
	 * Build an effective MapConfig with image/overlays/geojson/rivers from the active base layer.
	 * If no base layers, returns the config as-is.
	 */
	private buildEffectiveConfig(config: MapConfig): MapConfig {
		const activeLayer = this.getActiveBaseLayer(config);
		if (!activeLayer) return config;

		return {
			...config,
			image: activeLayer.image,
			overlays: activeLayer.overlays,
			geojson: activeLayer.geojson,
			rivers: activeLayer.rivers,
		};
	}

	/**
	 * Create or update the base layer switcher control.
	 * Only renders when there are 2+ base layers.
	 */
	private updateBaseLayerControl(config: MapConfig): void {
		const layers = config.baseLayers;

		if (!layers || layers.length <= 1) {
			this.removeBaseLayerControl();
			return;
		}

		// Check if the base layers config actually changed
		const prevLayers = this.config?.baseLayers;
		if (prevLayers && prevLayers.length === layers.length &&
			prevLayers.every((l, i) => l.name === layers[i]!.name)) {
			return; // No change
		}

		this.removeBaseLayerControl();

		// Create lightweight proxy layers for L.Control.Layers radio buttons
		const baseLayers: Record<string, TileLayer> = {};
		this.baseLayerProxies = [];

		for (let i = 0; i < layers.length; i++) {
			const proxy = tileLayer("", { opacity: 0 });
			this.baseLayerProxies.push(proxy);
			baseLayers[layers[i]!.name] = proxy;

			// Add the active layer's proxy to the map so it shows as selected
			if (i === this.activeBaseLayerIndex) {
				proxy.addTo(this.leafletMap);
			}
		}

		this.baseLayerControl = new Control.Layers(baseLayers, undefined, {
			collapsed: true,
			position: "topright",
		});
		this.baseLayerControl.addTo(this.leafletMap);
		this.replaceLayerToggleIcon(this.baseLayerControl, "map");

		// Listen for layer switch events
		this.baseLayerChangeHandler = (e: { name: string }) => {
			const newIndex = layers.findIndex((l) => l.name === e.name);
			if (newIndex >= 0 && newIndex !== this.activeBaseLayerIndex) {
				this.activeBaseLayerIndex = newIndex;
				void this.switchToBaseLayer(newIndex);
			}
		};
		this.leafletMap.on("baselayerchange", this.baseLayerChangeHandler as (e: unknown) => void);
	}

	/**
	 * Remove the base layer switcher control and clean up proxy layers.
	 */
	private removeBaseLayerControl(): void {
		if (this.baseLayerChangeHandler) {
			this.leafletMap.off("baselayerchange", this.baseLayerChangeHandler as (e: unknown) => void);
			this.baseLayerChangeHandler = undefined;
		}
		for (const proxy of this.baseLayerProxies) {
			if (this.leafletMap.hasLayer(proxy)) {
				this.leafletMap.removeLayer(proxy);
			}
		}
		this.baseLayerProxies = [];
		this.baseLayerControl?.remove();
		this.baseLayerControl = undefined;
	}

	/**
	 * Switch to a different base layer: swap image, overlays, geojson, rivers,
	 * and apply tag filter. Does NOT change viewport.
	 */
	private async switchToBaseLayer(index: number): Promise<void> {
		if (!this.config?.baseLayers) return;

		const layer = this.config.baseLayers[index];
		if (!layer) return;

		// Build a config override with the new layer's assets
		const effectiveConfig: MapConfig = {
			...this.config,
			image: layer.image,
			overlays: layer.overlays,
			geojson: layer.geojson,
			rivers: layer.rivers,
		};

		await this.updateImageOverlay(effectiveConfig);
		await this.updateGeoJsonLayers(effectiveConfig);
		await this.riverManager.updateLayers(effectiveConfig);
		await this.overlayManager.updateLayers(
			effectiveConfig,
			this.imageOverlay ? this.imageOverlay.getBounds() : null,
		);

		// Apply tag filter for the new layer
		this.markerManager.applyTagFilter(layer.tags);
		this.regionManager.applyTagFilter(layer.tags);
		this.pathManager.applyTagFilter(layer.tags);
	}

	// --- Private ---

	private async updateImageOverlay(config: MapConfig): Promise<boolean> {
		if (this.currentImage === config.image && this.currentBounds === config.bounds) return false;

		const imageData = await this.imageLoader.getImageData(config.image);
		if (!imageData) return false;

		// Use explicit bounds if configured, otherwise use auto-detected image bounds
		const effectiveBounds = config.bounds ? parseBounds(config.bounds) : null;
		const bounds = effectiveBounds ?? imageData.bounds;

		if (this.imageOverlay) this.leafletMap.removeLayer(this.imageOverlay);
		this.imageOverlay = imageOverlay(imageData.url, bounds);

		this.leafletMap.addLayer(this.imageOverlay);
		this.currentImage = config.image;
		this.currentBounds = config.bounds;

		if (!this.initialized) {
			// First load: fit to image bounds and lock pan area
			this.leafletMap.fitBounds(bounds, { animate: false });
			this.leafletMap.setMaxBounds(bounds);

			if (config.center) {
				this.leafletMap.panTo(parseCoordinates(config.center), { animate: false });
			}
		} else {
			// Subsequent image changes (e.g. base layer switch): replace the image
			// but preserve the current viewport. Only update maxBounds so panning
			// stays constrained to the new image area.
			this.leafletMap.setMaxBounds(bounds);
		}

		return true;
	}

	private async updateGeoJsonLayers(config: MapConfig): Promise<void> {
		if (config.geojson.length === 0) {
			this.geojsonManager.clear();
			if (this.layerControl) {
				this.layerControl.remove();
				this.layerControl = undefined;
			}
			return;
		}

		const changed = await this.geojsonManager.updateLayers(config);
		if (!changed) return;

		// Rebuild the layer control
		if (this.layerControl) {
			this.layerControl.remove();
			this.layerControl = undefined;
		}

		const overlays = this.geojsonManager.getOverlays();
		if (Object.keys(overlays).length > 0) {
			this.layerControl = new Control.Layers(undefined, overlays, {
				collapsed: true,
				position: "topright",
			});
			this.layerControl.addTo(this.leafletMap);
			this.replaceLayerToggleIcon(this.layerControl, "layers");

			// Re-add the base layer control so it stays below the geojson control
			if (this.baseLayerControl) {
				this.baseLayerControl.remove();
				this.baseLayerControl.addTo(this.leafletMap);
				this.replaceLayerToggleIcon(this.baseLayerControl, "map");
			}
		}
	}

	private updateZoom(config: MapConfig, imageChanged: boolean): void {
		this.leafletMap.setMinZoom(config.minZoom);
		this.leafletMap.setMaxZoom(config.maxZoom);

		// Reset zoom on first load when the image is set, or when zoom config changes.
		// After initialization, image changes (base layer switches) preserve the
		// current viewport — only zoom config changes trigger a reset.
		const shouldResetZoom =
			!this.initialized && imageChanged ||
			!this.config ||
			this.config.defaultZoom !== config.defaultZoom ||
			this.config.minZoom !== config.minZoom ||
			this.config.maxZoom !== config.maxZoom;

		if (shouldResetZoom) {
			this.leafletMap.setZoom(config.defaultZoom, { animate: false });
		}

		this.leafletMap.options = {
			...this.leafletMap.options,
			zoomDelta: config.zoomDelta,
			wheelPxPerZoomLevel: 60 / config.zoomDelta,
		};
	}

	/**
	 * Embedded views use the configured height. Full-page views let CSS fill available space.
	 */
	private updateHeight(config: MapConfig, embedded: boolean): void {
		if (embedded) {
			this.mapEl.setCssStyles({ height: `${config.height.toFixed(0)}px` });
		} else {
			this.mapEl.setCssStyles({ height: "" });
		}
	}

	/**
	 * Replace a Leaflet Control.Layers toggle's background-image icon with an
	 * Obsidian Lucide SVG icon so it uses `currentColor` and respects theming.
	 */
	private replaceLayerToggleIcon(control: Control.Layers, iconName: string): void {
		const container = control.getContainer();
		if (!container) return;
		const toggle = container.querySelector<HTMLElement>(".leaflet-control-layers-toggle");
		if (!toggle) return;
		toggle.addClass("leaflet-map-no-bg-image");
		setIcon(toggle, iconName);
	}

	/**
	 * Replace the default Leaflet zoom control's "+" and "-" text with
	 * Lucide SVG icons for visual consistency with the rest of the toolbar.
	 */
	private replaceZoomIcons(): void {
		const zoomIn = this.mapEl.querySelector<HTMLElement>(".leaflet-control-zoom-in");
		const zoomOut = this.mapEl.querySelector<HTMLElement>(".leaflet-control-zoom-out");
		if (zoomIn) {
			zoomIn.textContent = "";
			setIcon(zoomIn, "plus");
		}
		if (zoomOut) {
			zoomOut.textContent = "";
			setIcon(zoomOut, "minus");
		}
	}

	/**
	 * Compare two MapConfig objects for equality. Uses JSON.stringify for the geojson
	 * array (order-sensitive) and direct comparison for all scalar fields.
	 */
	private configEquals(prev: MapConfig, next: MapConfig, embedded: boolean): boolean {
		if (this.lastEmbedded !== embedded) return false;

		return (
			prev.image === next.image &&
			prev.height === next.height &&
			prev.mapName === next.mapName &&
			prev.center === next.center &&
			prev.bounds === next.bounds &&
			prev.markerProperty === next.markerProperty &&
			prev.markerIconProperty === next.markerIconProperty &&
			prev.markerColorProperty === next.markerColorProperty &&
			prev.regionProperty === next.regionProperty &&
			prev.regionColorProperty === next.regionColorProperty &&
			prev.pathProperty === next.pathProperty &&
			prev.pathColorProperty === next.pathColorProperty &&
			prev.minZoom === next.minZoom &&
			prev.maxZoom === next.maxZoom &&
			prev.defaultZoom === next.defaultZoom &&
			prev.zoomDelta === next.zoomDelta &&
			prev.scale === next.scale &&
			prev.unit === next.unit &&
			JSON.stringify(prev.geojson) === JSON.stringify(next.geojson) &&
			JSON.stringify(prev.rivers) === JSON.stringify(next.rivers) &&
			JSON.stringify(prev.overlays) === JSON.stringify(next.overlays) &&
			JSON.stringify(prev.styleOverrides) === JSON.stringify(next.styleOverrides) &&
			JSON.stringify(prev.baseLayers) === JSON.stringify(next.baseLayers)
		);
	}
}
