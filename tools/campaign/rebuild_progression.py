#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reconstruit la progression de la campagne autour d'une règle simple :
  une brique nouvelle s'apprend seule (2 niveaux de découverte), puis elle se mélange tout de suite
  avec TOUTES les briques déjà débloquées. On n'attend plus les derniers chapitres pour mélanger.

  python tools/campaign/rebuild_progression.py              # écrit levels.json (copie de l'ancien dans Levels/)
  python tools/campaign/rebuild_progression.py --dry        # montre le résultat sans rien écrire

Ce qui est gardé : les niveaux actuels qui respectent les règles de leur chapitre et les critères de qualité.
Ce qui manque est généré (générateur de generate_campaign.py), puis vérifié par le solveur.

Critères de qualité d'un niveau de pratique :
  - 3 à 10 coups, jamais « toujours le même côté » ;
  - assez de vraies décisions (pièges ou détours, voir level_report.py) ;
  - un joueur qui tape au hasard met nettement plus longtemps qu'un joueur qui réfléchit ;
  - chaque brique présente sert vraiment ;
  - pas de quasi-doublon d'un autre niveau (à rotation / miroir près).
"""
from __future__ import annotations

import hashlib
import json
import random
import shutil
import sys
import time
from multiprocessing import Pool
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import generate_campaign as gc  # noqa: E402
from dg_solver import _start, analyze, canonical, fall, play, solve_min  # noqa: E402
from level_report import decisions, random_player  # noqa: E402

ROOT = HERE.parents[1]
# chapitre -> (nombre de niveaux, brique nouvelle, briques déjà débloquées à mélanger)
PLAN = [
    dict(count=6, new="base", prev=[], moves=(1, 5)),
    dict(count=10, new="wrap", prev=[], moves=(3, 7)),
    dict(count=12, new="button", prev=["wrap"], moves=(3, 8)),
    dict(count=12, new="danger", prev=["button"], moves=(4, 8)),
    dict(count=14, new="rotator", prev=["button", "danger"], moves=(4, 9)),
    dict(count=14, new="teleporter", prev=["button", "danger", "rotator"], moves=(5, 10)),
    dict(count=14, new="fragile", prev=["button", "danger", "rotator", "teleporter"], moves=(5, 10)),
    dict(count=14, new="heart", prev=["button", "danger", "rotator", "teleporter", "fragile"], moves=(5, 10)),
]
DISC = 2          # niveaux de découverte par chapitre (le premier est tout entier en découverte, les chapitres « mélange » n'en ont pas)


def disc_count(ch):
    p = PLAN[ch]
    return p["count"] if ch == 0 else (0 if p["new"] == "mix" else DISC)
MAX_MOVES = 10


def mechs_used(rows, a):
    """Briques réellement utilisées par la solution (le cœur brisé compte s'il menace la route)."""
    u = set()
    if "wrap" in a["used"]:
        u.add("wrap")
    if "S" in a["used"]:
        u.add("button")
    if "rot" in a["used"]:
        u.add("rotator")
    if "T" in a["used"]:
        u.add("teleporter")
    if "F" in a["used"]:
        u.add("fragile")
    if "H" in a["used"]:
        u.add("heart")
    if "X" in "".join(rows) and a["path_deaths"]["dead"] >= 1:
        u.add("danger")
    return u


def mechs_present(rows):
    s = "".join(rows)
    p = set()
    if any(c in s for c in "SDO"):
        p.add("button")
    if "X" in s:
        p.add("danger")
    if "F" in s:
        p.add("fragile")
    if "H" in s:
        p.add("heart")
    if any(c in s for c in "RL"):
        p.add("rotator")
    if any(c in s for c in "123"):
        p.add("teleporter")
    return p


def harder_without(rows, chars, base):
    m = solve_min(gc.strip(rows, chars))
    return m is None or m > base


def needed(rows, mech, a):
    """La brique est indispensable : sans elle, le niveau devient insoluble ou plus long."""
    if mech == "button":
        return "S" in a["used"] and harder_without(rows, "SDO", a["min"])
    if mech == "rotator":
        return "rot" in a["used"] and harder_without(rows, "RL", a["min"])
    if mech == "teleporter":
        return "T" in a["used"] and harder_without(rows, "123", a["min"])
    if mech == "danger":
        return a["path_deaths"]["dead"] >= 1
    if mech == "fragile":
        m = solve_min([r.replace("F", "#") for r in rows])
        return "F" in a["used"] and (m is None or m > a["min"])
    if mech == "heart":
        m = solve_min(gc.strip(rows, "H"))
        return "H" in a["used"] and m is not None and m < a["min"]   # il faut un détour pour le ramasser
    if mech == "wrap":
        return "wrap" in a["used"]
    return True


def card(rows, origin, name=None, lid=None):
    """Fiche complète d'un niveau, ou None s'il n'est pas jouable."""
    a = analyze(rows, 900)
    if a["min"] is None or a["overflow"]:
        return None
    d = decisions(rows)
    if not d:
        return None
    trap, detour, free, sol, g = d
    b0, p0 = _start(rows)
    start_used = set()
    fall(b0, p0, None, False, 0, start_used)   # ce qui se passe avant le premier coup du joueur
    return {"start_used": start_used, "map": rows, "min": a["min"], "sol": sol, "a": a, "useful": trap + detour, "rnd": random_player(rows, g),
            "used": mechs_used(rows, a), "present": mechs_present(rows), "canon": canonical(rows),
            "score": gc.score_of(a), "origin": origin, "name": name, "id": lid}


def fits(c, ch, role):
    """Le niveau a-t-il sa place à ce rôle (découverte / pratique) dans ce chapitre ?"""
    p = PLAN[ch]
    allowed = set(p["prev"]) | ({p["new"]} if p["new"] not in ("base", "mix") else set())
    if not c["present"] <= allowed:
        return False                                    # une brique pas encore débloquée
    a = c["a"]
    if c.get("start_used", set()) & {"F", "H"}:
        return False                                    # verre cassé ou cœur ramassé avant même de jouer
    if a["spam"] and c["min"] >= 2:
        return False
    if c["min"] > MAX_MOVES:
        return False
    if role == "disc":
        if not (1 <= c["min"] <= 4):
            return False
        if p["new"] in ("base", "wrap"):
            return (p["new"] == "wrap") == ("wrap" in c["used"]) and not c["present"]
        return c["present"] == {p["new"]} and needed(c["map"], p["new"], a)
    # pratique : la brique du chapitre + au moins une brique plus ancienne, toutes utiles
    early = ch <= 2
    if c["min"] < 3 or c["useful"] < (1 if early else max(2, round(.3 * c["min"]))) or c["rnd"] < (2 if early else 3) * c["min"]:
        return False
    for m in c["present"]:
        if not needed(c["map"], m, a):
            return False                                # une brique posée pour rien
    if not early and (c["min"] - c["useful"]) / c["min"] > .4:
        return False                                    # trop d'erreurs qui se rattrapent sans réfléchir
    special = c["used"] - {"wrap"}
    if p["new"] == "base":
        return not c["present"]
    if p["new"] == "wrap":
        return "wrap" in c["used"] and not c["present"]
    if p["new"] == "button":
        return "button" in special
    if p["new"] == "mix":
        return len(special) >= 3
    mixed = 2 if ch >= 7 else 1                         # en fin de campagne, au moins deux briques anciennes
    return p["new"] in special and len(special & set(p["prev"])) >= mixed


# ---------------------------------------------------------------- génération de ce qui manque

def world_for(ch, role):
    w = dict(gc.WORLDS[ch])
    p = PLAN[ch]
    if role == "disc":
        return w
    w["moves"] = (3, MAX_MOVES)
    if p["new"] == "mix":
        w["extras"] = {m: .8 for m in p["prev"]}
    elif p["prev"] and p["prev"] != ["wrap"]:
        w["extras"] = {m: .85 for m in p["prev"]}       # on pousse fort vers le mélange
    return w


def gen_job(job):
    ch, role, seed, seconds = job
    rng = random.Random(seed)
    world = world_for(ch, role)
    out, end = [], time.time() + seconds
    while time.time() < end:
        c = gc.candidate(world, "disc" if role == "disc" else "main", rng)
        if not c:
            continue
        k = card(c["map"], "generated")
        if k:
            k["fresh"] = True
        if k and fits(k, ch, role):
            out.append(k)
    return ch, role, out


def jaccard_close(a, b):
    if len(a) != len(b):
        return False
    A = {(x, y, c) for y, r in enumerate(a) for x, c in enumerate(r) if c != "."}
    best = 0
    for g in gc_syms(b):
        B = {(x, y, c) for y, r in enumerate(g) for x, c in enumerate(r) if c != "."}
        best = max(best, len(A & B) / max(1, len(A | B)))
    return best >= .6


def gc_syms(rows):
    m = [list(r) for r in rows]
    out = []
    for flip in (False, True):
        g = [r[::-1] for r in m] if flip else [r[:] for r in m]
        for _ in range(4):
            out.append(g)
            n = len(g)
            g = [[g[n - 1 - x][y] for x in range(n)] for y in range(n)]
    return out


def main(argv):
    dry = "--dry" in argv
    only = None
    if "--only" in argv:
        only = {int(x) - 1 for x in argv[argv.index("--only") + 1].split(",")}
    seconds = int(argv[argv.index("--seconds") + 1]) if "--seconds" in argv else 60
    path = ROOT / "levels.json"
    data = json.load(open(path, encoding="utf-8"))
    chap_of = {c["id"]: i for i, c in enumerate(data["chapters"])}
    print("Analyse des %d niveaux actuels…" % len(data["levels"]))
    cur = []
    for l in data["levels"]:
        c = card(l["map"], l.get("origin") or "handmade", l.get("name"), l.get("id"))
        if c:
            c["from"] = chap_of.get(l["chapter"], 0)
            cur.append(c)

    # 1) ce que les niveaux actuels peuvent fournir à chaque chapitre (un niveau ne sert qu'une fois)
    taken, picks = set(), {ch: {"disc": [], "main": []} for ch in range(len(PLAN))}
    frozen = {}
    if only is not None:   # chapitres gardés tels quels : leurs niveaux ne servent pas ailleurs
        for ch in range(len(PLAN)):
            if ch not in only:
                wid = data["chapters"][ch]["id"]
                frozen[ch] = [l for l in data["levels"] if l["chapter"] == wid]
                taken |= {canonical(l["map"]) for l in frozen[ch]}
    for ch in range(len(PLAN)):
        if ch in frozen:
            continue
        for role in ("disc", "main"):
            for c in sorted(cur, key=lambda c: (c["from"] != ch, -c["useful"], c["min"])):
                if c["canon"] in taken or not fits(c, ch, role):
                    continue
                picks[ch][role].append(c)
                taken.add(c["canon"])
    need = {}
    for ch, p in enumerate(PLAN):
        nd = disc_count(ch)
        nm = p["count"] - nd
        need[ch] = {"disc": 0, "main": 0} if ch in frozen else {"disc": max(0, nd - len(picks[ch]["disc"])), "main": max(0, nm - len(picks[ch]["main"]))}
    print("Gardés / manquants par chapitre :")
    for ch in range(len(PLAN)):
        print("  ch%d  découverte %d (manque %d)  pratique %d (manque %d)" % (
            ch + 1, len(picks[ch]["disc"]), need[ch]["disc"], len(picks[ch]["main"]), need[ch]["main"]))

    # 2) génération de ce qui manque, en parallèle
    jobs = []
    for ch in range(len(PLAN)):
        for role in ("disc", "main"):
            if need[ch][role]:
                for k in range(6 if role == "main" else 3):
                    jobs.append((ch, role, 7000 + ch * 101 + k * 13 + (role == "disc") * 999, seconds))
    if jobs:
        print("Génération : %d tâches de %d s…" % (len(jobs), seconds))
        with Pool(min(15, len(jobs))) as pool:
            for ch, role, out in pool.imap_unordered(gen_job, jobs):
                for c in out:
                    if c["canon"] not in taken:
                        picks[ch][role].append(c)
                        taken.add(c["canon"])

    # 3) assemblage : découverte, puis pratique de difficulté croissante (respiration avant le dernier)
    kept_names = set()
    old_names = {}
    for l in data["levels"]:
        old_names.setdefault(l["chapter"], []).append(l.get("name"))
    levels, report, kept_all = [], [], []
    for ch, p in enumerate(PLAN):
        wid = data["chapters"][ch]["id"]
        if ch in frozen:
            kept_names |= {l.get("name") for l in frozen[ch]}
            levels += frozen[ch]
            kept_all += [{"map": l["map"]} for l in frozen[ch]]
            report.append((ch, len(frozen[ch]), p["count"], 0, [l["maxMoves"] for l in frozen[ch]], {}))
            continue
        nd = disc_count(ch)
        disc = sorted(picks[ch]["disc"], key=lambda c: (c["origin"] == "generated", c["min"], -c["useful"]))
        chosen = []
        for c in disc:
            if len(chosen) >= nd:
                break
            if not any(jaccard_close(c["map"], k["map"]) for k in kept_all + chosen):
                chosen.append(c)
        slots = p["count"] - len(chosen)
        lo, hi = p["moves"]
        targets = [lo + (hi - lo) * i / max(1, slots - 1) for i in range(slots)]
        pool = list(picks[ch]["main"])
        prac = []
        for t in targets:
            best = None
            for c in pool:
                if c in prac or any(jaccard_close(c["map"], k["map"]) for k in kept_all + chosen + prac):
                    continue
                # proche du nombre de coups visé, et le plus de vraies décisions possible
                v = abs(c["min"] - t) * 1.2 - c["useful"] / c["min"] * 3 - min(c["rnd"] / c["min"], 30) * .03
                if best is None or v < best[0]:
                    best = (v, c)
            if best:
                prac.append(best[1])
        # difficulté croissante : coups + décisions, avec une respiration juste avant le dernier
        prac.sort(key=lambda c: c["min"] + .6 * c["useful"] + .1 * c["score"])
        if len(prac) >= 4:
            prac.insert(len(prac) - 2, prac.pop(len(prac) // 2))
        group = chosen + prac
        kept_all += group
        for c in group:
            if c["name"]:
                kept_names.add(c["name"])
        for c in group:
            if not c["name"]:
                pool = [n for n in old_names.get(wid, []) if n and n not in kept_names]
                pool = pool or [n for ns in old_names.values() for n in ns if n and n not in kept_names]
                c["name"] = pool[0] if pool else "Rendez-vous %d" % (len(levels) + 1)
                kept_names.add(c["name"])
            lid = c["id"] or "L" + hashlib.sha1("".join(c["map"]).encode()).hexdigest()[:8]
            levels.append({"id": lid, "name": c["name"], "chapter": wid, "maxMoves": c["min"], "locked": True,
                           "difficulty": 1, "gridSize": len(c["map"]), "biome": data["chapters"][ch].get("biome", "cosmic"),
                           "solution": c["sol"], "origin": c["origin"], "score": c["score"], "map": c["map"]})
        mix = {}
        for c in group:
            k = len(c["used"] - {"wrap"})
            mix[k] = mix.get(k, 0) + 1
        report.append((ch, len(group), p["count"], sum(bool(c.get("fresh")) for c in group),
                       [c["min"] for c in group], mix))
    # difficulté 1..10 sur toute la campagne
    for i, l in enumerate(levels):
        l["difficulty"] = max(1, min(10, 1 + round(9 * i / max(1, len(levels) - 1))))
    # vérification finale
    for l in levels:
        assert play(l["map"], l["solution"]) == ("WIN", l["maxMoves"]), l["name"]

    print("\nRésultat :")
    for ch, n, want, gen, mins, mix in report:
        print("  ch%d  %2d/%2d niveaux (%d nouveaux)  coups %s  briques spéciales par niveau %s" % (
            ch + 1, n, want, gen, " ".join(map(str, mins)), dict(sorted(mix.items()))))
    print("  total : %d niveaux" % len(levels))
    if dry:
        return
    backup = ROOT / "Levels" / ("levels_avant_progression_%s.json" % time.strftime("%Y%m%d_%H%M"))
    backup.parent.mkdir(exist_ok=True)
    shutil.copyfile(path, backup)
    data["levels"] = levels
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("levels.json écrit. Ancienne version : %s" % backup.relative_to(ROOT))


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    main(sys.argv)
