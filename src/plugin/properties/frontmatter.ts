import { App, TFile } from "obsidian";
import { Coordinates, MarkerEntry, MarkerObject } from "@plugin/types";
import { isArray } from "@plugin/util";
import { SchemaValidator } from "@plugin/validation/schemaValidators";
import { Validator } from "@plugin/validation/validators";

/**
 * Check whether the frontmatter has a marker array at the given property key.
 */
function hasMarkerArray(
	frontmatter: unknown,
	propertyKey: string,
): frontmatter is Record<string, MarkerObject[]> {
	if (!Validator.stringMap(frontmatter)) return false;
	if (!(propertyKey in frontmatter)) return false;
	return isArray((frontmatter as Record<string, unknown>)[propertyKey], SchemaValidator.marker);
}

/**
 * Match markers by coordinates + map (the natural identity of a marker placement).
 */
function areEqualMarkers(a: MarkerObject, b: MarkerObject): boolean {
	return a.coordinates === b.coordinates && a.map === b.map;
}

/**
 * Strip resolved fields (name, link, color, icon) back to a storable MarkerObject.
 */
function entryToObject(entry: MarkerEntry): MarkerObject {
	const obj: MarkerObject = { coordinates: entry.coordinates };
	if (entry.map) obj.map = entry.map;
	return obj;
}

export class Frontmatter {
	constructor(private app: App) {}

	/**
	 * Append a new marker to a file's marker array property.
	 */
	addMarkerToFile(file: TFile, marker: MarkerObject, propertyKey: string): void {
		void this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			if (!Validator.stringMap(frontmatter))
				throw new Error("Frontmatter is not of type StringMap");

			const fm = frontmatter as Record<string, unknown>;
			if (hasMarkerArray(fm, propertyKey)) {
				(fm[propertyKey] as MarkerObject[]).push(marker);
			} else {
				fm[propertyKey] = [marker];
			}
		});
	}

	/**
	 * Update a marker in a file's frontmatter (identified by coordinates + map).
	 */
	updateMarker(markerOld: MarkerEntry, markerNew: MarkerObject): void {
		void this.processMarkerInFile(markerOld, (markers, index) => {
			markers.splice(index, 1, markerNew);
		});
	}

	/**
	 * Update only the coordinates of a marker (used during drag).
	 */
	updateMarkerCoordinates(entry: MarkerEntry, newCoordinates: Coordinates): void {
		void this.processMarkerInFile(entry, (markers, index) => {
			const existing = markers[index];
			if (existing) {
				existing.coordinates = newCoordinates;
			}
		});
	}

	/**
	 * Remove a marker from a file's frontmatter.
	 */
	removeMarker(marker: MarkerEntry): void {
		void this.processMarkerInFile(marker, (markers, index) => {
			markers.splice(index, 1);
		});
	}

	/**
	 * Find the marker in the file's frontmatter and call the operation with the array and index.
	 * Uses a default property key of "marker" — the actual key could be made configurable
	 * if needed, but for CRUD operations triggered from the map view the marker always
	 * came from the configured property which defaults to "marker".
	 */
	private async processMarkerInFile(
		entry: MarkerEntry,
		operation: (markers: MarkerObject[], index: number) => void,
	): Promise<void> {
		if (entry.link.length === 0) throw new Error("No file path for marker");

		const file = this.app.vault.getFileByPath(entry.link);
		if (!file) throw new Error("No file found");

		const matchObj = entryToObject(entry);

		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const propertyKey = this.findMarkerPropertyKey(frontmatter, matchObj);
			if (!propertyKey) throw new Error(`No markers found in ${entry.link}`);

			const fm = frontmatter as Record<string, MarkerObject[]>;
			const markers = fm[propertyKey];
			if (!markers) throw new Error(`No markers found in ${entry.link}`);

			const index = markers.findIndex((el) => areEqualMarkers(el, matchObj));
			if (index < 0) throw new Error(`Selected marker not found in ${entry.link}`);

			operation(markers, index);
		});
	}

	/**
	 * Find which frontmatter property key contains the marker we're looking for.
	 */
	private findMarkerPropertyKey(frontmatter: unknown, target: MarkerObject): string | null {
		if (!Validator.stringMap(frontmatter)) return null;

		const fm = frontmatter as Record<string, unknown>;

		// Check "marker" first (the default and most common key)
		if (hasMarkerArray(fm, "marker")) {
			const markers = fm["marker"] as MarkerObject[];
			if (markers.some((m) => areEqualMarkers(m, target))) return "marker";
		}

		// Fallback: scan all properties for a matching marker array
		for (const key of Object.keys(fm)) {
			if (key === "marker") continue;
			if (hasMarkerArray(fm, key)) {
				const markers = fm[key] as MarkerObject[];
				if (markers.some((m) => areEqualMarkers(m, target))) return key;
			}
		}

		return null;
	}
}
