#!/usr/bin/env python3
# Applies the rewritten contextual notes in scripts/new_notes.json to
# both letters.js (template literals) and the corresponding
# LNN_transcription.md files (YAML literal-block).
#
# The new notes replace whatever was previously in the `note` field —
# the prior cleanup script's strip-down output is fully superseded.
#
#   Usage:
#       python3 scripts/apply_new_notes.py --dry-run    # preview counts
#       python3 scripts/apply_new_notes.py              # apply
#
# Requires: Python 3.8+ (no external deps). Re-uses helpers from
# cleanup_drafts.py for letters.js template-literal splicing and
# YAML literal-block splicing.

import argparse
import json
import re
import sys
from pathlib import Path

# Re-use helpers from the cleanup script.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from cleanup_drafts import (  # noqa: E402
    LETTERS_JS,
    ROOT,
    extract_field_value,
    splice_literal_block,
    update_letters_js,
    parse_md,
)

NEW_NOTES_JSON = Path(__file__).resolve().parent / "new_notes.json"


def find_md_for_letter(letter_id):
    """Return the path to the LNN_transcription.md for this id."""
    for folder in ROOT.iterdir():
        if folder.is_dir() and folder.name.startswith(letter_id + "_"):
            md_files = list(folder.glob(f"{letter_id}_transcription.md"))
            if md_files:
                return md_files[0]
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", action="append", default=[],
                        help="Limit to specific letter ids")
    args = parser.parse_args()

    new_notes = json.loads(NEW_NOTES_JSON.read_text(encoding="utf-8"))
    if args.only:
        new_notes = {k: v for k, v in new_notes.items() if k in args.only}
    print(f"Applying {len(new_notes)} new note(s).")

    letters_js_text = LETTERS_JS.read_text(encoding="utf-8")
    original_letters_js = letters_js_text

    md_changed = 0
    js_changed = 0
    missing = []

    for letter_id in sorted(new_notes.keys(),
                            key=lambda s: int(s.lstrip("L"))):
        new_note = new_notes[letter_id]

        # --- letters.js ---
        try:
            new_js = update_letters_js(
                letters_js_text, letter_id, new_body=None, new_note=new_note
            )
        except KeyError:
            missing.append(letter_id)
            continue
        if new_js != letters_js_text:
            js_changed += 1
            letters_js_text = new_js

        # --- .md file ---
        md_path = find_md_for_letter(letter_id)
        if md_path is None:
            print(f"  [{letter_id}] WARNING: no .md file found")
            continue
        md_text = md_path.read_text(encoding="utf-8")
        try:
            frontmatter, body = parse_md(md_text)
        except ValueError:
            print(f"  [{letter_id}] WARNING: no YAML frontmatter")
            continue
        current_note, _ = extract_field_value(frontmatter, "note")
        if current_note is None:
            print(f"  [{letter_id}] WARNING: no `note` field in .md")
            continue
        new_frontmatter = splice_literal_block(frontmatter, "note", new_note)
        if new_frontmatter != frontmatter:
            md_changed += 1
            if not args.dry_run:
                new_md_text = (
                    "---\n" + new_frontmatter + "\n---\n\n" + body
                )
                md_path.write_text(new_md_text, encoding="utf-8")

    if missing:
        print(f"\nMissing in letters.js: {missing}")

    if args.dry_run:
        print(f"\nDry-run: {js_changed} letters.js entries and "
              f"{md_changed} .md files would change.")
    else:
        if letters_js_text != original_letters_js:
            LETTERS_JS.write_text(letters_js_text, encoding="utf-8")
            print(f"\nWrote letters.js ({js_changed} entries changed).")
        print(f"Wrote {md_changed} .md files.")


if __name__ == "__main__":
    main()
