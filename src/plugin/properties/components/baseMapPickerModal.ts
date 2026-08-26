import { App, FuzzySuggestModal } from "obsidian";
import { MapCandidate } from "./mapCandidates";

export class BaseMapPickerModal extends FuzzySuggestModal<MapCandidate> {
	constructor(
		app: App,
		private candidates: MapCandidate[],
		private onChoose: (candidate: MapCandidate) => void,
	) {
		super(app);
		this.setPlaceholder("Select a base with a Leaflet map view");
	}

	getItems(): MapCandidate[] {
		return this.candidates;
	}

	getItemText(candidate: MapCandidate): string {
		const mapName = candidate.settings.mapName;
		const base = `${candidate.file.basename} — ${candidate.viewName}`;
		return mapName ? `${base} (${mapName})` : base;
	}

	onChooseItem(candidate: MapCandidate): void {
		this.onChoose(candidate);
	}
}
