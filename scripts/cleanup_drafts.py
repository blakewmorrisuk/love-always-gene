#!/usr/bin/env python3
# Cleans up the recently transcribed (status: transcribed_draft) letter
# records so they render legibly on the live site:
#
#   1. Strips inline page markers from the body ((1)/(2)/.../I./II./
#      "(Back of first page)" etc.) and rejoins paragraphs that the
#      markers split mid-sentence.
#   2. Strip-down + paragraph-break of the contextual "note" block:
#      drops production-trivia lines (source-photo rotation, cursive-
#      readings-worth-a-second-look, plain-stationery page-count notes)
#      and inline priority/citation meta tags, then joins remaining
#      lines with blank lines so the NoteBlock React component renders
#      each as its own <p>.
#   3. Conservative typo fixes in the body: mis-split words on a line
#      break (e.g. "alri-right"), doubled-word collapse with allow-list,
#      multi-space and trailing-space cleanup. Gene's authentic voice
#      spellings (writting, comming, agin, "I good", kindly) stay.
#
# Touches each letter's LNN_transcription.md and the corresponding
# entry in letters.js (template literals for body + note). Older
# letters (status: transcribed) are left alone.
#
#   Usage:
#       python3 scripts/cleanup_drafts.py --dry-run    # preview
#       python3 scripts/cleanup_drafts.py              # apply
#
# Requires: Python 3.8+ (no external deps).

import argparse
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LETTERS_JS = ROOT / "letters.js"

# ---------------------------------------------------------------------
# Body cleanup
# ---------------------------------------------------------------------

# Whole-paragraph match after .strip() for a "page marker" that should
# be deleted. (Send 3 pages) and similar mid-line marginalia are NOT
# matched here because they are not standalone paragraphs.
PAGE_MARKER_RE = re.compile(
    r"^(?:"
    r"\((?:[1-9]|1[0-9])\)"             # (1), (2), ... (19)
    r"|[1-9][0-9]?\.{1,2}"              # 1.  2.  3.   1..  10..
    r"|[IVX]+\.{1,2}"                   # I.  II.  III.   I..  II..
    r"|\((?:Back|Front) of [^()]+\)"    # (Back of first page) etc.
    r")$"
)

# Sentence-terminating punctuation. If the previous paragraph ends in
# any of these (ignoring trailing close-quotes / brackets), the page
# break is treated as a real paragraph break; otherwise the following
# paragraph is merged with a single space.
SENTENCE_END = set(".!?")

# Mis-split words to recombine. Keys are the broken form, values are
# the corrected form. Apply as whole-word replacements.
MISSPLIT_FIXES = {
    "alri-right": "alright",
}

# Valid English doublings to preserve (don't collapse).
DOUBLE_WORD_ALLOWLIST = {
    "that", "had", "so", "not", "very", "really", "no",
    "out", "down", "up", "in", "on", "well",
}


def clean_body(text):
    """Strip page markers, rejoin sentence-spanning paragraphs,
    apply conservative typo fixes. Operates on body text only."""
    paragraphs = re.split(r"\n\n+", text)
    out = []
    merge_next = False
    for p in paragraphs:
        if PAGE_MARKER_RE.match(p.strip()):
            if out:
                prev_trimmed = out[-1].rstrip()
                merge_next = _should_merge(prev_trimmed)
                out[-1] = prev_trimmed
            continue  # drop the marker paragraph itself
        if merge_next:
            # Only merge if the next paragraph's first line looks like
            # prose continuation (not indented address/salutation block).
            if _first_line_is_indented(p):
                merge_next = False
                out.append(p)
            else:
                out[-1] = out[-1] + " " + p.lstrip()
                merge_next = False
        else:
            out.append(p)
    return _clean_spelling("\n\n".join(out))


def _should_merge(prev_paragraph):
    """True if the previous paragraph appears to end mid-sentence, in
    which case the page-break should be reabsorbed and the next
    paragraph joined onto this one."""
    # If the paragraph's last line is indented (i.e., part of an
    # address / return-address / signature block, not prose), treat
    # the page break as a real boundary.
    lines = prev_paragraph.rstrip("\n").split("\n")
    last_line = lines[-1] if lines else ""
    if last_line.startswith("    "):
        return False
    # Strip trailing close-quotes / brackets / whitespace before
    # checking the final punctuation char.
    trimmed = re.sub(r'[\s"\'`\]\)]+$', "", last_line)
    if not trimmed:
        return False
    return trimmed[-1] not in SENTENCE_END


def _first_line_is_indented(paragraph):
    """True if the paragraph's first line starts with 4+ spaces
    (address / salutation / signature block — never prose)."""
    first = paragraph.split("\n", 1)[0]
    return first.startswith("    ")


