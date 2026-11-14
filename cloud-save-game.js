/* Date Gravity : sauvegarde en ligne par Google Play Jeux (voir cloud-save.js).
   Voyage avec le joueur : progression, look, réglages, tutoriels vus. Pas l'éditeur, les essais de niveaux,
   l'achat Premium (rendu par Google Play lui-même), ni les compteurs de pub. */
CloudSave.setup({
  name: "date-gravity",
  keep: k => /^(dg_|dcg_|gravity_cube_)/.test(k) &&
    !/^(dg_editor|gravity_cube_levels_draft|dg_save_|dg_premium|dg_promo|dg_last_ad|dg_offer|dg_fete_test|dg_splash)/.test(k),
  resetKeys: ["gravity_cube_player_progress_v2"],
  // niveaux réussis d'abord, puis rencontres
  progress: get => {
    const p = JSON.parse(get("gravity_cube_player_progress_v2") || "{}") || {};
    return Object.keys(p.best || {}).length * 1000 + Object.keys(p.met || {}).length;
  },
  describe: get => {
    const p = JSON.parse(get("gravity_cube_player_progress_v2") || "{}") || {};
    return Object.keys(p.best || {}).length + " niveaux";
  }
});
