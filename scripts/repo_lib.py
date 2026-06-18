#!/usr/bin/env python3
"""
repo_lib.py — shared helpers for the letter editor's resilience layer.

Used by edit_server.py (the editor backend) and doctor.py (the repair tool).
Everything is local; the source of truth is letters.json and letters.js is a
generated artifact. See CLAUDE.md for the full architecture and recovery runbook.
"""

from __future__ import annotations

import datetime
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SCRIPTS = REPO / "scripts"
LETTERS_JSON = REPO / "letters.json"
CHAPTERS_JSON = REPO / "chapters.json"
LETTERS_JS = REPO / "letters.js"
INDEX_HTML = REPO / "index.html"
BACKUPS = REPO / ".backups"

# generated file -> generator script
GENERATED = {"letters.js": "build_letters.py", "cast.js": "build_cast.py", "photos.js": "build_photos.py"}
OFFLINE_HINTS = ("could not resolve host", "timed out", "timeout", "network is unreachable",
                 "connection", "unable to access", "ssl", "could not read from remote")


def git(*args: str, timeout: int | None = None) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(["git", *args], capture_output=True, text=True,
                              cwd=str(REPO), timeout=timeout)
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(args, 124, "", "timed out")


def _py(script: str, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(SCRIPTS / script), *args],
                          capture_output=True, text=True, cwd=str(REPO))


def regenerate(which: str = "all") -> list:
    scripts = list(GENERATED.values()) if which == "all" else [GENERATED.get(which, "")]
    out = []
    for s in scripts:
        if s and (SCRIPTS / s).exists():
            r = _py(s)
            out.append({"script": s, "code": r.returncode, "out": (r.stdout + r.stderr).strip()})
    return out


def ensure_merge_driver() -> bool:
    """Register the repo-local 'generated' merge driver (idempotent). It regenerates
    generated files instead of ever leaving a conflict. Config isn't committed, so
    edit_server and doctor both call this."""
    driver = f'"{sys.executable}" "{SCRIPTS / "regen_merge.py"}" %O %A %B %P'
    git("config", "merge.generated.name", "Regenerate generated files instead of merging")
    git("config", "merge.generated.driver", driver)
    return git("config", "--get", "merge.generated.driver").returncode == 0


def merge_driver_set() -> bool:
    return git("config", "--get", "merge.generated.driver").returncode == 0


def backup_letters_json(keep: int = 30) -> str | None:
    try:
        BACKUPS.mkdir(exist_ok=True)
        ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        dest = BACKUPS / f"letters-{ts}.json"
        dest.write_text(LETTERS_JSON.read_text(encoding="utf-8"), encoding="utf-8")
        for old in sorted(BACKUPS.glob("letters-*.json"))[:-keep]:
            old.unlink()
        return dest.name
    except Exception:
        return None


def letters_json_valid() -> bool:
    try:
        json.loads(LETTERS_JSON.read_text(encoding="utf-8"))
        return True
    except Exception:
        return False


def letters_js_in_sync() -> bool:
    """True if letters.js matches what letters.json would generate."""
    try:
        import build_letters  # scripts/ is on sys.path[0] when run as a script
        letters = json.loads(LETTERS_JSON.read_text(encoding="utf-8"))
        chapters = json.loads(CHAPTERS_JSON.read_text(encoding="utf-8"))
        return build_letters.render(letters, chapters) == LETTERS_JS.read_text(encoding="utf-8")
    except Exception:
        return False


def changed_letter_ids() -> list:
    r = git("show", "HEAD:letters.json")
    try:
        base = json.loads(r.stdout) if r.returncode == 0 else []
    except json.JSONDecodeError:
        base = []
    base_by_id = {l.get("id"): json.dumps(l, sort_keys=True) for l in base}
    cur = json.loads(LETTERS_JSON.read_text(encoding="utf-8"))
    return [l.get("id") for l in cur if json.dumps(l, sort_keys=True) != base_by_id.get(l.get("id"))]