def _clean_spelling(text):
    """Conservative typo fixes — applied to body only. Indented
    header / return-address lines are detected by leading whitespace
    and left alone."""
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        # Don't touch header / address lines — they're indented blocks.
        if line.startswith(" " * 4) or line.startswith("\t"):
            cleaned_lines.append(line.rstrip())
            continue
        new_line = line
        # 1. Mis-split words.
        for broken, fixed in MISSPLIT_FIXES.items():
            new_line = re.sub(
                r"\b" + re.escape(broken) + r"\b", fixed, new_line
            )
        # 2. Doubled words (case-insensitive on first letter, but
        #    only within a single line and outside [[…]] emphasis
        #    blocks and outside quoted strings).
        new_line = _collapse_doubles(new_line)
        # 3. Multi-space collapse inside prose.
        new_line = re.sub(r"(?<=\S)  +(?=\S)", " ", new_line)
        # 4. Trailing whitespace.
        new_line = new_line.rstrip()
        cleaned_lines.append(new_line)
    return "\n".join(cleaned_lines)


def _collapse_doubles(line):
    """Collapse "word word" → "word" outside [[…]] and "…" spans,
    respecting the allow-list. Conservative — only collapses when
    the two words are exactly identical (case-insensitive)."""
    # Split into spans that are inside [[…]] / "…" (preserved) and
    # spans that are plain prose (eligible).
    spans = re.split(r'(\[\[[^\]]*\]\]|"[^"]*")', line)
    rebuilt = []
    for i, span in enumerate(spans):
        if i % 2 == 1:
            # Quoted or emphasized — leave alone.
            rebuilt.append(span)
            continue
        def collapse(m):
            w1, sep, w2 = m.group(1), m.group(2), m.group(3)
            if w1.lower() == w2.lower() and w1.lower() not in DOUBLE_WORD_ALLOWLIST:
                return w1
            return m.group(0)
        span = re.sub(r"\b(\w+)(\s+)(\w+)\b", collapse, span)
        rebuilt.append(span)
    return "".join(rebuilt)


# ---------------------------------------------------------------------
# Note cleanup
# ---------------------------------------------------------------------

# Whole-line drop patterns (after .strip()). These are production
# trivia from the transcription process, not reader-facing context.
NOTE_DROP_PATTERNS = [
    # Source-photo rotation / sips notes.
    re.compile(r"^Source photos? (?:were |was )?(?:captured|originally)", re.I),
    # "Letter pages: page 1 (IMG_...)" production rotation notes.
    re.compile(r"^Letter pages?:\s*page\s*\d", re.I),
    # "Letter pages ... numbered (1), (2), ..." / "NOT numbered" —
    # page-numbering trivia (now-redundant after we stripped markers).
    re.compile(r"^Letter pages?\b.*\b(?:numbered|sheets total|sips)\b", re.I),
    # "Letter pages are plain stationery" / "plain lined stationery" —
    # stationery is visible in the photo viewer.
    re.compile(r"^Letter pages? (?:are |were |is |all )?(?:on )?(?:plain|the)?\s*(?:lined |airmail )?(?:plain )?stationery", re.I),
    # Cursive-readings reviewer notes.
    re.compile(r"^Cursive readings? worth a", re.I),
    re.compile(r"^Cursive interpretation is", re.I),
    re.compile(r"^Several cursive readings", re.I),
    re.compile(r"^Cursive readings? uncertain", re.I),
]

# Inline meta tags to strip from kept lines. These are internal
# annotation tags (priority labels, citation density notes).
INLINE_STRIP_PATTERNS = [
    # Any parenthetical containing the word "priority" — covers all
    # variants like "(love priority 2)", "(biographical priority —
    # possibly hometown navy-news coverage)", "(love/family priority 2,
    # archival meta-moment)", "(war/operational priority 1)", etc.
    re.compile(r"\s*\([^()]*\bpriority\b[^()]*\)", re.I),
    # "(two [[…]] emphases applied, both …)" / "(one [[…]] emphasis applied)"
    re.compile(
        r"\s*\([^()]*\[\[…\]\][^()]*emphas(?:is|es)[^()]*\)",
        re.I,
    ),
]


