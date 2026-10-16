#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Retire des fichiers lang/*.js les traductions dont le texte français n'existe plus dans le jeu
(niveau supprimé, phrase retirée…). À lancer après tools/i18n/extract.py.
  python tools/i18n/prune.py
"""
import glob
import io
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
src = json.load(open(ROOT / "tools/i18n/source.json", encoding="utf-8"))
keys = set(src.keys()) if isinstance(src, dict) else {x if isinstance(x, str) else (x.get("fr") or x.get("text")) for x in src}
KEY = re.compile(r'\s*("(?:[^"\\]|\\.)*")\s*:')
for f in sorted(glob.glob(str(ROOT / "lang/*.js"))):
    lines = io.open(f, encoding="utf-8").read().split("\n")
    out, removed = [], 0
    for line in lines:
        m = KEY.match(line)
        if m and json.loads(m.group(1)) not in keys:
            removed += 1
            continue
        out.append(line)
    io.open(f, "w", encoding="utf-8", newline="\n").write("\n".join(out))
    print("%s : %d traduction(s) retirée(s)" % (Path(f).name, removed))
