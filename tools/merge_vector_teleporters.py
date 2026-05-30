#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fusion non destructive des téléporteurs dans un fichier vector_assets.json.

Usage simple :
  python tools/merge_vector_teleporters.py vector_assets.json

Usage avec fichiers explicites :
  python tools/merge_vector_teleporters.py ancien_vector_assets.json teleporter_vector_assets_patch.json vector_assets_merged.json

Comportement :
- conserve tous les assets existants ;
- ajoute uniquement teleporter_1, teleporter_2, teleporter_3 s'ils manquent ;
- ne remplace pas les téléporteurs déjà présents, sauf avec --force ;
- crée une sauvegarde .bak avant d'écrire quand la sortie écrase l'entrée.
"""
from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict

TELEPORTER_KEYS = ("teleporter_1", "teleporter_2", "teleporter_3")


def read_json(path: Path) -> Dict[str, Any]:
    """Lit un JSON UTF-8/UTF-8-BOM et vérifie que sa racine est un objet."""
    text = path.read_text(encoding="utf-8-sig")
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError(f"{path} ne contient pas un objet JSON à la racine.")
    return data


def write_json(path: Path, data: Dict[str, Any]) -> None:
    """Écrit un JSON propre, stable et lisible par l'éditeur."""
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def merge_teleporters(source: Dict[str, Any], patch: Dict[str, Any], force: bool = False) -> tuple[Dict[str, Any], list[str], list[str]]:
    """
    Injecte les assets téléporteurs du patch dans le fichier source.

    Retourne :
    - le JSON fusionné ;
    - la liste des assets ajoutés ;
    - la liste des assets déjà présents et donc conservés.
    """
    if "assets" not in source or not isinstance(source["assets"], dict):
        source["assets"] = {}
    patch_assets = patch.get("assets")
    if not isinstance(patch_assets, dict):
        raise ValueError("Le patch ne contient pas de champ assets valide.")

    added: list[str] = []
    kept: list[str] = []
    for key in TELEPORTER_KEYS:
        if key not in patch_assets:
            raise ValueError(f"Patch incomplet : {key} manquant.")
        if key in source["assets"] and not force:
            kept.append(key)
            continue
        source["assets"][key] = deepcopy(patch_assets[key])
        added.append(key)

    return source, added, kept


def main() -> int:
    parser = argparse.ArgumentParser(description="Ajoute les téléporteurs dans vector_assets.json sans écraser le reste.")
    parser.add_argument("source", nargs="?", default="vector_assets.json", help="Fichier vector_assets.json à enrichir.")
    parser.add_argument("patch", nargs="?", default="teleporter_vector_assets_patch.json", help="Patch contenant teleporter_1/2/3.")
    parser.add_argument("output", nargs="?", default=None, help="Fichier de sortie. Par défaut : écrase source après sauvegarde .bak.")
    parser.add_argument("--force", action="store_true", help="Remplace les téléporteurs déjà présents.")
    args = parser.parse_args()

    source_path = Path(args.source)
    patch_path = Path(args.patch)
    output_path = Path(args.output) if args.output else source_path

    source = read_json(source_path)
    patch = read_json(patch_path)
    merged, added, kept = merge_teleporters(source, patch, force=args.force)

    if output_path.resolve() == source_path.resolve():
        backup_path = source_path.with_suffix(source_path.suffix + ".bak")
        backup_path.write_text(source_path.read_text(encoding="utf-8-sig"), encoding="utf-8")
        print(f"Sauvegarde créée : {backup_path}")

    write_json(output_path, merged)
    print(f"Fichier fusionné : {output_path}")
    print("Ajoutés : " + (", ".join(added) if added else "aucun"))
    print("Déjà présents conservés : " + (", ".join(kept) if kept else "aucun"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
