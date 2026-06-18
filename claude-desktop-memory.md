# Memory for the Claude desktop app

I (Claude Code) can't write the Claude desktop app's memory directly, so copy the
block below into that app's **memory** (or a Project's custom instructions). It teaches
a fresh desktop-app Claude how this project works and how to fix it.

---

Blake's "Love, Always" project: his grandfather **Raymond Eugene "Gene" Lankford's** WWII
love letters to **Joan Northcutt**. Published at **blakewmorrisuk.github.io/love-always-gene**
(public, view-only); source at **github.com/blakewmorrisuk/love-always-gene**, local at
**~/Desktop/blakewmorrisuk.github.io/love-always-gene**.

Blake edits the letter transcripts with a local **"Letter Editor"** app on his Mac Dock (or
`scripts/edit_server.py` / the `Edit Letters.command` file): he edits the text beside the
scanned images, clicks **Save**, then **Publish** (commits + pushes; live in ~30 seconds).
Editing is local on his Mac; the website itself is view-only.

Architecture: **`letters.json` is the source of truth**; **`letters.js` is generated** from it
by `scripts/build_letters.py` (never hand-edit `letters.js`). Same for `cast.json`→`cast.js`
and `photos.json`→`photos.js`.

Resilience: Publish self-heals when the site changed elsewhere; **`Repair.command`**
(`scripts/doctor.py`) is the panic button; every Save backs up to `.backups/`; and the live
site never depends on the editor. The full recovery runbook is in the repo's **`CLAUDE.md`**
and **`EDITING.md`** — first move for almost anything: run `python3 scripts/doctor.py --sync`
or double-click `Repair.command`.

If Blake says "my letter editor or website is broken," open the love-always-gene folder and
follow `CLAUDE.md`.
