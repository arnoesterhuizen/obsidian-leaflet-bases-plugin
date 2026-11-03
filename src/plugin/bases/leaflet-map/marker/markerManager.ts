import { LatLngBounds, LayerGroup } from "leaflet";
import { App, BasesEntry, ObjectValue, Value, ListValue } from "obsidian";
import { readEntryTags, buildTagSet, matchesTagSet } from "@plugin/bases/leaflet-map/tagUtil";
import { Map } from "@plugin/bases/leaflet-map/map/map";
import { Constants as C } from "@plugin/constants";
import { Frontmatter } from "@plugin/properties/frontmatter";
import { StyleResolver } from "@plugin/styles/styleResolver";
import { MapConfig, MarkerEntry, MarkerObject } from "@plugin/types";
import { parseCoordinates } from "@plugin/util";
import { SchemaValidator } from "@plugin/validation/schemaValidators";
import { Validator } from "@plugin/validation/validators";
import { marker, Marker } from "./marker";

/**
 * Parse the raw Value from a BasesEntry into an array of validated MarkerObjects.
 * Uses the Obsidian Value API (ListValue/ObjectValue) to avoid lossy toString() serialization.
 * Falls back to JSON parsing for environments where the Value API behaves differently.
 */
function parseMarkerList(value: Value | null): MarkerObject[] | null {
	if (value === null || !value.isTruthy()) return null;

	// Primary approach: use typed Value API
	if (value instanceof ListValue) {
		const results: MarkerObject[] = [];
		for (let i = 0; i < value.length(); i++) {
			const element = value.get(i);
			if (element instanceof ObjectValue) {
				const obj = objectValueToRecord(element);
				if (SchemaValidator.marker(obj)) {
					results.push(obj);
				}
			}
		}
		if (results.length > 0) return results;
	}

	// Fallback: try JSON parsing the string representation
	// This handles cases where the Value type hierarchy differs
	try {
		let entryString = value.toString();
		if (!entryString || entryString.length === 0) return null;

		// Attempt to make it a valid JSON array
		if (!entryString.startsWith("[")) entryString = `[${entryString}]`;

		const parsed: unknown = JSON.parse(entryString);
		if (!Array.isArray(parsed)) return null;

		const results = parsed
			.filter((item): item is MarkerObject => {
				if (!item || typeof item !== "object" || Array.isArray(item)) return false;
				return SchemaValidator.marker(item);
			});
		return results.length > 0 ? results : null;
	} catch {
		return null;
	}
}

/**
 * Convert an ObjectValue to a plain record by reading known marker keys.
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
		// map can be a single string or a list of strings
		if (map instanceof ListValue) {
			const items: string[] = [];
			for (let i = 0; i < map.length(); i++) {
				const element = map.get(i);
				if (element && element.isTruthy()) {
					const str = element.toString().trim();
					if (str.length > 0) items.push(str);
				}
			}
			if (items.length === 1) record.map = items[0];
			else if (items.length > 1) record.map = items;
		} else {
			const str = map.toString().trim();
			if (str.length > 0) record.map = str;
		}
	}

	return record;
}

/**
 * Read a simple string value from a BasesEntry property.
 * Returns undefined if the property is absent or not a non-empty string.
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
 * Resolve an icon name from a note property value.
 * If the value has no prefix (e.g. "swords"), prepend "lucide-".
 * If it already has a prefix ("lucide-swords" or "mdi:sword"), use as-is.
 */
function resolveIconName(value: string | undefined): string | undefined {
	if (!value) return undefined;

	// Already has an iconify prefix (contains colon) or a lucide- prefix — use as-is
	if (value.includes(":") || value.startsWith("lucide-")) {
		return Validator.icon(value) ? value : undefined;
	}

	// Infer lucide- prefix
	const withPrefix = `lucide-${value}`;
	return Validator.icon(withPrefix) ? withPrefix : undefined;
}

/**
 * Resolve a color value from a note property.
 * - Hex codes (#fff, #ff0000) are used as-is.
 * - Named colors (blue, red, yellow) resolve to var(--color-<name>), matching Obsidian's
 *   built-in CSS variables used by callouts and the UI.
 * - Absent/invalid values fall back to the default marker color.
 */
function resolveColor(value: string | undefined): string {
	if (!value) return C.marker.defaultColor;

	// Hex code — use directly
	if (Validator.color(value)) return value;

	// Named color — map to CSS variable (e.g. "blue" → "var(--color-blue)")
	const name = value.trim().toLowerCase();
	if (name.length > 0 && /^[a-z]+(-[a-z]+)*$/.test(name)) {
		return `var(--color-${name})`;
	}

	return C.marker.defaultColor;
}



