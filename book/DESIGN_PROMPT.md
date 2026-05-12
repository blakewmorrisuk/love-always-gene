# Design direction — `Love, Always` print edition

Read this whole file before opening any of the LaTeX. It is the brief.

---

## What the book is

A 6×9 in privately-printed paperback titled **Love, Always: The Wartime Letters of Raymond Eugene Lankford**. It collects roughly one hundred letters written by a U.S. Navy sailor (Gene Lankford, U.S.S. New Orleans CA-32) to his sweetheart in Stanford, Kentucky (Joan Northcutt) between April 14, 1940 and April 2, 1943, plus two letters from third parties written in October and December 1944 after Gene returned to Kentucky, plus an appendix of four undated letters.

It is a private family heirloom assembled by Gene's descendant, Blake Morris. The print run is small, possibly only a few dozen copies. Distribution is through Lulu Press directly to family members. No ISBN. Not for sale.

## Visual reference

The compiler has already built a web version of the archive at:

> https://blakewmorrisuk.github.io/love-always-gene

Study `index.html` and `app.jsx` in the repo at `github.com/blakewmorrisuk/love-always-gene` before designing. That web project establishes the visual language you are carrying into print:

- **Typographic palette.** Cormorant Garamond italic for display, Source Serif 4 for body, Caveat for handwritten elements, JetBrains Mono small caps for dates and metadata.
- **Color palette.** `--paper` cream (#F5EFE0), `--walnut` (#3B2A1A) for ink, `--brass` (#9B7B3F) for rules and ornaments, `--telegram` (#E8DDC4) for telegram pages, `--navy` (#1F2D3D) for chapter dividers, `--war-red` (#4A1418) for the wartime chapter.
- **Ornaments.** An anchor-and-olive-branch frontispiece, a ship silhouette of the U.S.S. New Orleans, postmark SVGs with date + location + Navy seal.
- **Per-letter metadata system.** Folio number, postmark stamp, weather glyph with the historical temperature on that day, and a "days before Pearl Harbor" countdown line.

## What is already built in this directory

Everything except the editorial polish and the designer pass. Specifically:

```
book/
├── main.tex                  ← orchestrates the whole document
├── styles/love-always.cls    ← class file: page geometry, fonts, environments
├── build_book.py             ← markdown → LaTeX assembler (do not bypass)
├── Makefile                  ← make book / make assemble / make fonts / make clean
├── scripts/fetch_fonts.sh    ← downloads the four open-source font families
├── frontmatter/              ← halftitle, titlepage, copyright, dedication,
│                                frontispiece, prologue (placeholders)
├── parts/                    ← nine part-title pages with bridge placeholders
├── plates/                   ← reserved 8-page signature for v2 photographs
├── backmatter/               ← epilogue, familytree, sources, acknowledgments,
│                                appendix-undated, colophon
├── cover/cover.tex           ← full cover spread (front + spine + back)
├── generated/                ← build_book.py output. Do not hand-edit.
└── fonts/                    ← drop the four font families here
```

## What you (the designer) should do

The class file is a working starting point. It is not a finished design. Your job is to bring it to press-ready quality. Specifically:

1. **Refine `styles/love-always.cls`.** The custom environments (`letter`, `envelopeonly`, `telegram`, `christmascard`, `vmail`, `fromothers`) are defined but minimal. Make them beautiful. The `\letterMasthead`, `\salutation`, `\signature`, `\postscript`, and `\statusColophon` macros are where most of your typographic work will land.

2. **Refine the part-title spread.** `\openpart` sets a Roman numeral, the part name, a location, dates, and a bridge. Make the recto title page and verso bridge feel like a turn. Part VI (`The Return and the Attack`) is the pivot of the book; design that spread so the reader physically feels it.

3. **Design plate templates.** The plates signature is reserved for v2 photographs. Define two reusable environments in the class:
   - `\plateOneUp{path}{caption}` — full-page single image with caption below in JetBrains Mono small caps.
   - `\plateTwoUp{path}{caption}{path}{caption}` — two images stacked vertically with captions to the side.

4. **Convert the SVG ornaments to PDF.** The web project's `ShipOrnament` (anchor + olive branches) and `ShipSilhouette` (U.S.S. New Orleans) SVGs live inside `app.jsx`. Extract them, export to PDF, drop into `assets/`, and wire them into `frontispiece.tex`, the title page, and the cover.

5. **Refine the cover (`cover/cover.tex`).** Recalculate the spine width once the final page count is known. Place the ship silhouette. Polish typography. The back cover currently uses the existing closing paragraph as cover copy; you can edit but do not lengthen.

6. **Per-letter typography.** Each letter is its own typographic unit, beginning on a new recto when possible (the class currently uses `\cleardoublepage`; relax if it costs too much page count). Top of the letter: postmark stamp, weather glyph + temperature (data lives in `weather.js` in the repo root; you can hand-pipe it into the build script later), Pearl Harbor countdown line (data is in the frontmatter of letters L24+ as `days_before_pearl_harbor`), folio number with brass rules above and below.

7. **Variant letter typography.** Telegrams use the `telegram` environment with a tinted cream box (already wired). Christmas cards (`christmascard`) use a constrained centered block in italic display. V-Mail (`vmail`) uses a constrained measure in mono small. Envelope-only items (`envelopeonly`) get a quiet, smaller treatment.

## What you should NOT do

- **Do not bypass `build_book.py`.** The 110 letter transcriptions live in markdown with YAML frontmatter in the repo root (`L01_*/L01_transcription.md` through `L110_*/L110_transcription.md`). The build script normalizes the two YAML schemas and emits `generated/part-NN-letters.tex` files. The part files just `\input{}` those generated files. If you need to change how a letter renders, change the environment in the class or change how the build script emits the environment opener; do not hand-edit the generated files.
- **Do not reorder the parts.** The date ranges that drive part assignment are in `build_book.py` as `PART_RANGES`. If a part feels too long or too short, change the date range there.
- **Do not use em dashes anywhere in this book.** Hard preference from the compiler. Use commas, periods, semicolons, parentheses, or, for the longest pauses, the `\,---\,` typographic dash you'll see in this scaffold (a spaced en-dash; renders as a discreet pause rather than a tonal dash).
- **Do not add nostalgic kitsch.** No "vintage" filters, no faux-aged paper textures, no script fonts beyond Caveat. The cream stock and the brass-and-walnut typography should do all the period work.
- **Do not change `cleardoublepage` to `clearpage`** without reading every letter; some letters are short enough that they would jam against the next part-title spread.

## Tone of the book

Restrained, intimate, documentary. The book is a love letter from a descendant to his family. It is also a war record. It is also a piece of design. The reader should feel held by it. They should not feel sold to.

## Editorial content placeholders

Look for `TODO[blake]` comments in the LaTeX files. Those are where Blake writes:

- The **prologue** (~600 words) in `frontmatter/prologue.tex`.
- Nine **part bridges** (~80 words each) in `parts/part-NN-*.tex`.
- The **expanded epilogue** (~900 words) in `backmatter/epilogue.tex`, with the Tassafaronga moment (November 30, 1942) given its full weight before the line "Gene came home in 1943."
- The **family tree** in `backmatter/familytree.tex`.
- The **source notes** in `backmatter/sources.tex` (one paragraph per source).
- The **acknowledgments** in `backmatter/acknowledgments.tex`.

You do not need to write these. Blake will. But if any layout decision depends on word count, target the numbers above.

## Deliverables back to Blake

1. A refined `styles/love-always.cls` and any new class files you split out.
2. A `generated/` directory that compiles cleanly with `make book`.
3. PDF assets in `assets/` (anchor ornament, ship silhouette, any photographic plates Blake provides).
4. A polished `cover/cover.tex` with correct spine width and bleed.
5. A press-ready interior PDF and a press-ready cover PDF, each meeting Lulu's 6×9 in paperback specifications.
6. A short note (`HANDOFF.md`) listing what you changed, what Lulu defaults you assumed, and any decisions Blake should review before placing the proof order.

Hand back the project as a clean LaTeX tree, not just compiled PDFs. Blake is editing the prose during your design pass and needs to be able to rebuild without going back to you.
