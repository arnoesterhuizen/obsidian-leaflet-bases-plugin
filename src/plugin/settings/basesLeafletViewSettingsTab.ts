import {
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
	SettingGroup,
} from "obsidian";
import { BasesLeafletViewPlugin } from "@plugin/plugin";
import { StyleRule } from "@plugin/types";
import { SettingsManager } from "./settingsManager";

export class BasesLeafletViewSettingsTab extends PluginSettingTab {
	constructor(
		public override plugin: BasesLeafletViewPlugin,
		private manager: SettingsManager,
	) {
		super(plugin.app, plugin);
	}

	/**
	 * Declarative settings (Obsidian 1.13.0+). Returning a non-empty array makes
	 * Obsidian render and index the tab from these definitions; `display()` is
	 * no longer called.
	 *
	 * Only "Map tools" is a clean declarative section (three toggle `control`s).
	 * GeoJSON (string[] <-> textarea) and Feature styles (a bespoke heading-folded
	 * grouped cascade with an inline editor) have no declarative equivalent, so
	 * each lives in a `type: 'group'` whose single item is a `render` escape hatch
	 * that reuses the existing imperative code verbatim. Wrapping each hatch in a
	 * `group` makes Obsidian provide the native `div.setting-group` chrome around
	 * it, matching Map tools.
	 */
	override getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: "group",
				heading: "Map tools",
				items: [
					{
						name: "Enable measure tool",
						desc: "Enable tool that allows you to measure distances",
						control: { type: "toggle", key: "enableMeasureTool" },
					},
					{
						name: "Enable drag tool",
						desc: "Enable tool that allows you to drag markers",
						control: { type: "toggle", key: "enableDragTool" },
					},
					{
						name: "Enable create note tool",
						desc: "Enable tool that creates a new note with a marker at the clicked location",
						control: { type: "toggle", key: "enableCreateNoteTool" },
					},
				],
			},
			{
				type: "group",
				heading: "GeoJSON",
				items: [
					{
						name: "Default layer colors",
						desc: "Colors assigned to GeoJSON layers in order. Add one hex color per line.",
						render: (setting) => this.renderGeoJsonColors(setting),
					},
				],
			},
			{
				type: "group",
				heading: "Feature styles",
				items: [
					{
						name: "Feature styles",
						searchable: false,
						render: (setting, group) => this.renderStyleRulesSection(setting, group),
					},
				],
			},
		];
	}

	/**
	 * Delegate control-value reads to the SettingsManager. The default
	 * implementation reads `this.plugin.settings[key]`, but this plugin stores
	 * its settings in `plugin.settingsManager.settings`, so declarative `control`
	 * bindings must go through here.
	 */
	override getControlValue(key: string): unknown {
		return (this.manager.settings as unknown as Record<string, unknown>)[key];
	}

	/**
	 * Persist control-value writes through the SettingsManager, which is this
	 * plugin's single write path (it also calls `saveData`). The default
	 * implementation writes `this.plugin.settings[key]` + `plugin.saveData`,
	 * which would bypass the manager.
	 */
	override async setControlValue(key: string, value: unknown): Promise<void> {
		await this.manager.updateSettings({ [key]: value });
	}

	/**
	 * GeoJSON default colors. The stored value is a `string[]`; a declarative
	 * `textarea` control only stores a plain string, so this reproduces the
	 * existing join-on-read / split+trim+hex-validate-on-write transform and the
	 * `rows=6` sizing verbatim inside a `render` escape hatch.
	 */
	private renderGeoJsonColors(setting: Setting): void {
		setting.addTextArea((textArea) => {
			const colors = this.manager.settings.geojsonDefaultColors;
			textArea
				.setValue(colors.join("\n"))
				.setPlaceholder("#3388ff\n#ff6633\n#33cc66")
				.onChange(async (value) => {
					const parsed = value
						.split("\n")
						.map((line) => line.trim())
						.filter((line) => /^#([0-9A-Fa-f]{3}){1,2}$/.test(line));
					await this.manager.updateSettings({ geojsonDefaultColors: parsed });
				});
			textArea.inputEl.rows = 6;
			textArea.inputEl.cols = 20;
		});
	}

	/**
	 * Feature styles section. This cannot be expressed as a declarative `list`
	 * or `group`: it is a heading-folded grouped cascade (each group's default
	 * rule folded onto the heading, class rules indented beneath) with an inline
	 * editor. It is rendered through a single `render` escape hatch that drives
	 * the existing `renderStyleRules` / `editStyleRule` logic verbatim.
	 *
	 * The render row itself is empty; the declarative `type: 'group'` wrapping
	 * this hatch supplies the native `div.setting-group` (with the "Feature
	 * styles" heading) that the section must live inside, matching Map tools and
	 * GeoJSON. The cascade is drawn into the group's own element — looked up from
	 * the render row — so every rule row is a sibling inside that one
	 * `div.setting-group` rather than nested in a bare child div. Rendering into
	 * the group element (not the render row) also lets the self-managed re-render
	 * on add/edit/delete empty and rebuild the cascade without discarding the row.
	 */
	private renderStyleRulesSection(setting: Setting, _group: SettingGroup): void {
		// The render row lives inside the group's `div.setting-group`. Capture that
		// group element, then drop the empty placeholder row and draw the cascade
		// straight into the group so each rule row is a native sibling inside the
		// one `div.setting-group`, rather than nested in a bare child div.
		const groupEl = setting.settingEl.parentElement ?? setting.settingEl;
		setting.settingEl.remove();
		const container = groupEl.createDiv("bases-leaflet-view-style-rules");
		this.renderStyleRules(container);
	}

	private renderStyleRules(container: HTMLElement): void {
		container.empty();
		const rules = this.manager.settings.styleRules;

		new Setting(container)
			.setName("Style resolution cascade")
			.setDesc(
				"Plugin settings (group) < plugin settings (group+class) < base file overrides < note frontmatter.",
			);

		// Render rules grouped by `group` and sorted so the cascade reads top to
		// bottom: each group's baseline (group-only) rule first, then its
		// class-specific rules indented beneath it. The underlying settings array
		// keeps its stored order — we only sort a view over it, carrying each
		// rule's original index so Edit/Delete still target the right element.
		const ordered = rules
			.map((rule, index) => ({ rule, index }))
			.sort((a, b) => {
				const groupCmp = a.rule.group.localeCompare(b.rule.group);
				if (groupCmp !== 0) return groupCmp;
				// Group-level rule (no featureClass) sorts before its classes.
				const aClass = a.rule.featureClass ?? "";
				const bClass = b.rule.featureClass ?? "";
				if (!aClass && bClass) return -1;
				if (aClass && !bClass) return 1;
				return aClass.localeCompare(bClass);
			});

		// Summarise a rule's style fields as "icon=x color=#hex weight=N".
		const describeRule = (rule: StyleRule): string => {
			const parts: string[] = [];
			if (rule.icon) parts.push(`icon=${rule.icon}`);
			if (rule.color) parts.push(`color=${rule.color}`);
			if (rule.weight !== undefined) parts.push(`weight=${rule.weight}`);
			return parts.length > 0 ? parts.join(" ") : "(no style set)";
		};

		// Attach Edit/Delete controls to any rule row (heading or class row).
		const addRuleControls = (setting: Setting, index: number): void => {
			setting
				.addExtraButton((button) => {
					button.setIcon("pencil").setTooltip("Edit").onClick(() => {
						this.editStyleRule(container, index);
					});
				})
				.addExtraButton((button) => {
					button.setIcon("trash").setTooltip("Delete").onClick(async () => {
						rules.splice(index, 1);
						await this.manager.updateSettings({ styleRules: rules });
						this.renderStyleRules(container);
					});
				});
		};

		let lastGroup: string | null = null;
		for (const { rule, index } of ordered) {
			const isGroupDefault = rule.featureClass === undefined;

			if (rule.group !== lastGroup) {
				lastGroup = rule.group;

				// When the first rule of this group IS the group default, fold it
				// into the heading: its style config becomes the heading's
				// description and its Edit/Delete controls sit on the heading row.
				// It is then not re-rendered as a separate body row below.
				if (isGroupDefault) {
					const heading = new Setting(container)
						.setName(rule.group || "Default")
						.setHeading()
						.setClass("bases-leaflet-view-style-group-heading")
						.setDesc(describeRule(rule));
					addRuleControls(heading, index);
					continue;
				}

				// Group has no default rule — render a plain heading with no controls.
				new Setting(container)
					.setName(rule.group || "Default")
					.setHeading()
					.setClass("bases-leaflet-view-style-group-heading");
			}

			// Class rules (and any group default not folded into a heading) render
			// as indented body rows beneath their group heading.
			const row = new Setting(container)
				.setName(isGroupDefault ? "(group default)" : rule.featureClass!)
				.setDesc(describeRule(rule))
				.setClass("bases-leaflet-view-style-class-rule");
			addRuleControls(row, index);
		}

		new Setting(container).addButton((button) => {
			button.setButtonText("Add rule").onClick(async () => {
				rules.push({ group: "" });
				await this.manager.updateSettings({ styleRules: rules });
				this.editStyleRule(container, rules.length - 1);
			});
		});
	}

	private editStyleRule(container: HTMLElement, index: number): void {
		const rules = this.manager.settings.styleRules;
		const rule = rules[index]!;

		container.empty();

		new Setting(container).setName("Editing style rule").setHeading();

		new Setting(container).setName("Group").addText((text) => {
			text.setValue(rule.group).setPlaceholder("e.g. populated-places").onChange((value) => {
				rule.group = value.trim();
			});
		});

		new Setting(container).setName("Feature class (optional)").addText((text) => {
			text.setValue(rule.featureClass ?? "").setPlaceholder("e.g. Town").onChange((value) => {
				rule.featureClass = value.trim() || undefined;
			});
		});

		new Setting(container).setName("Icon (optional)").addText((text) => {
			text.setValue(rule.icon ?? "").setPlaceholder("e.g. circle").onChange((value) => {
				rule.icon = value.trim() || undefined;
			});
		});

		new Setting(container).setName("Color (optional)").addText((text) => {
			text.setValue(rule.color ?? "").setPlaceholder("#FF0000").onChange((value) => {
				rule.color = value.trim() || undefined;
			});
		});

		new Setting(container).setName("Weight (optional)").addText((text) => {
			text.setValue(rule.weight !== undefined ? String(rule.weight) : "").setPlaceholder("2").onChange((value) => {
				const parsed = parseFloat(value);
				rule.weight = isFinite(parsed) ? parsed : undefined;
			});
		});

		new Setting(container).addButton((button) => {
			button.setButtonText("Save").setCta().onClick(async () => {
				rules[index] = rule;
				await this.manager.updateSettings({ styleRules: rules });
				this.renderStyleRules(container);
			});
		}).addButton((button) => {
			button.setButtonText("Cancel").onClick(() => {
				this.renderStyleRules(container);
			});
		});
	}
}
