#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère vector_assets.json dans la DA "Néon Circuit" : les blocs en pictos.

  python tools/da/generate_assets.py            # écrit vector_assets.json + vector_assets_runtime.json

Le fichier reste au format de l'éditeur d'assets (layers rect / circle / polygon /
path / text, canvas 40x40) : chaque bloc peut être retouché dans asset_svg_editor.html.

Ce qui n'est PAS ici :
- les personnages, dessinés par spirits.js parce qu'ils réagissent en direct (chute, impact) ;
- les murs, tracés par game.html en tubes continus à la couleur du chapitre.

Principe des pictos : le bouton est une clé, ses blocs sont des cadenas de la même couleur,
la case interdite est un cœur brisé, les téléporteurs portent une lettre en plus de leur couleur.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

NAVY = "#0d1230"
WHITE = "#ffffff"
YELLOW = "#ffe14a"
YELLOW_L = "#fff7a8"
DARK = "#1b2568"
HEART = "#ff4f8b"
VIOLET = "#b06cff"
TELEPORT = {"1": ("#19e3ff", "A"), "2": ("#ff4fd8", "B"), "3": ("#7dff6a", "C")}


def rect(i, x, y, w, h, rx, fill, **kw):
    d = {"id": i, "shape": "rect", "x": x, "y": y, "w": w, "h": h, "rx": rx, "ry": rx,
         "fill": fill, "stroke": "none", "strokeWidth": 0}
    d.update(kw)
    return d


def circle(i, x, y, r, fill, **kw):
    d = {"id": i, "shape": "circle", "x": x, "y": y, "r": r, "fill": fill, "stroke": "none", "strokeWidth": 0}
    d.update(kw)
    return d


def pth(i, d, fill="none", stroke="none", sw=0, **kw):
    out = {"id": i, "shape": "path", "d": d, "fill": fill, "stroke": stroke, "strokeWidth": sw}
    out.update(kw)
    return out


def poly(i, pts, fill, **kw):
    d = {"id": i, "shape": "polygon", "points": [list(p) for p in pts], "fill": fill, "stroke": "none", "strokeWidth": 0}
    d.update(kw)
    return d


def block(fill):
    """Bloc plein : aplat, ombre basse, reflet."""
    return [rect("block", 2.5, 2.5, 35, 35, 8, fill),
            pth("shade", "M2.5 29H37.5V29.5a8 8 0 0 1 -8 8H10.5a8 8 0 0 1 -8 -8Z", fill="#000000", opacity=0.18),
            pth("light", "M8 6.5H22", stroke=WHITE, sw=2.2, opacity=0.55)]


def key_icon(y=20.0, ink=NAVY):
    return [circle("key_ring", 15.5, y, 3.4, "none", stroke=ink, strokeWidth=2.4),
            pth("key_stem", "M18.9 %s H27 M24 %s v3 M27 %s v2.6" % (y, y, y), stroke=ink, sw=2.4)]


def button(pressed):
    if pressed:
        return ([circle("glow", 20, 20, 18.5, YELLOW, opacity=0.3, anim={"type": "pulse", "amp": 1.2, "speed": 0.008}),
                 circle("disc", 20, 20, 15.5, YELLOW_L)] + key_icon())
    return [circle("disc_side", 20, 21.5, 15.5, "#c9a800"), circle("disc", 20, 19.5, 15.5, YELLOW)] + key_icon(19.5)


def block_up():
    return block(YELLOW) + [pth("shackle", "M15.5 15v-3.4a4.5 4.5 0 0 1 9 0V15", stroke=NAVY, sw=2.6),
                            rect("lock", 12.5, 14.5, 15, 11.5, 3, NAVY)]


def block_down():
    # bloc rentré : une empreinte au sol et un cadenas ouvert, on passe dessus
    return [rect("slot", 4, 4, 32, 32, 7, YELLOW, opacity=0.13),
            rect("slot_edge", 4, 4, 32, 32, 7, "none", stroke=YELLOW, strokeWidth=1.8, opacity=0.7),
            pth("shackle", "M24.5 17v-3.4a4.5 4.5 0 0 0 -9 0", stroke=YELLOW, sw=2.6, opacity=0.75),
            rect("lock", 12.5, 16.5, 15, 11.5, 3, YELLOW, opacity=0.75)]


def danger():
    pulse = {"type": "pulse", "amp": 0.9, "speed": 0.006, "pivotX": 20, "pivotY": 20}
    return block(DARK) + [
        pth("heart", "M20 31L9.5 20.5Q5 13.5 11 10Q16 7.5 20 13.5Q24 7.5 29 10Q35 13.5 30.5 20.5Z", fill=HEART,
            anim=pulse, pivotX=20, pivotY=20),
        pth("crack", "M20.5 12.5l-3.2 5 5.2 3.4 -3 6.6", stroke=DARK, sw=2.2)]


def rotator(right):
    arc = "M12.5 18A8 8 0 1 1 20 23" if right else "M27.5 18A8 8 0 1 0 20 23"
    head = [(20, 18), (20, 28), (14, 23)] if right else [(20, 18), (20, 28), (26, 23)]
    return block(VIOLET) + [pth("arrow", arc, stroke=WHITE, sw=3.4), poly("arrow_head", head, WHITE)]


def teleporter(kind):
    color, letter = TELEPORT[kind]
    pulse = {"type": "pulse", "amp": 1.2, "speed": 0.006, "pivotX": 20, "pivotY": 20}
    return [circle("halo", 20, 20, 18.5, color, opacity=0.22, anim=pulse),
            circle("ring", 20, 20, 15.5, color),
            circle("hole", 20, 20, 9.5, NAVY),
            {"id": "letter", "shape": "text", "x": 20, "y": 25.2, "text": letter, "fontSize": 14.5,
             "fill": WHITE, "stroke": "none", "strokeWidth": 0}]


def build():
    assets = {
        "button_off": button(False), "button_on": button(True),
        "block_up": block_up(), "block_down": block_down(),
        "danger": danger(),
        "rotator_right": rotator(True), "rotator_left": rotator(False),
    }
    for k in TELEPORT:
        assets["teleporter_" + k] = teleporter(k)
    return {
        "version": 3,
        "name": "Date Gravity – Néon Circuit",
        "canvasSize": 40,
        "description": "Blocs en pictos, générés par tools/da/generate_assets.py. Personnages : spirits.js. Murs : tracés par game.html.",
        "palette": {"navy": NAVY, "white": WHITE, "yellow": YELLOW, "dark": DARK, "heart": HEART, "violet": VIOLET,
                    "teleportA": TELEPORT["1"][0], "teleportB": TELEPORT["2"][0], "teleportC": TELEPORT["3"][0]},
        "assets": {k: {"layers": v, "groups": []} for k, v in assets.items()},
    }


def main():
    root = Path(__file__).resolve().parents[2]
    data = build()
    (root / "vector_assets.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (root / "vector_assets_runtime.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("%d assets écrits (%d layers)." % (len(data["assets"]), sum(len(a["layers"]) for a in data["assets"].values())))


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    main()
