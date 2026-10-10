#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Audit des briques spéciales : pour chaque niveau, à quoi sert chaque brique ?

  python tools/campaign/audit_specials.py [levels.json]

On retire les briques une par une (une paire entière pour un téléporteur, un cadenas
devient un mur ordinaire) et on compare le niveau avant / après :
  essentielle : sans elle, le nombre minimal de coups change ou le niveau devient insoluble ;
  piège       : l'optimum ne change pas, mais elle modifie ce qui peut arriver au joueur
                (une mort possible, une impasse, un détour) : c'est une fausse piste ;
  inerte      : rien ne change du tout. Décor pur, à proscrire.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dg_solver import analyze  # noqa: E402

LABEL = {"S": "clé", "D": "cadenas fermé", "O": "cadenas ouvert", "X": "cœur brisé",
         "R": "rotateur", "L": "rotateur", "1": "portail A", "2": "portail B", "3": "portail C"}


def signature(rows):
    a = analyze(rows, 300)
    return a["min"], sum(a["deaths"].values()), a["softlocks"], a["states"]


def groups(rows):
    """Les briques à tester : [(caractère, [cases])]. Les deux bouts d'un portail vont ensemble."""
    out, tele = [], {}
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c in "SDOXRL":
                out.append((c, [(x, y)]))
            elif c in "123":
                tele.setdefault(c, []).append((x, y))
    return out + [(c, cells) for c, cells in sorted(tele.items())]


def without(rows, ch, cells):
    g = [list(r) for r in rows]
    for x, y in cells:
        g[y][x] = "#" if ch == "D" else "."
    return ["".join(r) for r in g]


def classify(rows):
    """Retourne [(caractère, cases, rôle)] avec rôle = essential | trap | inert."""
    base = signature(rows)
    res = []
    for ch, cells in groups(rows):
        sig = signature(without(rows, ch, cells))
        role = "essential" if sig[0] != base[0] else ("trap" if sig != base else "inert")
        res.append((ch, cells, role))
    return res


def main():
    root = Path(__file__).resolve().parents[2]
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "levels.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    tot = {"essential": 0, "trap": 0, "inert": 0}
    flagged = 0
    per_ch = {}
    for i, lv in enumerate(data["levels"]):
        res = classify(lv["map"])
        if not res:
            continue
        c = {"essential": 0, "trap": 0, "inert": 0}
        for ch, _, role in res:
            c[role] += 1
            tot[role] += 1
        useless = c["trap"] + c["inert"]
        st = per_ch.setdefault(lv.get("chapter", "?"), [0, 0, 0, 0])
        st[0] += 1
        st[1] += c["essential"]
        st[2] += c["trap"]
        st[3] += c["inert"]
        if c["inert"] or useless > c["essential"]:
            flagged += 1
            detail = ", ".join("%s %s" % (LABEL[ch], role) for ch, _, role in res if role != "essential")
            print("%3d %-4s %-26s ess=%d piège=%d inerte=%d  | %s" % (
                i + 1, lv.get("chapter", ""), (lv.get("name") or "")[:26], c["essential"], c["trap"], c["inert"], detail))
    print()
    for ch, st in sorted(per_ch.items()):
        print("%s : %2d niveaux avec briques, essentielles=%d pièges=%d inertes=%d" % (ch, *st))
    print("TOTAL briques : essentielles=%(essential)d pièges=%(trap)d inertes=%(inert)d" % tot)
    print("niveaux à revoir : %d" % flagged)


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    main()
