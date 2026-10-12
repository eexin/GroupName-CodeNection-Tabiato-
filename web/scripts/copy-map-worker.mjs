/**
 * MapLibre 6 draws the map in a web worker that it loads from a file next to its own module.
 * The bundler doesn't emit that file, so the map stays blank ("Worker failed to load"). This copies
 * the worker, and the one chunk it imports, into public/maplibre/, where components/memory-map.tsx
 * points MapLibre at it. Runs before `npm run dev` and `npm run build`, so it always matches the
 * installed version.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const dist = join(dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json")), "dist");
const out = join(import.meta.dirname, "..", "public", "maplibre");
mkdirSync(out, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(dist, file), join(out, file));
