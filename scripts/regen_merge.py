#!/usr/bin/env python3
"""
regen_merge.py — git merge driver for generated files (letters.js, cast.js, photos.js).

Instead of ever leaving a merge/rebase conflict in a generated file, this regenerates
it from its source (letters.json, cast.json, photos.json) and writes the result.
Registered in repo-local git config by repo_lib.ensure_merge_driver(); referenced by
.gitattributes (`letters.js merge=generated`). Git calls it with: %O %A %B %P
(ancestor, current/result, other, pathname). The merged result must be written to %A.
"""

import shutil
import sys
from pathlib import Path

import repo_lib  # scripts/ is on sys.path[0] when invoked by path


def main() -> int:
    if len(sys.argv) < 5:
        return 1
    result_path = sys.argv[2]            # %A — write the resolved content here
    name = Path(sys.argv[4]).name        # %P — pathname being merged
    if name not in repo_lib.GENERATED:
        return 1                          # not ours: let git report the conflict
    repo_lib.regenerate("all")            # rebuild from the (merged) source files
    try:
        shutil.copyfile(repo_lib.REPO / name, result_path)
        return 0
    except Exception:
        return 0  # leave the last-good generated file in place; never block the merge


if __name__ == "__main__":
    raise SystemExit(main())
