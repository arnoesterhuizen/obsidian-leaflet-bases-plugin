# Marker data model and view configuration

This document describes the plugin's data model, view configuration, and marker/region/path resolution logic. Other agents implementing features or generating base files and notes should use this as the authoritative reference.

## Overview

The plugin renders markers, region polygons, and path polylines on a Leaflet image map inside Obsidian Bases. Marker positions, region shapes, and path shapes live in note frontmatter as list-of-objects properties. Icon and color are note-level properties (not per-marker). The view is configured via Obsidian's Bases view options.

## Note frontmatter

### Marker property (list of objects)

The marker property is a YAML list where each entry represents a placement on a specific map:

```yaml
---
title: Axeholm
icon: swords
color: "#f44546"
marker:
  - coordinates: "449, 1291"
    map: dip-the-sword-coast
  - coordinates: "200, 300"
    map: dip-axeholm
---
```

### Marker object fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `coordinates` | `"lat, lng"` | Yes | Position on the map. Supports integers, decimals, and negative values. |
| `map` | `string` | No | Name of the target map. Must match the view's `map` key exactly. |

### Note-level properties

Icon and color are always flat note-level properties:

| Property | Type | Description |
|----------|------|-------------|
| `icon` | `string` | Lucide icon name. Can omit the `lucide-` prefix (e.g. `swords` resolves to `lucide-swords`). Also accepts full Iconify IDs like `game-icons:sword`. |
| `color` | `string` | Marker pin color. Accepts hex (`"#f44546"`, `"#f00"`) or named colors (`blue`, `red`, `green`). Named colors resolve to `var(--color-<name>)`. |

### Map filtering behavior

- If the view has a `map` key set (e.g. `map: dip-the-sword-coast`): only markers with a matching `map` field appear.
- If the view has no `map` key: only markers without a `map` field appear.
- Markers without a `map` field do NOT appear on named maps.

### Simplest note example

A note appearing on one named map with default icon and color:

```yaml
---
title: Tavern
marker:
  - coordinates: "200, 400"
    map: my-map
---
```

### Geographic coordinate system example

For maps using real-world or custom geographic coordinates (e.g. Toril GCS lat/lon):

```yaml
---
title: Neverwinter
icon: circle
color: "#FF0000"
marker:
  - coordinates: "49.306, -75.915"
    map: atlas-forgottenrealms-toril
---
```

### Full note example

```yaml
---
title: Dragon's Lair
icon: flame
color: "#f44546"
marker:
  - coordinates: "670, 657"
    map: dip-the-sword-coast
  - coordinates: "120, 80"
    map: dip-icespire-hold
---
```

## Region polygons

The region property holds polygon shapes rendered as filled Leaflet Polygons on the map. Like markers, region data lives in note frontmatter as a list-of-objects property.

### Region property (list of objects)

The region property is a YAML list where each entry represents a polygon on a specific map:

```yaml
---
title: High Forest
regionColor: "#33cc66"
region:
  - coordinates: "40.5,-55.9 41.2,-54.8 39.8,-54.2 39.5,-55.1"
    map: toril-surface
  - coordinates: "200,300 250,350 200,400 150,350"
    map: pixel-map
---
```

### Region object fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `coordinates` | `"lat,lng lat,lng ..."` | Yes | Space-separated coordinate pairs forming a closed polygon. Minimum 3 points. |
| `map` | `string` | No | Name of the target map. Must match the view's `map` key exactly. |
| `color` | `string` | No | Per-shape color override. Hex format (e.g. `"#33cc66"`). |

### Coordinate format

Coordinates are space-separated `lat,lng` pairs (no space around the comma within each pair):

```
"40.5,-55.9 41.2,-54.8 39.8,-54.2 39.5,-55.1"
```

- Minimum 3 points required (a polygon needs at least 3 vertices)
- Supports integers, decimals, and negative values
- The polygon is automatically closed (no need to repeat the first point)

### Note-level properties

| Property | Type | Description |
|----------|------|-------------|
| `regionColor` | `string` | Region fill/stroke color for all regions in the note. Accepts hex values. |

### Color resolution

Color is resolved in priority order:

1. Per-shape `color` field in the region object
2. Note-level `regionColor` property
3. Default: `#33cc6680` (green with alpha)

