import { App, BasesAllOptions, BasesEntry, BasesView, Notice } from "obsidian";
import { Constants as C } from "@plugin/constants";
import { BaseLayerConfig, MapConfig, StringMap, StyleRule } from "@plugin/types";
import { clamp, parseBounds } from "@plugin/util";
import { Validator } from "@plugin/validation/validators";

export class ViewUtil {
	constructor(private view: BasesView) {}

	get app(): App {
		return this.view.app;
	}

	get entries(): BasesEntry[] {
		return this.view.data.data;
	}

	getMapConfig(): MapConfig | null {
		const baseLayers = this.parseBaseLayers();
		console.debug("[leaflet-bases] getMapConfig: baseLayers =", baseLayers);

		// When baseLayers is present, use the first layer's image; otherwise use top-level image
		const image = baseLayers && baseLayers.length > 0
			? baseLayers[0]!.image
			: this.view.config.get(C.view.keys.image);
		console.debug("[leaflet-bases] getMapConfig: image =", image, "valid =", Validator.source(image));
		if (!Validator.source(image)) return null;

		const minZoom = this.getNumericConfig(C.view.keys.minZoom, C.map.default.minZoom);
		const maxZoom = Math.max(
			this.getNumericConfig(C.view.keys.maxZoom, C.map.default.maxZoom),
			minZoom,
		);

		const rawScale = this.view.config.get(C.view.keys.scale);
		const scale =
			typeof rawScale === "string" ? parseFloat(rawScale) : (rawScale as number | undefined);

		const center = this.view.config.get(C.view.keys.center);

		const rawBounds = this.view.config.get(C.view.keys.bounds);
		const bounds =
			typeof rawBounds === "string" && Validator.bounds(rawBounds) ? rawBounds : undefined;

		// When baseLayers is present, ignore top-level overlays/geojson/rivers
		const geojson = baseLayers ? [] : this.getGeojsonPaths();
		const rivers = baseLayers ? [] : this.getPathList(C.view.keys.rivers);
		const overlays = baseLayers ? [] : this.getPathList(C.view.keys.overlays);

		return {
			image,
			height: this.getNumericConfig(C.view.keys.height, C.map.default.height),
			mapName: this.getStringConfig(C.view.keys.mapName),
			center: Validator.coordinates(center) ? center : undefined,
			bounds,
			overlays,
			geojson,
			rivers,
			baseLayers: baseLayers ?? undefined,
			markerProperty: this.getStringConfig(C.view.keys.markerProperty) ?? C.marker.defaultProperty,
			markerIconProperty: this.getStringConfig(C.view.keys.markerIcon) ?? C.marker.defaultIconProperty,
			markerColorProperty: this.getStringConfig(C.view.keys.markerColor) ?? C.marker.defaultColorProperty,
			regionProperty: this.getStringConfig(C.view.keys.regionProperty) ?? C.region.defaultProperty,
			regionColorProperty: this.getStringConfig(C.view.keys.regionColor) ?? C.region.defaultColorProperty,
			pathProperty: this.getStringConfig(C.view.keys.pathProperty) ?? C.path.defaultProperty,
			pathColorProperty: this.getStringConfig(C.view.keys.pathColor) ?? C.path.defaultColorProperty,
			minZoom,
			maxZoom,
			defaultZoom: clamp(
				this.getNumericConfig(C.view.keys.defaultZoom, minZoom),
				minZoom,
				maxZoom,
			),
			zoomDelta: this.getNumericConfig(C.view.keys.zoomDelta, C.map.default.zoomDelta),
			scale: Validator.positiveNumber(scale) ? scale : C.map.default.scale,
			unit: this.getStringConfig(C.view.keys.unit) ?? C.map.default.unit,
			styleOverrides: parseStyleOverrides(this.getStringConfig(C.view.keys.styles)),
		};
	}

	updateSetting(key: string, value: unknown): void {
		this.view.config.set(key, value);
	}

	getRawConfig(key: string): unknown {
		return this.view.config.get(key);
	}

	async createFileForView(frontmatterData: StringMap, name?: string) {
		try {
			await this.view.createFileForView(name, (frontmatter: StringMap) => {
				Object.entries(frontmatterData).forEach(([key, value]) => (frontmatter[key] = value));
			});
		} catch (error) {
			if ((error as Error).message === "Formula cannot be deserialized") {
				new Notice("Obsidian could not deserialise your formula");
			} else throw error;
		}
	}

