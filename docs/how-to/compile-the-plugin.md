# Compile the plugin

Goal: turn the TypeScript source into the three release artifacts Obsidian
loads — `main.js`, `styles.css`, and `manifest.json` — at the repository root.

## Before you start

- Install Node.js (LTS, version 18 or later).
- Install dependencies once per clone:

  ```bash
  npm install
  ```

## Produce a release build

Run the production build:

```bash
npm run build
```

This runs three steps in order and stops if any step fails:

1. `node build-styles.mjs` — writes `styles.css` from the plugin CSS plus the
   installed Leaflet CSS.
2. `tsc -noEmit -skipLibCheck` — type-checks the source. It emits no files; it
   only fails the build on a type error.
3. `node esbuild.config.mjs production` — bundles `src/main.ts` into a single
   minified `main.js` with no source map.

When it finishes, `main.js` and `styles.css` are at the repository root next to
the existing `manifest.json`. These three files are the release artifacts.

## Rebuild automatically while developing

To rebuild on every save instead of running the command each time:

```bash
npm run dev
```

This builds `styles.css` once, then starts esbuild in watch mode. It keeps
running and rebuilds `main.js` whenever a source file changes. Stop it with
`Ctrl+C`.

Notes on the watch build:

- It does NOT run the `tsc` type-check — it only bundles. Run a full
  `npm run build` before you release to catch type errors.
- It writes an inline source map into `main.js` and does not minify, so the
  output is larger than a release build. That is expected for development.
- If you change `src/styles/plugin.css` or update the Leaflet version, stop and
  restart `npm run dev` (or run `npm run build:styles`) to regenerate
  `styles.css` — the watch only tracks the esbuild bundle, not the CSS.

## Verify the build

The plugin loads only if all three artifacts sit at the top level of the plugin
folder in your vault (`<Vault>/.obsidian/plugins/<plugin-id>/`):

- `main.js`
- `manifest.json`
- `styles.css`

Copy the freshly built `main.js` and `styles.css` (and `manifest.json` if it
changed) there, then reload Obsidian and enable the plugin in
**Settings → Community plugins**.

## Related

- Full command and script inventory: [build commands reference](../reference/build-commands.md)
- Term definitions: [Glossary](../glossary.md)
- Do not commit `main.js` or `styles.css`; they are generated. See the project
  conventions in [AGENTS.md](../../AGENTS.md).
