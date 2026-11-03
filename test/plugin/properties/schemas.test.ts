import { describe, expect, test } from "vitest";
import { SchemaValidator } from "@plugin/validation/schemaValidators";

describe("Marker schema validator", () => {
	const validator = SchemaValidator.marker;

	test("returns true on valid input", () => {
		expect(validator({ coordinates: "1, 1" })).toEqual(true);
		expect(validator({ coordinates: "-1, 1" })).toEqual(true);
		expect(
			validator({
				coordinates: "1, 1",
				map: "dungeon-level-1",
				icon: "iconic",
				color: "#bad",
			}),
		).toEqual(true);
		expect(validator({ coordinates: "309, 742", map: "dip-axeholm" })).toEqual(true);
	});

	test("returns true when map is an array of strings", () => {
		expect(validator({ coordinates: "1, 1", map: ["atlas-toril", "atlas-underdark"] })).toEqual(
			true,
		);
		expect(validator({ coordinates: "42, -71", map: ["single-map"] })).toEqual(true);
	});

	test("returns false on invalid input", () => {
		expect(validator(undefined)).toEqual(false);
		expect(validator(null)).toEqual(false);
		expect(validator("aaaa")).toEqual(false);
		expect(validator(1)).toEqual(false);
		expect(validator(() => {})).toEqual(false);
		expect(validator({})).toEqual(false);
		expect(validator({ coordinates: "1, 1", map: 1 })).toEqual(false);
		expect(validator({ coordinates: "1, 1", map: [] })).toEqual(false);
		expect(validator({ coordinates: "1, 1", map: [1, 2] })).toEqual(false);
	});
});
