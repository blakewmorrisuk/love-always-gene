# `Love, Always` — print edition

The print pipeline for the WWII letters of Raymond Eugene Lankford. Lives alongside the web archive in the same repository; touches none of the web files. Builds a press-ready 6×9 in paperback PDF for Lulu Press.

This directory is a **manuscript handoff package**. Most of the typographic polish is meant to be done by a book designer (or `Claude Design`). The scaffold here gets you to a compileable book; the designer takes it the rest of the way. See [`DESIGN_PROMPT.md`](DESIGN_PROMPT.md) for the brief that goes with the handoff.

---

## TL;DR

```bash
# one-time setup
python3 -m pip install --user pyyaml
brew install --cask mactex-no-gui    # or: download MacTeX from tug.org/mactex
make fonts

# build the book
make
open main.pdf
```

If anything in that block fails, read the `Toolchain` section below.

---

## What's here

```
book/
├── README.md                  ← this file
├── DESIGN_PROMPT.md           ← brief to hand the designer
├── Makefile                   ← make / make assemble / make book / make proof / make fonts / make clean
├── main.tex                   ← master document
├── styles/love-always.cls     ← custom LaTeX class (class for the whole book)
├── build_book.py              ← markdown → LaTeX assembler
├── scripts/fetch_fonts.sh     ← downloads the four font families
├── frontmatter/
│   ├── halftitle.tex
│   ├── titlepage.tex
│   ├── copyright.tex
│   ├── dedication.tex
│   ├── frontispiece.tex
│   └── prologue.tex           ← TODO[blake]: write ~600 words
├── parts/
│   ├── part-01-great-lakes.tex     ← TODO[blake]: 2-3 sentence bridge
│   ├── part-02-san-diego.tex       ← ...
│   ├── part-03-pearl-first-year.tex
│   ├── part-04-pearl-1941.tex
│   ├── part-05-west-coast-refit.tex
│   ├── part-06-return-and-attack.tex
│   ├── part-07-at-sea-1942.tex
│   ├── part-08-v-mail-1943.tex
│   └── part-09-after.tex
├── plates/
│   └── plates-placeholder.tex      ← reserved 8 pages for v2 photos
├── backmatter/
│   ├── epilogue.tex                ← TODO[blake]: expand to ~900 words
│   ├── familytree.tex              ← TODO[blake]: lineage Gene → you
│   ├── sources.tex                 ← TODO[blake]: one paragraph per source
│   ├── acknowledgments.tex         ← TODO[blake]: 200-400 words
│   ├── appendix-undated.tex
│   └── colophon.tex
├── cover/
│   └── cover.tex                   ← separate document, builds the cover PDF
├── generated/                      ← build_book.py output, never edit by hand
└── fonts/                          ← drop the four font families here
```

## Toolchain

This needs three things installed.

### 1. Python with PyYAML

```bash
python3 -m pip install --user pyyaml
```

Confirm:

```bash
python3 -c "import yaml; print(yaml.__version__)"
```

### 2. XeLaTeX

The book uses XeLaTeX because it supports system / file-path fonts via `fontspec`. On macOS, install MacTeX (full, 4 GB) or BasicTeX (small, then add packages with `tlmgr install`).

Easiest path on a Mac with no Homebrew yet:

```bash
# Download MacTeX from https://tug.org/mactex/
# Open the .pkg, click through. ~4 GB.
```

Faster path if you already have Homebrew:

```bash
brew install --cask mactex-no-gui
```

Confirm:

```bash
xelatex --version
```

### 3. Fonts

The four font families (Cormorant Garamond, Source Serif 4, Caveat, JetBrains Mono) are all SIL OFL licensed and can be embedded in PDFs. Fetch them with:

```bash
make fonts
```

This drops `.ttf`/`.otf` files into `book/fonts/`. If `curl` fails (corporate network, etc.), download manually from Google Fonts and Adobe's source-serif GitHub repository.

### Sanity-check the whole chain

```bash
make check
```

Reports the first missing dependency, in order.

## Building

```bash
make            # assemble letters from markdown, then run XeLaTeX twice
make assemble   # just regenerate generated/*.tex (fast)
make book       # just run XeLaTeX (assumes assemble already ran)
make proof      # one-pass XeLaTeX (faster, cross-refs may be stale)
make clean      # delete generated/, aux files, PDF
make distclean  # also delete fetched fonts
```

The whole build is reproducible; running `make` from a fresh clone (after the toolchain is in place) gets you `main.pdf` and nothing else.

To build the cover separately:

```bash
cd cover
xelatex cover.tex
```

