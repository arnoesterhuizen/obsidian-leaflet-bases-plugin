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

describe("Icon schema validator", () => {
	const validator = SchemaValidator.icon;

	test("returns true on valid input", () => {
		expect(validator({ prefix: "prefix", icons: { icon: { body: "body" } } })).toEqual(true);
		expect(
			validator({
				prefix: "prefix",
				provider: "provider",
				icons: {
					icon1: {
						body: "body",
						left: 0,
						top: 0,
						width: 48,
						height: 24,
						rotate: 90,
						hFlip: true,
						vFlip: false,
					},
					icon2: {
						body: "body",
						left: 0,
						top: 0,
						width: 24,
						height: 24,
						rotate: 90,
						hFlip: false,
						vFlip: false,
					},
				},
				aliases: undefined,
				left: 0,
				top: 0,
				width: 24,
				height: 24,
				info: {
					name: "name",
					author: {
						name: "Author Mc Author",
						url: "https://author.com/",
					},
					license: {
						title: "licensy title",
						spdx: "spdx",
						url: "https://license.com/",
					},
				},
			}),
		).toEqual(true);
	});

	test("returns false on invalid input", () => {
		expect(validator(undefined)).toEqual(false);
		expect(validator(null)).toEqual(false);
		expect(validator("aaaa")).toEqual(false);
		expect(validator(1)).toEqual(false);
		expect(validator(() => {})).toEqual(false);
		expect(validator({})).toEqual(false);
		expect(validator({ prefix: "prefix" })).toEqual(false);
		expect(validator({ prefix: "prefix", icons: [] })).toEqual(false);
		expect(validator({ prefix: "prefix", icons: [{}] })).toEqual(false);
		expect(validator({ prefix: "prefix", icons: [{ body: "body" }] })).toEqual(false);
		expect(validator({ prefix: "prefix", icons: { icon1: { body: "body", left: "a" } } })).toEqual(
			false,
		);
		expect(validator({ prefix: "prefix", icons: { icon1: { body: "body", top: "a" } } })).toEqual(
			false,
		);
		expect(validator({ prefix: "prefix", icons: { icon1: { body: "body", width: "a" } } })).toEqual(
			false,
		);
		expect(validator({ prefix: "prefi", icons: { icon1: { body: "body", height: "a" } } })).toEqual(
			false,
		);
		expect(validator({ prefix: "prefi", icons: { icon1: { body: "body", rotate: "a" } } })).toEqual(
			false,
		);
		expect(validator({ prefix: "prefix", icons: { icon1: { body: "body", hFlip: "a" } } })).toEqual(
			false,
		);
		expect(validator({ prefix: "prefix", icons: { icon1: { body: "body", vFlip: "a" } } })).toEqual(
			false,
		);
		expect(validator({ prefix: 11, icons: { icon: { body: "body" } } })).toEqual(false);
		expect(validator({ prefix: "prefix", provider: 1, icons: { icon: { body: "body" } } })).toEqual(
			false,
		);
		expect(validator({ prefix: "prefix", icons: { icon: { body: "body" } }, left: "a" })).toEqual(
			false,
		);
		expect(validator({ prefix: "prefix", icons: { icon: { body: "body" } }, top: "a" })).toEqual(
			false,
		);
		expect(validator({ prefix: "prefix", icons: { icon: { body: "body" } }, width: "a" })).toEqual(
			false,
		);
		expect(validator({ prefix: "prefix", icons: { icon: { body: "body" } }, height: "a" })).toEqual(
			false,
		);
		expect(validator({ prefix: "prefix", icons: { icon: { body: "body" } }, info: {} })).toEqual(
			false,
		);
		expect(
			validator({
				prefix: "prefix",
				icons: { icon: { body: "body" } },
				info: { author: { name: "Author Mc Author" }, license: { title: "licensy title" } },
			}),
		).toEqual(false);
		expect(
			validator({
				prefix: "prefix",
				icons: { icon: { body: "body" } },
				info: { name: "name", license: { title: "licensy title" } },
			}),
		).toEqual(false);
		expect(
			validator({
				prefix: "prefix",
				icons: { icon: { body: "body" } },
				info: { name: "name", author: { name: "Author Mc Author" } },
			}),
		).toEqual(false);
		expect(
			validator({
				prefix: "prefix",
				icons: { icon: { body: "body" } },
				info: { name: "name", author: {}, license: { title: "licensy title" } },
			}),
		).toEqual(false);
		expect(
			validator({
				prefix: "prefix",
				icons: { icon: { body: "body" } },
				info: { name: "name", author: { name: "Author Mc Author" }, license: {} },
			}),
		).toEqual(false);
	});
});
