#!/usr/bin/env python3
"""
edit_server.py — the local "Letter Editor" backend.

Serves the repo on http://localhost:8765/ and exposes the API the editor uses.
Localhost-only. The heavy lifting (publish self-heal, backups, repair) lives in
scripts/repo_lib.py. See CLAUDE.md for the architecture and recovery runbook.

  GET  /api/letters       -> { letters, chapters }
  GET  /api/health        -> health snapshot (online, behind, in-sync, ...)
  GET  /api/changes       -> { ids }
  POST /api/letter/<id>   -> save edited fields (writes letters.json, backs up, rebuilds)
  POST /api/sync          -> pull the live site's newer changes
  POST /api/rebuild       -> regenerate the website files from the source
  POST /api/publish       -> commit + push, auto-recovering on rejection
  POST /api/force-publish -> publish your version (force-with-lease)

Run:  python3 scripts/edit_server.py   (or double-click "Edit Letters.command")
"""

from __future__ import annotations

import http.server
import json
import os
import socketserver
import sys
import webbrowser
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
import build_letters  # noqa: E402
import repo_lib  # noqa: E402

PORT = 8765


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(REPO), **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):
        pass

    def _json(self, code: int, obj) -> None:
        data = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _call(self, fn) -> None:
        try:
            self._json(200, fn())
        except Exception as e:  # noqa: BLE001
            self._json(500, {"ok": False, "error": True, "message": str(e)})

    def do_GET(self):
        p = self.path.split("?", 1)[0]
        if p == "/api/letters":
            # Enriched view (adds the generated images/images_web fields) so
            # the editor's scan pane shows the files that actually exist.
            return self._call(lambda: {
                "letters": build_letters.enrich_letters(
                    json.loads(repo_lib.LETTERS_JSON.read_text(encoding="utf-8"))),
                "chapters": json.loads(repo_lib.CHAPTERS_JSON.read_text(encoding="utf-8")),
            })
        if p == "/api/health":
            return self._call(lambda: repo_lib.health(do_fetch=True))
        if p == "/api/changes":
            return self._call(lambda: {"ids": repo_lib.changed_letter_ids()})
        if p in ("/", ""):
            self.path = "/editor/"
        return super().do_GET()

    def do_POST(self):
        p = self.path.split("?", 1)[0]
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length else b""
        if p.startswith("/api/letter/"):
            return self.save_letter(p[len("/api/letter/"):], raw)
        if p == "/api/publish":
            return self._call(lambda: repo_lib.publish(force=False))
        if p == "/api/force-publish":
            return self._call(lambda: repo_lib.publish(force=True))
        if p == "/api/sync":
            return self._call(repo_lib.sync)
        if p == "/api/rebuild":
            return self._call(lambda: {"ok": True, "message": "Rebuilt the website files.",
                                       "steps": repo_lib.regenerate("all")})
        return self._json(404, {"error": "unknown endpoint"})

    def save_letter(self, lid: str, raw: bytes):
        try:
            updated = json.loads(raw or b"{}")
            # The editor round-trips whole records from the enriched
            # /api/letters view; never write the generated display fields
            # back into letters.json (an explicit "images" override that is
            # already IN letters.json survives via the merge below).
            for gen_key in ("images", "images_web", "image_count"):
                updated.pop(gen_key, None)
            letters = json.loads(repo_lib.LETTERS_JSON.read_text(encoding="utf-8"))
            idx = next((i for i, l in enumerate(letters) if l.get("id") == lid), -1)
            if idx < 0:
                return self._json(404, {"error": f"no letter {lid}"})
            letters[idx] = {**letters[idx], **updated}
            repo_lib.LETTERS_JSON.write_text(
                json.dumps(letters, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            backup = repo_lib.backup_letters_json()
            steps = repo_lib.regenerate("letters.js")
            bad = [s for s in steps if s["code"] != 0]
            if bad:
                return self._json(500, {"error": "regenerating letters.js failed", "detail": bad})
            return self._json(200, {"ok": True, "id": lid, "backup": backup})
        except Exception as e:  # noqa: BLE001
            return self._json(500, {"error": str(e)})


def main() -> int:
    repo_lib.ensure_merge_driver()  # make sure generated-file conflicts auto-resolve
    socketserver.TCPServer.allow_reuse_address = True
    try:
        httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    except OSError as e:
        sys.stderr.write(
            f"Could not start on port {PORT}: {e}\n"
            f"An editor may already be running. Open http://localhost:{PORT}/editor/ , "
            f"or close the other one and try again.\n")
        return 1
    url = f"http://localhost:{PORT}/editor/"
    print("\n  Letter Editor is running.")
    print(f"  Open:  {url}")
    print("  Stop:  press Control-C in this window.\n")
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
