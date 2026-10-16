#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Générateur de campagne Date Gravity.

Produit un levels.json organisé en mondes (un monde = un chapitre du jeu) :
une mécanique nouvelle par monde, et dans chaque monde la même vague
découverte -> pratique -> plateau -> montée -> boss.

Usage :
  python tools/campaign/generate_campaign.py --handmade Levels/levels_before_campaign.json --out levels.json
  python tools/campaign/generate_campaign.py --probe            # mesure les rendements, n'écrit rien

Chaque niveau retenu est résolu par dg_solver (portage des règles du jeu) :
solvable, optimum connu, mécanique du monde réellement nécessaire, pas de
solution "même bouton en boucle", pas de doublon par symétrie.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
import time
from multiprocessing import Pool
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dg_solver import analyze, canonical, explore, play, solve_min  # noqa: E402

MAX_LEVELS_PER_WORLD = 20

# Position dans le monde -> part de la plage de difficulté du monde (0 = plancher, 1 = boss).
WAVE = [0.00, 0.06, 0.13,                    # découverte
        0.22, 0.30, 0.38, 0.46, 0.54, 0.60,  # pratique
        0.52, 0.58, 0.54, 0.62, 0.58,        # plateau
        0.68, 0.75, 0.82, 0.90, 0.72,        # montée, puis respiration
        1.00]                                # boss


def wave_for(count, disc):
    """La vague ramenée à `count` niveaux : on garde découverte, respiration et boss,
    et on échantillonne régulièrement le milieu."""
    if count >= len(WAVE):
        return WAVE
    mid = WAVE[3:18]
    n = count - disc - 2
    if count < 10:  # chapitre très court : montée franche, pas de plateau
        picked = [0.10 + 0.70 * i / max(1, n - 1) for i in range(n)]
    else:
        picked = [mid[round(i * (len(mid) - 1) / max(1, n - 1))] for i in range(n)]
    return WAVE[:disc] + picked + WAVE[18:]

WORLDS = [
    dict(id="w01", count=8, score=(1.5, 6), subtitle="Premier pas", biome="rainbow", mech="base",
         sizes=(7, 8, 9), moves=(2, 5), frame="closed", dens=(0.10, 0.22), extras={}),
    dict(id="w02", count=10, score=(3, 10), subtitle="Sortir du cadre", biome="forest", mech="wrap",
         sizes=(8, 9, 10), moves=(3, 7), frame="open", dens=(0.14, 0.26), extras={}),
    dict(id="w03", count=14, score=(4, 13), subtitle="Boutons du cœur", biome="desert", mech="button",
         sizes=(9, 10, 11), moves=(3, 8), frame="open", dens=(0.14, 0.26), extras={}),
    dict(id="w04", count=16, score=(5, 15.5), subtitle="Zones dangereuses", biome="ice", mech="danger",
         sizes=(10, 11, 12), moves=(3, 9), frame="open", dens=(0.14, 0.26), extras={"button": 0.4}),
    dict(id="w05", count=20, score=(6, 18), subtitle="Têtes qui tournent", biome="cosmic", mech="rotator",
         sizes=(10, 11, 12), moves=(4, 10), frame="open", dens=(0.14, 0.26),
         extras={"button": 0.3, "danger": 0.4}),
    dict(id="w06", count=20, score=(6.5, 20), subtitle="Coup de foudre", biome="garden", mech="teleporter",
         sizes=(11, 12), moves=(4, 10), frame="open", dens=(0.14, 0.26),
         extras={"button": 0.3, "danger": 0.4, "rotator": 0.2}),
    dict(id="w07", count=20, score=(9, 23.5), subtitle="C’est compliqué", biome="kiss", mech="fragile",
         sizes=(12, 13), moves=(5, 12), frame="open", dens=(0.15, 0.27),
         extras={"button": 0.7, "danger": 0.6, "rotator": 0.5, "teleporter": 0.5}),
    dict(id="w08", count=20, score=(11, 28), subtitle="Le grand amour", biome="love", mech="heart",
         sizes=(12, 13), moves=(7, 16), frame="open", dens=(0.16, 0.28),
         extras={"button": 0.8, "danger": 0.7, "rotator": 0.6, "teleporter": 0.6}),
]

