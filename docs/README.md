# Documentation

This folder follows the [Diátaxis](https://diataxis.fr/) structure. Each
document is one of four kinds, by what the reader needs:

- **How-to guides** (`how-to/`) — steps to achieve a specific goal.
- **Reference** (`reference/`) — factual lookup: commands, keys, defaults.
- **Explanation** (`explanation/`) — background and design decisions.
- **Tutorials** — learning-oriented lessons (none yet; add under `tutorials/`
  if one is written).

User-facing usage (adding maps, markers, regions, paths, icons) lives in the
top-level [README](../README.md).

## How-to guides

- [Compile the plugin](how-to/compile-the-plugin.md) — build the release
  artifacts, or rebuild automatically while developing.

## Reference

- [Build commands](reference/build-commands.md) — every npm script, what it
  runs, and the files it produces.

## Explanation (design notes)

- [Marker icon resolution](explanation/marker-icon-resolution.md) — the layers
  a marker icon can be defined in (note property, tag-matched style rules,
  per-view overrides, built-in default), their precedence, and how plugin
  settings relate to note frontmatter.
- [Base layer switcher](explanation/design-base-layer-switcher.md) — the
  `baseLayers` config key and background-image switching.
- [Viewport persistence](explanation/design-viewport-persistence.md) — how the
  map keeps or resets pan/zoom across refreshes, and deferred options for
  persisting it further.

## Glossary

- [Glossary](glossary.md) — shared terms used across these documents.
