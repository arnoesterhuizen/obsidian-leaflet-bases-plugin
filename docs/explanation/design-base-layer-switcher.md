# Design: Base layer switcher

Adds a `baseLayers` config key to a leaflet-map view. Renders a Leaflet `L.Control.Layers` radio-button switcher that swaps the background image and associated overlays/geojson/rivers without affecting markers, regions, or paths.

## Motivation

Users who want to show the same markers on different background maps (e.g., surface world vs underdark) must currently define separate near-identical views in their `.base` file. This causes massive config repetition of shared settings (bounds, scale, unit, zoom, marker properties). The `baseLayers` feature collapses these into a single view with switchable backgrounds.

## 1. Config schema

`baseLayers` is an optional array on a leaflet-map view. Each entry defines one switchable background:

```yaml
baseLayers:
  - name: "Layer Name"          # required — display name in the switcher
    image: path/to/image.svg    # required — background image path
    overlays:                   # optional — SVG overlay paths
      - path/to/overlay1.svg
      - path/to/overlay2.svg
    geojson:                    # optional — GeoJSON file paths
      - path/to/file.geojson
    rivers:                     # optional — River GeoJSON paths
      - path/to/rivers.geojson
    tags:                       # required — show entries from notes with these tags
      - atlas/layer/surface
```

When `baseLayers` is present, every layer must have a `tags` array. An entry appears on a layer only if the note has at least one tag that matches any tag in that layer's `tags` array. Entries with no matching layer tags do not appear on any layer.

All other view settings are inherited from the parent view config and NOT repeated per layer:

- `bounds`, `scale`, `unit`
- `minZoom`, `maxZoom`, `defaultZoom`, `zoomDelta`
- `markerProperty`, `markerIcon`, `markerColor`
- `regionProperty`, `regionColor`
- `pathProperty`, `pathColor`
- `height`, `center`, `map`, `styles`

## 2. Cascading / inheritance rules

1. **Top-level view settings are the defaults** for all base layers. Settings like `bounds`, `scale`, `unit`, zoom params, property mappings, and styles are defined once at the view level and apply uniformly.

2. **Each base layer entry overrides only the keys it specifies.** A layer that omits `geojson` gets an empty array — not the parent's `geojson` value. This is because overlays, geojson, and rivers are tightly coupled to their specific image; they are not shared across layers.

3. **Image-coupled keys do NOT cascade.** If a layer omits `overlays`, `geojson`, or `rivers`, the resolved value is `[]` (empty). These keys describe what is drawn on top of that specific background image.

4. **Backward compatibility.** If `baseLayers` is absent, the view works exactly as today — a single image with its overlays/geojson/rivers read from the top-level keys.

5. **When `baseLayers` is present, top-level `image`/`overlays`/`geojson`/`rivers` are ignored.** The first base layer entry is used as the default active layer. This avoids ambiguity about which image is "the" background.

## 3. Example: Toril Atlas with surface and underdark

```yaml
filters:
  and:
    - "!marker.isEmpty()"

views:
  - type: leaflet-map
    name: Toril Atlas
    map: atlas-forgottenrealms-toril
    bounds: -90,-180 90,180
    unit: mi
    scale: "69.5"
    zoomDelta: 1
    baseLayers:
      - name: "Toril Surface"
        image: _atch/atlas/svg/coastlines_pg.svg
        overlays:
          - _atch/atlas/svg/srf_nat_sea_ice_pg.svg
          - _atch/atlas/svg/srf_nat_land_cover_pg.svg
          - _atch/atlas/svg/srf_nat_land_regions_pg.svg
        geojson:
          - _atch/atlas/geojson/srf_con_named_regions_pg.geojson
          - _atch/atlas/geojson/srf_civ_pathways_ln.geojson
          - _atch/atlas/geojson/rivers.geojson
        tags: ["atlas/layer/surface"]
      - name: "Upperdark"
        image: _atch/atlas/svg/udk_nat_domains_pg.svg
        overlays:
          - _atch/atlas/svg/udk_nat_underground_cover_pg.svg
          - _atch/atlas/svg/udk_nat_landforms_pg.svg
        geojson:
          - _atch/atlas/geojson/udk_nat_lakes_pg.geojson
          - _atch/atlas/geojson/udk_nat_domains_pg.geojson
        tags: ["atlas/layer/upperdark"]
      - name: "Middledark"
        image: _atch/atlas/svg/udk_nat_domains_pg.svg
        overlays:
          - _atch/atlas/svg/udk_nat_underground_cover_pg.svg
          - _atch/atlas/svg/udk_nat_landforms_pg.svg
        geojson:
          - _atch/atlas/geojson/udk_nat_lakes_pg.geojson
          - _atch/atlas/geojson/udk_nat_landforms_pg.geojson
        tags: ["atlas/layer/middledark"]
```

