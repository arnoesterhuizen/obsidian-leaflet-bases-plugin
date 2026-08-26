import { LatLngLiteral } from "leaflet";
import { describe, expect, test } from "vitest";
import { Coordinates } from "@plugin/types";
import { clamp, distance, fillMapConfigDefaults, isNotNull, parseCoordinates } from "@plugin/util";

describe("Clamp function", () => {
	const minimum = 2;
	const maximum = 4;
	const middle = (minimum + maximum) / 2;

	test("keep value if within boundaries", () => {
		expect(clamp(middle, minimum, maximum)).toEqual(middle);
	});

	test("keep value if at lower boundary", () => {
		expect(clamp(minimum, minimum, maximum)).toEqual(minimum);
	});

	test("keep value if at upper boundary", () => {
		expect(clamp(maximum, minimum, maximum)).toEqual(maximum);
	});

	test("increase value to minimum if below boundaries", () => {
		expect(clamp(minimum - 1, minimum, maximum)).toEqual(minimum);
	});

	test("reduce value to maximum if above boundaries", () => {
		expect(clamp(maximum + 1, minimum, maximum)).toEqual(maximum);
	});
});

describe("Fill map config defaults function", () => {
	test("fills in all defaults when only image is provided", () => {
		const result = fillMapConfigDefaults({ image: "map.png" });
		expect(result).toEqual({
			image: "map.png",
			height: 600,
			mapName: undefined,
			center: undefined,
			bounds: undefined,
			overlays: [],
			geojson: [],
			rivers: [],
			markerProperty: "note.marker",
			markerIconProperty: undefined,
			markerColorProperty: undefined,
			regionProperty: "note.region",
			regionColorProperty: undefined,
			pathProperty: "note.path",
			pathColorProperty: undefined,
			minZoom: 1,
			maxZoom: 10,
			defaultZoom: 1,
			zoomDelta: 0.5,
			scale: 1,
			unit: "",
			styleOverrides: [],
		});
	});

	test("keeps provided values", () => {
		const result = fillMapConfigDefaults({
			image: "map.png",
			mapName: "First floor",
			height: 400,
			minZoom: 1,
			maxZoom: 5,
			defaultZoom: 3,
			zoomDelta: 1,
			scale: 2,
			unit: "m",
		});
		expect(result).toMatchObject({
			image: "map.png",
			mapName: "First floor",
			height: 400,
			minZoom: 1,
			maxZoom: 5,
			defaultZoom: 3,
			zoomDelta: 1,
			scale: 2,
			unit: "m",
		});
	});

	test("clamps defaultZoom within minZoom and maxZoom", () => {
		expect(
			fillMapConfigDefaults({ image: "map.png", minZoom: 1, maxZoom: 5, defaultZoom: 0 }).defaultZoom,
		).toEqual(1);
		expect(
			fillMapConfigDefaults({ image: "map.png", minZoom: 1, maxZoom: 5, defaultZoom: 8 }).defaultZoom,
		).toEqual(5);
	});

	test("raises maxZoom to at least minZoom", () => {
		expect(fillMapConfigDefaults({ image: "map.png", minZoom: 4, maxZoom: 2 }).maxZoom).toEqual(4);
	});
});

describe("Distance function", () => {
	const origin: LatLngLiteral = { lat: 0, lng: 0 };
	const pointA: LatLngLiteral = { lat: 3, lng: 4 };
	const pointB: LatLngLiteral = { lat: -3, lng: 4 };
	const pointC: LatLngLiteral = { lat: 3, lng: -4 };
	const pointD: LatLngLiteral = { lat: -3, lng: -4 };

	test("corresponds to Pythagorean theorem", () => {
		expect(distance(origin, origin)).toEqual(0);
		expect(distance(origin, pointA)).toEqual(5);
		expect(distance(origin, pointB)).toEqual(5);
		expect(distance(origin, pointC)).toEqual(5);
		expect(distance(origin, pointD)).toEqual(5);

		expect(distance(pointA, origin)).toEqual(5);
		expect(distance(pointA, pointA)).toEqual(0);
		expect(distance(pointA, pointB)).toEqual(6);
		expect(distance(pointA, pointC)).toEqual(8);
		expect(distance(pointA, pointD)).toEqual(10);

		expect(distance(pointB, origin)).toEqual(5);
		expect(distance(pointB, pointA)).toEqual(6);
		expect(distance(pointB, pointB)).toEqual(0);
		expect(distance(pointB, pointC)).toEqual(10);
		expect(distance(pointB, pointD)).toEqual(8);

		expect(distance(pointC, origin)).toEqual(5);
		expect(distance(pointC, pointA)).toEqual(8);
		expect(distance(pointC, pointB)).toEqual(10);
		expect(distance(pointC, pointC)).toEqual(0);
		expect(distance(pointC, pointD)).toEqual(6);

		expect(distance(pointD, origin)).toEqual(5);
		expect(distance(pointD, pointA)).toEqual(10);
		expect(distance(pointD, pointB)).toEqual(8);
		expect(distance(pointD, pointC)).toEqual(6);
		expect(distance(pointD, pointD)).toEqual(0);
	});
});

describe("Parse coordinates function", () => {
	test("parses valid string values correctly", () => {
		expect(parseCoordinates("0, 0")).toEqual([0, 0]);
		expect(parseCoordinates("1, 0")).toEqual([1, 0]);
		expect(parseCoordinates("0, 4")).toEqual([0, 4]);
		expect(parseCoordinates("-1, -5")).toEqual([-1, -5]);
	});

	test("throws error on invalid string values", () => {
		expect(() => parseCoordinates("" as Coordinates)).toThrow();
		expect(() => parseCoordinates("1" as Coordinates)).toThrow();
		expect(() => parseCoordinates(",1" as Coordinates)).toThrow();
		expect(() => parseCoordinates("1, 1, 1" as Coordinates)).toThrow();
		expect(() => parseCoordinates("asdfe" as Coordinates)).toThrow();
	});
});

describe("Is not null type guard", () => {
	describe("is true on", () => {
		test("undefined values", () => {
			expect(isNotNull(undefined)).toEqual(true);
		});

		test("object values", () => {
			expect(isNotNull({})).toEqual(true);
			expect(isNotNull({ 1: "aaa" })).toEqual(true);
		});

		test("number values", () => {
			expect(isNotNull(0)).toEqual(true);
			expect(isNotNull(1)).toEqual(true);
		});

		test("boolean values", () => {
			expect(isNotNull(true)).toEqual(true);
			expect(isNotNull(false)).toEqual(true);
		});

		test("string values", () => {
			expect(isNotNull("a")).toEqual(true);
		});

		test("array values", () => {
			expect(isNotNull([])).toEqual(true);
			expect(isNotNull([1, 2])).toEqual(true);
			expect(isNotNull(["a", "b"])).toEqual(true);
		});

		test("function values", () => {
			expect(isNotNull(() => {})).toEqual(true);
			expect(isNotNull((a: number) => a + 1)).toEqual(true);
		});
	});

	test("is false on null values", () => {
		expect(isNotNull(null)).toEqual(false);
	});
});
