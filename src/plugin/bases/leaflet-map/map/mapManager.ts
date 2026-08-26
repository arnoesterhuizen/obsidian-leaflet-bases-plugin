import { Control, CRS, ImageOverlay, imageOverlay, LatLng, LatLngBounds, LayerGroup, layerGroup } from "leaflet";
import { BasesEntry } from "obsidian";
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
import type { MapConfig } from "@plugin/types";
import { parseBounds, parseCoordinates } from "@plugin/util";

export class MapManager {
	private mapEl: HTMLElement;
	private leafletMap: Map;
	private config: MapConfig | undefined = undefined;
	private lastEmbedded: boolean | undefined = undefined;

	// Layers
	private markerLayer: LayerGroup;
	private imageOverlay: ImageOverlay | undefined;

	// Managers
	private styleResolver: StyleResolver;
	private markerManager: MarkerManager;
	private regionManager: RegionManager;
	private pathManager: PathManager;
	private imageLoader: ImageLoader;
	private geojsonManager: GeoJsonManager;
	private riverManager: RiverManager;
	private overlayManager: OverlayManager;
	private controls: ControlContainer | undefined;
	private layerControl: Control.Layers | undefined;
	private contextMenu: ContextMenu;

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

		if (
			plugin.settingsManager.settings.enableMeasureTool ||
			plugin.settingsManager.settings.enableDragTool ||
			plugin.settingsManager.settings.enableCreateNoteTool
		) {
			this.controls = new ControlContainer(
				plugin.app,
				viewUtil,
				plugin.settingsManager.settings,
				frontmatter,
			);
			this.controls.addTo(this.leafletMap);
		}

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

	unload(): void {
		this.markerManager.unload();
		this.regionManager.unload();
		this.pathManager.unload();
		this.geojsonManager.unload();
		this.riverManager.unload();
		this.overlayManager.unload();
		this.layerControl?.remove();
		this.controls?.onRemove(this.leafletMap);
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
		const imageChanging = this.config?.image !== config.image;
		if (imageChanging) {
			this.leafletMap.setMinZoom(-100);
			this.leafletMap.setMaxZoom(100);
			this.leafletMap.setMaxBounds([[-1e5, -1e5], [1e5, 1e5]]);
		}

		const imageChanged = await this.updateImageOverlay(config);
		await this.updateGeoJsonLayers(config);
		await this.riverManager.updateLayers(config);
		await this.overlayManager.updateLayers(
			config,
			this.imageOverlay ? this.imageOverlay.getBounds() : null,
		);
		this.updateZoom(config, imageChanged);
		this.updateHeight(config, embedded);

		this.controls?.updateSettings(config);

		this.leafletMap.invalidateSize();

		this.config = config;
		this.lastEmbedded = embedded;
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

	/**
	 * Fit the map view to encompass all current markers, regions, and paths with some padding.
	 * Called when no explicit center/zoom is configured.
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

	// --- Private ---

	private async updateImageOverlay(config: MapConfig): Promise<boolean> {
		if (this.config?.image === config.image && this.config?.bounds === config.bounds) return false;

		const imageData = await this.imageLoader.getImageData(config.image);
		if (!imageData) return false;

		// Use explicit bounds if configured, otherwise use auto-detected image bounds
		const effectiveBounds = config.bounds ? parseBounds(config.bounds) : null;
		const bounds = effectiveBounds ?? imageData.bounds;

		if (this.imageOverlay) this.leafletMap.removeLayer(this.imageOverlay);
		this.imageOverlay = imageOverlay(imageData.url, bounds);

		this.leafletMap.addLayer(this.imageOverlay);

		// Fit the image bounds first (zoom constraints are already cleared by updateSettings)
		this.leafletMap.fitBounds(bounds, { animate: false });

		// Then lock the pan to the image area
		this.leafletMap.setMaxBounds(bounds);

		if (config.center) {
			this.leafletMap.panTo(parseCoordinates(config.center), { animate: false });
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
		}
	}

	private updateZoom(config: MapConfig, imageChanged: boolean): void {
		this.leafletMap.setMinZoom(config.minZoom);
		this.leafletMap.setMaxZoom(config.maxZoom);

		// Always reset zoom when the map image changes (switching between views)
		// or when the zoom config itself was modified
		if (
			imageChanged ||
			!this.config ||
			this.config.defaultZoom !== config.defaultZoom ||
			this.config.minZoom !== config.minZoom ||
			this.config.maxZoom !== config.maxZoom
		) {
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
			JSON.stringify(prev.styleOverrides) === JSON.stringify(next.styleOverrides)
		);
	}
}