def bump_cache_bust() -> str | None:
    html = INDEX_HTML.read_text(encoding="utf-8")
    m = re.search(r'window\.__APP_VERSION\s*=\s*"([^"]+)"', html)
    if not m:
        return None
    new = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    INDEX_HTML.write_text(html.replace(m.group(1), new), encoding="utf-8")
    return new


def _rebase_in_progress() -> bool:
    g = REPO / ".git"
    return (g / "rebase-merge").exists() or (g / "rebase-apply").exists()


def _abort_rebase() -> None:
    if _rebase_in_progress():
        git("rebase", "--abort")


def _conflicted() -> list:
    return [x for x in git("diff", "--name-only", "--diff-filter=U").stdout.split() if x]


def _add_generated() -> None:
    """git add only the generated files that actually exist (never error on a missing one)."""
    gen = [f for f in ("letters.js", "cast.js", "photos.js") if (REPO / f).exists()]
    if gen:
        git("add", *gen)


def _fix_generated_after_rebase() -> None:
    """After a rebase, make the committed generated files match the merged source. Only
    amend when there is a local commit on top of origin (never rewrite a remote commit)."""
    regenerate("all")
    dirty = git("status", "--porcelain", "--", "letters.js", "cast.js", "photos.js").stdout.strip()
    has_local = bool(git("rev-list", "origin/main..HEAD").stdout.strip())
    if dirty and has_local:
        _add_generated()
        git("commit", "--amend", "--no-edit")


def health(do_fetch: bool = True) -> dict:
    h = {"ok": True, "is_repo": True, "online": None, "ahead": 0, "behind": 0,
         "dirty": False, "letters_json_valid": True, "letters_js_in_sync": True,
         "merge_driver": True, "messages": []}
    if git("rev-parse", "--is-inside-work-tree").returncode != 0:
        h.update(is_repo=False, ok=False)
        h["messages"].append("This folder is not a git repository.")
        return h
    h["letters_json_valid"] = letters_json_valid()
    if not h["letters_json_valid"]:
        h["ok"] = False
        h["messages"].append("letters.json is not valid JSON — your last save may be corrupt; restore a backup.")
    h["letters_js_in_sync"] = letters_js_in_sync()
    if not h["letters_js_in_sync"]:
        h["messages"].append("The website file (letters.js) is out of date — click Rebuild.")
    h["merge_driver"] = merge_driver_set()
    h["dirty"] = bool(git("status", "--porcelain", "letters.json", "letters.js").stdout.strip())
    if do_fetch:
        f = git("fetch", "--quiet", "origin", "main", timeout=8)
        h["online"] = f.returncode == 0
        if h["online"]:
            ab = git("rev-list", "--left-right", "--count", "main...origin/main").stdout.strip().split()
            if len(ab) == 2:
                h["ahead"], h["behind"] = int(ab[0]), int(ab[1])
                if h["behind"]:
                    h["messages"].append(f"The live site has {h['behind']} newer change(s) — click Sync to catch up.")
        else:
            h["messages"].append("Can't reach GitHub right now (offline?). You can still edit; publish later.")
    return h


def sync() -> dict:
    """Bring the local repo current with the live site (fetch + rebase). Generated
    files auto-resolve via the merge driver."""
    ensure_merge_driver()
    f = git("fetch", "origin", "main")
    if f.returncode != 0:
        msg = (f.stderr + f.stdout)
        offline = any(k in msg.lower() for k in OFFLINE_HINTS)
        return {"ok": False, "offline": offline,
                "message": "Couldn't reach GitHub to sync (offline?)." if offline else "Sync failed.",
                "detail": msg.strip()}
    rb = git("rebase", "origin/main")
    if rb.returncode != 0:
        files = _conflicted()
        for gf in ("letters.js", "cast.js", "photos.js"):
            if gf in files:
                regenerate("all"); git("add", gf)
        if "index.html" in files:
            git("checkout", "--theirs", "--", "index.html"); bump_cache_bust(); git("add", "index.html")
        if _conflicted():
            _abort_rebase()
            return {"ok": False, "overlap": True,
                    "message": "There's an overlapping change that can't be merged automatically. Nothing was changed; run Repair or ask Claude.",
                    "detail": (rb.stdout + rb.stderr).strip()}
        git("rebase", "--continue")
    _fix_generated_after_rebase()
    return {"ok": True, "message": "Up to date with the live site."}


