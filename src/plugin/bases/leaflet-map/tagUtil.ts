import { BasesEntry, ListValue } from "obsidian";

/**
 * Read all tags from a BasesEntry, normalized to lowercase without leading '#'.
 */
export function readEntryTags(entry: BasesEntry): string[] {
	try {
		let tagsValue = entry.getValue("file.tags" as `note.${string}`);
		if (!tagsValue || !tagsValue.isTruthy()) {
			tagsValue = entry.getValue("note.tags" as `note.${string}`);
		}
		if (!tagsValue || !tagsValue.isTruthy()) return [];

		const tags: string[] = [];
		if (tagsValue instanceof ListValue) {
			for (let i = 0; i < tagsValue.length(); i++) {
				const element = tagsValue.get(i);
				if (!element || !element.isTruthy()) continue;
				let tagStr = element.toString().trim();
				if (tagStr.startsWith("#")) tagStr = tagStr.substring(1);
				if (tagStr.length > 0) tags.push(tagStr.toLowerCase());
			}
		} else {
			const str = tagsValue.toString().trim();
			if (str.length > 0) {
				const parts = str.includes(",") ? str.split(",").map((t) => t.trim()) : [str];
				for (let tag of parts) {
					if (tag.startsWith("#")) tag = tag.substring(1);
					if (tag.length > 0) tags.push(tag.toLowerCase());
				}
			}
		}
		return tags;
	} catch {
		return [];
	}
}

/**
 * Build a Set of normalized (lowercase, no '#') tag strings for efficient lookup.
 * Pre-compute this once per layer switch, then pass it to `matchesTagSet()`.
 */
export function buildTagSet(layerTags: string[]): Set<string> {
	return new Set(layerTags.map((t) => t.toLowerCase()));
}

/**
 * Check if an entry's tags match any tag in the pre-computed layer tag set.
 * Use `buildTagSet()` to create the set once, then call this per-entry.
 */
export function matchesTagSet(entryTags: string[], layerTagSet: Set<string>): boolean {
	return entryTags.some((t) => layerTagSet.has(t));
}
