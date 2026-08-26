import { LeafletMouseEvent } from "leaflet";
import { Constants as C } from "@plugin/constants";
import { getIconWithDefault } from "@plugin/util";
import { SubControl } from "../subControl";

export class PanControl extends SubControl {
	override onAdded(): void {
		if (this.button) {
			this.button.appendChild(getIconWithDefault(C.map.controlIcons.pan));
			this.button.ariaLabel = "Pan";
		}
	}

	override mapClicked(_event: LeafletMouseEvent): void {
		// Just pass, map panning is default leaflet behaviour
	}
}