def publish(force: bool = False) -> dict:
    """Commit letters.json/letters.js/index.html and push. Auto-recover on rejection.
    Returns a result dict with a plain-English 'message'."""
    ensure_merge_driver()
    ids = changed_letter_ids()
    dirty = bool(git("status", "--porcelain", "letters.json", "letters.js").stdout.strip())
    unpushed = bool(git("rev-list", "origin/main..HEAD").stdout.strip())

    if not ids and not dirty and not unpushed and not force:
        return {"ok": True, "published": False, "message": "Nothing new to publish."}

    if ids or dirty:
        bump_cache_bust()
        git("add", "letters.json", "letters.js", "index.html")
        msg = (f"Edit transcript{'s' if len(ids) != 1 else ''} via editor: "
               + (", ".join(ids) if ids else "(update)"))
        git("commit", "-m", msg)
    else:
        msg = "Publish pending edits"

    if force:
        fp = git("push", "--force-with-lease", "origin", "main")
        if fp.returncode == 0:
            return {"ok": True, "published": True, "forced": True, "ids": ids, "message": "Published your version."}
        # fall through to normal recovery if force-with-lease is stale

    push = git("push", "origin", "main")
    if push.returncode == 0:
        return {"ok": True, "published": True, "ids": ids, "message": msg}

    err = (push.stderr + push.stdout)
    rejected = any(k in err for k in ("rejected", "fetch first", "non-fast-forward", "behind"))
    if not rejected:
        if any(k in err.lower() for k in OFFLINE_HINTS):
            return {"ok": False, "offline": True, "ids": ids,
                    "message": "Saved on your computer; couldn't reach GitHub. Your work is safe — click Publish again when you're online.",
                    "detail": err.strip()}
        return {"ok": False, "error": True, "message": "Publish couldn't finish.", "detail": err.strip()}

    # rejected: the live site moved. Fetch + rebase (generated files auto-resolve).
    git("fetch", "origin", "main")
    rb = git("rebase", "origin/main")
    if rb.returncode != 0:
        files = _conflicted()
        if "index.html" in files:
            git("checkout", "--theirs", "--", "index.html"); bump_cache_bust(); git("add", "index.html")
        for gf in ("letters.js", "cast.js", "photos.js"):
            if gf in files:
                regenerate("all"); git("add", gf)
        if any(f == "letters.json" or f.endswith(".json") for f in _conflicted()):
            _abort_rebase()
            bname = backup_letters_json()
            return {"ok": False, "overlap": True, "ids": ids, "backup": bname,
                    "message": "This letter was also changed somewhere else. To keep both safe, nothing was overwritten and your edit is backed up. Choose Sync (recommended) or Use my version."}
        cont = git("rebase", "--continue")
        if cont.returncode != 0:
            _abort_rebase()
            return {"ok": False, "error": True, "message": "Couldn't finish syncing automatically. Run Repair or ask Claude.",
                    "detail": (cont.stdout + cont.stderr).strip()}

    # rebase done. Make the committed letters.js match the merged letters.json, then push.
    _fix_generated_after_rebase()
    push2 = git("push", "origin", "main")
    if push2.returncode == 0:
        return {"ok": True, "published": True, "synced": True, "ids": ids,
                "message": "Synced the other change and published yours."}
    err2 = (push2.stderr + push2.stdout)
    if any(k in err2.lower() for k in OFFLINE_HINTS):
        return {"ok": False, "offline": True, "ids": ids,
                "message": "Synced, but couldn't reach GitHub to publish. Your work is safe — try again when online.",
                "detail": err2.strip()}
    return {"ok": False, "error": True, "message": "Synced but the publish still didn't go through. Try again or run Repair.",
            "detail": err2.strip()}