def clean_note(text):
    """Strip-down + paragraph-break the contextual note block."""
    if text is None:
        return None
    lines = text.split("\n")

    # Drop entire-line trivia.
    kept = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            # Already-blank lines: preserve (will be merged later).
            kept.append("")
            continue
        if any(pat.match(stripped) for pat in NOTE_DROP_PATTERNS):
            continue
        kept.append(line)

    # Strip inline meta tags. Also collapse spaces / space-before-
    # punctuation introduced by the strips.
    cleaned = []
    for line in kept:
        new_line = line
        for pat in INLINE_STRIP_PATTERNS:
            new_line = pat.sub("", new_line)
        new_line = re.sub(r"  +", " ", new_line)
        new_line = re.sub(r" +([,.;:])", r"\1", new_line)
        new_line = new_line.rstrip()
        cleaned.append(new_line)

    # Drop empty lines now (we'll re-introduce them as paragraph
    # separators between every remaining substantive line).
    substantive = [l for l in cleaned if l.strip()]

    return "\n\n".join(substantive)


# ---------------------------------------------------------------------
# Markdown frontmatter parsing
# ---------------------------------------------------------------------

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.S)


def parse_md(text):
    """Return (frontmatter_text, body_text). Frontmatter excludes the
    `---` fences. Body excludes the leading blank line after the
    closing fence."""
    m = FRONTMATTER_RE.match(text)
    if not m:
        raise ValueError("No YAML frontmatter found")
    frontmatter = m.group(1)
    body = text[m.end():]
    # Strip a single leading blank line if present.
    if body.startswith("\n"):
        body = body[1:]
    return frontmatter, body


def extract_field_value(frontmatter, key):
    """Get a top-level scalar or literal-block value from the
    frontmatter text. Returns (value_str_or_None, full_match_slice).
    The full_match_slice is the (start, end) indices in the
    frontmatter string covering the whole `key: ...` block, so the
    caller can splice a new value in."""
    # Literal block: `key: |` followed by indented lines.
    block_re = re.compile(
        r"(^" + re.escape(key) + r":\s*\|\-?\s*\n)((?:^[ \t].*(?:\n|$))*)",
        re.M,
    )
    m = block_re.search(frontmatter)
    if m:
        block_body = m.group(2)
        # Find indentation from the first non-empty line.
        indent = None
        for ln in block_body.split("\n"):
            if ln.strip():
                indent = len(ln) - len(ln.lstrip(" "))
                break
        if indent is None:
            return "", (m.start(), m.end())
        # De-indent.
        out_lines = []
        for ln in block_body.split("\n"):
            if not ln.strip():
                out_lines.append("")
            else:
                out_lines.append(ln[indent:] if ln.startswith(" " * indent) else ln)
        value = "\n".join(out_lines).rstrip("\n")
        return value, (m.start(), m.end())
    # Plain scalar.
    scalar_re = re.compile(
        r"(^" + re.escape(key) + r":\s*)(.*)$", re.M
    )
    m = scalar_re.search(frontmatter)
    if m:
        return m.group(2), (m.start(), m.end())
    return None, None


def splice_literal_block(frontmatter, key, new_value, indent=2):
    """Replace the literal-block `key: |` value in the frontmatter
    with new_value (indented under the key). If the block doesn't
    exist, returns frontmatter unchanged."""
    if new_value is None:
        return frontmatter
    _, span = extract_field_value(frontmatter, key)
    if span is None:
        return frontmatter
    start, end = span
    indent_str = " " * indent
    indented_lines = []
    for ln in new_value.split("\n"):
        if ln == "":
            indented_lines.append("")
        else:
            indented_lines.append(indent_str + ln)
    indented_block = "\n".join(indented_lines)
    if not indented_block.endswith("\n"):
        indented_block += "\n"
    replacement = key + ": |\n" + indented_block
    return frontmatter[:start] + replacement + frontmatter[end:]


# ---------------------------------------------------------------------
# letters.js splicing
# ---------------------------------------------------------------------


def _unescape_tl(s):
    """Unescape a JS template-literal string."""
    out = []
    i = 0
    while i < len(s):
        if s[i] == "\\" and i + 1 < len(s):
            nxt = s[i + 1]
            if nxt == "`":
                out.append("`")
                i += 2
                continue
            if nxt == "\\":
                out.append("\\")
                i += 2
                continue
            if nxt == "$":
                out.append("$")
                i += 2
                continue
            # Other escapes (\n, \t, etc.) — leave literal so we
            # don't accidentally convert a literal "\n" to a real
            # newline that wasn't in the source.
            out.append(s[i])
            i += 1
        else:
            out.append(s[i])
            i += 1
    return "".join(out)


def _escape_tl(s):
    """Re-escape for a JS template literal."""
    return (
        s.replace("\\", "\\\\")
         .replace("`", "\\`")
         .replace("${", "\\${")
    )


