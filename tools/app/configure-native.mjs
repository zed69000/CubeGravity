// Réglages natifs qu'AdMob exige, appliqués après `npx cap add ios|android`.
//   node tools/app/configure-native.mjs ios
//   node tools/app/configure-native.mjs android
// Les projets ios/ et android/ sont régénérés à chaque build : ces réglages vivent donc ici, pas dans Xcode.
//
// ADMOB_APP_ID : identifiants d'application de TEST fournis par Google. À remplacer par ceux du compte
// AdMob avant toute publication (un par plateforme), en même temps que les blocs d'annonces de ads.js.
import { cpSync, readFileSync, writeFileSync } from "node:fs";

const ADMOB_APP_ID = {
  ios: "ca-app-pub-3940256099942544~1458002511",
  android: "ca-app-pub-3940256099942544~3347511713",
};
const TRACKING_TEXT = "Ton accord permet d'afficher des publicités plus pertinentes. Le jeu fonctionne de la même façon si tu refuses.";

const platform = process.argv[2];

if (platform === "ios") {
  const path = "ios/App/App/Info.plist";
  let s = readFileSync(path, "utf8");
  if (!s.includes("GADApplicationIdentifier")) {
    const add =
      "\t<key>GADApplicationIdentifier</key>\n\t<string>" + ADMOB_APP_ID.ios + "</string>\n" +
      "\t<key>NSUserTrackingUsageDescription</key>\n\t<string>" + TRACKING_TEXT + "</string>\n" +
      "\t<key>SKAdNetworkItems</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>SKAdNetworkIdentifier</key>\n\t\t\t<string>cstr6suwn9.skadnetwork</string>\n\t\t</dict>\n\t</array>\n";
    const end = s.lastIndexOf("</dict>");
    if (end < 0) throw new Error("Info.plist inattendu");
    s = s.slice(0, end) + add + s.slice(end);
    writeFileSync(path, s);
  }
  console.log("Info.plist prêt pour AdMob");
} else if (platform === "android") {
  const path = "android/app/src/main/AndroidManifest.xml";
  let s = readFileSync(path, "utf8");
  if (!s.includes("com.google.android.gms.ads.APPLICATION_ID")) {
    const end = s.lastIndexOf("</application>");
    if (end < 0) throw new Error("AndroidManifest.xml inattendu");
    s = s.slice(0, end) + '    <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="' + ADMOB_APP_ID.android + '"/>\n    ' + s.slice(end);
    writeFileSync(path, s);
  }
  console.log("AndroidManifest.xml prêt pour AdMob");
  // l'icône du jeu remplace celle du modèle Capacitor (dessinée par tools/app/make_icon.py)
  // (mipmap-* et values/ic_launcher_background.xml)
  cpSync("tools/app/android-res", "android/app/src/main/res", { recursive: true });
  console.log("icône Android en place");
} else {
  throw new Error("plateforme attendue : ios ou android");
}
