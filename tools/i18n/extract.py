#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Traductions : liste des textes à traduire, et contrôle des fichiers de langue.

  python tools/i18n/extract.py            # écrit tools/i18n/source.json (tous les textes français vus par le joueur)
  python tools/i18n/extract.py --check    # vérifie chaque lang/<code>.js : clés manquantes, en trop, variables {x} perdues

Les textes viennent de quatre endroits :
  - les appels tr("...") de game.html et index.html, et les messages du tutoriel ;
  - le texte statique des deux pages (boutons, titres), hors éditeur de niveaux ;
  - spirits.js (phrases des rencontres, statuts de relation) et les libellés de mécanique ;
  - levels.json (noms des niveaux, sous-titres des chapitres).
"""
from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANGS = ["en", "es", "de", "pt", "zh", "ja", "ko"]
STR = re.compile(r'"((?:[^"\\]|\\.)*)"')


def js_strings(code):
    return [json.loads('"' + m + '"') for m in STR.findall(code)]


def tr_calls(src):
    """Les chaînes passées à tr(...) : tout ce qui précède l'objet de variables."""
    out = []
    for m in re.finditer(r'(?<![\w$.])tr\(', src):
        i, depth = m.end(), 1
        while depth and i < len(src):
            c = src[i]
            if c == '"':
                i = STR.match(src, i).end()
                continue
            depth += c == '(' or 0
            depth -= c == ')' or 0
            i += 1
        call = src[m.end():i - 1]
        call = re.split(r',\s*\{', call)[0]
        out += [s for s in js_strings(call) if len(s) > 1]
    return out


class Texts(HTMLParser):
    """Texte statique et attributs lus à voix haute, hors scripts, styles et éditeur."""
    VOID = {"meta", "link", "input", "br", "img", "hr", "circle", "path", "rect"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.out = [], []

    def skipped(self):
        return any(t in ("script", "style", "title", "head") or i in ("bar", "confirmBox", "editPanel", "toggleEdit", "compactEdit") or no for t, i, no in self.stack)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag not in self.VOID:
            self.stack.append((tag, a.get("id"), "data-no-i18n" in a))
        if not self.skipped():
            self.out += [a[k] for k in ("aria-label", "title") if a.get(k)]

    def handle_endtag(self, tag):
        for n in range(len(self.stack) - 1, -1, -1):
            if self.stack[n][0] == tag:
                del self.stack[n:]
                break

    def handle_data(self, data):
        t = data.strip()
        if t and not self.skipped():
            self.out.append(t)


def is_text(s):
    return bool(re.search(r'[A-Za-zÀ-ÿ]{2}', s))


def collect():
    items = {}  # clé -> contexte

    def add(keys, ctx):
        for k in keys:
            if k and is_text(k) and k not in items:
                items[k] = ctx

    for page, ctx in (("game.html", "écran de jeu"), ("index.html", "menu principal")):
        src = (ROOT / page).read_text(encoding="utf-8")
        add(tr_calls(src), ctx + " (texte dynamique)")
        p = Texts()
        p.feed(src)
        add(p.out, ctx + " (bouton, titre ou libellé)")
    game = (ROOT / "game.html").read_text(encoding="utf-8")
    m = re.search(r'function companionMessage\(.*?\n}\n', game, re.S)
    add([s for s in js_strings(m.group(0)) if " " in s], "bulle de tutoriel dite par le personnage")
    m = re.search(r'const DG_MECH_LABEL=\{.*?\};', game)
    add(js_strings(m.group(0)), "mécanique d'un chapitre, en minuscules")
    spirits = (ROOT / "spirits.js").read_text(encoding="utf-8")
    add(re.findall(r'line:"([^"]+)"', spirits), "phrase d'accroche d'une rencontre (profil de site de rencontre, ton léger)")
    add(re.findall(r'label:"([^"]+)"', spirits), "statut de la relation avec une rencontre")
    data = json.loads((ROOT / "levels.json").read_text(encoding="utf-8"))
    add([c.get("subtitle") for c in data["chapters"]], "titre de chapitre")
    add([l.get("name") for l in data["levels"]], "nom de niveau : court, clin d'œil à la drague et aux rencontres")
    # ni des textes (valeurs techniques, prénoms), ni des écrans joueur (l'atelier des options reste en français)
    drop = {"texte français", "final", "buttons", "girl", "boy", "date", "gravity", "date gravity", "Date Gravity", "OK", "II", "reset",
            "Nami", "chapitre 1, niveau 1", "Atelier", "Niveaux", "Assets", "Télécharger le projet PC"}
    return {k: v for k, v in items.items() if k not in drop}


def load_lang(code):
    path = ROOT / "lang" / (code + ".js")
    if not path.exists():
        return None
    src = path.read_text(encoding="utf-8")
    body = src[src.index("{"):src.rindex("}") + 1]
    return json.loads(body)


def check(items):
    ok = True
    for code in LANGS:
        try:
            table = load_lang(code)
        except Exception as e:  # fichier illisible
            print("%s : fichier invalide (%s)" % (code, e))
            ok = False
            continue
        if table is None:
            print("%s : fichier absent" % code)
            ok = False
            continue
        missing = [k for k in items if k not in table]
        extra = [k for k in table if k not in items]
        broken = [k for k in items if k in table and sorted(re.findall(r'\{\w+\}', k)) != sorted(re.findall(r'\{\w+\}', table[k]))]
        empty = [k for k in items if k in table and not str(table[k]).strip()]
        tags = [k for k in items if k in table and sorted(re.findall(r'</?b>', k)) != sorted(re.findall(r'</?b>', table[k]))]
        print("%s : %d/%d traduits, %d manquants, %d en trop, %d variables perdues, %d vides, %d balises perdues" % (
            code, len(items) - len(missing), len(items), len(missing), len(extra), len(broken), len(empty), len(tags)))
        for label, lst in (("manque", missing), ("en trop", extra), ("variables", broken), ("vide", empty), ("balises", tags)):
            for k in lst[:8]:
                print("    %s : %s" % (label, k))
        ok = ok and not (missing or broken or empty or tags)
    return ok


def main():
    items = collect()
    if "--check" in sys.argv:
        sys.exit(0 if check(items) else 1)
    out = ROOT / "tools" / "i18n" / "source.json"
    out.write_text(json.dumps([{"fr": k, "contexte": v} for k, v in items.items()], ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("%d textes écrits dans %s" % (len(items), out.relative_to(ROOT)))


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    main()