def _find_closing_backtick(text, start):
    """Index of the next unescaped backtick at or after start."""
    i = start
    while i < len(text):
        c = text[i]
        if c == "\\":
            i += 2
            continue
        if c == "`":
            return i
        i += 1
    return -1


def update_letters_js(letters_js_text, letter_id, new_body, new_note):
    """Replace the body and note template-literal contents for the
    given letter id within letters.js text. Returns the modified text.
    Raises if the entry isn't found or is malformed."""
    id_re = re.compile(r'^\s+id:\s*"' + re.escape(letter_id) + r'",\s*$', re.M)
    id_match = id_re.search(letters_js_text)
    if not id_match:
        raise KeyError(f"Letter id {letter_id} not found in letters.js")
    entry_start = id_match.start()

    # Find the end of the entry (next "  {" or "];" closing the array).
    next_entry_re = re.compile(r"^\s*\{|^\];", re.M)
    nxt = next_entry_re.search(letters_js_text, id_match.end())
    entry_end = nxt.start() if nxt else len(letters_js_text)
    entry = letters_js_text[entry_start:entry_end]

    def replace_field(entry_text, field, new_value):
        if new_value is None:
            return entry_text
        # `body: \`` or `note: \``  followed by content until
        # unescaped closing backtick.
        marker = field + ": `"
        idx = entry_text.find(marker)
        if idx < 0:
            return entry_text  # entry doesn't have this field
        content_start = idx + len(marker)
        close = _find_closing_backtick(entry_text, content_start)
        if close < 0:
            raise ValueError(
                f"Unterminated template literal for {field} in {letter_id}"
            )
        new_escaped = _escape_tl(new_value)
        return entry_text[:content_start] + new_escaped + entry_text[close:]

    new_entry = entry
    new_entry = replace_field(new_entry, "body", new_body)
    new_entry = replace_field(new_entry, "note", new_note)

    return letters_js_text[:entry_start] + new_entry + letters_js_text[entry_end:]


def extract_field_from_letters_js(letters_js_text, letter_id, field):
    """Read back the (unescaped) content of a body/note field for a
    given letter id. Used by the verify pass."""
    id_re = re.compile(r'^\s+id:\s*"' + re.escape(letter_id) + r'",\s*$', re.M)
    id_match = id_re.search(letters_js_text)
    if not id_match:
        return None
    next_entry_re = re.compile(r"^\s*\{|^\];", re.M)
    nxt = next_entry_re.search(letters_js_text, id_match.end())
    entry_end = nxt.start() if nxt else len(letters_js_text)
    entry = letters_js_text[id_match.start():entry_end]
    marker = field + ": `"
    idx = entry.find(marker)
    if idx < 0:
        return None
    content_start = idx + len(marker)
    close = _find_closing_backtick(entry, content_start)
    if close < 0:
        return None
    return _unescape_tl(entry[content_start:close])


# ---------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------


def find_draft_letters():
    """Return a list of (letter_id, md_path) for every transcription
    that's marked status: transcribed_draft."""
    out = []
    for folder in sorted(ROOT.iterdir()):
        if not folder.is_dir():
            continue
        if not re.match(r"^L\d{2,3}_", folder.name):
            continue
        md_files = list(folder.glob("L*_transcription.md"))
        if not md_files:
            continue
        md = md_files[0]
        text = md.read_text(encoding="utf-8")
        if re.search(r"^status:\s*transcribed_draft\s*$", text, re.M):
            # Letter id is everything before the first underscore.
            letter_id = folder.name.split("_", 1)[0]
            out.append((letter_id, md))
    return out


def process_letter(letter_id, md_path, letters_js_text, dry_run, verbose,
                   show_full=False):
    """Process one letter. Returns (changed: bool, new_letters_js_text)."""
    md_text = md_path.read_text(encoding="utf-8")
    frontmatter, body = parse_md(md_text)

    note_value, _ = extract_field_value(frontmatter, "note")

    new_body = clean_body(body)
    new_note = clean_note(note_value) if note_value is not None else None

    changed = False

    if verbose:
        if new_body != body:
            print(f"  [{letter_id}] body changed")
            _print_body_diff(body, new_body)
        if note_value is not None and new_note != note_value:
            print(f"  [{letter_id}] note changed")
            _print_note_diff(note_value, new_note)

    if show_full:
        print(f"\n  ===== [{letter_id}] CLEANED BODY =====")
        print(new_body)
        print(f"\n  ===== [{letter_id}] CLEANED NOTE =====")
        print(new_note if new_note is not None else "(no note)")
        print(f"\n  ===== [{letter_id}] END =====\n")

    # Update letters.js entry for this letter.
    js_body = extract_field_from_letters_js(letters_js_text, letter_id, "body")
    js_note = extract_field_from_letters_js(letters_js_text, letter_id, "note")

    new_js_body = clean_body(js_body) if js_body is not None else None
    new_js_note = clean_note(js_note) if js_note is not None else None

    if new_js_body != js_body or new_js_note != js_note:
        changed = True
        if not dry_run:
            letters_js_text = update_letters_js(
                letters_js_text, letter_id, new_js_body, new_js_note
            )

    if new_body != body or (note_value is not None and new_note != note_value):
        changed = True
        if not dry_run:
            new_frontmatter = frontmatter
            if note_value is not None and new_note != note_value:
                new_frontmatter = splice_literal_block(
                    new_frontmatter, "note", new_note
                )
            new_md_text = (
                "---\n" + new_frontmatter + "\n---\n\n" + new_body
            )
            md_path.write_text(new_md_text, encoding="utf-8")

    return changed, letters_js_text


