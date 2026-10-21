// Réglages natifs, appliqués après `npx cap add ios|android` :
//   node tools/app/configure-native.mjs ios
//   node tools/app/configure-native.mjs android
// Les projets ios/ et android/ sont régénérés à chaque build : ces réglages vivent donc ici, pas dans Xcode
// ni dans Android Studio. Chaque réglage vérifie s'il est déjà là : on peut relancer le script sans risque.
//
// Ce qui est réglé, sur les deux plateformes :
//   - AdMob : identifiant d'application (et, sur iPhone, le texte de la demande de suivi) ;
//   - écran : portrait uniquement ;
//   - version : lue dans version.js (DG_VERSION "a.b.c"). Le numéro interne, qui doit augmenter à chaque
//     envoi sur les boutiques, en est déduit : a*10000 + b*100 + c (1.1.1 -> 10101).
// Et sur Android seulement :
//   - signature de release avec la clé d'envoi Google Play, décrite dans keystore.properties à la racine
//     du dépôt (jamais commité, voir keystore.properties.example) ou dans les variables d'environnement
//     DG_STORE_FILE, DG_STORE_PASSWORD, DG_KEY_ALIAS, DG_KEY_PASSWORD (pour un build automatique).
//
// ADMOB_APP_ID : identifiants d'application de TEST fournis par Google. À remplacer par ceux du compte
// AdMob avant toute publication (un par plateforme), en même temps que les blocs d'annonces de ads.js.
import { cpSync, readFileSync, writeFileSync } from "node:fs";

const ADMOB_APP_ID = {
  ios: "ca-app-pub-3940256099942544~1458002511",
  android: "ca-app-pub-3940256099942544~3347511713",
};
const TRACKING_TEXT = "Ton accord permet d'afficher des publicités plus pertinentes. Le jeu fonctionne de la même façon si tu refuses.";

const versionName = (readFileSync("version.js", "utf8").match(/DG_VERSION\s*=\s*"(\d+)\.(\d+)\.(\d+)"/) || []).slice(0, 4);
if (versionName.length < 4) throw new Error("version.js : DG_VERSION \"a.b.c\" introuvable");
const [, major, minor, patch] = versionName.map(Number);
if (minor > 99 || patch > 99) throw new Error("version.js : b et c doivent rester sous 100");
const VERSION = major + "." + minor + "." + patch;
const BUILD = major * 10000 + minor * 100 + patch;

const platform = process.argv[2];

function edit(path, fn) {
  const before = readFileSync(path, "utf8");
  const after = fn(before);
  if (after !== before) writeFileSync(path, after);
}

if (platform === "ios") {
  edit("ios/App/App/Info.plist", s => {
    if (!s.includes("GADApplicationIdentifier")) {
      const add =
        "\t<key>GADApplicationIdentifier</key>\n\t<string>" + ADMOB_APP_ID.ios + "</string>\n" +
        "\t<key>NSUserTrackingUsageDescription</key>\n\t<string>" + TRACKING_TEXT + "</string>\n" +
        "\t<key>SKAdNetworkItems</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>SKAdNetworkIdentifier</key>\n\t\t\t<string>cstr6suwn9.skadnetwork</string>\n\t\t</dict>\n\t</array>\n";
      const end = s.lastIndexOf("</dict>");
      if (end < 0) throw new Error("Info.plist inattendu");
      s = s.slice(0, end) + add + s.slice(end);
    }
    // portrait seulement, iPad compris (il faut alors renoncer au partage d'écran de l'iPad)
    const portrait = "<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t</array>";
    s = s.replace(/(<key>UISupportedInterfaceOrientations(~ipad)?<\/key>\s*)<array>[\s\S]*?<\/array>/g, "$1" + portrait);
    if (!s.includes("UIRequiresFullScreen")) {
      const end = s.lastIndexOf("</dict>");
      s = s.slice(0, end) + "\t<key>UIRequiresFullScreen</key>\n\t<true/>\n" + s.slice(end);
    }
    return s;
  });
  console.log("Info.plist prêt : AdMob, portrait");
  edit("ios/App/App.xcodeproj/project.pbxproj", s => s
    .replace(/MARKETING_VERSION = [^;]+;/g, "MARKETING_VERSION = " + VERSION + ";")
    .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, "CURRENT_PROJECT_VERSION = " + BUILD + ";"));
  console.log("version iOS : " + VERSION + " (" + BUILD + ")");
} else if (platform === "android") {
  edit("android/app/src/main/AndroidManifest.xml", s => {
    if (!s.includes("com.google.android.gms.ads.APPLICATION_ID")) {
      const end = s.lastIndexOf("</application>");
      if (end < 0) throw new Error("AndroidManifest.xml inattendu");
      s = s.slice(0, end) + '    <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="' + ADMOB_APP_ID.android + '"/>\n    ' + s.slice(end);
    }
    if (!s.includes("android:screenOrientation")) {
      s = s.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="portrait"');
    }
    return s;
  });
  console.log("AndroidManifest.xml prêt : AdMob, portrait");

  edit("android/app/build.gradle", s => {
    s = s.replace(/versionCode \d+/, "versionCode " + BUILD).replace(/versionName "[^"]*"/, 'versionName "' + VERSION + '"');
    if (!s.includes("dgUploadKey")) {
      s = s.replace(/\nandroid \{\n/, `
android {
    // signature de release : clé d'envoi Google Play (keystore.properties à la racine du dépôt, ou variables DG_*)
    def dgUploadKey = new Properties()
    def dgKeyFile = rootProject.file("../keystore.properties")
    if (dgKeyFile.exists()) dgKeyFile.withInputStream { dgUploadKey.load(it) }
    def dgKey = { String name, String env -> dgUploadKey.getProperty(name) ?: System.getenv(env) }
    signingConfigs {
        release {
            if (dgKey("storeFile", "DG_STORE_FILE")) {
                def dgStore = dgKey("storeFile", "DG_STORE_FILE")
                storeFile new File(dgStore).isAbsolute() ? new File(dgStore) : rootProject.file("../" + dgStore)
                storePassword dgKey("storePassword", "DG_STORE_PASSWORD")
                keyAlias dgKey("keyAlias", "DG_KEY_ALIAS")
                keyPassword dgKey("keyPassword", "DG_KEY_PASSWORD")
            }
        }
    }
`);
      s = s.replace(/buildTypes \{\n(\s*)release \{\n/, (m, ind) => m + ind + "    if (signingConfigs.release.storeFile) signingConfig signingConfigs.release\n");
      if (!s.includes("dgUploadKey") || !s.includes("signingConfig signingConfigs.release")) throw new Error("android/app/build.gradle inattendu");
    }
    return s;
  });
  console.log("build.gradle prêt : version " + VERSION + " (" + BUILD + "), signature de release");

  // l'icône du jeu remplace celle du modèle Capacitor (dessinée par tools/app/make_icon.py)
  // (mipmap-* et values/ic_launcher_background.xml)
  cpSync("tools/app/android-res", "android/app/src/main/res", { recursive: true });
  console.log("icône Android en place");
} else {
  throw new Error("plateforme attendue : ios ou android");
}