	private getNumericConfig(key: string, defaultValue: number): number {
		const value = this.view.config.get(key);
		if (typeof value === "number" && isFinite(value)) return value;
		return defaultValue;
	}

	private getStringConfig(key: string): string | undefined {
		const value = this.view.config.get(key);
		if (typeof value === "string" && value.length > 0) return value;
		return undefined;
	}

	private getGeojsonPaths(): string[] {
		return this.getPathList(C.view.keys.geojson);
	}

	/**
	 * Parse the `baseLayers` config key into validated BaseLayerConfig entries.
	 * Returns null if baseLayers is absent or empty.
	 */
	private parseBaseLayers(): BaseLayerConfig[] | null {
		const raw = this.view.config.get(C.view.keys.baseLayers);
		console.debug("[leaflet-bases] parseBaseLayers: raw =", raw, "type =", typeof raw, "isArray =", Array.isArray(raw));
		if (!Array.isArray(raw) || raw.length === 0) return null;

		const layers: BaseLayerConfig[] = [];
		for (const entry of raw) {
			if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;

			const rec = entry as Record<string, unknown>;

			// Validate required fields
			const name = rec.name;
			if (typeof name !== "string" || name.length === 0) continue;

			const image = rec.image;
			if (!Validator.source(image)) continue;

			const tags = rec.tags;
			if (!Array.isArray(tags) || tags.length === 0) continue;
			const validTags = tags.filter((t): t is string => typeof t === "string" && t.length > 0);
			if (validTags.length === 0) continue;

			// Optional array fields default to []
			const overlays = this.parseStringArray(rec.overlays);
			const geojson = this.parseStringArray(rec.geojson);
			const rivers = this.parseStringArray(rec.rivers);

			layers.push({ name, image, overlays, geojson, rivers, tags: validTags });
		}

		return layers.length > 0 ? layers : null;
	}

	/**
	 * Parse an unknown value into a string array. Returns [] if the value is not
	 * a valid array of strings.
	 */
	private parseStringArray(value: unknown): string[] {
		if (!Array.isArray(value)) return [];
		return value
			.filter((item): item is string => typeof item === "string" && item.length > 0)
			.map((item) => item.trim());
	}

