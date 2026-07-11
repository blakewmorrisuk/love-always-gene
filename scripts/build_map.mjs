// Generates ../map.js — the Pacific-theater base chart the journey map draws on
// (window.MAP_BASE: pre-projected coastline path strings, no runtime geo math).
//
//   Usage:    node scripts/build_map.mjs
//   Requires: Node 18+ (built-in fetch). One-time; rerun only to change the
//             extent or data source. The site never fetches anything at runtime.
//
// Source: Natural Earth (public domain), pinned tag v5.1.2 of
// github.com/nvkelso/natural-earth-vector. 110m land + lakes carry the chart;
// two small patches of 50m land add the Hawaiian and Solomon islands, which
// are below 110m's size cutoff but sit under the journey's key pins.
//
// Projection: equirectangular, Pacific-centered. lon 110°E → 285°E (=75°W),
// lat -48° → 58°, canvas 1000 × 606. Longitudes west of 110°E are shifted
// +360 so the route never crosses a map edge. Polygons are clipped in raw
// coordinates against two boxes that meet at ±180 (Natural Earth pre-splits
// rings there), then the western box is shifted — no seam artifacts.

import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "map.js");

const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson";

const W = 1000, H = 606;
const LON0 = 110, LON1 = 285;   // degrees east, continuous (285 = 75°W)
const LAT0 = -48, LAT1 = 58;

// The two clip boxes, in raw Natural Earth coordinates. A hair of overlap at
// the ±180 seam so the halves meet without a hairline gap once B shifts +360.
const BOX_EAST = { lo: 110, hi: 180.01 };
const BOX_WEST = { lo: -180.01, hi: -75 };

// 50m patches: [lonMin, lonMax, latMin, latMax] in raw coordinates.
const PATCHES = [
  { name: "hawaii",   box: [-161.0, -154.0, 18.5, 22.8] },
  { name: "solomons", box: [154.0, 163.0, -12.0, -4.5] },
];

// Simplification thresholds (projected px). Patches keep more detail because
// the islands are only a few px across.
const MAIN = { minDist: 0.75, minArea: 6 };
const FINE = { minDist: 0.35, minArea: 1.2 };

const project = ([lon, lat]) => [
  ((lon >= 110 ? lon : lon + 360) - LON0) / (LON1 - LON0) * W,
  (LAT1 - lat) / (LAT1 - LAT0) * H,
];

/* Sutherland–Hodgman: clip a ring against one half-plane keep(p) with
   boundary crossing point cross(a, b). */
function clipHalf(ring, keep, cross) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const ka = keep(a), kb = keep(b);
    if (ka) out.push(a);
    if (ka !== kb) out.push(cross(a, b));
  }
  return out;
}

const lerpAt = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function clipRect(ring, [x0, x1, y0, y1]) {
  let r = ring;
  const planes = [
    [p => p[0] >= x0, (a, b) => lerpAt(a, b, (x0 - a[0]) / (b[0] - a[0]))],
    [p => p[0] <= x1, (a, b) => lerpAt(a, b, (x1 - a[0]) / (b[0] - a[0]))],
    [p => p[1] >= y0, (a, b) => lerpAt(a, b, (y0 - a[1]) / (b[1] - a[1]))],
    [p => p[1] <= y1, (a, b) => lerpAt(a, b, (y1 - a[1]) / (b[1] - a[1]))],
  ];
  for (const [keep, cross] of planes) {
    r = clipHalf(r, keep, cross);
    if (r.length < 3) return [];
  }
  return r;
}

const ringArea = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a / 2);
};

function simplify(pts, { minDist, minArea }) {
  const out = [];
  for (const p of pts) {
    const q = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
    const last = out[out.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) >= minDist) out.push(q);
  }
  while (out.length > 1) {
    const a = out[0], b = out[out.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < minDist) out.pop(); else break;
  }
  if (out.length < 3 || ringArea(out) < minArea) return null;
  return out;
}

const toPath = (pts) =>
  "M" + pts.map(p => `${p[0]} ${p[1]}`).join("L") + "Z";