NAMES = {
    "w01": ["Premier regard", "Bonjour timide", "Un pas vers toi", "Le premier mot", "Sourire en coin",
            "Petit signe", "Les yeux baissés", "Oser approcher", "Un café ?", "Mains moites",
            "Le bon moment", "Rire nerveux", "Premier compliment", "Numéro échangé", "Un pas de côté",
            "Le cœur qui cogne", "Presque naturel", "On se revoit ?", "Dernière hésitation", "Premier rendez-vous"],
    "w02": ["Hors des sentiers", "Faire le tour", "Par la petite porte", "Le chemin détourné", "Prendre le large",
            "Tourner autour du pot", "Sortir de sa bulle", "Le grand détour", "Par l’autre côté", "Sans filet",
            "Retour à la case départ", "Faire le mur", "Passer par la fenêtre", "L’air de rien", "Demi-tour",
            "Le monde est petit", "À contre-courant", "Chemin de traverse", "Vertige", "Le grand saut"],
    "w03": ["Le déclic", "Ouvre-moi", "Porte entrouverte", "Briser la glace", "Le bon bouton",
            "Sésame", "Clé des champs", "Porte qui claque", "Message envoyé", "Vu à 21h04",
            "Double coche", "Laisser entrer", "Fermer à clé", "Le verrou", "Passage secret",
            "Ouvert, fermé", "Sur le palier", "Trousseau de clés", "Portes battantes", "Cœur à code"],
    "w04": ["Sujet sensible", "Terrain glissant", "L’ex au téléphone", "Mot de travers", "Lapin posé",
            "Zone rouge", "Jalousie", "Faux pas", "Silence radio", "Ghosting",
            "Pieds dans le plat", "Message supprimé", "Dîner chez belle-maman", "Ligne rouge", "Pas ce soir",
            "Champ de mines", "Malentendu", "Soirée ratée", "Sur le fil", "Cœur en miettes"],
    "w05": ["Tête qui tourne", "Premier slow", "Manège", "Volte-face", "Tourbillon",
            "Changement d’avis", "Valse-hésitation", "Retournement", "Sens dessus dessous", "La tête à l’envers",
            "Pirouette", "Tourner en rond", "Girouette", "Coup de théâtre", "Demi-tour droite",
            "Carrousel", "Montagnes russes", "Perdre le nord", "Grand huit", "Vertige d’amour"],
    "w06": ["Coup de foudre", "En un éclair", "Raccourci", "Aller simple", "Longue distance",
            "Appel vidéo", "Train de nuit", "À l’autre bout", "Sauter le pas", "Porte dérobée",
            "Correspondance", "Vol direct", "Dans tes bras", "Ici et ailleurs", "Aller-retour",
            "Trou de ver", "Tête dans les étoiles", "Deux adresses", "Transit", "Téléportés"],
    "w07": ["C’est compliqué", "Statut flou", "On verra", "Ni oui ni non", "Entre deux",
            "Les amis communs", "Week-end test", "Brosse à dents", "Présenter les parents", "Première dispute",
            "Réconciliation", "Vacances à deux", "Double jeu", "Le tiroir vide", "Compromis",
            "Les clés de chez toi", "Carton plein", "Emménager", "Tout ou rien", "Le cap des trois ans"],
    "w08": ["Évidence", "Même longueur d’onde", "Mains liées", "Projets à deux", "Nos habitudes",
            "Le canapé du dimanche", "Pour de vrai", "Contre vents et marées", "Dans la durée", "Les mots justes",
            "Tenir bon", "Toi et moi", "Promesse", "À la folie", "Plus fort que tout",
            "Le grand oui", "Pour toujours", "Âmes sœurs", "Destinée", "La bonne personne"],
}

