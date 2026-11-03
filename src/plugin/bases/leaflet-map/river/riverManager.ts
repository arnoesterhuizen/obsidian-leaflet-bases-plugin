import { LatLng, LayerGroup, layerGroup, PathOptions, Polygon, polygon } from "leaflet";
import { App } from "obsidian";
import type { MapConfig } from "@plugin/types";
import { buildRiverPolygon } from "./riverGeometry";

/** Width at the source/headwaters (geographic units, near zero for taper). */
const SOURCE_WIDTH = 0.004;

/** Width at the mouth for a standalone river with no detected tributaries. */
const MOUTH_WIDTH = 0.025;

/** Confluence width multiplier: downstream river gains 20-40% of tributary width. */
const CONFLUENCE_FACTOR = 0.3;

/** Tolerance for matching endpoints (geographic units). */
const ENDPOINT_TOLERANCE = 0.01;

interface RiverFeature {
	coordinates: LatLng[];
	color?: string;
	name?: string;
	/** Computed start width (geographic units). */
	startWidth: number;
	/** Computed end width (geographic units). */
	endWidth: number;
}

/**
 * Loads river GeoJSON files and renders them as tapered polygons.
 *
 * Confluences are detected by matching endpoints: when one river's last coordinate
 * matches another river's interior or start coordinate, the downstream river gains
 * width at that junction point.
 */
export class RiverManager {
	private group: LayerGroup = layerGroup();
	private rivers: Polygon[] = [];
	private currentPaths: string[] = [];

	constructor(private app: App) {}

	getGroup(): LayerGroup {
		return this.group;
	}

	async updateLayers(config: MapConfig): Promise<boolean> {
		const paths = config.rivers ?? [];

		if (paths.length === 0) {
			this.clear();
			return this.currentPaths.length > 0;
		}

		// Check if paths changed
		const pathsChanged =
			paths.length !== this.currentPaths.length ||
			paths.some((p, i) => p !== this.currentPaths[i]);

		if (!pathsChanged && this.rivers.length > 0) return false;

		this.clear();
		this.currentPaths = paths;

		// Load all features from all files
		const allFeatures: RiverFeature[] = [];
		for (const filePath of paths) {
			const features = await this.loadRiverFeatures(filePath);
			allFeatures.push(...features);
		}

		if (allFeatures.length === 0) return false;

		// Detect confluences and compute widths
		this.computeWidths(allFeatures);

		// Render each river as a tapered polygon
		for (let i = 0; i < allFeatures.length; i++) {
			const feature = allFeatures[i]!;
			const outline = buildRiverPolygon(
				feature.coordinates,
				feature.startWidth,
				feature.endWidth,
				i, // deterministic seed per feature
			);

			if (outline.length === 0) continue;

			const style: PathOptions = {
				color: feature.color ?? "#4488cc",
				fillColor: feature.color ?? "#4488cc",
				fillOpacity: 0.6,
				weight: 0.5,
				opacity: 0.8,
			};

			const poly = polygon(outline, style);
			if (feature.name) {
				poly.bindTooltip(feature.name);
			}
			this.rivers.push(poly);
			this.group.addLayer(poly);
		}

		return true;
	}

	clear(): void {
		this.group.clearLayers();
		this.rivers = [];
		this.currentPaths = [];
	}

	unload(): void {
		this.clear();
	}