### Rendering

- Rendered as a Leaflet Polygon with 30% fill opacity and 2px border
- Shows the note basename as a tooltip on hover

### Map filtering behavior

Same as markers:

- View **has** a `map` key: only regions with a matching `map` field appear.
- View has **no** `map` key: only regions without a `map` field appear.
- Regions without `map` do NOT appear on named map views.
- Regions are filtered by Obsidian Bases filters in the `.base` file, same as markers.

### Full note example

```yaml
---
title: Anauroch Desert
regionColor: "#cc9933"
region:
  - coordinates: "45.2,-62.1 46.8,-60.3 45.5,-58.9 43.1,-59.5 42.8,-61.4"
    map: toril-surface
    color: "#cc993380"
---
```

## Path polylines

The path property holds polyline shapes rendered as Leaflet Polylines on the map. Like markers and regions, path data lives in note frontmatter as a list-of-objects property.

### Path property (list of objects)

The path property is a YAML list where each entry represents a polyline on a specific map:

```yaml
---
title: Trade Way
pathColor: "#ff6633"
path:
  - coordinates: "40.5,-55.9 41.2,-54.8 39.8,-54.2"
    map: toril-surface
  - coordinates: "100,200 150,250 200,200"
    map: pixel-map
---
```

### Path object fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `coordinates` | `"lat,lng lat,lng ..."` | Yes | Space-separated coordinate pairs forming an open polyline. Minimum 2 points. |
| `map` | `string` | No | Name of the target map. Must match the view's `map` key exactly. |
| `color` | `string` | No | Per-shape color override. Hex format (e.g. `"#ff6633"`). |

### Coordinate format

Same format as regions — space-separated `lat,lng` pairs:

```
"40.5,-55.9 41.2,-54.8 39.8,-54.2"
```

- Minimum 2 points required (a line needs at least 2 vertices)
- Supports integers, decimals, and negative values
- The polyline is NOT closed (unlike polygons)

### Note-level properties

| Property | Type | Description |
|----------|------|-------------|
| `pathColor` | `string` | Polyline color for all paths in the note. Accepts hex values. |

### Color resolution

Color is resolved in priority order:

1. Per-shape `color` field in the path object
2. Note-level `pathColor` property
3. Default: `#ff663380` (orange with alpha)

### Rendering

- Rendered as a Leaflet Polyline with weight 3 and 80% opacity
- Shows the note basename as a tooltip on hover

### Map filtering behavior

Same as markers:

- View **has** a `map` key: only paths with a matching `map` field appear.
- View has **no** `map` key: only paths without a `map` field appear.
- Paths without `map` do NOT appear on named map views.
- Paths are filtered by Obsidian Bases filters in the `.base` file, same as markers.

### Full note example

```yaml
---
title: River Dessarin
pathColor: "#3399ff"
path:
  - coordinates: "48.1,-63.2 46.5,-62.8 44.9,-63.5 43.2,-62.1"
    map: toril-surface
    color: "#3399ff80"
---
```

## Feature style resolution

The plugin resolves icon, color, and weight for markers and GeoJSON features through a three-level cascade. Later sources override earlier ones; only defined fields override — undefined fields fall through to the previous level.

### Style resolution cascade

1. **Plugin settings** (global defaults) — configured in **Settings → Leaflet Bases → Feature styles**
2. **Base file overrides** (per-view) — via the `styles` config key
3. **Note frontmatter** (per-feature) — `icon` and `color` properties on individual notes

### Plugin settings format

Style rules are stored as an array. Each rule targets a `group` (required) and optionally a `featureClass`. Rules without `featureClass` apply as group-level defaults; rules with `featureClass` are more specific and override.

Built-in defaults:

```
populated-places → icon: circle, color: #FF0000
populated-places + Town → icon: circle-small, color: #FF8080
populated-places + Village → icon: circle-dot, color: #FFB0B0
important-sites → icon: landmark, color: #6600cc
important-sites + Temple → icon: church, color: #FFD700
important-sites + Fortification → icon: castle, color: #cc99ff
landmarks → icon: mountain, color: #228B22
rivers → color: #4488cc, weight: 2
pathways → icon: signpost, color: #8B4513, weight: 2
pathways + Primary Road → color: #FF6600, weight: 3
pathways + Secondary Road → color: #CC9966, weight: 2
pathways + Underwater Tunnel → icon: cable, color: #006699
lakes → color: #3388ff, weight: 1
land-regions → color: #88aa44, weight: 1
named-regions → color: #996633, weight: 2
domains → color: #663399, weight: 2
```

