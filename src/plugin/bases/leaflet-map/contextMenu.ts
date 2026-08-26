import { Handler, LatLng, LeafletEvent, LeafletMouseEvent } from "leaflet";
import { App, Menu, Notice } from "obsidian";
import { Map } from "@plugin/bases/leaflet-map/map/map";
import { Constants as C } from "@plugin/constants";
import { MarkerModal } from "@plugin/properties/components/markerModal";
import { MarkerNoteModal } from "@plugin/properties/components/markerNoteModal";
import { Frontmatter } from "@plugin/properties/frontmatter";
import { MarkerEntry, MarkerModalMode } from "@plugin/types";
import { writeCoordinates } from "@plugin/util";
import { createOrUpdateNote } from "./createOrUpdateNote";
import { ViewUtil } from "./viewUtil";

interface LeafletMarkerEvent extends LeafletMouseEvent {
	entry: MarkerEntry;
}

function isLeafletMarkerEvent(event: LeafletMouseEvent): event is LeafletMarkerEvent {
	return event.type === "markermenu";
}

export class ContextMenu extends Handler {
	private position = new LatLng(0, 0);
	private contextMenuHandler = (event: LeafletMouseEvent) => this.show(event);
	private markerMenuHandler = (event: LeafletEvent) => this.show(event as LeafletMouseEvent);

	constructor(
		private app: App,
		private viewUtil: ViewUtil,
		private map: Map,
		private frontmatter: Frontmatter,
	) {
		super(map);
	}

	override addHooks(): void {
		this.map
			.on("contextmenu", this.contextMenuHandler, this)
			.on("markermenu", this.markerMenuHandler, this);
	}

	override removeHooks(): void {
		this.map
			.off("contextmenu", this.contextMenuHandler, this)
			.off("markermenu", this.markerMenuHandler, this);
	}

	private show(event: LeafletMouseEvent): void {
		this.position = event.latlng;

		const menu = Menu.forEvent(event.originalEvent);
		this.setMenuContent(menu, event);
	}

	private setMenuContent(menu: Menu, event: LeafletMouseEvent): void {
		if (!["contextmenu", "markermenu"].contains(event.type)) {
			throw new Error(`Unknown event type: ${event.type}`);
		}

		const mapConfig = this.viewUtil.getMapConfig();

		/* -------- Marker section -------- */

		if (event.type === "contextmenu") {
			menu.addItem((item) =>
				item
					.setTitle("Add marker to note")
					.setSection("marker")
					.setIcon("square-pen")
					.onClick(() =>
						new MarkerNoteModal(
							this.app,
							(marker, noteSelection) =>
								createOrUpdateNote(this.frontmatter, this.viewUtil, marker, noteSelection),
							{
								coordinates: writeCoordinates(this.position),
								map: mapConfig?.mapName,
							},
							MarkerModalMode.Add,
							this.viewUtil.entries.map((entry) => entry.file),
						).open(),
					),
			);
		}

		/* -------- Map section -------- */

		menu.addItem((item) =>
			item
				.setTitle("Copy coordinates")
				.setSection("map")
				.setIcon("copy")
				.onClick(() =>
					navigator.clipboard
						.writeText(writeCoordinates(this.position))
						.then(() => new Notice("Coordinates copied to clipboard"))
						.catch(() => new Notice("Failed copying coordinates to clipboard")),
				),
		);

		menu.addItem((item) =>
			item
				.setTitle("Set map default zoom")
				.setSection("map")
				.setIcon("search")
				.onClick(() =>
					this.viewUtil.updateSetting(C.view.keys.defaultZoom, this.map.getZoom()),
				),
		);

		menu.addItem((item) =>
			item
				.setTitle("Set map default center point")
				.setSection("map")
				.setIcon("map-pin")
				.onClick(() =>
					this.viewUtil.updateSetting(C.view.keys.center, writeCoordinates(this.position)),
				),
		);

		/* -------- Danger section -------- */

		if (isLeafletMarkerEvent(event)) {
			menu.addItem((item) =>
				item
					.setTitle("Edit marker")
					.setSection("danger")
					.setIcon("pencil-line")
					.onClick(() =>
						new MarkerModal(
							this.app,
							(result) => this.frontmatter.updateMarker(event.entry, result),
							{
								coordinates: event.entry.coordinates,
								map: event.entry.map,
							},
							MarkerModalMode.Edit,
						).open(),
					),
			);

			menu.addItem((item) =>
				item
					.setTitle("Delete")
					.setSection("danger")
					.setIcon("trash-2")
					.setWarning(true)
					.onClick(() => this.frontmatter.removeMarker(event.entry)),
			);
		}
	}
}