The cover does not include the same scaffolding as `main.tex`; it's a standalone document because Lulu wants interior and cover as two PDFs.

## Editing prose

Blake's writing lands in these files:

| File | Target | What |
|---|---|---|
| `frontmatter/prologue.tex` | ~600 words | The frame the reader carries in |
| `parts/part-01-great-lakes.tex` (and 02-09) | 2-3 sentences each | Bridge prose per part |
| `backmatter/epilogue.tex` | ~900 words | The closing reflection, with Tassafaronga lived through |
| `backmatter/familytree.tex` | a stack | Gene + Joan to Blake |
| `backmatter/sources.tex` | paragraph each | Provenance of the archive |
| `backmatter/acknowledgments.tex` | 200-400 words | Names |

Inside each of those files, search for `TODO[blake]` for inline guidance.

## Editing letters

You do not edit letter content in this directory. The 110 letter transcriptions live in their original folders in the repo root:

```
../L01_1940-04-14_great-lakes/L01_transcription.md
../L02_1940-04-20_great-lakes/L02_transcription.md
...
```

`build_book.py` walks all of them, parses both YAML schemas (old: `letter_id`/`date_written`; new: `id`/`date`/`date_label`), and emits one `.tex` partial per part into `generated/`. Re-run `make assemble` after editing any transcription.

If a letter renders badly:

1. **Open the transcription markdown.** Check for unmatched `[[`, stray Markdown syntax, or weird Unicode.
2. **Check the YAML.** Some letters use `notes:` (singular) and some use `note:`. Both work. Look for `salutation:` and `signature:` fields; if those are missing, the body should start with `Dearest Joan;` and end with `Gene`.
3. **Edit the build script if needed.** If a whole class of letters has a problem (say, all V-Mails), fix it in `build_book.py`'s `render_letter()` function.

## Iterating with the designer

1. Hand the designer this whole directory plus `DESIGN_PROMPT.md`.
2. They work mostly in `styles/love-always.cls` and `cover/cover.tex`, plus any new `assets/`.
3. The designer should run `make` themselves to verify the class still compiles end-to-end.
4. When the designer hands back, they should include a short `HANDOFF.md` listing what they changed and what decisions you should review.

## Shipping to Lulu

When the final PDF is built and the prose placeholders are filled:

1. Recalculate the cover spine width with Lulu's cover-template calculator (it depends on final interior page count and paper stock). Update `cover/cover.tex` `\SPINE`. Rebuild the cover PDF.
2. Confirm interior bleed: Lulu's 6×9 in paperback wants 0.125 in bleed on all sides and 0.5 in safe margins. The class is set to 0.6 in outer margin, so you are inside the safety zone.
3. Upload interior and cover separately at lulu.com → Create a Project → Print Book → 6×9 in / paperback / matte. Choose **cream uncoated 60#** for the paper stock to get closest to the website's paper color.
4. Order **one** proof copy. Hold it. Mark it up.
5. Iterate the LaTeX, rebuild, replace the proof.
6. When the proof is right, order the family run (10-20 copies). Ship to addresses or to yourself for distribution.

## Verification (matching the plan's verification section)

| # | Step | Status |
|---|---|---|
| 1 | `make book` produces a 6×9 PDF with no warnings, all letters slotted into the right part | runnable once toolchain installed |
| 2 | Print a 20-page sample on a home printer trimmed to 6×9. Read the spreads aloud. | Blake's hands |
| 3 | Upload to Lulu, walk every page in the online previewer | Blake's hands |
| 4 | Order one printed proof copy. Read it cover to cover. | Blake's hands |
| 5 | Send the proof copy (or a PDF) to one or two family members | Blake's hands |
| 6 | Order the short family run | Blake's hands |

## Why XeLaTeX and not Typst, InDesign, etc.

XeLaTeX was chosen because:

- It supports system fonts via `fontspec`, so the typographic palette from the web project carries over directly.
- Memoir is the most battle-tested book class in any typesetting system.
- The output is reproducible from text source; you can `git diff` typographic changes.
- A designer who knows InDesign can still take this over by exporting the compiled PDF and treating it as a starting layout.

If you eventually want to move to Typst (newer syntax, faster compiles) or InDesign (designer ergonomics), the build script's per-letter emission is the only thing that needs porting; the prose stays in the same place.

## Why not just Pandoc → default book template

Pandoc's default book templates do not have the per-letter typographic control needed for telegrams, V-Mail, envelope-only items, and Christmas cards. We use a custom class instead of a Pandoc template so each letter type has its own named environment in LaTeX and the build script just emits the environment opener with metadata.