	private getPathList(key: string): string[] {
		const value = this.view.config.get(key);
		if (typeof value === "string" && value.length > 0) {
			return value
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line.length > 0);
		}
		if (Array.isArray(value)) {
			return value
				.filter((item): item is string => typeof item === "string" && item.length > 0)
				.map((item) => item.trim());
		}
		return [];
	}

	static getViewOptions(): BasesAllOptions[] {
		return [
			{
				displayName: "Image",
				type: "file",
				key: C.view.keys.image,
				filter: (file) => (C.map.imageTypes as readonly string[]).includes(file.extension),
			},
			{
				displayName: "Embedded height",
				type: "slider",
				key: C.view.keys.height,
				default: C.map.default.height,
				...C.view.config.height,
			},
			{
				displayName: "Map name",
				type: "text",
				key: C.view.keys.mapName,
				placeholder: "Optional",
			},
			{
				displayName: "Default center point",
				type: "text",
				key: C.view.keys.center,
				placeholder: "Optional",
			},
			{
				displayName: "Bounds",
				type: "text",
				key: C.view.keys.bounds,
				placeholder: "latSW,lngSW latNE,lngNE",
			},
			{
				displayName: "GeoJSON layers",
				type: "text",
				key: C.view.keys.geojson,
				placeholder: "path/to/file.geojson (one per line)",
			},
			{
				displayName: "River layers",
				type: "text",
				key: C.view.keys.rivers,
				placeholder: "path/to/rivers.geojson (one per line)",
			},
			{
				displayName: "Style overrides",
				type: "text",
				key: C.view.keys.styles,
				placeholder: "group.Class: icon=name color=#hex weight=N",
			},
			{
				displayName: "SVG overlays",
				type: "text",
				key: C.view.keys.overlays,
				placeholder: "path/to/overlay.svg (one per line)",
			},
			{
				displayName: "Markers",
				type: "group",
				items: [
					{
						displayName: "Marker coordinates",
						type: "property",
						key: C.view.keys.markerProperty,
						filter: (prop) => !prop.startsWith("file."),
						placeholder: "Property",
					},
					{
						displayName: "Marker icon",
						type: "property",
						key: C.view.keys.markerIcon,
						filter: (prop) => !prop.startsWith("file."),
						placeholder: "Property",
					},
					{
						displayName: "Marker color",
						type: "property",
						key: C.view.keys.markerColor,
						filter: (prop) => !prop.startsWith("file."),
						placeholder: "Property",
					},
				],
			},
			{
				displayName: "Regions",
				type: "group",
				items: [
					{
						displayName: "Region property",
						type: "property",
						key: C.view.keys.regionProperty,
						filter: (prop) => !prop.startsWith("file."),
						placeholder: "Property",
					},
					{
						displayName: "Region color",
						type: "property",
						key: C.view.keys.regionColor,
						filter: (prop) => !prop.startsWith("file."),
						placeholder: "Property",
					},
				],
			},
			{
				displayName: "Paths",
				type: "group",
				items: [
					{
						displayName: "Path property",
						type: "property",
						key: C.view.keys.pathProperty,
						filter: (prop) => !prop.startsWith("file."),
						placeholder: "Property",
					},
					{
						displayName: "Path color",
						type: "property",
						key: C.view.keys.pathColor,
						filter: (prop) => !prop.startsWith("file."),
						placeholder: "Property",
					},
				],
			},
			{
				displayName: "Zoom",
				type: "group",
				items: [
					{
						displayName: "Default zoom",
						type: "slider",
						key: C.view.keys.defaultZoom,
						default: C.map.default.minZoom,
						...C.view.config.zoom.base,
					},
					{
						displayName: "Minimum zoom",
						type: "slider",
						key: C.view.keys.minZoom,
						default: C.map.default.minZoom,
						...C.view.config.zoom.base,
					},
					{
						displayName: "Maximum zoom",
						type: "slider",
						key: C.view.keys.maxZoom,
						default: C.map.default.maxZoom,
						...C.view.config.zoom.base,
					},
					{
						displayName: "Zoom stepsize",
						type: "slider",
						key: C.view.keys.zoomDelta,
						default: C.map.default.zoomDelta,
						...C.view.config.zoom.delta,
					},
				],
			},
			{
				displayName: "Measure",
				type: "group",
				items: [
					{
						displayName: "Scale",
						type: "text",
						key: C.view.keys.scale,
						default: C.map.default.scale.toString(),
					},
					{
						displayName: "Unit",
						type: "text",
						key: C.view.keys.unit,
						placeholder: "Unit of measurement",
					},
				],
			},
		];
	}
}

/**
 * Parse a multiline style override string from the .base file config.
 * Each line: `group.featureClass: icon=value color=#hex weight=N`
 * featureClass is optional: `group: color=#hex weight=N`
 */
function parseStyleOverrides(raw: string | undefined): StyleRule[] {
	if (!raw) return [];
	const rules: StyleRule[] = [];
	const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

	for (const line of lines) {
		const colonIdx = line.indexOf(":");
		if (colonIdx < 0) continue;

		const key = line.substring(0, colonIdx).trim();
		const values = line.substring(colonIdx + 1).trim();

		// Parse key: "group" or "group.featureClass"
		const dotIdx = key.indexOf(".");
		const group = dotIdx >= 0 ? key.substring(0, dotIdx) : key;
		const featureClass = dotIdx >= 0 ? key.substring(dotIdx + 1) : undefined;

		// Parse values: space-separated key=value pairs
		const rule: StyleRule = { group };
		if (featureClass) rule.featureClass = featureClass;

		const pairs = values.match(/(\w+)=([^\s]+)/g) ?? [];
		for (const pair of pairs) {
			const eqIdx = pair.indexOf("=");
			const k = pair.substring(0, eqIdx);
			const v = pair.substring(eqIdx + 1);
			if (k === "icon") rule.icon = v;
			else if (k === "color") rule.color = v;
			else if (k === "weight") rule.weight = parseFloat(v);
		}

		rules.push(rule);
	}
	return rules;
}