export class MarkerManager {
	private config: MapConfig | undefined;
	private markers: { item: Marker; entry: MarkerEntry; tags: string[] }[] = [];
	private refreshHandler = () => this.refreshMarkerVisibility();
	private activeTagSet: Set<string> | null = null;

	constructor(
		private app: App,
		private map: Map,
		private markerLayer: LayerGroup,
		private frontmatter: Frontmatter,
		private styleResolver: StyleResolver,
	) {}

	unload(): void {
		this.map.off(C.map.events.markerRefresh, this.refreshHandler);
		this.map.off("moveend", this.refreshHandler);
		this.markerLayer.clearLayers();
		this.markers = [];
	}

	updateConfig(config: MapConfig): void {
		this.config = config;
	}

	/**
	 * Apply a tag filter to show/hide markers based on the active base layer's tags.
	 * Pass null to clear the filter and show all markers.
	 */
	applyTagFilter(layerTags: string[] | null): void {
		this.activeTagSet = layerTags ? buildTagSet(layerTags) : null;
		this.refreshMarkerVisibility();
	}

	/**
	 * Returns the bounding box of all current markers, or null if there are none.
	 * When a tag filter is active, only matching markers are included.
	 */
	getMarkerBounds(): LatLngBounds | null {
		if (this.markers.length === 0) return null;

		const bounds = new LatLngBounds([]);
		for (const { entry, tags } of this.markers) {
			if (this.activeTagSet && !matchesTagSet(tags, this.activeTagSet)) continue;
			bounds.extend(parseCoordinates(entry.coordinates));
		}
		return bounds.isValid() ? bounds : null;
	}

	updateMarkers(data: { data: BasesEntry[] }): void {
		if (!this.config) return;

		this.map.off(C.map.events.markerRefresh, this.refreshHandler);
		this.map.off("moveend", this.refreshHandler);
		this.markerLayer.clearLayers();
		this.markers = [];

		const markerProp = this.config.markerProperty as `note.${string}`;
		const mapName = this.config.mapName;

		for (const entry of data.data) {
			const rawValue = entry.getValue(markerProp);
			const markerObjects = parseMarkerList(rawValue);

			if (rawValue && !markerObjects) {
				console.debug(`[leaflet-bases] ${entry.file.basename}: getValue returned ${rawValue?.constructor?.name ?? typeof rawValue}, toString="${rawValue?.toString()?.slice(0, 100)}", but parseMarkerList returned null`);
			}

			if (!markerObjects) continue;

			// Filter by map name:
			// - View has mapName: only show markers explicitly assigned to that map
			//   (supports both single string and array of strings)
			// - View has no mapName: only show markers with no map assignment
			const matching = markerObjects.filter((obj) => {
				if (mapName) {
					if (Array.isArray(obj.map)) return obj.map.includes(mapName);
					return obj.map === mapName;
				}
				return obj.map === undefined;
			});

			if (markerObjects.length > 0 && matching.length !== markerObjects.length) {
				console.debug(`[leaflet-bases] ${entry.file.basename}: ${markerObjects.length} markers, ${matching.length} matching mapName=${JSON.stringify(mapName)}`, markerObjects);
			}

			for (const obj of matching) {
				const resolved = this.resolveMarkerEntry(obj, entry);
				const markerItem = marker(this.app, this.map, resolved, this.frontmatter);
				const tags = readEntryTags(entry);
				this.markers.push({ item: markerItem, entry: resolved, tags });
				if (!this.activeTagSet || matchesTagSet(tags, this.activeTagSet)) {
					this.addMarker(markerItem);
				}
			}
		}

		this.map.on(C.map.events.markerRefresh, this.refreshHandler);
		this.map.on("moveend", this.refreshHandler);
	}

	/**
	 * Resolve a MarkerObject into a fully-resolved MarkerEntry by applying the
	 * fallback chain: per-marker override -> note-level property -> style rules -> default.
	 */
	private resolveMarkerEntry(obj: MarkerObject, entry: BasesEntry): MarkerEntry {
		const noteIcon = readStringProperty(entry, this.config?.markerIconProperty);
		const noteColor = readStringProperty(entry, this.config?.markerColorProperty);

		// If note doesn't have explicit icon/color, try style resolution from tags
		let resolvedIcon: string | undefined;
		let resolvedColor: string | undefined;

		if (!noteIcon || !noteColor) {
			const { group, featureClass } = this.extractGroupAndClass(entry);
			if (group) {
				const resolved = this.styleResolver.resolve(group, featureClass);
				if (!noteIcon && resolved.icon) resolvedIcon = resolved.icon;
				if (!noteColor && resolved.color) resolvedColor = resolved.color;
			}
		}

		return {
			coordinates: obj.coordinates,
			map: obj.map,
			icon: resolveIconName(noteIcon) ?? resolveIconName(resolvedIcon),
			color: noteColor ? resolveColor(noteColor) : (resolvedColor ?? resolveColor(undefined)),
			name: entry.file.basename,
			link: entry.file.path,
		};
	}

