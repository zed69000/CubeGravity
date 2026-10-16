#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Plafonne la longueur des niveaux : un niveau de plus de CAP coups démarre plus loin sur sa solution optimale.
  python tools/campaign/trim_long.py levels.json [CAP]

Pourquoi : au-delà de 10 coups, la longueur ne rend pas un niveau plus difficile, seulement plus long.
Les premiers coups d'un niveau long sont surtout des coups « gratuits » (voir level_report.py) : on les retire
en posant le joueur là où il serait arrivé, sur le plateau tel qu'il serait (déjà tourné, portes comprises).
On choisit le point de départ qui garde le plus de vraies décisions (pièges et détours).

Une copie de l'ancien fichier est écrite dans Levels/ avant toute modification.
"""
from __future__ import annotations

import json
import shutil
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dg_solver import analyze, explore, play  # noqa: E402
from level_report import decisions  # noqa: E402


def best_cut(rows, cap):
    g = explore(rows, True, 900)
    nodes = g["nodes"]
    win = min((k for k, nd in enumerate(nodes) if nd["win"]), key=lambda k: nodes[k]["depth"])
    chain, k = [], win
    while k >= 0:
        chain.append(k)
        k = nodes[k]["parent"]
    chain.reverse()
    best = None
    for cut in range(1, len(chain) - 1):
        nd = nodes[chain[cut]]
        x, y = nd["p"]
        # état reproductible par une simple carte : pas de bouton tenu, pas sur un téléporteur, case libre sous le joueur
        if nd["h"] or nd["t"] or nd["b"][y][x] != ".":
            continue
        b = [r[:] for r in nd["b"]]
        b[y][x] = "A"
        new = ["".join(r) for r in b]
        d = decisions(new)
        if not d:
            continue
        trap, detour, free, sol, _ = d
        if len(sol) > cap:
            continue
        cand = (trap + detour, len(sol), cut, new, sol)
        if best is None or cand[:2] > best[:2]:
            best = cand
    return best


def main(argv):
    path = Path(argv[1] if len(argv) > 1 else "levels.json")
    cap = int(argv[2]) if len(argv) > 2 else 10
    data = json.load(open(path, encoding="utf-8-sig"))
    changed = []
    for i, l in enumerate(data["levels"]):
        a = analyze(l["map"], 900)
        if a["min"] is None or a["min"] <= cap:
            continue
        cut = best_cut(l["map"], cap)
        if not cut:
            print("%3d %-26s %2d coups : aucun point de départ propre, laissé tel quel" % (i, l.get("name", ""), a["min"]))
            continue
        useful, n, at, new, sol = cut
        assert play(new, sol) == ("WIN", len(sol))
        print("%3d %-26s %2d -> %2d coups (départ au coup %d, %d vraies décisions)  %s" % (
            i, l.get("name", ""), a["min"], n, at, useful, sol))
        l["map"], l["maxMoves"], l["solution"] = new, n, sol
        changed.append(i)
    if changed:
        root = path.resolve().parent
        backup = root / "Levels" / ("levels_avant_plafond%d_%s.json" % (cap, time.strftime("%Y%m%d_%H%M")))
        backup.parent.mkdir(exist_ok=True)
        shutil.copyfile(path, backup)
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print("\n%d niveau(x) raccourci(s). Ancienne version : %s" % (len(changed), backup.relative_to(root)))


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    main(sys.argv)
