import { LatLng, LatLngLiteral, LatLngTuple } from "leaflet";
import { getIcon } from "obsidian";
import { Constants as C } from "@plugin/constants";
import { Coordinates, MapConfig } from "@plugin/types";
import { Validator } from "./validation/validators";

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * Compute a full MapConfig from partial raw values (used when reading another .base file's
 * raw YAML config to find candidate Leaflet map views to pick from).
 */
export function fillMapConfigDefaults(raw: Partial<MapConfig> & { image: MapConfig["image"] }): MapConfig {
	const minZoom = raw.minZoom ?? C.map.default.minZoom;
	const maxZoom = Math.max(raw.maxZoom ?? C.map.default.maxZoom, minZoom);

	return {
		image: raw.image,
		height: raw.height ?? C.map.default.height,
		mapName: raw.mapName,
		center: raw.center,
		bounds: raw.bounds,
		geojson: raw.geojson ?? [],
		rivers: raw.rivers ?? [],
		overlays: raw.overlays ?? [],
		baseLayers: raw.baseLayers,
		markerProperty: raw.markerProperty ?? C.marker.defaultProperty,
		markerIconProperty: raw.markerIconProperty,
		markerColorProperty: raw.markerColorProperty,
		regionProperty: raw.regionProperty ?? C.region.defaultProperty,
		regionColorProperty: raw.regionColorProperty,
		pathProperty: raw.pathProperty ?? C.path.defaultProperty,
		pathColorProperty: raw.pathColorProperty,
		minZoom,
		maxZoom,
		defaultZoom: clamp(raw.defaultZoom ?? minZoom, minZoom, maxZoom),
		zoomDelta: raw.zoomDelta ?? C.map.default.zoomDelta,
		scale: raw.scale ?? C.map.default.scale,
		unit: raw.unit ?? C.map.default.unit,
		styleOverrides: raw.styleOverrides ?? [],
	};
}

export function distance(a: LatLngLiteral, b: LatLngLiteral): number {
	return Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lng - b.lng, 2));
}

export function toOptionalFixed(value: number, digits: number): `${number}` {
	return `${parseFloat(value.toFixed(digits))}`;
}

export function getIconWithDefault(iconId: string | undefined): SVGSVGElement {
	if (iconId) {
		const icon = getIcon(iconId);
		if (icon) return icon;
	}

	const defaultIcon = getIcon("circle-small");
	if (!(defaultIcon instanceof SVGSVGElement)) throw new Error("Faulty default icon set");

	defaultIcon.setAttribute("fill", "currentColor");
	return defaultIcon;
}

export function parseCoordinates(coordinates: Coordinates): LatLngTuple {
	const parsedCoordinates = coordinates
		.replace(/\s/g, "")
		.split(",")
		.map((coordinate) => parseFloat(coordinate));

	if (!Validator.latLngTuple(parsedCoordinates)) {
		throw new Error("Coordinates not properly validated");
	}

	return parsedCoordinates;
}

/**
 * Parse a bounds string of the form "latSW,lngSW latNE,lngNE" into a Leaflet LatLngBoundsExpression.
 * Returns null if the string cannot be parsed.
 */
export function parseBounds(bounds: string): [LatLngTuple, LatLngTuple] | null {
	const parts = bounds.trim().split(/\s+/);
	if (parts.length !== 2) return null;

	const swParts = parts[0]!.split(",").map(Number);
	const neParts = parts[1]!.split(",").map(Number);

	if (swParts.length !== 2 || neParts.length !== 2) return null;
	if (!swParts.every(isFinite) || !neParts.every(isFinite)) return null;

	const swLat = swParts[0]!;
	const swLng = swParts[1]!;
	const neLat = neParts[0]!;
	const neLng = neParts[1]!;

	return [
		[swLat, swLng],
		[neLat, neLng],
	];
}

export function writeCoordinates(coordinates: LatLng): Coordinates {
	return `${toOptionalFixed(coordinates.lat, 3)}, ${toOptionalFixed(coordinates.lng, 3)}`;
}

export function isNotNull<T>(value: T | null): value is T {
	return value !== null;
}

export function isArray<T>(
	array: unknown,
	validator: (element: unknown) => element is T,
): array is T[] {
	if (!Array.isArray(array)) return false;
	return array.every((element) => validator(element));
}
