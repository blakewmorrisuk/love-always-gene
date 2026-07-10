#!/usr/bin/env python3
"""
doctor.py — check and repair the letter archive. Run this whenever something seems
wrong (the editor won't save, the website looks broken, Publish keeps failing).

  python3 scripts/doctor.py          # check, fix the safe things, report in plain English
  python3 scripts/doctor.py --sync   # also pull the live site's newer changes

It is safe: it never deletes your edits. The most it does is rebuild the generated
website files from letters.json and set a git setting. See CLAUDE.md for details.
"""

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
import repo_lib  # noqa: E402


def main() -> int:
    do_sync = "--sync" in sys.argv
    print("\n  Letter archive — checkup")
    print("  " + "-" * 40)
    todo, fixed = [], []

    if repo_lib.letters_json_valid():
        print("  [ok] your letters file (letters.json) is valid")
    else:
        print("  [!!] letters.json is NOT valid")
        todo.append("letters.json is corrupt. Open the .backups folder, copy the newest "
                    "letters-*.json over letters.json, then run this again.")

    if repo_lib.ensure_merge_driver():
        print("  [ok] sync-safety (merge driver) is in place")
    else:
        print("  [!!] could not set the sync-safety merge driver")
        todo.append("The merge driver could not be set — ask Claude.")

    if repo_lib.letters_json_valid():
        steps = repo_lib.regenerate("all")
        if steps and all(s["code"] == 0 for s in steps):
            print("  [ok] rebuilt the website files (letters.js, cast.js, photos.js)")
            fixed.append("rebuilt the website files")
        else:
            print("  [!!] a rebuild step failed:")
            for s in steps:
                if s["code"] != 0:
                    print(f"       - {s['script']}: {s['out']}")
            todo.append("A website file failed to rebuild — ask Claude (show them the line above).")

    # app.js is generated from app.jsx by scripts/build_app.sh (needs node;
    # only relevant when app.jsx itself was edited — letter editing never
    # touches it). Warn-only: never a failure.
    app_jsx, app_js = REPO / "app.jsx", REPO / "app.js"
    if app_jsx.exists() and app_js.exists():
        if app_jsx.stat().st_mtime > app_js.stat().st_mtime + 1:
            print("  [..] app.js looks older than app.jsx — if the website misbehaves,")
            print("       ask Claude to run:  bash scripts/build_app.sh")
        else:
            print("  [ok] the website app file (app.js) is up to date")

    h = repo_lib.health(do_fetch=True)
    if h.get("online"):
        print(f"  [ok] connected to GitHub (you are {h['ahead']} ahead, {h['behind']} behind the live site)")
        if h["behind"] and not do_sync:
            todo.append(f"The live site has {h['behind']} newer change(s). Run:  "
                        f"python3 scripts/doctor.py --sync")
    else:
        print("  [..] couldn't reach GitHub right now (offline?) — fine, you can still edit")

    if do_sync and h.get("online") and h.get("behind"):
        print("       syncing the live site's changes...")
        r = repo_lib.sync()
        print("       " + ("[ok] " + r["message"] if r.get("ok") else "[!!] " + r.get("message", "sync failed")))

    print("  " + "-" * 40)
    if fixed:
        print("  Fixed: " + "; ".join(fixed))
    if todo:
        print("  What you should do next:")
        for t in todo:
            print("   - " + t)
    else:
        print("  Everything looks healthy.")
    print("")
    return 0 if not todo else 1


if __name__ == "__main__":
    raise SystemExit(main())