	/**
	 * Compute start/end widths for each river based on confluence detection.
	 *
	 * Algorithm:
	 * 1. Assign each river a base width (DEFAULT_MIN_WIDTH).
	 * 2. Find confluences: where one river's last coordinate (mouth) matches
	 *    another river's coordinate (the downstream river gains width).
	 * 3. Propagate width increases downstream from junction points.
	 */
	private computeWidths(features: RiverFeature[]): void {
		// Build an index of all endpoints (last coordinate of each river = mouth)
		// and find which downstream river they flow into.
		const tributaryWidths = new Map<number, number[]>();

		for (let i = 0; i < features.length; i++) {
			const mouth = features[i]!.coordinates.at(-1);
			if (!mouth) continue;

			// Find which other river this mouth connects to
			for (let j = 0; j < features.length; j++) {
				if (i === j) continue;

				const matchIndex = this.findNearestPoint(features[j]!.coordinates, mouth);
				if (matchIndex !== null) {
					// River i flows into river j at matchIndex
					if (!tributaryWidths.has(j)) {
						tributaryWidths.set(j, []);
					}
					tributaryWidths.get(j)!.push(i);
				}
			}
		}

		// Compute widths bottom-up: rivers with no tributaries get base width,
		// rivers with tributaries get base + sum of tributary end widths * factor.
		// Use iterative resolution since tributaries may chain.
		const resolved = new Set<number>();
		const maxIterations = features.length + 1;

		for (let iter = 0; iter < maxIterations; iter++) {
			let progress = false;

			for (let i = 0; i < features.length; i++) {
				if (resolved.has(i)) continue;

				const tributaries = tributaryWidths.get(i);
				if (!tributaries || tributaries.length === 0) {
					// Leaf river: taper from narrow source to wider mouth
					features[i]!.startWidth = SOURCE_WIDTH;
					features[i]!.endWidth = MOUTH_WIDTH;
					resolved.add(i);
					progress = true;
				} else if (tributaries.every((t) => resolved.has(t))) {
					// All tributaries resolved: compute this river's width
					const tributaryContribution = tributaries.reduce(
						(sum, t) => sum + features[t]!.endWidth * CONFLUENCE_FACTOR,
						0,
					);
					features[i]!.startWidth = SOURCE_WIDTH + tributaryContribution;
					features[i]!.endWidth = features[i]!.startWidth * 2.5;
					resolved.add(i);
					progress = true;
				}
			}

			if (!progress) break;
		}

		// Any unresolved rivers (cycles or disconnected) get moderate taper
		for (let i = 0; i < features.length; i++) {
			if (!resolved.has(i)) {
				features[i]!.startWidth = SOURCE_WIDTH;
				features[i]!.endWidth = MOUTH_WIDTH;
			}
		}
	}

	/**
	 * Find the index of the coordinate in `coords` nearest to `point`,
	 * within the endpoint tolerance. Returns null if no match.
	 */
	private findNearestPoint(coords: LatLng[], point: LatLng): number | null {
		for (let i = 0; i < coords.length; i++) {
			const dlat = coords[i]!.lat - point.lat;
			const dlng = coords[i]!.lng - point.lng;
			if (Math.abs(dlat) < ENDPOINT_TOLERANCE && Math.abs(dlng) < ENDPOINT_TOLERANCE) {
				return i;
			}
		}
		return null;
	}

	private async loadRiverFeatures(filePath: string): Promise<RiverFeature[]> {
		try {
			const file = this.app.metadataCache.getFirstLinkpathDest(filePath, "");
			if (!file) return [];

			const content = await this.app.vault.read(file);
			const geojson = JSON.parse(content) as GeoJSON.GeoJsonObject;

			return this.extractFeatures(geojson);
		} catch {
			return [];
		}
	}

	private extractFeatures(geojson: GeoJSON.GeoJsonObject): RiverFeature[] {
		const features: RiverFeature[] = [];

		if (geojson.type === "FeatureCollection") {
			const fc = geojson as GeoJSON.FeatureCollection;
			for (const feature of fc.features) {
				const extracted = this.featureToRiver(feature);
				if (extracted) features.push(extracted);
			}
		} else if (geojson.type === "Feature") {
			const extracted = this.featureToRiver(geojson as GeoJSON.Feature);
			if (extracted) features.push(extracted);
		}

		return features;
	}

	private featureToRiver(feature: GeoJSON.Feature): RiverFeature | null {
		if (feature.geometry.type !== "LineString") return null;

		const lineString = feature.geometry;
		const coordinates = lineString.coordinates.map(
			(coord) => new LatLng(coord[1]!, coord[0]!),
		);

		if (coordinates.length < 2) return null;

		const props = feature.properties ?? {};
		return {
			coordinates,
			color: typeof props.color === "string" ? props.color : undefined,
			name: typeof props.name === "string" ? props.name : undefined,
			startWidth: SOURCE_WIDTH,
			endWidth: MOUTH_WIDTH,
		};
	}
}
