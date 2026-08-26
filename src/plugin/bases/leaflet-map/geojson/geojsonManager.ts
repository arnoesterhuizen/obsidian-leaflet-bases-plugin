import { GeoJSON, geoJSON, LayerGroup, layerGroup } from "leaflet";
import { App } from "obsidian";
import { Constants as C } from "@plugin/constants";
import { StyleResolver } from "@plugin/styles/styleResolver";
import type { MapConfig } from "@plugin/types";

interface GeoJsonLayerEntry {
	name: string;
	layer: GeoJSON;
}

/**
 * Loads .geojson files from the vault and renders them as Leaflet vector layers.
 * Assigns colors from the plugin-level palette in round-robin order.
 */
export class GeoJsonManager {
	private layers: GeoJsonLayerEntry[] = [];
	private group: LayerGroup = layerGroup();
	private colors: string[] = [];

	constructor(
		private app: App,
		private styleResolver: StyleResolver,
	) {}

	getGroup(): LayerGroup {
		return this.group;
	}

	/**
	 * Returns the current GeoJSON layers for use in a layer control.
	 * Keys are display names (filename without path), values are the Leaflet layers.
	 */
	getOverlays(): Record<string, GeoJSON> {
		const overlays: Record<string, GeoJSON> = {};
		for (const entry of this.layers) {
			overlays[entry.name] = entry.layer;
		}
		return overlays;
	}

	updateColors(colors: string[]): void {
		this.colors = colors.length > 0 ? colors : [C.marker.defaultColor];
	}

	async updateLayers(config: MapConfig): Promise<boolean> {
		const paths = config.geojson;

		// Check if paths changed
		const currentPaths = this.layers.map((l) => l.name);
		const pathsChanged =
			paths.length !== currentPaths.length ||
			paths.some((p, i) => this.extractName(p) !== currentPaths[i]);

		if (!pathsChanged && this.layers.length > 0) return false;

		this.clear();

		for (let i = 0; i < paths.length; i++) {
			const filePath = paths[i]!;
			const data = await this.loadGeoJson(filePath);
			if (!data) continue;

			const fallbackColor = this.colors[i % this.colors.length] ?? C.marker.defaultColor;

			const layer = geoJSON(data, {
				interactive: false,
				style: (feature) => {
					const props = feature?.properties ?? {};
					const group = (props.group as string) ?? "";
					const featureClass = (props.feature_class as string) ?? "";
					const resolved = this.styleResolver.resolve(group, featureClass || undefined);
					return {
						color: resolved.color ?? fallbackColor,
						weight: resolved.weight ?? 2,
						opacity: 0.8,
						fillColor: resolved.color ?? fallbackColor,
						fillOpacity: 0.2,
					};
				},
			});
			const name = this.extractName(filePath);

			this.layers.push({ name, layer });
			this.group.addLayer(layer);
		}

		return true;
	}

	clear(): void {
		this.group.clearLayers();
		this.layers = [];
	}

	unload(): void {
		this.clear();
	}

	private async loadGeoJson(filePath: string): Promise<GeoJSON.GeoJsonObject | null> {
		try {
			const file = this.app.metadataCache.getFirstLinkpathDest(filePath, "");
			if (!file) return null;

			const content = await this.app.vault.read(file);
			return JSON.parse(content) as GeoJSON.GeoJsonObject;
		} catch {
			return null;
		}
	}

	private extractName(filePath: string): string {
		const parts = filePath.split("/");
		const filename = parts[parts.length - 1] ?? filePath;
		return filename.replace(/\.geojson$/i, "");
	}
}
