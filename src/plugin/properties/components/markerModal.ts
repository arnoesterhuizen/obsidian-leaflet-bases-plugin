import { App, ButtonComponent, Modal, Setting } from "obsidian";
import { MarkerModalMode, MarkerObject } from "@plugin/types";
import { SchemaValidator } from "@plugin/validation/schemaValidators";
import { Validator } from "@plugin/validation/validators";
import { MarkerModalErrorComponent } from "./markerModalErrorComponent";
import { openMatchingMap } from "./openMatchingMap";

export class MarkerModal<T extends MarkerObject> extends Modal {
	protected value: Partial<MarkerObject>;
	private submitEnabledCallback: (isEnabled: boolean) => void = () => {};

	protected confirmButton: ButtonComponent | undefined;

	constructor(
		app: App,
		protected onSubmit: (result: T) => void,
		initialValue: Partial<MarkerObject> | undefined,
		protected mode: MarkerModalMode,
	) {
		super(app);
		this.setTitle(this.mode === MarkerModalMode.Add ? "Add marker" : "Edit marker");

		this.value = { ...initialValue };
	}

	override onOpen(): void {
		this.addSettings();

		// Submit on Enter key
		this.scope.register([], "Enter", (event) => {
			if (!event.isComposing) {
				event.preventDefault();
				this.submit();
			}
		});
	}

	protected addSettings() {
		this.addMapSetting();
		this.addCoordinatesSetting();

		this.addConfirmButton();
	}

	private setSubmitEnabledCallback(cb: (isEnabled: boolean) => void): void {
		this.submitEnabledCallback = cb;
	}

	private addMapSetting(): void {
		new Setting(this.contentEl)
			.setName("Map")
			.setDesc("Optional. Name of the map this marker is specific to. Useful if you want to add this note as a marker to multiple different maps.")
			.addText((textField) => {
				textField
					.setValue(this.value.map ?? "")
					.onChange((value) => (this.value.map = value !== "" ? value : undefined));
			});
	}

	private addCoordinatesSetting(): void {
		let coordinatesError: MarkerModalErrorComponent;
		new Setting(this.contentEl)
			.setName("Coordinates")
			.setDesc("Required. Marker coordinates on the map.")
			.setClass("bases-leaflet-view-setting-vertical")
			.addText((textField) => {
				textField.setValue(this.value.coordinates ?? "").onChange((value) => {
					if (value === "") {
						coordinatesError.setMessage("Value is required");
						this.submitEnabledCallback(false);
					} else if (!Validator.coordinates(value)) {
						coordinatesError.setMessage("Value not a valid coordinate");
						this.submitEnabledCallback(false);
					} else {
						coordinatesError.setMessage("");
						this.submitEnabledCallback(true);
						this.value.coordinates = value;
					}

					textField.inputEl.reportValidity();
				});
			})
			.addComponent((errorEl) => {
				coordinatesError = new MarkerModalErrorComponent(errorEl).setMessage("");
				return coordinatesError;
			});

		new Setting(this.contentEl)
			.setName("Show on map")
			.setDesc("Open the base and Leaflet map view this marker belongs to.")
			.addButton((button) => {
				button
					.setButtonText("Open map")
					.onClick(() => void openMatchingMap(this.app, this.value.map));
			});
	}

	private addConfirmButton(): void {
		const footer = this.contentEl.createDiv({ cls: "modal-button-container" });
		const button = new ButtonComponent(footer);
		button
			.setButtonText(this.mode === MarkerModalMode.Add ? "Add marker" : "Save")
			.setCta()
			.onClick(() => this.submit());
		this.setSubmitEnabledCallback((isEnabled) => {
			button.setDisabled(!isEnabled);
		});
		this.confirmButton = button;
	}

	protected submit(): void {
		if (SchemaValidator.marker(this.value)) {
			this.close();
			this.onSubmit(this.value as T);
		}
	}
}
