#!/usr/bin/env python3
"""
build_book.py — Markdown-to-LaTeX assembler for `Love, Always`.

Walks every `L*_*/L*_transcription.md` folder in the repo root, normalizes the
two YAML schemas (old: letter_id/date_written; new: id/date/date_label) into a
single internal Letter record, groups letters into the nine book parts by date,
and emits one `generated/part-NN-letters.tex` file per part plus an appendix.

The LaTeX environments (\\letter, \\telegram, \\envelopeonly, \\christmascard,
\\vmail, \\fromothers) are defined in `styles/love-always.cls`; this script
just writes the environment blocks with the right metadata and the cleaned
body text.

Dependencies: PyYAML (`python3 -m pip install --user pyyaml`).
Run from anywhere; output lands in `<repo>/book/generated/`.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

try:
    import yaml  # type: ignore
except ImportError:
    sys.stderr.write(
        "build_book.py requires PyYAML. Install with:\n"
        "    python3 -m pip install --user pyyaml\n"
    )
    sys.exit(2)


# ---------------------------------------------------------------------------
# Configuration: which date range belongs to which part.
# Edit here if Blake wants to re-cut the part boundaries.
# ---------------------------------------------------------------------------

PART_RANGES: list[tuple[int, str, dt.date, dt.date]] = [
    (1, "Great Lakes",          dt.date(1940, 4, 1),  dt.date(1940, 7, 13)),
    (2, "San Diego",            dt.date(1940, 7, 14), dt.date(1940, 7, 31)),
    (3, "Pearl Harbor: First Year", dt.date(1940, 8, 1),  dt.date(1940, 12, 31)),
    (4, "Pearl Harbor: 1941",   dt.date(1941, 1, 1),  dt.date(1941, 8, 31)),
    (5, "West Coast Refit",     dt.date(1941, 9, 1),  dt.date(1941, 11, 17)),
    (6, "The Return and the Attack", dt.date(1941, 11, 18), dt.date(1941, 12, 31)),
    (7, "At Sea, 1942",         dt.date(1942, 1, 1),  dt.date(1942, 12, 31)),
    (8, "V-Mail, 1943",         dt.date(1943, 1, 1),  dt.date(1943, 12, 31)),
    (9, "After",                dt.date(1944, 1, 1),  dt.date(1945, 12, 31)),
]


# ---------------------------------------------------------------------------
# Internal record
# ---------------------------------------------------------------------------

@dataclass
class Letter:
    folder: Path
    folder_name: str
    id: str                     # e.g. "L24"
    n: int                      # numeric, used for sorting only as tiebreak
    date: dt.date
    date_known: bool            # False for L107..L110 (uncertain-year/day)
    location_slug: str          # folder suffix, e.g. "great-lakes"
    location_text: str          # human-readable location stamp
    return_address: str         # multiline string, may be empty
    status: str
    status_label: str
    salutation: Optional[str]
    signature: Optional[str]
    postscript: Optional[str]
    body: str                   # cleaned plain-text body
    page_count: Optional[int]
    raw: dict = field(default_factory=dict)

    @property
    def variant(self) -> str:
        """Map to LaTeX environment name."""
        slug = self.location_slug
        if slug == "envelope-only" or self.status == "envelope_only":
            return "envelopeonly"
        if slug == "honolulu-telegram" or self.status == "telegram":
            return "telegram"
        if slug == "christmas-card" or self.status == "christmas_card":
            return "christmascard"
        if slug == "v-mail":
            return "vmail"
        if slug.startswith("from-"):
            return "fromothers"
        return "letter"


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?\n)---\s*\n(.*)$", re.DOTALL)
FOLDER_RE = re.compile(r"^L(\d+)_(\d{4})-(\d{2})-(\d{2})_(.+)$")


def parse_folder_name(folder_name: str) -> tuple[int, dt.date, str, bool]:
    """Return (n, date, slug, date_known). `uncertain-*` folders use the folder date as best-guess."""
    m = FOLDER_RE.match(folder_name)
    if not m:
        raise ValueError(f"Unrecognized folder name: {folder_name}")
    n = int(m.group(1))
    y, mo, d = int(m.group(2)), int(m.group(3)), int(m.group(4))
    slug = m.group(5)
    date_known = "uncertain" not in slug
    return n, dt.date(y, mo, d), slug, date_known


def split_frontmatter(text: str) -> tuple[dict, str]:
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    fm = yaml.safe_load(m.group(1)) or {}
    body = m.group(2)
    return fm, body


def parse_letter(folder: Path) -> Optional[Letter]:
    """Parse one letter folder into a Letter record, or None if it has no transcription."""
    md_files = list(folder.glob("L*_transcription.md"))
    if not md_files:
        return None
    md_path = md_files[0]
    text = md_path.read_text(encoding="utf-8")
    fm, body = split_frontmatter(text)

    n, folder_date, slug, date_known = parse_folder_name(folder.name)

    # Normalize the two schemas.
    letter_id = fm.get("letter_id") or fm.get("id") or f"L{n:02d}"
    raw_date = fm.get("date_written") or fm.get("date") or folder_date
    if isinstance(raw_date, str):
        try:
            raw_date = dt.date.fromisoformat(raw_date)
        except ValueError:
            raw_date = folder_date
    if not isinstance(raw_date, dt.date):
        raw_date = folder_date

    location_text = (
        fm.get("location_stamp")
        or fm.get("location")
        or slug.replace("-", " ").title()
    )
    return_address = fm.get("return_address") or ""
    status = fm.get("status") or "transcribed"
    status_label = fm.get("status_label") or status
    salutation = fm.get("salutation")
    signature = fm.get("signature")
    postscript = fm.get("postscript")
    page_count = fm.get("page_count") or fm.get("image_count")

    return Letter(
        folder=folder,
        folder_name=folder.name,
        id=letter_id,
        n=n,
        date=raw_date,
        date_known=date_known,
        location_slug=slug,
        location_text=str(location_text),
        return_address=str(return_address).rstrip(),
        status=str(status),
        status_label=str(status_label),
        salutation=salutation if salutation else None,
        signature=signature if signature else None,
        postscript=postscript if postscript else None,
        body=clean_body(body),
        page_count=page_count if isinstance(page_count, int) else None,
        raw=fm,
    )


# ---------------------------------------------------------------------------
# Body cleaning
# ---------------------------------------------------------------------------

DOUBLE_BRACKET_RE = re.compile(r"\[\[(.+?)\]\]", re.DOTALL)
SINGLE_BRACKET_RE = re.compile(r"\[\?\]")
MD_BOLD_RE        = re.compile(r"\*\*([^\n*]+?)\*\*")
MD_HR_RE          = re.compile(r"^---\s*$", re.MULTILINE)
MD_HEADING_RE     = re.compile(r"^#{1,6}\s+(.+?)\s*$", re.MULTILINE)
MD_BLOCKQUOTE_RE  = re.compile(r"^>\s?", re.MULTILINE)
SENTINEL_BOLD     = "\x01BOLD\x01"  # escape vehicle for \textbf{} pre-LaTeX-escape


def clean_body(raw: str) -> str:
    """
    Strip Blake's editorial / Markdown markers from the body for print.

    - `[[passage]]` are authoring brackets marking notable / OCR-uncertain
      passages. We unwrap them: the text inside renders as normal prose.
    - `[?]` is the uncertain-word marker. Preserved verbatim so the reader
      sees it.
    - Trailing asterisks on a word (`help*`) mark editor footnotes; preserved.
    - `**bold**` Markdown is converted to a sentinel that latex_escape leaves
      alone and a final pass converts to `\\textbf{...}`. Single asterisks
      are NOT treated as italic (they collide with the editor's uncertain-
      word convention).
    - `> blockquote` Markdown has its prefix stripped, content kept.
    - `# Heading` lines have their hash markers stripped; content kept as
      a regular paragraph that the typographer can promote later.
    - `---` horizontal rules are dropped.
    """
    text = DOUBLE_BRACKET_RE.sub(r"\1", raw)
    text = MD_HR_RE.sub("", text)
    text = MD_HEADING_RE.sub(r"\1", text)
    text = MD_BLOCKQUOTE_RE.sub("", text)
    # Mark bold with a sentinel; convert after LaTeX-escape so the braces
    # added by `\textbf{...}` are not themselves escaped.
    text = MD_BOLD_RE.sub(lambda m: f"{SENTINEL_BOLD}{m.group(1)}{SENTINEL_BOLD}", text)
    return text.strip()


BOLD_PAIR_RE = re.compile(re.escape(SENTINEL_BOLD) + r"(.+?)" + re.escape(SENTINEL_BOLD), re.DOTALL)


def finalize_bold(escaped: str) -> str:
    """Convert sentinel-wrapped bold spans into LaTeX after escaping."""
    return BOLD_PAIR_RE.sub(lambda m: f"\\textbf{{{m.group(1)}}}", escaped)


# ---------------------------------------------------------------------------
# LaTeX escaping
# ---------------------------------------------------------------------------

LATEX_ESCAPES = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}


def latex_escape(s: str) -> str:
    if not s:
        return ""
    out = []
    for ch in s:
        out.append(LATEX_ESCAPES.get(ch, ch))
    # Smart-quote curly substitution can be left to microtype + babel;
    # leave straight quotes alone here.
    return "".join(out)


def latex_paragraphs(text: str) -> str:
    """Convert a plain-text body into a sequence of LaTeX paragraphs."""
    paras = re.split(r"\n\s*\n", text.strip())
    rendered = []
    for p in paras:
        p = p.strip()
        if not p:
            continue
        if looks_like_address_block(p):
            rendered.append(render_address_block(p))
        else:
            rendered.append(finalize_bold(latex_escape(p)))
    return "\n\n".join(rendered)


def looks_like_address_block(p: str) -> bool:
    lines = [ln for ln in p.splitlines() if ln.strip()]
    if len(lines) < 2 or len(lines) > 8:
        return False
    # Address-style if most lines are short (<60 chars) and there are
    # no sentence-ending periods inside the lines.
    short = sum(1 for ln in lines if len(ln.strip()) < 60)
    return short >= max(2, len(lines) - 1)


def render_address_block(p: str) -> str:
    lines = [ln.strip() for ln in p.splitlines() if ln.strip()]
    escaped = [finalize_bold(latex_escape(ln)) for ln in lines]
    return "\\begin{addressblock}\n" + "\\\\\n".join(escaped) + "\n\\end{addressblock}"


# ---------------------------------------------------------------------------
# Letter -> LaTeX
# ---------------------------------------------------------------------------

def render_metadata_kvs(letter: Letter) -> str:
    """Render the key-value metadata that opens every environment."""
    kvs = [
        f"  id={{{latex_escape(letter.id)}}}",
        f"  date={{{letter.date.isoformat()}}}",
        f"  datelabel={{{latex_escape(format_date_label(letter))}}}",
        f"  location={{{latex_escape(letter.location_text)}}}",
        f"  status={{{latex_escape(letter.status)}}}",
        f"  statuslabel={{{latex_escape(letter.status_label)}}}",
    ]
    if letter.page_count:
        kvs.append(f"  pagecount={{{letter.page_count}}}")
    if letter.return_address:
        kvs.append(
            f"  returnaddress={{{latex_escape_block(letter.return_address)}}}"
        )
    return ",\n".join(kvs)


def latex_escape_block(s: str) -> str:
    """Escape a multi-line value and join with \\\\ for the address argument."""
    lines = [latex_escape(ln.strip()) for ln in s.splitlines() if ln.strip()]
    return "\\\\".join(lines)


def format_date_label(letter: Letter) -> str:
    if not letter.date_known:
        return letter.date.strftime("%B %d, %Y") + " (uncertain)"
    return letter.date.strftime("%B %-d, %Y")


def render_letter(letter: Letter) -> str:
    """Render one letter into a LaTeX environment block."""
    env = letter.variant
    parts = [f"% --- {letter.id} -- {letter.folder_name} ---"]
    parts.append(f"\\begin{{{env}}}[%\n{render_metadata_kvs(letter)}%\n]")

    if letter.salutation:
        parts.append(f"\\salutation{{{latex_escape(letter.salutation)}}}")

    parts.append(latex_paragraphs(letter.body))

    if letter.postscript:
        parts.append(f"\\postscript{{{latex_escape(letter.postscript)}}}")

    if letter.signature:
        # Signatures often contain literal newlines that should render as line breaks.
        sig_lines = [latex_escape(ln) for ln in letter.signature.splitlines() if ln.strip()]
        parts.append("\\signature{" + "\\\\".join(sig_lines) + "}")

    parts.append(f"\\end{{{env}}}")
    parts.append("")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Part assignment
# ---------------------------------------------------------------------------

def assign_part(letter: Letter) -> Optional[int]:
    if not letter.date_known:
        return None  # appendix
    for num, _name, lo, hi in PART_RANGES:
        if lo <= letter.date <= hi:
            return num
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--repo",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="Repository root (default: parent of this script's directory).",
    )
    p.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output directory (default: <repo>/book/generated).",
    )
    p.add_argument(
        "--verbose",
        action="store_true",
        help="Print per-letter assignment.",
    )
    args = p.parse_args()

    repo = args.repo.resolve()
    out_dir = (args.out or (repo / "book" / "generated")).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    folders = sorted(
        (f for f in repo.iterdir() if f.is_dir() and FOLDER_RE.match(f.name)),
        key=lambda f: parse_folder_name(f.name)[0],
    )

    letters: list[Letter] = []
    for folder in folders:
        try:
            letter = parse_letter(folder)
        except Exception as e:
            sys.stderr.write(f"!! Failed to parse {folder.name}: {e}\n")
            continue
        if letter is None:
            sys.stderr.write(f"-- Skipping {folder.name} (no transcription file)\n")
            continue
        letters.append(letter)

    print(f"Parsed {len(letters)} letters from {repo}", file=sys.stderr)

    # Group by part, sort within each part by date then by id.
    by_part: dict[Optional[int], list[Letter]] = {}
    for letter in letters:
        part = assign_part(letter)
        by_part.setdefault(part, []).append(letter)
    for part, group in by_part.items():
        group.sort(key=lambda l: (l.date, l.n))

    # Emit per-part files.
    for num, name, _lo, _hi in PART_RANGES:
        group = by_part.get(num, [])
        path = out_dir / f"part-{num:02d}-letters.tex"
        path.write_text(
            "% Generated by build_book.py — do not edit by hand.\n"
            f"% Part {num}: {name}\n"
            f"% Letters: {len(group)}\n\n"
            + "\n".join(render_letter(l) for l in group),
            encoding="utf-8",
        )
        if args.verbose:
            print(f"Part {num} ({name}): {len(group)} letters -> {path.name}")

    # Appendix: uncertain-date letters.
    appendix = by_part.get(None, [])
    path = out_dir / "appendix-undated-letters.tex"
    path.write_text(
        "% Generated by build_book.py — do not edit by hand.\n"
        "% Appendix: Undated and Uncertain\n"
        f"% Letters: {len(appendix)}\n\n"
        + "\n".join(render_letter(l) for l in appendix),
        encoding="utf-8",
    )
    if args.verbose:
        print(f"Appendix: {len(appendix)} letters -> {path.name}")

    # Write a top-level manifest summarizing the build.
    manifest = out_dir / "manifest.tex"
    manifest.write_text(
        "% Generated by build_book.py — do not edit by hand.\n"
        "% Letter counts per part for sanity-checking the book build.\n"
        + "\n".join(
            f"% Part {num}: {len(by_part.get(num, []))} letters ({name})"
            for num, name, *_ in PART_RANGES
        )
        + f"\n% Appendix: {len(appendix)} letters\n"
        f"% Total: {len(letters)} letters\n",
        encoding="utf-8",
    )

    print(
        f"Wrote {sum(len(by_part.get(n, [])) for n, *_ in PART_RANGES) + len(appendix)} "
        f"letters across {len(PART_RANGES)} parts + 1 appendix to {out_dir}.",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
