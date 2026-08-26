import { LeafletMouseEvent } from "leaflet";
import { createOrUpdateNote } from "@plugin/bases/leaflet-map/createOrUpdateNote";
import { Constants as C } from "@plugin/constants";
import { MarkerNoteModal } from "@plugin/properties/components/markerNoteModal";
import { MarkerModalMode } from "@plugin/types";
import { getIconWithDefault, writeCoordinates } from "@plugin/util";
import { SubControl } from "../subControl";

export class CreateNoteControl extends SubControl {
	override onAdded(): void {
		if (this.button) {
			this.button.appendChild(getIconWithDefault(C.map.controlIcons.createNote));
			this.button.ariaLabel = "Create note here";
		}
	}

	override onSelected(): void {
		this.map.getContainer().setCssStyles({ cursor: "crosshair" });
	}

	override onDeselected(): void {
		this.map.getContainer().setCssStyles({ cursor: "" });
	}

	override mapClicked(event: LeafletMouseEvent): void {
		this.createNoteAt(event);
	}

	private createNoteAt(event: LeafletMouseEvent): void {
		const coordinates = writeCoordinates(event.latlng);
		const map = this.mapConfig.mapName;

		new MarkerNoteModal(
			this.app,
			(marker, noteSelection) => createOrUpdateNote(this.frontmatter, this.viewUtil, marker, noteSelection),
			{ coordinates, map },
			MarkerModalMode.Add,
			this.viewUtil.entries.map((entry) => entry.file),
		).open();
	}
}
