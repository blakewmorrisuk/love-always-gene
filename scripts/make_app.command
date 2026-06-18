#!/bin/bash
# Build (or rebuild) "Letter Editor.app" into ~/Applications so it can sit on the
# Dock. Double-click this, or run it. Pass --add-to-dock to also place it on the
# Dock (it backs up your Dock settings first and is reversible by dragging it off).
#
# The app is just a launcher: one click starts the local editor helper if needed
# and opens the editor in your browser. See CLAUDE.md / EDITING.md.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
APPS="$HOME/Applications"
APPNAME="Letter Editor"
APP="$APPS/$APPNAME.app"
ICON_SRC="$REPO/photos/pearl-harbor-01.jpg"

echo ""
echo "  Building \"$APPNAME.app\" ..."
mkdir -p "$APPS"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

# --- Info.plist (all literal) ---
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Letter Editor</string>
  <key>CFBundleDisplayName</key><string>Letter Editor</string>
  <key>CFBundleExecutable</key><string>Letter Editor</string>
  <key>CFBundleIdentifier</key><string>com.blakemorris.lettereditor</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>10.13</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

# --- launcher executable (REPO baked in now; runtime vars escaped with \) ---
cat > "$APP/Contents/MacOS/$APPNAME" <<EXE
#!/bin/bash
REPO="$REPO"
URL="http://localhost:8765/editor/"
cd "\$REPO" 2>/dev/null || { /usr/bin/open "https://blakewmorrisuk.github.io/love-always-gene/"; exit 0; }
if ! /usr/bin/curl -s -o /dev/null --max-time 1 "\$URL"; then
  EDITOR_NO_OPEN=1 /usr/bin/nohup /usr/bin/python3 scripts/edit_server.py > /tmp/letter-editor.log 2>&1 &
  for i in \$(seq 1 30); do /usr/bin/curl -s -o /dev/null --max-time 1 "\$URL" && break; sleep 0.3; done
fi
/usr/bin/open "\$URL"
EXE
chmod +x "$APP/Contents/MacOS/$APPNAME"

# --- icon (best-effort) ---
make_icon() {
  local src="$1" tmp="/tmp/le-icon-src.png" tmp512="/tmp/le-icon-512.png"
  [ -f "$src" ] || return 1
  local w h s
  w=$(sips -g pixelWidth "$src" 2>/dev/null | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$src" 2>/dev/null | awk '/pixelHeight/{print $2}')
  [ -n "$w" ] && [ -n "$h" ] || return 1
  s=$(( w < h ? w : h ))
  # center-crop to a square, scale to 512, convert straight to .icns (sips is more
  # reliable here than iconutil).
  sips -c "$s" "$s" "$src" --out "$tmp" >/dev/null 2>&1 || return 1
  sips -z 512 512 "$tmp" --out "$tmp512" >/dev/null 2>&1 || return 1
  sips -s format icns "$tmp512" --out "$APP/Contents/Resources/AppIcon.icns" >/dev/null 2>&1 || return 1
  return 0
}
if make_icon "$ICON_SRC"; then echo "  Icon: built from $(basename "$ICON_SRC")."; else echo "  Icon: using the default (custom icon skipped)."; fi

# --- make Finder/Dock pick it up cleanly ---
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
LSREG="/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister"
[ -x "$LSREG" ] && "$LSREG" -f "$APP" 2>/dev/null || true

echo "  Built: $APP"

# --- optionally add to the Dock ---
if [[ "$1" == "--add-to-dock" || "$2" == "--add-to-dock" ]]; then
  ts=$(date +%s)
  defaults export com.apple.dock "$HOME/.dock-backup-$ts.plist" 2>/dev/null || true
  if defaults read com.apple.dock persistent-apps 2>/dev/null | grep -q "$APPNAME.app"; then
    echo "  Dock: already there."
  else
    defaults write com.apple.dock persistent-apps -array-add "<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>$APP</string><key>_CFURLStringType</key><integer>0</integer></dict><key>file-label</key><string>$APPNAME</string></dict></dict>"
    killall Dock 2>/dev/null || true
    echo "  Dock: added (settings backed up to ~/.dock-backup-$ts.plist; remove anytime by dragging it off)."
  fi
fi
echo ""
