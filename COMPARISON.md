# Comparison: obsidian-maps vs leaflet-bases

Analysis of Obsidian's own bases map view (`obsidian-maps`) compared to this plugin (`leaflet-bases`). Updated to reflect current implementation status.

## Does obsidian-maps use Leaflet?

No. It uses **MapLibre GL JS** (v5.24.0) — a WebGL-based vector/raster map library. It does NOT load background images as image overlays the way leaflet-bases does. Instead it uses:

1. Vector tile styles (fetched as JSON `StyleSpecification`)
2. Raster tile templates (`{z}/{x}/{y}` URLs) rendered as tile layers
3. OpenFreeMap as a default fallback (bright/dark variants)

The fundamental rendering model is different — MapLibre renders everything on a single WebGL canvas, while Leaflet uses DOM elements + SVG/Canvas overlays.

This means leaflet-bases serves a different use case: **local image maps** (dungeon maps, floor plans, custom images, SVG world maps) rather than geographic tile maps. The plugins are complementary, not competing.

## Feature comparison table

| Feature | obsidian-maps | leaflet-bases | Status |
|---------|--------------|---------------|--------|
| Background image maps | No (tiles only) | Yes | Core differentiator |
| Geographic tile maps | Yes | No | Different use case |
| Explicit bounds config | No (uses tile CRS) | Yes | Implemented |
| GeoJSON layers | No | Yes (toggleable overlays) | Implemented |
| Decimal/negative coords | Yes | Yes | Implemented |
| Property-based markers | Yes | Yes | Implemented |
| Property-based icon | Yes | Yes | Implemented |
| Property-based color | Yes | Yes | Implemented |
| Ephemeral state | Yes | Yes | Implemented |
| Debounced resize | Yes | Yes | Implemented |
| Embedded detection | Yes | Yes | Implemented |
| Auto-fit to markers | Yes | Yes | Implemented |
| Config snapshot diffing | Yes | Partial (image/zoom guards) | Partial |
| Formula-based center | Yes | No (static string) | Planned |
| Middle-click open | Assumed | No | Planned |
| Named color support | No (hex only) | Yes (CSS variables) | leaflet-bases ahead |
| Custom icon sets | No | Yes (Iconify) | leaflet-bases ahead |
| Marker drag tool | No | Yes | leaflet-bases ahead |
| Context menu | Basic | Rich (edit/delete/add) | leaflet-bases ahead |
| Map name filtering | No | Yes | leaflet-bases ahead |
| Quartz publishing | No | Yes (separate plugin) | leaflet-bases ahead |
| Measure tool | No | Yes | leaflet-bases ahead |

## Optimizations adopted from obsidian-maps

### 1. Config snapshot diffing (partially adopted)

obsidian-maps creates a `ConfigSnapshot` and compares via `JSON.stringify` to detect changes. Only changed aspects trigger map updates.

**leaflet-bases status**: Image overlay and zoom updates are now guarded (skip when unchanged). Full config diffing is not yet implemented but the high-impact paths are covered.

### 2. Debounced resize (adopted)

obsidian-maps debounces `onResize()` with 100ms leading-edge.

**leaflet-bases status**: Implemented. Uses `debounce(() => this.mapManager.invalidateSize(), 100, true)`.

### 3. Property-based marker configuration (adopted)

obsidian-maps uses `config.getAsPropertyId('coordinates')` to let the user pick which property contains coordinates.

**leaflet-bases status**: Implemented via `markerProperty`, `markerIcon`, and `markerColor` view options. Defaults to `note.marker`, `note.icon`, `note.color`.

### 4. Ephemeral state (adopted)

obsidian-maps saves/restores `center` + `zoom` via `getEphemeralState()` / `setEphemeralState()`.

**leaflet-bases status**: Implemented. Pending state is applied after the next data update to avoid race conditions.

### 5. Embedded vs full-page detection (adopted)

obsidian-maps detects embedding via `matchParent('.bases-embed, .block-language-base')` and only applies fixed height for embedded views.

**leaflet-bases status**: Implemented. Full-page views let CSS fill available space; embedded views use the configured height.

## Remaining opportunities

### Formula-based center

obsidian-maps uses `config.getEvaluatedFormula(this, 'center')` which allows the center to be a formula referencing `this.file`.

**leaflet-bases**: Center is a static string coordinate. Switching to a Bases `formula` option type would allow dynamic centering. This is tracked in TODO.md.

### Full config snapshot diffing

The current guards cover image and zoom changes, but the full pipeline (CSS height, GeoJSON reload, etc.) could benefit from a `JSON.stringify`-based snapshot comparison to skip truly no-op updates.

### Canvas-based markers for large sets

For the typical use case (10-200 markers on a dungeon map) DOM-based markers are fine. For atlas-scale use (1000+ markers), Leaflet's Canvas renderer with `L.circleMarker` would improve performance, at the cost of losing custom pin SVG styling. This is worth profiling if atlas integration shows performance issues.

## Context menu comparison

Both plugins use `Menu.forEvent(event)` with sections:

| obsidian-maps | leaflet-bases |
|---------------|---------------|
| New note | Add marker to note (new or existing) |
| Copy coordinates | Copy coordinates |
| Set default center | Set default center point |
| Set default zoom | Set default zoom |
| - | Edit marker |
| - | Delete marker |

leaflet-bases has a richer menu reflecting its richer marker model (named maps, editable coordinates, deletion).

## Summary

Most of the high-value patterns from obsidian-maps have been adopted. The remaining gaps (formula center, full config diffing) are incremental improvements rather than architectural blockers. The plugins remain complementary: obsidian-maps for geographic tile maps, leaflet-bases for local image maps with rich marker management.
