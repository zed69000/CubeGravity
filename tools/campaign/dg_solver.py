#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Solveur Date Gravity : portage fidèle de turn()/fall() de game.html.

Sert à valider et noter les niveaux hors du navigateur :
  python tools/campaign/dg_solver.py levels.json

Tuiles : # mur, A départ, B arrivée, S bouton, D bloc sorti, O bloc rentré,
X mort, R/L rotateurs, 1/2/3 téléporteurs.
"""
from __future__ import annotations

import json
import sys
from collections import deque

MAX_FALL_STEPS = 160  # même garde-fou que le jeu ("Boucle stoppée pour sécurité")
MAX_AUTO_ROTATIONS = 6  # au-delà, deux rotateurs se renvoient le cube sans fin : niveau invalide
ETERNAL_WRAPS = 3


def cw(m):
    n = len(m)
    o = [["."] * n for _ in range(n)]
    for y in range(n):
        row = m[y]
        for x in range(n):
            o[x][n - 1 - y] = row[x]
    return o


def ccw(m):
    n = len(m)
    o = [["."] * n for _ in range(n)]
    for y in range(n):
        row = m[y]
        for x in range(n):
            o[n - 1 - x][y] = row[x]
    return o


def rot(b, p, d):
    n = len(b)
    if d > 0:
        return cw(b), (n - 1 - p[1], p[0])
    return ccw(b), (p[1], n - 1 - p[0])


def unrot(p, ori, n):
    """Ramène une position du plateau tourné vers les coordonnées de la map d'origine."""
    for _ in range(ori % 4):
        p = (p[1], n - 1 - p[0])
    return p


def fall(b, p, telecd, held, ori, used, trace=None):
    """
    Une chute complète. Retourne (status, b, p, telecd, held, ori).
    status : land | dead | eternal | stuck
    used   : set alimenté avec S (bouton), T (téléporteur), rot, wrap.
    trace  : set optionnel des cases d'origine traversées.
    """
    n = len(b)
    wraps = 0
    rotcd = False
    safety = 0
    autorot = 0
    b = [r[:] for r in b]

    def switch():
        nonlocal held
        if b[p[1]][p[0]] != "S":
            held = False
            return False
        if held:
            return False
        held = True
        for row in b:
            for x in range(n):
                c = row[x]
                if c == "D":
                    row[x] = "O"
                elif c == "O":
                    row[x] = "D"
        used.add("S")
        return True

    while True:
        safety += 1
        if safety > MAX_FALL_STEPS:
            return "stuck", b, p, telecd, held, ori
        if trace is not None:
            trace.add(unrot(p, ori, n))
        switch()
        c = b[p[1]][p[0]]
        if c == "X":
            return "dead", b, p, telecd, held, ori
        if c not in "123" or c != telecd:
            telecd = None
        if c in "123" and telecd != c:
            pts = sorted((y, x) for y in range(n) for x in range(n) if b[y][x] == c)
            if len(pts) >= 2:
                t = pts[(pts.index((p[1], p[0])) + 1) % len(pts)]
                p = (t[1], t[0])
                telecd = c
                wraps = 0
                used.add("T")
                continue
        if c in "RL" and not rotcd:
            rotcd = True
            autorot += 1
            if autorot > MAX_AUTO_ROTATIONS:
                return "stuck", b, p, telecd, held, ori
            d = 1 if c == "R" else -1
            b, p = rot(b, p, d)
            ori += d
            used.add("rot")
            safety = 0  # le jeu relance un fall() neuf après la rotation auto
            continue
        ny = p[1] + 1
        leaves = ny >= n
        if leaves:
            ny = 0
        if b[ny][p[0]] not in "#D":
            if leaves:
                wraps += 1
                used.add("wrap")
                if wraps >= ETERNAL_WRAPS:
                    return "eternal", b, p, telecd, held, ori
            p = (p[0], ny)
            rotcd = False
            switch()
            continue
        if switch():
            if b[(p[1] + 1) % n][p[0]] not in "#D":
                continue
        return "land", b, p, telecd, held, ori


