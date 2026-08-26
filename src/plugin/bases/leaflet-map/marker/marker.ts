import {
	DivIcon,
	divIcon,
	DragEndEvent,
	LayerGroup,
	Marker as LeafletMarker,
	LeafletMouseEvent,
	MarkerOptions,
} from "leaflet";
import { App, IconName } from "obsidian";
import { Map } from "@plugin/bases/leaflet-map/map/map";
import { Frontmatter } from "@plugin/properties/frontmatter";
import { MarkerEntry } from "@plugin/types";
import { getIconWithDefault, parseCoordinates, writeCoordinates } from "@plugin/util";

function buildMarkerIcon(iconId: IconName | undefined, color: string): DivIcon {
	const xmlSerializer = new XMLSerializer();
	const innerIcon = getIconWithDefault(iconId);
	innerIcon.addClass("leaflet-marker-inner-icon");

	return divIcon({
		className: "leaflet-marker-icon",
		html: `
            <svg class="leaflet-marker-pin" style="fill:${color}" viewBox="0 0 32 48">
                <path d="m32,19c0,12 -12,24 -16,29c-4,-5 -16,-16 -16,-29a16,19 0 0 1 32,0"/>
            </svg>
            ${xmlSerializer.serializeToString(innerIcon)}`,
		iconSize: [32, 48],
		iconAnchor: [16, 48],
		tooltipAnchor: [17, -30],
	});
}

export function marker(
	app: App,
	map: Map,
	entry: MarkerEntry,
	frontmatter: Frontmatter,
	options?: MarkerOptions,
): Marker {
	return new Marker(app, map, entry, frontmatter, {
		icon: buildMarkerIcon(entry.icon, entry.color),
		autoPanOnFocus: false,
		...options,
	});
}

export class Marker extends LeafletMarker {
	constructor(
		private app: App,
		private map: Map,
		private entry: MarkerEntry,
		private frontmatter: Frontmatter,
		options?: MarkerOptions,
	) {
		super(parseCoordinates(entry.coordinates), options);

		this.bindTooltip(entry.name);

		this.on({
			click: (event) => this.onClick(event),
			mouseover: (event) => this.onHover(event),
			mouseout: () => this.onMouseOut(),
			contextmenu: (event) => this.onContextMenu(event),
			dragend: (event) => this.updateMarkerEntry(event),
		});
	}

	override addTo(map: Map | LayerGroup<unknown>): this {
		this.options.draggable = this.map.markerDragEnabled;
		const result = super.addTo(map);

		// Leaflet doesn't fire click events for middle mouse button.
		// Attach a native listener to support middle-click → open in new pane.
		const el = this.getElement();
		if (el) {
			el.addEventListener("mouseup", (event) => {
				if (event.button === 1) {
					event.preventDefault();
					event.stopPropagation();
					void this.app.workspace.openLinkText("", this.entry.link, true);
				}
			});
		}

		return result;
	}

	private onClick(event: LeafletMouseEvent): void {
		void this.app.workspace.openLinkText("", this.entry.link, event.originalEvent.ctrlKey);
	}

	private onHover(event: LeafletMouseEvent): void {
		this.app.workspace.trigger("hover-link", {
			event: event.originalEvent,
			source: "bases",
			hoverParent: this.app.renderContext,
			targetEl: this.getElement(),
			linktext: this.entry.link,
		});
	}

	private onMouseOut(): void {
		// no-op, reserved for future use
	}

	private onContextMenu(event: LeafletMouseEvent): void {
		event.originalEvent.preventDefault();
		this.map.fire("markermenu", { ...event, entry: this.entry });
	}

	private updateMarkerEntry(event: DragEndEvent): void {
		const droppedMarker = event.target as Marker;
		const coordinates = writeCoordinates(droppedMarker.getLatLng());

		const newEntry = { ...this.entry, coordinates };
		this.frontmatter.updateMarkerCoordinates(this.entry, coordinates);
		this.entry = newEntry;
	}
}
