#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nettoie les briques spéciales qui ne servent à rien, sans changer la difficulté des niveaux.

  python tools/campaign/prune_specials.py            # réécrit levels.json (sauvegarde dans Levels/)
  python tools/campaign/prune_specials.py --dry      # montre seulement ce qui changerait

Règles (rôles définis dans audit_specials.py) :
  - une brique inerte est toujours retirée (un cadenas inerte devient un mur ordinaire) ;
  - un cœur brisé qui peut réellement tuer reste : c'est un danger, pas un décor (MAX_HEARTS au plus) ;
  - les autres fausses pistes (clé, cadenas, rotateur, portail qui ne changent pas l'optimum)
    sont l'exception : une seule par niveau, sur un niveau sur trois, jamais dans les quatre
    premiers niveaux d'un chapitre.
Le nombre minimal de coups est vérifié inchangé après chaque retrait, et la solution est recalculée.

Un niveau qui, une fois nettoyé, n'a plus aucune brique spéciale n'a rien à faire dans un chapitre
à mécanique : il est remplacé par un niveau généré de même longueur où la mécanique du chapitre
est indispensable (son nom et sa place dans la campagne sont conservés).
"""
from __future__ import annotations

import json
import random
import shutil
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit_specials import classify, without  # noqa: E402
from dg_solver import analyze, play  # noqa: E402
from generate_campaign import WORLDS, candidate  # noqa: E402

MAX_HEARTS = 3
DECOY_EVERY = 3
DISCOVERY = 4


def prune(rows, allow_decoy):
    """Retourne (nouvelles lignes, nombre de briques retirées)."""
    base = analyze(rows, 300)["min"]
    removed = 0
    while True:
        res = classify(rows)
        target = next(((ch, cells) for ch, cells, role in res if role == "inert"), None)
        if target is None:
            hearts = [(ch, cells) for ch, cells, role in res if role == "trap" and ch == "X"]
            decoys = [(ch, cells) for ch, cells, role in res if role == "trap" and ch != "X"]
            if len(hearts) > MAX_HEARTS:
                target = hearts[-1]
            elif len(decoys) > (1 if allow_decoy else 0):
                target = decoys[-1]
        if target is None:
            return rows, removed
        nxt = without(rows, *target)
        if analyze(nxt, 300)["min"] != base:   # ne devrait pas arriver : le rôle garantit un optimum inchangé
            raise RuntimeError("optimum modifié en retirant %r" % (target,))
        rows, removed = nxt, removed + 1


def replacement(world, moves, rng, seconds=90):
    """Un niveau généré de `moves` coups dont la mécanique du chapitre reste indispensable après nettoyage."""
    end = time.time() + seconds
    while time.time() < end:
        c = candidate(world, "disc" if moves <= 3 else "main", rng)
        if not c or c["min"] != moves:
            continue
        rows, _ = prune(c["map"], False)
        roles = classify(rows)
        if world["mech"] == "button":
            ok = any(ch == "S" and role == "essential" for ch, _, role in roles)
        elif world["mech"] == "danger":
            ok = any(ch == "X" for ch, _, _ in roles)
        else:
            ok = any(role == "essential" for _, _, role in roles)
        a = analyze(rows, 300)
        if ok and a["min"] == moves and play(rows, a["sol"]) == ("WIN", moves):
            return rows, a["sol"], c["gridSize"]
    return None


def main():
    dry = "--dry" in sys.argv
    root = Path(__file__).resolve().parents[2]
    path = root / "levels.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    pos, total, touched, bare = {}, 0, 0, []
    for i, lv in enumerate(data["levels"]):
        ch = lv.get("chapter", "")
        pos[ch] = pos.get(ch, 0) + 1
        allow = pos[ch] > DISCOVERY and i % DECOY_EVERY == 2
        rows, n = prune(lv["map"], allow)
        roles = [role for _, _, role in classify(rows)]
        if "".join(lv["map"]).strip(".#AB") and not roles:
            bare.append(i + 1)
        if not n:
            continue
        a = analyze(rows, 300)
        assert play(rows, a["sol"]) == ("WIN", a["min"]), i
        assert a["min"] == len(lv["solution"]), (i, a["min"], lv["solution"])
        total += n
        touched += 1
        print("%3d %-4s %-26s -%d brique(s), %d coups" % (i + 1, ch, (lv.get("name") or "")[:26], n, a["min"]))
        lv["map"], lv["solution"] = rows, a["sol"]
    print("\n%d briques retirées dans %d niveaux." % (total, touched))
    if bare:
        print("niveaux qui n'ont plus aucune brique spéciale :", bare)
    if dry:
        return
    rng = random.Random(49)
    worlds = {w["id"]: w for w in WORLDS}
    for n in bare:
        lv = data["levels"][n - 1]
        got = replacement(worlds[lv["chapter"]], len(lv["solution"]), rng)
        if not got:
            print("%3d : aucun remplaçant trouvé, niveau laissé sans brique" % n)
            continue
        lv["map"], lv["solution"], lv["gridSize"] = got
        lv["origin"] = "generated"
        print("%3d %-4s %-26s remplacé (%d coups, grille %d)" % (n, lv["chapter"], (lv.get("name") or "")[:26], len(got[1]), got[2]))
    backup = root / "Levels" / "levels_before_prune.json"
    if not backup.exists():
        shutil.copyfile(path, backup)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("levels.json réécrit (sauvegarde : Levels/levels_before_prune.json).")


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    main()
