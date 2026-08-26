import { TFile } from "obsidian";
import { Frontmatter } from "@plugin/properties/frontmatter";
import { MarkerObject, NoteSelection } from "@plugin/types";
import { ViewUtil } from "./viewUtil";

export function createOrUpdateNote(
	frontmatter: Frontmatter,
	viewUtil: ViewUtil,
	marker: MarkerObject,
	noteSelection: NoteSelection,
): void {
	const config = viewUtil.getMapConfig();
	const fullProp = config?.markerProperty ?? "note.marker";
	const propertyKey = fullProp.startsWith("note.") ? fullProp.slice(5) : fullProp;

	if (noteSelection instanceof TFile) {
		frontmatter.addMarkerToFile(noteSelection, marker, propertyKey);
		return;
	}

	// Create the file directly via the vault API and write the marker via processFrontMatter.
	// We bypass createFileForView because Bases can't serialise complex objects and throws
	// "Formula cannot be deserialized" when the view has formula-based filters.
	const fileName = noteSelection || "Untitled";
	void createFileAndAddMarker(viewUtil, frontmatter, fileName, marker, propertyKey);
}

async function createFileAndAddMarker(
	viewUtil: ViewUtil,
	frontmatter: Frontmatter,
	fileName: string,
	marker: MarkerObject,
	propertyKey: string,
): Promise<void> {
	const app = viewUtil.app;

	// Determine the folder — create in the same folder as the base file or vault root
	let folder = "";
	const activeFile = app.workspace.getActiveFile();
	if (activeFile) {
		folder = activeFile.parent?.path ?? "";
	}

	const path = folder ? `${folder}/${fileName}.md` : `${fileName}.md`;

	// Create the file if it doesn't exist
	let file = app.vault.getFileByPath(path);
	if (!file) {
		file = await app.vault.create(path, "");
	}

	// Write the marker to the new file's frontmatter
	frontmatter.addMarkerToFile(file, marker, propertyKey);
}
