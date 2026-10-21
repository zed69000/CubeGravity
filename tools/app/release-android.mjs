// Fabrique l'App Bundle (.aab) signé à envoyer sur Google Play :
//   npm run release:android
// Il faut la clé d'envoi décrite dans keystore.properties (voir keystore.properties.example),
// ou les variables d'environnement DG_STORE_FILE, DG_STORE_PASSWORD, DG_KEY_ALIAS, DG_KEY_PASSWORD.
// Penser à augmenter DG_VERSION dans version.js avant chaque envoi : Play refuse deux fois le même numéro.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const run = (cmd, cwd) => execSync(cmd, { stdio: "inherit", cwd });

if (!existsSync("keystore.properties") && !process.env.DG_STORE_FILE) {
  console.error("Clé d'envoi introuvable : copier keystore.properties.example en keystore.properties et le remplir.");
  process.exit(1);
}
const test = /DG_TEST_BUILD\s*=\s*true/.test(readFileSync("version.js", "utf8"));

run("node tools/app/copy-web.mjs");
if (!existsSync("android")) run("npx cap add android");
run("node tools/app/configure-native.mjs android");
run("npx cap sync android");
run((process.platform === "win32" ? ".\\gradlew.bat" : "./gradlew") + " bundleRelease", "android");

console.log("\nApp Bundle prêt : " + join("android", "app", "build", "outputs", "bundle", "release", "app-release.aab"));
if (test) console.log("Attention : DG_TEST_BUILD vaut true dans version.js (Atelier visible). Normal pour les tests internes, pas pour la sortie.");