### Base file override format

The `styles` view config key allows per-view overrides using a simple text format:

```yaml
styles: |
  pathways: color=#FF0000 weight=4
  pathways.Primary Road: color=#FFCC00 weight=5
  lakes: color=#0000FF
  populated-places.City: icon=star color=#FF0000
```

Format: `group[.featureClass]: key=value [key=value ...]`

Valid keys: `icon`, `color`, `weight`

### How features are matched

- **GeoJSON features**: `group` and `feature_class` are read from the feature's GeoJSON `properties` object (set by `build_atlas.py`).
- **Note markers**: `group` is extracted from the note's `atlas/group/{name}` tag; `featureClass` is extracted from the `atlas/type/{name}` tag.

### Resolved style fields

| Field | Applies to | Description |
|-------|-----------|-------------|
| `icon` | markers | Lucide icon name |
| `color` | markers, GeoJSON stroke/fill | Hex color |
| `weight` | GeoJSON features | Line weight in pixels |

## Base file configuration

The base file is a `.base` file using standard Obsidian Bases YAML syntax. The plugin registers a view type `leaflet-map`.

### Minimal base file

```yaml
views:
  - type: leaflet-map
    name: My Map
    map: my-map
    image: path/to/map-image.png
```

### Complete base file example

```yaml
filters:
  and:
    - "!marker.isEmpty()"
views:
  - type: leaflet-map
    name: Toril Full
    filters:
      and:
        - '!marker.filter(value.map == "atlas-forgottenrealms-toril").isEmpty()'
        - file.tags.containsAny("atlas/adventure/DIP", "atlas/type/river")
    map: atlas-forgottenrealms-toril
    image: _atch/atlas/svg/coastlines_pg.svg
    overlays:
      _atch/atlas/svg/srf_nat_land_cover_pg.svg
    bounds: -90,-180 90,180
    unit: mi
    scale: "69.5"
    zoomDelta: 1
    geojson:
      _atch/atlas/geojson/lakes.geojson
    rivers: _atch/atlas/geojson/rivers.geojson
    defaultZoom: 9
    center: 48.981, -74.854
    markerProperty: note.marker
    markerIcon: note.icon
    markerColor: note.color
    regionProperty: note.region
    regionColor: note.regionColor
    pathProperty: note.path
    pathColor: note.pathColor
  - type: leaflet-map
    name: Underdark - Upperdark
    filters:
      and:
        - '!marker.filter(value.map == "atlas-forgottenrealms-underdark-upperdark").isEmpty()'
    map: atlas-forgottenrealms-underdark-upperdark
    image: _atch/atlas/svg/udk_nat_domains_pg.svg
    bounds: -90,-180 90,180
    unit: mi
    scale: "69.5"
```

This example demonstrates:

- `image` provides the base map canvas (coastlines SVG gives land/ocean contrast)
- `overlays` add optional visual detail layers on top (land cover for forests/deserts/ice)
- `geojson` renders interactive vector layers with tooltips (lakes)
- `rivers` uses the dedicated tapering renderer
- Region and path properties enable polygon/polyline rendering from note frontmatter
- Multiple views can target different map layers (surface vs. underdark)

### Geographic coordinate system example

For SVG world maps with explicit bounds matching a coordinate system:

```yaml
views:
  - type: leaflet-map
    name: Faerun Surface
    map: atlas-forgottenrealms-toril
    image: _atch/atlas/toril_map.svg
    bounds: "14,-90 55,-33"
    minZoom: -2
    maxZoom: 6
    defaultZoom: 0
    zoomDelta: 0.5
```

