#!/bin/bash
# Double-click this if something seems wrong (the editor won't save, the website
# looks broken, or Publish keeps failing). It checks and fixes what it safely can,
# pulls in any changes from the live site, and tells you in plain English what's
# going on. It never deletes your edits.

cd "$(dirname "$0")" || exit 1
echo ""
python3 scripts/doctor.py --sync
echo ""
read -n 1 -s -r -p "  Done. Press any key to close this window."
echo ""
