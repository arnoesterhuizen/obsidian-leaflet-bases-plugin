# Glossary

Shared terms used across the documentation. Link here from any document that
uses these terms rather than repeating the definitions inline.

| Term | Definition |
|------|------------|
| Release artifact | A file Obsidian loads to run the plugin: `main.js`, `manifest.json`, or `styles.css`. These sit at the top level of the plugin folder in the vault. |
| Bundle | The single `main.js` file esbuild produces from the TypeScript source and its dependencies. |
| Watch mode | esbuild's mode that stays running and rebuilds the bundle on every source change. Started by `npm run dev`. |
| Type-check | The `tsc -noEmit` step that validates types without writing JavaScript. Part of `npm run build`, skipped by `npm run dev`. |
| Source map | A mapping from bundled output back to the original source, inlined in development builds to aid debugging. Omitted from release builds. |
| Base layer | A switchable background image (and its overlays, GeoJSON, and rivers) selected through the `baseLayers` config. See [base layer switcher](explanation/design-base-layer-switcher.md). |
| Ephemeral state | The `{ center, zoom, baseLayerIndex }` viewport snapshot Obsidian round-trips during history navigation. See [viewport persistence](explanation/design-viewport-persistence.md). |
| Viewport | The map's current center point and zoom level — what the user sees after panning and zooming. |
