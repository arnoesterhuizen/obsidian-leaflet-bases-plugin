# Design: Viewport persistence

How the leaflet-map view decides whether to keep or reset the user's pan/zoom
across data refreshes, and the options for extending that persistence further.

## Problem

The map re-fit to show all markers whenever the Bases query re-ran: switching
away and back to the tab, closing a marker popup, or editing a tag in a popup
all triggered a data refresh that discarded the user's panned/zoomed viewport.

Root cause: the `MapManager` and its Leaflet map are created once per view and
are **never torn down** between refreshes, so the live map already holds the
user's viewport. But `LeafletMapView.onDataUpdated()` runs on every refresh and
used to call `mapManager.fitToContent()` unconditionally whenever no `center`
or `defaultZoom` was configured. Mouse-driven pan/zoom was never recorded, so
each refresh snapped back to fit-all.

## Shipped: Option A — first-load-only auto-fit (in-memory)

Auto-fit runs **only on the first data load** for a view instance. Every
subsequent refresh leaves the live Leaflet viewport untouched (the map instance
survives, so no restore is needed). The deliberate reset is the existing
**"Fit to view"** toolbar control, which calls `fitToContent()` directly.

Implementation:

- `shouldFitToContent(state)` in `src/plugin/util.ts` — pure predicate. Returns
  true only when `firstLoad && !hasPendingState && !hasConfiguredCenter &&
  !hasConfiguredZoom`. Unit-tested in `test/plugin/fit-to-content.test.ts`.
- `LeafletMapView` in `src/plugin/bases/leaflet-map/view.ts` — a `firstLoad`
  flag gates the fit decision through `shouldFitToContent`, then flips to
  `false` after the first `onDataUpdated` completes.

Scope limit: persistence lasts only as long as the view/map instance lives. It
does **not** survive closing and reopening the base, or an Obsidian restart,
because a new view builds a fresh Leaflet map with no memory of the old
viewport. Options B and C below extend persistence past that boundary. They are
deferred pending real-world use of Option A; this section documents them so the
work does not have to be re-discovered.

## Deferred: Option B — persist viewport to ephemeral state

Goal: survive full view reconstruction within a workspace session (reopening
the base, reloading the pane) by feeding the live viewport into the ephemeral
state Obsidian already round-trips for history navigation.

The plumbing already exists in `view.ts`:

- `getEphemeralState()` already returns `{ center, zoom, baseLayerIndex }` from
  `mapManager.getViewState()` / `getActiveBaseLayerIndex()`.
- `setEphemeralState()` already parses that shape into `pendingState`, which
  `onDataUpdated` restores after data loads (this path runs before the
  Option A fit, and `shouldFitToContent` already returns false when a pending
  state exists).

What is missing: the viewport is only captured when Obsidian calls
`getEphemeralState()` (history navigation), not when the user pans/zooms with
the mouse. Implementation sketch:

1. In `MapManager`, subscribe to the Leaflet map's `moveend` and `zoomend`
   events (register in the constructor, clean up in `unload()` alongside the
   other listener teardown). Keep the latest `{ center, zoom }` in a private
   field, or expose it via the existing `getViewState()`.
2. Have the view read that live viewport in `getEphemeralState()` so whatever
   Obsidian persists reflects the user's last interaction, not just the last
   history-nav snapshot. `getViewState()` already reads live values from the
   map, so this may need no more than ensuring `getEphemeralState()` is called
   at the right time — verify whether Obsidian calls it on view teardown.
3. On rebuild, the existing `setEphemeralState` → `pendingState` → restore path
   applies it. No new restore code needed.

Cost: small. Composes cleanly on top of Option A (A handles the live instance;
B handles reconstruction within a session). Watch for: debouncing `moveend`/
`zoomend` if they prove chatty, and confirming the listener is torn down in
`unload()` so reload/unload does not leak (see AGENTS.md "register/cleanup").

## Deferred: Option C — persist per-map viewport to plugin data (across restarts)

Goal: survive Obsidian restarts, and optionally share a remembered viewport
across distinct views that render the same map.

Approach: key a saved `{ center, zoom, baseLayerIndex }` by a stable map
identity and store it in plugin data via `loadData()` / `saveData()` (see
`settingsManager` / `BasesLeafletViewSettings`). Restore on first load (taking
precedence over Option A's auto-fit, like `pendingState` does); reset only via
the "Fit to view" control, which should also clear the saved entry for that
map.

Open design decisions (resolve before implementing):

- **Map identity key.** Candidates: the `image` path, the `mapName` config
  value, or a hash of the view config. `image`/`mapName` can collide or be
  absent; a config hash is stable but invalidates on any config edit. Decide
  what "the same map" means for persistence.
- **Invalidation / staleness.** When the image or bounds change, a saved
  center/zoom may fall outside the new viewport. Clamp to `maxBounds`, or drop
  the saved entry when the identity inputs change.
- **Storage growth.** One entry per map accumulates over time; consider an LRU
  cap or pruning entries whose map no longer resolves.
- **Privacy/sync.** Plugin data syncs with the vault. Viewport coordinates are
  low-sensitivity, but note it per AGENTS.md's data-minimisation guidance.

Cost: largest of the three. Introduces persistence and staleness concerns that
A and B avoid. Only pursue if cross-restart or cross-view memory is actually
wanted after living with A (and possibly B).

## Recommendation ordering

A (shipped) → add B if session-level reconstruction memory is wanted (cheap) →
add C only if cross-restart persistence is wanted (most work). B and C are
independent: C can be built without B, but B is the cheaper first step.