### View configuration keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `image` | file path or wikilink | (required) | Background map image |
| `map` | string | (none) | This view's identity — only markers with matching `map` field appear |
| `height` | number | `600` | Fixed height in px (only applies when embedded) |
| `center` | `"lat, lng"` | (none, fits markers) | Default center point |
| `bounds` | `"latSW,lngSW latNE,lngNE"` | (auto from image) | Explicit coordinate bounds for the image overlay |
| `overlays` | string (newline-separated) | (none) | SVG overlay images stacked above the base image and below vector layers |
| `geojson` | string (newline-separated) | (none) | Vault paths to `.geojson` files, one per line |
| `rivers` | file path | (none) | GeoJSON file rendered with tapering polylines |
| `markerProperty` | property ID | `note.marker` | Which note property holds the marker list |
| `markerIcon` | property ID | `note.icon` | Which note property holds the icon |
| `markerColor` | property ID | `note.color` | Which note property holds the color |
| `regionProperty` | property ID | `note.region` | Which note property holds the region polygon list |
| `regionColor` | property ID | `note.regionColor` | Which note property holds the region color |
| `pathProperty` | property ID | `note.path` | Which note property holds the path polyline list |
| `pathColor` | property ID | `note.pathColor` | Which note property holds the path color |
| `defaultZoom` | number | (none, fits markers) | Starting zoom level |
| `minZoom` | number | `1` | Minimum zoom (negative = zoomed out further) |
| `maxZoom` | number | `10` | Maximum zoom level |
| `zoomDelta` | number | `0.5` | Zoom step per scroll tick |
| `styles` | multiline text | (none) | Per-view style overrides. Format: `group.Class: icon=x color=#hex weight=N` |
| `scale` | number (as string) | `1` | Multiplier converting pixel distance to display units |
| `unit` | string | (empty) | Label shown after measurements (e.g. `ft`, `m`, `mi`) |

### Default behavior

- If `markerProperty`, `markerIcon`, and `markerColor` are not specified, the plugin defaults to `note.marker`, `note.icon`, and `note.color`.
- If `regionProperty` and `regionColor` are not specified, the plugin defaults to `note.region` and `note.regionColor`.
- If `pathProperty` and `pathColor` are not specified, the plugin defaults to `note.path` and `note.pathColor`.
- If `defaultZoom` and `center` are not specified, the view auto-fits to encompass all markers.
- If the user has configured `defaultZoom` or `center`, those take priority over auto-fit.
- If `bounds` is not specified, the image's pixel dimensions are used (`[0,0]` to `[height,width]`).
- If `bounds` is specified, the image is projected onto the given coordinate space, enabling geographic coordinate systems.

### View-level filters

Use Bases formula filters to narrow which notes appear in each view:

```yaml
filters:
  and:
    - '!marker.filter(value.map == "my-map-name").isEmpty()'
```

This filters to notes that have at least one marker targeting the specified map. The formula uses `value.map` to access the `map` field inside each marker list item.

### Reserved key: `name`

The key `name` is reserved by the Bases framework for the view's display name. Do not use `name` for the map identity — use `map` instead.

## Marker resolution pipeline

When data updates, the view resolves markers through this pipeline:

1. **Read marker list**: For each entry, read the configured `markerProperty` (default: `note.marker`). Parse via the Obsidian `ListValue`/`ObjectValue` API, with JSON fallback.
2. **Validate schema**: Each marker object must have a `coordinates` field matching the pattern `-?digits(.digits)?, -?digits(.digits)?`.
3. **Filter by map**: Keep markers where `marker.map` matches the view's `map` key (exact match). If the view has no `map` key, keep only markers without a `map` field.
4. **Resolve icon**: Read the note-level property configured in `markerIcon` (default: `note.icon`). If no prefix, prepend `lucide-`. If absent, use default dot icon.
5. **Resolve color**: Read the note-level property configured in `markerColor` (default: `note.color`). If hex, use directly. If named, resolve to `var(--color-<name>)`. If absent, use default blue (`#21409a`).
6. **Render**: Place Leaflet markers on the map at the parsed coordinates.

## Image and bounds

### Default (pixel coordinates)

Without explicit bounds, the image is loaded and its pixel dimensions determine the coordinate space:
- Origin `(0, 0)` is the **bottom-left** corner
- Y axis increases **upward**: Y=0 is bottom, Y=imageHeight is top
- X axis increases **rightward**: X=0 is left, X=imageWidth is right
- For a 3000x2153 image: bottom-left is `"0, 0"`, top-right is `"2153, 3000"`

