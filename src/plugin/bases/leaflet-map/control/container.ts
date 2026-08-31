import { Control, DomEvent, DomUtil, Map as LeafletMap } from "leaflet";
import { App } from "obsidian";
import { Map } from "@plugin/bases/leaflet-map/map/map";
import { ViewUtil } from "@plugin/bases/leaflet-map/viewUtil";
import { Constants as C } from "@plugin/constants";
import { Frontmatter } from "@plugin/properties/frontmatter";
import { BasesLeafletViewSettings, MapConfig } from "@plugin/types";
import { getIconWithDefault } from "@plugin/util";
import { CreateNoteControl, MeasureControl, PanControl } from "./sub";
import { DragControl } from "./sub/drag";
import { SubControl } from "./subControl";

export class ControlContainer extends Control {
	// Do not remove individual elements, each element has a ref to it's own index
	private controls: SubControl[] = [];
	private activeIndex: number = 0;
	private fitToViewButton: HTMLButtonElement | undefined;
	private fitToViewClickHandler: (() => void) | undefined;

	constructor(
		private app: App,
		private viewUtil: ViewUtil,
		private pluginSettings: BasesLeafletViewSettings,
		private frontmatter: Frontmatter,
		private onFitToView: () => void,
	) {
		super({ position: "topleft" });
	}

	override onAdd(map: Map): HTMLElement {
		this.registerSubControl(PanControl, map);
		if (this.pluginSettings.enableMeasureTool) this.registerSubControl(MeasureControl, map);
		if (this.pluginSettings.enableDragTool) this.registerSubControl(DragControl, map);
		if (this.pluginSettings.enableCreateNoteTool) this.registerSubControl(CreateNoteControl, map);

		const containerEl = DomUtil.create("div", "leaflet-bar leaflet-control");

		this.controls.forEach((control) => control.onAdd(containerEl));
		this.controls[this.activeIndex]?.setSelected(true);

		// Fit to View: one-shot action, not a mode toggle
		this.fitToViewButton = DomUtil.create("button", "leaflet-control-button", containerEl);
		this.fitToViewButton.appendChild(getIconWithDefault(C.map.controlIcons.fitToView));
		this.fitToViewButton.ariaLabel = "Fit to view";
		this.fitToViewClickHandler = () => this.onFitToView();
		this.fitToViewButton.addEventListener("click", this.fitToViewClickHandler);
		DomEvent.disableClickPropagation(containerEl);

		map.on("click", (event) =>
			this.controls.forEach((control) => {
				if (control.isSelected) control.mapClicked(event);
			}),
		);

		return containerEl;
	}

	override onRemove(map: LeafletMap | undefined): void {
		map?.removeEventListener("click");

		this.controls.forEach((control) => control.onRemove());
		this.controls = [];

		if (this.fitToViewButton && this.fitToViewClickHandler) {
			this.fitToViewButton.removeEventListener("click", this.fitToViewClickHandler);
		}
		this.fitToViewButton = undefined;
		this.fitToViewClickHandler = undefined;
	}

	updateSettings(config: MapConfig): void {
		this.controls.forEach((control) => control.updateSettings(config));
	}

	private registerSubControl(control: typeof SubControl, map: Map): void {
		const onSelectCallback = (controlIndex: number) => {
			this.controls.at(this.activeIndex)?.setSelected(false);
			this.controls.at(controlIndex)?.setSelected(true);
			this.activeIndex = controlIndex;
		};
		const options = {
			index: this.controls.length,
			map,
			app: this.app,
			viewUtil: this.viewUtil,
			frontmatter: this.frontmatter,
			onSelectCallback,
		};
		this.controls.push(new control(options));
	}
}
