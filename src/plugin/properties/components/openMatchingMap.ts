import { App, Notice } from "obsidian";
import { BaseMapPickerModal } from "./baseMapPickerModal";
import { findLeafletMapCandidates, openMapCandidate } from "./mapCandidates";

export async function openMatchingMap(app: App, mapName: string | undefined): Promise<void> {
	const candidates = await findLeafletMapCandidates(app);
	const matches = mapName
		? candidates.filter((candidate) => candidate.settings.mapName === mapName)
		: candidates;

	if (matches.length === 0) {
		new Notice(mapName ? "No Leaflet map view found for this marker's map name" : "No Leaflet map views found in this vault");
		return;
	}

	const [onlyMatch] = matches;
	if (matches.length === 1 && onlyMatch) {
		await openMapCandidate(app, onlyMatch);
		return;
	}

	new BaseMapPickerModal(app, matches, (candidate) => void openMapCandidate(app, candidate)).open();
}
