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
- Same pattern: `cast.json` → `cast.js` (`scripts/build_cast.py`), `photos.json` → `photos.js`
  (`scripts/build_photos.py`).
- **Never hand-edit `letters.js` / `cast.js` / `photos.js`.** Edit the `.json`, then run the
  matching `build_*.py`. They are marked `merge=generated` in `.gitattributes` so a merge
  driver regenerates them on any sync (see "Merge driver").

## The editor — a LOCAL tool (the website does NOT depend on it)

- Blake double-clicks **`Edit Letters.command`** → it runs **`scripts/edit_server.py`** on
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
  Sanity: `node --check letters.js`. If repeat visitors see stale data, bump the `?v=` token
  in `index.html` (search `__APP_VERSION`).

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
- Edit `letters.json` (or use the editor); never edit `letters.js` by hand.
- The live site is served from committed files on `main`; pushing deploys in ~30s.
- Deliberately **no CI / GitHub Actions** — recovery stays local and dependency-free.
- See also: `EDITING.md` (Blake-facing how-to), `README.md` (archive structure).
