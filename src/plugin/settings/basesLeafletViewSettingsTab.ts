import { Notice, PluginSettingTab, Setting, SettingGroup } from "obsidian";
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

	override display(): void {
		this.containerEl.empty();
		this.addToolsGroup();
		this.addGeoJsonGroup();
		this.addStyleRulesGroup();
		this.addIconsGroup();
	}

	private addToolsGroup(): void {
		new SettingGroup(this.containerEl)
			.setHeading("Map tools")
			.addSetting((setting) => {
				setting
					.setName("Enable measure tool")
					.setDesc("Enable tool that allows you to measure distances")
					.addToggle((toggle) =>
						toggle.setValue(this.manager.settings.enableMeasureTool).onChange(async (value) => {
							await this.manager.updateSettings({ enableMeasureTool: value });
						}),
					);
			})
			.addSetting((setting) => {
				setting
					.setName("Enable drag tool")
					.setDesc("Enable tool that allows you to drag markers")
					.addToggle((toggle) =>
						toggle.setValue(this.manager.settings.enableDragTool).onChange(async (value) => {
							await this.manager.updateSettings({ enableDragTool: value });
						}),
					);
			})
			.addSetting((setting) => {
				setting
					.setName("Enable create note tool")
					.setDesc("Enable tool that creates a new note with a marker at the clicked location")
					.addToggle((toggle) =>
						toggle
							.setValue(this.manager.settings.enableCreateNoteTool)
							.onChange(async (value) => {
								await this.manager.updateSettings({ enableCreateNoteTool: value });
							}),
					);
			});
	}

	private addGeoJsonGroup(): void {
		new SettingGroup(this.containerEl)
			.setHeading("GeoJSON")
			.addSetting((setting) => {
				setting
					.setName("Default layer colors")
					.setDesc("Colors assigned to GeoJSON layers in order. Add one hex color per line.")
					.addTextArea((textArea) => {
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
			});
	}

	private addStyleRulesGroup(): void {
		const container = this.containerEl.createDiv();
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

	private addIconsGroup(): void {
		let loadedIcons: LoadedIconSetsComponent;
		new SettingGroup(this.containerEl)
			.setHeading("Additional icon sets")
			.addSetting((setting) => {
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
				setting
					.setName("Add iconify icon set")
					.setDesc(fragment)
					.addButton(async (button) => {
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
								loadedIcons?.render();
							});
						};
						button.setButtonText("Add iconset").onClick(() => {
							input.click();
						});
					});
			})
			.addSetting((setting) => {
				setting.setClass("bases-leaflet-view-setting-empty");
				loadedIcons = new LoadedIconSetsComponent(setting.settingEl, this.plugin);
			});
	}
}
