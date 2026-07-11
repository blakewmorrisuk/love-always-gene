/* global React, ReactDOM, ReactDOMClient, FramerMotion, LETTERS, CHAPTERS */
const { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } = React;
const { createPortal } = ReactDOM;
const { createRoot } = ReactDOMClient;
const { motion, AnimatePresence, useReducedMotion } = FramerMotion;

// Cache-bust photo assets by the app version so re-cropped/rotated images are
// re-fetched rather than served stale from the browser cache.
const ASSET_V = "?v=" + (window.__APP_VERSION || "1");

// Scan filenames for a letter, in reading order. Generated into letters.js by
// scripts/build_letters.py from the files actually present in the letter's
// folder (names vary: _p1, _envelope, _card_front, ...). Letter scans are
// deliberately NOT version-tokened: they never change in place, and tokening
// them would force re-downloads of very large files on every release.
const letterImages = (letter) => letter.images || [];

/* Focus the given ref on mount and put focus back where it was on unmount —
   the minimal accessible-dialog behavior for the site's overlays. */
function useDialogFocus(closeRef) {
  useEffect(() => {
    const prev = document.activeElement;
    if (closeRef.current) closeRef.current.focus();
    return () => { if (prev && typeof prev.focus === "function") prev.focus(); };
  }, [closeRef]);
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function groupByChapter(letters, chapters) {
  const byKey = {};
  for (const c of chapters) byKey[c.key] = [];
  for (const l of letters) {
    if (byKey[l.location_chapter]) byKey[l.location_chapter].push(l);
  }
  for (const k in byKey) byKey[k].sort((a, b) => a.date.localeCompare(b.date));
  return byKey;
}

function dateRange(letters) {
  if (!letters.length) return "";
  const first = letters[0].date_label;
  const last = letters[letters.length - 1].date_label;
  return first === last ? first : `${first} to ${last}`;
}

const PEARL_HARBOR = new Date("1941-12-07T00:00:00Z");
// Returns { days, label } or null. label is the small-caps phrase to render.
// Negative deltas (letter date < Dec 7, 1941) become "X days before"; positive
// deltas (after) become "X days after"; the day itself is its own marker.
function pearlHarborMarker(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  if (isNaN(d)) return null;
  const days = Math.round((d - PEARL_HARBOR) / 86400000);
  if (days < 0)  return { days: -days, label: `${(-days).toLocaleString()} days before Pearl Harbor` };
  if (days > 0)  return { days, label: `${days.toLocaleString()} days after Pearl Harbor` };
  return { days: 0, label: "the morning of Pearl Harbor" };
}

function buildPages(letters, chapters, cast, photos) {
  const grouped = groupByChapter(letters, chapters);
  const pages = [{ type: "title" }];
  // The Map page — the journey chart, between the title page and
  // Chapter I. (This shifts every #p=N deep link by one; parseHashIdx
  // clamps, and the TOC/progress bar derive from `pages`.)
  pages.push({ type: "journey" });
  for (const c of chapters) {
    const ls = grouped[c.key];
    if (!ls || !ls.length) continue;
    pages.push({ type: "chapter", chapter: c, letters: ls });
    for (const l of ls) {
      pages.push({ type: "letter", letter: l, chapter: c });
    }
  }
  // Cast of Characters — one intro page, then the photo gallery, then one
  // page per non-empty group. Lives between the last letter and the closing.
  // `cast` is window.CAST and `photos` is window.PHOTOS (both generated).
  const galleries = (photos && Array.isArray(photos.galleries)) ? photos.galleries : [];
  if (cast && Array.isArray(cast.people) && cast.people.length) {
    pages.push({ type: "cast-intro", cast });
    for (const gal of galleries) pages.push({ type: "gallery", gallery: gal });
    for (const g of cast.groups) {
      const members = cast.people.filter(p => p.group === g.key);
      if (members.length) pages.push({ type: "cast-group", group: g, people: members });
    }
  } else {
    for (const gal of galleries) pages.push({ type: "gallery", gallery: gal });
  }
  pages.push({ type: "closing" });
  return pages;
}

function parseHashIdx(maxIdx) {
  const m = window.location.hash.match(/p=(\d+)/);
  if (!m) return 0;
  const i = parseInt(m[1], 10);
  if (isNaN(i) || i < 0 || i > maxIdx) return 0;
  return i;
}

/* ------------------------------------------------------------------ */
/*  Journey — gazetteer, projection, route derivation                  */
/* ------------------------------------------------------------------ */

/* places.json rides into letters.js as window.PLACES (keyed by place key);
   map.js carries window.MAP_BASE, the pre-projected Natural Earth chart.
   Both are optional — without them the journey map quietly doesn't render. */
const PLACES = window.PLACES || {};
const MAP_BASE = window.MAP_BASE || null;

/* Project lat/lon into the base chart's pixel space. The chart is
   Pacific-centered: longitudes west of its left edge wrap +360. */
function projectLL(lat, lon, base) {
  const L = lon >= base.lon0 ? lon : lon + 360;
  return [
    ((L - base.lon0) / (base.lon1 - base.lon0)) * base.w,
    ((base.lat1 - lat) / (base.lat1 - base.lat0)) * base.h,
  ];
}

/* Derive the journey from the letters themselves: sort by date, join each
   letter's `place` key to the gazetteer, skip places marked route:false
   (mail that isn't a leg of Gene's journey — the gunnery-cycle "at sea"
   letters, the card that isn't from Gene), collapse consecutive repeats.

   Returns { stops, legs, pins }:
     stops — chronological visits (a place can appear more than once)
     legs  — consecutive stop pairs; approx when either end is a position
             reconstructed from the ship's record rather than the mail
     pins  — one entry per distinct place, numbered by first visit, with
             all its letters and full date span (drives pins + legend)   */
function buildJourney(letters, places) {
  const sorted = [...letters].sort((a, b) =>
    a.date === b.date ? (a.n || 0) - (b.n || 0) : a.date.localeCompare(b.date));
  const stops = [];
  for (const l of sorted) {
    const place = places[l.place];
    if (!place || place.route === false) continue;
    const last = stops[stops.length - 1];
    if (last && last.key === l.place) {
      last.letters.push(l);
      last.lastDate = l.date;
    } else {
      stops.push({ key: l.place, place, letters: [l], firstDate: l.date, lastDate: l.date });
    }
  }
  const legs = [];
  for (let i = 1; i < stops.length; i++) {
    legs.push({
      from: stops[i - 1],
      to: stops[i],
      approx: !!(stops[i - 1].place.approx || stops[i].place.approx),
    });
  }
  const pins = [];
  const byKey = {};
  for (const s of stops) {
    let p = byKey[s.key];
    if (!p) {
      p = byKey[s.key] = {
        key: s.key, place: s.place, n: pins.length + 1,
        letters: [], firstDate: s.firstDate, lastDate: s.lastDate,
      };
      pins.push(p);
    }
    p.letters.push(...s.letters);
    if (s.lastDate > p.lastDate) p.lastDate = s.lastDate;
  }
  return { stops, legs, pins };
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthYear(dateStr) {
  const m = dateStr.match(/(\d{4})-(\d{2})/);
  return m ? `${MONTHS_SHORT[parseInt(m[2], 10) - 1]} ${m[1]}` : dateStr;
}
function pinDateSpan(pin) {
  const a = monthYear(pin.firstDate), b = monthYear(pin.lastDate);
  return a === b ? a : `${a} – ${b}`;
}

/* ------------------------------------------------------------------ */
/*  Atmosphere — chapter-keyed ambient motion                          */
/* ------------------------------------------------------------------ */

/* Map an Open-Meteo / WMO weathercode to one of our atmosphere kinds.
   Reference: https://open-meteo.com/en/docs (Weather variable codes). */
function weatherKind(w) {
  if (!w || w.wmo == null) return null;
  const c = w.wmo;
  if (c === 0)                                           return "clear";
  if ([1, 2, 3].includes(c))                             return "clouds";
  if ([45, 48].includes(c))                              return "fog";
  if ([51, 53, 55, 56, 57].includes(c))                  return "drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(c))      return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(c))              return "snow";
  if ([95, 96, 99].includes(c))                          return "storm";
  return "clouds";
}

/* Friendly label for a kind. */
function weatherLabel(kind) {
  return ({
    clear: "Clear",
    clouds: "Cloudy",
    fog: "Fog",
    drizzle: "Drizzle",
    rain: "Rain",
    snow: "Snow",
    storm: "Thunderstorm",
  })[kind] || "";
}

/* Tiny SVG glyph per kind. */
function WeatherIcon({ kind }) {
  switch (kind) {
    case "clear":   return (<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><line x1="12" y1="3" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="21"/><line x1="3" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="21" y2="12"/><line x1="5.6" y1="5.6" x2="7" y2="7"/><line x1="17" y1="17" x2="18.4" y2="18.4"/><line x1="5.6" y1="18.4" x2="7" y2="17"/><line x1="17" y1="7" x2="18.4" y2="5.6"/></svg>);
    case "clouds":  return (<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 16h11a3 3 0 0 0 0-6 5 5 0 0 0-9.6-1.5A4 4 0 0 0 7 16Z"/></svg>);
    case "fog":     return (<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="9" x2="20" y2="9"/><line x1="3" y1="13" x2="19" y2="13"/><line x1="5" y1="17" x2="21" y2="17"/></svg>);
    case "drizzle":
    case "rain":    return (<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14h11a3 3 0 0 0 0-6 5 5 0 0 0-9.6-1.5A4 4 0 0 0 7 14Z"/><line x1="9" y1="17" x2="8" y2="20"/><line x1="13" y1="17" x2="12" y2="20"/><line x1="17" y1="17" x2="16" y2="20"/></svg>);
    case "snow":    return (<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="4" x2="12" y2="20"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="6.5" y1="6.5" x2="17.5" y2="17.5"/><line x1="6.5" y1="17.5" x2="17.5" y2="6.5"/></svg>);
    case "storm":   return (<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14h11a3 3 0 0 0 0-6 5 5 0 0 0-9.6-1.5A4 4 0 0 0 7 14Z"/><polyline points="13 14 10 19 13 19 11 22"/></svg>);
    default:        return null;
  }
}

function WeatherGlyph({ weather }) {
  const kind = weatherKind(weather);
  if (!kind || !weather) return null;
  const t = weather.tmax_f != null ? `${Math.round(weather.tmax_f)}°` : "";
  // approx: the letter was censored at sea, so this is the day's weather at
  // the ship's position as reconstructed from her record — mark it honestly.
  const approx = !!weather.approx;
  const approxNote = "reconstructed from the ship's estimated position";
  return (
    <div
      className={"weather-glyph" + (approx ? " weather-glyph--approx" : "")}
      aria-label={`Weather: ${weatherLabel(kind)}${t ? ", high " + t : ""}${approx ? ` (${approxNote})` : ""}`}
      title={approx ? approxNote : undefined}
    >
      <WeatherIcon kind={kind} />
      <span>{weatherLabel(kind)}</span>
      {t && <span className="wg-temp">{approx ? `≈ ${t}` : t}</span>}
    </div>
  );
}

function Atmosphere({ chapterKey, weather, on }) {
  // Per-letter weather wins; otherwise fall back to chapter atmosphere.
  const kind = weather ? weatherKind(weather) : null;

  const snow = useMemo(() => Array.from({ length: 40 }, () => ({
    size: 2 + Math.random() * 4, left: Math.random() * 100,
    delay: -Math.random() * 18, dur: 14 + Math.random() * 12,
    drift: (Math.random() - 0.5) * 80, op: 0.35 + Math.random() * 0.4,
  })), []);

  const rain = useMemo(() => Array.from({ length: 80 }, () => ({
    left: Math.random() * 100, delay: -Math.random() * 1.2,
    dur: 0.55 + Math.random() * 0.5, len: 60 + Math.random() * 40,
    op: 0.35 + Math.random() * 0.35,
  })), []);

  const drizzle = useMemo(() => Array.from({ length: 40 }, () => ({
    left: Math.random() * 100, delay: -Math.random() * 2.4,
    dur: 1.4 + Math.random() * 0.8, len: 28 + Math.random() * 24,
    op: 0.22 + Math.random() * 0.2,
  })), []);

  const clouds = useMemo(() => Array.from({ length: 5 }, () => ({
    size: 240 + Math.random() * 360,
    top: -20 + Math.random() * 90,
    delay: -Math.random() * 90,
    dur: 90 + Math.random() * 80,
    op: 0.35 + Math.random() * 0.35,
  })), []);

  const dust = useMemo(() => Array.from({ length: 28 }, () => ({
    size: 2 + Math.random() * 5, left: 5 + Math.random() * 90,
    top: 30 + Math.random() * 50, delay: -Math.random() * 22,
    dur: 18 + Math.random() * 16, dx: (Math.random() - 0.5) * 220,
    dy: -120 - Math.random() * 200, op: 0.25 + Math.random() * 0.35,
  })), []);

  const rays = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    left: 8 + i * 14 + Math.random() * 6,
    delay: -Math.random() * 9,
    rot: -8 + Math.random() * 16,
  })), []);

  const stars = useMemo(() => Array.from({ length: 60 }, () => ({
    left: Math.random() * 100,
    top: Math.random() * 65,
    delay: -Math.random() * 4,
    dur: 3 + Math.random() * 3,
  })), []);

  if (!on) return null;

  // Render based on per-letter weather first
  // Chapter IV (At War) divider — no animated atmosphere. The deep red
  // background (body--war class on the body element) carries the mood
  // on its own. Letters within the chapter still get their per-day
  // weather animation as normal (kind is set when a letter has weather).
  if (chapterKey === "at-war" && !kind) return null;

  if (kind === "rain" || kind === "storm") {
    return (
      <div className="atmosphere atmosphere--on" aria-hidden="true">
        <div className="rain-mist" />
        {kind === "storm" && <div className="lightning-flash" />}
        {rain.map((r, i) => (
          <span key={i} className="rain-streak" style={{
            left: `${r.left}%`,
            height: `${r.len}px`,
            animationDelay: `${r.delay}s`,
            animationDuration: `${r.dur}s`,
            "--rain-op": r.op,
          }} />
        ))}
      </div>
    );
  }

  if (kind === "drizzle") {
    return (
      <div className="atmosphere atmosphere--on" aria-hidden="true">
        <div className="rain-mist" style={{ opacity: 0.6 }} />
        {drizzle.map((r, i) => (
          <span key={i} className="rain-streak" style={{
            left: `${r.left}%`,
            height: `${r.len}px`,
            animationDelay: `${r.delay}s`,
            animationDuration: `${r.dur}s`,
            "--rain-op": r.op,
          }} />
        ))}
      </div>
    );
  }

  if (kind === "snow") {
    return (
      <div className="atmosphere atmosphere--on" aria-hidden="true">
        {snow.map((s, i) => (
          <span key={i} className="snow-flake" style={{
            width: `${s.size}px`, height: `${s.size}px`, left: `${s.left}%`,
            animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s`,
            "--snow-drift": `${s.drift}px`, "--snow-op": s.op,
          }} />
        ))}
      </div>
    );
  }

  if (kind === "fog") {
    return (
      <div className="atmosphere atmosphere--on" aria-hidden="true">
        <div className="fog-layer" />
        <div className="fog-layer f2" />
      </div>
    );
  }

  if (kind === "clouds") {
    return (
      <div className="atmosphere atmosphere--on" aria-hidden="true">
        {clouds.map((c, i) => (
          <span key={i} className="cloud-shape" style={{
            width: `${c.size}px`, height: `${c.size * 0.45}px`,
            top: `${c.top}%`,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.dur}s`,
            "--cloud-op": c.op,
          }} />
        ))}
      </div>
    );
  }

  if (kind === "clear") {
    return (
      <div className="atmosphere atmosphere--on" aria-hidden="true">
        <div className="sun-glow" />
        {rays.map((r, i) => (
          <span key={i} className="sun-ray" style={{
            left: `${r.left}%`,
            transform: `rotate(${r.rot}deg)`,
            animationDelay: `${r.delay}s`,
          }} />
        ))}
        {dust.slice(0, 14).map((d, i) => (
          <span key={`d${i}`} className="dust-mote" style={{
            width: `${d.size}px`, height: `${d.size}px`,
            left: `${d.left}%`, top: `${d.top}%`,
            animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s`,
            "--dust-x": `${d.dx}px`, "--dust-y": `${d.dy}px`,
            "--dust-op": d.op,
          }} />
        ))}
      </div>
    );
  }

  // Fallbacks: chapter-default atmosphere when there's no weather record (e.g.
  // chapter divider pages, or weather.js not generated yet).
  if (chapterKey === "great-lakes") {
    return (
      <div className="atmosphere atmosphere--on" aria-hidden="true">
        {clouds.map((c, i) => (
          <span key={i} className="cloud-shape" style={{
            width: `${c.size}px`, height: `${c.size * 0.45}px`,
            top: `${c.top}%`,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.dur}s`,
            "--cloud-op": c.op,
          }} />
        ))}
      </div>
    );
  }

  if (chapterKey === "san-diego") {
    return (
      <div className="atmosphere atmosphere--on" aria-hidden="true">
        {dust.map((d, i) => (
          <span key={i} className="dust-mote" style={{
            width: `${d.size}px`, height: `${d.size}px`,
            left: `${d.left}%`, top: `${d.top}%`,
            animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s`,
            "--dust-x": `${d.dx}px`, "--dust-y": `${d.dy}px`,
            "--dust-op": d.op,
          }} />
        ))}
      </div>
    );
  }

  if (chapterKey === "pearl-harbor") {
    return (
      <div className="atmosphere atmosphere--on" aria-hidden="true">
        <div className="sea-layer" />
        <div className="sea-vignette" />
        <div className="sea-shimmer" />
        <div className="sea-shimmer s2" />
        <div className="sea-shimmer s3" />
      </div>
    );
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Route diagram                                                      */
/* ------------------------------------------------------------------ */

function RouteDiagram({ activeChapter, chapters, letters }) {
  const grouped = useMemo(() => groupByChapter(letters, chapters), [letters, chapters]);
  const usedKeys = new Set(letters.map(l => l.location_chapter));
  // A chapter only becomes a route stop if it has letters AND defines a
  // `map` field. Chapters like "at-war" share Pearl Harbor's geography
  // and intentionally omit `map`, so they don't double-pin the diagram.
  const stops = chapters.filter(c => usedKeys.has(c.key) && c.map);
  // Resolve mapPin redirection: a chapter without its own map can declare
  // which existing pin to highlight when it's the active chapter.
  const activeDef = chapters.find(c => c.key === activeChapter);
  const effectiveActive = (activeDef && activeDef.mapPin) || activeChapter;
  if (stops.length === 0) return null;

  const x0 = 80, x1 = 720, yMid = 90;
  const positions = stops.map((s, i) => {
    const x = stops.length === 1
      ? (x0 + x1) / 2
      : x0 + ((i + 0.5) / stops.length) * (x1 - x0);
    return { ...s, x, y: yMid };
  });

  return (
    <div className="route-wrap" aria-hidden="true">
      <svg viewBox="0 0 800 200" className="route-svg" preserveAspectRatio="xMidYMid meet">
        <line x1={x0} y1={yMid} x2={x1} y2={yMid} className="route-line" />
        {positions.map(p => {
          const isActive = p.key === effectiveActive;
          const ls = grouped[p.key] || [];
          const dr = dateRange(ls);
          const label = (p.map && p.map.label) || p.location_label || p.title;
          return (
            <g key={p.key}>
              {isActive && (
                <circle cx={p.x} cy={p.y} r="11" className="route-pin-active-halo" />
              )}
              <circle cx={p.x} cy={p.y} r={isActive ? 6 : 5}
                className={isActive ? "route-pin-active" : "route-pin-inactive"} />
              {isActive && (
                <line x1={p.x - 22} y1={p.y - 28} x2={p.x + 22} y2={p.y - 28} className="route-label-rule" />
              )}
              <text x={p.x} y={p.y - 38} textAnchor="middle"
                className={isActive ? "route-label route-label--active" : "route-label"}>
                {label}
              </text>
              <text x={p.x} y={p.y + 30} textAnchor="middle" className="route-date">{dr}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Journey map — real geography (frontispiece + per-letter waypoint)  */
/* ------------------------------------------------------------------ */

/* Hand-tuned label placement for the full chart. Geography clusters the
   California ports (and Chicago against Great Lakes), so a few labels fan
   out, with a hairline leader where the label sits away from its pin.
   `text` is the short chart name; the gazetteer's full label lives in the
   legend and tooltips. */
const MAP_LABELS = {
  "great-lakes":           { text: "Great Lakes",   dx: -9,  dy: -5,  anchor: "end", num: { dx: 0, dy: -9, anchor: "middle" } },
  "chicago":               { text: "Chicago",       dx: 9,   dy: 13,  anchor: "start", num: { dx: -9, dy: 7, anchor: "end" } },
  "el-paso":               { text: "El Paso",       dx: 8,   dy: 11,  anchor: "start" },
  "san-diego":             { text: "San Diego",     dx: -11, dy: 16,  anchor: "end", leader: true, num: { dx: 7, dy: 3, anchor: "start" } },
  "pearl-harbor":          { text: "Pearl Harbor",  dx: -2,  dy: -12, anchor: "middle" },
  "bremerton":             { text: "Bremerton",     dx: 10,  dy: -2,  anchor: "start" },
  "long-beach":            { text: "Long Beach",    dx: -11, dy: 5,   anchor: "end", leader: true, num: { dx: 0, dy: -8, anchor: "middle" } },
  "mare-island":           { text: "Mare Island",   dx: 11,  dy: -7,  anchor: "start", leader: true, num: { dx: 8, dy: -4, anchor: "start" } },
  "san-francisco":         { text: "San Francisco", dx: -11, dy: 12,  anchor: "end", leader: true, num: { dx: 7, dy: 4, anchor: "start" } },
  "wake-relief":           { text: "Wake sortie",   dx: 0,   dy: -11, anchor: "middle" },
  "coral-sea":             { text: "Coral Sea",     dx: -9,  dy: 5,   anchor: "end" },
  "south-pacific-transit": { text: "South Pacific", dx: 10,  dy: 5,   anchor: "start" },
  "solomons-area":         { text: "The Solomons",  dx: 10,  dy: 9,   anchor: "start" },
  "tulagi":                { text: "Tulagi",        dx: -8,  dy: -5,  anchor: "end" },
  "sydney":                { text: "Sydney",        dx: -10, dy: 7,   anchor: "end" },
  "kentucky":              { text: "Home",          dx: 0,   dy: 16,  anchor: "middle", num: { dx: -10, dy: 4, anchor: "end" } },
  "montgomery-wv":         { text: "Montgomery",    dx: 9,   dy: -4,  anchor: "start" },
};

/* A gently bowed course line between two stops — bows northward so the
   long Pacific legs read like a chart's plotted track, not a chord. */
function legPath(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(len * 0.1, 40);
  let px = -dy / len, py = dx / len;
  if (py > 0) { px = -px; py = -py; }
  const cx = x1 + dx / 2 + px * bow;
  const cy = y1 + dy / 2 + py * bow;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function starPath(x, y, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}

function CompassRose({ x, y }) {
  return (
    <g className="mc-rose" transform={`translate(${x} ${y})`} aria-hidden="true">
      <circle r="26" className="mc-rose-ring" />
      <circle r="19" className="mc-rose-ring mc-rose-ring--inner" />
      {[0, 45, 90, 135].map((a) => (
        <line key={a} x1="0" y1="-24" x2="0" y2="24" transform={`rotate(${a})`}
          className={"mc-rose-line" + (a % 90 === 0 ? "" : " mc-rose-line--minor")} />
      ))}
      <path d="M 0 -24 L 3.6 -7 L 0 -10.5 L -3.6 -7 Z" className="mc-rose-north" />
      <text y="-31" textAnchor="middle" className="mc-rose-n">N</text>
    </g>
  );
}

/* MapChart — the journey drawn on the Natural Earth base chart.
   mode "full"  — the frontispiece: labels, graticule figures, compass
                  rose, censored-leg annotation, draw-on animation,
                  clickable pins (onSelectStop).
   mode "mini"  — the waypoint map under a letter: static, unlabeled,
                  clipped to the route travelled so far (visibleThrough),
                  with the letter's own place pulsing (activePlace).     */
function MapChart({ journey, mode, activePlace, visibleThrough, onSelectStop }) {
  const reduced = useReducedMotion();
  const base = MAP_BASE;
  const full = mode === "full";
  if (!base || !journey || !journey.stops.length) return null;

  const xy = (place) => projectLL(place.lat, place.lon, base);
  const cutoff = visibleThrough || "9999-12-31";
  const legs = journey.legs.filter((l) => l.to.firstDate <= cutoff);
  const pins = journey.pins.filter((p) => p.firstDate <= cutoff);

  // A letter written somewhere off the route (the gunnery-cycle "at sea"
  // letters, the card that isn't from Gene) still pins its own map.
  const extraPin = activePlace && PLACES[activePlace] && !pins.some((p) => p.key === activePlace)
    ? { key: activePlace, place: PLACES[activePlace], letters: [], n: null }
    : null;

  const lonLines = [];
  for (let lon = 120; lon < base.lon1; lon += 20) {
    lonLines.push(((lon - base.lon0) / (base.lon1 - base.lon0)) * base.w);
  }
  const latLines = [];
  for (let lat = -40; lat <= 40; lat += 20) {
    latLines.push({ y: ((base.lat1 - lat) / (base.lat1 - base.lat0)) * base.h, eq: lat === 0 });
  }

  const animate = full && !reduced;
  const legDelay = (i) => 0.45 + i * 0.09;

  const renderPin = (p, isActive) => {
    const [x, y] = xy(p.place);
    const kind = p.place.kind;
    const cls = "mc-pin"
      + (p.place.approx ? " mc-pin--approx" : "")
      + (kind === "home" ? " mc-pin--home" : "")
      + (isActive ? " mc-pin--active" : "");
    const label = full ? MAP_LABELS[p.key] : null;
    const count = p.letters.length;
    const tip = `${p.place.label}${count ? ` · ${pinDateSpan(p)} · ${count === 1 ? "1 letter" : `${count} letters`}` : ""}`;
    const inboundIdx = legs.findIndex((l) => l.to.key === p.key);
    const delay = inboundIdx >= 0 ? legDelay(inboundIdx) + 0.35 : 0.3;
    const G = animate ? motion.g : "g";
    const gProps = animate
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay, duration: 0.4 } }
      : {};
    return (
      <G key={p.key} {...gProps}
        className={"mc-stop" + (full && onSelectStop ? " mc-stop--link" : "")}
        onClick={full && onSelectStop ? () => onSelectStop(p.key) : undefined}
      >
        <title>{tip}</title>
        {isActive && <circle cx={x} cy={y} r="11" className="route-pin-active-halo" />}
        {kind === "home"
          ? <path d={starPath(x, y, 6.5)} className={cls} />
          : <circle cx={x} cy={y} r={isActive ? 5 : 4.2} className={cls} />}
        {full && p.n != null && (() => {
          // Number sits opposite the label so neither collides; the
          // clustered pins carry explicit overrides in MAP_LABELS.
          const np = (label && label.num)
            || (!label ? { dx: 8, dy: -5, anchor: "start" }
              : label.anchor === "end" ? { dx: 7, dy: 3, anchor: "start" }
              : label.anchor === "start" ? { dx: -7, dy: 3, anchor: "end" }
              : label.dy < 0 ? { dx: 0, dy: 13, anchor: "middle" }
              : { dx: 0, dy: -8, anchor: "middle" });
          return (
            <text x={x + np.dx} y={y + np.dy} textAnchor={np.anchor} className="mc-pin-num">{p.n}</text>
          );
        })()}
        {label && (
          <>
            {label.leader && (
              <line x1={x + (label.anchor === "end" ? -3 : 3) * 1.6} y1={y + (label.dy > 0 ? 3 : -3)}
                x2={x + label.dx * 0.92} y2={y + label.dy - 3} className="mc-leader" />
            )}
            <text x={x + label.dx} y={y + label.dy} textAnchor={label.anchor} className="mc-label">
              {label.text}
            </text>
          </>
        )}
      </G>
    );
  };

  return (
    <svg viewBox={`0 0 ${base.w} ${base.h}`} className={"mc-svg" + (full ? " mc-svg--full" : " mc-svg--mini")}
      preserveAspectRatio="xMidYMid meet" role={full ? "img" : undefined}
      aria-label={full ? "Chart of the Pacific tracing Gene's journey, 1940 to 1944" : undefined}
      aria-hidden={full ? undefined : true}
    >
      <g className="mc-graticule" aria-hidden="true">
        {lonLines.map((x, i) => <line key={`lon${i}`} x1={x} y1="0" x2={x} y2={base.h} />)}
        {latLines.map((l, i) => (
          <line key={`lat${i}`} x1="0" y1={l.y} x2={base.w} y2={l.y}
            className={l.eq ? "mc-grat-eq" : undefined} />
        ))}
      </g>
      <g aria-hidden="true">
        {base.land.map((d, i) => <path key={i} d={d} className="mc-land" />)}
        {base.lakes.map((d, i) => <path key={`lk${i}`} d={d} className="mc-lake" />)}
      </g>
      {full && (
        <rect x="0.5" y="0.5" width={base.w - 1} height={base.h - 1} className="mc-neatline" aria-hidden="true" />
      )}
      {full && <CompassRose x={615} y={478} />}
      <g aria-hidden="true">
        {legs.map((leg, i) => {
          const [x1, y1] = xy(leg.from.place);
          const [x2, y2] = xy(leg.to.place);
          const d = legPath(x1, y1, x2, y2);
          const cls = "mc-leg" + (leg.approx ? " mc-leg--approx" : "");
          if (!animate) return <path key={i} d={d} className={cls} />;
          // pathLength animation owns stroke-dasharray, so dashed (approx)
          // legs fade in instead of drawing on.
          return leg.approx ? (
            <motion.path key={i} d={d} className={cls}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: legDelay(i), duration: 0.55 }} />
          ) : (
            <motion.path key={i} d={d} className={cls}
              initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: legDelay(i), duration: 0.55, ease: "easeInOut" }} />
          );
        })}
      </g>
      {pins.map((p) => renderPin(p, p.key === activePlace))}
      {extraPin && renderPin(extraPin, true)}
      {full && (
        <g className="mc-censored" aria-hidden="true" transform="rotate(-4 330 442)">
          <text x="330" y="442">positions censored</text>
          <text x="330" y="461" className="mc-censored-sub">reconstructed from the ship's record</text>
        </g>
      )}
    </svg>
  );
}

/* JourneyPage — the Map page: the full chart, then a numbered legend
   (the accessible tap targets, one per stop) that jumps into the letters. */
function JourneyPage({ journey, onSelectStop, focusPlace }) {
  return (
    <section className="journey-page">
      <h2 className="journey-title">Map</h2>
      <div className="journey-dates">Great Lakes to the Solomon Islands, and home · 1940 – 1944</div>
      <div className="hairline-rule" />
      <div className="journey-chart">
        <MapChart journey={journey} mode="full" activePlace={focusPlace} onSelectStop={onSelectStop} />
      </div>
      <ol className="journey-legend">
        {journey.pins.map((p) => (
          <li key={p.key}>
            <button
              className={"journey-stop" + (focusPlace === p.key ? " is-focus" : "")}
              onClick={() => onSelectStop(p.key)}
            >
              <span className="js-num">{p.n}</span>
              <span className="js-meta">
                <span className="js-label">{p.place.label}</span>
                <span className="js-dates">
                  {pinDateSpan(p)} · {p.letters.length === 1 ? "1 letter" : `${p.letters.length} letters`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="journey-note-plain">
        Please note that dotted lines and open points reflect places where
        the Naval Censor prohibited sailors from indicating their wartime
        locations. Therefore, these paths and points are reconstructed from
        the ship's record and not from the letters themselves.
      </p>
      <p className="journey-note">
        As with everything here, this is a passion project by a grandson
        studying for the bar, and it is subject to change as it is made
        more accurate.
      </p>
      <p className="journey-signoff">
        Kind regards,<br />Blake William Morris
      </p>
    </section>
  );
}

/* LetterWaypoint — the small waypoint map under each letter: the route
   travelled so far, with this letter's place pulsing. Tapping it opens
   the frontispiece chart focused on that stop. */
function LetterWaypoint({ letter, journey, onOpenJourney }) {
  const place = PLACES[letter.place];
  if (!MAP_BASE || !place || !journey || !journey.stops.length) return null;
  const approx = !!place.approx;
  return (
    <div className="letter-waypoint">
      <button
        className="letter-waypoint-map"
        onClick={() => onOpenJourney(letter.place)}
        aria-label={`The journey so far. This letter was written from ${place.label}${approx ? " (position reconstructed)" : ""}. Open the full journey map.`}
      >
        <MapChart journey={journey} mode="mini" activePlace={letter.place} visibleThrough={letter.date} />
      </button>
      <div className="letter-waypoint-caption">
        <span className="lw-place">{place.label}</span>
        {approx && <span className="lw-approx">position reconstructed</span>}
        <span className="lw-link" aria-hidden="true">the journey so far · tap for the full map</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Lightbox                                                           */
/* ------------------------------------------------------------------ */

function Lightbox({ letter, page, onClose, onNav }) {
  const closeRef = useRef(null);
  useDialogFocus(closeRef);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onNav(1);
      else if (e.key === "ArrowLeft") onNav(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onNav]);

  if (!letter) return null;
  const imgs = letterImages(letter);
  const total = imgs.length;
  const k = page;
  // Display the smaller _web derivative when it exists; the "full
  // resolution" link always opens the untouched original scan.
  const webs = letter.images_web || imgs;
  const src = `${letter.folder}/${webs[k - 1]}`;
  const fullSrc = `${letter.folder}/${imgs[k - 1]}`;
  const alt = `Original handwritten letter, page ${k} of ${total}, dated ${letter.date_label}`;

  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="lb-close" ref={closeRef} onClick={onClose} aria-label="Close">×</button>
      <div className="lb-stage" onClick={(e) => e.stopPropagation()}>
        <div className="lb-frame">
          <img src={src} alt={alt} />
        </div>
        <div className="lb-meta">
          <span className="lb-meta-date">{letter.date_label}</span>
          <a className="lb-full" href={fullSrc} target="_blank" rel="noopener noreferrer">full resolution</a>
          <span className="lb-counter">{String(k).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        </div>
      </div>
      {total > 1 && (
        <>
          <button className="lb-nav lb-prev" onClick={(e) => { e.stopPropagation(); onNav(-1); }} aria-label="Previous page">‹</button>
          <button className="lb-nav lb-next" onClick={(e) => { e.stopPropagation(); onNav(1); }} aria-label="Next page">›</button>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Letter card variants                                               */
/* ------------------------------------------------------------------ */

function Postmark({ letter }) {
  const place = ({
    "great-lakes": "GREAT LAKES",
    "san-diego":   "SAN DIEGO",
    "pearl-harbor": "PEARL HARBOR",
  })[letter.location_chapter] || "U.S. NAVY";
  const m = letter.date.match(/(\d{4})-(\d{2})-(\d{2})/);
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const monthAbbr = m ? months[parseInt(m[2], 10) - 1] : "";
  const day = m ? parseInt(m[3], 10) : "";
  const year = m ? m[1] : "";
  // textPath needs a unique id per stamp so multiple cards can render in
  // the same DOM (e.g. when navigating). Use the letter id.
  const arcTopId = `pm-arc-top-${letter.id}`;
  const arcBotId = `pm-arc-bot-${letter.id}`;
  return (
    <svg className="postmark" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        {/* Inset arc paths — radius 27/29 keep all letter tops inside the
            inner ring (r=36). Earlier we used r=32 and capitals crossed
            the ring. */}
        <path id={arcTopId} d="M 23 50 a 27 27 0 0 1 54 0" fill="none" />
        <path id={arcBotId} d="M 21 50 a 29 29 0 0 0 58 0" fill="none" />
      </defs>
      <circle cx="50" cy="50" r="44" className="pm-ring-outer" />
      <circle cx="50" cy="50" r="40" className="pm-ring-mid" />
      <circle cx="50" cy="50" r="36" className="pm-ring-inner" />
      {/* Cancellation marks — short hairlines crossing the rings at L/R. */}
      <line x1="0"  y1="50" x2="14" y2="50" className="pm-cancel" />
      <line x1="86" y1="50" x2="100" y2="50" className="pm-cancel" />
      {/* Place name arched along the top. */}
      <text className="pm-arc-text" fontSize="6.4">
        <textPath href={`#${arcTopId}`} startOffset="50%" textAnchor="middle">
          {place}
        </textPath>
      </text>
      {/* Date stack in the middle: italic month over big italic day. */}
      <text x="50" y="49" textAnchor="middle" className="pm-month">{monthAbbr}</text>
      <text x="50" y="64" textAnchor="middle" className="pm-day">{day}</text>
      {/* Year + branch arched along the bottom curve. */}
      <text className="pm-arc-text" fontSize="5.6">
        <textPath href={`#${arcBotId}`} startOffset="50%" textAnchor="middle">
          {year}  ·  U.S. NAVY
        </textPath>
      </text>
    </svg>
  );
}

function LetterHeader({ letter }) {
  const weather = (window.LETTER_WEATHER && window.LETTER_WEATHER[letter.id]) || null;
  const ph = pearlHarborMarker(letter.date);
  return (
    <header className="letter-head">
      <div className="letter-num"><em>{letter.date_label}</em></div>
      <div className="letter-stamp">{letter.location_stamp}</div>
      {weather && !weather.error && <WeatherGlyph weather={weather} />}
      {ph && (
        <div className="letter-countdown" aria-label={ph.label}>
          {ph.label}
        </div>
      )}
      <Postmark letter={letter} />
    </header>
  );
}

function PhotoLink({ letter, onOpen }) {
  const n = letterImages(letter).length;
  return (
    <button className="photo-link" onClick={() => onOpen(letter, 1)}>
      see the original
      <span className="photo-link-meta">
        {n === 1 ? "1 page" : `${n} pages`}
      </span>
    </button>
  );
}

/* Small brass dingbat used as a section break between letter body and
   postscript, and between body and historical note. Inline SVG (not a
   Unicode glyph) so it renders the same across iOS/Android system
   fonts. The two hairlines are drawn by ::before/::after in CSS. */
function Fleuron() {
  return (
    <div className="fleuron" aria-hidden="true">
      <svg className="fleuron-glyph" viewBox="0 0 36 8" width="36" height="8">
        <circle cx="6" cy="4" r="1.1" fill="currentColor" opacity="0.8" />
        <path d="M 18 0.8 L 21.2 4 L 18 7.2 L 14.8 4 Z" fill="currentColor" />
        <circle cx="30" cy="4" r="1.1" fill="currentColor" opacity="0.8" />
      </svg>
    </div>
  );
}

/* Render a multi-paragraph note string. Splits on blank lines so each
   block lands as its own .letter-note <p> instead of a single wall of
   text. extraClass lets envelope/card variants attach their tint. */
function NoteBlock({ text, extraClass }) {
  if (!text) return null;
  const cls = "letter-note" + (extraClass ? ` ${extraClass}` : "");
  return text.split(/\n\n+/).map((para, i) => (
    <p key={i} className={cls}>{para}</p>
  ));
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/* NameMark — wraps a person's name when the reader jumped here from the cast.
   A red rectangle flashes around it on mount (CSS), then fades. */
function NameMark({ children }) {
  return <mark className="name-mark">{children}</mark>;
}

/* Render a paragraph string, splitting on [[...]] (emphasis) and
   [?]/[word?] (uncertain-reading) markers and wrapping each in the
   right component. Used by both transcribed and draft cards so the
   markers behave the same in either path. When `highlight` is supplied
   (a jump from a cast entry), the person's aliases are also split out
   and flashed via NameMark. */
function renderProse(text, highlight) {
  const terms = (highlight && Array.isArray(highlight.terms))
    ? highlight.terms.filter(t => t && t.trim().length > 1)
    : [];
  let splitRe;
  if (terms.length) {
    const alt = terms.slice().sort((a, b) => b.length - a.length).map(escapeRe).join("|");
    // \b bounds the names so "Jo" doesn't match inside "Joan"; the marker
    // alternatives are listed first so [[...]] spans win over names inside them.
    splitRe = new RegExp(`(\\[\\[[^\\]]+\\]\\]|\\[\\?\\]|\\[[^\\]]+\\?\\]|\\b(?:${alt})\\b)`, "g");
  } else {
    splitRe = /(\[\[[^\]]+\]\]|\[\?\]|\[[^\]]+\?\])/g;
  }
  const termSet = new Set(terms);
  return text.split(splitRe).map((part, i) => {
    if (!part) return null;
    const em = part.match(/^\[\[([^\]]+)\]\]$/);
    if (em) return <Emphasis key={i}>{em[1]}</Emphasis>;
    if (/^\[.*\?\]$/.test(part)) {
      const inner = part.replace(/^\[|\]$/g, "");
      return <sub key={i} className="uncertain" title="Uncertain reading">{inner}</sub>;
    }
    if (termSet.has(part)) {
      return <NameMark key={`${i}-${highlight.token}`}>{part}</NameMark>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/* Scroll the first flashed name into view when a highlight lands. Shared by
   the transcribed and draft cards. */
function useHighlightScroll(ref, highlight) {
  useEffect(() => {
    if (!highlight || !ref.current) return;
    const el = ref.current.querySelector(".name-mark");
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight && highlight.token]);
}

function TranscribedCard({ letter, onOpen, highlight }) {
  const paragraphs = letter.body.split(/\n\n+/);
  const hasNote = !!letter.note || letter.partial;
  const ref = useRef(null);
  useHighlightScroll(ref, highlight);
  return (
    <article ref={ref} className="letter-card" id={`letter-${letter.id}`} aria-label={`Letter, ${letter.date_label}`}>
      <LetterHeader letter={letter} />
      <div className="letter-body">
        <div className="salutation">{letter.salutation}</div>
        {paragraphs.map((para, i) => {
          if (i === 0 && /^[A-Za-z]/.test(para)) {
            return (
              <p key={i} className="has-dropcap">
                <span className="dropcap">{para.charAt(0)}</span>{renderProse(para.slice(1), highlight)}
              </p>
            );
          }
          return <p key={i}>{renderProse(para, highlight)}</p>;
        })}
        {letter.partial && <p className="incomplete-marker">[the letter continues]</p>}
        <div className="signature">{letter.signature}</div>
        {letter.postscript && <Fleuron />}
        {letter.postscript && (
          <p className="postscript"><span className="ps-mark">P.S.</span> {renderProse(letter.postscript, highlight)}</p>
        )}
      </div>
      {hasNote && <Fleuron />}
      <NoteBlock text={letter.note} />
      {letter.partial && <p className="letter-note">Transcription incomplete; the remainder is being verified.</p>}
      {letterImages(letter).length > 0 && <PhotoLink letter={letter} onOpen={onOpen} />}
    </article>
  );
}

function DraftCard({ letter, onOpen, highlight }) {
  const paragraphs = letter.body.split(/\n\n+/);
  const ref = useRef(null);
  useHighlightScroll(ref, highlight);
  return (
    <article ref={ref} className="letter-card letter-card--draft" id={`letter-${letter.id}`} aria-label={`Letter, ${letter.date_label}`}>
      <LetterHeader letter={letter} />
      <div className="letter-body">
        <div className="salutation">{letter.salutation}</div>
        {paragraphs.map((para, i) => {
          if (i === 0 && /^[A-Za-z]/.test(para)) {
            return (
              <p key={i} className="has-dropcap">
                <span className="dropcap">{para.charAt(0)}</span>{renderProse(para.slice(1), highlight)}
              </p>
            );
          }
          return <p key={i}>{renderProse(para, highlight)}</p>;
        })}
        <div className="signature">{letter.signature}</div>
      </div>
      <Fleuron />
      <NoteBlock text={letter.note} />
      <p className="letter-note">Some words are still being verified.</p>
      {letterImages(letter).length > 0 && <PhotoLink letter={letter} onOpen={onOpen} />}
    </article>
  );
}

function EnvelopeCard({ letter, onOpen }) {
  const imgs = letterImages(letter);
  return (
    <article className="letter-card letter-card--envelope" id={`letter-${letter.id}`} aria-label={`Envelope, ${letter.date_label}`}>
      <LetterHeader letter={letter} />
      {imgs.length > 0 && (
        <div className="envelope-stage">
          <button className="envelope-img" onClick={() => onOpen(letter, 1)}>
            <img src={`${letter.folder}/${(letter.images_web || imgs)[0]}`} loading="lazy" decoding="async"
                 alt={`Original envelope, postmarked ${letter.date_label}`} />
          </button>
        </div>
      )}
      <p className="letter-note envelope-note">The letter inside has been lost.</p>
      <NoteBlock text={letter.envelope_note} />
    </article>
  );
}

function ChristmasCardCard({ letter, onOpen }) {
  const imgs = letterImages(letter);
  // The card face to show inline: an explicit card_image from letters.json
  // wins; otherwise the first non-envelope scan.
  const cardFile = (letter.card_image && imgs.includes(letter.card_image))
    ? letter.card_image
    : (imgs.find((f) => !f.includes("envelope")) || imgs[0]);
  const cardPage = imgs.indexOf(cardFile) + 1;
  return (
    <article className="letter-card letter-card--xmas" id={`letter-${letter.id}`} aria-label={`Christmas card, ${letter.date_label}`}>
      <div className="brass-rule" />
      <LetterHeader letter={letter} />
      <div className="xmas-stage">
        {cardFile && (
          <button className="xmas-img" onClick={() => onOpen(letter, cardPage)}>
            <img src={`${letter.folder}/${(letter.images_web || imgs)[cardPage - 1]}`} loading="lazy" decoding="async"
                 alt={`Original Christmas card, dated ${letter.date_label}`} />
          </button>
        )}
        <div className="xmas-verse">
          {letter.card_verse.split("\n").map((line, i) => <div key={i}>{line}</div>)}
        </div>
        <div className="xmas-cartouche">Christmas · {letter.date.slice(0, 4)}</div>
      </div>
      <div className="signature signature--xmas">{letter.signature}</div>
      <NoteBlock text={letter.card_note} />
      {letterImages(letter).length > 0 && <PhotoLink letter={letter} onOpen={onOpen} />}
      <div className="brass-rule" />
    </article>
  );
}

function TelegramCard({ letter, onOpen }) {
  return (
    <article className="letter-card letter-card--telegram" id={`letter-${letter.id}`} aria-label={`Telegram, ${letter.date_label}`}>
      <LetterHeader letter={letter} />
      <div className="telegram-paper">
        <div className="telegram-letterhead">Postal Telegraph · Commercial Cables</div>
        <div className="telegram-head">
          <span>POSTAL TELEGRAPH</span>
          <span>HOLIDAY GREETINGS</span>
        </div>
        <div className="telegram-routing">{letter.telegram_routing}</div>
        <div className="telegram-to">
          {letter.telegram_to.split("\n").map((line, i) => <div key={i}>{line}</div>)}
        </div>
        <div className="telegram-message">{letter.telegram_message}</div>
        <div className="telegram-signed">{letter.telegram_signed}</div>
      </div>
      {letterImages(letter).length > 0 && <PhotoLink letter={letter} onOpen={onOpen} />}
    </article>
  );
}

function LetterCard({ letter, onOpen, highlight }) {
  switch (letter.status) {
    case "envelope_only":      return <EnvelopeCard letter={letter} onOpen={onOpen} />;
    case "christmas_card":     return <ChristmasCardCard letter={letter} onOpen={onOpen} />;
    case "telegram":           return <TelegramCard letter={letter} onOpen={onOpen} />;
    case "transcribed_draft":  return <DraftCard letter={letter} onOpen={onOpen} highlight={highlight} />;
    case "transcribed_partial":
    case "transcribed":
    default:                   return <TranscribedCard letter={letter} onOpen={onOpen} highlight={highlight} />;
  }
}

/* ------------------------------------------------------------------ */
/*  Title page + closing                                               */
/* ------------------------------------------------------------------ */

function ShipOrnament() {
  return (
    <div className="ornament" aria-hidden="true">
      <span className="ornament-rule" />
      <svg viewBox="0 0 56 56" className="ornament-anchor">
        {/* outer rope ring — dotted */}
        <circle cx="28" cy="28" r="25" fill="none" stroke="#9B7B3F"
          strokeWidth="0.9" strokeDasharray="1 3" opacity="0.85" />
        <circle cx="28" cy="28" r="22.5" fill="none" stroke="#9B7B3F"
          strokeWidth="0.6" opacity="0.45" />
        {/* anchor */}
        <circle cx="28" cy="14" r="2.6" fill="none" stroke="#9B7B3F" strokeWidth="1.1" />
        <line x1="28" y1="16.6" x2="28" y2="40" stroke="#9B7B3F" strokeWidth="1.1" strokeLinecap="round" />
        <line x1="22" y1="20" x2="34" y2="20" stroke="#9B7B3F" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M 17 34 Q 28 46 39 34" fill="none" stroke="#9B7B3F" strokeWidth="1.1" strokeLinecap="round" />
        <line x1="17" y1="34" x2="15" y2="32" stroke="#9B7B3F" strokeWidth="1.1" strokeLinecap="round" />
        <line x1="39" y1="34" x2="41" y2="32" stroke="#9B7B3F" strokeWidth="1.1" strokeLinecap="round" />
        {/* olive branch flourishes left + right */}
        <path d="M 6 28 Q 10 26 14 28" fill="none" stroke="#9B7B3F" strokeWidth="0.7" opacity="0.6" />
        <path d="M 8 27.4 L 8 25.6 M 10.5 26.6 L 10.5 24.7 M 12.5 27 L 12.5 25.3" stroke="#9B7B3F" strokeWidth="0.6" opacity="0.55" strokeLinecap="round" />
        <path d="M 50 28 Q 46 26 42 28" fill="none" stroke="#9B7B3F" strokeWidth="0.7" opacity="0.6" />
        <path d="M 48 27.4 L 48 25.6 M 45.5 26.6 L 45.5 24.7 M 43.5 27 L 43.5 25.3" stroke="#9B7B3F" strokeWidth="0.6" opacity="0.55" strokeLinecap="round" />
      </svg>
      <span className="ornament-rule" />
    </div>
  );
}

/* ShipSilhouette — heavy-cruiser silhouette evocative of the U.S.S.
   New Orleans (CA-32): forward and aft turrets with twin barrels, a
   tripod-mast bridge, two staggered funnels, aft superstructure. Sits
   at the bottom of the title page on a faint brass horizon hairline,
   like the ship is on the horizon at sea. */
function ShipSilhouette() {
  return (
    <div className="ship-horizon" aria-hidden="true">
      <svg className="ship-silhouette" viewBox="0 0 800 130" preserveAspectRatio="xMidYMid meet">
        <g fill="currentColor">
          <path d="M 60 92 L 80 82 L 130 80 L 700 80 L 738 84 L 744 92 L 738 100 L 70 100 Z" />
          <path d="M 130 80 L 130 70 L 280 70 L 290 80 Z" />
          <rect x="160" y="60" width="44" height="11" rx="1.5" />
          <rect x="120" y="63" width="44" height="2.4" />
          <rect x="120" y="68" width="44" height="2.4" />
          <rect x="310" y="56" width="170" height="24" />
          <rect x="340" y="40" width="56" height="16" />
          <rect x="356" y="28" width="24" height="12" />
          <rect x="367" y="6" width="2" height="22" />
          <line x1="357" y1="28" x2="367" y2="10" stroke="currentColor" strokeWidth="1.6" />
          <line x1="378" y1="28" x2="368" y2="10" stroke="currentColor" strokeWidth="1.6" />
          <rect x="362" y="14" width="11" height="3" />
          <path d="M 408 56 L 408 24 L 432 20 L 432 56 Z" />
          <path d="M 452 56 L 452 30 L 476 26 L 476 56 Z" />
          <rect x="500" y="58" width="68" height="22" />
          <rect x="525" y="48" width="36" height="10" />
          <rect x="540" y="30" width="2" height="18" />
          <rect x="568" y="72" width="120" height="8" />
          <rect x="600" y="62" width="40" height="10" rx="1.5" />
          <rect x="635" y="65" width="44" height="2.4" />
          <rect x="635" y="70" width="44" height="2.4" />
          <rect x="730" y="74" width="1.6" height="10" />
        </g>
      </svg>
    </div>
  );
}

function TitlePage() {
  return (
    <section className="title-page">
      <div className="title-hero">
        <ShipOrnament />
        <h1 className="title">Love, Always</h1>
        <p className="subtitle">
          Raymond Eugene Lankford<br />
          to Joan Northcutt
        </p>
        <p className="title-locator">
          <span>U.S.S. New Orleans</span>
          <span className="locator-mark" aria-hidden="true">✦</span>
          <span>Stanford, Kentucky</span>
        </p>
        <ShipSilhouette />
      </div>
    </section>
  );
}

/* Emphasis — wraps a phrase with a brass underline that draws in once
   when the line scrolls into view. Stays underlined afterward. Use
   sparingly so the gesture keeps its weight. */
function Emphasis({ children }) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (revealed) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          obs.disconnect();
        }
      },
      { threshold: 0.55 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [revealed]);
  return (
    <span ref={ref} className={"emphasis" + (revealed ? " is-revealed" : "")}>
      {children}
    </span>
  );
}


function Closing() {
  return (
    <section className="closing">
      <div className="hairline-rule" />
      <p className="closing-body">
        Gene's letters to Joan continued through the war. Less than a year after this last letter of 1940, on the morning of December 7, 1941, he was at Pearl Harbor. A year after that, off Tassafaronga in the Solomon Islands, a Japanese torpedo struck the New Orleans and tore away one hundred and fifty feet of her bow. One hundred and eighty-three of his shipmates went down with it, along with most of Joan's letters back. Gene came home in 1943. He and Joan were married for forty-nine years.
      </p>
      <div className="hairline-rule" />
      <p className="dedication">For the family who carries his story.</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Cast of characters                                                 */
/* ------------------------------------------------------------------ */

/* CastIntro — opening page for the cast section. Mirrors the chapter
   divider's quiet, centered treatment but on paper (no navy). */
function CastIntro({ cast }) {
  const count = (cast && cast.people) ? cast.people.length : 0;
  return (
    <section className="cast-intro">
      <div className="cast-intro-eyebrow">Reference</div>
      <h2 className="cast-intro-title">Cast of Characters</h2>
      <div className="cast-dates">{count} people named in the letters</div>
      <div className="hairline-rule" />
      <p className="cast-intro-body">
        Gene wrote of two worlds — the family and friends he left behind in
        Lincoln County, Kentucky, and the shipmates he found aboard the
        U.S.S. New Orleans. These are the people he named in his letters, and
        who they were. Tap any letter mark to read where a name appears.
      </p>
    </section>
  );
}

/* CastGroup — one page per grouping (Gene's family, the Navy, etc.).
   Each person carries a relation, a short identification, and chips that
   jump to the letters where they appear. */
function CastGroup({ group, people, onJumpToLetter }) {
  const byId = useMemo(() => {
    const m = {};
    for (const l of (window.LETTERS || [])) m[l.id] = l;
    return m;
  }, []);
  const sorted = useMemo(
    () => [...people].sort((a, b) =>
      (a.sort || a.name || "").localeCompare(b.sort || b.name || "")),
    [people]
  );
  return (
    <section className="cast-group">
      <header className="cast-group-head">
        <div className="cast-group-eyebrow">{group.label}</div>
        {group.blurb && <div className="cast-group-blurb">{group.blurb}</div>}
        <div className="brass-rule" />
      </header>
      <div className="cast-list">
        {sorted.map((p) => {
          const isPrincipal = p.group === "principals";
          const hasPortrait = !!(p.photo && p.photo.src);
          return (
            <article
              key={p.id}
              className={"cast-person" + ((hasPortrait || isPrincipal) ? " cast-person--portrait" : "")}
              id={`person-${p.id}`}
            >
              {hasPortrait ? (
                <figure className="cast-portrait">
                  <img src={p.photo.src + ASSET_V} alt={p.photo.alt || p.name} loading="lazy" />
                  {p.photo.caption && <figcaption>{p.photo.caption}</figcaption>}
                </figure>
              ) : isPrincipal ? (
                <div className="cast-portrait cast-portrait--empty" aria-hidden="true">
                  <span>photograph<br />to come</span>
                </div>
              ) : null}
              <div className="cast-person-text">
                <div className="cast-person-name">
                  {p.name}
                  {p.uncertain && (
                    <span className="cast-uncertain" title="Identity or reading uncertain">?</span>
                  )}
                </div>
                {p.relation && <div className="cast-person-relation">{p.relation}</div>}
                {p.bio && <p className="cast-person-bio">{p.bio}</p>}
                {Array.isArray(p.letters) && p.letters.length > 0 && (
                  <div className="cast-letters">
                    <span className="cast-letters-label">Appears in</span>
                    {p.letters.map((id) => {
                      const meta = byId[id];
                      return (
                        <button
                          key={id}
                          className="cast-chip"
                          onClick={() => meta && onJumpToLetter(id, p.aliases)}
                          disabled={!meta}
                          title={meta ? meta.date_label : `${id} (not on the site)`}
                        >
                          {id}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Chapter divider                                                     */
/* ------------------------------------------------------------------ */

function ChapterDivider({ chapter, letters, allChapters, allLetters }) {
  return (
    <section className="chapter-divider">
      <div className="chapter-watermark" aria-hidden="true">
        <span className="chapter-watermark-text">{chapter.numeral}</span>
      </div>
      <div className="chapter-numeral">Chapter {chapter.numeral}</div>
      <h2 className="chapter-title">{chapter.title}</h2>
      <div className="chapter-loc">{chapter.location_label}</div>
      <div className="chapter-dates">{dateRange(letters)}</div>
      <RouteDiagram activeChapter={chapter.key} chapters={allChapters} letters={allLetters} />
      <p className="chapter-bridge">{chapter.bridge}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Folio                                                               */
/* ------------------------------------------------------------------ */

function toRomanLower(n) {
  const map = [
    [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"],
    [100, "c"], [90, "xc"], [50, "l"], [40, "xl"],
    [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
  ];
  let out = "", v = n;
  for (const [val, sym] of map) {
    while (v >= val) { out += sym; v -= val; }
  }
  return out;
}

function Folio({ page, totalLetters }) {
  if (page.type === "title" || page.type === "closing") return null;
  if (page.type === "chapter") {
    return (
      <div className="folio">
        <span>Chapter {page.chapter.numeral}</span>
        <span className="dot">·</span>
        <span>{page.chapter.title}</span>
      </div>
    );
  }
  if (page.type === "letter") {
    const num = toRomanLower(page.letter.n);
    const total = toRomanLower(totalLetters);
    return (
      <div className="folio folio--running">
        <span className="folio-left">
          <span className="folio-chapter-title">{page.chapter.title}</span>
          <span className="folio-sep">·</span>
          <span className="folio-chapter-num">{page.chapter.numeral}</span>
        </span>
        <span className="folio-right">
          <span className="folio-no">Nº</span>
          <span className="folio-num">{num}</span>
          <span className="folio-slash">/</span>
          <span className="folio-num">{total}</span>
        </span>
      </div>
    );
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Photo gallery                                                      */
/* ------------------------------------------------------------------ */

function PhotoGallery({ gallery, onOpenPhoto }) {
  const items = gallery.items || [];
  return (
    <section className="gallery">
      <header className="gallery-head">
        <div className="gallery-eyebrow">Hawaii · 1940–1941</div>
        <h2 className="gallery-title">{gallery.title}</h2>
        {gallery.blurb && <p className="gallery-blurb">{gallery.blurb}</p>}
        <div className="brass-rule" />
      </header>
      <div className="gallery-grid">
        {items.map((it, i) => (
          <figure key={it.id} className="gallery-item">
            <button className="gallery-thumb" onClick={() => onOpenPhoto(items, i)}
              aria-label={it.caption || it.alt || "Open photograph"}>
              <img src={it.front + ASSET_V} alt={it.alt || it.caption || "Photograph from the archive"} loading="lazy" />
            </button>
            {it.caption && <figcaption>{it.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  );
}

/* PhotoLightbox — a generic image viewer for the gallery. Arrows move between
   photographs; a "turn over" control flips to the captioned reverse. Reuses
   the letter lightbox's .lightbox / .lb-* styling. */
function PhotoLightbox({ items, index, onClose }) {
  const [idx, setIdx] = useState(index || 0);
  const [showBack, setShowBack] = useState(false);
  const closeRef = useRef(null);
  useDialogFocus(closeRef);
  const go = useCallback((d) => {
    setIdx(i => Math.max(0, Math.min(items.length - 1, i + d)));
    setShowBack(false);
  }, [items.length]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, go]);

  const item = items[idx];
  if (!item) return null;
  const src = (showBack && item.back) ? item.back : item.front;
  const metaLabel = showBack ? (item.caption_source || "The reverse") : (item.caption || "");

  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="lb-close" ref={closeRef} onClick={onClose} aria-label="Close">×</button>
      <div className="lb-stage" onClick={(e) => e.stopPropagation()}>
        <div className="lb-frame">
          <img src={src + ASSET_V} alt={item.alt || item.caption || "Photograph from the archive"} />
        </div>
        <div className="lb-meta">
          <span className="lb-meta-date">{metaLabel}</span>
          <span className="lb-counter">{String(idx + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</span>
        </div>
        {item.back && (
          <button className="lb-flip" onClick={(e) => { e.stopPropagation(); setShowBack(b => !b); }}>
            {showBack ? "see the front" : "turn over"}
          </button>
        )}
      </div>
      {items.length > 1 && (
        <>
          <button className="lb-nav lb-prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous photograph">‹</button>
          <button className="lb-nav lb-next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next photograph">›</button>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page renderer                                                      */
/* ------------------------------------------------------------------ */

function PageContent({ page, totalLetters, onOpen, onNext, allChapters, allLetters, onJumpToLetter, onOpenPhoto, highlight, journey, onSelectStop, onOpenJourney, focusPlace }) {
  return (
    <main className="archive">
      <Folio page={page} totalLetters={totalLetters} />
      {page.type === "title" && <TitlePage />}
      {page.type === "journey" && (
        <JourneyPage journey={journey} onSelectStop={onSelectStop} focusPlace={focusPlace} />
      )}
      {page.type === "chapter" && (
        <ChapterDivider
          chapter={page.chapter}
          letters={page.letters}
          allChapters={allChapters}
          allLetters={allLetters}
        />
      )}
      {page.type === "letter" && (
        <>
          <LetterCard
            letter={page.letter}
            onOpen={onOpen}
            highlight={highlight && highlight.letterId === page.letter.id ? highlight : null}
          />
          <LetterWaypoint letter={page.letter} journey={journey} onOpenJourney={onOpenJourney} />
        </>
      )}
      {page.type === "cast-intro" && <CastIntro cast={page.cast} />}
      {page.type === "gallery" && <PhotoGallery gallery={page.gallery} onOpenPhoto={onOpenPhoto} />}
      {page.type === "cast-group" && (
        <CastGroup group={page.group} people={page.people} onJumpToLetter={onJumpToLetter} />
      )}
      {page.type === "closing" && <Closing />}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Nav chrome + TOC                                                    */
/* ------------------------------------------------------------------ */

function NavChrome({ pageIdx, total, onPrev, onNext, onToc }) {
  return (
    <div className="nav-chrome" role="navigation">
      <button className="nav-btn nav-prev" onClick={onPrev} disabled={pageIdx === 0}>
        <span className="nav-arrow">‹</span> Previous
      </button>
      <button className="toc-btn" onClick={onToc}>Contents</button>
      <button className="nav-btn nav-next" onClick={onNext} disabled={pageIdx === total - 1}>
        Next <span className="nav-arrow">›</span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Progress bar                                                       */
/* ------------------------------------------------------------------ */

function ProgressBar({ pageIdx, total, pages, isVisible }) {
  const pct = total <= 1 ? 0 : (pageIdx / (total - 1)) * 100;
  const chapterMarkers = useMemo(() => {
    const out = [];
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].type === "chapter") {
        out.push({ idx: i, pct: total <= 1 ? 0 : (i / (total - 1)) * 100, key: pages[i].chapter.key });
      }
    }
    return out;
  }, [pages, total]);
  return (
    <div className={"progress" + (isVisible ? " is-visible" : "")} aria-hidden="true">
      <div className="progress-track" />
      <div className="progress-fill" style={{ width: `${pct}%` }} />
      {chapterMarkers.map(m => (
        <span
          key={m.key}
          className={"progress-marker" + (pageIdx >= m.idx ? " is-active" : "")}
          style={{ left: `${m.pct}%` }}
        />
      ))}
    </div>
  );
}

function statusDotClass(status) {
  switch (status) {
    case "envelope_only":      return "toc-status toc-status--envelope";
    case "transcribed_draft":  return "toc-status toc-status--draft";
    case "christmas_card":
    case "telegram":           return "toc-status toc-status--special";
    default:                   return "toc-status toc-status--transcribed";
  }
}

function TableOfContents({ pages, currentIdx, onJump, onClose, totalLetters }) {
  const closeRef = useRef(null);
  useDialogFocus(closeRef);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sections = [];
  let titleIdx = pages.findIndex(p => p.type === "title");
  let journeyIdx = pages.findIndex(p => p.type === "journey");
  let closingIdx = pages.findIndex(p => p.type === "closing");
  let castIntroIdx = pages.findIndex(p => p.type === "cast-intro");
  let galleryIdx = pages.findIndex(p => p.type === "gallery");

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (p.type === "chapter") {
      const sec = { chapter: p.chapter, chapterIdx: i, items: [] };
      for (let j = i + 1; j < pages.length; j++) {
        if (pages[j].type !== "letter") break;
        if (pages[j].chapter.key !== p.chapter.key) break;
        sec.items.push({ idx: j, letter: pages[j].letter });
      }
      sections.push(sec);
    }
  }

  return (
    <div className="toc-overlay" onClick={onClose}>
      <div className="toc-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Table of contents">
        <button className="toc-close" ref={closeRef} onClick={onClose} aria-label="Close">×</button>
        <div className="toc-header">
          <div className="toc-header-eyebrow">Contents</div>
          <h2 className="toc-title">Love, Always</h2>
          <div className="toc-sub">{totalLetters} letters · 1940 – 1943</div>
        </div>

        <button
          className={"toc-entry" + (currentIdx === titleIdx ? " is-current" : "")}
          onClick={() => onJump(titleIdx)}
        >
          <span className="toc-num">—</span>
          <span className="toc-date">Title page</span>
        </button>

        {journeyIdx >= 0 && (
          <button
            className={"toc-entry" + (currentIdx === journeyIdx ? " is-current" : "")}
            onClick={() => onJump(journeyIdx)}
          >
            <span className="toc-num">—</span>
            <span className="toc-date">Map</span>
          </button>
        )}

        {sections.map((sec) => {
          const lastLetterIdx = sec.chapterIdx + sec.items.length;
          let progress;
          if (currentIdx <= sec.chapterIdx) progress = 0;
          else if (currentIdx >= lastLetterIdx) progress = 1;
          else progress = (currentIdx - sec.chapterIdx) / sec.items.length;
          return (
          <div key={sec.chapter.key} className="toc-section">
            <button
              className={"toc-section-head" + (currentIdx === sec.chapterIdx ? " is-current" : "")}
              onClick={() => onJump(sec.chapterIdx)}
            >
              <span className="toc-section-numeral">Ch. {sec.chapter.numeral}</span>
              <span className="toc-section-title">{sec.chapter.title}</span>
              <span className="toc-section-loc">{sec.items.length}</span>
              <span className="toc-section-progress" aria-hidden="true">
                <span className="toc-section-progress-fill" style={{ width: `${progress * 100}%` }} />
              </span>
            </button>
            <ul className="toc-list">
              {sec.items.map((it, idx) => {
                const prevLoc = idx > 0 ? sec.items[idx - 1].letter.location_stamp : null;
                const showLoc = it.letter.location_stamp !== prevLoc;
                const isActive = currentIdx === it.idx;
                return (
                  <li key={it.letter.id}>
                    <button
                      className={"toc-item" + (isActive ? " is-current" : "")}
                      onClick={() => onJump(it.idx)}
                    >
                      <span className={statusDotClass(it.letter.status)} aria-hidden="true" />
                      <span className="toc-num">{String(it.letter.n).padStart(2, "0")}</span>
                      <div className="toc-meta">
                        <span className="toc-date">{it.letter.date_label}</span>
                        {showLoc && <span className="toc-loc">{it.letter.location_stamp}</span>}
                      </div>
                      {isActive && (
                        <svg className="toc-anchor" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                          <circle cx="8" cy="3" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
                          <line x1="8" y1="4.5" x2="8" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          <line x1="5.5" y1="6" x2="10.5" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          <path d="M 3 11 Q 3 14 8 14 Q 13 14 13 11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          );
        })}

        {castIntroIdx >= 0 && (
          <button
            className={"toc-entry" + (currentIdx === castIntroIdx ? " is-current" : "")}
            onClick={() => onJump(castIntroIdx)}
          >
            <span className="toc-num">—</span>
            <span className="toc-date">Cast of Characters</span>
          </button>
        )}

        {galleryIdx >= 0 && (
          <button
            className={"toc-entry" + (currentIdx === galleryIdx ? " is-current" : "")}
            onClick={() => onJump(galleryIdx)}
          >
            <span className="toc-num">—</span>
            <span className="toc-date">Photographs</span>
          </button>
        )}

        <button
          className={"toc-entry" + (currentIdx === closingIdx ? " is-current" : "")}
          onClick={() => onJump(closingIdx)}
        >
          <span className="toc-num">—</span>
          <span className="toc-date">Closing</span>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Root                                                               */
/* ------------------------------------------------------------------ */

/* CoverModal — dedication letter from the grandson, pop-up overlay
   on the title page. Different aesthetic from Eugene's letters
   (lighter paper, no postmark/drop-cap/handwritten salutation —
   plain readable typography, two short paragraphs, two press
   buttons, simple signoff). localStorage-gated so returning readers
   aren't pestered. Click-outside, Escape, X, or CTA dismiss. */
function CoverModal({ onClose }) {
  const closeRef = useRef(null);
  useDialogFocus(closeRef);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);
  return (
    <div className="cover-backdrop" role="dialog" aria-modal="true" aria-label="A note from the grandson" onClick={onClose}>
      <div className="cover-popup" onClick={(e) => e.stopPropagation()}>
        <button className="cover-x" onClick={onClose} aria-label="Close">×</button>
        <p className="cover-salutation">Dear Reader,</p>
        <p className="cover-body">
          These are my grandfather's letters to my grandmother, written from
          the Navy between 1940 and 1944. Transcribing them is a labor of
          love and a work in progress, so expect a few rough edges while I
          get it right.
        </p>
        <div className="cover-context-label">For context:</div>
        <div className="cover-buttons">
          <a className="cover-button cover-button--navy"
             href="https://www.wkyt.com/2023/02/15/love-always-gene-somerset-family-finds-wwii-love-letters/"
             target="_blank" rel="noopener noreferrer">
            <span className="cover-button-label">WKYT</span>
            <span className="cover-button-text">Article</span>
          </a>
          <a className="cover-button cover-button--brass"
             href="https://www.wkyt.com/video/2023/02/14/watch-somerset-woman-finds-her-fathers-love-letters-sent-her-mother-during-world-war-ii/"
             target="_blank" rel="noopener noreferrer">
            <span className="cover-button-label">WKYT</span>
            <span className="cover-button-text">Video</span>
          </a>
        </div>
        <div className="cover-signoff">
          <p className="cover-signoff-line">“From the one who cares,”</p>
          <p className="cover-signoff-handwritten">“Love, always,”</p>
          <p className="cover-signoff-name">Blake William Morris</p>
        </div>
        <button className="cover-close" ref={closeRef} onClick={onClose}>Open the letters</button>
      </div>
    </div>
  );
}

function App() {
  const pages = useMemo(() => buildPages(LETTERS, CHAPTERS, window.CAST, window.PHOTOS), []);
  const journey = useMemo(() => buildJourney(LETTERS, PLACES), []);
  const journeyIdx = useMemo(() => pages.findIndex(p => p.type === "journey"), [pages]);
  const [pageIdx, setPageIdx] = useState(() => parseHashIdx(pages.length - 1));
  const [direction, setDirection] = useState(1);
  const prevIdxRef = useRef(0);
  const [lb, setLb] = useState(null);
  const [plb, setPlb] = useState(null);          // photo-gallery lightbox: { items, idx }
  const [tocOpen, setTocOpen] = useState(false);
  const [highlight, setHighlight] = useState(null);     // { letterId, terms, token }
  const [returnToCast, setReturnToCast] = useState(null); // page index to return to
  const [focusPlace, setFocusPlace] = useState(null);   // journey pin to spotlight
  const tokenRef = useRef(0);
  const swipeRef = useRef(null);
  const reduced = useReducedMotion();

  // Cover dedication — float in 2s after page load so the title-page
  // entrance animations get to play first. Shows every visit (no
  // localStorage gate) so the dedication isn't hidden from returning
  // readers.
  const [coverOpen, setCoverOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCoverOpen(true), 2000);
    return () => clearTimeout(t);
  }, []);
  const closeCover = useCallback(() => setCoverOpen(false), []);

  const goto = useCallback((idx) => {
    setPageIdx(curr => {
      const next = Math.max(0, Math.min(pages.length - 1, idx));
      if (next === curr) return curr;
      setDirection(next > curr ? 1 : -1);
      prevIdxRef.current = curr;
      return next;
    });
  }, [pages.length]);

  // Jump from a cast entry's letter chip to that letter's page, flashing the
  // person's name and remembering the cast page to return to.
  const jumpToLetter = useCallback((id, aliases) => {
    const idx = pages.findIndex(p => p.type === "letter" && p.letter && p.letter.id === id);
    if (idx < 0) return;
    tokenRef.current += 1;
    setHighlight({ letterId: id, terms: aliases || [], token: tokenRef.current });
    setReturnToCast(pageIdx);
    goto(idx);
  }, [pages, goto, pageIdx]);

  const openPhoto = useCallback((items, idx) => setPlb({ items, idx }), []);
  const closePhoto = useCallback(() => setPlb(null), []);

  // Journey pin (or legend row) → the first letter written from that place.
  const jumpToPlace = useCallback((key) => {
    const idx = pages.findIndex(p => p.type === "letter" && p.letter.place === key);
    if (idx >= 0) goto(idx);
  }, [pages, goto]);

  // A letter's waypoint map → the frontispiece, with that stop spotlit.
  const openJourney = useCallback((key) => {
    setFocusPlace(key || null);
    if (journeyIdx >= 0) goto(journeyIdx);
  }, [goto, journeyIdx]);

  const next = useCallback(() => {
    setPageIdx(curr => {
      const n = Math.min(pages.length - 1, curr + 1);
      if (n !== curr) { setDirection(1); prevIdxRef.current = curr; }
      return n;
    });
  }, [pages.length]);

  const prev = useCallback(() => {
    setPageIdx(curr => {
      const n = Math.max(0, curr - 1);
      if (n !== curr) { setDirection(-1); prevIdxRef.current = curr; }
      return n;
    });
  }, [pages.length]);

  // sync hash on pageIdx change
  useEffect(() => {
    const target = `p=${pageIdx}`;
    if (window.location.hash.replace(/^#/, "") !== target) {
      window.location.hash = target;
    }
  }, [pageIdx]);

  // back/forward
  useEffect(() => {
    const onHash = () => {
      const idx = parseHashIdx(pages.length - 1);
      setPageIdx(curr => idx === curr ? curr : idx);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [pages.length]);

  // keyboard nav
  useEffect(() => {
    if (lb || tocOpen || plb) return;
    const onKey = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
      else if (e.key === "Home") goto(0);
      else if (e.key === "End") goto(pages.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goto, pages.length, lb, tocOpen, plb]);

  // touch swipe
  useEffect(() => {
    if (lb || tocOpen || plb) return;
    const onStart = (e) => {
      const t = e.touches[0];
      swipeRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    };
    const onEnd = (e) => {
      const s = swipeRef.current;
      swipeRef.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      const dt = Date.now() - s.t;
      if (dt > 700) return;
      if (Math.abs(dx) < 60) return;
      if (Math.abs(dy) > Math.abs(dx) * 0.6) return;
      if (dx < 0) next(); else prev();
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [next, prev, lb, tocOpen, plb]);

  const currentPage = pages[pageIdx];

  // Once the reader leaves the letters (back to the cast, gallery, title, or
  // closing), drop the highlight and the "return to cast" affordance. The
  // journey spotlight likewise only survives while on the journey page.
  useEffect(() => {
    if (currentPage.type !== "letter") {
      setReturnToCast(curr => (curr === null ? curr : null));
      setHighlight(curr => (curr === null ? curr : null));
    }
    if (currentPage.type !== "journey") {
      setFocusPlace(curr => (curr === null ? curr : null));
    }
  }, [pageIdx]);

  const chapterKey = useMemo(() => {
    if (currentPage.type === "chapter") return currentPage.chapter.key;
    if (currentPage.type === "letter") return currentPage.chapter.key;
    return null;
  }, [currentPage]);
  const currentWeather = useMemo(() => {
    if (currentPage.type !== "letter") return null;
    const w = window.LETTER_WEATHER && window.LETTER_WEATHER[currentPage.letter.id];
    return (w && !w.error) ? w : null;
  }, [currentPage]);

  const isWar = currentPage.type === "chapter" && currentPage.chapter.key === "at-war";
  // navy and war are mutually exclusive — at-war gets red, every other
  // chapter divider gets navy. Avoids a CSS specificity tie that left
  // navy chrome bleeding through on the at-war page.
  const isNavy = currentPage.type === "chapter" && !isWar;
  useEffect(() => {
    document.body.classList.toggle("body--navy", isNavy);
    document.body.classList.toggle("body--war", isWar);
  }, [isNavy, isWar]);


  const openLb = useCallback((letter, page = 1) => setLb({ letter, page }), []);
  const closeLb = useCallback(() => setLb(null), []);
  const navLb = useCallback((dir) => {
    setLb(curr => {
      if (!curr) return curr;
      const total = letterImages(curr.letter).length;
      const k = curr.page + dir;
      if (k < 1 || k > total) return curr;
      return { ...curr, page: k };
    });
  }, []);

  useEffect(() => {
    if (lb || tocOpen || plb) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prevOverflow; };
    }
  }, [lb, tocOpen, plb]);

  const totalLetters = LETTERS.length;
  const showProgress = currentPage.type !== "title";

  const variants = useMemo(() => ({
    initial: (dir) => reduced
      ? { opacity: 0 }
      : { opacity: 0, x: dir > 0 ? 24 : -24, rotateY: dir > 0 ? 2 : -2 },
    animate: { opacity: 1, x: 0, rotateY: 0 },
    exit: (dir) => reduced
      ? { opacity: 0 }
      : { opacity: 0, x: dir > 0 ? -16 : 16, rotateY: dir > 0 ? -1.5 : 1.5 },
  }), [reduced]);

  return (
    <>
      <AtmosphereMount chapterKey={chapterKey} weather={currentWeather} />
      <ProgressBar pageIdx={pageIdx} total={pages.length} pages={pages} isVisible={showProgress} />
      <div className="stage" style={{ perspective: "1400px" }}>
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={pageIdx}
            custom={direction}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{
              duration: reduced ? 0 : 0.36,
              ease: [0.22, 1, 0.36, 1],
            }}
            className={"page-surface" + (isNavy ? " is-navy" : "")}
            style={{ transformStyle: "preserve-3d" }}
          >
            <PageContent
              page={currentPage}
              totalLetters={totalLetters}
              onOpen={openLb}
              onNext={next}
              allChapters={CHAPTERS}
              allLetters={LETTERS}
              onJumpToLetter={jumpToLetter}
              onOpenPhoto={openPhoto}
              highlight={highlight}
              journey={journey}
              onSelectStop={jumpToPlace}
              onOpenJourney={openJourney}
              focusPlace={focusPlace}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <NavChrome
        pageIdx={pageIdx}
        total={pages.length}
        onPrev={prev}
        onNext={next}
        onToc={() => setTocOpen(true)}
      />

      {tocOpen && (
        <TableOfContents
          pages={pages}
          currentIdx={pageIdx}
          totalLetters={totalLetters}
          onJump={(i) => { setTocOpen(false); goto(i); }}
          onClose={() => setTocOpen(false)}
        />
      )}

      {lb && <Lightbox letter={lb.letter} page={lb.page} onClose={closeLb} onNav={navLb} />}

      {coverOpen && <CoverModal onClose={closeCover} />}

      {plb && <PhotoLightbox items={plb.items} index={plb.idx} onClose={closePhoto} />}

      {returnToCast !== null && currentPage.type === "letter" && (
        <button
          className="return-to-cast"
          onClick={() => { goto(returnToCast); setReturnToCast(null); setHighlight(null); }}
        >
          <span className="rtc-arrow">‹</span> Back to the Cast
        </button>
      )}
    </>
  );
}

function AtmosphereMount({ chapterKey, weather }) {
  const [mounted, setMounted] = useState(null);
  useLayoutEffect(() => {
    const node = document.getElementById("atmosphere-root");
    if (node) setMounted(node);
  }, []);
  if (!mounted) return null;
  return createPortal(
    <Atmosphere chapterKey={chapterKey} weather={weather} on={!!chapterKey} />,
    mounted
  );
}



createRoot(document.getElementById("root")).render(<App />);