Key observations:

- **Markers appear on ALL layers** because they share the same `map` key and coordinate system. Switching the base layer does not remove markers.
- **Each layer has a `tags` array.** An entry appears on a layer only if the note has at least one matching tag. Notes without any layer tag do not appear on any layer.
- **Notes use a single map key** (`atlas-forgottenrealms-toril`) for coordinates across all layers. The `tags` key determines which layer each note appears on. This eliminates the need for separate coordinate entries per layer in each note's frontmatter.
- **A note can appear on multiple layers.** A city that exists on both surface and underdark gets both `atlas/layer/surface` and `atlas/layer/upperdark` tags.
- **Shared settings** (`bounds`, `scale`, `unit`, `zoomDelta`) are defined once and inherited by all layers.
- **"Middledark" reuses the same image as "Upperdark"** but loads different geojson, demonstrating that layers with the same background can still differ in vector content.

## 4. Cascading resolution table

### "Toril Surface" layer

| Setting | View-level | Layer value | Resolved |
|---------|-----------|-------------|----------|
| `image` | (ignored) | `coastlines_pg.svg` | `coastlines_pg.svg` |
| `bounds` | `-90,-180 90,180` | (not set) | `-90,-180 90,180` |
| `overlays` | (ignored) | `[sea_ice, land_cover, land_regions]` | `[sea_ice, land_cover, land_regions]` |
| `geojson` | (ignored) | `[named_regions, pathways]` | `[named_regions, pathways]` |
| `rivers` | (ignored) | `[rivers.geojson]` | `[rivers.geojson]` |
| `scale` | `69.5` | (not set) | `69.5` |
| `unit` | `mi` | (not set) | `mi` |
| `zoomDelta` | `1` | (not set) | `1` |
| `tags` | (none) | `["atlas/layer/surface"]` | show entries with tag |

### "Upperdark" layer

| Setting | View-level | Layer value | Resolved |
|---------|-----------|-------------|----------|
| `image` | (ignored) | `udk_nat_domains_pg.svg` | `udk_nat_domains_pg.svg` |
| `bounds` | `-90,-180 90,180` | (not set) | `-90,-180 90,180` |
| `overlays` | (ignored) | `[underground_cover, landforms]` | `[underground_cover, landforms]` |
| `geojson` | (ignored) | `[lakes, domains]` | `[lakes, domains]` |
| `rivers` | (ignored) | (not set) | `[]` |
| `scale` | `69.5` | (not set) | `69.5` |
| `unit` | `mi` | (not set) | `mi` |
| `zoomDelta` | `1` | (not set) | `1` |
| `tags` | (none) | `["atlas/layer/upperdark"]` | show entries with tag |

## 5. UI behavior

- **Position**: The layer switcher appears as a Leaflet control in the top-right corner, matching the existing geojson layer toggle position.
- **Radio buttons**: Only one base layer is active at a time (mutually exclusive selection).
- **Switching layers**: Swaps the image overlay, removes old SVG overlays and geojson layers, loads the new layer's overlays/geojson/rivers. Markers, regions, and paths remain on the map. Map center and zoom remain unchanged.
- **Single layer**: If only one base layer is defined, no switcher control is rendered — behavior is equivalent to today's single-image view.
- **Default selection**: The first base layer in the array is active by default on initial load.
- **Interaction with geojson toggle**: The existing geojson layer toggle (checkboxes for individual geojson files) still works within each base layer. When switching base layers, the toggle panel refreshes to show the new layer's geojson files.

## 6. Implementation notes

### Types

```typescript
export interface BaseLayerConfig {
  name: string;
  image: string | Wiki;
  overlays: string[];
  geojson: string[];
  rivers: string[];
  tags: string[];
}
```

`MapConfig` gets a new optional field:

```typescript
export interface MapConfig {
  // ... existing fields ...
  baseLayers?: BaseLayerConfig[];
}
```

### Parsing (`ViewUtil.getMapConfig()`)

- Read the `baseLayers` key from Bases config.
- If present and is a non-empty array, parse each entry into a `BaseLayerConfig`.
- Validate each entry has `name` (string) and `image` (passes `Validator.source()`).
- Set `overlays`, `geojson`, `rivers` to `[]` if not provided in the entry.
- When `baseLayers` is present, ignore top-level `image`/`overlays`/`geojson`/`rivers`. Use the first base layer's `image` as the effective `MapConfig.image`.