def _start(rows):
    b = [list(r) for r in rows]
    p = None
    for y, row in enumerate(b):
        for x, c in enumerate(row):
            if c == "A":
                p = (x, y)
                row[x] = "."
    return b, p


def _key(b, p, t):
    return ("".join("".join(r) for r in b), p, t)


def explore(rows, win=True, maxstates=300, trace=None):
    """
    Parcours en largeur de tous les états d'atterrissage.
    win=True  : les atterrissages sur B sont terminaux (comportement du jeu).
    win=False : B est ignoré, on cartographie tout (pour choisir où poser B).
    """
    b, p = _start(rows)
    n = len(b)
    used = set()
    res = {"start": "none", "nodes": [], "overflow": False,
           "deaths": {"dead": 0, "eternal": 0, "stuck": 0}}
    if p is None:
        return res
    s, b, p, t, h, o = fall(b, p, None, False, 0, used, trace)
    res["start"] = s
    if s != "land":
        return res
    nodes = res["nodes"]

    def add(b, p, t, h, o, depth, parent, move, used):
        nodes.append({"b": b, "p": p, "t": t, "h": h, "o": o, "depth": depth,
                      "parent": parent, "move": move, "used": used,
                      "cell": unrot(p, o, n), "win": win and b[p[1]][p[0]] == "B",
                      "edges": []})
        return len(nodes) - 1

    seen = {_key(b, p, t): add(b, p, t, h, o, 0, -1, "", frozenset(used))}
    q = deque([0])
    while q:
        i = q.popleft()
        nd = nodes[i]
        if nd["win"]:
            continue
        for d, ch in ((-1, "L"), (1, "R")):
            u = set(nd["used"])
            b2, p2 = rot(nd["b"], nd["p"], d)
            s, b3, p3, t3, h3, o3 = fall(b2, p2, nd["t"], nd["h"], nd["o"] + d, u, trace)
            if s != "land":
                res["deaths"][s] += 1
                nd["edges"].append((ch, s))
                continue
            k = _key(b3, p3, t3)
            j = seen.get(k)
            if j is None:
                if len(nodes) >= maxstates:
                    res["overflow"] = True
                    return res
                j = add(b3, p3, t3, h3, o3, nd["depth"] + 1, i, ch, frozenset(u))
                seen[k] = j
                q.append(j)
            nd["edges"].append((ch, j))
    return res


def _path(nodes, i):
    out = []
    while i >= 0 and nodes[i]["parent"] >= 0:
        out.append(nodes[i]["move"])
        i = nodes[i]["parent"]
    return "".join(reversed(out))


def play(rows, sol):
    """Rejoue une suite de coups. Retourne (résultat, coups réellement joués)."""
    b, p = _start(rows)
    s, b, p, t, h, o = fall(b, p, None, False, 0, set())
    for i, ch in enumerate(sol):
        if s != "land":
            return s, i
        if b[p[1]][p[0]] == "B":
            return "WIN", i
        b, p = rot(b, p, 1 if ch == "R" else -1)
        s, b, p, t, h, o = fall(b, p, t, h, o, set())
    if s == "land" and b[p[1]][p[0]] == "B":
        return "WIN", len(sol)
    return s, len(sol)


def solve_min(rows, maxstates=300):
    """Nombre minimal de coups, ou None si insoluble."""
    g = explore(rows, True, maxstates)
    wins = [nd["depth"] for nd in g["nodes"] if nd["win"]]
    return min(wins) if wins else None


