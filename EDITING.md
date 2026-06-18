# Editing the letters

A plain guide to fixing and publishing the letter transcripts. No coding needed.

## Open the editor

1. Open the **love-always-gene** folder.
2. Double-click **"Edit Letters.command"**. A small Terminal window opens and your browser
   opens the editor. Keep the Terminal window open while you work; close it when you're done.

## Make an edit

- Pick a letter from the dropdown at the top, or step with the **‹** and **›** arrows.
- The **original scan is on the left**. Pinch on your trackpad to zoom in (some shots are far
  away), drag to move it, double-click to zoom in and out, or use the −/+/Fit buttons. Use the
  page arrows for multi-page letters.
- Fix the **text on the right**. The fields change to match the kind of letter (telegrams and
  the Christmas card have their own fields). The **Edit / Preview** toggle shows how it will
  look on the website.
- The markers `[[ ]]` (a brass underline), `[?]` (an unreadable word), and `[word?]` (an
  uncertain reading) are explained on the screen. Leave them unless you're fixing the reading.
- Click **Save**. Your change is written, and a copy is tucked into a hidden **.backups**
  folder automatically, so an edit is never lost.

## Publish to the live site

- When you're ready for the world to see it, click **Publish**. The website updates in about
  30 seconds.
- The colored bar at the top tells you the state:
  - **Green** "in sync" — all good.
  - **Amber** "the live site has newer changes" — click **Sync** first, then Publish.
  - **Amber** "Offline" — no internet right now. Keep editing; your work is saved on your
    computer, and Publish will work once you're back online.

## If something seems wrong

**Double-click "Repair.command"** in the love-always-gene folder. It checks everything,
fixes what it safely can, pulls in any changes from the live site, and tells you in plain
English what (if anything) you need to do. It never deletes your edits.

A few specifics:
- **The editor page says "the helper isn't running."** Double-click "Edit Letters.command"
  again to start it, then reload the page.
- **Publish says two versions clashed.** The editor keeps both safe: it shows you a choice to
  either keep the other change (recommended) or use your version. Your edit is backed up
  either way.
- **The website itself looks broken.** Double-click "Repair.command" (it rebuilds the site
  files), or just tell Claude "the love-always-gene website looks broken."

## Good to know

- **The website never breaks just because the editor does.** They're separate. The worst a
  broken editor can do is stop you editing until it's fixed; the live site keeps running.
- **Your edits are always backed up** in the `.backups` folder (one file per Save).
- **A fresh Claude can fix anything here.** Just point it at this folder and say what's wrong;
  there's a full recovery guide in **CLAUDE.md** that it reads automatically.
