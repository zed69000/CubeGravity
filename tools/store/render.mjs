// Rend les visuels de la fiche Google Play en PNG, avec Edge ou Chrome sans fenêtre :
//   node tools/store/render.mjs
// Sources : store/play/feature.html (bannière 1024 x 500) et store/play/shot.html (captures 1080 x 1920).
// Les captures du jeu, prises sur le téléphone, sont dans store/play/raw/.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const BROWSERS = [
  // Chrome d'abord : Edge sans fenêtre ne rend rien quand le Edge habituel est déjà ouvert
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
];
const browser = BROWSERS.find(existsSync);
if (!browser) throw new Error("Edge ou Chrome introuvable");

const dir = resolve("store/play");
// profil jetable : un navigateur déjà ouvert garderait sinon la main sur le profil habituel
const profile = mkdtempSync(join(tmpdir(), "dg-store-"));
function shoot(page, out, w, h, query = "") {
  execFileSync(browser, [
    "--headless=new", "--disable-gpu", "--user-data-dir=" + profile, "--hide-scrollbars", "--force-device-scale-factor=1",
    "--virtual-time-budget=4000", "--window-size=" + w + "," + h, "--screenshot=" + join(dir, out),
    pathToFileURL(join(dir, page)).href + query,
  ], { stdio: "ignore" });
  console.log(out);
}

shoot("feature.html", "feature-graphic.png", 1024, 500);
if (existsSync(join(dir, "raw"))) {
  readdirSync(join(dir, "raw")).filter(f => f.endsWith(".png")).sort().forEach((f, i) =>
    shoot("shot.html", "screenshot-" + (i + 1) + ".png", 1080, 1920, "?img=" + encodeURIComponent(f)));
}
try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch (e) { /* Edge peut encore tenir un fichier : le dossier temporaire sera vidé plus tard */ }
