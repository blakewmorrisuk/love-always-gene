#!/bin/bash
# build_app.sh — regenerate app.js from app.jsx.
#
# app.jsx is the SOURCE (React JSX). The website loads the committed app.js,
# which this script produces. Run after ANY edit to app.jsx:
#
#   bash scripts/build_app.sh
#
# Needs node/npx (first run downloads the pinned esbuild package). Letter
# editing never needs this — only developers changing app.jsx do. The JSX
# transform targets React.createElement (classic runtime) because app.jsx
# consumes React from window globals set in index.html. No other syntax is
# changed. See CLAUDE.md.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

npx -y esbuild@0.28.1 "$REPO/app.jsx" \
  --jsx=transform \
  --jsx-factory=React.createElement \
  --jsx-fragment=React.Fragment \
  --charset=utf8 \
  --outfile="$TMP" --log-level=warning

{
  echo "// GENERATED from app.jsx by scripts/build_app.sh — DO NOT EDIT BY HAND."
  echo "// Edit app.jsx, then run:  bash scripts/build_app.sh"
  cat "$TMP"
} > "$REPO/app.js"

node --check "$REPO/app.js"
echo "Wrote app.js ($(wc -c < "$REPO/app.js" | tr -d ' ') bytes) from app.jsx."
