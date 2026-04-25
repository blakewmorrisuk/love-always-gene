/* global React, ReactDOM, LETTERS, CHAPTERS */
const { useState, useEffect, useMemo, useCallback, useRef } = React;

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
/*  Route diagram (replaces the US silhouette)                         */
/* ------------------------------------------------------------------ */

function RouteDiagram({ activeChapter, chapters, letters }) {
  const grouped = useMemo(() => groupByChapter(letters, chapters), [letters, chapters]);
  const usedKeys = new Set(letters.map(l => l.location_chapter));
  const stops = chapters.filter(c => usedKeys.has(c.key));
  if (stops.length === 0) return null;

  const x0 = 60;
  const x1 = 740;
  const yMid = 70;
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
              <circle
                cx={p.x}
                cy={p.y}
                r={isActive ? 6 : 4}
                className={isActive ? "route-pin-active" : "route-pin-inactive"}
              />
              <text
                x={p.x}
                y={p.y - 18}
                textAnchor="middle"
                className={isActive ? "route-label route-label--active" : "route-label"}
              >
                {label}
              </text>
              <text
                x={p.x}
                y={p.y + 24}
                textAnchor="middle"
                className="route-date"
              >
                {dr}
              </text>
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
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Original letter pages"
         onClick={onClose}>
      <button className="lb-close" onClick={onClose} aria-label="Close">close</button>
      <div className="lb-stage" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} />
        <div className="lb-meta">
          <span>{letter.date_label}</span>
          <span className="lb-counter">page {k} of {total}</span>
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
        {letter.body.split(/\n\n+/).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
        {letter.partial && (
          <p className="incomplete-marker">[the letter continues]</p>
        )}
        <div className="signature">{letter.signature}</div>
        {letter.postscript && (
          <p className="postscript"><span className="ps-mark">P.S.</span> {letter.postscript}</p>
        )}
      </div>
      {letter.note && <p className="letter-note">{letter.note}</p>}
      {letter.partial && (
        <p className="letter-note">Transcription incomplete; the remainder is being verified.</p>
      )}
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
        {paragraphs.map((para, i) => (
          <p key={i}>{renderBody(para)}</p>
        ))}
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
        <button className="envelope-img" onClick={() => onOpen(letter, 1)}
                aria-label={`Original envelope, dated ${letter.date_label}`}>
          <img src={src}
               alt={`Original envelope, postmarked ${letter.date_label}`} />
        </button>
      </div>
      <p className="letter-note envelope-note">The letter inside has been lost.</p>
      {letter.envelope_note && (
        <p className="letter-note">{letter.envelope_note}</p>
      )}
    </article>
  );
}