### Map rendering (`MapManager`)

- If `config.baseLayers` exists and has more than one entry, create a `L.Control.Layers` with radio buttons for each base layer.
- Track the active base layer index in the manager's state.
- On layer switch:
  1. Call `updateImageOverlay()` with the new layer's image.
  2. Call `overlayManager.updateLayers()` with the new layer's overlays.
  3. Call `geojsonManager.updateLayers()` with the new layer's geojson.
  4. Call `riverManager.updateLayers()` with the new layer's rivers.
  5. Apply the layer's `tags` to show or hide markers/regions/paths based on each entry's tags.
- Do NOT change zoom, center, or min/maxZoom on layer switch.

### Ephemeral state

The currently selected base layer (by index) is included in `getEphemeralState()` / `setEphemeralState()` so that navigating away and back restores the user's layer selection.

### Tag-based layer filtering

When `baseLayers` is configured, each layer has a required `tags` array.

- Read each entry's tags via `entry.getValue("file.tags")`.
- An entry is visible on a layer if the note has at least one tag that matches any tag in the layer's `tags` array.
- Tag matching is case-insensitive. Compare tags without the leading `#` prefix.
- Entries with no matching tags are invisible on all layers.
- The tag filter runs client-side on entries that already passed the Bases view-level filter.
- Entries that do not pass the tag filter are hidden (not removed). They reappear when the user switches to a layer whose tags they match.
- The plugin already reads tags via `entry.getValue("file.tags")` in `markerManager.ts` (`extractGroupAndClass()`). The same pattern applies here.

When `baseLayers` is NOT configured, no tag filtering occurs. All entries appear as today.

## 7. What does NOT change

- **Single-image views** (no `baseLayers` key) work exactly as before. No migration required.
- **Marker/region/path rendering logic** is unchanged. The same resolution pipeline runs regardless of which base layer is active.
- **The existing geojson layer toggle** (checkboxes per geojson file) still works within each base layer's geojson set.
- **Settings tab** — no new settings tab entries. The `baseLayers` key is configured via the `.base` file YAML, not the UI settings panel.
- **Property schemas and validation** — unchanged.
- **Measure tool, context menu, create-note flow** — unchanged.


## 8. Viewport behavior

This section describes how the map viewport (center and zoom) responds to layer switches, initial load, and an explicit "fit to view" action.

### Viewport preservation on layer switch

When the user switches base layers, the map center and zoom do not change. The viewport is preserved.

This is the default behavior. No toggle or setting controls it. It matches standard mapping tools (Google Maps, QGIS, Leaflet's own `L.Control.Layers`).

**Rationale.** Surface and underdark layers share the same coordinate system and bounds. The user's current viewport is spatially meaningful across layers. A re-fit on switch destroys that spatial context.

### Fit to view button

A new toolbar button is added to the existing `ControlContainer` (top-left, alongside Pan / Measure / Drag / Create Note tools).

- **Label / tooltip**: "Fit to view"
- **Icon**: Lucide `maximize` icon (matches Obsidian's icon set)
- **Behavior**: Calls `fitToContent()` using only markers, regions, and paths visible under the current layer's tags.
- **Availability**: The button is always present, not only when `baseLayers` is configured. It is useful for single-layer views too.

### Auto-fit behavior

Auto-fit to content happens only on initial load when all of these conditions are true:

1. No ephemeral state exists (not restoring from workspace history).
2. No explicit `center` is configured on the view.
3. No explicit `defaultZoom` is configured on the view.

Auto-fit never happens on layer switch.

### Tag-aware fitting

When a base layer has a `tags` array, the Fit to view button respects it. It fits only to markers, regions, and paths from entries that have at least one matching tag AND pass the view-level Bases filter.

### Viewport behavior summary

| Action | Viewport behavior |
|--------|-------------------|
| Switch base layer | Preserved (no change) |
| Click **Fit to view** | Fits to visible markers/regions/paths on current layer |
| Initial load (no saved state) | Auto-fits to content on default layer |
| Return to view (ephemeral state) | Restores saved zoom/center and saved layer |

### Implementation notes

- `ControlContainer` gets a new `fit-to-view` button created via Leaflet's `DomUtil.create()` with manual event listener add/remove in `onAdd`/`onRemove`.
- `fitToContent()` accepts an optional predicate function. The active layer's tag list is converted to a predicate that checks each entry's tags.
- The button calls `mapManager.fitToContent()`. When a base layer with `tags` is active, the tag predicate is passed as the argument.
- No new settings are needed. No toggle for viewport lock. The behavior is always: preserve on switch, explicit reset via button.
