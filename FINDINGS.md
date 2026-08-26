# Code analysis findings

Analysis of the obsidian-leaflet-bases-plugin codebase (v1.1.10). Updated to reflect current resolution status.

## Resolved

All items below have been fixed since the initial analysis.

### Settings tab drag tool toggle

The "Enable drag tool" toggle previously read and wrote `enableMeasureTool` instead of `enableDragTool`. Now correctly uses `enableDragTool`.

### Coordinate validation rejects negative and decimal values

The regex in `constants.ts` previously only allowed unsigned integers (`/^\s*[0-9]+\s*,\s*[0-9]+\s*$/`). Now supports decimals and negatives: `/^\s*-?[0-9]+(\.[0-9]+)?\s*,\s*-?[0-9]+(\.[0-9]+)?\s*$/`.

### `parseCoordinates` uses `parseInt` for floating-point positions

Previously called `parseInt()` which truncated fractional parts. Now uses `parseFloat()` via split-and-map, correctly preserving decimal precision.

### Property name `colour` breaks Obsidian convention

Renamed to `color` throughout (frontmatter schema, internal identifiers, constants, validators). Aligns with Obsidian/CSS conventions.

### `stringMapValidator` rejects empty objects

Previously had `Object.keys(value).length > 0` check. Removed — empty objects now pass validation.

### `schemaValidatorFactory` allows extra unknown properties

Kept as-is (intentional for forward compatibility with frontmatter). Not a bug.

### `ContextMenu.removeHooks()` removes all event listeners

Previously called `this.map.off()` with no arguments (removing all listeners). Now removes only its own handlers: `.off("contextmenu", this.contextMenuHandler)` and `.off("markermenu", this.markerMenuHandler)`.

### `SubControl.onRemove` event listener leak

Previously called `removeEventListener` with a new anonymous function (no-op). Now stores the click handler reference and removes it correctly.

### Jest/Vitest type conflict

`jest.config.cts`, `@types/jest`, and `"types": ["jest"]` in tsconfig removed. Project uses Vitest exclusively.

### Performance: per-marker zoomend listeners

Previously attached one `zoomend` handler per marker on every data refresh. Now uses a single handler (`this.refreshHandler`) iterating a stored `this.markers` list.

### `Frontmatter` instantiated multiple times

Reduced to shared instances passed through the constructor chain (MapManager creates one and passes to MarkerManager and ContextMenu).

### `mapManager.updateSettings` always resets zoom

Now only resets zoom when the image changes or zoom configuration values change. User's current zoom is preserved during data refreshes.

### `image.detach()` no-op

Removed. The `Image()` element was never attached to the DOM.

### Hardcoded colors in property widget

Replaced with CSS variables and Obsidian theme-aware classes.

### i18n infrastructure removed

The locale system (`i18n/locale.ts`, `locales/en.ts`, type-safe `t()` function) was removed entirely. English strings are now inlined directly in source files. Reduces indirection and dead code; i18n can be reintroduced if translation contributions materialize.

### `Marker.onClick` does not support middle-click

Fixed. A native `mouseup` listener on the marker DOM element detects `event.button === 1` and opens the linked note in a new pane via `openLinkText("", link, true)`. This bypasses Leaflet's event system which only fires click events for the left button.

### River rendering

Implemented as `RiverManager` (inspired by [Leaflet.River](https://github.com/ggolikov/Leaflet.River), built from scratch). Each river is a single tapered polygon with geographic widths, deterministic random width variation, and automatic confluence detection via endpoint matching. Downstream rivers gain ~30% of tributary width at junction points.

### CSS build automation

Plugin CSS is now maintained in `src/styles/plugin.css` and concatenated with `node_modules/leaflet/dist/leaflet.css` at build time via `build-styles.mjs`. The output `styles.css` automatically tracks the installed Leaflet version without manual CSS copying.

### `MapCoordinatePickerModal` cleanup on error

DOM elements (description paragraph, map div) are now created after the async image fetch succeeds. On failure, no orphan elements are left in the modal content before `close()` is called.

### Full config snapshot diffing

`MapManager.updateSettings` now short-circuits entirely when the config and embedded state are unchanged. Field-by-field comparison for scalars, `JSON.stringify` for the geojson array. Eliminates no-op DOM updates, invalidateSize calls, and control refreshes during data-only refreshes.

## Open items

### Canvas renderer for large marker sets

For atlas-scale use (1000+ markers), switching from DOM-based markers to Leaflet's Canvas renderer with `L.circleMarker` would improve performance. Loses custom pin SVG styling. Worth profiling if performance issues appear with large datasets.

### Formula-based center

The `center` view option is a static string. Switching to a Bases `formula` option type would allow dynamic centering (e.g. center on the current note's coordinates). See obsidian-maps comparison for reference implementation.

### Full config snapshot diffing

Image and zoom changes are guarded, but a complete `JSON.stringify` snapshot comparison would skip truly no-op update cycles for all config paths.

### Region polygon rendering

The `src/plugin/bases/leaflet-map/region/` directory is scaffolded but empty. Region polygons stored in note frontmatter are not yet rendered at runtime.

## Leaflet plugins investigated

### ~~[Leaflet.VectorGrid](https://github.com/Leaflet/Leaflet.VectorGrid) + [geojson-vt](https://github.com/mapbox/geojson-vt)~~

**Disqualified.** Client-side vector tile slicing from GeoJSON. For the atlas dataset (~220MB, 8000 polygons, 1.5M coordinate pairs), geojson-vt must parse and index the entire dataset in memory upfront. This exceeds tablet capacity — expect 400-600MB memory usage and 10-30s index build time freezing the UI. The library is designed for tens-of-thousands of coordinates, not millions.

Pre-generated PBF tiles via tippecanoe remain a theoretical option for runtime-toggleable vector overlays, but the current approach (SVG background for terrain/polygons, markers for points, rivers from lightweight GeoJSON) covers the use case without the complexity.
