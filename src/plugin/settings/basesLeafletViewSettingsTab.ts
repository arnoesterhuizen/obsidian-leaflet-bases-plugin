import {
	Notice,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
	SettingGroup,
} from "obsidian";
import { Constants as C } from "@plugin/constants";
import { BasesLeafletViewPlugin } from "@plugin/plugin";
import { IconifyJSONIconsObject, StyleRule } from "@plugin/types";
import { SchemaValidator } from "@plugin/validation/schemaValidators";
import { LoadedIconSetsComponent } from "./loadedIconSetsComponent";
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
	 * GeoJSON (string[] <-> textarea), Feature styles (a bespoke heading-folded
	 * grouped cascade with an inline editor), and the icon sets (OS file upload
	 * plus a self-managed component) have no declarative equivalent, so each is a
	 * `render` escape hatch that reuses the existing imperative code verbatim.
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
				name: "Feature styles",
				render: (setting) => this.renderStyleRulesSection(setting),
			},
			{
				type: "group",
				heading: "Additional icon sets",
				items: [
					{
						name: "Add iconify icon set",
						desc: this.buildIconsDesc(),
						render: (setting) => this.renderIconUpload(setting),
					},
					{
						name: "Loaded icon sets",
						searchable: false,
						render: (setting) => this.renderLoadedIcons(setting),
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
	 * The row's own name/desc/control are unused; `renderStyleRules` draws the
	 * whole section into a dedicated child container so its self-managed
	 * re-render (on add/edit/delete) keeps working exactly as before.
	 */
	private renderStyleRulesSection(setting: Setting): void {
		setting.settingEl.addClass("bases-leaflet-view-setting-empty");
		setting.infoEl.remove();
		const container = setting.settingEl.createDiv();
		this.renderStyleRules(container);
	}

	private renderStyleRules(container: HTMLElement): void {
		container.empty();
		const rules = this.manager.settings.styleRules;

		// Wrap the whole section in a SettingGroup so the heading and every row
		// live inside a single `div.setting-group`, matching the other sections
		// (Map tools, GeoJSON) and Obsidian's native settings layout. Every row
		// below is added via `group.addSetting(...)` so it nests in the group
		// rather than being a loose sibling in a bare div.
		const group = new SettingGroup(container).setHeading("Feature styles");

		group.addSetting((setting) => {
			setting
				.setName("Style resolution cascade")
				.setDesc(
					"Plugin settings (group) < plugin settings (group+class) < base file overrides < note frontmatter.",
				);
		});

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
					group.addSetting((heading) => {
						heading
							.setName(rule.group || "Default")
							.setHeading()
							.setClass("bases-leaflet-view-style-group-heading")
							.setDesc(describeRule(rule));
						addRuleControls(heading, index);
					});
					continue;
				}

				// Group has no default rule — render a plain heading with no controls.
				group.addSetting((heading) => {
					heading
						.setName(rule.group || "Default")
						.setHeading()
						.setClass("bases-leaflet-view-style-group-heading");
				});
			}

			// Class rules (and any group default not folded into a heading) render
			// as indented body rows beneath their group heading.
			group.addSetting((setting) => {
				setting
					.setName(isGroupDefault ? "(group default)" : rule.featureClass!)
					.setDesc(describeRule(rule))
					.setClass("bases-leaflet-view-style-class-rule");
				addRuleControls(setting, index);
			});
		}

		group.addSetting((setting) => {
			setting.addButton((button) => {
				button.setButtonText("Add rule").onClick(async () => {
					rules.push({ group: "" });
					await this.manager.updateSettings({ styleRules: rules });
					this.editStyleRule(container, rules.length - 1);
				});
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

	/** Description fragment for the icon-set upload row (links + perf warning). */
	private buildIconsDesc(): DocumentFragment {
		const fragment = new DocumentFragment();
		fragment.createSpan({ text: "" }, (span) => {
			span.append("Additional ");
			span.createEl("a", {
				text: "Iconify icon sets",
				href: C.settings.links.preview,
			});
			span.append(" can be downloaded as .json files at the ");
			span.createEl("a", {
				text: "Iconify GitHub repository",
				href: C.settings.links.github,
			});
			span.append("");
			span.createEl("br");
			span.createEl("br");
			span.createEl("i", { text: "Adding too many icons can negatively impact the performance of your device" });
		});
		return fragment;
	}

	/**
	 * Icon-set upload button. Uses an OS file picker (`<input type="file">`),
	 * which has no declarative control equivalent, so it is a `render` escape
	 * hatch reproducing the existing hidden-input + JSON-validate + reload flow
	 * verbatim.
	 */
	private renderIconUpload(setting: Setting): void {
		setting.addButton((button) => {
			const input = button.buttonEl.createEl("input", {
				type: "file",
				attr: { accept: ".json", style: "display: none;" },
			});
			input.onchange = async () => {
				if (!input.files?.length) return;

				await this.plugin.iconManager.reload(async () => {
					const data: IconifyJSONIconsObject[] = this.manager.settings.iconData;
					try {
						for (let file of Array.from(input.files ?? [])) {
							const text = await file.text();
							const json: unknown = JSON.parse(text);
							if (SchemaValidator.icon(json)) data.push(json);
							else throw new Error(`Invalid IconSet: ${text}`);
						}
					} catch (error) {
						new Notice("There was an error loading your icon set(s)");
						console.error(error);
					}

					input.value = "";
					await this.manager.updateSettings({ iconData: data });
					this.loadedIcons?.render();
				});
			};
			button.setButtonText("Add iconset").onClick(() => {
				input.click();
			});
		});
	}

	/** Holds the loaded-icon-sets component so the upload flow can re-render it. */
	private loadedIcons?: LoadedIconSetsComponent;

	/**
	 * Loaded icon sets list. `LoadedIconSetsComponent` manages its own DOM and
	 * re-renders itself imperatively, so it lives inside a `render` escape hatch
	 * mounted on the row element, exactly as before.
	 */
	private renderLoadedIcons(setting: Setting): void {
		setting.settingEl.addClass("bases-leaflet-view-setting-empty");
		setting.infoEl.remove();
		this.loadedIcons = new LoadedIconSetsComponent(setting.settingEl, this.plugin);
	}
}
