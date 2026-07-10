# CLAUDE.md — orientation & recovery runbook

This repo is **love-always-gene**, a static GitHub Pages site (deployed from branch `main`
at blakewmorrisuk.github.io/love-always-gene) presenting Gene Lankford's WWII letters.
**Blake**, the owner, is not a programmer. He edits letter transcripts through a local editor
app and publishes with one click. **If he says something is broken, your job is to get him
back to a working state with minimal fuss. Read this first; then run `python3 scripts/doctor.py`.**

## How the data flows (the one thing to understand)

- **`letters.json`** (repo root) is the **source of truth** for the website's letter text.
- **`letters.js`** is **generated** from it by `scripts/build_letters.py` (sets
  `window.LETTERS` / `window.CHAPTERS`). The website loads `letters.js`.
- `build_letters.py` also **enumerates each letter folder's scan files** into generated
  `images` / `images_web` fields (scan names vary: `_p1`, `_envelope`, `_card_front`, ...;
  `_web.jpg` files are smaller display derivatives from `scripts/make_web_images.py`).
  An explicit `images` list in `letters.json` overrides the enumeration (L08 uses this).
  Consequence: **when scans are added or renamed, rebuild `letters.js` and commit the JPGs
  in the same push**, or the live site will reference files it can't serve.
- Same pattern: `cast.json` → `cast.js` (`scripts/build_cast.py`), `photos.json` → `photos.js`
  (`scripts/build_photos.py`).
- **Never hand-edit `letters.js` / `cast.js` / `photos.js`.** Edit the `.json`, then run the
  matching `build_*.py`. They are marked `merge=generated` in `.gitattributes` so a merge
  driver regenerates them on any sync (see "Merge driver").

## The website runtime (app.js, vendor/, fonts/)

- **`app.jsx` is the SOURCE** for the site's code; the website loads **`app.js`, which is
  GENERATED** by `scripts/build_app.sh` (pinned esbuild via npx; needs node, which letter
  editing never does). After ANY edit to app.jsx run `bash scripts/build_app.sh` and commit
  both files. Never hand-edit app.js. `doctor.py` warns (warn-only) if app.js looks stale.
- **`vendor/`** holds the pinned runtime libraries (react@18.3.1 esm.sh single-file builds;
  framer-motion@11.18.2 bundled locally by esbuild) and **`fonts/` + `fonts.css`** hold the
  self-hosted webfonts. The site deliberately loads **zero third-party origins** — do not
  reintroduce CDN tags; if a library must change, replace its vendor file and keep the
  importmap names in index.html.
- **`scripts/make_web_images.py`** (run via `uv run --with pillow python3 ...`) generates the
  `_web.jpg` scan derivatives, orientation-corrected with EXIF stripped. Originals are never
  modified. Re-runs are incremental; new scans need one run before publishing.

## The editor — a LOCAL tool (the website does NOT depend on it)

- Blake launches it from the **"Letter Editor"** Dock app (built into `~/Applications` by
  `scripts/make_app.command`; rebuild/re-add with `bash scripts/make_app.command --add-to-dock`)
  or by double-clicking **`Edit Letters.command`** → it runs **`scripts/edit_server.py`** on
  `http://localhost:8765` and opens **`editor/`**. He edits text beside the scanned images,
  then **Save** (writes `letters.json`, copies a backup into `.backups/`, regenerates
  `letters.js`) and **Publish** (commits + pushes; live in ~30s).
- **`scripts/repo_lib.py`** holds the real logic: `publish()`, `sync()`, `regenerate()`,
  `backup_letters_json()`, `ensure_merge_driver()`, `health()`.
- **Invariant:** if the editor breaks, the **live site is unaffected** — `letters.js` is
  already committed and served on its own. A broken editor is never an emergency.

## Publish self-heals

`repo_lib.publish()` commits `letters.json` / `letters.js` / `index.html` and pushes. If the
push is rejected (the remote moved), it fetches, `git rebase origin/main` (generated files
auto-resolve via the merge driver), regenerates, and pushes again — automatically. If the
**same letter** was edited in two places (a genuine `letters.json` conflict), it **aborts the
rebase** (leaving a clean tree), backs up Blake's edit to `.backups/`, and returns an
"overlap" result; the editor then offers **Sync** (keep the other change) or **Use my version**
(`git push --force-with-lease`). Blake's chosen policy: **keep both safe, never silently lose
data.**

## Merge driver (why syncs never conflict on generated files)

`.gitattributes` marks `letters.js cast.js photos.js` as `merge=generated`. The driver,
`scripts/regen_merge.py`, regenerates the file from its source instead of conflicting. It is
registered in **repo-local git config** (NOT committed), by `edit_server.py` on startup and by
`doctor.py`. If it is missing, just run `python3 scripts/doctor.py` (it re-sets it).

## RECOVERY RUNBOOK — if Blake says…

**Default first move for almost anything:** `python3 scripts/doctor.py --sync`
(or he double-clicks `Repair.command`). It validates `letters.json`, rebuilds the generated
files, sets the merge driver, syncs the live site, and reports in plain English. It never
deletes his edits. Then:

- **"The website looks broken / blank / out of date."**
  `python3 scripts/build_letters.py` then `git add letters.js && git commit -m "rebuild letters.js" && git push`.
  Sanity: `node --check letters.js && node --check app.js`. If repeat visitors see stale data,
  bump the `?v=` token in `index.html` (search `__APP_VERSION`, or
  `python3 -c "import sys; sys.path.insert(0,'scripts'); import repo_lib; print(repo_lib.bump_cache_bust())"`).

- **"The website broke right after app.jsx was edited."**
  app.js wasn't rebuilt. Run `bash scripts/build_app.sh`, commit app.jsx + app.js, push.

- **"The editor won't open / Save does nothing / 'the helper isn't running'."**
  The local server isn't up. Have him double-click `Edit Letters.command`, or run
  `python3 scripts/edit_server.py` (port 8765). Then reload the editor tab.

- **"Publish keeps failing."**
  `git fetch origin && git status`. If behind → `python3 scripts/doctor.py --sync`, retry.
  If it's a same-letter overlap, his edit is the newest file in `.backups/`. If offline,
  nothing is wrong — his commit is local and safe; push when back online.

- **"I lost an edit / letters.json is corrupt."**
  Backups: **`.backups/letters-YYYYMMDD-HHMMSS.json`** (newest = latest Save). Copy the good
  one over `letters.json`, run `python3 scripts/build_letters.py`, commit, push.

- **"Everything is a mess — just match the live site."** (last resort; discards local
  *uncommitted* edits, so back up first: `cp letters.json .backups/manual.json`)
  `git fetch origin && git reset --hard origin/main && python3 scripts/build_letters.py`.

## Ground rules
- Edit `letters.json` (or use the editor); never edit `letters.js` / `app.js` by hand.
- The live site is served from committed files on `main`; pushing deploys in ~30s.
- Deliberately **no CI / GitHub Actions** — recovery stays local and dependency-free.
- Zero third-party origins at runtime (vendored libs, self-hosted fonts) — keep it that way.
- Letter scans are deliberately served WITHOUT a `?v=` cache token (they never change in
  place, and tokening them would re-download ~100MB per release for returning readers).
- To smoke-test before a risky push: `python3 -m http.server 8123` in the repo, open
  http://localhost:8123 and click through a letter, its lightbox, the Contents panel,
  and the Photographs page with the browser console open — zero errors, zero 404s.
- See also: `EDITING.md` (Blake-facing how-to), `README.md` (archive structure).