### Explicit bounds (geographic coordinates)

With explicit bounds, the image is projected onto the specified coordinate space:
- Format: `"latSW,lngSW latNE,lngNE"` (southwest corner, then northeast corner)
- Decimal and negative values supported
- Example for Faerun: `"14,-90 55,-33"` maps the image to lat 14-55, lon -90 to -33
- Coordinates in marker objects must use the same system as the bounds

**Important for agents generating coordinates**: when using pixel coordinates from a top-left origin (standard image coordinates where Y increases downward), convert with: `y_leaflet = imageHeight - y_image`. When using explicit bounds with a geographic CRS, use the coordinates directly (lat/lon).

## Auto-fit behavior

When no explicit `center` or `defaultZoom` is configured:
- The map automatically zooms and centers to fit all visible markers with padding.
- On initial load, `fitBounds` is called after markers are placed.

When switching between views in the same base:
- Zoom constraints are cleared before loading the new image.
- Each view gets a fresh zoom/center state.

## Ephemeral state

The map preserves its center and zoom when navigating forward/back in workspace history. State is stored via `getEphemeralState()`/`setEphemeralState()` and applied after the next data update.

## GeoJSON layers

GeoJSON files from the vault can be loaded as vector overlay layers:

```yaml
geojson: |
  maps/regions.geojson
  maps/roads.geojson
```

- Files are resolved via Obsidian's metadata cache
- Rendered as Leaflet GeoJSON layers with configurable styling
- Colors assigned round-robin from plugin settings palette
- Layers appear as toggleable overlays in a layer control

## Supported color formats

The `color` note property accepts:

| Format | Example | Result |
|--------|---------|--------|
| Hex (3 digit) | `"#f00"` | Direct hex color |
| Hex (6 digit) | `"#f44546"` | Direct hex color |
| Named (CSS variable) | `blue` | Resolves to `var(--color-blue)` |
| Named (CSS variable) | `red` | Resolves to `var(--color-red)` |

Named colors map to Obsidian's built-in `--color-*` CSS variables (the same ones used by callouts). They adapt to light/dark themes automatically.

Common named colors available in Obsidian: `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `pink`.

## Coordinates format

- Format: `"lat, lng"` — Leaflet CRS.Simple uses `lat, lng` which maps to `y, x`
- Supports integers (`"309, 742"`), decimals (`"49.306, -75.915"`), and negatives (`"-5, -10"`)
- Whitespace around the comma is optional
- `writeCoordinates` outputs 3 decimal places (trailing zeros stripped)
- Validation regex: `/^\s*-?[0-9]+(\.[0-9]+)?\s*,\s*-?[0-9]+(\.[0-9]+)?\s*$/`

## Multiple maps from one base file

A single `.base` file can define multiple map views. Each view has its own `map` key, image, and optional filters:

```yaml
views:
  - type: leaflet-map
    name: World Map
    map: world
    image: maps/world.png
    unit: mi
  - type: leaflet-map
    name: Dungeon Level 1
    map: dungeon-1
    image: maps/dungeon-1.png
    unit: ft
    scale: "0.1136"
  - type: leaflet-map
    name: Dungeon Level 2
    map: dungeon-2
    image: maps/dungeon-2.png
    unit: ft
    scale: "0.1136"
```

Notes target specific maps:

```yaml
---
title: Boss Room
icon: skull
color: "#f44546"
marker:
  - coordinates: "300, 400"
    map: dungeon-1
  - coordinates: "150, 200"
    map: dungeon-2
---
```

## Supported image formats

The plugin accepts: `avif`, `bmp`, `gif`, `jpeg`, `jpg`, `png`, `svg`, `webp`.

SVG files are fully supported. For large world maps, SVG combined with explicit bounds is the recommended approach.

## Known limitations

- The Bases framework "New" button in the header throws "Formula cannot be deserialized" when the active view has formula-based filters. Use the right-click "Add marker to note" flow instead.
- The `map` view config key must not use `name` (reserved by Bases framework).
- Middle-click on markers does not open in a new pane (Leaflet limitation; workaround planned).
- The `center` option is a static coordinate string; formula-based dynamic centering is not yet supported.
