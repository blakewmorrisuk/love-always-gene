#!/bin/bash
# Double-click this file to open the Letter Editor in your browser.
# It starts a small local helper, then your browser opens to the editor.
# Keep this Terminal window open while editing; close it (or press Control-C)
# when you're done.

cd "$(dirname "$0")" || exit 1
echo ""
echo "  Opening the Letter Editor…"
echo "  Keep this window open while you edit."
echo ""
python3 scripts/edit_server.py
