# Makefile for `Love, Always` — print edition.
#
# Common workflows:
#   make           # full build: assemble letters, then compile PDF
#   make assemble  # run build_book.py only (no LaTeX)
#   make book      # compile PDF (assumes assemble has run)
#   make proof     # quick single-pass build (no microtype expansion) for fast iteration
#   make fonts     # download the four open-source font families into ./fonts/
#   make clean     # remove generated LaTeX, intermediate, and PDF outputs
#   make distclean # also remove fetched fonts
#
# Requires: xelatex (TeX Live or MacTeX), python3 with PyYAML, curl, unzip.

PYTHON     ?= python3
LATEX      ?= xelatex
LATEX_OPTS ?= -interaction=nonstopmode -halt-on-error -file-line-error

MAIN     := main
PDF      := $(MAIN).pdf
LETTERS  := generated/part-01-letters.tex \
            generated/part-02-letters.tex \
            generated/part-03-letters.tex \
            generated/part-04-letters.tex \
            generated/part-05-letters.tex \
            generated/part-06-letters.tex \
            generated/part-07-letters.tex \
            generated/part-08-letters.tex \
            generated/part-09-letters.tex \
            generated/appendix-undated-letters.tex \
            generated/manifest.tex

.PHONY: all assemble book proof fonts clean distclean check

all: assemble book

assemble: $(LETTERS)

$(LETTERS): build_book.py $(wildcard ../L*/L*_transcription.md)
	$(PYTHON) build_book.py --verbose

book: assemble
	$(LATEX) $(LATEX_OPTS) $(MAIN).tex
	$(LATEX) $(LATEX_OPTS) $(MAIN).tex
	@echo
	@echo "Built $(PDF). Open with:  open $(PDF)"

proof: assemble
	$(LATEX) $(LATEX_OPTS) $(MAIN).tex
	@echo
	@echo "Single-pass proof built. Cross-references may be one build behind."

fonts:
	@bash scripts/fetch_fonts.sh

check:
	@command -v $(PYTHON) >/dev/null 2>&1 || { echo "Missing: python3"; exit 1; }
	@$(PYTHON) -c "import yaml" 2>/dev/null || { echo "Missing: pyyaml. Install with: python3 -m pip install --user pyyaml"; exit 1; }
	@command -v $(LATEX) >/dev/null 2>&1 || { echo "Missing: xelatex. Install MacTeX or TeX Live."; exit 1; }
	@ls fonts/SourceSerif4-Regular.otf >/dev/null 2>&1 || { echo "Missing: fonts in ./fonts/. Run: make fonts"; exit 1; }
	@echo "OK: all dependencies present."

clean:
	rm -rf generated/*.tex
	rm -f $(MAIN).aux $(MAIN).log $(MAIN).out $(MAIN).toc $(MAIN).lof $(MAIN).lot $(MAIN).fls $(MAIN).fdb_latexmk
	rm -f $(PDF)

distclean: clean
	rm -rf fonts/*