def _print_body_diff(old, new):
    old_paras = re.split(r"\n\n+", old)
    new_paras = re.split(r"\n\n+", new)
    if len(old_paras) == len(new_paras):
        # Same paragraph count — likely just typo fixes.
        for o, n in zip(old_paras, new_paras):
            if o != n:
                print(f"      OLD: {o[:120]!r}")
                print(f"      NEW: {n[:120]!r}")
    else:
        # Markers were removed (and possibly paragraphs merged).
        dropped_markers = []
        for p in old_paras:
            if PAGE_MARKER_RE.match(p.strip()):
                dropped_markers.append(p.strip())
        print(
            f"      dropped {len(dropped_markers)} marker(s): "
            f"{', '.join(dropped_markers)}"
        )
        print(
            f"      paras: {len(old_paras)} -> {len(new_paras)}"
        )


def _print_note_diff(old, new):
    """Classify each non-empty original line as DROPPED / MODIFIED /
    KEPT by matching against the resulting paragraphs. A line is
    considered a match for a paragraph if its first ~20 chars after
    light normalization appear at the start of that paragraph."""
    old_lines = [l.strip() for l in old.split("\n") if l.strip()]
    new_paras = [p.strip() for p in new.split("\n\n") if p.strip()]

    def head(s):
        # Compare on a normalized 25-char prefix, lowercased, no
        # punctuation diff (inline strips can move punctuation).
        return re.sub(r"\W+", " ", s.lower()).strip()[:25]

    new_heads = {head(p): p for p in new_paras}
    dropped, modified = [], []
    for ln in old_lines:
        h = head(ln)
        if h in new_heads:
            if new_heads[h] != ln:
                modified.append((ln, new_heads[h]))
        else:
            dropped.append(ln)

    if dropped:
        print(f"      dropped {len(dropped)} line(s):")
        for ln in dropped:
            print(f"         - {ln[:140]}")
    if modified:
        print(f"      modified {len(modified)} line(s):")
        for o, n in modified:
            # Show just the changed segment for readability.
            print(f"         OLD: {o[:140]}")
            print(f"         NEW: {n[:140]}")
    print(f"      lines: {len(old_lines)} -> paragraphs: {len(new_paras)}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would change without writing")
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress per-letter change details")
    parser.add_argument("--only", action="append", default=[],
                        help="Limit to specific letter ids (repeatable)")
    parser.add_argument("--show-full", action="store_true",
                        help="Print the full cleaned body and note for each "
                             "letter (only useful with --only). Implies "
                             "--dry-run.")
    args = parser.parse_args()
    if args.show_full:
        args.dry_run = True

    drafts = find_draft_letters()
    if args.only:
        drafts = [(lid, p) for (lid, p) in drafts if lid in args.only]
    print(f"Found {len(drafts)} transcribed_draft letter(s).")

    letters_js_text = LETTERS_JS.read_text(encoding="utf-8")
    original_letters_js = letters_js_text

    changed_count = 0
    for letter_id, md in drafts:
        try:
            changed, letters_js_text = process_letter(
                letter_id, md, letters_js_text,
                dry_run=args.dry_run,
                verbose=not args.quiet,
                show_full=args.show_full,
            )
            if changed:
                changed_count += 1
        except Exception as e:
            print(f"  [{letter_id}] ERROR: {e}", file=sys.stderr)
            raise

    if args.dry_run:
        print(f"\nDry-run: {changed_count} letter(s) would change.")
    else:
        if letters_js_text != original_letters_js:
            LETTERS_JS.write_text(letters_js_text, encoding="utf-8")
            print(f"\nWrote letters.js (changed {changed_count} entries).")
        else:
            print("\nNo changes to letters.js.")


if __name__ == "__main__":
    main()
