import { BasesView, debounce, QueryController } from "obsidian";
import { LatLng } from "leaflet";
import { MapManager } from "@plugin/bases/leaflet-map/map/mapManager";
import { Constants as C } from "@plugin/constants";
import { BasesLeafletViewPlugin } from "@plugin/plugin";
import { ViewRegistrationBuilder } from "@plugin/types";
import { shouldFitToContent } from "@plugin/util";
import { ViewUtil } from "./viewUtil";

export const LeafletMapViewRegistrationBuilder: ViewRegistrationBuilder = (
	plugin: BasesLeafletViewPlugin,
) => [
	C.view.type,
	{
		name: "Leaflet Map",
		icon: C.view.icon,
		factory: (controller, parentEl) => new LeafletMapView(controller, parentEl, plugin),
		options: () => ViewUtil.getViewOptions(),
	},
];

interface EphemeralState {
	center?: { lat: number; lng: number };
	zoom?: number;
	baseLayerIndex?: number;
}

class LeafletMapView extends BasesView {
	type = C.view.type;
	private viewUtil: ViewUtil;
	private mapManager: MapManager;
	private scrollEl: HTMLElement;
	private pendingState: EphemeralState | null = null;
	/**
	 * True until the first data load has been applied. The Leaflet map lives for
	 * the whole view, so after the first load it already holds the user's live
	 * viewport; subsequent refreshes (tab switch, popup close, tag edit) must not
	 * re-fit and discard it.
	 */
	private firstLoad: boolean = true;

	constructor(controller: QueryController, parentEl: HTMLElement, plugin: BasesLeafletViewPlugin) {
		super(controller);

		this.scrollEl = parentEl;
		const containerEl = parentEl.createDiv("bases-leaflet-map-container");

		this.viewUtil = new ViewUtil(this);
		this.mapManager = new MapManager(plugin, containerEl, this.viewUtil);
	}

	onDataUpdated(): void {
		const config = this.viewUtil.getMapConfig();
		if (!config) return;

		const embedded = this.isEmbedded();

		void this.mapManager.updateSettings(config, embedded).then(() => {
			this.mapManager.updateData(this.data);

			const fit = shouldFitToContent({
				firstLoad: this.firstLoad,
				hasPendingState: this.pendingState != null,
				hasConfiguredCenter: config.center != null,
				hasConfiguredZoom: this.hasConfiguredZoom(),
			});

			// Apply pending ephemeral state after data is loaded
			if (this.pendingState) {
				const { center, zoom, baseLayerIndex } = this.pendingState;

				// Restore base layer first (before viewport, since tag filter affects fitToContent)
				if (baseLayerIndex !== undefined) {
					void this.mapManager.setActiveBaseLayer(baseLayerIndex);
				}

				if (center) {
					this.mapManager.panTo(new LatLng(center.lat, center.lng));
				}
				if (zoom !== undefined) {
					this.mapManager.setZoom(zoom);
				}
				this.pendingState = null;
			} else if (fit) {
				// First load with no explicit center/zoom and no ephemeral state to
				// restore: fit the view to encompass all markers. Subsequent refreshes
				// preserve the live viewport (the map is never torn down); the "Fit to
				// view" control is the deliberate reset.
				this.mapManager.fitToContent();
			}

			this.firstLoad = false;
		});
	}

	/** Returns true if the user has explicitly configured a defaultZoom value. */
	private hasConfiguredZoom(): boolean {
		const raw = this.viewUtil.getRawConfig(C.view.keys.defaultZoom);
		return raw != null && typeof raw === "number";
	}

	/** Debounced resize handler — prevents map thrashing during window/pane resizes. */
	private onResizeDebounce = debounce(() => this.mapManager.invalidateSize(), 100, true);

	override onResize(): void {
		this.onResizeDebounce();
	}

	override unload(): void {
		this.mapManager.unload();
	}

	// --- Ephemeral state for workspace history navigation ---

	public override getEphemeralState(): Record<string, unknown> {
		const state = this.mapManager.getViewState();
		if (!state) return {};
		return {
			center: { lat: state.center.lat, lng: state.center.lng },
			zoom: state.zoom,
			baseLayerIndex: this.mapManager.getActiveBaseLayerIndex(),
		};
	}

	public override setEphemeralState(state: unknown): void {
		if (!state || typeof state !== "object") {
			this.pendingState = null;
			return;
		}

		const s = state as Record<string, unknown>;
		const pending: EphemeralState = {};

		if (
			s.center &&
			typeof s.center === "object" &&
			"lat" in s.center &&
			"lng" in s.center &&
			typeof (s.center as Record<string, unknown>).lat === "number" &&
			typeof (s.center as Record<string, unknown>).lng === "number"
		) {
			pending.center = s.center as { lat: number; lng: number };
		}
		if (typeof s.zoom === "number") {
			pending.zoom = s.zoom;
		}
		if (typeof s.baseLayerIndex === "number") {
			pending.baseLayerIndex = s.baseLayerIndex;
		}

		this.pendingState = pending;
	}

	// --- Embedded detection ---

	private isEmbedded(): boolean {
		return this.scrollEl.parentElement?.matchParent(".bases-embed, .block-language-base") != null;
	}
}