function* rings(geojson) {
  for (const f of geojson.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon") for (const r of g.coordinates) yield r;
    else if (g.type === "MultiPolygon") for (const poly of g.coordinates) for (const r of poly) yield r;
  }
}

function ringBBox(r) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of r) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return [x0, x1, y0, y1];
}

const insideAnyPatch = ([x0, x1, y0, y1]) =>
  PATCHES.some(({ box: [a, b, c, d] }) => x0 >= a && x1 <= b && y0 >= c && y1 <= d);

/* Clip a raw ring against both lon boxes (within the lat band), shift the
   western half +360, project, simplify. Yields 0..2 path strings. */
function processRing(raw, thresholds, latBand = [LAT0, LAT1]) {
  const paths = [];
  for (const [box, shift] of [[BOX_EAST, 0], [BOX_WEST, 360]]) {
    const clipped = clipRect(raw, [box.lo, box.hi, latBand[0], latBand[1]]);
    if (clipped.length < 3) continue;
    const projected = clipped.map(([lon, lat]) => project([lon + shift, lat]));
    const simple = simplify(projected, thresholds);
    if (simple) paths.push(toPath(simple));
  }
  return paths;
}

async function fetchJson(name) {
  const u = `${NE}/${name}.geojson`;
  process.stdout.write(`  fetching ${name} … `);
  const res = await fetch(u);
  if (!res.ok) throw new Error(`${u}: HTTP ${res.status}`);
  const j = await res.json();
  console.log(`${j.features.length} features`);
  return j;
}

async function main() {
  console.log("Building the Pacific-theater base chart from Natural Earth v5.1.2 …");
  const [land110, lakes110, land50] = await Promise.all([
    fetchJson("ne_110m_land"),
    fetchJson("ne_110m_lakes"),
    fetchJson("ne_50m_land"),
  ]);

  const land = [];
  for (const r of rings(land110)) {
    // 110m rings fully inside a patch box are replaced by the 50m version.
    if (insideAnyPatch(ringBBox(r))) continue;
    land.push(...processRing(r, MAIN));
  }
  const before = land.length;
  for (const { box } of PATCHES) {
    for (const r of rings(land50)) {
      const [x0, x1, y0, y1] = ringBBox(r);
      if (x1 < box[0] || x0 > box[1] || y1 < box[2] || y0 > box[3]) continue;
      const clipped = clipRect(r, box);
      if (clipped.length < 3) continue;
      const projected = clipped.map(([lon, lat]) => project([lon, lat]));
      const simple = simplify(projected, FINE);
      if (simple) land.push(toPath(simple));
    }
  }
  console.log(`  land: ${before} main rings + ${land.length - before} patch islands`);

  const lakes = [];
  for (const r of rings(lakes110)) lakes.push(...processRing(r, MAIN));
  console.log(`  lakes: ${lakes.length} rings`);

  if (!land.length) {
    console.error("No land rings survived — refusing to write map.js.");
    process.exit(1);
  }

  const base = {
    v: 1, w: W, h: H,
    lon0: LON0, lon1: LON1, lat0: LAT0, lat1: LAT1,
    land, lakes,
  };
  const out = `/* Generated by scripts/build_map.mjs — DO NOT EDIT BY HAND.
   Coastlines: Natural Earth 110m land/lakes + 50m island patches, v5.1.2
   (public domain), pre-projected to a Pacific-centered equirectangular
   chart (lon 110°E–285°E, lat 48°S–58°N, ${W}×${H}). */
window.MAP_BASE = ${JSON.stringify(base)};
`;
  await fs.writeFile(OUT, out);
  execFileSync("node", ["--check", OUT], { stdio: "inherit" });
  const kb = (out.length / 1024).toFixed(1);
  console.log(`\nWrote ${OUT}  (${kb} KB, ${land.length} land + ${lakes.length} lake rings)`);
  if (out.length > 50 * 1024) {
    console.warn("WARNING: over the 50 KB budget — raise the simplification thresholds.");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