	/**
	 * Extract group and featureClass from a note's tags.
	 * Looks for `atlas/group/{group}` and `atlas/type/{type}` tag patterns.
	 */
	private extractGroupAndClass(entry: BasesEntry): { group?: string; featureClass?: string } {
		let group: string | undefined;
		let featureClass: string | undefined;

		try {
			// Try file.tags first (includes all tags in file)
			let tagsValue = entry.getValue("file.tags");

			// Fallback: try note.tags (frontmatter tags property)
			if (!tagsValue || !tagsValue.isTruthy()) {
				tagsValue = entry.getValue("note.tags");
			}

			if (!tagsValue || !tagsValue.isTruthy()) return { group, featureClass };

			// Handle ListValue (array of tag values)
			if (tagsValue instanceof ListValue) {
				for (let i = 0; i < tagsValue.length(); i++) {
					const element = tagsValue.get(i);
					if (!element || !element.isTruthy()) continue;
					let tagStr = element.toString().trim();
					// Strip leading # if present (Obsidian normalizes tags with #)
					if (tagStr.startsWith("#")) tagStr = tagStr.substring(1);
					if (tagStr.startsWith("atlas/group/")) {
						group = tagStr.substring("atlas/group/".length);
					} else if (tagStr.startsWith("atlas/type/")) {
						featureClass = tagStr.substring("atlas/type/".length);
					}
				}
			} else {
				// Fallback: try parsing toString as comma-separated or single value
				const str = tagsValue.toString().trim();
				if (str.length > 0) {
					const tags = str.includes(",") ? str.split(",").map((t) => t.trim()) : [str];
					for (let tag of tags) {
						if (tag.startsWith("#")) tag = tag.substring(1);
						if (tag.startsWith("atlas/group/")) {
							group = tag.substring("atlas/group/".length);
						} else if (tag.startsWith("atlas/type/")) {
							featureClass = tag.substring("atlas/type/".length);
						}
					}
				}
			}
		} catch {
			// Silently ignore tag parsing errors
		}

		return { group, featureClass };
	}

	private refreshMarkerVisibility(): void {
		this.markerLayer.clearLayers();

		const zoom = this.map.getZoom();
		const bounds = this.map.getBounds();

		// Filter markers by active tag filter
		const visibleMarkers = this.activeTagSet
			? this.markers.filter(({ tags }) => matchesTagSet(tags, this.activeTagSet!))
			: this.markers;

		// At high zoom or with few markers, show everything
		if (visibleMarkers.length <= 50 || zoom >= (this.config?.maxZoom ?? 10) - 1) {
			for (const { item } of visibleMarkers) {
				this.addMarker(item);
			}
			return;
		}

		// Grid-based declutter: divide viewport into cells, show one marker per cell.
		// Cell size in pixels — larger cells = more aggressive decluttering.
		const cellSize = 40;
		const mapSize = this.map.getSize();
		const cols = Math.ceil(mapSize.x / cellSize);
		const rows = Math.ceil(mapSize.y / cellSize);
		const occupied = new Set<string>();

		for (const { item, entry } of visibleMarkers) {
			const coords = parseCoordinates(entry.coordinates);
			const latLng = { lat: coords[0], lng: coords[1] };

			// Skip markers outside viewport
			if (!bounds.contains(latLng)) continue;

			// Map to grid cell
			const point = this.map.latLngToContainerPoint(latLng);
			const col = Math.floor(point.x / cellSize);
			const row = Math.floor(point.y / cellSize);

			// Clamp to grid bounds
			if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

			const key = `${col},${row}`;
			if (occupied.has(key)) continue;

			occupied.add(key);
			this.addMarker(item);
		}
	}

	private addMarker(markerItem: Marker): void {
		markerItem.addTo(this.markerLayer);

		if (this.map.markerDragEnabled) {
			markerItem.dragging?.enable();
		} else {
			markerItem.dragging?.disable();
		}
	}
}
