import { App, Setting, TFile } from "obsidian";
import { MarkerModalMode, MarkerObject, NoteSelection } from "@plugin/types";
import { SchemaValidator } from "@plugin/validation/schemaValidators";
import { MarkerModal } from "./markerModal";
import { NoteSuggest } from "./noteSuggest";

export class MarkerNoteModal extends MarkerModal<MarkerObject> {
	private noteSelection: NoteSelection = undefined;

	constructor(
		app: App,
		private onSubmitWithNote: (result: MarkerObject, noteSelection: NoteSelection) => void,
		initialValue: Partial<MarkerObject> | undefined,
		mode: MarkerModalMode,
		private existingFiles: TFile[],
	) {
		super(app, () => {}, initialValue, mode);
	}

	override addSettings() {
		this.addNoteNameSetting();
		super.addSettings();
	}

	override submit(): void {
		if (SchemaValidator.marker(this.value)) {
			this.close();
			this.onSubmitWithNote(this.value, this.noteSelection);
		}
	}

	private addNoteNameSetting(): void {
		new Setting(this.contentEl)
			.setName("Note name")
			.setDesc('Optional. Type a name to create a new note there, or pick an existing note shown in the base to add the marker to that note instead. Defaults to "Untitled" if left empty.')
			.addSearch((searchField) => {
				searchField.onChange((value) => {
					this.noteSelection = value !== "" ? value : undefined;
				});
				new NoteSuggest(this.app, searchField, this.existingFiles, (file) => {
					this.noteSelection = file;
				});
			});
	}
}
