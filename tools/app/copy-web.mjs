// Copie dans www/ uniquement ce que le joueur utilise : c'est ce dossier que Capacitor embarque dans l'application.
// Les outils d'atelier (éditeur d'assets, maquettes, générateur de niveaux) restent hors de l'application.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "www");
const FILES = [
  "index.html",
  "version.js",
  "save.js",
  "game.html",
  "ads.js",
  "promo.js",
  "promo",
  "i18n.js",
  "premium.js",
  "lang",
  "spirits.js",
  "audio.js",
  "ambiance.js",
  "levels.json",
  "vector_assets.json",
  "manifest.webmanifest",
  "icons",
];

rmSync(out, { recursive: true, force: true });
for (const f of FILES) {
  const src = join(root, f);
  if (!existsSync(src)) throw new Error("fichier manquant : " + f);
  mkdirSync(dirname(join(out, f)), { recursive: true });
  cpSync(src, join(out, f), { recursive: true }); // "lang" est un dossier : une traduction par fichier
}
console.log(FILES.length + " entrées copiées dans www/");
