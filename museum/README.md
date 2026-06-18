# Museum Donation Packet

The donor-provided interpretive material The National WWII Museum asked for in
2022, assembled for the donation of Gene Lankford's wartime letters.

## What the museum requested (2022 correspondence with Chase Tomlin)

1. Grandparents' names → see `biographies.md`
2. What Joan was doing during the war → `biographies.md`
3. Where/when/unit/capacity of service → `service-summary.md`
4. Letters folded in original envelopes? Condition? → `collection-overview.md`
5. Biographies (birth, family, education, service, marriage, postwar) → `biographies.md`
6. A "cast of characters" of everyone mentioned and their relation → `cast-of-characters.md`
7. Photos of the collection / other personal items → noted in `collection-overview.md`
8. Transcribe the correspondence → done (full transcriptions in the repo and online)
9. Donor log returned with the material → `donor-log-notes.md` + `cover-letter.md`

## Files

- `biographies.md` — lives of Gene and Joan
- `service-summary.md` — Navy service (with the NPRC SF-180 note on his rating)
- `cast-of-characters.md` — **generated**; do not edit by hand
- `collection-overview.md` — contents, condition, provenance
- `cover-letter.md` — draft letter to the curator
- `donor-log-notes.md` — pre-filled values for the museum's donor-log PDF

## Regenerating the cast

`cast-of-characters.md` is generated from the master roster at the repo root
(`cast.json`), the same source the website and the print book use. After
editing `cast.json`:

```
python3 scripts/build_cast.py          # rewrites cast.js + museum/cast-of-characters.md
python3 scripts/build_cast.py --check  # validate only
```

## Turning the packet into something to mail

These are Markdown masters. To produce a single printable PDF, for example:

```
pandoc museum/cover-letter.md museum/biographies.md museum/service-summary.md \
       museum/collection-overview.md museum/cast-of-characters.md \
       -o museum/donation-packet.pdf
```

Then print it, fill and print the donor-log PDF, and mail everything with the
letters to Chase Tomlin, The National WWII Museum, 945 Magazine Street, New
Orleans, LA 70130.

## Before sending

- Confirm the marriage date (April 20, 1943) and discharge date against family
  or military records; the biographies flag these.
- Decide what personal detail about living relatives you want included.
- Fill the bracketed blanks (your address, phone, the date) in the cover letter
  and donor log.
