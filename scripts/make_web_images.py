#!/usr/bin/env python3
"""make_web_images.py — generate `_web` display derivatives for letter scans.

The original scans are 3-11 MB iPhone photos; serving them in the site's
lightbox is brutal on phones. This produces `<name>_web.jpg` beside each
original (max edge WEB_MAX px, ~150-400 KB), which build_letters.py picks up
into the generated `images_web` field. Originals are NEVER modified; the
"full resolution" link in the lightbox still opens them.

Orientation: most scans carry a stale EXIF Orientation tag from the iPhone.
For many files the pixels were later hand-rotated upright but the tag was
left behind, so browsers (which honor EXIF) show them sideways. Derivatives
are written with pixels in the CORRECT reading orientation and no EXIF:
  - letter pages (…_pN)   should read portrait
  - envelopes (…envelope…) should read landscape
  - everything else (cards, unfolds, covers) keeps today's browser view
If the browser view of a page/envelope has the wrong aspect, the raw pixels
are used when THEY have the right aspect (the hand-rotated case); otherwise
the file is rotated and loudly flagged for a human look.

Usage:
    uv run --with pillow python3 scripts/make_web_images.py [--force]

(Plain `python3` works too if Pillow is installed. Re-runs are incremental:
a derivative is only rebuilt when the original is newer or --force is given.)
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.stderr.write(
        "Pillow is not installed. Run via:\n"
        "  uv run --with pillow python3 scripts/make_web_images.py\n")
    sys.exit(2)

REPO = Path(__file__).resolve().parent.parent
WEB_MAX = 1600          # max edge of a derivative, px
QUALITY = 72
SKIP_UNDER_BYTES = 500_000   # originals already this small don't need one


def kind_of(stem: str) -> str:
    base = stem.split("_", 1)[1] if "_" in stem else stem
    if re.fullmatch(r"p\d+", base):
        return "page"
    if "envelope" in base:
        return "envelope"
    return "other"


def aspect(size) -> str:
    w, h = size
    return "portrait" if h >= w else "landscape"


def oriented_pixels(path: Path):
    """Return (image, note) in the correct reading orientation, EXIF ignored."""
    raw = Image.open(path)
    disp = ImageOps.exif_transpose(raw)  # what a browser shows today
    expected = {"page": "portrait", "envelope": "landscape"}.get(kind_of(path.stem))
    if expected is None or aspect(disp.size) == expected:
        return disp, "exif-view"
    if aspect(raw.size) == expected:
        return raw, "raw-pixels"      # hand-rotated upright; stale EXIF tag
    return disp.rotate(-90, expand=True), "FORCED-ROTATE (verify by eye!)"


def main() -> int:
    force = "--force" in sys.argv
    made, skipped, small, notes = 0, 0, 0, {}
    flagged: list[str] = []
    for folder in sorted(REPO.glob("L*_*")):
        if not folder.is_dir():
            continue
        for src in sorted(folder.iterdir()):
            if src.suffix.lower() not in (".jpg", ".jpeg") or src.stem.endswith("_web"):
                continue
            if src.stat().st_size < SKIP_UNDER_BYTES:
                small += 1
                continue
            out = src.with_name(f"{src.stem}_web.jpg")
            if out.exists() and out.stat().st_mtime >= src.stat().st_mtime and not force:
                skipped += 1
                continue
            img, note = oriented_pixels(src)
            notes[note] = notes.get(note, 0) + 1
            if note.startswith("FORCED"):
                flagged.append(str(src.relative_to(REPO)))
            img = img.convert("RGB")
            img.thumbnail((WEB_MAX, WEB_MAX), Image.LANCZOS)
            img.save(out, "JPEG", quality=QUALITY, optimize=True, progressive=True)
            made += 1
    print(f"made {made}, up-to-date {skipped}, small-skipped {small}; orientation: {notes}")
    if flagged:
        print("VERIFY THESE BY EYE (ambiguous orientation):")
        for f in flagged:
            print("  " + f)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
