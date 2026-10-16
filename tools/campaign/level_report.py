#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bilan « intérêt » de chaque niveau, à partir du solveur (portage fidèle du jeu).
  python tools/campaign/level_report.py levels.json            tableau complet
  python tools/campaign/level_report.py levels.json --csv f    même chose en CSV

Ce que l'on mesure, pour chaque niveau :
  min        coups de la solution optimale
  choix      coups de la solution où l'autre direction menait aussi quelque part de jouable :
             ce sont les vraies décisions. Les autres coups sont imposés (l'autre direction tue,
             bloque, ou ramène en arrière).
  imposes    coups de la solution sans vraie alternative
  serie      plus longue suite du même coup dans la solution (RRRRR = on spamme sans réfléchir)
  spam       True si répéter un seul bouton gagne
  meca       mécaniques réellement utilisées par la solution (S bouton, T téléporteur, r rotateur, w bord)
  deco       la mécanique du chapitre est-elle décorative ? (on l'efface : le niveau reste soluble aussi vite)
  temps      durée d'animation de la solution parfaite, en secondes (rotation + chutes, vitesses du jeu)
  ennui      note de 0 à 10 : beaucoup de coups imposés, de longues séries, une mécanique décorative,
             une solution longue mais peu de décisions. Au-dessus de 6 : candidat à couper ou refaire.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dg_solver import _path, _start, analyze, explore, fall, rot  # noqa: E402

SPIN_S = max(160, 320 * 1.5) / 1000   # dgSpin
FALL_K = 135 * 1.9 / 1000              # dgStepDelay : une chute de d cases dure FALL_K * sqrt(d)
MECHANIC = {"wrap": "w", "button": "S", "danger": "X", "rotator": "r", "teleporter": "T", "fragile": "F"}


def strip(rows, mech):
    """Le niveau sans la mécanique du chapitre (pour savoir si elle sert vraiment)."""
    out = []
    for r in rows:
        if mech == "S":
            r = r.replace("S", ".").replace("D", ".").replace("O", ".")
        elif mech == "r":
            r = r.replace("R", ".").replace("L", ".")
        elif mech == "T":
            r = r.translate(str.maketrans("123", "..."))
        elif mech == "X":
            r = r.replace("X", ".")
        elif mech == "F":
            r = r.replace("F", "#")   # sans le verre : un mur ordinaire
        out.append(r)
    return out


def fall_lengths(rows, sol):
    """Longueur de chaque chute de la solution (en cases), pour estimer le temps de jeu."""
    b, p = _start(rows)
    out = []
    s, b2, p2, t, h, o = fall(b, p, None, False, 0, set())
    b, p = b2, p2
    for ch in sol:
        b1, p1 = rot(b, p, 1 if ch == "R" else -1)
        s, b, p, t, h, o = fall(b1, p1, t, h, o, set())
        out.append(abs(p[1] - p1[1]) + abs(p[0] - p1[0]))
    return out


def decisions(rows, maxstates=900):
    """
    Sur la solution optimale, ce que coûte une erreur à chaque coup :
      piege   l'autre direction tue, boucle sans fin ou bloque le niveau
      detour  l'autre direction rallonge d'au moins 3 coups (il faut réfléchir)
      gratuit l'autre direction se rattrape en 2 coups ou moins (on peut tâtonner sans réfléchir)
    """
    g = explore(rows, True, maxstates)
    nodes = g["nodes"]
    wins = [i for i, nd in enumerate(nodes) if nd["win"]]
    if not wins:
        return None
    rev = {i: [] for i in range(len(nodes))}
    for i, nd in enumerate(nodes):
        for _, tgt in nd["edges"]:
            if isinstance(tgt, int):
                rev[tgt].append(i)
    dist = {i: 0 for i in wins}
    q = list(wins)
    while q:
        nq = []
        for j in q:
            for k in rev[j]:
                if k not in dist:
                    dist[k] = dist[j] + 1
                    nq.append(k)
        q = nq
    best = min(wins, key=lambda i: nodes[i]["depth"])
    chain = []
    i = best
    while nodes[i]["parent"] >= 0:
        chain.append(i)
        i = nodes[i]["parent"]
    chain.append(i)
    chain.reverse()
    trap = detour = free = 0
    for k in range(len(chain) - 1):
        nd, nxt = nodes[chain[k]], chain[k + 1]
        alt = [tgt for ch, tgt in nd["edges"] if tgt != nxt]
        if not alt:
            free += 1
            continue
        t = alt[0]
        if not isinstance(t, int) or t not in dist:
            trap += 1
        elif dist[t] - dist[nxt] >= 3:
            detour += 1
        else:
            free += 1
    return trap, detour, free, _path(nodes, best), g


def random_player(rows, g, trials=150, cap=400, seed=7):
    """Coups moyens d'un joueur qui tape au hasard (il recommence quand il meurt). Plafonné à cap."""
    import random
    nodes = g["nodes"]
    rnd = random.Random(seed)
    total = 0
    for _ in range(trials):
        i, n = 0, 0
        while n < cap and not nodes[i]["win"]:
            if nodes[i]["end"]:                          # arrivé sans le cœur : on recommence
                i = 0
                continue
            ch, tgt = rnd.choice(nodes[i]["edges"])
            n += 1
            i = tgt if isinstance(tgt, int) else 0
        total += n
    return total / trials


def longest_run(s):
    best = cur = 0
    prev = ""
    for c in s:
        cur = cur + 1 if c == prev else 1
        prev = c
        best = max(best, cur)
    return best


def report(path):
    data = json.load(open(path, encoding="utf-8-sig"))
    chap = {c["id"]: c for c in data["chapters"]}
    rows = []
    for i, l in enumerate(data["levels"]):
        a = analyze(l["map"], 900)
        d = decisions(l["map"])
        if a["min"] is None or d is None:
            rows.append({"i": i, "err": True})
            continue
        trap, detour, free, sol, g = d
        n = a["min"]
        real = trap + detour
        mech = MECHANIC.get(chap.get(l["chapter"], {}).get("mechanic"), "")
        used = "".join(sorted(u[0] for u in a["used"]))
        deco = False
        if mech == "X":
            deco = a["deaths"]["dead"] == 0          # aucune case mortelle n'est jamais atteinte
        elif mech in ("S", "r", "T", "F"):
            m2 = analyze(strip(l["map"], mech), 900)["min"]
            deco = m2 is not None and m2 <= n       # sans la mécanique, c'est aussi court : elle ne sert à rien
        elif mech == "w":
            deco = "w" not in used
        falls = fall_lengths(l["map"], sol)
        secs = n * SPIN_S + sum(FALL_K * math.sqrt(f) for f in falls if f)
        run = longest_run(sol)
        rnd = random_player(l["map"], g)
        forced = free
        # note d'ennui (0 à 10)
        boredom = 4 * (free / n)                                  # erreurs gratuites : on tâtonne au lieu de réfléchir
        boredom += min(1, max(0, run - 3) / 4) * 2                # longues séries du même coup
        boredom += 2 if deco else 0                               # la mécanique du chapitre ne sert pas
        boredom += 1.5 * max(0, 1 - (rnd / n - 1) / 4) if n > 2 else 0  # le hasard gagne presque aussi vite que la réflexion
        boredom += max(0, n - 10) * .3                            # longueur au-delà de 10 coups
        rows.append({"i": i, "chap": l["chapter"], "name": l.get("name", ""), "min": n, "real": real, "forced": forced,
                     "run": run, "spam": a["spam"], "used": used, "deco": deco, "states": a["states"],
                     "deaths": sum(a["deaths"].values()), "secs": secs, "trap": trap, "detour": detour, "rnd": rnd, "boredom": min(10, boredom), "sol": sol,
                     "grid": len(l["map"]), "mech": mech})
    return data, rows


def main(argv):
    path = argv[1] if len(argv) > 1 and not argv[1].startswith("--") else "levels.json"
    data, rows = report(path)
    print("idx chap  min piege detour gratuit serie hasard deco  temps ennui  sol")
    for r in rows:
        if r.get("err"):
            print("%3d  ERREUR" % r["i"])
            continue
        print("%3d %-5s %3d %5d %6d %7d %5d %6.0f %4s %5.1fs %5.1f  %s  %s" % (
            r["i"], r["chap"], r["min"], r["trap"], r["detour"], r["forced"], r["run"], r["rnd"],
            "oui" if r["deco"] else "-", r["secs"], r["boredom"], r["sol"], r["name"]))
    if "--csv" in argv:
        out = argv[argv.index("--csv") + 1]
        keys = ["i", "chap", "name", "min", "trap", "detour", "forced", "rnd", "run", "spam", "used", "deco", "states", "deaths", "secs", "boredom", "sol"]
        with open(out, "w", encoding="utf-8", newline="") as f:
            f.write(";".join(keys) + "\n")
            for r in rows:
                if not r.get("err"):
                    f.write(";".join(str(r[k]) for k in keys) + "\n")
    print("\nPar chapitre : niveaux, coups moyens, part d'erreurs gratuites, niveaux « ennuyeux » (note >= 5)")
    for c in data["chapters"]:
        rs = [r for r in rows if not r.get("err") and r["chap"] == c["id"]]
        if not rs:
            continue
        tot = sum(r["min"] for r in rs)
        print("%s %-22s %3d niv  %4.1f coups  %3d%% gratuites  %2d ennuyeux  %2d méca décorative" % (
            c["id"], c.get("subtitle", ""), len(rs), tot / len(rs), round(100 * sum(r["forced"] for r in rs) / tot),
            sum(r["boredom"] >= 5 for r in rs), sum(r["deco"] for r in rs)))


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    main(sys.argv)
