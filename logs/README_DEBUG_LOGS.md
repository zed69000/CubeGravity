# Logs éditeur SVG V43.35

L’éditeur ajoute un bouton **Télécharger logs** dans la barre du haut.

Il exporte un fichier `cg_svg_editor_debug.log` contenant :
- erreurs JavaScript ;
- rejets de promesses ;
- actions critiques comme ajout de point Bézier et suppression de layers.

Les logs sont stockés temporairement dans `localStorage` sous `CG_SVG_EDITOR_DEBUG_LOGS_V43_35`.
