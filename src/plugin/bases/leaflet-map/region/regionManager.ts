import { LatLng, LatLngBounds, LatLngExpression, LayerGroup, layerGroup, PathOptions, Polygon, polygon } from "leaflet";
import { BasesEntry, ListValue, ObjectValue, Value } from "obsidian";
import { readEntryTags, buildTagSet, matchesTagSet } from "@plugin/bases/leaflet-map/tagUtil";
import type { MapConfig, RegionObject } from "@plugin/types";
import { Constants as C } from "@plugin/constants";
import { SchemaValidator } from "@plugin/validation/schemaValidators";

/**
 * Parses a coordinate string "lat1,lng1 lat2,lng2 ..." into LatLng array.
 */
function parseCoordinateString(coords: string): LatLng[] {
	const points: LatLng[] = [];
	const pairs = coords.trim().split(/\s+/);
	for (const pair of pairs) {
		const match = pair.match(/^(-?[\d.]+),(-?[\d.]+)$/);
		if (match) {
			points.push(new LatLng(parseFloat(match[1]!), parseFloat(match[2]!)));
		}
	}
	return points;
}

/**
 * Convert an ObjectValue to a plain record by reading known region keys.
 */
function objectValueToRecord(obj: ObjectValue): Record<string, unknown> {
	const record: Record<string, unknown> = {};

	const coordinates = obj.get("coordinates");
	if (coordinates && coordinates.isTruthy()) {
		const str = coordinates.toString().trim();
		if (str.length > 0) record.coordinates = str;
	}

	const map = obj.get("map");
	if (map && map.isTruthy()) {
		const str = map.toString().trim();
		if (str.length > 0) record.map = str;
	}

	const color = obj.get("color");
	if (color && color.isTruthy()) {
		const str = color.toString().trim();
		if (str.length > 0) record.color = str;
	}

	return record;
}

/**
 * Parse the raw Value from a BasesEntry into an array of validated RegionObjects.
 */
function parseRegionList(value: Value | null): RegionObject[] | null {
	if (value === null || !value.isTruthy()) return null;

	// Primary approach: use typed Value API
	if (value instanceof ListValue) {
		const results: RegionObject[] = [];
		for (let i = 0; i < value.length(); i++) {
			const element = value.get(i);
			if (element instanceof ObjectValue) {
				const obj = objectValueToRecord(element);
				if (SchemaValidator.region(obj)) {
					results.push(obj);
				}
			}
		}
		if (results.length > 0) return results;
	}

	// Fallback: try JSON parsing the string representation
	try {
		let entryString = value.toString();
		if (!entryString || entryString.length === 0) return null;

		if (!entryString.startsWith("[")) entryString = `[${entryString}]`;

		const parsed: unknown = JSON.parse(entryString);
		if (!Array.isArray(parsed)) return null;

		const results = parsed.filter(
			(item): item is RegionObject => {
				if (!item || typeof item !== "object" || Array.isArray(item)) return false;
				return SchemaValidator.region(item);
			},
		);
		return results.length > 0 ? results : null;
	} catch {
		return null;
	}
}

/**
 * Read a simple string value from a BasesEntry property.
 */
function readStringProperty(entry: BasesEntry, property: string | undefined): string | undefined {
	if (!property) return undefined;
	try {
		const value = entry.getValue(property as `note.${string}`);
		if (!value || !value.isTruthy()) return undefined;
		const str = value.toString().trim();
		return str.length > 0 ? str : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Renders closed polygons from note frontmatter properties.
 * Follows the MarkerManager pattern: reads BasesEntry data, parses
 * region objects, filters by map name, and renders Leaflet Polygons.
 */
export class RegionManager {
	private group: LayerGroup = layerGroup();
	private regions: { poly: Polygon; tags: string[] }[] = [];
	private config: MapConfig | undefined;
	private activeTagSet: Set<string> | null = null;

	unload(): void {
		this.clear();
	}

	getBounds(): LatLngBounds | null {
		if (this.regions.length === 0) return null;
		const bounds = new LatLngBounds([]);
		for (const { poly, tags } of this.regions) {
			if (this.activeTagSet && !matchesTagSet(tags, this.activeTagSet)) continue;
			bounds.extend(poly.getBounds());
		}
		return bounds.isValid() ? bounds : null;
	}

	getGroup(): LayerGroup {
		return this.group;
	}

	updateConfig(config: MapConfig): void {
		this.config = config;
	}

	/**
	 * Apply a tag filter to show/hide regions based on the active base layer's tags.
	 * Pass null to clear the filter and show all regions.
	 */
	applyTagFilter(layerTags: string[] | null): void {
		this.activeTagSet = layerTags ? buildTagSet(layerTags) : null;
		this.group.clearLayers();
		for (const { poly, tags } of this.regions) {
			if (!this.activeTagSet || matchesTagSet(tags, this.activeTagSet)) {
				this.group.addLayer(poly);
			}
		}
	}

	updateRegions(data: { data: BasesEntry[] }): void {
		if (!this.config) return;

		this.clear();

		const regionProp = this.config.regionProperty as `note.${string}`;
		const mapName = this.config.mapName;

		for (const entry of data.data) {
			const rawValue = entry.getValue(regionProp);
			const regionObjects = parseRegionList(rawValue);
			if (!regionObjects) continue;

			// Filter by map name (same logic as MarkerManager)
			const matching = regionObjects.filter(
				(obj) => mapName ? obj.map === mapName : obj.map === undefined,
			);

			for (const obj of matching) {
				const points = parseCoordinateString(obj.coordinates);
				if (points.length < 3) continue;

				// Resolve color: per-region → note property → default
				const color = obj.color
					?? readStringProperty(entry, this.config.regionColorProperty)
					?? C.region.defaultColor;

				const name = entry.file.basename;

				const style: PathOptions = {
					color: color,
					fillColor: color,
					fillOpacity: 0.3,
					weight: 2,
					opacity: 0.7,
				};

				const poly = polygon(points as LatLngExpression[], style);
				if (name) {
					poly.bindTooltip(name);
				}
				const tags = readEntryTags(entry);
				this.regions.push({ poly, tags });
				if (!this.activeTagSet || matchesTagSet(tags, this.activeTagSet)) {
					this.group.addLayer(poly);
				}
			}
		}
	}

	private clear(): void {
		this.group.clearLayers();
		this.regions = [];
	}
}