function ChristmasCardCard({ letter, onOpen }) {
  return (
    <article className="letter-card letter-card--xmas" id={`letter-${letter.id}`}>
      <div className="brass-rule" />
      <LetterHeader letter={letter} />
      <div className="xmas-stage">
        <button className="xmas-img" onClick={() => onOpen(letter, 2)}
                aria-label={`Christmas card, ${letter.date_label}`}>
          <img src={`${letter.folder}/${letter.id}_p2.jpg`}
               alt={`Original Christmas card, page 2 of ${letter.image_count}, dated ${letter.date_label}`} />
        </button>
        <div className="xmas-verse">
          {letter.card_verse.split("\n").map((line, i) => (
            <div key={i}>{line}</div>
          ))}
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
          {letter.telegram_to.split("\n").map((line, i) => (
            <div key={i}>{line}</div>
          ))}
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
      <svg viewBox="0 0 28 28" className="ornament-anchor" aria-hidden="true">
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
/*  Chapter divider page (full-bleed navy)                             */
/* ------------------------------------------------------------------ */

function ChapterDivider({ chapter, letters, allChapters, allLetters }) {
  return (
    <section className="chapter-divider" id={`chapter-${chapter.key}`}>
      <header className="chapter-head">
        <div className="chapter-numeral">Chapter {chapter.numeral}</div>
        <h2 className="chapter-title">{chapter.title}</h2>
        <div className="chapter-loc">{chapter.location_label}</div>
        <div className="chapter-dates">{dateRange(letters)}</div>
      </header>
      <RouteDiagram activeChapter={chapter.key} chapters={allChapters} letters={allLetters} />
      <p className="chapter-bridge">{chapter.bridge}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Page indicator + Nav chrome                                        */
/* ------------------------------------------------------------------ */

function PageIndicator({ page, totalLetters }) {
  let label = "";
  if (page.type === "title") label = "Title";
  else if (page.type === "closing") label = "Closing";
  else if (page.type === "chapter") {
    label = `Chapter ${page.chapter.numeral} · ${page.chapter.title}`;
  } else if (page.type === "letter") {
    label = `Letter ${page.letter.n} of ${totalLetters} · Chapter ${page.chapter.numeral}`;
  }
  return (
    <div className="page-indicator" aria-live="polite" aria-atomic="true">
      {label}
    </div>
  );
}

function NavChrome({ pageIdx, total, onPrev, onNext }) {
  return (
    <div className="nav-chrome" role="navigation" aria-label="Page navigation">
      <button
        className="nav-btn nav-prev"
        onClick={onPrev}
        disabled={pageIdx === 0}
        aria-label="Previous page"
      >
        Previous
      </button>
      <button
        className="nav-btn nav-next"
        onClick={onNext}
        disabled={pageIdx === total - 1}
        aria-label="Next page"
      >
        Next
      </button>
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
  const swipeRef = useRef(null);

  const goto = useCallback((idx) => {
    setPageIdx((curr) => {
      const next = Math.max(0, Math.min(pages.length - 1, idx));
      if (next !== curr) {
        if (window.location.hash !== `#p=${next}`) {
          window.location.hash = `p=${next}`;
        }
        window.scrollTo(0, 0);
      }
      return next;
    });
  }, [pages.length]);

  const next = useCallback(() => goto(pageIdx + 1), [goto, pageIdx]);
  const prev = useCallback(() => goto(pageIdx - 1), [goto, pageIdx]);

  // hash listener for back/forward
  useEffect(() => {
    const onHash = () => {
      const idx = parseHashIdx(pages.length - 1);
      setPageIdx(idx);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [pages.length]);

  // keyboard navigation (suspended while lightbox open)
  useEffect(() => {
    if (lb) return;
    const onKey = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Home") goto(0);
      else if (e.key === "End") goto(pages.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goto, pages.length, lb]);

  // touch swipe navigation (50px horizontal threshold; vertical scroll wins)
  useEffect(() => {
    if (lb) return;
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
      if (dt > 600) return;
      if (Math.abs(dx) < 50) return;
      if (Math.abs(dy) > Math.abs(dx) * 0.7) return;
      if (dx < 0) next();
      else prev();
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [next, prev, lb]);

  // toggle navy class on body for chapter divider pages
  useEffect(() => {
    const isNavy = pages[pageIdx].type === "chapter";
    document.body.classList.toggle("body--navy", isNavy);
    return () => document.body.classList.remove("body--navy");
  }, [pageIdx, pages]);

  // lightbox state + scroll lock
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
    if (lb) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [lb]);

  const page = pages[pageIdx];

  return (
    <>
      <PageIndicator page={page} totalLetters={LETTERS.length} />
      <main className="archive">
        {page.type === "title" && <TitlePage letterCount={LETTERS.length} />}
        {page.type === "chapter" && (
          <ChapterDivider
            chapter={page.chapter}
            letters={page.letters}
            allChapters={CHAPTERS}
            allLetters={LETTERS}
          />
        )}
        {page.type === "letter" && (
          <LetterCard letter={page.letter} onOpen={openLb} />
        )}
        {page.type === "closing" && <Closing />}
      </main>
      <NavChrome
        pageIdx={pageIdx}
        total={pages.length}
        onPrev={prev}
        onNext={next}
      />
      {lb && (
        <Lightbox
          letter={lb.letter}
          page={lb.page}
          onClose={closeLb}
          onNav={navLb}
        />
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
