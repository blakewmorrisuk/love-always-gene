// GENERATED from app.jsx by scripts/build_app.sh — DO NOT EDIT BY HAND.
// Edit app.jsx, then run:  bash scripts/build_app.sh
const { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } = React;
const { createPortal } = ReactDOM;
const { createRoot } = ReactDOMClient;
const { motion, AnimatePresence, useReducedMotion } = FramerMotion;
const ASSET_V = "?v=" + (window.__APP_VERSION || "1");
const letterImages = (letter) => letter.images || [];
function useDialogFocus(closeRef) {
  useEffect(() => {
    const prev = document.activeElement;
    if (closeRef.current) closeRef.current.focus();
    return () => {
      if (prev && typeof prev.focus === "function") prev.focus();
    };
  }, [closeRef]);
}
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
const PEARL_HARBOR = /* @__PURE__ */ new Date("1941-12-07T00:00:00Z");
function pearlHarborMarker(dateStr) {
  const d = /* @__PURE__ */ new Date(dateStr + "T00:00:00Z");
  if (isNaN(d)) return null;
  const days = Math.round((d - PEARL_HARBOR) / 864e5);
  if (days < 0) return { days: -days, label: `${(-days).toLocaleString()} days before Pearl Harbor` };
  if (days > 0) return { days, label: `${days.toLocaleString()} days after Pearl Harbor` };
  return { days: 0, label: "the morning of Pearl Harbor" };
}
function buildPages(letters, chapters, cast, photos) {
  const grouped = groupByChapter(letters, chapters);
  const pages = [{ type: "title" }];
  pages.push({ type: "journey" });
  for (const c of chapters) {
    const ls = grouped[c.key];
    if (!ls || !ls.length) continue;
    pages.push({ type: "chapter", chapter: c, letters: ls });
    for (const l of ls) {
      pages.push({ type: "letter", letter: l, chapter: c });
    }
  }
  const galleries = photos && Array.isArray(photos.galleries) ? photos.galleries : [];
  if (cast && Array.isArray(cast.people) && cast.people.length) {
    pages.push({ type: "cast-intro", cast });
    for (const gal of galleries) pages.push({ type: "gallery", gallery: gal });
    for (const g of cast.groups) {
      const members = cast.people.filter((p) => p.group === g.key);
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
const PLACES = window.PLACES || {};
const MAP_BASE = window.MAP_BASE || null;
function projectLL(lat, lon, base) {
  const L = lon >= base.lon0 ? lon : lon + 360;
  return [
    (L - base.lon0) / (base.lon1 - base.lon0) * base.w,
    (base.lat1 - lat) / (base.lat1 - base.lat0) * base.h
  ];
}
function buildJourney(letters, places) {
  const sorted = [...letters].sort((a, b) => a.date === b.date ? (a.n || 0) - (b.n || 0) : a.date.localeCompare(b.date));
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
      approx: !!(stops[i - 1].place.approx || stops[i].place.approx)
    });
  }
  const pins = [];
  const byKey = {};
  for (const s of stops) {
    let p = byKey[s.key];
    if (!p) {
      p = byKey[s.key] = {
        key: s.key,
        place: s.place,
        n: pins.length + 1,
        letters: [],
        firstDate: s.firstDate,
        lastDate: s.lastDate
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
function weatherKind(w) {
  if (!w || w.wmo == null) return null;
  const c = w.wmo;
  if (c === 0) return "clear";
  if ([1, 2, 3].includes(c)) return "clouds";
  if ([45, 48].includes(c)) return "fog";
  if ([51, 53, 55, 56, 57].includes(c)) return "drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(c)) return "snow";
  if ([95, 96, 99].includes(c)) return "storm";
  return "clouds";
}
function weatherLabel(kind) {
  return {
    clear: "Clear",
    clouds: "Cloudy",
    fog: "Fog",
    drizzle: "Drizzle",
    rain: "Rain",
    snow: "Snow",
    storm: "Thunderstorm"
  }[kind] || "";
}
function WeatherIcon({ kind }) {
  switch (kind) {
    case "clear":
      return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "4" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "3", x2: "12", y2: "5" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "19", x2: "12", y2: "21" }), /* @__PURE__ */ React.createElement("line", { x1: "3", y1: "12", x2: "5", y2: "12" }), /* @__PURE__ */ React.createElement("line", { x1: "19", y1: "12", x2: "21", y2: "12" }), /* @__PURE__ */ React.createElement("line", { x1: "5.6", y1: "5.6", x2: "7", y2: "7" }), /* @__PURE__ */ React.createElement("line", { x1: "17", y1: "17", x2: "18.4", y2: "18.4" }), /* @__PURE__ */ React.createElement("line", { x1: "5.6", y1: "18.4", x2: "7", y2: "17" }), /* @__PURE__ */ React.createElement("line", { x1: "17", y1: "7", x2: "18.4", y2: "5.6" }));
    case "clouds":
      return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "M7 16h11a3 3 0 0 0 0-6 5 5 0 0 0-9.6-1.5A4 4 0 0 0 7 16Z" }));
    case "fog":
      return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("line", { x1: "4", y1: "9", x2: "20", y2: "9" }), /* @__PURE__ */ React.createElement("line", { x1: "3", y1: "13", x2: "19", y2: "13" }), /* @__PURE__ */ React.createElement("line", { x1: "5", y1: "17", x2: "21", y2: "17" }));
    case "drizzle":
    case "rain":
      return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "M7 14h11a3 3 0 0 0 0-6 5 5 0 0 0-9.6-1.5A4 4 0 0 0 7 14Z" }), /* @__PURE__ */ React.createElement("line", { x1: "9", y1: "17", x2: "8", y2: "20" }), /* @__PURE__ */ React.createElement("line", { x1: "13", y1: "17", x2: "12", y2: "20" }), /* @__PURE__ */ React.createElement("line", { x1: "17", y1: "17", x2: "16", y2: "20" }));
    case "snow":
      return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "4", x2: "12", y2: "20" }), /* @__PURE__ */ React.createElement("line", { x1: "4", y1: "12", x2: "20", y2: "12" }), /* @__PURE__ */ React.createElement("line", { x1: "6.5", y1: "6.5", x2: "17.5", y2: "17.5" }), /* @__PURE__ */ React.createElement("line", { x1: "6.5", y1: "17.5", x2: "17.5", y2: "6.5" }));
    case "storm":
      return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "M7 14h11a3 3 0 0 0 0-6 5 5 0 0 0-9.6-1.5A4 4 0 0 0 7 14Z" }), /* @__PURE__ */ React.createElement("polyline", { points: "13 14 10 19 13 19 11 22" }));
    default:
      return null;
  }
}
function WeatherGlyph({ weather }) {
  const kind = weatherKind(weather);
  if (!kind || !weather) return null;
  const t = weather.tmax_f != null ? `${Math.round(weather.tmax_f)}°` : "";
  const approx = !!weather.approx;
  const approxNote = "reconstructed from the ship's estimated position";
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "weather-glyph" + (approx ? " weather-glyph--approx" : ""),
      "aria-label": `Weather: ${weatherLabel(kind)}${t ? ", high " + t : ""}${approx ? ` (${approxNote})` : ""}`,
      title: approx ? approxNote : void 0
    },
    /* @__PURE__ */ React.createElement(WeatherIcon, { kind }),
    /* @__PURE__ */ React.createElement("span", null, weatherLabel(kind)),
    t && /* @__PURE__ */ React.createElement("span", { className: "wg-temp" }, approx ? `≈ ${t}` : t)
  );
}
function Atmosphere({ chapterKey, weather, on }) {
  const kind = weather ? weatherKind(weather) : null;
  const snow = useMemo(() => Array.from({ length: 40 }, () => ({
    size: 2 + Math.random() * 4,
    left: Math.random() * 100,
    delay: -Math.random() * 18,
    dur: 14 + Math.random() * 12,
    drift: (Math.random() - 0.5) * 80,
    op: 0.35 + Math.random() * 0.4
  })), []);
  const rain = useMemo(() => Array.from({ length: 80 }, () => ({
    left: Math.random() * 100,
    delay: -Math.random() * 1.2,
    dur: 0.55 + Math.random() * 0.5,
    len: 60 + Math.random() * 40,
    op: 0.35 + Math.random() * 0.35
  })), []);
  const drizzle = useMemo(() => Array.from({ length: 40 }, () => ({
    left: Math.random() * 100,
    delay: -Math.random() * 2.4,
    dur: 1.4 + Math.random() * 0.8,
    len: 28 + Math.random() * 24,
    op: 0.22 + Math.random() * 0.2
  })), []);
  const clouds = useMemo(() => Array.from({ length: 5 }, () => ({
    size: 240 + Math.random() * 360,
    top: -20 + Math.random() * 90,
    delay: -Math.random() * 90,
    dur: 90 + Math.random() * 80,
    op: 0.35 + Math.random() * 0.35
  })), []);
  const dust = useMemo(() => Array.from({ length: 28 }, () => ({
    size: 2 + Math.random() * 5,
    left: 5 + Math.random() * 90,
    top: 30 + Math.random() * 50,
    delay: -Math.random() * 22,
    dur: 18 + Math.random() * 16,
    dx: (Math.random() - 0.5) * 220,
    dy: -120 - Math.random() * 200,
    op: 0.25 + Math.random() * 0.35
  })), []);
  const rays = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    left: 8 + i * 14 + Math.random() * 6,
    delay: -Math.random() * 9,
    rot: -8 + Math.random() * 16
  })), []);
  const stars = useMemo(() => Array.from({ length: 60 }, () => ({
    left: Math.random() * 100,
    top: Math.random() * 65,
    delay: -Math.random() * 4,
    dur: 3 + Math.random() * 3
  })), []);
  if (!on) return null;
  if (chapterKey === "at-war" && !kind) return null;
  if (kind === "rain" || kind === "storm") {
    return /* @__PURE__ */ React.createElement("div", { className: "atmosphere atmosphere--on", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("div", { className: "rain-mist" }), kind === "storm" && /* @__PURE__ */ React.createElement("div", { className: "lightning-flash" }), rain.map((r, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "rain-streak", style: {
      left: `${r.left}%`,
      height: `${r.len}px`,
      animationDelay: `${r.delay}s`,
      animationDuration: `${r.dur}s`,
      "--rain-op": r.op
    } })));
  }
  if (kind === "drizzle") {
    return /* @__PURE__ */ React.createElement("div", { className: "atmosphere atmosphere--on", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("div", { className: "rain-mist", style: { opacity: 0.6 } }), drizzle.map((r, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "rain-streak", style: {
      left: `${r.left}%`,
      height: `${r.len}px`,
      animationDelay: `${r.delay}s`,
      animationDuration: `${r.dur}s`,
      "--rain-op": r.op
    } })));
  }
  if (kind === "snow") {
    return /* @__PURE__ */ React.createElement("div", { className: "atmosphere atmosphere--on", "aria-hidden": "true" }, snow.map((s, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "snow-flake", style: {
      width: `${s.size}px`,
      height: `${s.size}px`,
      left: `${s.left}%`,
      animationDelay: `${s.delay}s`,
      animationDuration: `${s.dur}s`,
      "--snow-drift": `${s.drift}px`,
      "--snow-op": s.op
    } })));
  }
  if (kind === "fog") {
    return /* @__PURE__ */ React.createElement("div", { className: "atmosphere atmosphere--on", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("div", { className: "fog-layer" }), /* @__PURE__ */ React.createElement("div", { className: "fog-layer f2" }));
  }
  if (kind === "clouds") {
    return /* @__PURE__ */ React.createElement("div", { className: "atmosphere atmosphere--on", "aria-hidden": "true" }, clouds.map((c, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "cloud-shape", style: {
      width: `${c.size}px`,
      height: `${c.size * 0.45}px`,
      top: `${c.top}%`,
      animationDelay: `${c.delay}s`,
      animationDuration: `${c.dur}s`,
      "--cloud-op": c.op
    } })));
  }
  if (kind === "clear") {
    return /* @__PURE__ */ React.createElement("div", { className: "atmosphere atmosphere--on", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("div", { className: "sun-glow" }), rays.map((r, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "sun-ray", style: {
      left: `${r.left}%`,
      transform: `rotate(${r.rot}deg)`,
      animationDelay: `${r.delay}s`
    } })), dust.slice(0, 14).map((d, i) => /* @__PURE__ */ React.createElement("span", { key: `d${i}`, className: "dust-mote", style: {
      width: `${d.size}px`,
      height: `${d.size}px`,
      left: `${d.left}%`,
      top: `${d.top}%`,
      animationDelay: `${d.delay}s`,
      animationDuration: `${d.dur}s`,
      "--dust-x": `${d.dx}px`,
      "--dust-y": `${d.dy}px`,
      "--dust-op": d.op
    } })));
  }
  if (chapterKey === "great-lakes") {
    return /* @__PURE__ */ React.createElement("div", { className: "atmosphere atmosphere--on", "aria-hidden": "true" }, clouds.map((c, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "cloud-shape", style: {
      width: `${c.size}px`,
      height: `${c.size * 0.45}px`,
      top: `${c.top}%`,
      animationDelay: `${c.delay}s`,
      animationDuration: `${c.dur}s`,
      "--cloud-op": c.op
    } })));
  }
  if (chapterKey === "san-diego") {
    return /* @__PURE__ */ React.createElement("div", { className: "atmosphere atmosphere--on", "aria-hidden": "true" }, dust.map((d, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "dust-mote", style: {
      width: `${d.size}px`,
      height: `${d.size}px`,
      left: `${d.left}%`,
      top: `${d.top}%`,
      animationDelay: `${d.delay}s`,
      animationDuration: `${d.dur}s`,
      "--dust-x": `${d.dx}px`,
      "--dust-y": `${d.dy}px`,
      "--dust-op": d.op
    } })));
  }
  if (chapterKey === "pearl-harbor") {
    return /* @__PURE__ */ React.createElement("div", { className: "atmosphere atmosphere--on", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("div", { className: "sea-layer" }), /* @__PURE__ */ React.createElement("div", { className: "sea-vignette" }), /* @__PURE__ */ React.createElement("div", { className: "sea-shimmer" }), /* @__PURE__ */ React.createElement("div", { className: "sea-shimmer s2" }), /* @__PURE__ */ React.createElement("div", { className: "sea-shimmer s3" }));
  }
  return null;
}
function RouteDiagram({ activeChapter, chapters, letters }) {
  const grouped = useMemo(() => groupByChapter(letters, chapters), [letters, chapters]);
  const usedKeys = new Set(letters.map((l) => l.location_chapter));
  const stops = chapters.filter((c) => usedKeys.has(c.key) && c.map);
  const activeDef = chapters.find((c) => c.key === activeChapter);
  const effectiveActive = activeDef && activeDef.mapPin || activeChapter;
  if (stops.length === 0) return null;
  const x0 = 80, x1 = 720, yMid = 90;
  const positions = stops.map((s, i) => {
    const x = stops.length === 1 ? (x0 + x1) / 2 : x0 + (i + 0.5) / stops.length * (x1 - x0);
    return { ...s, x, y: yMid };
  });
  return /* @__PURE__ */ React.createElement("div", { className: "route-wrap", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 800 200", className: "route-svg", preserveAspectRatio: "xMidYMid meet" }, /* @__PURE__ */ React.createElement("line", { x1: x0, y1: yMid, x2: x1, y2: yMid, className: "route-line" }), positions.map((p) => {
    const isActive = p.key === effectiveActive;
    const ls = grouped[p.key] || [];
    const dr = dateRange(ls);
    const label = p.map && p.map.label || p.location_label || p.title;
    return /* @__PURE__ */ React.createElement("g", { key: p.key }, isActive && /* @__PURE__ */ React.createElement("circle", { cx: p.x, cy: p.y, r: "11", className: "route-pin-active-halo" }), /* @__PURE__ */ React.createElement(
      "circle",
      {
        cx: p.x,
        cy: p.y,
        r: isActive ? 6 : 5,
        className: isActive ? "route-pin-active" : "route-pin-inactive"
      }
    ), isActive && /* @__PURE__ */ React.createElement("line", { x1: p.x - 22, y1: p.y - 28, x2: p.x + 22, y2: p.y - 28, className: "route-label-rule" }), /* @__PURE__ */ React.createElement(
      "text",
      {
        x: p.x,
        y: p.y - 38,
        textAnchor: "middle",
        className: isActive ? "route-label route-label--active" : "route-label"
      },
      label
    ), /* @__PURE__ */ React.createElement("text", { x: p.x, y: p.y + 30, textAnchor: "middle", className: "route-date" }, dr));
  })));
}
const MAP_LABELS = {
  "great-lakes": { text: "Great Lakes", dx: -9, dy: -5, anchor: "end", num: { dx: 0, dy: -9, anchor: "middle" } },
  "chicago": { text: "Chicago", dx: 9, dy: 13, anchor: "start", num: { dx: -9, dy: 7, anchor: "end" } },
  "el-paso": { text: "El Paso", dx: 8, dy: 11, anchor: "start" },
  "san-diego": { text: "San Diego", dx: -11, dy: 16, anchor: "end", leader: true, num: { dx: 7, dy: 3, anchor: "start" } },
  "pearl-harbor": { text: "Pearl Harbor", dx: -2, dy: -12, anchor: "middle" },
  "bremerton": { text: "Bremerton", dx: 10, dy: -2, anchor: "start" },
  "long-beach": { text: "Long Beach", dx: -11, dy: 5, anchor: "end", leader: true, num: { dx: 0, dy: -8, anchor: "middle" } },
  "mare-island": { text: "Mare Island", dx: 11, dy: -7, anchor: "start", leader: true, num: { dx: 8, dy: -4, anchor: "start" } },
  "san-francisco": { text: "San Francisco", dx: -11, dy: 12, anchor: "end", leader: true, num: { dx: 7, dy: 4, anchor: "start" } },
  "wake-relief": { text: "Wake sortie", dx: 0, dy: -11, anchor: "middle" },
  "coral-sea": { text: "Coral Sea", dx: -9, dy: 5, anchor: "end" },
  "south-pacific-transit": { text: "South Pacific", dx: 10, dy: 5, anchor: "start" },
  "solomons-area": { text: "The Solomons", dx: 10, dy: 9, anchor: "start" },
  "tulagi": { text: "Tulagi", dx: -8, dy: -5, anchor: "end" },
  "sydney": { text: "Sydney", dx: -10, dy: 7, anchor: "end" },
  "kentucky": { text: "Home", dx: 0, dy: 16, anchor: "middle", num: { dx: -10, dy: 4, anchor: "end" } },
  "montgomery-wv": { text: "Montgomery", dx: 9, dy: -4, anchor: "start" }
};
function quadControl(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(len * 0.1, 40);
  let px = -dy / len, py = dx / len;
  if (py > 0) {
    px = -px;
    py = -py;
  }
  return [x1 + dx / 2 + px * bow, y1 + dy / 2 + py * bow];
}
function legPath(x1, y1, x2, y2) {
  const [cx, cy] = quadControl(x1, y1, x2, y2);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
function quadLength(x1, y1, x2, y2) {
  const [cx, cy] = quadControl(x1, y1, x2, y2);
  let L = 0, lx = x1, ly = y1;
  for (let i = 1; i <= 8; i++) {
    const t = i / 8, u = 1 - t;
    const qx = u * u * x1 + 2 * u * t * cx + t * t * x2;
    const qy = u * u * y1 + 2 * u * t * cy + t * t * y2;
    L += Math.hypot(qx - lx, qy - ly);
    lx = qx;
    ly = qy;
  }
  return L;
}
function starPath(x, y, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}
function CompassRose({ x, y }) {
  return /* @__PURE__ */ React.createElement("g", { className: "mc-rose", transform: `translate(${x} ${y})`, "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("circle", { r: "26", className: "mc-rose-ring" }), /* @__PURE__ */ React.createElement("circle", { r: "19", className: "mc-rose-ring mc-rose-ring--inner" }), [0, 45, 90, 135].map((a) => /* @__PURE__ */ React.createElement(
    "line",
    {
      key: a,
      x1: "0",
      y1: "-24",
      x2: "0",
      y2: "24",
      transform: `rotate(${a})`,
      className: "mc-rose-line" + (a % 90 === 0 ? "" : " mc-rose-line--minor")
    }
  )), /* @__PURE__ */ React.createElement("path", { d: "M 0 -24 L 3.6 -7 L 0 -10.5 L -3.6 -7 Z", className: "mc-rose-north" }), /* @__PURE__ */ React.createElement("text", { y: "-31", textAnchor: "middle", className: "mc-rose-n" }, "N"));
}
function MapChart({ journey, mode, activePlace, visibleThrough, onSelectStop }) {
  const reduced = useReducedMotion();
  const full = mode === "full";
  const [voyage, setVoyage] = useState(false);
  useEffect(() => {
    if (!full || reduced) return;
    const id = requestAnimationFrame(() => setVoyage(true));
    return () => cancelAnimationFrame(id);
  }, [full, reduced]);
  const base = MAP_BASE;
  if (!base || !journey || !journey.stops.length) return null;
  const xy = (place) => projectLL(place.lat, place.lon, base);
  const cutoff = visibleThrough || "9999-12-31";
  const legs = journey.legs.filter((l) => l.to.firstDate <= cutoff);
  const pins = journey.pins.filter((p) => p.firstDate <= cutoff);
  const extraPin = activePlace && PLACES[activePlace] && !pins.some((p) => p.key === activePlace) ? { key: activePlace, place: PLACES[activePlace], letters: [], n: null } : null;
  const lonLines = [];
  for (let lon = 120; lon < base.lon1; lon += 20) {
    lonLines.push((lon - base.lon0) / (base.lon1 - base.lon0) * base.w);
  }
  const latLines = [];
  for (let lat = -40; lat <= 40; lat += 20) {
    latLines.push({ y: (base.lat1 - lat) / (base.lat1 - base.lat0) * base.h, eq: lat === 0 });
  }
  const animate = full && !reduced;
  const schedule = [];
  {
    const segs = legs.map((leg) => {
      const [x1, y1] = xy(leg.from.place);
      const [x2, y2] = xy(leg.to.place);
      return { d: legPath(x1, y1, x2, y2), len: quadLength(x1, y1, x2, y2) };
    });
    const total = segs.reduce((s, x) => s + x.len, 0) || 1;
    const pps = total / 7;
    let t = 0.7;
    for (const s of segs) {
      const dur = Math.min(1.4, Math.max(0.18, s.len / pps));
      schedule.push({ ...s, start: t, dur });
      t += dur;
    }
  }
  const renderPin = (p, isActive) => {
    const [x, y] = xy(p.place);
    const kind = p.place.kind;
    const cls = "mc-pin" + (p.place.approx ? " mc-pin--approx" : "") + (kind === "home" ? " mc-pin--home" : "") + (isActive ? " mc-pin--active" : "");
    const label = full ? MAP_LABELS[p.key] : null;
    const count = p.letters.length;
    const tip = `${p.place.label}${count ? ` · ${pinDateSpan(p)} · ${count === 1 ? "1 letter" : `${count} letters`}` : ""}`;
    const inboundIdx = legs.findIndex((l) => l.to.key === p.key);
    const arrive = inboundIdx >= 0 ? schedule[inboundIdx].start + schedule[inboundIdx].dur : 0.7;
    const G = animate ? motion.g : "g";
    const gProps = animate ? { initial: false, animate: { opacity: voyage ? 1 : 0 }, transition: { delay: arrive, duration: 0.3 } } : {};
    return /* @__PURE__ */ React.createElement(
      G,
      {
        key: p.key,
        ...gProps,
        className: "mc-stop" + (full && onSelectStop ? " mc-stop--link" : ""),
        onClick: full && onSelectStop ? () => onSelectStop(p.key) : void 0
      },
      /* @__PURE__ */ React.createElement("title", null, tip),
      isActive && /* @__PURE__ */ React.createElement("circle", { cx: x, cy: y, r: "11", className: "route-pin-active-halo" }),
      kind === "home" ? /* @__PURE__ */ React.createElement("path", { d: starPath(x, y, 6.5), className: cls }) : /* @__PURE__ */ React.createElement("circle", { cx: x, cy: y, r: isActive ? 5 : 4.2, className: cls }),
      full && p.n != null && (() => {
        const np = label && label.num || (!label ? { dx: 8, dy: -5, anchor: "start" } : label.anchor === "end" ? { dx: 7, dy: 3, anchor: "start" } : label.anchor === "start" ? { dx: -7, dy: 3, anchor: "end" } : label.dy < 0 ? { dx: 0, dy: 13, anchor: "middle" } : { dx: 0, dy: -8, anchor: "middle" });
        return /* @__PURE__ */ React.createElement("text", { x: x + np.dx, y: y + np.dy, textAnchor: np.anchor, className: "mc-pin-num" }, p.n);
      })(),
      label && /* @__PURE__ */ React.createElement(React.Fragment, null, label.leader && /* @__PURE__ */ React.createElement(
        "line",
        {
          x1: x + (label.anchor === "end" ? -3 : 3) * 1.6,
          y1: y + (label.dy > 0 ? 3 : -3),
          x2: x + label.dx * 0.92,
          y2: y + label.dy - 3,
          className: "mc-leader"
        }
      ), /* @__PURE__ */ React.createElement("text", { x: x + label.dx, y: y + label.dy, textAnchor: label.anchor, className: "mc-label" }, label.text))
    );
  };
  return /* @__PURE__ */ React.createElement(
    "svg",
    {
      viewBox: `0 0 ${base.w} ${base.h}`,
      className: "mc-svg" + (full ? " mc-svg--full" : " mc-svg--mini"),
      preserveAspectRatio: "xMidYMid meet",
      role: full ? "img" : void 0,
      "aria-label": full ? "Chart of the Pacific tracing Gene's journey, 1940 to 1944" : void 0,
      "aria-hidden": full ? void 0 : true
    },
    /* @__PURE__ */ React.createElement("g", { className: "mc-graticule", "aria-hidden": "true" }, lonLines.map((x, i) => /* @__PURE__ */ React.createElement("line", { key: `lon${i}`, x1: x, y1: "0", x2: x, y2: base.h })), latLines.map((l, i) => /* @__PURE__ */ React.createElement(
      "line",
      {
        key: `lat${i}`,
        x1: "0",
        y1: l.y,
        x2: base.w,
        y2: l.y,
        className: l.eq ? "mc-grat-eq" : void 0
      }
    ))),
    /* @__PURE__ */ React.createElement("g", { "aria-hidden": "true" }, base.land.map((d, i) => /* @__PURE__ */ React.createElement("path", { key: i, d, className: "mc-land" })), base.lakes.map((d, i) => /* @__PURE__ */ React.createElement("path", { key: `lk${i}`, d, className: "mc-lake" }))),
    full && /* @__PURE__ */ React.createElement("rect", { x: "0.5", y: "0.5", width: base.w - 1, height: base.h - 1, className: "mc-neatline", "aria-hidden": "true" }),
    full && /* @__PURE__ */ React.createElement(CompassRose, { x: 615, y: 478 }),
    /* @__PURE__ */ React.createElement("g", { "aria-hidden": "true" }, legs.map((leg, i) => {
      const { d, start, dur } = schedule[i];
      const cls = "mc-leg" + (leg.approx ? " mc-leg--approx" : "");
      if (!animate) return /* @__PURE__ */ React.createElement("path", { key: i, d, className: cls });
      if (!leg.approx) {
        return /* @__PURE__ */ React.createElement(
          motion.path,
          {
            key: i,
            d,
            className: cls,
            initial: false,
            animate: { pathLength: voyage ? 1 : 0 },
            transition: { delay: start, duration: dur, ease: "linear" }
          }
        );
      }
      const mid = `mc-reveal-${i}`;
      return /* @__PURE__ */ React.createElement("g", { key: i }, /* @__PURE__ */ React.createElement("mask", { id: mid, maskUnits: "userSpaceOnUse" }, /* @__PURE__ */ React.createElement(
        motion.path,
        {
          d,
          fill: "none",
          stroke: "#fff",
          strokeWidth: "6",
          strokeLinecap: "round",
          initial: false,
          animate: { pathLength: voyage ? 1 : 0 },
          transition: { delay: start, duration: dur, ease: "linear" }
        }
      )), /* @__PURE__ */ React.createElement("path", { d, className: cls, mask: `url(#${mid})` }));
    })),
    pins.map((p) => renderPin(p, p.key === activePlace)),
    extraPin && renderPin(extraPin, true)
  );
}
function JourneyPage({ journey, onSelectStop, focusPlace }) {
  return /* @__PURE__ */ React.createElement("section", { className: "journey-page" }, /* @__PURE__ */ React.createElement("h2", { className: "journey-title" }, "Map"), /* @__PURE__ */ React.createElement("div", { className: "journey-dates" }, "Great Lakes to the Solomon Islands, and home · 1940 – 1944"), /* @__PURE__ */ React.createElement("div", { className: "hairline-rule" }), /* @__PURE__ */ React.createElement("div", { className: "journey-chart" }, /* @__PURE__ */ React.createElement(MapChart, { journey, mode: "full", activePlace: focusPlace, onSelectStop })), /* @__PURE__ */ React.createElement("ol", { className: "journey-legend" }, journey.pins.map((p) => /* @__PURE__ */ React.createElement("li", { key: p.key }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "journey-stop" + (focusPlace === p.key ? " is-focus" : ""),
      onClick: () => onSelectStop(p.key)
    },
    /* @__PURE__ */ React.createElement("span", { className: "js-num" }, p.n),
    /* @__PURE__ */ React.createElement("span", { className: "js-meta" }, /* @__PURE__ */ React.createElement("span", { className: "js-label" }, p.place.label), /* @__PURE__ */ React.createElement("span", { className: "js-dates" }, pinDateSpan(p), " · ", p.letters.length === 1 ? "1 letter" : `${p.letters.length} letters`))
  )))));
}
function LetterWaypoint({ letter, journey, onOpenJourney }) {
  const place = PLACES[letter.place];
  if (!MAP_BASE || !place || !journey || !journey.stops.length) return null;
  const approx = !!place.approx;
  return /* @__PURE__ */ React.createElement("div", { className: "letter-waypoint" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "letter-waypoint-map",
      onClick: () => onOpenJourney(letter.place),
      "aria-label": `The journey so far. This letter was written from ${place.label}${approx ? " (position reconstructed)" : ""}. Open the full journey map.`
    },
    /* @__PURE__ */ React.createElement(MapChart, { journey, mode: "mini", activePlace: letter.place, visibleThrough: letter.date })
  ), /* @__PURE__ */ React.createElement("div", { className: "letter-waypoint-caption" }, /* @__PURE__ */ React.createElement("span", { className: "lw-place" }, place.label), approx && /* @__PURE__ */ React.createElement("span", { className: "lw-approx" }, "position reconstructed"), /* @__PURE__ */ React.createElement("span", { className: "lw-link", "aria-hidden": "true" }, "the journey so far · tap for the full map")));
}
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
  const webs = letter.images_web || imgs;
  const src = `${letter.folder}/${webs[k - 1]}`;
  const fullSrc = `${letter.folder}/${imgs[k - 1]}`;
  const alt = `Original handwritten letter, page ${k} of ${total}, dated ${letter.date_label}`;
  return /* @__PURE__ */ React.createElement("div", { className: "lightbox", role: "dialog", "aria-modal": "true", onClick: onClose }, /* @__PURE__ */ React.createElement("button", { className: "lb-close", ref: closeRef, onClick: onClose, "aria-label": "Close" }, "×"), /* @__PURE__ */ React.createElement("div", { className: "lb-stage", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "lb-frame" }, /* @__PURE__ */ React.createElement("img", { src, alt })), /* @__PURE__ */ React.createElement("div", { className: "lb-meta" }, /* @__PURE__ */ React.createElement("span", { className: "lb-meta-date" }, letter.date_label), /* @__PURE__ */ React.createElement("a", { className: "lb-full", href: fullSrc, target: "_blank", rel: "noopener noreferrer" }, "full resolution"), /* @__PURE__ */ React.createElement("span", { className: "lb-counter" }, String(k).padStart(2, "0"), " / ", String(total).padStart(2, "0")))), total > 1 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("button", { className: "lb-nav lb-prev", onClick: (e) => {
    e.stopPropagation();
    onNav(-1);
  }, "aria-label": "Previous page" }, "‹"), /* @__PURE__ */ React.createElement("button", { className: "lb-nav lb-next", onClick: (e) => {
    e.stopPropagation();
    onNav(1);
  }, "aria-label": "Next page" }, "›")));
}
function Postmark({ letter }) {
  const place = {
    "great-lakes": "GREAT LAKES",
    "san-diego": "SAN DIEGO",
    "pearl-harbor": "PEARL HARBOR"
  }[letter.location_chapter] || "U.S. NAVY";
  const m = letter.date.match(/(\d{4})-(\d{2})-(\d{2})/);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const monthAbbr = m ? months[parseInt(m[2], 10) - 1] : "";
  const day = m ? parseInt(m[3], 10) : "";
  const year = m ? m[1] : "";
  const arcTopId = `pm-arc-top-${letter.id}`;
  const arcBotId = `pm-arc-bot-${letter.id}`;
  return /* @__PURE__ */ React.createElement("svg", { className: "postmark", viewBox: "0 0 100 100", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("path", { id: arcTopId, d: "M 23 50 a 27 27 0 0 1 54 0", fill: "none" }), /* @__PURE__ */ React.createElement("path", { id: arcBotId, d: "M 21 50 a 29 29 0 0 0 58 0", fill: "none" })), /* @__PURE__ */ React.createElement("circle", { cx: "50", cy: "50", r: "44", className: "pm-ring-outer" }), /* @__PURE__ */ React.createElement("circle", { cx: "50", cy: "50", r: "40", className: "pm-ring-mid" }), /* @__PURE__ */ React.createElement("circle", { cx: "50", cy: "50", r: "36", className: "pm-ring-inner" }), /* @__PURE__ */ React.createElement("line", { x1: "0", y1: "50", x2: "14", y2: "50", className: "pm-cancel" }), /* @__PURE__ */ React.createElement("line", { x1: "86", y1: "50", x2: "100", y2: "50", className: "pm-cancel" }), /* @__PURE__ */ React.createElement("text", { className: "pm-arc-text", fontSize: "6.4" }, /* @__PURE__ */ React.createElement("textPath", { href: `#${arcTopId}`, startOffset: "50%", textAnchor: "middle" }, place)), /* @__PURE__ */ React.createElement("text", { x: "50", y: "49", textAnchor: "middle", className: "pm-month" }, monthAbbr), /* @__PURE__ */ React.createElement("text", { x: "50", y: "64", textAnchor: "middle", className: "pm-day" }, day), /* @__PURE__ */ React.createElement("text", { className: "pm-arc-text", fontSize: "5.6" }, /* @__PURE__ */ React.createElement("textPath", { href: `#${arcBotId}`, startOffset: "50%", textAnchor: "middle" }, year, "  ·  U.S. NAVY")));
}
function LetterHeader({ letter }) {
  const weather = window.LETTER_WEATHER && window.LETTER_WEATHER[letter.id] || null;
  const ph = pearlHarborMarker(letter.date);
  return /* @__PURE__ */ React.createElement("header", { className: "letter-head" }, /* @__PURE__ */ React.createElement("div", { className: "letter-num" }, /* @__PURE__ */ React.createElement("em", null, letter.date_label)), /* @__PURE__ */ React.createElement("div", { className: "letter-stamp" }, letter.location_stamp), weather && !weather.error && /* @__PURE__ */ React.createElement(WeatherGlyph, { weather }), ph && /* @__PURE__ */ React.createElement("div", { className: "letter-countdown", "aria-label": ph.label }, ph.label), /* @__PURE__ */ React.createElement(Postmark, { letter }));
}
function PhotoLink({ letter, onOpen }) {
  const n = letterImages(letter).length;
  return /* @__PURE__ */ React.createElement("button", { className: "photo-link", onClick: () => onOpen(letter, 1) }, "see the original", /* @__PURE__ */ React.createElement("span", { className: "photo-link-meta" }, n === 1 ? "1 page" : `${n} pages`));
}
function Fleuron() {
  return /* @__PURE__ */ React.createElement("div", { className: "fleuron", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { className: "fleuron-glyph", viewBox: "0 0 36 8", width: "36", height: "8" }, /* @__PURE__ */ React.createElement("circle", { cx: "6", cy: "4", r: "1.1", fill: "currentColor", opacity: "0.8" }), /* @__PURE__ */ React.createElement("path", { d: "M 18 0.8 L 21.2 4 L 18 7.2 L 14.8 4 Z", fill: "currentColor" }), /* @__PURE__ */ React.createElement("circle", { cx: "30", cy: "4", r: "1.1", fill: "currentColor", opacity: "0.8" })));
}
function NoteBlock({ text, extraClass }) {
  if (!text) return null;
  const cls = "letter-note" + (extraClass ? ` ${extraClass}` : "");
  return text.split(/\n\n+/).map((para, i) => /* @__PURE__ */ React.createElement("p", { key: i, className: cls }, para));
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function NameMark({ children }) {
  return /* @__PURE__ */ React.createElement("mark", { className: "name-mark" }, children);
}
function renderProse(text, highlight) {
  const terms = highlight && Array.isArray(highlight.terms) ? highlight.terms.filter((t) => t && t.trim().length > 1) : [];
  let splitRe;
  if (terms.length) {
    const alt = terms.slice().sort((a, b) => b.length - a.length).map(escapeRe).join("|");
    splitRe = new RegExp(`(\\[\\[[^\\]]+\\]\\]|\\[\\?\\]|\\[[^\\]]+\\?\\]|\\b(?:${alt})\\b(?!'t\\b))`, "g");
  } else {
    splitRe = /(\[\[[^\]]+\]\]|\[\?\]|\[[^\]]+\?\])/g;
  }
  const termSet = new Set(terms);
  return text.split(splitRe).map((part, i) => {
    if (!part) return null;
    const em = part.match(/^\[\[([^\]]+)\]\]$/);
    if (em) return /* @__PURE__ */ React.createElement(Emphasis, { key: i }, em[1]);
    if (/^\[.*\?\]$/.test(part)) {
      const inner = part.replace(/^\[|\]$/g, "");
      return /* @__PURE__ */ React.createElement("sub", { key: i, className: "uncertain", title: "Uncertain reading" }, inner);
    }
    if (termSet.has(part)) {
      return /* @__PURE__ */ React.createElement(NameMark, { key: `${i}-${highlight.token}` }, part);
    }
    return /* @__PURE__ */ React.createElement(React.Fragment, { key: i }, part);
  });
}
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
  return /* @__PURE__ */ React.createElement("article", { ref, className: "letter-card", id: `letter-${letter.id}`, "aria-label": `Letter, ${letter.date_label}` }, /* @__PURE__ */ React.createElement(LetterHeader, { letter }), /* @__PURE__ */ React.createElement("div", { className: "letter-body" }, /* @__PURE__ */ React.createElement("div", { className: "salutation" }, letter.salutation), paragraphs.map((para, i) => {
    if (i === 0 && /^[A-Za-z]/.test(para)) {
      return /* @__PURE__ */ React.createElement("p", { key: i, className: "has-dropcap" }, /* @__PURE__ */ React.createElement("span", { className: "dropcap" }, para.charAt(0)), renderProse(para.slice(1), highlight));
    }
    return /* @__PURE__ */ React.createElement("p", { key: i }, renderProse(para, highlight));
  }), letter.partial && /* @__PURE__ */ React.createElement("p", { className: "incomplete-marker" }, "[the letter continues]"), /* @__PURE__ */ React.createElement("div", { className: "signature" }, letter.signature), letter.postscript && /* @__PURE__ */ React.createElement(Fleuron, null), letter.postscript && /* @__PURE__ */ React.createElement("p", { className: "postscript" }, /* @__PURE__ */ React.createElement("span", { className: "ps-mark" }, "P.S."), " ", renderProse(letter.postscript, highlight))), hasNote && /* @__PURE__ */ React.createElement(Fleuron, null), /* @__PURE__ */ React.createElement(NoteBlock, { text: letter.note }), letter.partial && /* @__PURE__ */ React.createElement("p", { className: "letter-note" }, "Transcription incomplete; the remainder is being verified."), letterImages(letter).length > 0 && /* @__PURE__ */ React.createElement(PhotoLink, { letter, onOpen }));
}
function DraftCard({ letter, onOpen, highlight }) {
  const paragraphs = letter.body.split(/\n\n+/);
  const ref = useRef(null);
  useHighlightScroll(ref, highlight);
  return /* @__PURE__ */ React.createElement("article", { ref, className: "letter-card letter-card--draft", id: `letter-${letter.id}`, "aria-label": `Letter, ${letter.date_label}` }, /* @__PURE__ */ React.createElement(LetterHeader, { letter }), /* @__PURE__ */ React.createElement("div", { className: "letter-body" }, /* @__PURE__ */ React.createElement("div", { className: "salutation" }, letter.salutation), paragraphs.map((para, i) => {
    if (i === 0 && /^[A-Za-z]/.test(para)) {
      return /* @__PURE__ */ React.createElement("p", { key: i, className: "has-dropcap" }, /* @__PURE__ */ React.createElement("span", { className: "dropcap" }, para.charAt(0)), renderProse(para.slice(1), highlight));
    }
    return /* @__PURE__ */ React.createElement("p", { key: i }, renderProse(para, highlight));
  }), /* @__PURE__ */ React.createElement("div", { className: "signature" }, letter.signature)), /* @__PURE__ */ React.createElement(Fleuron, null), /* @__PURE__ */ React.createElement(NoteBlock, { text: letter.note }), /* @__PURE__ */ React.createElement("p", { className: "letter-note" }, "Some words are still being verified."), letterImages(letter).length > 0 && /* @__PURE__ */ React.createElement(PhotoLink, { letter, onOpen }));
}
function EnvelopeCard({ letter, onOpen }) {
  const imgs = letterImages(letter);
  return /* @__PURE__ */ React.createElement("article", { className: "letter-card letter-card--envelope", id: `letter-${letter.id}`, "aria-label": `Envelope, ${letter.date_label}` }, /* @__PURE__ */ React.createElement(LetterHeader, { letter }), imgs.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "envelope-stage" }, /* @__PURE__ */ React.createElement("button", { className: "envelope-img", onClick: () => onOpen(letter, 1) }, /* @__PURE__ */ React.createElement(
    "img",
    {
      src: `${letter.folder}/${(letter.images_web || imgs)[0]}`,
      loading: "lazy",
      decoding: "async",
      alt: `Original envelope, postmarked ${letter.date_label}`
    }
  ))), /* @__PURE__ */ React.createElement("p", { className: "letter-note envelope-note" }, "The letter inside has been lost."), /* @__PURE__ */ React.createElement(NoteBlock, { text: letter.envelope_note }));
}
function ChristmasCardCard({ letter, onOpen }) {
  const imgs = letterImages(letter);
  const cardFile = letter.card_image && imgs.includes(letter.card_image) ? letter.card_image : imgs.find((f) => !f.includes("envelope")) || imgs[0];
  const cardPage = imgs.indexOf(cardFile) + 1;
  return /* @__PURE__ */ React.createElement("article", { className: "letter-card letter-card--xmas", id: `letter-${letter.id}`, "aria-label": `Christmas card, ${letter.date_label}` }, /* @__PURE__ */ React.createElement("div", { className: "brass-rule" }), /* @__PURE__ */ React.createElement(LetterHeader, { letter }), /* @__PURE__ */ React.createElement("div", { className: "xmas-stage" }, cardFile && /* @__PURE__ */ React.createElement("button", { className: "xmas-img", onClick: () => onOpen(letter, cardPage) }, /* @__PURE__ */ React.createElement(
    "img",
    {
      src: `${letter.folder}/${(letter.images_web || imgs)[cardPage - 1]}`,
      loading: "lazy",
      decoding: "async",
      alt: `Original Christmas card, dated ${letter.date_label}`
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "xmas-verse" }, letter.card_verse.split("\n").map((line, i) => /* @__PURE__ */ React.createElement("div", { key: i }, line))), /* @__PURE__ */ React.createElement("div", { className: "xmas-cartouche" }, "Christmas · ", letter.date.slice(0, 4))), /* @__PURE__ */ React.createElement("div", { className: "signature signature--xmas" }, letter.signature), /* @__PURE__ */ React.createElement(NoteBlock, { text: letter.card_note }), letterImages(letter).length > 0 && /* @__PURE__ */ React.createElement(PhotoLink, { letter, onOpen }), /* @__PURE__ */ React.createElement("div", { className: "brass-rule" }));
}
function TelegramCard({ letter, onOpen }) {
  return /* @__PURE__ */ React.createElement("article", { className: "letter-card letter-card--telegram", id: `letter-${letter.id}`, "aria-label": `Telegram, ${letter.date_label}` }, /* @__PURE__ */ React.createElement(LetterHeader, { letter }), /* @__PURE__ */ React.createElement("div", { className: "telegram-paper" }, /* @__PURE__ */ React.createElement("div", { className: "telegram-letterhead" }, "Postal Telegraph · Commercial Cables"), /* @__PURE__ */ React.createElement("div", { className: "telegram-head" }, /* @__PURE__ */ React.createElement("span", null, "POSTAL TELEGRAPH"), /* @__PURE__ */ React.createElement("span", null, "HOLIDAY GREETINGS")), /* @__PURE__ */ React.createElement("div", { className: "telegram-routing" }, letter.telegram_routing), /* @__PURE__ */ React.createElement("div", { className: "telegram-to" }, letter.telegram_to.split("\n").map((line, i) => /* @__PURE__ */ React.createElement("div", { key: i }, line))), /* @__PURE__ */ React.createElement("div", { className: "telegram-message" }, letter.telegram_message), /* @__PURE__ */ React.createElement("div", { className: "telegram-signed" }, letter.telegram_signed)), letterImages(letter).length > 0 && /* @__PURE__ */ React.createElement(PhotoLink, { letter, onOpen }));
}
function SouvenirCard({ letter, onOpen }) {
  const imgs = letterImages(letter);
  return /* @__PURE__ */ React.createElement("article", { className: "letter-card letter-card--souvenir", id: `letter-${letter.id}`, "aria-label": `Souvenir, ${letter.date_label}` }, /* @__PURE__ */ React.createElement(LetterHeader, { letter }), imgs.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "souvenir-stage" }, /* @__PURE__ */ React.createElement("button", { className: "souvenir-img", onClick: () => onOpen(letter, 1), "aria-label": "Open the original souvenir" }, /* @__PURE__ */ React.createElement("div", { className: "souvenir-rot" }, /* @__PURE__ */ React.createElement(
    "img",
    {
      src: `${letter.folder}/${(letter.images_web || imgs)[0]}`,
      loading: "lazy",
      decoding: "async",
      alt: `Souvenir postcard folder, ${letter.date_label}`
    }
  )))), imgs.length > 0 && /* @__PURE__ */ React.createElement(PhotoLink, { letter, onOpen }));
}
function LetterCard({ letter, onOpen, highlight }) {
  switch (letter.status) {
    case "envelope_only":
      return /* @__PURE__ */ React.createElement(EnvelopeCard, { letter, onOpen });
    case "souvenir":
      return /* @__PURE__ */ React.createElement(SouvenirCard, { letter, onOpen });
    case "christmas_card":
      return /* @__PURE__ */ React.createElement(ChristmasCardCard, { letter, onOpen });
    case "telegram":
      return /* @__PURE__ */ React.createElement(TelegramCard, { letter, onOpen });
    case "transcribed_draft":
      return /* @__PURE__ */ React.createElement(DraftCard, { letter, onOpen, highlight });
    case "transcribed_partial":
    case "transcribed":
    default:
      return /* @__PURE__ */ React.createElement(TranscribedCard, { letter, onOpen, highlight });
  }
}
function ShipOrnament() {
  return /* @__PURE__ */ React.createElement("div", { className: "ornament", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("span", { className: "ornament-rule" }), /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 56 56", className: "ornament-anchor" }, /* @__PURE__ */ React.createElement(
    "circle",
    {
      cx: "28",
      cy: "28",
      r: "25",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "0.9",
      strokeDasharray: "1 3",
      opacity: "0.85"
    }
  ), /* @__PURE__ */ React.createElement(
    "circle",
    {
      cx: "28",
      cy: "28",
      r: "22.5",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "0.6",
      opacity: "0.45"
    }
  ), /* @__PURE__ */ React.createElement("circle", { cx: "28", cy: "14", r: "2.6", fill: "none", stroke: "currentColor", strokeWidth: "1.1" }), /* @__PURE__ */ React.createElement("line", { x1: "28", y1: "16.6", x2: "28", y2: "40", stroke: "currentColor", strokeWidth: "1.1", strokeLinecap: "round" }), /* @__PURE__ */ React.createElement("line", { x1: "22", y1: "20", x2: "34", y2: "20", stroke: "currentColor", strokeWidth: "1.1", strokeLinecap: "round" }), /* @__PURE__ */ React.createElement("path", { d: "M 17 34 Q 28 46 39 34", fill: "none", stroke: "currentColor", strokeWidth: "1.1", strokeLinecap: "round" }), /* @__PURE__ */ React.createElement("line", { x1: "17", y1: "34", x2: "15", y2: "32", stroke: "currentColor", strokeWidth: "1.1", strokeLinecap: "round" }), /* @__PURE__ */ React.createElement("line", { x1: "39", y1: "34", x2: "41", y2: "32", stroke: "currentColor", strokeWidth: "1.1", strokeLinecap: "round" }), /* @__PURE__ */ React.createElement("path", { d: "M 6 28 Q 10 26 14 28", fill: "none", stroke: "currentColor", strokeWidth: "0.7", opacity: "0.6" }), /* @__PURE__ */ React.createElement("path", { d: "M 8 27.4 L 8 25.6 M 10.5 26.6 L 10.5 24.7 M 12.5 27 L 12.5 25.3", stroke: "currentColor", strokeWidth: "0.6", opacity: "0.55", strokeLinecap: "round" }), /* @__PURE__ */ React.createElement("path", { d: "M 50 28 Q 46 26 42 28", fill: "none", stroke: "currentColor", strokeWidth: "0.7", opacity: "0.6" }), /* @__PURE__ */ React.createElement("path", { d: "M 48 27.4 L 48 25.6 M 45.5 26.6 L 45.5 24.7 M 43.5 27 L 43.5 25.3", stroke: "currentColor", strokeWidth: "0.6", opacity: "0.55", strokeLinecap: "round" })), /* @__PURE__ */ React.createElement("span", { className: "ornament-rule" }));
}
function ShipSilhouette() {
  return /* @__PURE__ */ React.createElement("div", { className: "ship-horizon", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { className: "ship-silhouette", viewBox: "0 0 800 130", preserveAspectRatio: "xMidYMid meet" }, /* @__PURE__ */ React.createElement("g", { fill: "currentColor" }, /* @__PURE__ */ React.createElement("path", { d: "M 60 92 L 80 82 L 130 80 L 700 80 L 738 84 L 744 92 L 738 100 L 70 100 Z" }), /* @__PURE__ */ React.createElement("path", { d: "M 130 80 L 130 70 L 280 70 L 290 80 Z" }), /* @__PURE__ */ React.createElement("rect", { x: "160", y: "60", width: "44", height: "11", rx: "1.5" }), /* @__PURE__ */ React.createElement("rect", { x: "120", y: "63", width: "44", height: "2.4" }), /* @__PURE__ */ React.createElement("rect", { x: "120", y: "68", width: "44", height: "2.4" }), /* @__PURE__ */ React.createElement("rect", { x: "310", y: "56", width: "170", height: "24" }), /* @__PURE__ */ React.createElement("rect", { x: "340", y: "40", width: "56", height: "16" }), /* @__PURE__ */ React.createElement("rect", { x: "356", y: "28", width: "24", height: "12" }), /* @__PURE__ */ React.createElement("rect", { x: "367", y: "6", width: "2", height: "22" }), /* @__PURE__ */ React.createElement("line", { x1: "357", y1: "28", x2: "367", y2: "10", stroke: "currentColor", strokeWidth: "1.6" }), /* @__PURE__ */ React.createElement("line", { x1: "378", y1: "28", x2: "368", y2: "10", stroke: "currentColor", strokeWidth: "1.6" }), /* @__PURE__ */ React.createElement("rect", { x: "362", y: "14", width: "11", height: "3" }), /* @__PURE__ */ React.createElement("path", { d: "M 408 56 L 408 24 L 432 20 L 432 56 Z" }), /* @__PURE__ */ React.createElement("path", { d: "M 452 56 L 452 30 L 476 26 L 476 56 Z" }), /* @__PURE__ */ React.createElement("rect", { x: "500", y: "58", width: "68", height: "22" }), /* @__PURE__ */ React.createElement("rect", { x: "525", y: "48", width: "36", height: "10" }), /* @__PURE__ */ React.createElement("rect", { x: "540", y: "30", width: "2", height: "18" }), /* @__PURE__ */ React.createElement("rect", { x: "568", y: "72", width: "120", height: "8" }), /* @__PURE__ */ React.createElement("rect", { x: "600", y: "62", width: "40", height: "10", rx: "1.5" }), /* @__PURE__ */ React.createElement("rect", { x: "635", y: "65", width: "44", height: "2.4" }), /* @__PURE__ */ React.createElement("rect", { x: "635", y: "70", width: "44", height: "2.4" }), /* @__PURE__ */ React.createElement("rect", { x: "730", y: "74", width: "1.6", height: "10" }))));
}
function TitlePage() {
  return /* @__PURE__ */ React.createElement("section", { className: "title-page" }, /* @__PURE__ */ React.createElement("div", { className: "title-hero" }, /* @__PURE__ */ React.createElement(ShipOrnament, null), /* @__PURE__ */ React.createElement("h1", { className: "title" }, "Love, Always"), /* @__PURE__ */ React.createElement("p", { className: "subtitle" }, "Raymond Eugene Lankford", /* @__PURE__ */ React.createElement("br", null), "to Joan Northcutt"), /* @__PURE__ */ React.createElement("p", { className: "title-locator" }, /* @__PURE__ */ React.createElement("span", null, "U.S.S. New Orleans"), /* @__PURE__ */ React.createElement("span", { className: "locator-mark", "aria-hidden": "true" }, "✦"), /* @__PURE__ */ React.createElement("span", null, "Stanford, Kentucky")), /* @__PURE__ */ React.createElement(ShipSilhouette, null)));
}
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
  return /* @__PURE__ */ React.createElement("span", { ref, className: "emphasis" + (revealed ? " is-revealed" : "") }, children);
}
function Closing() {
  return /* @__PURE__ */ React.createElement("section", { className: "closing" }, /* @__PURE__ */ React.createElement("div", { className: "hairline-rule" }), /* @__PURE__ */ React.createElement("p", { className: "closing-body" }, "Gene's letters to Joan continued through the war. Less than a year after this last letter of 1940, on the morning of December 7, 1941, he was at Pearl Harbor. A year after that, off Tassafaronga in the Solomon Islands, a Japanese torpedo struck the New Orleans and tore away one hundred and fifty feet of her bow. One hundred and eighty-three of his shipmates went down with it, along with most of Joan's letters back. Gene came home in 1943. He and Joan were married for forty-nine years."), /* @__PURE__ */ React.createElement("div", { className: "hairline-rule" }), /* @__PURE__ */ React.createElement("p", { className: "dedication" }, "For the family who carries his story."));
}
function CastIntro({ cast }) {
  const count = cast && cast.people ? cast.people.length : 0;
  return /* @__PURE__ */ React.createElement("section", { className: "cast-intro" }, /* @__PURE__ */ React.createElement("div", { className: "cast-intro-eyebrow" }, "Reference"), /* @__PURE__ */ React.createElement("h2", { className: "cast-intro-title" }, "Cast of Characters"), /* @__PURE__ */ React.createElement("div", { className: "cast-dates" }, count, " people named in the letters"), /* @__PURE__ */ React.createElement("div", { className: "hairline-rule" }), /* @__PURE__ */ React.createElement("p", { className: "cast-intro-body" }, "Gene wrote of two worlds — the family and friends he left behind in Lincoln County, Kentucky, and the shipmates he found aboard the U.S.S. New Orleans. These are the people he named in his letters, and who they were. Tap any letter mark to read where a name appears."));
}
function CastGroup({ group, people, onJumpToLetter }) {
  const byId = useMemo(() => {
    const m = {};
    for (const l of window.LETTERS || []) m[l.id] = l;
    return m;
  }, []);
  const sorted = useMemo(
    () => [...people].sort((a, b) => (a.sort || a.name || "").localeCompare(b.sort || b.name || "")),
    [people]
  );
  return /* @__PURE__ */ React.createElement("section", { className: "cast-group" }, /* @__PURE__ */ React.createElement("header", { className: "cast-group-head" }, /* @__PURE__ */ React.createElement("div", { className: "cast-group-eyebrow" }, group.label), group.blurb && /* @__PURE__ */ React.createElement("div", { className: "cast-group-blurb" }, group.blurb), /* @__PURE__ */ React.createElement("div", { className: "brass-rule" })), /* @__PURE__ */ React.createElement("div", { className: "cast-list" }, sorted.map((p) => {
    const isPrincipal = p.group === "principals";
    const hasPortrait = !!(p.photo && p.photo.src);
    return /* @__PURE__ */ React.createElement(
      "article",
      {
        key: p.id,
        className: "cast-person" + (hasPortrait || isPrincipal ? " cast-person--portrait" : ""),
        id: `person-${p.id}`
      },
      hasPortrait ? /* @__PURE__ */ React.createElement("figure", { className: "cast-portrait" }, /* @__PURE__ */ React.createElement("img", { src: p.photo.src + ASSET_V, alt: p.photo.alt || p.name, loading: "lazy" }), p.photo.caption && /* @__PURE__ */ React.createElement("figcaption", null, p.photo.caption)) : isPrincipal ? /* @__PURE__ */ React.createElement("div", { className: "cast-portrait cast-portrait--empty", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("span", null, "photograph", /* @__PURE__ */ React.createElement("br", null), "to come")) : null,
      /* @__PURE__ */ React.createElement("div", { className: "cast-person-text" }, /* @__PURE__ */ React.createElement("div", { className: "cast-person-name" }, p.name, p.uncertain && /* @__PURE__ */ React.createElement("span", { className: "cast-uncertain", title: "Identity or reading uncertain" }, "?")), p.relation && /* @__PURE__ */ React.createElement("div", { className: "cast-person-relation" }, p.relation), p.bio && /* @__PURE__ */ React.createElement("p", { className: "cast-person-bio" }, p.bio), Array.isArray(p.letters) && p.letters.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "cast-letters" }, /* @__PURE__ */ React.createElement("span", { className: "cast-letters-label" }, "Appears in"), p.letters.map((id) => {
        const meta = byId[id];
        return /* @__PURE__ */ React.createElement(
          "button",
          {
            key: id,
            className: "cast-chip",
            onClick: () => meta && onJumpToLetter(id, p.aliases),
            disabled: !meta,
            title: meta ? meta.date_label : `${id} (not on the site)`
          },
          id
        );
      })))
    );
  })));
}
function ChapterDivider({ chapter, letters, allChapters, allLetters }) {
  return /* @__PURE__ */ React.createElement("section", { className: "chapter-divider" }, /* @__PURE__ */ React.createElement("div", { className: "chapter-watermark", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("span", { className: "chapter-watermark-text" }, chapter.numeral)), /* @__PURE__ */ React.createElement("div", { className: "chapter-numeral" }, "Chapter ", chapter.numeral), /* @__PURE__ */ React.createElement("h2", { className: "chapter-title" }, chapter.title), /* @__PURE__ */ React.createElement("div", { className: "chapter-loc" }, chapter.location_label), /* @__PURE__ */ React.createElement("div", { className: "chapter-dates" }, dateRange(letters)), /* @__PURE__ */ React.createElement(RouteDiagram, { activeChapter: chapter.key, chapters: allChapters, letters: allLetters }), /* @__PURE__ */ React.createElement("p", { className: "chapter-bridge" }, chapter.bridge));
}
function toRomanLower(n) {
  const map = [
    [1e3, "m"],
    [900, "cm"],
    [500, "d"],
    [400, "cd"],
    [100, "c"],
    [90, "xc"],
    [50, "l"],
    [40, "xl"],
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"]
  ];
  let out = "", v = n;
  for (const [val, sym] of map) {
    while (v >= val) {
      out += sym;
      v -= val;
    }
  }
  return out;
}
function Folio({ page, totalLetters }) {
  if (page.type === "title" || page.type === "closing") return null;
  if (page.type === "chapter") {
    return /* @__PURE__ */ React.createElement("div", { className: "folio" }, /* @__PURE__ */ React.createElement("span", null, "Chapter ", page.chapter.numeral), /* @__PURE__ */ React.createElement("span", { className: "dot" }, "·"), /* @__PURE__ */ React.createElement("span", null, page.chapter.title));
  }
  if (page.type === "letter") {
    const num = toRomanLower(page.letter.n);
    const total = toRomanLower(totalLetters);
    return /* @__PURE__ */ React.createElement("div", { className: "folio folio--running" }, /* @__PURE__ */ React.createElement("span", { className: "folio-left" }, /* @__PURE__ */ React.createElement("span", { className: "folio-chapter-title" }, page.chapter.title), /* @__PURE__ */ React.createElement("span", { className: "folio-sep" }, "·"), /* @__PURE__ */ React.createElement("span", { className: "folio-chapter-num" }, page.chapter.numeral)), /* @__PURE__ */ React.createElement("span", { className: "folio-right" }, /* @__PURE__ */ React.createElement("span", { className: "folio-no" }, "Nº"), /* @__PURE__ */ React.createElement("span", { className: "folio-num" }, num), /* @__PURE__ */ React.createElement("span", { className: "folio-slash" }, "/"), /* @__PURE__ */ React.createElement("span", { className: "folio-num" }, total)));
  }
  return null;
}
function PhotoGallery({ gallery, onOpenPhoto }) {
  const items = gallery.items || [];
  return /* @__PURE__ */ React.createElement("section", { className: "gallery" }, /* @__PURE__ */ React.createElement("header", { className: "gallery-head" }, /* @__PURE__ */ React.createElement("div", { className: "gallery-eyebrow" }, "Hawaii · 1940–1941"), /* @__PURE__ */ React.createElement("h2", { className: "gallery-title" }, gallery.title), gallery.blurb && /* @__PURE__ */ React.createElement("p", { className: "gallery-blurb" }, gallery.blurb), /* @__PURE__ */ React.createElement("div", { className: "brass-rule" })), /* @__PURE__ */ React.createElement("div", { className: "gallery-grid" }, items.map((it, i) => /* @__PURE__ */ React.createElement("figure", { key: it.id, className: "gallery-item" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "gallery-thumb",
      onClick: () => onOpenPhoto(items, i),
      "aria-label": it.caption || it.alt || "Open photograph"
    },
    /* @__PURE__ */ React.createElement("img", { src: it.front + ASSET_V, alt: it.alt || it.caption || "Photograph from the archive", loading: "lazy" })
  ), it.caption && /* @__PURE__ */ React.createElement("figcaption", null, it.caption)))));
}
function PhotoLightbox({ items, index, onClose }) {
  const [idx, setIdx] = useState(index || 0);
  const [showBack, setShowBack] = useState(false);
  const closeRef = useRef(null);
  useDialogFocus(closeRef);
  const go = useCallback((d) => {
    setIdx((i) => Math.max(0, Math.min(items.length - 1, i + d)));
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
  const src = showBack && item.back ? item.back : item.front;
  const metaLabel = showBack ? item.caption_source || "The reverse" : item.caption || "";
  return /* @__PURE__ */ React.createElement("div", { className: "lightbox", role: "dialog", "aria-modal": "true", onClick: onClose }, /* @__PURE__ */ React.createElement("button", { className: "lb-close", ref: closeRef, onClick: onClose, "aria-label": "Close" }, "×"), /* @__PURE__ */ React.createElement("div", { className: "lb-stage", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "lb-frame" }, /* @__PURE__ */ React.createElement("img", { src: src + ASSET_V, alt: item.alt || item.caption || "Photograph from the archive" })), /* @__PURE__ */ React.createElement("div", { className: "lb-meta" }, /* @__PURE__ */ React.createElement("span", { className: "lb-meta-date" }, metaLabel), /* @__PURE__ */ React.createElement("span", { className: "lb-counter" }, String(idx + 1).padStart(2, "0"), " / ", String(items.length).padStart(2, "0"))), item.back && /* @__PURE__ */ React.createElement("button", { className: "lb-flip", onClick: (e) => {
    e.stopPropagation();
    setShowBack((b) => !b);
  } }, showBack ? "see the front" : "turn over")), items.length > 1 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("button", { className: "lb-nav lb-prev", onClick: (e) => {
    e.stopPropagation();
    go(-1);
  }, "aria-label": "Previous photograph" }, "‹"), /* @__PURE__ */ React.createElement("button", { className: "lb-nav lb-next", onClick: (e) => {
    e.stopPropagation();
    go(1);
  }, "aria-label": "Next photograph" }, "›")));
}
function PageContent({ page, totalLetters, onOpen, onNext, allChapters, allLetters, onJumpToLetter, onOpenPhoto, highlight, journey, onSelectStop, onOpenJourney, focusPlace }) {
  return /* @__PURE__ */ React.createElement("main", { className: "archive" }, /* @__PURE__ */ React.createElement(Folio, { page, totalLetters }), page.type === "title" && /* @__PURE__ */ React.createElement(TitlePage, null), page.type === "journey" && /* @__PURE__ */ React.createElement(JourneyPage, { journey, onSelectStop, focusPlace }), page.type === "chapter" && /* @__PURE__ */ React.createElement(
    ChapterDivider,
    {
      chapter: page.chapter,
      letters: page.letters,
      allChapters,
      allLetters
    }
  ), page.type === "letter" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
    LetterCard,
    {
      letter: page.letter,
      onOpen,
      highlight: highlight && highlight.letterId === page.letter.id ? highlight : null
    }
  ), /* @__PURE__ */ React.createElement(LetterWaypoint, { letter: page.letter, journey, onOpenJourney })), page.type === "cast-intro" && /* @__PURE__ */ React.createElement(CastIntro, { cast: page.cast }), page.type === "gallery" && /* @__PURE__ */ React.createElement(PhotoGallery, { gallery: page.gallery, onOpenPhoto }), page.type === "cast-group" && /* @__PURE__ */ React.createElement(CastGroup, { group: page.group, people: page.people, onJumpToLetter }), page.type === "closing" && /* @__PURE__ */ React.createElement(Closing, null));
}
function NavChrome({ pageIdx, total, onPrev, onNext, onToc }) {
  return /* @__PURE__ */ React.createElement("div", { className: "nav-chrome", role: "navigation" }, /* @__PURE__ */ React.createElement("button", { className: "nav-btn nav-prev", onClick: onPrev, disabled: pageIdx === 0 }, /* @__PURE__ */ React.createElement("span", { className: "nav-arrow" }, "‹"), " Previous"), /* @__PURE__ */ React.createElement("button", { className: "toc-btn", onClick: onToc }, "Contents"), /* @__PURE__ */ React.createElement("button", { className: "nav-btn nav-next", onClick: onNext, disabled: pageIdx === total - 1 }, "Next ", /* @__PURE__ */ React.createElement("span", { className: "nav-arrow" }, "›")));
}
function ProgressBar({ pageIdx, total, pages, isVisible }) {
  const pct = total <= 1 ? 0 : pageIdx / (total - 1) * 100;
  const chapterMarkers = useMemo(() => {
    const out = [];
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].type === "chapter") {
        out.push({ idx: i, pct: total <= 1 ? 0 : i / (total - 1) * 100, key: pages[i].chapter.key });
      }
    }
    return out;
  }, [pages, total]);
  return /* @__PURE__ */ React.createElement("div", { className: "progress" + (isVisible ? " is-visible" : ""), "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("div", { className: "progress-track" }), /* @__PURE__ */ React.createElement("div", { className: "progress-fill", style: { width: `${pct}%` } }), chapterMarkers.map((m) => /* @__PURE__ */ React.createElement(
    "span",
    {
      key: m.key,
      className: "progress-marker" + (pageIdx >= m.idx ? " is-active" : ""),
      style: { left: `${m.pct}%` }
    }
  )));
}
function statusDotClass(status) {
  switch (status) {
    case "envelope_only":
      return "toc-status toc-status--envelope";
    case "transcribed_draft":
      return "toc-status toc-status--draft";
    case "christmas_card":
    case "telegram":
      return "toc-status toc-status--special";
    default:
      return "toc-status toc-status--transcribed";
  }
}
function TableOfContents({ pages, currentIdx, onJump, onClose, totalLetters }) {
  const closeRef = useRef(null);
  useDialogFocus(closeRef);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const sections = [];
  let titleIdx = pages.findIndex((p) => p.type === "title");
  let journeyIdx = pages.findIndex((p) => p.type === "journey");
  let closingIdx = pages.findIndex((p) => p.type === "closing");
  let castIntroIdx = pages.findIndex((p) => p.type === "cast-intro");
  let galleryIdx = pages.findIndex((p) => p.type === "gallery");
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
  return /* @__PURE__ */ React.createElement("div", { className: "toc-overlay", onClick: onClose }, /* @__PURE__ */ React.createElement("div", { className: "toc-panel", onClick: (e) => e.stopPropagation(), role: "dialog", "aria-modal": "true", "aria-label": "Table of contents" }, /* @__PURE__ */ React.createElement("button", { className: "toc-close", ref: closeRef, onClick: onClose, "aria-label": "Close" }, "×"), /* @__PURE__ */ React.createElement("div", { className: "toc-header" }, /* @__PURE__ */ React.createElement("div", { className: "toc-header-eyebrow" }, "Contents"), /* @__PURE__ */ React.createElement("h2", { className: "toc-title" }, "Love, Always"), /* @__PURE__ */ React.createElement("div", { className: "toc-sub" }, totalLetters, " letters · 1940 – 1943")), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "toc-entry" + (currentIdx === titleIdx ? " is-current" : ""),
      onClick: () => onJump(titleIdx)
    },
    /* @__PURE__ */ React.createElement("span", { className: "toc-num" }, "—"),
    /* @__PURE__ */ React.createElement("span", { className: "toc-date" }, "Title page")
  ), journeyIdx >= 0 && /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "toc-entry" + (currentIdx === journeyIdx ? " is-current" : ""),
      onClick: () => onJump(journeyIdx)
    },
    /* @__PURE__ */ React.createElement("span", { className: "toc-num" }, "—"),
    /* @__PURE__ */ React.createElement("span", { className: "toc-date" }, "Map")
  ), sections.map((sec) => {
    const lastLetterIdx = sec.chapterIdx + sec.items.length;
    let progress;
    if (currentIdx <= sec.chapterIdx) progress = 0;
    else if (currentIdx >= lastLetterIdx) progress = 1;
    else progress = (currentIdx - sec.chapterIdx) / sec.items.length;
    return /* @__PURE__ */ React.createElement("div", { key: sec.chapter.key, className: "toc-section" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "toc-section-head" + (currentIdx === sec.chapterIdx ? " is-current" : ""),
        onClick: () => onJump(sec.chapterIdx)
      },
      /* @__PURE__ */ React.createElement("span", { className: "toc-section-numeral" }, "Ch. ", sec.chapter.numeral),
      /* @__PURE__ */ React.createElement("span", { className: "toc-section-title" }, sec.chapter.title),
      /* @__PURE__ */ React.createElement("span", { className: "toc-section-loc" }, sec.items.length),
      /* @__PURE__ */ React.createElement("span", { className: "toc-section-progress", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("span", { className: "toc-section-progress-fill", style: { width: `${progress * 100}%` } }))
    ), /* @__PURE__ */ React.createElement("ul", { className: "toc-list" }, sec.items.map((it, idx) => {
      const prevLoc = idx > 0 ? sec.items[idx - 1].letter.location_stamp : null;
      const showLoc = it.letter.location_stamp !== prevLoc;
      const isActive = currentIdx === it.idx;
      return /* @__PURE__ */ React.createElement("li", { key: it.letter.id }, /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "toc-item" + (isActive ? " is-current" : ""),
          onClick: () => onJump(it.idx)
        },
        /* @__PURE__ */ React.createElement("span", { className: statusDotClass(it.letter.status), "aria-hidden": "true" }),
        /* @__PURE__ */ React.createElement("span", { className: "toc-num" }, String(it.letter.n).padStart(2, "0")),
        /* @__PURE__ */ React.createElement("div", { className: "toc-meta" }, /* @__PURE__ */ React.createElement("span", { className: "toc-date" }, it.letter.date_label), showLoc && /* @__PURE__ */ React.createElement("span", { className: "toc-loc" }, it.letter.location_stamp)),
        isActive && /* @__PURE__ */ React.createElement("svg", { className: "toc-anchor", viewBox: "0 0 16 16", width: "14", height: "14", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("circle", { cx: "8", cy: "3", r: "1.5", fill: "none", stroke: "currentColor", strokeWidth: "1.2" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "4.5", x2: "8", y2: "13", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" }), /* @__PURE__ */ React.createElement("line", { x1: "5.5", y1: "6", x2: "10.5", y2: "6", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" }), /* @__PURE__ */ React.createElement("path", { d: "M 3 11 Q 3 14 8 14 Q 13 14 13 11", fill: "none", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" }))
      ));
    })));
  }), castIntroIdx >= 0 && /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "toc-entry" + (currentIdx === castIntroIdx ? " is-current" : ""),
      onClick: () => onJump(castIntroIdx)
    },
    /* @__PURE__ */ React.createElement("span", { className: "toc-num" }, "—"),
    /* @__PURE__ */ React.createElement("span", { className: "toc-date" }, "Cast of Characters")
  ), galleryIdx >= 0 && /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "toc-entry" + (currentIdx === galleryIdx ? " is-current" : ""),
      onClick: () => onJump(galleryIdx)
    },
    /* @__PURE__ */ React.createElement("span", { className: "toc-num" }, "—"),
    /* @__PURE__ */ React.createElement("span", { className: "toc-date" }, "Photographs")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "toc-entry" + (currentIdx === closingIdx ? " is-current" : ""),
      onClick: () => onJump(closingIdx)
    },
    /* @__PURE__ */ React.createElement("span", { className: "toc-num" }, "—"),
    /* @__PURE__ */ React.createElement("span", { className: "toc-date" }, "Closing")
  )));
}
function CoverModal({ onClose }) {
  const closeRef = useRef(null);
  useDialogFocus(closeRef);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);
  return /* @__PURE__ */ React.createElement("div", { className: "cover-backdrop", role: "dialog", "aria-modal": "true", "aria-label": "A note from the grandson", onClick: onClose }, /* @__PURE__ */ React.createElement("div", { className: "cover-popup", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("button", { className: "cover-x", onClick: onClose, "aria-label": "Close" }, "×"), /* @__PURE__ */ React.createElement("p", { className: "cover-salutation" }, "Dear Reader,"), /* @__PURE__ */ React.createElement("p", { className: "cover-body" }, 'My grandfather served aboard the U.S.S. New Orleans: the "NO (Such) Boat," the "Ghost Ship," the "Miracle Ship." From before the war, through the attack on Pearl Harbor, and across her perilous journey, he wrote wartime love letters home to my grandmother.'), /* @__PURE__ */ React.createElement("p", { className: "cover-body" }, "These are those letters."), /* @__PURE__ */ React.createElement("div", { className: "cover-signoff" }, /* @__PURE__ */ React.createElement("p", { className: "cover-signoff-handwritten" }, "Love, Always,"), /* @__PURE__ */ React.createElement("p", { className: "cover-signoff-name" }, "Blake William Morris")), /* @__PURE__ */ React.createElement("div", { className: "cover-context" }, /* @__PURE__ */ React.createElement("div", { className: "cover-context-label" }, "Context:"), /* @__PURE__ */ React.createElement("div", { className: "cover-buttons" }, /* @__PURE__ */ React.createElement(
    "a",
    {
      className: "cover-button cover-button--navy",
      href: "https://www.wkyt.com/2023/02/15/love-always-gene-somerset-family-finds-wwii-love-letters/",
      target: "_blank",
      rel: "noopener noreferrer"
    },
    /* @__PURE__ */ React.createElement("span", { className: "cover-button-label" }, "WKYT"),
    /* @__PURE__ */ React.createElement("span", { className: "cover-button-text" }, "Article")
  ), /* @__PURE__ */ React.createElement(
    "a",
    {
      className: "cover-button cover-button--brass",
      href: "https://www.wkyt.com/video/2023/02/14/watch-somerset-woman-finds-her-fathers-love-letters-sent-her-mother-during-world-war-ii/",
      target: "_blank",
      rel: "noopener noreferrer"
    },
    /* @__PURE__ */ React.createElement("span", { className: "cover-button-label" }, "WKYT"),
    /* @__PURE__ */ React.createElement("span", { className: "cover-button-text" }, "Video")
  ))), /* @__PURE__ */ React.createElement("button", { className: "cover-close", ref: closeRef, onClick: onClose }, "Open the letters")));
}
const CONTEXT_DRAWER_LABEL = "Context";
const CONTEXT_DRAWER_LINKS = [
  { text: "WKYT · Article", href: "https://www.wkyt.com/2023/02/15/love-always-gene-somerset-family-finds-wwii-love-letters/" },
  { text: "WKYT · Video", href: "https://www.wkyt.com/video/2023/02/14/watch-somerset-woman-finds-her-fathers-love-letters-sent-her-mother-during-world-war-ii/" }
];
const CONTEXT_DRAWER_KEY = "context-drawer-collapsed";
function ContextDrawer() {
  const startCollapsed = (() => {
    try {
      return localStorage.getItem(CONTEXT_DRAWER_KEY) === "1";
    } catch (e) {
      return false;
    }
  })();
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [tucking, setTucking] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setRevealed(true), 2450);
    if (startCollapsed) return () => clearTimeout(t1);
    const t2 = setTimeout(() => setOpen(true), 4950);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  const collapse = () => {
    setOpen(false);
    setTucking(true);
    try {
      localStorage.setItem(CONTEXT_DRAWER_KEY, "1");
    } catch (e) {
    }
  };
  const expand = () => {
    setRevealed(true);
    setOpen(true);
    setTucking(false);
    try {
      localStorage.removeItem(CONTEXT_DRAWER_KEY);
    } catch (e) {
    }
  };
  return /* @__PURE__ */ React.createElement(
    "aside",
    {
      className: "context-drawer" + (revealed ? " is-revealed" : "") + (open ? " is-open" : "") + (tucking ? " is-tucking" : ""),
      "aria-label": CONTEXT_DRAWER_LABEL
    },
    /* @__PURE__ */ React.createElement("div", { className: "context-drawer-body", "aria-hidden": open ? void 0 : "true" }, /* @__PURE__ */ React.createElement("span", { className: "context-drawer-eyebrow" }, CONTEXT_DRAWER_LABEL), /* @__PURE__ */ React.createElement("span", { className: "context-drawer-links" }, CONTEXT_DRAWER_LINKS.map((l) => /* @__PURE__ */ React.createElement("a", { key: l.href, className: "context-drawer-link", href: l.href, target: "_blank", rel: "noopener" }, l.text)))),
    /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "context-drawer-handle",
        onClick: open ? collapse : expand,
        "aria-label": open ? "Tuck away" : CONTEXT_DRAWER_LABEL,
        "aria-expanded": open
      },
      /* @__PURE__ */ React.createElement("span", { className: "context-drawer-chevron", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("span", { className: "chev-collapse" }, "‹"), /* @__PURE__ */ React.createElement("span", { className: "chev-expand" }, "›"))
    )
  );
}
function App() {
  const pages = useMemo(() => buildPages(LETTERS, CHAPTERS, window.CAST, window.PHOTOS), []);
  const journey = useMemo(() => buildJourney(LETTERS, PLACES), []);
  const journeyIdx = useMemo(() => pages.findIndex((p) => p.type === "journey"), [pages]);
  const [pageIdx, setPageIdx] = useState(() => parseHashIdx(pages.length - 1));
  const [direction, setDirection] = useState(1);
  const prevIdxRef = useRef(0);
  const [lb, setLb] = useState(null);
  const [plb, setPlb] = useState(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [highlight, setHighlight] = useState(null);
  const [returnToCast, setReturnToCast] = useState(null);
  const [focusPlace, setFocusPlace] = useState(null);
  const tokenRef = useRef(0);
  const swipeRef = useRef(null);
  const reduced = useReducedMotion();
  const goto = useCallback((idx) => {
    setPageIdx((curr) => {
      const next2 = Math.max(0, Math.min(pages.length - 1, idx));
      if (next2 === curr) return curr;
      setDirection(next2 > curr ? 1 : -1);
      prevIdxRef.current = curr;
      return next2;
    });
  }, [pages.length]);
  const jumpToLetter = useCallback((id, aliases) => {
    const idx = pages.findIndex((p) => p.type === "letter" && p.letter && p.letter.id === id);
    if (idx < 0) return;
    tokenRef.current += 1;
    setHighlight({ letterId: id, terms: aliases || [], token: tokenRef.current });
    setReturnToCast(pageIdx);
    goto(idx);
  }, [pages, goto, pageIdx]);
  const openPhoto = useCallback((items, idx) => setPlb({ items, idx }), []);
  const closePhoto = useCallback(() => setPlb(null), []);
  const jumpToPlace = useCallback((key) => {
    const idx = pages.findIndex((p) => p.type === "letter" && p.letter.place === key);
    if (idx >= 0) goto(idx);
  }, [pages, goto]);
  const openJourney = useCallback((key) => {
    setFocusPlace(key || null);
    if (journeyIdx >= 0) goto(journeyIdx);
  }, [goto, journeyIdx]);
  const next = useCallback(() => {
    setPageIdx((curr) => {
      const n = Math.min(pages.length - 1, curr + 1);
      if (n !== curr) {
        setDirection(1);
        prevIdxRef.current = curr;
      }
      return n;
    });
  }, [pages.length]);
  const prev = useCallback(() => {
    setPageIdx((curr) => {
      const n = Math.max(0, curr - 1);
      if (n !== curr) {
        setDirection(-1);
        prevIdxRef.current = curr;
      }
      return n;
    });
  }, [pages.length]);
  useEffect(() => {
    const target = `p=${pageIdx}`;
    if (window.location.hash.replace(/^#/, "") !== target) {
      window.location.hash = target;
    }
  }, [pageIdx]);
  useEffect(() => {
    const onHash = () => {
      const idx = parseHashIdx(pages.length - 1);
      setPageIdx((curr) => idx === curr ? curr : idx);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [pages.length]);
  useEffect(() => {
    if (lb || tocOpen || plb) return;
    const onKey = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "Home") goto(0);
      else if (e.key === "End") goto(pages.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goto, pages.length, lb, tocOpen, plb]);
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
      if (dx < 0) next();
      else prev();
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [next, prev, lb, tocOpen, plb]);
  const currentPage = pages[pageIdx];
  useEffect(() => {
    if (currentPage.type !== "letter") {
      setReturnToCast((curr) => curr === null ? curr : null);
      setHighlight((curr) => curr === null ? curr : null);
    }
    if (currentPage.type !== "journey") {
      setFocusPlace((curr) => curr === null ? curr : null);
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
    return w && !w.error ? w : null;
  }, [currentPage]);
  const isWar = currentPage.type === "chapter" && currentPage.chapter.key === "at-war";
  const isNavy = currentPage.type === "chapter" && !isWar;
  useEffect(() => {
    document.body.classList.toggle("body--navy", isNavy);
    document.body.classList.toggle("body--war", isWar);
  }, [isNavy, isWar]);
  const openLb = useCallback((letter, page = 1) => setLb({ letter, page }), []);
  const closeLb = useCallback(() => setLb(null), []);
  const navLb = useCallback((dir) => {
    setLb((curr) => {
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
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [lb, tocOpen, plb]);
  const totalLetters = LETTERS.length;
  const showProgress = currentPage.type !== "title";
  const variants = useMemo(() => ({
    initial: (dir) => reduced ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? 24 : -24, rotateY: dir > 0 ? 2 : -2 },
    animate: { opacity: 1, x: 0, rotateY: 0 },
    exit: (dir) => reduced ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? -16 : 16, rotateY: dir > 0 ? -1.5 : 1.5 }
  }), [reduced]);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(AtmosphereMount, { chapterKey, weather: currentWeather }), /* @__PURE__ */ React.createElement(ProgressBar, { pageIdx, total: pages.length, pages, isVisible: showProgress }), /* @__PURE__ */ React.createElement("div", { className: "stage", style: { perspective: "1400px" } }, /* @__PURE__ */ React.createElement(AnimatePresence, { mode: "wait", initial: false, custom: direction }, /* @__PURE__ */ React.createElement(
    motion.div,
    {
      key: pageIdx,
      custom: direction,
      variants,
      initial: "initial",
      animate: "animate",
      exit: "exit",
      transition: {
        duration: reduced ? 0 : 0.36,
        ease: [0.22, 1, 0.36, 1]
      },
      className: "page-surface" + (isNavy ? " is-navy" : ""),
      style: { transformStyle: "preserve-3d" }
    },
    /* @__PURE__ */ React.createElement(
      PageContent,
      {
        page: currentPage,
        totalLetters,
        onOpen: openLb,
        onNext: next,
        allChapters: CHAPTERS,
        allLetters: LETTERS,
        onJumpToLetter: jumpToLetter,
        onOpenPhoto: openPhoto,
        highlight,
        journey,
        onSelectStop: jumpToPlace,
        onOpenJourney: openJourney,
        focusPlace
      }
    )
  ))), /* @__PURE__ */ React.createElement(
    NavChrome,
    {
      pageIdx,
      total: pages.length,
      onPrev: prev,
      onNext: next,
      onToc: () => setTocOpen(true)
    }
  ), tocOpen && /* @__PURE__ */ React.createElement(
    TableOfContents,
    {
      pages,
      currentIdx: pageIdx,
      totalLetters,
      onJump: (i) => {
        setTocOpen(false);
        goto(i);
      },
      onClose: () => setTocOpen(false)
    }
  ), lb && /* @__PURE__ */ React.createElement(Lightbox, { letter: lb.letter, page: lb.page, onClose: closeLb, onNav: navLb }), plb && /* @__PURE__ */ React.createElement(PhotoLightbox, { items: plb.items, index: plb.idx, onClose: closePhoto }), returnToCast !== null && currentPage.type === "letter" && /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "return-to-cast",
      onClick: () => {
        goto(returnToCast);
        setReturnToCast(null);
        setHighlight(null);
      }
    },
    /* @__PURE__ */ React.createElement("span", { className: "rtc-arrow" }, "‹"),
    " Back to the Cast"
  ), currentPage.type === "title" && /* @__PURE__ */ React.createElement(ContextDrawer, null));
}
function AtmosphereMount({ chapterKey, weather }) {
  const [mounted, setMounted] = useState(null);
  useLayoutEffect(() => {
    const node = document.getElementById("atmosphere-root");
    if (node) setMounted(node);
  }, []);
  if (!mounted) return null;
  return createPortal(
    /* @__PURE__ */ React.createElement(Atmosphere, { chapterKey, weather, on: !!chapterKey }),
    mounted
  );
}
createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(App, null));
