# Leaflet Bases

![preview](docs/preview.png)

> **Fork notice**: This is a divergent fork of [Requiae/obsidian-leaflet-bases-plugin](https://github.com/Requiae/obsidian-leaflet-bases-plugin) by Sara Lilith Slootmaker. It includes significant changes to the data model, coordinate system support, marker resolution pipeline, and plugin architecture. See the [CHANGELOG](CHANGELOG.md) for details.

This plugin for [Obsidian](https://obsidian.md) adds a **Leaflet Map** view to [Obsidian Bases](https://help.obsidian.md/bases) and a custom **marker** property type.

> Report issues [here](https://github.com/Requiae/obsidian-leaflet-bases-plugin/issues).

## Why this plugin?

- Leverages [Obsidian Bases](https://help.obsidian.md/bases) for filtering, sorting, and querying notes.
- Marker data lives in the note it belongs to, not in the map definition.
- Supports local image maps (dungeon maps, floor plans, world maps) with any image format.
- Supports decimal and negative coordinates for geographic coordinate systems (e.g. Toril GCS lat/lon).
- Available in your online garden via a [separate Quartz plugin](https://github.com/Requiae/quartz-leaflet-map-plugin) (supports Quartz v4 and v5 beta).

## Features

- Background image map (avif, bmp, gif, jpeg, jpg, png, **svg**, webp)
- Configurable zoom (default, min, max, step size)
- Explicit bounds for geographic coordinate systems
- GeoJSON vector layer overlays with layer control
- Configurable marker data source (property-based)
- Region polygons and path polylines from note frontmatter
- Icon support via Lucide and Iconify icon sets
- Named color support (resolves to Obsidian CSS variables)
- Context menu (add/edit/delete markers, copy coordinates, set zoom/center)
- Toolbar tools (pan, measure, drag markers, create note)
- Auto-fit to markers when no explicit center/zoom is set
- Ephemeral state (pan/zoom preserved during workspace history navigation)
- Configurable feature styles with cascading resolution (plugin settings → base file → note frontmatter)
- Embedded and full-page map support
- Mobile compatible

## Usage

> Example vault: [obsidian-leaflet-bases-plugin-example](https://github.com/Requiae/obsidian-leaflet-bases-plugin-example)

### Adding a map

#### Using the Bases UI

1. Create a [base](https://help.obsidian.md/bases) and add a **Leaflet Map** view.
   ![add map](docs/add-map.png)
2. Configure the view settings as needed.

#### Using a code block

Embed a base with a Leaflet Map view in any note:

````yaml
```base
views:
  - type: leaflet-map
    name: Map
    map: my-map
    image: assets/map.png
    height: 400
    minZoom: -1.5
    maxZoom: 2
    defaultZoom: -1.5
    zoomDelta: 0.25
    scale: "0.2"
    unit: km
```
````

#### View configuration reference

| UI label | Code key | Default | Description |
|----------|----------|---------|-------------|
| Image | `image` | (required) | Background image file or wiki link |
| Map name | `map` | (none) | Identifier linking markers to this view |
| Embedded height | `height` | `600` | Height in px (embedded views only) |
| Default center point | `center` | (auto-fit) | Initial center (`"lat, lng"`) |
| Bounds | `bounds` | (auto from image) | Explicit bounds: `"latSW,lngSW latNE,lngNE"` |
| GeoJSON layers | `geojson` | (none) | Vault paths to `.geojson` files (one per line) |
| Marker coordinates | `markerProperty` | `note.marker` | Property holding the marker list |
| Marker icon | `markerIcon` | `note.icon` | Property holding the icon name |
| Marker color | `markerColor` | `note.color` | Property holding the marker color |
| Region coordinates | `regionProperty` | `note.region` | Property holding the region polygon list |
| Region color | `regionColor` | `note.regionColor` | Property holding the region color |
| Path coordinates | `pathProperty` | `note.path` | Property holding the path polyline list |
| Path color | `pathColor` | `note.pathColor` | Property holding the path color |
| Default zoom | `defaultZoom` | (auto-fit) | Starting zoom level |
| Minimum zoom | `minZoom` | `1` | How far you can zoom out (negative = further) |
| Maximum zoom | `maxZoom` | `10` | How far you can zoom in |
| Zoom stepsize | `zoomDelta` | `0.5` | Zoom increment per scroll tick |
| Scale | `scale` | `1` | Pixel-to-unit multiplier for the measure tool |
| Unit | `unit` | (empty) | Unit label for measurements (km, mi, ft, etc.) |
| Feature styles | `styles` | (none) | Per-view style overrides. Format: `group.Class: icon=x color=#hex weight=N` |

> Only `type`, `name`, and `image` are required. All other settings have sensible defaults.

#### Bounds configuration

For maps using real-world or custom coordinate systems (not pixel coordinates), set explicit bounds to map the image to the correct coordinate space:

```yaml
bounds: "14,-90 55,-33"
```

Format: `"latSW,lngSW latNE,lngNE"` — the southwest corner followed by the northeast corner. Decimal and negative values are supported.

Without explicit bounds, the plugin uses the image's pixel dimensions (`[0,0]` to `[height,width]`).

#### GeoJSON layers

Load `.geojson` files from the vault as vector overlays:

```yaml
geojson: |
  maps/regions.geojson
  maps/roads.geojson
```

Layers appear as toggleable overlays. Colors are assigned from the palette configured in **Settings > Leaflet bases > GeoJSON > Default layer colors**.

#### View-level filters

Use Bases formula filters to show only notes matching a specific map:

```yaml
filters:
  and:
    - '!marker.filter(value.map == "my-map-name").isEmpty()'
```

### Adding a marker

#### Using the UI (property widget)

1. Add a `marker` property to any note.
   ![add marker property](docs/add-marker-property.png)
2. Click the **+** button. If the vault has multiple Leaflet map views, pick which one the marker belongs to, then click on that map to set coordinates. Fill in the modal and select **Add marker**.
   ![add marker modal](docs/add-marker-modal.png)
3. Edit markers by clicking their tags, or remove them with the **x** button.
   ![edit marker modal](docs/add-marker-edit.png)

#### Using the map toolbar

1. Enable the create note tool: **Settings > Leaflet bases > Enable create note tool**.
2. Select the **Create note here** tool in the map toolbar and click a spot.
3. Type a name for a new note, or pick an existing note from the base to add the marker to it.

#### Using the context menu

1. Right-click a spot on the map.
2. Select **Add marker to note**.
3. Choose a new or existing note as above.

> Drag markers by enabling the drag tool (**Settings > Leaflet bases > Enable drag tool**) and selecting it in the toolbar.

#### Frontmatter format

```yaml
---
title: Neverwinter
icon: circle
color: "#FF0000"
marker:
  - coordinates: "49.306, -75.915"
    map: atlas-forgottenrealms-toril
  - coordinates: "200, 400"
    map: dungeon-level-1
---
```

##### Marker object fields

| Field | Required | Description |
|-------|----------|-------------|
| `coordinates` | Yes | Position as `"lat, lng"`. Supports integers, decimals, and negatives. |
| `map` | No | Target map name. Must match the view's `map` key. |

##### Note-level properties

| Property | Type | Description |
|----------|------|-------------|
| `icon` | string | Icon name. Bare names like `swords` resolve to `lucide-swords`. Also accepts `prefix:name` (e.g. `game-icons:sword`). |
| `color` | string | Hex color (`"#f44546"`) or named color (`blue`, `red`, `green`, etc.). Named colors resolve to Obsidian's `var(--color-*)` CSS variables. |

##### Map filtering behavior

- View **has** a `map` key: only markers with a matching `map` field appear.
- View has **no** `map` key: only markers without a `map` field appear.
- Markers without `map` do NOT appear on named map views.

### Adding regions (polygons)

Regions are filled polygons defined in note frontmatter. They use the same map-filtering behavior as markers.

#### Frontmatter format

```yaml
---
title: High Forest
regionColor: "#33cc66"
region:
  - coordinates: "40.5,-55.9 41.2,-54.8 39.8,-54.2 39.5,-55.1"
    map: toril-surface
    color: "#33cc66"
---
```

##### Region object fields

| Field | Required | Description |
|-------|----------|-------------|
| `coordinates` | Yes | Space-separated `lat,lng` pairs forming a closed polygon. Minimum 3 points. |
| `map` | No | Target map name. Must match the view's `map` key. |
| `color` | No | Per-shape color override (hex). |

Color resolves from: per-shape `color` field > note-level `regionColor` property > default `#33cc6680`.

Rendered as a filled Leaflet Polygon (30% fill opacity, 2px border) with the note basename as tooltip.

### Adding paths (polylines)

Paths are open polylines defined in note frontmatter. They use the same map-filtering behavior as markers.

#### Frontmatter format

```yaml
---
title: Trade Way
pathColor: "#ff6633"
path:
  - coordinates: "40.5,-55.9 41.2,-54.8 39.8,-54.2"
    map: toril-surface
    color: "#ff6633"
---
```

##### Path object fields

| Field | Required | Description |
|-------|----------|-------------|
| `coordinates` | Yes | Space-separated `lat,lng` pairs forming an open polyline. Minimum 2 points. |
| `map` | No | Target map name. Must match the view's `map` key. |
| `color` | No | Per-shape color override (hex). |

Color resolves from: per-shape `color` field > note-level `pathColor` property > default `#ff663380`.

Rendered as a Leaflet Polyline (weight 3, 80% opacity) with the note basename as tooltip.

### Adding icon sets

The plugin supports Lucide icons (built-in) and any Iconify icon set.

#### In-app (recommended)

Go to **Settings > Leaflet bases > Additional icon sets** and use the **Add iconset** button to load an Iconify `.json` file.

#### Finding icon sets

1. Browse available sets at [Iconify](https://icon-sets.iconify.design/).
2. Download the `.json` file from the [Iconify GitHub](https://github.com/iconify/icon-sets/tree/master/json).
3. Load it via the settings button above.

## Feature styles

The plugin resolves icon, color, and line weight for features through a three-level cascade:

1. **Plugin settings** — configure default styles by feature group and class in **Settings → Leaflet Bases → Feature styles**.
2. **Base file overrides** — override per-view using the `styles` config key:
   ```yaml
   styles: |
     pathways: color=#FF0000 weight=4
     pathways.Primary Road: color=#FFCC00 weight=5
     lakes: color=#0000FF
     populated-places.City: icon=star color=#FF0000
   ```
3. **Note frontmatter** — individual notes can always override with their own `icon` and `color` properties.

Later sources override earlier ones. Only defined fields override; undefined fields fall through to the previous level.

## Plugin settings

Located at **Settings > Leaflet bases**:

| Section | Setting | Default | Description |
|---------|---------|---------|-------------|
| Map tools | Enable measure tool | On | Distance measurement tool in toolbar |
| Map tools | Enable drag tool | On | Marker drag tool in toolbar |
| Map tools | Enable create note tool | On | Click-to-create-note tool in toolbar |
| GeoJSON | Default layer colors | 8 colors | Hex colors for GeoJSON layers (one per line) |
| Icon sets | Add iconify icon set | - | Upload `.json` icon set files |

## Installation

Requires Obsidian v1.11.4 or later.

### Community plugins

Find the plugin [here](https://community.obsidian.md/plugins/leaflet-bases) in Obsidian's community plugin browser.

### BRAT

1. Install the [BRAT plugin](https://obsidian.md/plugins?search=BRAT).
2. Open BRAT settings and select **Add beta plugin**.
3. Enter: `https://github.com/Requiae/obsidian-leaflet-bases-plugin`
4. Choose the latest version and select **Add plugin**.

## Alternatives

| Plugin | Use case |
|--------|----------|
| [Leaflet](https://github.com/javalent/obsidian-leaflet) | The original Obsidian fantasy map plugin. No longer actively developed. |
| [Zoom map](https://github.com/Jareika/zoom-map) | Feature-rich map plugin without Bases integration. |
| [Map view](https://help.obsidian.md/bases/views/map) (built-in) | Obsidian's native map view. Tile-based only; no local image maps. |

Leaflet Bases serves the **local image map** use case (dungeon maps, world maps, floor plans) with Bases integration. Obsidian's native Map view is for geographic tile maps.
