# How marker icons are resolved

A marker's icon is not stored on the marker. It is resolved at render time by
walking a fixed chain of layers until a usable icon name is found, then falling
back to a built-in default when nothing matches. This note explains each layer,
the order they are consulted in, and how the plugin's settings and a note's
frontmatter feed into that chain.

The same pipeline resolves a marker's **color**; the icon-specific details are
called out where they differ.

## The marker pin

Every marker is drawn as a coloured teardrop pin with a smaller glyph inside it
(`buildMarkerIcon` in `src/plugin/bases/leaflet-map/marker/marker.ts`):

- The **pin shape** is a fixed SVG filled with the resolved color.
- The **inner glyph** is an Obsidian icon looked up by name. This is the part
  the layers below control.

So "setting a marker icon" means producing an icon *name* that Obsidian has
registered. If the chain produces no name, or a name that is not registered, the
inner glyph falls back to `circle-small`.

## The resolution chain (first match wins)

When the map builds a marker it calls `resolveMarkerEntry`
(`src/plugin/bases/leaflet-map/marker/markerManager.ts`). The icon name is
resolved in this order:

```
1. Note-level icon property            (highest priority)
2. Style rules matched by the note's tags
   2a. plugin settings  — group
   2b. plugin settings  — group + featureClass
   2c. base-file override — group
   2d. base-file override — group + featureClass
3. Built-in default: "circle-small"    (lowest priority)
```

Two things to keep in mind about the order:

- **The note property wins outright.** Style rules are only consulted when the
  note has *no* icon property. They never override an icon a note sets for
  itself.
- **Within the style rules, later layers win.** The cascade in
  `StyleResolver.resolve` applies the four rule layers in the sequence above,
  and a more specific or later layer overwrites an earlier one. The cascade
  logic lives in `src/plugin/styles/styleResolver.ts`.

Icon and color are resolved independently. A note can take its icon from a style
rule while setting its own color, or vice versa — whichever field the note omits
falls through to the style rules for that field alone.

---

## Layer 1 — the note's icon property

This is the common case and the one most users touch.

