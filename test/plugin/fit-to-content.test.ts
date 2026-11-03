import { describe, expect, test } from "vitest";
import { shouldFitToContent } from "@plugin/util";

/**
 * Regression tests for the viewport-reset bug: the map auto-fits to all markers
 * on every data refresh (tab switch, popup close, tag edit), discarding the
 * user's panned/zoomed viewport.
 *
 * `shouldFitToContent` is the pure decision used by the view's onDataUpdated:
 * auto-fit ONLY on the first load with no explicit viewport. Every subsequent
 * refresh must preserve the live Leaflet viewport (the map is never destroyed).
 */
describe("shouldFitToContent", () => {
	describe("first load", () => {
		test("fits when no viewport is configured or pending", () => {
			expect(
				shouldFitToContent({
					firstLoad: true,
					hasPendingState: false,
					hasConfiguredCenter: false,
					hasConfiguredZoom: false,
				}),
			).toBe(true);
		});

		test("does not fit when a center is configured", () => {
			expect(
				shouldFitToContent({
					firstLoad: true,
					hasPendingState: false,
					hasConfiguredCenter: true,
					hasConfiguredZoom: false,
				}),
			).toBe(false);
		});

		test("does not fit when a zoom is configured", () => {
			expect(
				shouldFitToContent({
					firstLoad: true,
					hasPendingState: false,
					hasConfiguredCenter: false,
					hasConfiguredZoom: true,
				}),
			).toBe(false);
		});

		test("does not fit when ephemeral state is pending (history navigation)", () => {
			expect(
				shouldFitToContent({
					firstLoad: true,
					hasPendingState: true,
					hasConfiguredCenter: false,
					hasConfiguredZoom: false,
				}),
			).toBe(false);
		});
	});

	describe("subsequent refresh (the bug)", () => {
		test("never fits on refresh, even with no configured viewport", () => {
			// Tab switch / popup close / tag edit: the live viewport must survive.
			expect(
				shouldFitToContent({
					firstLoad: false,
					hasPendingState: false,
					hasConfiguredCenter: false,
					hasConfiguredZoom: false,
				}),
			).toBe(false);
		});

		test("does not fit on refresh when state is pending", () => {
			expect(
				shouldFitToContent({
					firstLoad: false,
					hasPendingState: true,
					hasConfiguredCenter: false,
					hasConfiguredZoom: false,
				}),
			).toBe(false);
		});

		test("does not fit on refresh with configured viewport", () => {
			expect(
				shouldFitToContent({
					firstLoad: false,
					hasPendingState: false,
					hasConfiguredCenter: true,
					hasConfiguredZoom: true,
				}),
			).toBe(false);
		});
	});
});
