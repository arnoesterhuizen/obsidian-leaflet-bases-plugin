import { App, BasesConfigFile, BasesConfigFileView, parseYaml, TFile } from "obsidian";
import { Constants as C } from "@plugin/constants";
import { MapConfig } from "@plugin/types";
import { fillMapConfigDefaults, isNotNull } from "@plugin/util";
import { Validator } from "@plugin/validation/validators";

export interface MapCandidate {
	file: TFile;
	viewName: string;
	settings: MapConfig;
}

type RawView = BasesConfigFileView & Record<string, unknown>;

const embeddedBaseCodeBlock = /```base\r?\n([\s\S]*?)```/g;

export async function findLeafletMapCandidates(app: App): Promise<MapCandidate[]> {
	const baseFiles = app.vault.getFiles().filter((file) => file.extension === "base");
	const candidateLists = await Promise.all([
		...baseFiles.map((file) => findInFile(app, file)),
		...app.vault.getMarkdownFiles().map((file) => findInEmbeddedBases(app, file)),
	]);
	return candidateLists.flat();
}

export async function openMapCandidate(app: App, candidate: MapCandidate): Promise<void> {
	await app.workspace.openLinkText(`${candidate.file.path}#${candidate.viewName}`, "", true);
}

async function findInFile(app: App, file: TFile): Promise<MapCandidate[]> {
	const config = parseConfig(await app.vault.cachedRead(file));
	return findInConfig(file, config);
}

async function findInEmbeddedBases(app: App, file: TFile): Promise<MapCandidate[]> {
	const content = await app.vault.cachedRead(file);
	const configs = [...content.matchAll(embeddedBaseCodeBlock)].map((match) => parseConfig(match[1] ?? ""));
	return configs.flatMap((config) => findInConfig(file, config));
}

function findInConfig(file: TFile, config: BasesConfigFile | null): MapCandidate[] {
	const views = config?.views;
	if (!Array.isArray(views)) return [];

	return views
		.filter((view): view is RawView => view.type === C.view.type)
		.map((view) => toCandidate(file, view))
		.filter(isNotNull);
}

function parseConfig(yaml: string): BasesConfigFile | null {
	try {
		const parsed: unknown = parseYaml(yaml);
		return typeof parsed === "object" && parsed !== null ? parsed : null;
	} catch {
		return null;
	}
}

function toCandidate(file: TFile, view: RawView): MapCandidate | null {
	const image = normaliseImage(view[C.view.keys.image]);
	if (!image) return null;

	if (!Validator.source(image)) return null;

	const settings = fillMapConfigDefaults({
		image,
		mapName: toStringOrUndefined(view[C.view.keys.mapName]),
		height: toNumberOrUndefined(view[C.view.keys.height]),
		minZoom: toNumberOrUndefined(view[C.view.keys.minZoom]),
		maxZoom: toNumberOrUndefined(view[C.view.keys.maxZoom]),
		defaultZoom: toNumberOrUndefined(view[C.view.keys.defaultZoom]),
		zoomDelta: toNumberOrUndefined(view[C.view.keys.zoomDelta]),
		scale: toNumberOrUndefined(view[C.view.keys.scale]),
		unit: toStringOrUndefined(view[C.view.keys.unit]),
	});

	return { file, viewName: view.name, settings };
}

function normaliseImage(value: unknown): string | undefined {
	if (typeof value !== "string" || value === "") return undefined;
	const wikilink = /^\[\[(.+?)(\|.*)?\]\]$/.exec(value);
	return wikilink ? wikilink[1] : value;
}

function toStringOrUndefined(value: unknown): string | undefined {
	return typeof value === "string" && value !== "" ? value : undefined;
}

function toNumberOrUndefined(value: unknown): number | undefined {
	if (typeof value === "number" && isFinite(value)) return value;
	if (typeof value === "string" && value !== "") {
		const parsed = parseFloat(value);
		if (!isNaN(parsed)) return parsed;
	}
	return undefined;
}
