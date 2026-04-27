/* global React, ReactDOM, ReactDOMClient, FramerMotion, LETTERS, CHAPTERS */
const { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } = React;
const { createPortal } = ReactDOM;
const { createRoot } = ReactDOMClient;
const { motion, AnimatePresence, useReducedMotion } = FramerMotion;

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

function buildPages(letters, chapters) {
  const grouped = groupByChapter(letters, chapters);
  const pages = [{ type: "title" }];
  for (const c of chapters) {
    const ls = grouped[c.key];
    if (!ls || !ls.length) continue;
    pages.push({ type: "chapter", chapter: c, letters: ls });
    for (const l of ls) {
      pages.push({ type: "letter", letter: l, chapter: c });
    }
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
  return (
    <div className="weather-glyph" aria-label={`Weather: ${weatherLabel(kind)}${t ? ", high " + t : ""}`}>
      <WeatherIcon kind={kind} />
      <span>{weatherLabel(kind)}</span>
      {t && <span className="wg-temp">{t}</span>}
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
  // weather animation as normal.
  if (chapterKey === "at-war") return null;

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
/*  Lightbox                                                           */
/* ------------------------------------------------------------------ */

function Lightbox({ letter, page, onClose, onNav }) {
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
  const total = letter.image_count;
  const k = page;
  const src = `${letter.folder}/${letter.id}_p${k}.jpg`;
  const alt = `Original handwritten letter, page ${k} of ${total}, dated ${letter.date_label}`;

  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="lb-close" onClick={onClose} aria-label="Close">×</button>
      <div className="lb-stage" onClick={(e) => e.stopPropagation()}>
        <div className="lb-frame">
          <img src={src} alt={alt} />
        </div>
        <div className="lb-meta">
          <span className="lb-meta-date">{letter.date_label}</span>
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
  return (
    <button className="photo-link" onClick={() => onOpen(letter, 1)}>
      see the original
      <span className="photo-link-meta">
        {letter.image_count === 1 ? "1 page" : `${letter.image_count} pages`}
      </span>
    </button>
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

/* Render a paragraph string, splitting on [[...]] (emphasis) and
   [?]/[word?] (uncertain-reading) markers and wrapping each in the
   right component. Used by both transcribed and draft cards so the
   markers behave the same in either path. */
function renderProse(text) {
  const parts = text.split(/(\[\[[^\]]+\]\]|\[\?\]|\[[^\]]+\?\])/g);
  return parts.map((part, i) => {
    const em = part.match(/^\[\[([^\]]+)\]\]$/);
    if (em) return <Emphasis key={i}>{em[1]}</Emphasis>;
    if (/^\[.*\?\]$/.test(part)) {
      const inner = part.replace(/^\[|\]$/g, "");
      return <sub key={i} className="uncertain" title="Uncertain reading">{inner}</sub>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function TranscribedCard({ letter, onOpen }) {
  const paragraphs = letter.body.split(/\n\n+/);
  return (
    <article className="letter-card" id={`letter-${letter.id}`}>
      <LetterHeader letter={letter} />
      <div className="letter-body">
        <div className="salutation">{letter.salutation}</div>
        {paragraphs.map((para, i) => {
          if (i === 0 && /^[A-Za-z]/.test(para)) {
            return (
              <p key={i} className="has-dropcap">
                <span className="dropcap">{para.charAt(0)}</span>{renderProse(para.slice(1))}
              </p>
            );
          }
          return <p key={i}>{renderProse(para)}</p>;
        })}
        {letter.partial && <p className="incomplete-marker">[the letter continues]</p>}
        <div className="signature">{letter.signature}</div>
        {letter.postscript && (
          <p className="postscript"><span className="ps-mark">P.S.</span> {renderProse(letter.postscript)}</p>
        )}
      </div>
      <NoteBlock text={letter.note} />
      {letter.partial && <p className="letter-note">Transcription incomplete; the remainder is being verified.</p>}
      {letter.image_count > 0 && <PhotoLink letter={letter} onOpen={onOpen} />}
    </article>
  );
}

function DraftCard({ letter, onOpen }) {
  const paragraphs = letter.body.split(/\n\n+/);
  return (
    <article className="letter-card letter-card--draft" id={`letter-${letter.id}`}>
      <LetterHeader letter={letter} />
      <div className="letter-body">
        <div className="salutation">{letter.salutation}</div>
        {paragraphs.map((para, i) => {
          if (i === 0 && /^[A-Za-z]/.test(para)) {
            return (
              <p key={i} className="has-dropcap">
                <span className="dropcap">{para.charAt(0)}</span>{renderProse(para.slice(1))}
              </p>
            );
          }
          return <p key={i}>{renderProse(para)}</p>;
        })}
        <div className="signature">{letter.signature}</div>
      </div>
      <NoteBlock text={letter.note} />
      <p className="letter-note">Some words are still being verified.</p>
      {letter.image_count > 0 && <PhotoLink letter={letter} onOpen={onOpen} />}
    </article>
  );
}

function EnvelopeCard({ letter, onOpen }) {
  const src = `${letter.folder}/${letter.id}_p1.jpg`;
  return (
    <article className="letter-card letter-card--envelope" id={`letter-${letter.id}`}>
      <LetterHeader letter={letter} />
      <div className="envelope-stage">
        <button className="envelope-img" onClick={() => onOpen(letter, 1)}>
          <img src={src} alt={`Original envelope, postmarked ${letter.date_label}`} />
        </button>
      </div>
      <p className="letter-note envelope-note">The letter inside has been lost.</p>
      <NoteBlock text={letter.envelope_note} />
    </article>
  );
}

function ChristmasCardCard({ letter, onOpen }) {
  return (
    <article className="letter-card letter-card--xmas" id={`letter-${letter.id}`}>
      <div className="brass-rule" />
      <LetterHeader letter={letter} />
      <div className="xmas-stage">
        <button className="xmas-img" onClick={() => onOpen(letter, 2)}>
          <img src={`${letter.folder}/${letter.id}_p2.jpg`}
               alt={`Original Christmas card, dated ${letter.date_label}`} />
        </button>
        <div className="xmas-verse">
          {letter.card_verse.split("\n").map((line, i) => <div key={i}>{line}</div>)}
        </div>
        <div className="xmas-cartouche">Christmas · 1940</div>
      </div>
      <div className="signature signature--xmas">{letter.signature}</div>
      <NoteBlock text={letter.card_note} />
      {letter.image_count > 0 && <PhotoLink letter={letter} onOpen={onOpen} />}
      <div className="brass-rule" />
    </article>
  );
}

function TelegramCard({ letter, onOpen }) {
  return (
    <article className="letter-card letter-card--telegram" id={`letter-${letter.id}`}>
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
      {letter.image_count > 0 && <PhotoLink letter={letter} onOpen={onOpen} />}
    </article>
  );
}

function LetterCard({ letter, onOpen }) {
  switch (letter.status) {
    case "envelope_only":      return <EnvelopeCard letter={letter} onOpen={onOpen} />;
    case "christmas_card":     return <ChristmasCardCard letter={letter} onOpen={onOpen} />;
    case "telegram":           return <TelegramCard letter={letter} onOpen={onOpen} />;
    case "transcribed_draft":  return <DraftCard letter={letter} onOpen={onOpen} />;
    case "transcribed_partial":
    case "transcribed":
    default:                   return <TranscribedCard letter={letter} onOpen={onOpen} />;
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
    return (
      <div className="folio">
        <span>
          Letter <span className="folio-num">{String(page.letter.n).padStart(2, "0")}</span> of <span className="folio-num">{totalLetters}</span>
        </span>
        <span className="dot">·</span>
        <span>Chapter {page.chapter.numeral}</span>
      </div>
    );
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Page renderer                                                      */
/* ------------------------------------------------------------------ */

function PageContent({ page, totalLetters, onOpen, onNext, allChapters, allLetters }) {
  return (
    <main className="archive">
      <Folio page={page} totalLetters={totalLetters} />
      {page.type === "title" && <TitlePage />}
      {page.type === "chapter" && (
        <ChapterDivider
          chapter={page.chapter}
          letters={page.letters}
          allChapters={allChapters}
          allLetters={allLetters}
        />
      )}
      {page.type === "letter" && <LetterCard letter={page.letter} onOpen={onOpen} />}
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
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sections = [];
  let titleIdx = pages.findIndex(p => p.type === "title");
  let closingIdx = pages.findIndex(p => p.type === "closing");

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
        <button className="toc-close" onClick={onClose} aria-label="Close">×</button>
        <div className="toc-header">
          <div className="toc-header-eyebrow">Contents</div>
          <h2 className="toc-title">Love, Always</h2>
          <div className="toc-sub">{totalLetters} letters · April – December 1940</div>
        </div>

        <button
          className={"toc-entry" + (currentIdx === titleIdx ? " is-current" : "")}
          onClick={() => onJump(titleIdx)}
        >
          <span className="toc-num">—</span>
          <span className="toc-date">Title page</span>
        </button>

        {sections.map((sec) => (
          <div key={sec.chapter.key} className="toc-section">
            <button
              className={"toc-section-head" + (currentIdx === sec.chapterIdx ? " is-current" : "")}
              onClick={() => onJump(sec.chapterIdx)}
            >
              <span className="toc-section-numeral">Ch. {sec.chapter.numeral}</span>
              <span className="toc-section-title">{sec.chapter.title}</span>
              <span className="toc-section-loc">{sec.items.length}</span>
            </button>
            <ul className="toc-list">
              {sec.items.map((it, idx) => {
                const prevLoc = idx > 0 ? sec.items[idx - 1].letter.location_stamp : null;
                const showLoc = it.letter.location_stamp !== prevLoc;
                return (
                  <li key={it.letter.id}>
                    <button
                      className={"toc-item" + (currentIdx === it.idx ? " is-current" : "")}
                      onClick={() => onJump(it.idx)}
                    >
                      <span className={statusDotClass(it.letter.status)} aria-hidden="true" />
                      <span className="toc-num">{String(it.letter.n).padStart(2, "0")}</span>
                      <div className="toc-meta">
                        <span className="toc-date">{it.letter.date_label}</span>
                        {showLoc && <span className="toc-loc">{it.letter.location_stamp}</span>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

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

function App() {
  const pages = useMemo(() => buildPages(LETTERS, CHAPTERS), []);
  const [pageIdx, setPageIdx] = useState(() => parseHashIdx(pages.length - 1));
  const [direction, setDirection] = useState(1);
  const prevIdxRef = useRef(0);
  const [lb, setLb] = useState(null);
  const [tocOpen, setTocOpen] = useState(false);
  const swipeRef = useRef(null);
  const reduced = useReducedMotion();

  const goto = useCallback((idx) => {
    setPageIdx(curr => {
      const next = Math.max(0, Math.min(pages.length - 1, idx));
      if (next === curr) return curr;
      setDirection(next > curr ? 1 : -1);
      prevIdxRef.current = curr;
      return next;
    });
  }, [pages.length]);

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
    if (lb || tocOpen) return;
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
  }, [next, prev, goto, pages.length, lb, tocOpen]);

  // touch swipe
  useEffect(() => {
    if (lb || tocOpen) return;
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
  }, [next, prev, lb, tocOpen]);

  const currentPage = pages[pageIdx];
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
      const total = curr.letter.image_count;
      const k = curr.page + dir;
      if (k < 1 || k > total) return curr;
      return { ...curr, page: k };
    });
  }, []);

  useEffect(() => {
    if (lb || tocOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prevOverflow; };
    }
  }, [lb, tocOpen]);

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