def analyze(rows, maxstates=300):
    """
    Fiche complète d'un niveau :
      min, sol        : optimum et une solution optimale
      states          : états d'atterrissage non gagnants atteignables
      deaths          : transitions mortelles par type
      softlocks       : états d'où la victoire n'est plus atteignable
      used            : mécaniques déclenchées sur la solution optimale
      path_deaths     : morts à un coup de la solution optimale (pièges sur la route)
      spam            : True si répéter le même bouton suffit à gagner
    """
    g = explore(rows, True, maxstates)
    nodes = g["nodes"]
    out = {"start": g["start"], "overflow": g["overflow"], "min": None, "sol": None,
           "states": 0, "deaths": dict(g["deaths"]), "softlocks": 0, "used": set(),
           "path_deaths": {"dead": 0, "eternal": 0, "stuck": 0}, "spam": False}
    if g["start"] != "land" or g["overflow"]:
        return out
    wins = [i for i, nd in enumerate(nodes) if nd["win"]]
    out["states"] = len(nodes) - len(wins)
    if not wins:
        return out
    best = min(wins, key=lambda i: nodes[i]["depth"])
    out["min"] = nodes[best]["depth"]
    out["sol"] = _path(nodes, best)
    out["used"] = set(nodes[best]["used"])

    # États pouvant encore gagner : propagation arrière.
    rev = {i: [] for i in range(len(nodes))}
    for i, nd in enumerate(nodes):
        for _, tgt in nd["edges"]:
            if isinstance(tgt, int):
                rev[tgt].append(i)
    ok = set(wins)
    stack = list(wins)
    while stack:
        for j in rev[stack.pop()]:
            if j not in ok:
                ok.add(j)
                stack.append(j)
    out["softlocks"] = len(nodes) - len(ok)

    # Pièges situés à un coup de la solution optimale.
    i = best
    while nodes[i]["parent"] >= 0:
        par = nodes[i]["parent"]
        for ch, tgt in nodes[par]["edges"]:
            if ch != nodes[i]["move"] and not isinstance(tgt, int):
                out["path_deaths"][tgt] += 1
        i = par

    for ch in "LR":
        if play(rows, ch * 9)[0] == "WIN":
            out["spam"] = True
    return out


def canonical(rows):
    """Forme canonique à symétrie près (4 rotations x miroir), pour repérer les doublons."""
    pts = [(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c != "."]
    x0 = min(p[0] for p in pts); x1 = max(p[0] for p in pts)
    y0 = min(p[1] for p in pts); y1 = max(p[1] for p in pts)
    r = [row[x0:x1 + 1].ljust(x1 - x0 + 1, ".") for row in rows[y0:y1 + 1]]
    swap = str.maketrans("RL", "LR")
    out = []
    for m in (r, [row[::-1].translate(swap) for row in r]):
        for _ in range(4):
            out.append("/".join(m))
            m = ["".join(m[len(m) - 1 - y][x] for y in range(len(m))) for x in range(len(m[0]))]
    return min(out)


def main(argv):
    path = argv[1] if len(argv) > 1 else "levels.json"
    data = json.load(open(path, encoding="utf-8-sig"))
    levels = data["levels"] if isinstance(data, dict) else data
    bad = 0
    print("idx chap  grid max min etats morts pieges soft spam meca   nom")
    for i, l in enumerate(levels):
        a = analyze(l["map"], 600)
        stored = l.get("solution") or ""
        flags = []
        if a["min"] is None:
            flags.append("INSOLUBLE")
        elif l.get("maxMoves") not in (None, 999) and l["maxMoves"] != a["min"]:
            flags.append("maxMoves=%s mais optimum=%s" % (l["maxMoves"], a["min"]))
        if stored and play(l["map"], stored) != ("WIN", len(stored)):
            flags.append("solution stockée invalide")
        bad += bool(flags)
        used = "".join(sorted(u[0] for u in a["used"]))
        print("%3d %-5s %2d  %3s %3s %5d %5d %6d %4d %4s %-6s %s %s" % (
            i, l.get("chapter", "?"), len(l["map"]), l.get("maxMoves"), a["min"], a["states"],
            sum(a["deaths"].values()), sum(a["path_deaths"].values()), a["softlocks"],
            "oui" if a["spam"] else "-", used, l.get("name", ""),
            ("  <-- " + " ; ".join(flags)) if flags else ""))
    print("\n%d niveau(x), %d avec anomalie." % (len(levels), bad))
    return 1 if bad else 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    raise SystemExit(main(sys.argv))