A note that supplies an icon property always draws that icon. Which property the
plugin reads is configured per view (default `note.icon`, see
[Layer: which property is read](#layer-which-property-is-read)).

```yaml
---
title: Neverwinter
icon: castle
color: "#FF0000"
marker:
  - coordinates: "49.306, -75.915"
    map: atlas-forgottenrealms-toril
---
```

### How an icon name is interpreted

`resolveIconName` decides how to read the string you put in the property:

| You write | Interpreted as | Why |
|-----------|----------------|-----|
| `castle` | `lucide-castle` | A bare name gets the `lucide-` prefix (Lucide is built in). |
| `lucide-castle` | `lucide-castle` | An explicit `lucide-` prefix is kept as-is. |
| `game-icons:crossed-swords` | `game-icons:crossed-swords` | Any `prefix:name` (contains a colon) is an Iconify icon and is kept as-is. |

The resulting name must be a *registered* icon. If it is not (typo, or an
Iconify set that was never loaded), the name is discarded and resolution
continues down the chain — in practice landing on the default `circle-small`.

> Icon and color share this note-property layer. The color property (default
> `note.color`) accepts a hex code (`"#f44546"`) or a named color (`blue`,
> `red`, …) that maps to Obsidian's `var(--color-*)` CSS variable.

---

## Layer 2 — style rules matched by tags

When a note has **no** icon property, the plugin tries to derive one from the
note's tags. It reads two tag patterns:

- `atlas/group/{group}`  → the feature **group**
- `atlas/type/{type}`    → the feature **class** (`featureClass`)

It then asks the `StyleResolver` for an icon for that `(group, featureClass)`
pair. Rules come from two sources, applied in four passes (later wins):

1. **Plugin settings** rule matching the group only
2. **Plugin settings** rule matching group + featureClass
3. **Base-file override** rule matching the group only
4. **Base-file override** rule matching group + featureClass

A group-level rule sets the baseline for every feature in that group; a
group+class rule refines it for one class. This is why, in the shipped defaults,
`populated-places` gets a red `circle` while `populated-places` + `Town` refines
that to a lighter `circle-small`.

### When both a group and a class match, they merge field by field

If a note's tags match both a group rule and a group+class rule, the plugin does
**not** pick one rule wholesale. It overlays them **per field** — `icon`,
`color`, and `weight` are each resolved independently
(`StyleResolver.applyMatchingRules`):

1. The **group** rule sets the baseline for every field it defines.
2. The **group+class** rule is then applied on top, overwriting **only the
   fields it actually defines**. Fields the class rule leaves out keep the
   group's value.

So a class rule that sets only a color gives you the class's color *and* the
group's icon. A class rule that sets an icon and color overrides both. The
group+class rule wins for any field where the two conflict.

Three caveats about the match itself:

- **Class matching is exact and case-sensitive.** The shipped class is `Temple`
  (capital T); tags `atlas/type/temple` or `atlas/type/site` do **not** match it.
- **If no group+class rule matches, you get the group rule unchanged.** With the
  shipped defaults, `important-sites` defines only the `Temple` and
  `Fortification` classes, so a note tagged `atlas/group/important-sites` +
  `atlas/type/site` matches nothing in the class pass and falls back to the
  group-level `landmark` / `#6600cc`.
- The same group-vs-class merge happens again between the plugin-settings rules
  (passes 1–2) and the base-file overrides (passes 3–4); see below.

### 2a / 2b — plugin settings rules

Configured at **Settings → Leaflet Bases → Feature styles**. These are the
global defaults, stored in plugin settings as `StyleRule` entries. The shipped
defaults (`Constants.settings.default.styleRules`) include, for example:

```text
group = populated-places                 icon = circle        color = #FF0000
group = populated-places  class = Town    icon = circle-small  color = #FF8080
group = populated-places  class = Village icon = circle-dot    color = #FFB0B0
group = important-sites                   icon = landmark      color = #6600cc
group = important-sites   class = Temple   icon = church        color = #FFD700
group = important-sites   class = Fortification icon = castle   color = #cc99ff
```

A note tagged `atlas/group/important-sites` and `atlas/type/Temple`, with no
icon property, draws the `church` icon.

### 2c / 2d — base-file (per-view) overrides

A single map view can override the global rules with the `styles` config key.
Each line is `group.featureClass: icon=name color=#hex weight=N`; the
`.featureClass` part is optional.

```yaml
styles: |
  important-sites: icon=landmark color=#6600cc
  important-sites.Temple: icon=church color=#FFD700
  populated-places.City: icon=star color=#FF0000
```

Because overrides are applied *after* the settings rules, they win for the
groups/classes they mention, and leave everything else to the global defaults.

---

## Layer 3 — the built-in default

If nothing above yields a registered icon, `getIconWithDefault`
(`src/plugin/util.ts`) draws `circle-small`. A marker therefore always renders a
glyph, even with no icon property, no matching tag, and no style rule.

---

## Layer: which property is read

Layer 1 reads whichever note property the view is configured to use. This is set
per view, so different maps can read different properties.

| What it controls | Code key (`.base`) | UI label | Default |
|------------------|--------------------|----------|---------|
| Property holding the marker list | `markerProperty` | Marker coordinates | `note.marker` |
| Property holding the **icon** name | `markerIcon` | Marker icon | `note.icon` |
| Property holding the color | `markerColor` | Marker color | `note.color` |

So "the note's icon property" means "the value at `markerIcon`, defaulting to
`note.icon`". If you point `markerIcon` at `note.mapGlyph`, then layer 1 reads
`mapGlyph` from frontmatter instead.

---

## Worked examples

Each example shows the plugin configuration (view config and/or plugin settings)
alongside the note frontmatter, and the icon that results.

### Example 1 — note sets its own icon (layer 1)

Plugin configuration — nothing special; defaults apply.

```yaml
# .base view
views:
  - type: leaflet-map
    name: Map
    map: atlas-forgottenrealms-toril
    image: assets/toril.png
    # markerIcon defaults to note.icon
```

Note frontmatter:

```yaml
---
title: Waterdeep
icon: castle          # bare name → lucide-castle
color: blue           # named color → var(--color-blue)
marker:
  - coordinates: "48.1, -74.2"
    map: atlas-forgottenrealms-toril
---
```

**Result:** a blue pin with the Lucide `castle` glyph. The note property wins; no
style rules are consulted.

### Example 2 — icon from a plugin-settings style rule (layer 2a/2b)

Plugin configuration — the shipped default style rules (Feature styles):

```text
group = important-sites                 icon = landmark  color = #6600cc
group = important-sites  class = Temple  icon = church    color = #FFD700
```

Note frontmatter — **no** `icon` property, tags drive the style:

```yaml
---
title: House of the Moon
tags:
  - atlas/group/important-sites
  - atlas/type/Temple
marker:
  - coordinates: "48.3, -74.0"
    map: atlas-forgottenrealms-toril
---
```

**Result:** a `#FFD700` pin with the `church` glyph. The group+class rule
(`important-sites.Temple`) refined the group-level `landmark`/`#6600cc`.

Drop the `atlas/type/Temple` tag and the marker falls back to the group-level
rule: a `#6600cc` pin with the `landmark` glyph.

### Example 3 — per-view override beats the global default (layer 2c/2d)

Plugin configuration — global default says temples are `church`, but this one
map overrides it:

```yaml
# .base view
views:
  - type: leaflet-map
    name: Ruins map
    map: ruins
    image: assets/ruins.png
    styles: |
      important-sites.Temple: icon=skull color=#888888
```

Note frontmatter — same as Example 2 (no `icon`, tagged Temple), but assigned to
the `ruins` map:

```yaml
---
title: House of the Moon (ruined)
tags:
  - atlas/group/important-sites
  - atlas/type/Temple
marker:
  - coordinates: "12.0, 30.0"
    map: ruins
---
```

**Result:** a grey `skull` pin. The base-file override is applied after the
plugin-settings rule, so it wins — but only on this view. On a view without the
override the same note still shows the default `church`.

### Example 4 — custom icon property + Iconify icon

Plugin configuration — the view reads a non-default property and the
`game-icons` Iconify set has been loaded via
**Settings → Leaflet Bases → Additional icon sets**:

```yaml
# .base view
views:
  - type: leaflet-map
    name: Map
    map: world
    image: assets/world.png
    markerIcon: note.mapGlyph     # read `mapGlyph` instead of `icon`
```

Note frontmatter:

```yaml
---
title: Battlefield
mapGlyph: game-icons:crossed-swords   # prefix:name → kept as-is
color: "#f44546"
marker:
  - coordinates: "20, 40"
    map: world
---
```

**Result:** a red pin with the `game-icons` crossed-swords glyph. If the
`game-icons` set were not loaded, the name would not be registered and the pin
would fall back to `circle-small`.

### Example 5 — nothing matches (layer 3)

Note frontmatter — no `icon`, no recognised `atlas/*` tags, no style rule:

```yaml
---
title: Unknown site
marker:
  - coordinates: "0, 0"
    map: world
---
```

**Result:** a default-coloured pin with the `circle-small` glyph.

---

## Summary

| Layer | Source | Wins over | Set where |
|-------|--------|-----------|-----------|
| 1. Note icon property | Frontmatter (`markerIcon`, default `note.icon`) | everything below | the note |
| 2a/2b. Settings style rule | Plugin settings, matched by `atlas/group` + `atlas/type` tags | the default | Settings → Feature styles |
| 2c/2d. Base-file override | View `styles` key, matched by the same tags | the settings rule | the `.base` view |
| 3. Default | `circle-small` | — | built in |

Icon and color walk this chain independently. A bare icon name gets a `lucide-`
prefix; a `prefix:name` is treated as an Iconify icon and must come from a loaded
icon set. See the top-level [README](../../README.md) for how to add maps,
markers, and icon sets, and [Feature styles](../../README.md#feature-styles) for
the style-rule format.
