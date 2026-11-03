/**
 * Concatenates plugin CSS and Leaflet's CSS into styles.css.
 * Run as part of the build: `node build-styles.mjs`
 *
 * This ensures styles.css always tracks the installed Leaflet version
 * without requiring a manual copy of leaflet.css.
 */
import { readFileSync, writeFileSync } from "node:fs";

const pluginCss = readFileSync("src/styles/plugin.css", "utf8");
const leafletCss = readFileSync("node_modules/leaflet/dist/leaflet.css", "utf8");

const output = `${pluginCss}\n/* Leaflet CSS — bundled from node_modules/leaflet/dist/leaflet.css */\n${leafletCss}`;

writeFileSync("styles.css", output);
process.stdout.write(`styles.css built (${Buffer.byteLength(output)} bytes)\n`);
