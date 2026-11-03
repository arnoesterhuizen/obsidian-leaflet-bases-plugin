# TODO

## Lint follow-ups

- **`obsidianmd/no-tfile-tfolder-cast` in `test/plugin/properties/mapCandidates.test.ts`** (introduced by #15, not yet on `main`): the test mocks build fake `TFile`s via `{ path, extension } as unknown as TFile`. Replace with real `TFile` instances (or a small test factory) so the test doesn't rely on a cast the linter otherwise flags in production code.
- **`obsidianmd/settings-tab/prefer-setting-definitions` in `src/plugin/settings/basesLeafletViewSettingsTab.ts`**: the settings tab doesn't implement `getSettingDefinitions()`, so its settings won't appear in Obsidian's settings search on 1.13.0+. Migrate to the declarative settings API.

## Tooling

- Enable GitHub's native [Stacked Pull Requests](https://docs.github.com/en/pull-requests/how-tos/stacked-pull-requests) feature for this repository. `gh stack` currently reports "Stacked PRs are not enabled for this repository", falling back to plain branch pushes without the linked-stack UI.

## Features

- **Formula-based center**: the `center` view option is a static string. Switching to a Bases `formula` option type would allow dynamic centering (e.g. center on the current note's coordinates).
- **Region polygon rendering**: the `src/plugin/bases/leaflet-map/region/` directory is scaffolded but empty. Region polygons in note frontmatter (e.g. for territory boundaries) are not yet supported at runtime.
- **Viewport persistence beyond the live instance** (deferred): Option A (first-load-only auto-fit, in-memory) is shipped. Two follow-up options are fully specced in [`docs/explanation/design-viewport-persistence.md`](docs/explanation/design-viewport-persistence.md) — Option B persists the viewport to ephemeral state so it survives reopening the base within a session (cheap, composes on A); Option C persists a per-map viewport to plugin data so it survives Obsidian restarts (most work, has open identity/staleness decisions). Pick these up from that doc rather than re-investigating.
