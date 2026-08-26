import { LatLng } from "leaflet";
import { BasesViewRegistration, IconName, TFile } from "obsidian";
import { IconifyInfo, IconifyJSONIconsData } from "@iconify/types";
import { BasesLeafletViewPlugin } from "./plugin";

export type ViewRegistrationBuilder = (
	plugin: BasesLeafletViewPlugin,
) => [string, BasesViewRegistration];

export type Wiki = [[string]]; // Wiki links take the shape of string[][]
export type Coordinates = `${number}, ${number}`;
export type Hex = `#${string}`;
export type Url = `https:${string}` | `http:${string}`;
export type StringMap = Record<string, unknown>;

/**
 * Shape stored in frontmatter as a list-of-objects under the marker property.
 * Coordinates are per-map. Icon and color are note-level properties, not per-marker.
 */
export type MarkerObject = {
	coordinates: Coordinates;
	map?: string;
};

/**
 * Fully resolved marker ready for rendering.
 * Icon and color have been resolved from per-marker overrides -> note-level properties -> defaults.
 */
export interface MarkerEntry {
	coordinates: Coordinates;
	map?: string;
	icon?: IconName;
	color: string;
	name: string;
	link: string;
}

/**
 * Shape stored in frontmatter as a list-of-objects under the region property.
 * Coordinates are space-separated "lat,lng" pairs forming a closed polygon.
 */
export type RegionObject = {
	coordinates: string;
	map?: string;
	color?: string;
};

/**
 * Fully resolved region polygon ready for rendering.
 */
export interface RegionEntry {
	coordinates: string;
	map?: string;
	color: string;
	name: string;
	link: string;
}

/**
 * Shape stored in frontmatter as a list-of-objects under the path property.
 * Coordinates are space-separated "lat,lng" pairs forming an open polyline.
 */
export type PathObject = {
	coordinates: string;
	map?: string;
	color?: string;
};

/**
 * Fully resolved path polyline ready for rendering.
 */
export interface PathEntry {
	coordinates: string;
	map?: string;
	color: string;
	name: string;
	link: string;
}

/**
 * Resolved view configuration driving how the map and its markers render.
 * Values are computed from Bases view options with defaults applied.
 */
export interface MapConfig {
	image: string | Wiki;
	height: number;
	mapName?: string;
	center?: Coordinates;
	bounds?: string;
	overlays: string[];
	geojson: string[];
	rivers: string[];
	markerProperty: string;
	markerIconProperty?: string;
	markerColorProperty?: string;
	regionProperty: string;
	regionColorProperty?: string;
	pathProperty: string;
	pathColorProperty?: string;
	minZoom: number;
	maxZoom: number;
	defaultZoom: number;
	zoomDelta: number;
	scale: number;
	unit: string;
	styleOverrides: StyleRule[];
}

export type NoteSelection = string | TFile | undefined;

export type ReducedIconifyInfo = Pick<IconifyInfo, "name" | "author" | "license">;
// Reconstruct interface as type to avoid "Index signature is missing" error
export type IconifyJSONIconsObject = {
	[Properties in keyof IconifyJSONIconsData]: IconifyJSONIconsData[Properties];
} & { info?: ReducedIconifyInfo };

export type ValidatorFunction<T> = (value: unknown) => value is T;

export type Schema<T extends keyof StringMap> = Record<
	T,
	{ validator: ValidatorFunction<unknown>; required?: boolean }
>;

export abstract class Manager {
	constructor(public plugin: BasesLeafletViewPlugin) {}
	abstract load(): Promise<void>;
	abstract unload(): void;
}

export type LeafletContextMenuCallback = (latLng: LatLng) => void;

export interface BasesLeafletViewSettings {
	enableMeasureTool: boolean;
	enableDragTool: boolean;
	enableCreateNoteTool: boolean;
	geojsonDefaultColors: string[];
	styleRules: StyleRule[];
	iconData: IconifyJSONIconsObject[];
}

/**
 * A style rule mapping group/featureClass combinations to visual properties.
 * Rules without featureClass apply as group-level defaults.
 */
export interface StyleRule {
	group: string;
	featureClass?: string;
	icon?: string;
	color?: string;
	weight?: number;
}

/**
 * Resolved style for a feature. All fields are optional — consumers
 * fall back to their own defaults for any missing field.
 */
export interface ResolvedStyle {
	icon?: string;
	color?: string;
	weight?: number;
}

export enum MarkerModalMode {
	Add = "add",
	Edit = "edit",
}
