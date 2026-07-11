#!/usr/bin/env python3
"""
assign_places.py — one-time assignment of a journey `place` key to every letter.

Each letter in letters.json gets a `place` field: a key into places.json (the
journey gazetteer the map is drawn from). The table below is explicit and
auditable — no inference. It was curated from each letter's location_stamp,
folder slug, editorial note, and the documented movements of the U.S.S.
New Orleans (CA-32). After this runs once, the field is Blake's to edit in
the letter editor like any other field.

    python3 scripts/assign_places.py            # dry run: print the table + checks
    python3 scripts/assign_places.py --write    # back up letters.json, then write

No third-party dependencies. Safe to re-run (idempotent).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import repo_lib  # noqa: E402  (backup_letters_json)

REPO = Path(__file__).resolve().parent.parent
LETTERS_JSON = REPO / "letters.json"
PLACES_JSON = REPO / "places.json"


def _span(prefix: str, a: int, b: int) -> list[str]:
    return [f"{prefix}{n:02d}" for n in range(a, b + 1)]


# ---------------------------------------------------------------------------
# The assignment table. Comments give the grounding for the judgment calls.
# ---------------------------------------------------------------------------
ASSIGNMENTS: dict[str, list[str]] = {
    # Boot camp, spring 1940.
    "great-lakes": _span("L", 1, 10),
    # Rail trip west, July 1940 (L103 souvenir postcard folder, July 11).
    "el-paso": ["L103"],
    "san-diego": ["L11", "L12"],
    # Aboard U.S.S. New Orleans at Pearl, Aug 1940 – Sep 1941 and again
    # Nov 1941 – early 1942. L21 (card "mailed from San Diego") and L22
    # (Honolulu telegram) are kept at Pearl — Gene was aboard ship.
    # L74 is censored but carries the ship's Pearl postal home; L79 is
    # stamped "back from SF refit"; L109 falls in the in-port window
    # between the Coral Sea return (May 26) and the Midway sortie
    # (May 28); L107 (Jul 4) is in port before the July South Pacific
    # departure. L104–L106 are peacetime Pearl letters.
    "pearl-harbor": (
        _span("L", 13, 23)
        + _span("L", 25, 29)
        + ["L31", "L32"]
        + _span("L", 34, 46)
        + _span("L", 69, 72)
        + ["L74", "L79"]
        + _span("L", 104, 106)
        + ["L107", "L109"]
    ),
    # The weekly gunnery cycle out of Pearl — stamps read "At Sea".
    "off-oahu": ["L30", "L33"],
    # Postcard in transit after 26 days' leave, Sep 1941.
    "chicago": ["L47"],
    # Puget Sound Navy Yard overhaul, Sep–Oct 1941; and L100 (Apr 2 1943),
    # when the ship was back at Puget Sound receiving her permanent bow
    # after the Sydney temporary repairs.
    "bremerton": _span("L", 48, 65) + ["L100"],
    # "Last U.S. mail before Pearl Harbor", Nov 6 1941.
    "long-beach": ["L66"],
    "mare-island": ["L67", "L68"],
    # Weekend liberty while the ship was in port, Jan–Feb 1942.
    "san-francisco": _span("L", 76, 78),
    # Jan 21 1942, five days before the San Francisco letters — eastbound
    # convoy escort across the eastern Pacific.
    "northeast-pacific": ["L75"],
    # Dec 20 1941 — written from sea on the recall from the Wake Island
    # relief expedition (Task Force 14, Dec 14–23).
    "wake-relief": ["L24"],
    # Apr 23 1942 en route south with the carrier force; May 12 1942
    # returning north after the Battle of the Coral Sea.
    "coral-sea": ["L80", "L108"],
    # Jul 8 1942 — just departed Pearl for the South Pacific build-up.
    "south-pacific-transit": ["L81"],
    # Guadalcanal campaign, Sep–Nov 1942 (incl. L110, Nov 1), through the
    # last letter before the Tassafaronga torpedo (L95, Nov 27).
    "solomons-area": _span("L", 82, 95) + ["L110"],
    # Dec 10 1942 — ten days after Tassafaronga, under emergency repair
    # in Tulagi Harbor.
    "tulagi": ["L96"],
    # Cockatoo Island refit, Dec 1942 – Mar 1943 (incl. the V-mails).
    "sydney": _span("L", 97, 99),
    # 1944 — letters TO Gene at home in Kentucky after his return.
    "kentucky": ["L101", "L102"],
    # Christmas card NOT from Gene (route: false in places.json keeps it
    # off the journey line; it still pins on that letter's own map).
    "montgomery-wv": ["L73"],
}


def build_table() -> dict[str, str]:
    table: dict[str, str] = {}
    for place, ids in ASSIGNMENTS.items():
        for lid in ids:
            if lid in table:
                sys.exit(f"BUG: {lid} assigned twice ({table[lid]} and {place})")
            table[lid] = place
    return table


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--write", action="store_true",
                    help="Back up letters.json and write the place fields.")
    args = ap.parse_args()

    letters = json.loads(LETTERS_JSON.read_text(encoding="utf-8"))
    places = json.loads(PLACES_JSON.read_text(encoding="utf-8"))
    place_keys = {p["key"] for p in places}
    table = build_table()

    problems = []
    for lid, key in table.items():
        if key not in place_keys:
            problems.append(f"{lid}: unknown place key '{key}'")
    letter_ids = {l["id"] for l in letters}
    for lid in sorted(letter_ids - set(table)):
        problems.append(f"{lid}: no place assigned")
    for lid in sorted(set(table) - letter_ids):
        problems.append(f"{lid}: assigned but not in letters.json")
    if problems:
        sys.stderr.write("assignment problems:\n")
        for pr in problems:
            sys.stderr.write(f"  - {pr}\n")
        return 1

    print(f"{len(table)} letters → {len(ASSIGNMENTS)} places\n")
    for l in letters:
        cur = l.get("place", "")
        new = table[l["id"]]
        mark = " " if cur == new else ("+" if not cur else "!")
        print(f"  {mark} {l['id']:>4}  {l['date']}  {new:<22} {l.get('location_stamp','')[:56]}")
    print("\n  (+ new, ! would change an existing value, blank = already set)")

    if not args.write:
        print("\nDry run — nothing written. Re-run with --write to apply.")
        return 0

    backup = repo_lib.backup_letters_json()
    for l in letters:
        l["place"] = table[l["id"]]
    LETTERS_JSON.write_text(
        json.dumps(letters, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nWrote place fields to letters.json (backup: .backups/{backup}).")
    print("Now run: python3 scripts/build_letters.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
