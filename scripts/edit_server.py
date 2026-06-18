#!/usr/bin/env python3
"""
edit_server.py — the local "Letter Editor" backend.

Serves the repo on http://localhost:8765/ and exposes a tiny API the editor
(editor/) uses to read letters, save an edit, and publish to the live site.
Bind is localhost-only; nothing is exposed off the machine.

  GET  /api/letters        -> { letters: [...], chapters: [...] }
  POST /api/letter/<id>    -> merge the posted fields into that letter in
                              letters.json, regenerate letters.js
  GET  /api/changes        -> { ids: [...] }  (letters changed vs the last commit)
  POST /api/publish        -> bump cache-bust in index.html, commit
                              letters.json/letters.js/index.html, push

Run:  python3 scripts/edit_server.py   (or double-click "Edit Letters.command")
Stop: Ctrl-C in the Terminal window.
"""

from __future__ import annotations

import datetime
import http.server
import json
import re
import socketserver
import subprocess
import sys
import webbrowser
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PORT = 8765
LETTERS_JSON = REPO / "letters.json"
CHAPTERS_JSON = REPO / "chapters.json"
INDEX_HTML = REPO / "index.html"
BUILD_LETTERS = REPO / "scripts" / "build_letters.py"


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], capture_output=True, text=True, cwd=str(REPO))


def changed_letter_ids() -> list[str]:
    """Letter ids whose record differs from the last committed letters.json."""
    res = git("show", "HEAD:letters.json")
    try:
        base = json.loads(res.stdout) if res.returncode == 0 else []
    except json.JSONDecodeError:
        base = []
    base_by_id = {l.get("id"): json.dumps(l, sort_keys=True) for l in base}
    cur = json.loads(LETTERS_JSON.read_text(encoding="utf-8"))
    return [
        l.get("id") for l in cur
        if json.dumps(l, sort_keys=True) != base_by_id.get(l.get("id"))
    ]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(REPO), **k)

    # No caching, so the local preview always reflects the latest edit.
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):  # keep the Terminal quiet
        pass

    def _json(self, code: int, obj) -> None:
        data = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/letters":
            try:
                return self._json(200, {
                    "letters": json.loads(LETTERS_JSON.read_text(encoding="utf-8")),
                    "chapters": json.loads(CHAPTERS_JSON.read_text(encoding="utf-8")),
                })
            except Exception as e:  # noqa: BLE001
                return self._json(500, {"error": str(e)})
        if path == "/api/changes":
            try:
                return self._json(200, {"ids": changed_letter_ids()})
            except Exception as e:  # noqa: BLE001
                return self._json(500, {"error": str(e)})
        if path == "/" or path == "":
            self.path = "/editor/"  # land on the editor by default
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length else b""
        if path.startswith("/api/letter/"):
            return self.save_letter(path[len("/api/letter/"):], raw)
        if path == "/api/publish":
            return self.publish()
        return self._json(404, {"error": "unknown endpoint"})

    def save_letter(self, lid: str, raw: bytes):
        try:
            updated = json.loads(raw or b"{}")
            letters = json.loads(LETTERS_JSON.read_text(encoding="utf-8"))
            idx = next((i for i, l in enumerate(letters) if l.get("id") == lid), -1)
            if idx < 0:
                return self._json(404, {"error": f"no letter {lid}"})
            # Merge posted fields over the existing record (never drop unknown keys).
            letters[idx] = {**letters[idx], **updated}
            LETTERS_JSON.write_text(
                json.dumps(letters, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
            r = subprocess.run(
                [sys.executable, str(BUILD_LETTERS)],
                capture_output=True, text=True, cwd=str(REPO),
            )
            if r.returncode != 0:
                return self._json(500, {"error": "regenerating letters.js failed", "detail": r.stderr})
            return self._json(200, {"ok": True, "id": lid})
        except Exception as e:  # noqa: BLE001
            return self._json(500, {"error": str(e)})

    def bump_cache_bust(self) -> str | None:
        html = INDEX_HTML.read_text(encoding="utf-8")
        m = re.search(r'window\.__APP_VERSION\s*=\s*"([^"]+)"', html)
        if not m:
            return None
        old = m.group(1)
        new = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        INDEX_HTML.write_text(html.replace(old, new), encoding="utf-8")
        return new

    def publish(self):
        try:
            ids = changed_letter_ids()
            self.bump_cache_bust()
            label = ", ".join(ids) if ids else "(no letter changes)"
            msg = f"Edit transcript{'s' if len(ids) != 1 else ''} via editor: {label}"
            steps = []
            for cmd in (
                ["git", "add", "letters.json", "letters.js", "index.html"],
                ["git", "commit", "-m", msg],
                ["git", "push", "origin", "main"],
            ):
                r = subprocess.run(cmd, capture_output=True, text=True, cwd=str(REPO))
                steps.append({"cmd": " ".join(cmd[:2]), "code": r.returncode,
                              "out": (r.stdout + r.stderr).strip()})
                # "git commit" returns non-zero when there is nothing to commit; tolerate it.
                if r.returncode != 0 and cmd[1] != "commit":
                    return self._json(500, {"error": f"{' '.join(cmd[:2])} failed", "steps": steps})
            return self._json(200, {"ok": True, "message": msg, "ids": ids, "steps": steps})
        except Exception as e:  # noqa: BLE001
            return self._json(500, {"error": str(e)})


def main() -> int:
    socketserver.TCPServer.allow_reuse_address = True
    try:
        httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    except OSError as e:
        sys.stderr.write(f"Could not start on port {PORT}: {e}\n"
                         f"Another editor may already be running. "
                         f"Open http://localhost:{PORT}/editor/ , or close it and retry.\n")
        return 1
    url = f"http://localhost:{PORT}/editor/"
    print("\n  Letter Editor is running.")
    print(f"  Open:  {url}")
    print("  Stop:  press Ctrl-C in this window.\n")
    import os
    if not os.environ.get("EDITOR_NO_OPEN"):
        try:
            webbrowser.open(url)
        except Exception:  # noqa: BLE001
            pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Editor stopped.\n")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
