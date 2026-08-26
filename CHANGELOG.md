# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Added

- Explicit bounds configuration for geographic coordinate systems (`bounds` view option, format: `latSW,lngSW latNE,lngNE`). Overrides auto-detected pixel bounds from image dimensions.
- GeoJSON vector layer overlay support: load `.geojson` files from the vault as toggleable map layers with configurable color palette.
- Property-based marker configuration: `markerProperty`, `markerIcon`, and `markerColor` view options let you choose which note properties drive the map (defaults: `note.marker`, `note.icon`, `note.color`).
- Named color support for markers: bare color names like `blue`, `red`, `green` resolve to Obsidian's `var(--color-*)` CSS variables, adapting to light/dark themes.
- Map context menu: right-click a position to add a marker, copy coordinates, set default zoom, or set default center.
- Marker context menu: right-click a marker to edit or delete it.
- "Create note here" map toolbar tool: click a spot on the map to create a new note (respecting the vault's "Default location for new notes" setting) or add the marker to an existing note, from a single field. ([#14](https://github.com/Requiae/obsidian-leaflet-bases-plugin/pull/14))
- The context menu's "Add marker to note" now uses the same new-or-existing-note flow as the toolbar tool, replacing the old new-note-only flow. ([#14](https://github.com/Requiae/obsidian-leaflet-bases-plugin/pull/14))
- Pick a marker's map and coordinates directly from the map itself: the marker property's '+' button now lets you pick which Leaflet map view a marker belongs to (when the vault has more than one), then click on that map to set its coordinates. ([#15](https://github.com/Requiae/obsidian-leaflet-bases-plugin/pull/15))
- The marker modal gains an "Open map" button that jumps to the note's Leaflet map view, and a live preview of the currently selected icon. ([#15](https://github.com/Requiae/obsidian-leaflet-bases-plugin/pull/15))
- Browse and add Iconify icon sets in-app: a new "Browse icon sets" button searches Iconify's full collection and adds a set with one click, instead of requiring a manual `.json` download. ([#16](https://github.com/Requiae/obsidian-leaflet-bases-plugin/pull/16))
- Ephemeral state: map center and zoom are preserved during workspace history navigation (forward/back).
- Debounced resize handler prevents map thrashing during window/pane resizes.
- Embedded view detection: fixed height only applies when the map is embedded; full-page views fill available space.
- Auto-fit behavior: when no explicit `center` or `defaultZoom` is configured, the map automatically zooms to encompass all markers.

### Fixed

- Decimal coordinate support: coordinates like `"49.306, -75.915"` are now correctly validated and parsed. Previously the validation regex only accepted integers, silently rejecting decimal coordinates.
- `writeCoordinates` now preserves 3 decimal places instead of rounding to integers, so dragging markers on maps using geographic coordinates no longer loses precision.
- Negative coordinate validation: the regex now correctly allows negative values (e.g. `"-5, -10"`).
- Settings tab drag tool toggle: previously the "Enable drag tool" setting incorrectly toggled the measure tool. Now correctly reads and writes `enableDragTool`.
- Renamed `colour` to `color` throughout the codebase and frontmatter schema, aligning with Obsidian conventions and CSS standards.
- `parseCoordinates` now uses `parseFloat` instead of `parseInt`, correctly handling fractional coordinate values.
- `ContextMenu.removeHooks()` now only removes its own event listeners instead of stripping all listeners from the map.
- Marker zoomend handler: replaced per-marker event handler registration with a single handler iterating a stored marker list, improving performance for large marker sets.
- `SubControl.onRemove` now properly removes the click listener using a stored handler reference instead of a no-op anonymous function.
- Removed hardcoded colors in the property widget; now uses CSS variables for theme compatibility.
- `stringMapValidator` no longer rejects empty objects.
- Removed unused `image.detach()` call (no-op on never-attached elements).
- Removed Jest config and types (project uses Vitest).
- `MarkerModal` no longer crashes when a subclass reads a constructor argument during setup — settings construction moved to `onOpen()`. ([#14](https://github.com/Requiae/obsidian-leaflet-bases-plugin/pull/14))
- The map's background image can no longer be dragged out via native browser drag-and-drop. ([#14](https://github.com/Requiae/obsidian-leaflet-bases-plugin/pull/14))
- Right-clicking a marker no longer re-centers the map. ([#14](https://github.com/Requiae/obsidian-leaflet-bases-plugin/pull/14))
- Trackpad right-click (macOS two-finger click) no longer pans the map. ([#16](https://github.com/Requiae/obsidian-leaflet-bases-plugin/pull/16))
- The marker-add map/coordinate picker now finds Leaflet map views in bases embedded as code blocks, not just standalone `.base` files. ([#15](https://github.com/Requiae/obsidian-leaflet-bases-plugin/pull/15))
- Markers properly reset when the base view changes. ([#12](https://github.com/Requiae/obsidian-leaflet-bases-plugin/issues/12))
- The note-picker modal handles formula deserialization errors gracefully.

### Removed

- The map "copy tool" toolbar button (functionality moved to context menu).
- Per-marker `icon`, `colour`, and `minZoom` fields (icon and color are now note-level properties).
- Legacy `mapName` key in marker objects (renamed to `map` for clarity; view key is also `map`).
