# Lankford Letters Archive

Per-letter source-of-truth archive for the WWII correspondence of **Raymond Eugene "Gene" Lankford** (USN, 1940–1943) to **Joan Northcutt** of Stanford, Kentucky. This batch covers **April 14 – December 29, 1940** — Gene's Naval training period at Great Lakes (Co. 26 → Co. 28), his cross-country trip to San Diego, his transit aboard *U.S.S. Cuyama* and *Portland* to Pearl Harbor, and his early months aboard the heavy cruiser **U.S.S. New Orleans** in F Division.

23 items total: 17 letters with complete family transcriptions, 2 vision-OCR draft letters, 1 partial transcription pending verification, 1 Christmas card, 1 Christmas telegram, and 2 envelope-only items where the letter content is missing.

## Sources

| Source | Path | Role |
|---|---|---|
| Image originals | `~/Downloads/Letter Pictures found in Modernsystemsinc50 drive.zip` | 86 .JPG scans organized by family in 2022 |
| Family transcriptions | `~/Downloads/Love Letters From the War.pdf` | 23-page PDF of 17 cleaned-up transcriptions |
| Blake's re-scans | `~/Desktop/Lankford Research/Letters Archive/` | iPhone re-scans by scan session (parallel inventory) |
| Background research | `~/Desktop/Lankford Research/Lankford_USS_New_Orleans_Research.pdf` | 25-page biographical + naval-history context |
| Press coverage | WKYT (Feb 15, 2023): "Love Always, Gene: Somerset family finds WWII love letters" | Discovery story |

## Folder structure

```
Lankford Letters Archive/
├── README.md                          (this file)
├── _letters_index.csv                 (one row per letter, all metadata)
└── LNN_YYYY-MM-DD_<location-slug>/    (one folder per letter)
    ├── LNN_p1.jpg                     (page 1 — usually the envelope)
    ├── LNN_p2.jpg ...                 (subsequent pages in physical order)
    └── LNN_transcription.md           (YAML frontmatter + transcription body)
```

Letter IDs are sequential by **letter-written date** (the date Gene wrote at the top of the letter), not the postmark or zip-folder date. Where these differ, the canonical date is what Gene wrote; the postmark is recorded in the `notes` field.

## Status values

| Status | Meaning |
|---|---|
| `transcribed` | Family transcription is complete (from PDF). Considered authoritative. |
| `transcribed_partial` | Family transcription stops mid-letter (Aug 18 — see L13). |
| `transcribed_draft` | Vision-OCR draft by Claude. Words marked `[?]` are uncertain readings — review against the source images before treating as authoritative. |
| `christmas_card` | Pre-printed Christmas card, not a letter. Brief handwritten signature. |
| `telegram` | Postal Telegraph holiday telegram, not a letter. |
| `envelope_only` | Only the envelope survives; the letter content is missing or lost. |

## Transcription file format

Each `LNN_transcription.md` has YAML frontmatter (machine-readable metadata) followed by the transcription body. The body preserves Gene's:

- Right-aligned date+location header block
- Salutation (varies: "Dear Joan,", "Dearest Joan,", "Dear Jo,")
- Paragraph structure
- Sign-off and signature ("Gene", "Eugene L.", "Lankford" — varies by letter)
- Postscripts (Gene used many P.S. lines)
- Family transcriber's annotations (e.g., `**`, `*`, `(***)`, `(not finished – need back of front page)`)

## Cross-reference to Blake's scan-session archive

Each letter's `scan_sessions` field lists which of Blake's scan sessions (in `~/Desktop/Lankford Research/Letters Archive/`) contains a re-scan of the same letter. Blake's archive is currently the **later-deployment letters only** (L12 onward, USS New Orleans / Pearl Harbor era); the Great Lakes training letters (L01–L11) exist only in the 2022 family zip.

When iCloud-pending photos in Blake's inventory finish downloading, re-run `~/build_index.py` with the updated inventory and the cross-reference will refresh automatically.

## Items needing Blake's review

| Letter | What needs review |
|---|---|
| **L13** (Aug 18, 1940) | PDF transcription is partial: "(not finished – need back of front page)". Verify whether IMG_9230 in this folder is the back-of-front-page that completes the letter, or just an envelope. If completable, add the missing text and change status to `transcribed`. |
| **L20** (Nov 27, 1940 envelope; Nov 24-25 letter inside) | Vision-OCR draft. Review `[?]` words against IMG_9257-9260. The exact letter date (Nov 24 vs 25) needs confirmation from the header. |
| **L23** (Dec 29, 1940) | Vision-OCR draft. Review `[?]` words against IMG_9253-9255. |
| **L08** (Jun 18, 1940 envelope-only) | Genuine June 18 envelope but the "letter pages" inside (IMG_9209-9211) appear to be duplicate scans of the May 17 letter. The actual June 18 letter content seems lost. Confirm. |

## Known data quirks

- **Date offset**: Zip folder names use the postmark date (envelope), which is typically 1 day after Gene's letter-written date. PDF transcription dates use the letter-written date. Canonical dates here follow the PDF (letter-written).
- **Folder mislabeling**: Two zip folders are named after the wrong month — "Transcribed_ June 10th, 1940" actually contains the **May 10** letter; "Transcribed_ October 22nd" contains the **October 23** letter. Captured in the `notes` field of each affected letter.
- **L21 mislabeled in zip as a letter**: The "December 15th, 1940" zip folder is actually a Christmas card with a printed verse, not a handwritten letter.
- **Zip naming inconsistency**: Status markers in zip folder names use varying delimiters: `(transcribed)`, `(Transcribed)`, `Transcribed_`, `(PARTIALLY Transcribed)`, `NO LETTER_`. These markers are dropped from this archive's folder names — status lives in the YAML frontmatter instead.

## Future work (not part of this batch)

- Vision-OCR drafts for any new untranscribed letters that surface from later scan sessions
- Build the visual digital archive frontend (web/print/interactive) using this archive as source-of-truth
- Link transcriptions to background research PDF (USS New Orleans timeline, family context)