# Noms faits main trop génériques pour être affichés tels quels au joueur.
GENERIC_NAME = ("tuto", "nouveau niveau", "base", "bouton", "danger", "rotateur")


# ---------------------------------------------------------------- génération

def gen_walls(n, rng, frame, dens):
    g = [["."] * n for _ in range(n)]
    if frame == "closed":
        for i in range(n):
            g[0][i] = g[n - 1][i] = g[i][0] = g[i][n - 1] = "#"
    sym = rng.choice(["none", "none", "mirror", "rot180", "rot4"])
    target = int(rng.uniform(*dens) * n * n)
    placed = tries = 0
    while placed < target and tries < 300:
        tries += 1
        horiz = rng.random() < 0.5
        length = rng.randint(1, max(2, n // 2))
        x, y = rng.randrange(n), rng.randrange(n)
        cells = [(x + i, y) if horiz else (x, y + i) for i in range(length)]
        imgs = set()
        for cx, cy in cells:
            if not (0 <= cx < n and 0 <= cy < n):
                continue
            imgs.add((cx, cy))
            if sym == "mirror":
                imgs.add((n - 1 - cx, cy))
            elif sym == "rot180":
                imgs.add((n - 1 - cx, n - 1 - cy))
            elif sym == "rot4":
                imgs.update({(n - 1 - cy, cx), (n - 1 - cx, n - 1 - cy), (cy, n - 1 - cx)})
        for cx, cy in imgs:
            if g[cy][cx] == ".":
                g[cy][cx] = "#"
                placed += 1
    return g


def empties(g):
    n = len(g)
    return [(x, y) for y in range(n) for x in range(n) if g[y][x] == "."]


def rows_of(g):
    return ["".join(r) for r in g]


def place_mechanics(g, mechs, visited, rng, frame, rich):
    """Pose les tuiles de mécanique, de préférence sur des cases réellement traversées."""
    n = len(g)

    def pick(pool):
        pool = [c for c in pool if g[c[1]][c[0]] == "."]
        return rng.choice(pool) if pool else None

    def put(ch, prefer_visited=True):
        c = pick(visited) if prefer_visited and rng.random() < 0.85 else None
        c = c or pick(empties(g))
        if c:
            g[c[1]][c[0]] = ch
        return c

    if "button" in mechs:
        inner = [(x, y) for y in range(n) for x in range(n) if g[y][x] == "#"
                 and not (frame == "closed" and (x in (0, n - 1) or y in (0, n - 1)))]
        rng.shuffle(inner)
        for x, y in inner[:rng.randint(1, 3 if rich else 2)]:
            g[y][x] = "D"
        for _ in range(rng.randint(0, 2 if rich else 1)):
            put("O")
        put("S")
        if rich and rng.random() < 0.3:
            put("S")
    if "rotator" in mechs:
        for _ in range(1 if not rich or rng.random() < 0.6 else 2):
            put(rng.choice("RL"))
    if "teleporter" in mechs:
        for t in ("1", "2")[:1 if not rich or rng.random() < 0.65 else 2]:
            put(t)
            put(t, prefer_visited=rng.random() < 0.4)
    if "danger" in mechs:
        for _ in range(rng.randint(1, 4 if rich else 2)):
            put("X", prefer_visited=rng.random() < 0.6)
    if "fragile" in mechs:
        # des murs deviennent du verre : de préférence ceux sur lesquels le personnage atterrit
        landing = [(x, y + 1) for x, y in visited if y + 1 < n and g[y + 1][x] == "#"]
        walls = [(x, y) for y in range(n) for x in range(n) if g[y][x] == "#"]
        rng.shuffle(landing)
        rng.shuffle(walls)
        for x, y in (landing + walls)[:rng.randint(1, 3 if rich else 2)]:
            g[y][x] = "F"
    if "heart" in mechs:
        put("H", prefer_visited=rng.random() < 0.35)   # souvent hors du chemin direct : il faut un détour


def strip(rows, chars):
    tr = str.maketrans({c: "." for c in chars})
    return [r.translate(tr) for r in rows]


def differs_without(rows, chars, base_min):
    """La mécanique compte si, sans elle, le niveau devient insoluble ou change d'optimum."""
    m = solve_min(strip(rows, chars))
    return m is None or m != base_min


def score_of(a):
    used = len(a["used"] & {"S", "T", "rot"})
    s = (a["min"] + 0.12 * min(a["states"], 60) + 0.25 * min(sum(a["deaths"].values()), 12)
         + 0.30 * min(a["softlocks"], 10) + 0.6 * used)
    return round(s * (0.6 if a["spam"] else 1.0), 2)


def mechanics_in(rows):
    s = "".join(rows)
    out = []
    if any(c in s for c in "SDO"):
        out.append("button")
    if "X" in s:
        out.append("danger")
    if "F" in s:
        out.append("fragile")
    if "H" in s:
        out.append("heart")
    if any(c in s for c in "RL"):
        out.append("rotator")
    if any(c in s for c in "123"):
        out.append("teleporter")
    return out


def candidate(world, tier, rng):
    """Un essai. Retourne une fiche de niveau valide ou None."""
    mech = world["mech"]
    disc = tier == "disc"
    n = min(world["sizes"]) if disc else rng.choice(world["sizes"])
    if disc and mech != "base":
        n = min(n, 10)
    mlo, mhi = (1, 3) if disc else world["moves"]

    g = gen_walls(n, rng, world["frame"], world["dens"])
    free = [c for c in empties(g)]
    if not free:
        return None
    ax, ay = rng.choice(free)
    g[ay][ax] = "A"

    mechs = set()
    if mech in ("button", "danger", "rotator", "teleporter", "fragile", "heart"):
        mechs.add(mech)
    if not disc:
        for m, prob in world["extras"].items():
            if rng.random() < prob:
                mechs.add(m)
    if mech == "mix" and len(mechs - {"danger"}) < 2:
        return None

    if mechs:
        visited = set()
        g0 = explore(rows_of(g), False, 200, visited)
        if g0["start"] != "land" or g0["overflow"] or len(g0["nodes"]) < 2:
            return None
        visited.discard((ax, ay))
        place_mechanics(g, mechs, sorted(visited), rng, world["frame"], rich=not disc)

    rows = rows_of(g)
    g1 = explore(rows, False, 260)
    if g1["start"] != "land" or g1["overflow"] or g1["deaths"]["stuck"]:
        return None
    depth = {}
    for nd in g1["nodes"]:
        cx, cy = nd["cell"]
        if rows[cy][cx] == "." and (nd["cell"] not in depth or nd["depth"] < depth[nd["cell"]]):
            depth[nd["cell"]] = nd["depth"]
    by_depth = {}
    for c, d in depth.items():
        if mlo <= d <= mhi:
            by_depth.setdefault(d, []).append(c)
    if not by_depth:
        return None
    ds = sorted(by_depth)
    d = rng.choices(ds, weights=[1 + x for x in ds])[0]
    bx, by = rng.choice(sorted(by_depth[d]))
    g[by][bx] = "B"
    rows = rows_of(g)

    a = analyze(rows, 260)
    if a["min"] is None or not (mlo <= a["min"] <= mhi) or a["deaths"]["stuck"]:
        return None
    if a["min"] >= 3 and a["spam"]:
        return None
    if play(rows, a["sol"]) != ("WIN", a["min"]):
        return None

    used = a["used"]
    deaths = sum(a["deaths"].values())
    if mech == "base":
        if deaths or a["softlocks"]:
            return None
    elif mech == "wrap":
        if "wrap" not in used:
            return None
    elif mech == "button":
        if "S" not in used or solve_min(strip(rows, "S")) is not None:
            return None
    elif mech == "danger":
        if a["path_deaths"]["dead"] < 1:
            return None
    elif mech == "rotator":
        if "rot" not in used or not differs_without(rows, "RL", a["min"]):
            return None
    elif mech == "teleporter":
        if "T" not in used or solve_min(strip(rows, "123")) is not None:
            return None
    elif mech == "fragile":
        if "F" not in used or solve_min([r.replace("F", "#") for r in rows]) == a["min"]:
            return None
    elif mech == "heart":
        if "H" not in used or (solve_min(strip(rows, "H")) or 99) >= a["min"]:
            return None                                  # le cœur doit demander un détour
    elif mech == "mix":
        if len(used & {"S", "T", "rot"}) < 2:
            return None
    # (un niveau à cœur a presque toujours des impasses : passer à côté du cœur en est une)
    if disc and ((a["softlocks"] and mech != "heart") or deaths > 2):
        return None
    # Les mécaniques secondaires présentes doivent servir, pas décorer.
    if "button" in mechs and mech != "button" and "S" not in used:
        return None
    if "teleporter" in mechs and mech != "teleporter" and "T" not in used:
        return None
    if "rotator" in mechs and mech != "rotator" and "rot" not in used:
        return None

    return {"map": rows, "gridSize": n, "min": a["min"], "sol": a["sol"], "score": score_of(a),
            "states": a["states"], "deaths": deaths, "softlocks": a["softlocks"],
            "used": sorted(used), "canon": canonical(rows), "tier": tier, "origin": "generated"}


def work(job):
    wi, tier, seed, seconds = job
    rng = random.Random(seed)
    world = WORLDS[wi]
    out, tries = [], 0
    end = time.time() + seconds
    while time.time() < end:
        tries += 1
        c = candidate(world, tier, rng)
        if c:
            out.append(c)
    return wi, tier, tries, out


def build_pools(seed, seconds, procs):
    jobs = []
    for wi, w in enumerate(WORLDS):
        for k in range(procs):
            jobs.append((wi, "main", seed * 1000 + wi * 37 + k, seconds))
        if w["mech"] != "mix":
            for k in range(2):
                jobs.append((wi, "disc", seed * 1000 + wi * 37 + 900 + k, seconds))
    pools = {(wi, t): [] for wi in range(len(WORLDS)) for t in ("main", "disc")}
    tries = dict.fromkeys(pools, 0)
    with Pool(procs) as pool:
        for wi, tier, n, out in pool.imap_unordered(work, jobs):
            pools[(wi, tier)].extend(out)
            tries[(wi, tier)] += n
    for k in pools:  # dédoublonnage par symétrie
        seen, uniq = set(), []
        for c in pools[k]:
            if c["canon"] not in seen:
                seen.add(c["canon"])
                uniq.append(c)
        pools[k] = uniq
    return pools, tries


# ---------------------------------------------------------------- faits main

def load_handmade(path):
    data = json.load(open(path, encoding="utf-8-sig"))
    out, seen = [], set()
    for l in data["levels"]:
        rows = l["map"]
        canon = canonical(rows)
        if canon in seen:
            continue
        seen.add(canon)
        a = analyze(rows, 600)
        if a["min"] is None:
            continue
        mechs = mechanics_in(rows)
        if "teleporter" in mechs:
            wi = 5
        elif "rotator" in mechs:
            wi = 4
        elif "danger" in mechs:
            wi = 3
        elif "button" in mechs:
            wi = 2
        else:
            any_wrap = any("wrap" in nd["used"] for nd in explore(rows, True, 600)["nodes"])
            wi = 1 if (any_wrap or sum(a["deaths"].values())) else 0
        raw = l.get("name", "")
        clean = raw.split(" - ", 1)[1].strip() if " - " in raw and raw.split(" - ", 1)[0].strip().replace("Tuto ", "").isdigit() else raw
        generic = any(clean.lower().startswith(g) for g in GENERIC_NAME)
        out.append({"map": rows, "gridSize": len(rows), "min": a["min"], "sol": a["sol"],
                    "score": score_of(a), "states": a["states"], "deaths": sum(a["deaths"].values()),
                    "softlocks": a["softlocks"], "used": sorted(a["used"]), "canon": canon,
                    "tier": "main", "origin": "handmade", "world": wi,
                    "name": None if generic else clean, "sourceName": raw})
    return out


# ---------------------------------------------------------------- assemblage

def assemble(pools, handmade, rng):
    levels, chapters, report = [], [], []
    used_canon = set()
    for wi, world in enumerate(WORLDS):
        main = [c for c in pools[(wi, "main")]]
        hm = [h for h in handmade if h["world"] == wi]
        # Plages absolues par monde : c'est ce qui garantit l'escalier d'un monde à l'autre.
        lo, hi = world["score"]
        mlo, mhi = world["moves"]
        count = world["count"]
        # Découverte : aucun pour les mondes "mix", 2 niveaux si le chapitre est court, 3 sinon.
        first_free = 0 if world["mech"] == "mix" else (3 if count >= 14 else 2)
        wave = wave_for(count, first_free)
        targets = [lo + f * (hi - lo) for f in wave]
        move_targets = [mlo + f * (mhi - mlo) for f in wave]
        # Sans tuile spéciale à introduire, un fait main très court peut ouvrir le monde.
        easy_hm = [h for h in hm if world["mech"] in ("base", "wrap") and h["min"] <= 2]
        disc = easy_hm + sorted(pools[(wi, "disc")], key=lambda c: c["score"])
        slots = [None] * count

        # Découverte : les plus simples du pool dédié, par difficulté croissante.
        if first_free:
            picks = []
            for want in (1, 1, 2)[:first_free]:
                best = next((c for c in disc if c["min"] >= want and c["canon"] not in used_canon
                             and c not in picks), None)
                if best:
                    picks.append(best)
            picks.sort(key=lambda c: (c["min"], c["score"]))
            for i, c in enumerate(picks[:first_free]):
                slots[i] = c
                used_canon.add(c["canon"])

        # Faits main : chacun dans le créneau libre dont la cible est la plus proche.
        for h in sorted(hm, key=lambda c: -c["score"]):
            free = [i for i in range(first_free, count) if slots[i] is None]
            if not free or h["canon"] in used_canon:
                continue
            i = min(free, key=lambda i: abs(targets[i] - h["score"]))
            slots[i] = h
            used_canon.add(h["canon"])

        # Le reste : niveau généré le plus proche de la cible du créneau.
        for i in range(count):
            if slots[i] is not None:
                continue
            avail = [c for c in main if c["canon"] not in used_canon]
            if not avail:
                raise SystemExit("Pool insuffisant pour %s : relance avec --seconds plus grand." % world["id"])
            rng.shuffle(avail)
            c = min(avail, key=lambda c: abs(c["score"] - targets[i]) + 0.8 * abs(c["min"] - move_targets[i]))
            slots[i] = c
            used_canon.add(c["canon"])

        # Reclassement : le plus facile dans le créneau le plus facile, le plus dur en boss.
        # Sans ça, un fait main très simple peut atterrir au milieu de la montée.
        idx = sorted(range(first_free, count), key=lambda i: (targets[i], i))
        ranked = sorted((slots[i] for i in idx), key=lambda c: (0.5 * c["score"] + c["min"], c["score"]))
        for i, c in zip(idx, ranked):
            slots[i] = c

        pool_names = NAMES[world["id"]]
        names = iter(pool_names[:count - 1] + pool_names[-1:])  # le dernier nom est celui du boss
        taken = {c.get("name") for c in slots if c.get("name")}
        for i, c in enumerate(slots):
            name = c.get("name")
            fallback = next(names)
            while fallback in taken and not name:
                fallback = next(names, fallback + " ·")
            levels.append((world, i, c, name or fallback))
        chapters.append({"id": world["id"], "number": wi + 1, "name": "Chapitre %02d" % (wi + 1),
                         "subtitle": world["subtitle"], "unlockPercent": 70,
                         "biome": world["biome"], "mechanic": world["mech"]})
        report.append((world["id"], lo, hi, [c["score"] for c in slots], [c["min"] for c in slots],
                       sum(1 for c in slots if c["origin"] == "handmade")))

    smin = min(c["score"] for _, _, c, _ in levels)
    smax = max(c["score"] for _, _, c, _ in levels)
    out = []
    for world, i, c, name in levels:
        lvl = {"id": "L" + hashlib.md5(c["canon"].encode()).hexdigest()[:8],
               "name": name, "chapter": world["id"], "maxMoves": c["min"], "locked": True,
               "difficulty": max(1, min(10, 1 + round(9 * (c["score"] - smin) / (smax - smin)))),
               "gridSize": c["gridSize"], "biome": world["biome"], "solution": c["sol"],
               "origin": c["origin"], "score": c["score"], "map": c["map"]}
        if c.get("sourceName"):
            lvl["designNote"] = "Niveau fait main, ancien nom : " + c["sourceName"]
        out.append(lvl)
    return out, chapters, report


def verify(levels):
    ids, canons = set(), set()
    for l in levels:
        assert l["id"] not in ids, "id en double " + l["id"]
        ids.add(l["id"])
        c = canonical(l["map"])
        assert c not in canons, "doublon de map " + l["name"]
        canons.add(c)
        n = l["gridSize"]
        assert len(l["map"]) == n and all(len(r) == n for r in l["map"]), l["name"]
        s = "".join(l["map"])
        assert s.count("A") == 1 and s.count("B") == 1, l["name"]
        assert play(l["map"], l["solution"]) == ("WIN", l["maxMoves"]), l["name"]
        assert solve_min(l["map"], 600) == l["maxMoves"], l["name"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--handmade", default=None, help="levels.json contenant les niveaux faits main à conserver")
    ap.add_argument("--out", default="levels.json")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--seconds", type=float, default=40, help="temps de recherche par worker")
    ap.add_argument("--procs", type=int, default=6)
    ap.add_argument("--probe", action="store_true", help="affiche les rendements sans écrire de fichier")
    args = ap.parse_args()

    t0 = time.time()
    pools, tries = build_pools(args.seed, args.seconds, args.procs)
    print("Pools (%.0fs) :" % (time.time() - t0))
    for wi, w in enumerate(WORLDS):
        for tier in ("disc", "main"):
            p = pools[(wi, tier)]
            if not p:
                continue
            sc = sorted(c["score"] for c in p)
            mv = sorted(c["min"] for c in p)
            print("  %s %-4s %5d niveaux / %6d essais | coups %d..%d (médiane %d) | score %.1f..%.1f (médiane %.1f)" % (
                w["id"], tier, len(p), tries[(wi, tier)], mv[0], mv[-1], mv[len(mv) // 2],
                sc[0], sc[-1], sc[len(sc) // 2]))
    if args.probe:
        return

    handmade = load_handmade(args.handmade) if args.handmade else []
    levels, chapters, report = assemble(pools, handmade, random.Random(args.seed))
    verify(levels)
    for wid, lo, hi, scores, mins, nh in report:
        print("%s cible %.1f→%.1f | %d faits main\n   coups %s\n   score %s" % (
            wid, lo, hi, nh, " ".join("%2d" % m for m in mins), " ".join("%.0f" % s for s in scores)))

    data = {"version": 6,
            "settings": {"fallDelayMs": 60, "rotationDurationMs": 120, "defaultGridSize": 12,
                         "gridSizePerLevel": True},
            "chapters": chapters, "levels": levels}
    text = json.dumps(data, ensure_ascii=False, indent=1)
    Path(args.out).write_text(text + "\n", encoding="utf-8")
    print("\n%d niveaux écrits dans %s (%d faits main conservés)." % (
        len(levels), args.out, sum(1 for l in levels if l["origin"] == "handmade")))


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    main()
