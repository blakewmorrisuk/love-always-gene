#!/usr/bin/env python3
"""
build_letters.py — regenerate letters.js from letters.json + chapters.json.

letters.json (the array of letter records) and chapters.json are the editable
source of truth for the website's letter data. This emits letters.js, which the
site loads as `window.LETTERS` / `window.CHAPTERS`. Mirrors scripts/build_cast.py
and build_photos.py.

Do not hand-edit letters.js; edit the letters in the editor (Edit Letters.command)
or in letters.json, then run this. Usage:

    python3 scripts/build_letters.py            # writes letters.js
    python3 scripts/build_letters.py --check    # validate only (no write)

No third-party dependencies. Paths resolve relative to the repo root.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
LETTERS_JSON = REPO / "letters.json"
CHAPTERS_JSON = REPO / "chapters.json"
PLACES_JSON = REPO / "places.json"
LETTERS_JS = REPO / "letters.js"


def load_places() -> list:
    """The journey gazetteer (places.json). Optional: an older checkout
    without the file still builds a valid letters.js (empty PLACES)."""
    if not PLACES_JSON.exists():
        return []
    with PLACES_JSON.open(encoding="utf-8") as fh:
        return json.load(fh)

# ---------------------------------------------------------------------------
# Scan enumeration. Scans live beside each letter's transcription in its
# folder, and their names do NOT follow one pattern (L05_p1.jpg, but also
# L62_envelope.jpg, L73_card_front.jpg, ...). The website and the editor show
# exactly the files that exist, in a stable reading order, via the generated
# "images" field below — never by guessing filenames from a count.
# ---------------------------------------------------------------------------

IMAGE_SUFFIX_ORDER = [
    "card_front", "card_inside", "unfold_side1", "unfold_side2",
    "back_cover", "envelope", "envelope_back",
]


def _image_sort_key(letter_id: str, filename: str):
    stem = filename.rsplit(".", 1)[0]
    prefix = f"{letter_id}_"
    if stem.startswith(prefix):
        stem = stem[len(prefix):]
    m = re.fullmatch(r"p(\d+)", stem)
    if m:  # numbered letter pages first, in numeric order
        return (0, int(m.group(1)), "")
    if stem in IMAGE_SUFFIX_ORDER:
        return (1, IMAGE_SUFFIX_ORDER.index(stem), "")
    return (2, 0, stem)


def list_letter_images(letter: dict) -> list[str]:
    """Actual scan filenames for a letter, in reading order.

    An explicit "images" list in letters.json wins — that lets a letter
    exclude stray files (e.g. L08, whose folder also holds duplicate scans
    of another letter's pages).
    """
    if isinstance(letter.get("images"), list):
        return [f for f in letter["images"] if isinstance(f, str)]
    folder = letter.get("folder")
    if not folder:
        return []
    d = REPO / folder
    if not d.is_dir():
        sys.stderr.write(
            f"note: {letter.get('id')}: folder '{folder}' not found; no scans will show\n")
        return []
    names = [
        p.name for p in d.iterdir()
        if p.suffix.lower() in (".jpg", ".jpeg") and not p.stem.endswith("_web")
    ]
    lid = letter.get("id", "")
    return sorted(names, key=lambda n: _image_sort_key(lid, n))


def _web_variant(folder: str, name: str) -> str:
    stem, dot, ext = name.rpartition(".")
    if not dot:
        return name
    web = f"{stem}_web.{ext}"
    return web if (REPO / folder / web).exists() else name


def enrich_letters(letters: list) -> list:
    """Copies of the letter records with generated display fields.

    images      — scan filenames in reading order (see list_letter_images)
    images_web  — smaller "_web" display variants where they exist
    image_count — recomputed to len(images) so the site payload is
                  self-consistent

    These fields are generated: they live in letters.js (and the editor's
    API view), never in letters.json.
    """
    out = []
    for letter in letters:
        images = list_letter_images(letter)
        folder = letter.get("folder") or ""
        enriched = dict(letter)
        enriched["images"] = images
        enriched["images_web"] = [_web_variant(folder, n) for n in images]
        enriched["image_count"] = len(images)
        out.append(enriched)
    return out


def load(path: Path):
    if not path.exists():
        sys.stderr.write(f"{path.name} not found at {path}.\n")
        sys.exit(2)
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def validate(letters, chapters) -> list[str]:
    problems: list[str] = []
    if not isinstance(letters, list) or not letters:
        problems.append("letters.json is not a non-empty array")
        return problems
    if not isinstance(chapters, list) or not chapters:
        problems.append("chapters.json is not a non-empty array")
    chapter_keys = {c.get("key") for c in chapters if isinstance(c, dict)}
    places = load_places()
    place_keys = set()
    for i, p in enumerate(places):
        if not isinstance(p, dict) or not p.get("key"):
            problems.append(f"places.json entry #{i} has no key")
            continue
        if p["key"] in place_keys:
            problems.append(f"places.json: duplicate key '{p['key']}'")
        place_keys.add(p["key"])
        if p.get("kind") not in ("shore", "sea", "home"):
            problems.append(f"places.json '{p['key']}': kind must be shore/sea/home")
        lat, lon = p.get("lat"), p.get("lon")
        if not (isinstance(lat, (int, float)) and -90 <= lat <= 90):
            problems.append(f"places.json '{p['key']}': bad lat {lat!r}")
        if not (isinstance(lon, (int, float)) and -180 <= lon <= 180):
            problems.append(f"places.json '{p['key']}': bad lon {lon!r}")
        if not p.get("label"):
            problems.append(f"places.json '{p['key']}': missing label")
    seen_ids = set()
    for i, l in enumerate(letters):
        if not isinstance(l, dict):
            problems.append(f"letter #{i} is not an object")
            continue
        lid = l.get("id", f"<#{i}>")
        if not l.get("id"):
            problems.append(f"letter #{i} has no id")
        if lid in seen_ids:
            problems.append(f"duplicate letter id {lid}")
        seen_ids.add(lid)
        if not l.get("body") and l.get("status") not in (
            "envelope_only", "telegram", "christmas_card"
        ):
            problems.append(f"{lid}: empty body for status {l.get('status')}")
        if l.get("location_chapter") and chapter_keys and l["location_chapter"] not in chapter_keys:
            problems.append(f"{lid}: unknown location_chapter '{l['location_chapter']}'")
        if l.get("place") and place_keys and l["place"] not in place_keys:
            problems.append(f"{lid}: unknown place '{l['place']}'")
    return problems


def render(letters, chapters) -> str:
    """The exact text of letters.js for the given data (used by emit + sync checks)."""
    letters_js = json.dumps(enrich_letters(letters), ensure_ascii=False, indent=2)
    chapters_js = json.dumps(chapters, ensure_ascii=False, indent=2)
    # places.json (the journey gazetteer) rides along as window.PLACES,
    # keyed by place key so the app can join letter.place → coordinates.
    places_by_key = {p["key"]: p for p in load_places() if isinstance(p, dict) and p.get("key")}
    places_js = json.dumps(places_by_key, ensure_ascii=False, indent=2)
    return (
        "// Generated by scripts/build_letters.py from letters.json + chapters.json\n"
        "// + places.json. DO NOT EDIT BY HAND. Edit a letter in the editor (double-\n"
        "// click 'Edit Letters.command') or edit the JSON, then run build_letters.py.\n"
        f"window.LETTERS = {letters_js};\n\n"
        f"window.CHAPTERS = {chapters_js};\n\n"
        f"window.PLACES = {places_js};\n"
    )


def emit(letters, chapters) -> None:
    LETTERS_JS.write_text(render(letters, chapters), encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="Validate only; write nothing.")
    args = ap.parse_args()

    letters = load(LETTERS_JSON)
    chapters = load(CHAPTERS_JSON)
    problems = validate(letters, chapters)
    if problems:
        sys.stderr.write("letters.json validation problems:\n")
        for pr in problems:
            sys.stderr.write(f"  - {pr}\n")
        return 1

    if args.check:
        print(f"OK: {len(letters)} letters, {len(chapters)} chapters.")
        return 0

    emit(letters, chapters)
    print(f"Wrote {LETTERS_JS.relative_to(REPO)} ({len(letters)} letters, {len(chapters)} chapters).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
