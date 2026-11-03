import { Constants as C } from "@plugin/constants";
import { BasesLeafletViewSettings, Manager } from "@plugin/types";
import { BasesLeafletViewSettingsTab } from "./basesLeafletViewSettingsTab";

/** Settings whose change must rebuild the live map toolbar. */
const TOOL_SETTING_KEYS = [
	"enableMeasureTool",
	"enableDragTool",
	"enableCreateNoteTool",
] as const satisfies readonly (keyof BasesLeafletViewSettings)[];

export class SettingsManager extends Manager {
	private defaultData: BasesLeafletViewSettings = {
		...C.settings.default,
		geojsonDefaultColors: [...C.settings.default.geojsonDefaultColors],
		styleRules: [...C.settings.default.styleRules],
	};
	private _settings: BasesLeafletViewSettings = { ...this.defaultData };
	get settings(): BasesLeafletViewSettings {
		return this._settings;
	}

	/**
	 * Observers notified when a map-tool toggle changes. Open map views subscribe
	 * so they can rebuild their toolbar live, without requiring an Obsidian reload.
	 */
	private toolSettingsObservers: Set<() => void> = new Set();

	async load(): Promise<void> {
		await this.loadSettings();

		this.plugin.addSettingTab(new BasesLeafletViewSettingsTab(this.plugin, this));
	}

	unload(): void {
		this.toolSettingsObservers.clear();
	}

	async loadSettings(): Promise<void> {
		const loadedData = (await this.plugin.loadData()) as BasesLeafletViewSettings;
		this._settings = Object.assign({}, this.defaultData, loadedData);
	}

	/**
	 * Register a callback invoked whenever a map-tool toggle
	 * (enableMeasureTool / enableDragTool / enableCreateNoteTool) changes value.
	 * Returns an unsubscribe function the caller must invoke on unload.
	 */
	onToolSettingsChanged(observer: () => void): () => void {
		this.toolSettingsObservers.add(observer);
		return () => this.toolSettingsObservers.delete(observer);
	}

	async updateSettings(settings: Partial<BasesLeafletViewSettings>): Promise<void> {
		const toolsChanged = TOOL_SETTING_KEYS.some(
			(key) => key in settings && settings[key] !== this._settings[key],
		);

		this._settings = Object.assign(this._settings, settings);
		await this.plugin.saveData(this._settings);

		if (toolsChanged) {
			for (const observer of this.toolSettingsObservers) observer();
		}
	}
}
