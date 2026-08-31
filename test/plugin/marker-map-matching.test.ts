/**
 * Tests for multi-value map field support.
 * Verifies that markers correctly match views when map is a string, array, or undefined.
 */
import { describe, expect, test } from "vitest";
import { MarkerObject } from "@plugin/types";

/**
 * Replicate the map-matching logic from markerManager.ts for unit testing.
 * This matches the filter predicate used in MarkerManager.updateMarkers.
 */
function matchesMap(obj: MarkerObject, mapName: string | undefined): boolean {
	if (mapName) {
		if (Array.isArray(obj.map)) return obj.map.includes(mapName);
		return obj.map === mapName;
	}
	return obj.map === undefined;
}

describe("Marker map-matching logic", () => {
	describe("view has a mapName configured", () => {
		const mapName = "atlas-forgottenrealms-toril";

		test("marker with matching string map is shown", () => {
			const obj: MarkerObject = { coordinates: "42, -71", map: "atlas-forgottenrealms-toril" };
			expect(matchesMap(obj, mapName)).toBe(true);
		});

		test("marker with non-matching string map is hidden", () => {
			const obj: MarkerObject = { coordinates: "42, -71", map: "atlas-underdark" };
			expect(matchesMap(obj, mapName)).toBe(false);
		});

		test("marker with array map containing the view's mapName is shown", () => {
			const obj: MarkerObject = {
				coordinates: "42, -71",
				map: ["atlas-forgottenrealms-toril", "atlas-underdark"],
			};
			expect(matchesMap(obj, mapName)).toBe(true);
		});

		test("marker with array map NOT containing the view's mapName is hidden", () => {
			const obj: MarkerObject = {
				coordinates: "42, -71",
				map: ["atlas-underdark", "atlas-moonshae"],
			};
			expect(matchesMap(obj, mapName)).toBe(false);
		});

		test("marker with no map field is hidden (not assigned to any specific map)", () => {
			const obj: MarkerObject = { coordinates: "42, -71" };
			expect(matchesMap(obj, mapName)).toBe(false);
		});

		test("marker with single-element array matching is shown", () => {
			const obj: MarkerObject = { coordinates: "42, -71", map: ["atlas-forgottenrealms-toril"] };
			expect(matchesMap(obj, mapName)).toBe(true);
		});
	});

	describe("view has no mapName configured", () => {
		const mapName = undefined;

		test("marker with no map field is shown", () => {
			const obj: MarkerObject = { coordinates: "42, -71" };
			expect(matchesMap(obj, mapName)).toBe(true);
		});

		test("marker with a string map is hidden", () => {
			const obj: MarkerObject = { coordinates: "42, -71", map: "atlas-toril" };
			expect(matchesMap(obj, mapName)).toBe(false);
		});

		test("marker with an array map is hidden", () => {
			const obj: MarkerObject = { coordinates: "42, -71", map: ["atlas-toril", "atlas-underdark"] };
			expect(matchesMap(obj, mapName)).toBe(false);
		});
	});
});
