/* global LETTERS, CHAPTERS */
import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

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

function Atmosphere({ chapterKey, on }) {
  const snow = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 40; i++) {
      arr.push({
        size: 2 + Math.random() * 4,
        left: Math.random() * 100,
        delay: -Math.random() * 18,
        dur: 14 + Math.random() * 12,
        drift: (Math.random() - 0.5) * 80,
        op: 0.35 + Math.random() * 0.4,
      });
    }
    return arr;
  }, []);

  const dust = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 28; i++) {
      arr.push({
        size: 2 + Math.random() * 5,
        left: 5 + Math.random() * 90,
        top: 30 + Math.random() * 50,
        delay: -Math.random() * 22,
        dur: 18 + Math.random() * 16,
        dx: (Math.random() - 0.5) * 220,
        dy: -120 - Math.random() * 200,
        op: 0.25 + Math.random() * 0.35,
      });
    }
    return arr;
  }, []);

  if (!on) return null;

  if (chapterKey === "great-lakes") {
    return (
      <div className="atmosphere atmosphere--on" aria-hidden="true">
        {snow.map((s, i) => (
          <span
            key={i}
            className="snow-flake"
            style={{
              width: `${s.size}px`,
              height: `${s.size}px`,
              left: `${s.left}%`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
              "--snow-drift": `${s.drift}px`,
              "--snow-op": s.op,
            }}
          />
        ))}
      </div>
    );
  }

  if (chapterKey === "san-diego") {
    return (
      <div className="atmosphere atmosphere--on" aria-hidden="true">
        {dust.map((d, i) => (
          <span
            key={i}
            className="dust-mote"
            style={{
              width: `${d.size}px`,
              height: `${d.size}px`,
              left: `${d.left}%`,
              top: `${d.top}%`,
              animationDelay: `${d.delay}s`,
              animationDuration: `${d.dur}s`,
              "--dust-x": `${d.dx}px`,
              "--dust-y": `${d.dy}px`,
              "--dust-op": d.op,
            }}
          />
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
  const stops = chapters.filter(c => usedKeys.has(c.key));
  if (stops.length === 0) return null;

  const x0 = 60, x1 = 740, yMid = 70;
  const positions = stops.map((s, i) => {
    const x = stops.length === 1
      ? (x0 + x1) / 2
      : x0 + ((i + 0.5) / stops.length) * (x1 - x0);
    return { ...s, x, y: yMid };
  });

  return (
    <div className="route-wrap" aria-hidden="true">
      <svg viewBox="0 0 800 140" className="route-svg" preserveAspectRatio="xMidYMid meet">
        <line x1={x0} y1={yMid} x2={x1} y2={yMid} className="route-line" />
        {positions.map(p => {
          const isActive = p.key === activeChapter;
          const ls = grouped[p.key] || [];
          const dr = dateRange(ls);
          const label = (p.map && p.map.label) || p.location_label || p.title;
          return (
            <g key={p.key}>
              <circle cx={p.x} cy={p.y} r={isActive ? 6 : 4}
                className={isActive ? "route-pin-active" : "route-pin-inactive"} />
              <text x={p.x} y={p.y - 18} textAnchor="middle"
                className={isActive ? "route-label route-label--active" : "route-label"}>
                {label}
              </text>
              <text x={p.x} y={p.y + 24} textAnchor="middle" className="route-date">{dr}</text>
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
      <button className="lb-close" onClick={onClose}>close</button>
      <div className="lb-stage" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} />
        <div className="lb-meta">
          <span>{letter.date_label}</span>
          <span className="lb-counter">page {k} of {total}</span>
        </div>
      </div>
      {total > 1 && (
        <>
          <button className="lb-nav lb-prev" onClick={(e) => { e.stopPropagation(); onNav(-1); }}>‹</button>
          <button className="lb-nav lb-next" onClick={(e) => { e.stopPropagation(); onNav(1); }}>›</button>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Letter card variants                                               */
/* ------------------------------------------------------------------ */

function LetterHeader({ letter }) {
  return (
    <header className="letter-head">
      <div className="letter-num">Letter {letter.n} <span className="dot">·</span> {letter.date_label}</div>
      <div className="letter-stamp">{letter.location_stamp}</div>
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

function TranscribedCard({ letter, onOpen }) {
  return (
    <article className="letter-card" id={`letter-${letter.id}`}>
      <LetterHeader letter={letter} />
      <div className="letter-body">
        <div className="salutation">{letter.salutation}</div>
        {letter.body.split(/\n\n+/).map((para, i) => <p key={i}>{para}</p>)}
        {letter.partial && <p className="incomplete-marker">[the letter continues]</p>}
        <div className="signature">{letter.signature}</div>
        {letter.postscript && (
          <p className="postscript"><span className="ps-mark">P.S.</span> {letter.postscript}</p>
        )}
      </div>
      {letter.note && <p className="letter-note">{letter.note}</p>}
      {letter.partial && <p className="letter-note">Transcription incomplete; the remainder is being verified.</p>}
      {letter.image_count > 0 && <PhotoLink letter={letter} onOpen={onOpen} />}
    </article>
  );
}

function DraftCard({ letter, onOpen }) {
  const renderBody = (text) => {
    const parts = text.split(/(\[\?\]|\[[^\]]+\?\])/g);
    return parts.map((part, i) => {
      if (/^\[.*\?\]$/.test(part)) {
        const inner = part.replace(/^\[|\]$/g, "");
        return <sub key={i} className="uncertain" title="Uncertain reading">{inner}</sub>;
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };
  const paragraphs = letter.body.split(/\n\n+/);
  return (
    <article className="letter-card letter-card--draft" id={`letter-${letter.id}`}>
      <LetterHeader letter={letter} />
      <div className="letter-body">
        <div className="salutation">{letter.salutation}</div>
        {paragraphs.map((para, i) => <p key={i}>{renderBody(para)}</p>)}
        <div className="signature">{letter.signature}</div>
      </div>
      {letter.note && <p className="letter-note">{letter.note}</p>}
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
      {letter.envelope_note && <p className="letter-note">{letter.envelope_note}</p>}
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
      </div>
      <div className="signature signature--xmas">{letter.signature}</div>
      {letter.card_note && <p className="letter-note">{letter.card_note}</p>}
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
      <svg viewBox="0 0 28 28" className="ornament-anchor">
        <circle cx="14" cy="6" r="2.4" fill="none" stroke="#9B7B3F" strokeWidth="1.1" />
        <line x1="14" y1="8.4" x2="14" y2="22" stroke="#9B7B3F" strokeWidth="1.1" strokeLinecap="round" />
        <line x1="9" y1="11" x2="19" y2="11" stroke="#9B7B3F" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M 6 18 Q 14 26 22 18" fill="none" stroke="#9B7B3F" strokeWidth="1.1" strokeLinecap="round" />
        <line x1="6" y1="18" x2="4.5" y2="16.4" stroke="#9B7B3F" strokeWidth="1.1" strokeLinecap="round" />
        <line x1="22" y1="18" x2="23.5" y2="16.4" stroke="#9B7B3F" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
      <span className="ornament-rule" />
    </div>
  );
}

function TitlePage({ letterCount }) {
  return (
    <section className="title-page">
      <div className="title-eyebrow">A family archive</div>
      <h1 className="title">Love, Always</h1>
      <p className="subtitle">
        The wartime letters of<br />
        Raymond Eugene Lankford to Joan Northcutt
      </p>
      <ShipOrnament />
      <p className="frontispiece">
        Discovered in a cardboard box behind the family home<br />
        in Somerset, Kentucky, 2023.
      </p>
      <p className="title-count">
        {letterCount} letters, transcribed and assembled<br />
        for the family who carries his story
      </p>
      <p className="title-prompt">Turn the page →</p>
    </section>
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
        Chapter {page.chapter.numeral}<span className="dot">·</span>{page.chapter.title}
      </div>
    );
  }
  if (page.type === "letter") {
    return (
      <div className="folio">
        Letter {page.letter.n} of {totalLetters}<span className="dot">·</span>Chapter {page.chapter.numeral}
      </div>
    );
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Page renderer                                                      */
/* ------------------------------------------------------------------ */

function PageContent({ page, totalLetters, onOpen, allChapters, allLetters }) {
  return (
    <main className="archive">
      <Folio page={page} totalLetters={totalLetters} />
      {page.type === "title" && <TitlePage letterCount={totalLetters} />}
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
      <div className="toc-panel" onClick={(e) => e.stopPropagation()}>
        <button className="toc-close" onClick={onClose}>close</button>
        <h2 className="toc-title">Contents</h2>
        <div className="toc-sub">{totalLetters} Letters · April – December 1940</div>

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
              style={{ background: "none", border: "none", width: "100%", cursor: "pointer", font: "inherit", textAlign: "left", padding: 0 }}
            >
              <span className="toc-section-numeral">Chapter {sec.chapter.numeral}</span>
              <span style={{ flex: 1 }}>{sec.chapter.title}</span>
              <span className="toc-loc">{sec.chapter.location_label}</span>
            </button>
            <ul className="toc-list">
              {sec.items.map((it) => (
                <li key={it.letter.id}>
                  <button
                    className={"toc-item" + (currentIdx === it.idx ? " is-current" : "")}
                    onClick={() => onJump(it.idx)}
                  >
                    <span className="toc-num">{String(it.letter.n).padStart(2, "0")}</span>
                    <span className="toc-date">{it.letter.date_label}</span>
                    <span className="toc-loc">{it.letter.location_stamp}</span>
                  </button>
                </li>
              ))}
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
  const [lb, setLb] = useState(null);
  const [tocOpen, setTocOpen] = useState(false);
  const swipeRef = useRef(null);
  const reduced = useReducedMotion();

  const goto = useCallback((idx) => {
    setPageIdx(curr => {
      const next = Math.max(0, Math.min(pages.length - 1, idx));
      return next === curr ? curr : next;
    });
  }, [pages.length]);

  const next = useCallback(() => {
    setPageIdx(curr => Math.min(pages.length - 1, curr + 1));
  }, [pages.length]);

  const prev = useCallback(() => {
    setPageIdx(curr => Math.max(0, curr - 1));
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

  const isNavy = currentPage.type === "chapter";
  useEffect(() => {
    document.body.classList.toggle("body--navy", isNavy);
  }, [isNavy]);

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
  const dur = reduced ? 0 : 0.22;

  return (
    <>
      <AtmosphereMount chapterKey={chapterKey} />
      <div className="stage">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pageIdx}
            className={"page-surface" + (isNavy ? " is-navy" : "")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur, ease: "easeOut" }}
          >
            <PageContent
              page={currentPage}
              totalLetters={totalLetters}
              onOpen={openLb}
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

function AtmosphereMount({ chapterKey }) {
  const [mounted, setMounted] = useState(null);
  useLayoutEffect(() => {
    const node = document.getElementById("atmosphere-root");
    if (node) setMounted(node);
  }, []);
  if (!mounted) return null;
  return createPortal(
    <Atmosphere chapterKey={chapterKey} on={!!chapterKey} />,
    mounted
  );
}

createRoot(document.getElementById("root")).render(<App />);
