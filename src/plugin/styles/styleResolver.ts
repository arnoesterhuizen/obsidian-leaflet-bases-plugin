import type { ResolvedStyle, StyleRule } from "@plugin/types";

/**
 * Resolves visual style (icon, color, weight) for a feature based on its
 * group and featureClass, using cascading rules from plugin settings and
 * optional per-view overrides.
 *
 * Resolution order (later wins):
 *   1. Plugin settings rule matching group only
 *   2. Plugin settings rule matching group + featureClass
 *   3. Base file override rule matching group only
 *   4. Base file override rule matching group + featureClass
 */
export class StyleResolver {
	private settingsRules: StyleRule[] = [];
	private viewOverrides: StyleRule[] = [];

	/**
	 * Update the global style rules from plugin settings.
	 */
	updateSettingsRules(rules: StyleRule[]): void {
		this.settingsRules = rules;
	}

	/**
	 * Update per-view style overrides (from the .base file config).
	 * Pass an empty array to clear overrides.
	 */
	updateViewOverrides(overrides: StyleRule[]): void {
		this.viewOverrides = overrides;
	}

	/**
	 * Resolve the style for a given group and featureClass.
	 * Returns a partial style — consumers should fall back to their defaults
	 * for any undefined fields.
	 */
	resolve(group: string, featureClass?: string): ResolvedStyle {
		const result: ResolvedStyle = {};

		// Apply settings rules (group-only first, then group+class)
		this.applyMatchingRules(this.settingsRules, group, featureClass, result);

		// Apply view overrides on top (same order: group-only, then group+class)
		this.applyMatchingRules(this.viewOverrides, group, featureClass, result);

		return result;
	}

	private applyMatchingRules(
		rules: StyleRule[],
		group: string,
		featureClass: string | undefined,
		result: ResolvedStyle,
	): void {
		// First pass: group-level rules (no featureClass specified)
		for (const rule of rules) {
			if (rule.group === group && !rule.featureClass) {
				if (rule.icon) result.icon = rule.icon;
				if (rule.color) result.color = rule.color;
				if (rule.weight !== undefined) result.weight = rule.weight;
			}
		}

		// Second pass: group+class rules (more specific, overrides group-level)
		if (featureClass) {
			for (const rule of rules) {
				if (rule.group === group && rule.featureClass === featureClass) {
					if (rule.icon) result.icon = rule.icon;
					if (rule.color) result.color = rule.color;
					if (rule.weight !== undefined) result.weight = rule.weight;
				}
			}
		}
	}
}
