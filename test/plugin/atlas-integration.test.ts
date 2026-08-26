/**
 * Tests verifying Phase 4 requirements from plan-atlas-integration.md:
 * 1. Decimal coordinate parsing (including negatives)
 * 2. Explicit bounds config matching Toril GCS extent
 * 3. SVG image loading support
 */
import { describe, expect, test } from "vitest";
import { Constants as C } from "@plugin/constants";
import { Coordinates } from "@plugin/types";
import { parseBounds, parseCoordinates } from "@plugin/util";
import { Validator } from "@plugin/validation/validators";

describe("Atlas integration: decimal coordinate support", () => {
	const coordsRegex = C.regExp.coordinatesValidation;

	describe("coordinatesValidation regex", () => {
		test("accepts integer coordinates", () => {
			expect(coordsRegex.test("49, -75")).toBe(true);
			expect(coordsRegex.test("-5, -10")).toBe(true);
			expect(coordsRegex.test("0, 0")).toBe(true);
		});

		test("accepts decimal coordinates (atlas requirement)", () => {
			// Toril GCS coordinates from plan-atlas-integration.md
			expect(coordsRegex.test("49.306, -75.915")).toBe(true);
			expect(coordsRegex.test("24.745, -68.591")).toBe(true);
			expect(coordsRegex.test("14.0, -90.0")).toBe(true);
			expect(coordsRegex.test("-3.5, 12.7")).toBe(true);
		});

		test("accepts negative decimals", () => {
			expect(coordsRegex.test("-49.306, -75.915")).toBe(true);
		});

		test("accepts coordinates without spaces", () => {
			expect(coordsRegex.test("49.306,-75.915")).toBe(true);
		});
	});

	describe("Validator.coordinates", () => {
		test("validates Toril GCS coordinates from atlas notes", () => {
			expect(Validator.coordinates("49.306, -75.915")).toBe(true);
			expect(Validator.coordinates("24.745, -68.591")).toBe(true);
		});

		test("validates negative decimal coordinates", () => {
			expect(Validator.coordinates("-49.306, -75.915")).toBe(true);
		});
	});

	describe("parseCoordinates with decimals", () => {
		test("parses Toril GCS coordinates correctly", () => {
			expect(parseCoordinates("49.306, -75.915" as Coordinates)).toEqual([49.306, -75.915]);
			expect(parseCoordinates("24.745, -68.591" as Coordinates)).toEqual([24.745, -68.591]);
		});

		test("parses negative decimal coordinates", () => {
			expect(parseCoordinates("-3.5, -12.7" as Coordinates)).toEqual([-3.5, -12.7]);
		});

		test("still parses integer coordinates", () => {
			expect(parseCoordinates("49, -75" as Coordinates)).toEqual([49, -75]);
		});
	});
});

describe("Atlas integration: explicit bounds config", () => {
	const boundsRegex = C.regExp.boundsValidation;

	describe("boundsValidation regex", () => {
		test("accepts Toril GCS bounds (decimal)", () => {
			// Faerun surface bounds: lat 14-55, lon -90 to -33
			expect(boundsRegex.test("14,-90 55,-33")).toBe(true);
			expect(boundsRegex.test("14.0,-90.0 55.0,-33.0")).toBe(true);
		});

		test("accepts negative decimal bounds", () => {
			expect(boundsRegex.test("-90.5,-180.5 90.5,180.5")).toBe(true);
		});
	});

	describe("Validator.bounds", () => {
		test("validates Toril GCS bounds string", () => {
			expect(Validator.bounds("14,-90 55,-33")).toBe(true);
			expect(Validator.bounds("14.0,-90.0 55.0,-33.0")).toBe(true);
		});
	});

	describe("parseBounds", () => {
		test("parses Toril GCS extent correctly", () => {
			const result = parseBounds("14,-90 55,-33");
			expect(result).toEqual([[14, -90], [55, -33]]);
		});

		test("parses decimal bounds correctly", () => {
			const result = parseBounds("14.0,-90.0 55.0,-33.0");
			expect(result).toEqual([[14.0, -90.0], [55.0, -33.0]]);
		});

		test("parses negative decimal bounds correctly", () => {
			const result = parseBounds("-90.5,-180.5 90.5,180.5");
			expect(result).toEqual([[-90.5, -180.5], [90.5, 180.5]]);
		});

		test("returns null on invalid format", () => {
			expect(parseBounds("")).toBeNull();
			expect(parseBounds("14,-90")).toBeNull();
			expect(parseBounds("abc")).toBeNull();
		});
	});
});

describe("Atlas integration: SVG image support", () => {
	test("SVG is in the supported image types list", () => {
		expect(C.map.imageTypes).toContain("svg");
	});
});
