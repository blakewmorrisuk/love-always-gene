// Fetches historical weather for every letter's date + place from Open-Meteo's
// free archive API (ERA5 reanalysis, back to 1940 and global — ocean included),
// then writes ../weather.js with a window.LETTER_WEATHER map keyed by letter id.
//
//   Usage:    node scripts/fetch_weather.mjs
//   Requires: Node 18+ (built-in fetch).
//
// The worklist comes from letters.json (each letter's `place` field) joined to
// places.json (coordinates + timezone) — nothing is hardcoded here. Letters at
// an `approx` place (the censored at-sea waypoints reconstructed from the
// U.S.S. New Orleans's documented movements) carry `approx: true` through to
// their weather record, and the site marks the badge accordingly.
//
// One request per place spanning that place's first-to-last letter date keeps
// this to ~19 requests. Open-Meteo is free and unauthenticated. Rerunning
// overwrites weather.js.

import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const ENDPOINT = "https://archive-api.open-meteo.com/v1/archive";
const DAILY = [
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "snowfall_sum",
  "weathercode",
  "windspeed_10m_max",
].join(",");

async function readJson(name) {
  return JSON.parse(await fs.readFile(path.join(ROOT, name), "utf8"));
}

async function fetchPlace(place, dates, { forceEra5 = false } = {}) {
  const params = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    start_date: dates[0],
    end_date: dates[dates.length - 1],
    daily: DAILY,
    temperature_unit: "fahrenheit",
    precipitation_unit: "inch",
    windspeed_unit: "mph",
    timezone: place.tz || "auto",
  });
  if (forceEra5) params.set("models", "era5");
  const res = await fetch(`${ENDPOINT}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`${place.key}: HTTP ${res.status} ${await res.text().catch(() => "")}`);
  }
  const d = (await res.json()).daily || {};
  const idx = new Map((d.time || []).map((t, i) => [t, i]));
  const pick = (arr, i) => (arr && arr[i] != null ? arr[i] : null);
  const byDate = {};
  for (const date of dates) {
    const i = idx.get(date);
    byDate[date] = i == null ? null : {
      tmax_f: pick(d.temperature_2m_max, i),
      tmin_f: pick(d.temperature_2m_min, i),
      precip_in: pick(d.precipitation_sum, i),
      snowfall_in: pick(d.snowfall_sum, i),
      wmo: pick(d.weathercode, i),
      wind_mph: pick(d.windspeed_10m_max, i),
    };
  }
  return byDate;
}

async function main() {
  const letters = await readJson("letters.json");
  const places = Object.fromEntries((await readJson("places.json")).map(p => [p.key, p]));

  // Group letters by place.
  const groups = new Map();
  for (const l of letters) {
    if (!l.place) { console.warn(`  ${l.id}: no place — skipped`); continue; }
    if (!places[l.place]) { console.warn(`  ${l.id}: unknown place '${l.place}' — skipped`); continue; }
    if (!groups.has(l.place)) groups.set(l.place, []);
    groups.get(l.place).push(l);
  }
  const total = [...groups.values()].reduce((n, g) => n + g.length, 0);
  console.log(`Fetching weather for ${total} letters across ${groups.size} places from Open-Meteo …`);

  const results = {};
  for (const [key, group] of groups) {
    const place = places[key];
    const dates = [...new Set(group.map(l => l.date))].sort();
    try {
      let byDate = await fetchPlace(place, dates);
      // ERA5 covers ocean grid points; the default best_match model can come
      // back empty offshore. Retry once, pinned to era5.
      const allNull = dates.every(dt => !byDate[dt] || byDate[dt].tmax_f == null);
      if (allNull && place.kind !== "shore") {
        console.log(`  ${key}: empty from best_match — retrying with era5`);
        byDate = await fetchPlace(place, dates, { forceEra5: true });
      }
      for (const l of group) {
        const w = byDate[l.date];
        if (!w) {
          results[l.id] = { id: l.id, date: l.date, location: key, error: "date missing from archive response" };
          continue;
        }
        results[l.id] = { id: l.id, date: l.date, location: key, ...w };
        if (place.approx) results[l.id].approx = true;
      }
      const ok = group.filter(l => results[l.id] && !results[l.id].error).length;
      console.log(`  ${key.padEnd(22)} ${String(ok).padStart(3)}/${group.length} letters  (${dates[0]} → ${dates[dates.length - 1]})${place.approx ? "  ~approx" : ""}`);
      await new Promise(r => setTimeout(r, 120));  // be polite
    } catch (e) {
      console.error(`  ${key} FAILED:`, e.message);
      for (const l of group) {
        results[l.id] = { id: l.id, date: l.date, location: key, error: String(e.message) };
      }
    }
  }

  const successCount = Object.values(results).filter(r => !r.error).length;
  if (successCount === 0) {
    console.error(`\nNo successful fetches — refusing to write weather.js. Check your network.`);
    process.exit(1);
  }
  const out = `/* Generated by scripts/fetch_weather.mjs — do not edit by hand. */
window.LETTER_WEATHER = ${JSON.stringify(results, null, 2)};
`;
  const outPath = path.join(ROOT, "weather.js");
  await fs.writeFile(outPath, out);
  console.log(`\nWrote ${outPath}  (${successCount}/${total} succeeded)`);
}

main().catch(e => { console.error(e); process.exit(1); });
