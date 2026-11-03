# Build commands reference

The npm scripts defined in `package.json`, what each one runs, and the files it
produces. For the step-by-step task, see
[compile the plugin](../how-to/compile-the-plugin.md).

## Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `npm install` | — | Install dependencies. Run once per clone, and after `package.json` dependency changes. |
| `npm run build` | `node build-styles.mjs && tsc -noEmit -skipLibCheck && node esbuild.config.mjs production` | Full release build: styles, type-check, minified bundle. |
| `npm run dev` | `node build-styles.mjs && node esbuild.config.mjs` | Build styles once, then esbuild watch mode. No type-check. |
| `npm run build:styles` | `node build-styles.mjs` | Regenerate `styles.css` only. |
| `npm run lint` | `eslint .` | Lint the whole project. |
| `npm test` | `vitest` | Run the test suite in watch mode. Use `npx vitest run` for a single non-watch run. |
| `npm run version` | `node version-bump.mjs && git add manifest.json versions.json` | Bump the version in `manifest.json` / `versions.json` and stage them. |

## Build steps in detail

### `build-styles.mjs`

Reads `src/styles/plugin.css` and `node_modules/leaflet/dist/leaflet.css`,
concatenates them, and writes `styles.css` at the repository root. Bundling
Leaflet's CSS this way keeps `styles.css` in sync with the installed Leaflet
version without a manual copy.

### `tsc -noEmit -skipLibCheck`

Type-checks the source only. `-noEmit` means it writes no JavaScript;
`-skipLibCheck` skips type-checking of declaration files in dependencies. It
fails the build on any type error. The `dev` script omits this step.

### `esbuild.config.mjs`

Bundles the entry point `src/main.ts` into a single `main.js` (CommonJS, target
ES2018). `obsidian`, `electron`, the CodeMirror/Lezer packages, and Node
built-ins are marked external and are not bundled.

- With the `production` argument (`npm run build`): a one-shot rebuild, minified,
  no source map.
- Without it (`npm run dev`): watch mode, not minified, inline source map.

## Output artifacts

| File | Produced by | Committed? |
|------|-------------|------------|
| `main.js` | esbuild | No — generated |
| `styles.css` | `build-styles.mjs` | No — generated |
| `manifest.json` | hand-maintained (version bumped by `npm run version`) | Yes |

`main.js`, `manifest.json`, and `styles.css` are the three release artifacts
Obsidian loads. They must sit at the top level of the plugin folder in the vault
(`<Vault>/.obsidian/plugins/<plugin-id>/`). Generated files (`main.js`,
`styles.css`, `node_modules/`) are not committed to version control.

## Environment

- Node.js LTS (version 18 or later).
- Package manager: npm (the scripts and lockfile assume npm).
- Bundler: esbuild (configured in `esbuild.config.mjs`).

## Related

- Term definitions: [Glossary](../glossary.md)
