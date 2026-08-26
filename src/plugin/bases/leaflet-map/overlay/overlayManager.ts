import { ImageOverlay, imageOverlay, LatLngBoundsExpression, LayerGroup, layerGroup } from "leaflet";
import { App } from "obsidian";
import type { MapConfig } from "@plugin/types";

/**
 * Manages SVG/image overlays rendered between the base map image and vector layers.
 *
 * SVG files from toril-gis include data attributes on the root <svg> element:
 *   data-map-west, data-map-east, data-map-south, data-map-north
 * These are used to position the overlay correctly on the map.
 *
 * If no data attributes are found, the overlay uses the map's full image bounds.
 */
export class OverlayManager {
	private group: LayerGroup = layerGroup();
	private overlays: ImageOverlay[] = [];
	private currentPaths: string[] = [];

	constructor(private app: App) {}

	getGroup(): LayerGroup {
		return this.group;
	}

	async updateLayers(config: MapConfig, imageBounds: LatLngBoundsExpression | null): Promise<boolean> {
		const paths = config.overlays ?? [];

		if (paths.length === 0) {
			const hadLayers = this.currentPaths.length > 0;
			this.clear();
			return hadLayers;
		}

		// Check if paths changed
		const pathsChanged =
			paths.length !== this.currentPaths.length ||
			paths.some((p, i) => p !== this.currentPaths[i]);

		if (!pathsChanged && this.overlays.length > 0) return false;

		this.clear();
		this.currentPaths = [...paths];

		for (const filePath of paths) {
			const overlay = await this.loadOverlay(filePath, imageBounds);
			if (overlay) {
				this.overlays.push(overlay);
				this.group.addLayer(overlay);
			}
		}

		return true;
	}

	clear(): void {
		for (const overlay of this.overlays) {
			const url = (overlay as unknown as { _url: string })._url;
			if (url && url.startsWith("blob:")) {
				URL.revokeObjectURL(url);
			}
		}
		this.group.clearLayers();
		this.overlays = [];
		this.currentPaths = [];
	}

	unload(): void {
		this.clear();
	}

	private async loadOverlay(
		filePath: string,
		fallbackBounds: LatLngBoundsExpression | null,
	): Promise<ImageOverlay | null> {
		try {
			const file = this.app.metadataCache.getFirstLinkpathDest(filePath, "");
			if (!file) return null;

			const content = await this.app.vault.read(file);

			// Parse SVG to extract bounds from data attributes
			const bounds = this.parseSvgBounds(content) ?? fallbackBounds;
			if (!bounds) return null;

			// Create a data URI from the SVG content
			const blob = new Blob([content], { type: "image/svg+xml" });
			const url = URL.createObjectURL(blob);

			return imageOverlay(url, bounds, {
				opacity: 1,
				interactive: false,
			});
		} catch {
			return null;
		}
	}

	/**
	 * Parse geo-bounds from SVG data attributes.
	 * Toril-gis SVGs include: data-map-west, data-map-east, data-map-south, data-map-north
	 */
	private parseSvgBounds(svgContent: string): LatLngBoundsExpression | null {
		const westMatch = svgContent.match(/data-map-west="([^"]+)"/);
		const eastMatch = svgContent.match(/data-map-east="([^"]+)"/);
		const southMatch = svgContent.match(/data-map-south="([^"]+)"/);
		const northMatch = svgContent.match(/data-map-north="([^"]+)"/);

		if (!westMatch || !eastMatch || !southMatch || !northMatch) return null;

		const west = parseFloat(westMatch[1]!);
		const east = parseFloat(eastMatch[1]!);
		const south = parseFloat(southMatch[1]!);
		const north = parseFloat(northMatch[1]!);

		if ([west, east, south, north].some(isNaN)) return null;

		// Leaflet bounds: [[south, west], [north, east]]
		return [[south, west], [north, east]];
	}
}
