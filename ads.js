/* ===== DATE GRAVITY ADS (V45, habillage V49 Néon Circuit) =====
   Point d'entrée unique pour la pub. Le jeu n'appelle que :
     DGAds.maybeInterstitial({chapterIndex})  -> Promise, résolue quand le jeu peut continuer
     DGAds.showRewarded(reason)               -> Promise<boolean>, true si la récompense est gagnée

   Deux fournisseurs :
     "fake"  : de faux encarts, sur le site web, pour juger le rythme et l'emplacement ;
     "admob" : les vraies pubs Google, uniquement dans l'application iOS / Android (Capacitor).
   Le choix est automatique. Brancher une autre régie = ajouter une entrée dans `providers`
   avec les deux mêmes méthodes.

   Tests rapides :  game.html?ads=debug  (interstitiel à chaque niveau)
                    game.html?ads=off    (aucune pub)
*/
(function(){
  const param=new URLSearchParams(location.search).get("ads");

  const config={
    enabled:param!=="off",
    debug:param==="debug",
    provider:"fake",              // remplacé par "admob" plus bas quand on tourne dans l'application
    admobTesting:true,            // true = pubs de test Google. À passer à false seulement avec de vrais identifiants.
    firstChapterAdFree:true,      // jamais d'interstitiel pendant le premier chapitre
    interstitialEveryLevels:4,    // au plus un interstitiel tous les N niveaux gagnés
    minSecondsBetweenAds:120,     // et jamais deux pubs à moins de N secondes
    fakeInterstitialSkipAfter:2,  // secondes avant que "Passer" soit actif
    fakeInterstitialSeconds:5,    // fermeture automatique
    fakeRewardedSeconds:5
  };

  let winsSinceAd=0;
  let lastAdAt=0;
  let showing=false;

  function now(){return Date.now();}
  function readLastAd(){
    try{return Math.max(lastAdAt,Number(sessionStorage.getItem("dg_last_ad_at"))||0);}catch(e){return lastAdAt;}
  }
  function markAdShown(){
    lastAdAt=now();
    winsSinceAd=0;
    try{sessionStorage.setItem("dg_last_ad_at",String(lastAdAt));}catch(e){}
  }

  function injectStyle(){
    if(document.getElementById("dgAdsStyle"))return;
    const st=document.createElement("style");
    st.id="dgAdsStyle";
    st.textContent=
      "#dgAdOverlay{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(7,9,26,.8);font-family:Rubik,Arial,sans-serif;color:#eaf0ff;animation:dgAdIn .18s ease both}"+
      "@keyframes dgAdIn{from{opacity:0}to{opacity:1}}"+
      ".dgAdCard{width:min(92vw,360px);border-radius:26px;overflow:hidden;background:#131a45;box-shadow:inset 0 0 0 2px #2b3a8c,0 0 40px rgba(25,227,255,.25)}"+
      ".dgAdTop{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;font-size:11px;font-weight:800;letter-spacing:.06em;color:#8fa0d8}"+
      ".dgAdTag{padding:3px 7px;border-radius:5px;background:#ffe14a;color:#0d1230}"+
      ".dgAdCreative{aspect-ratio:6/5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:16px;color:#0d1230;background:repeating-linear-gradient(135deg,#19e3ff 0 14px,#3ce9ff 14px 28px)}"+
      ".dgAdCreative b{font:900 24px/1 Rubik,Arial,sans-serif;text-transform:uppercase}"+
      ".dgAdCreative span{font-size:12.5px;font-weight:700;line-height:1.35}"+
      ".dgAdBottom{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px}"+
      ".dgAdInfo{font-size:12.5px;font-weight:800;color:#8fa0d8}"+
      ".dgAdBtn{appearance:none;border:0;border-radius:999px;padding:11px 16px;font:800 14px/1 Rubik,Arial,sans-serif;color:#eaf0ff;background:#172052;box-shadow:inset 0 0 0 2px #2b3a8c;cursor:pointer;touch-action:manipulation}"+
      ".dgAdBtn:disabled{opacity:.45;cursor:default}"+
      ".dgAdBtn.primary{background:linear-gradient(90deg,#f6ff3d,#19e3ff);color:#0d1230;box-shadow:0 0 18px rgba(25,227,255,.5)}"+
      ".dgAdBar{height:5px;background:#0d1230}"+
      ".dgAdBar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#f6ff3d,#19e3ff);transition:width .25s linear}";
    document.head.appendChild(st);
  }

  // Faux encart. Résout {completed, skipped}.
  function fakeAd(opts){
    return new Promise(resolve=>{
      injectStyle();
      const total=opts.seconds;
      const ov=document.createElement("div");
      ov.id="dgAdOverlay";
      ov.setAttribute("role","dialog");
      ov.setAttribute("aria-modal","true");
      ov.setAttribute("aria-label","Publicité");
      ov.innerHTML=
        '<div class="dgAdCard">'+
          '<div class="dgAdTop"><span><span class="dgAdTag">PUB</span> &nbsp;'+opts.kind+'</span><span>fausse pub de test</span></div>'+
          '<div class="dgAdCreative"><b>Votre pub ici</b><span>'+opts.text+'</span></div>'+
          '<div class="dgAdBar"><i></i></div>'+
          '<div class="dgAdBottom"><span class="dgAdInfo"></span><button class="dgAdBtn" type="button"></button></div>'+
        '</div>';
      const info=ov.querySelector(".dgAdInfo");
      const btn=ov.querySelector(".dgAdBtn");
      const bar=ov.querySelector(".dgAdBar i");
      const started=now();
      let done=false;

      // Tant que la pub est affichée, aucune touche ne doit atteindre le plateau.
      const swallow=e=>{e.stopPropagation();if(e.key!=="Tab")e.preventDefault();};
      window.addEventListener("keydown",swallow,true);

      function finish(result){
        if(done)return;
        done=true;
        clearInterval(timer);
        window.removeEventListener("keydown",swallow,true);
        ov.remove();
        resolve(result);
      }
      function tick(){
        const elapsed=(now()-started)/1000;
        const left=Math.max(0,Math.ceil(total-elapsed));
        bar.style.width=Math.min(100,elapsed/total*100)+"%";
        if(opts.rewarded){
          if(elapsed>=total){
            info.textContent="Récompense débloquée";
            btn.textContent="Continuer";
            btn.classList.add("primary");
            btn.onclick=()=>finish({completed:true});
          }else{
            info.textContent="Récompense dans "+left+" s";
            btn.textContent="Fermer";
            btn.onclick=()=>finish({completed:false,skipped:true});
          }
        }else{
          const canSkip=elapsed>=opts.skipAfter;
          info.textContent=canSkip?"Reprise dans "+left+" s":"Pub · "+left+" s";
          btn.textContent="Passer ›";
          btn.disabled=!canSkip;
          btn.onclick=()=>finish({completed:false,skipped:true});
          if(elapsed>=total)finish({completed:true});
        }
      }
      const timer=setInterval(tick,200);
      document.body.appendChild(ov);
      tick();
      btn.focus({preventScroll:true});
    });
  }

  /* --- AdMob (application seulement) ---
     Les identifiants ci-dessous sont ceux de TEST publiés par Google : ils affichent de fausses pubs
     et ne rapportent rien. Avant publication, les remplacer par les blocs d'annonces du compte AdMob
     (et l'identifiant d'application dans tools/app/configure-native.mjs), puis passer admobTesting à false. */
  const cap=window.Capacitor;
  const AdMob=cap&&cap.isNativePlatform&&cap.isNativePlatform()&&cap.Plugins?cap.Plugins.AdMob:null;
  const ADMOB_UNITS={
    ios:{interstitial:"ca-app-pub-3940256099942544/4411468910",rewarded:"ca-app-pub-3940256099942544/1712485313"},
    android:{interstitial:"ca-app-pub-3940256099942544/1033173712",rewarded:"ca-app-pub-3940256099942544/5224354917"}
  };
  let admobReady=null;
  function admobUnits(){return ADMOB_UNITS[cap.getPlatform()]||ADMOB_UNITS.android;}
  function admobInit(){
    // À la première pub seulement : consentement RGPD, puis autorisation de suivi sur iPhone.
    if(!admobReady)admobReady=(async()=>{
      await AdMob.initialize({initializeForTesting:config.admobTesting});
      try{
        const info=await AdMob.requestConsentInfo();
        if(info&&info.isConsentFormAvailable&&info.status==="REQUIRED")await AdMob.showConsentForm();
      }catch(e){console.warn("[ADS] consentement",e);}
      try{if(cap.getPlatform()==="ios")await AdMob.requestTrackingAuthorization();}catch(e){}
    })();
    return admobReady;
  }
  // Résolue au premier des événements cités (ou au bout de 90 s, pour ne jamais bloquer le jeu).
  function admobOnce(names){
    return new Promise(resolve=>{
      const handles=[];
      const done=v=>{handles.forEach(h=>{try{h&&h.remove&&h.remove();}catch(e){}});resolve(v);};
      names.forEach(n=>Promise.resolve(AdMob.addListener(n,()=>done(n))).then(h=>handles.push(h)));
      setTimeout(()=>done("timeout"),90000);
    });
  }
  // L'interstitiel est chargé à l'avance : le charger au moment du clic sur « Suivant » faisait attendre
  // le joueur plusieurs secondes devant un écran figé. S'il n'est pas prêt à temps, on n'en montre pas.
  let interReady=null;
  const admob={
    preload(){
      if(!interReady)interReady=(async()=>{
        await admobInit();
        await AdMob.prepareInterstitial({adId:admobUnits().interstitial,isTesting:config.admobTesting});
        return true;
      })().catch(e=>{console.warn("[ADS] interstitiel non chargé",e);interReady=null;return false;});
      return interReady;
    },
    async interstitial(){
      const ready=await Promise.race([admob.preload(),new Promise(r=>setTimeout(()=>r(false),1200))]);
      if(!ready)return {completed:false,notShown:true};
      interReady=null;
      const closed=admobOnce(["interstitialAdDismissed","interstitialAdFailedToShow"]);
      await AdMob.showInterstitial();
      await closed;
      admob.preload(); // la suivante se charge pendant qu'on joue
      return {completed:true};
    },
    async rewarded(){
      try{
        await admobInit();
        await AdMob.prepareRewardVideoAd({adId:admobUnits().rewarded,isTesting:config.admobTesting});
      }catch(e){
        console.warn("[ADS] aucune vidéo disponible, récompense offerte",e);
        return {completed:true};
      }
      let earned=false;
      const closed=admobOnce(["onRewardedVideoAdDismissed","onRewardedVideoAdFailedToShow"]);
      const reward=AdMob.addListener("onRewardedVideoAdReward",()=>{earned=true;});
      Promise.resolve(AdMob.showRewardVideoAd()).then(r=>{if(r)earned=true;},()=>{});
      await closed;
      await new Promise(r=>setTimeout(r,150)); // la récompense peut arriver juste après la fermeture
      Promise.resolve(reward).then(h=>{try{h&&h.remove&&h.remove();}catch(e){}});
      return {completed:earned};
    }
  };
  if(AdMob)config.provider="admob";

  const providers={
    admob,
    fake:{
      interstitial(){
        return fakeAd({kind:"Interstitiel",text:"Encart plein écran entre deux niveaux.",
          seconds:config.fakeInterstitialSeconds,skipAfter:config.fakeInterstitialSkipAfter});
      },
      rewarded(reason){
        return fakeAd({kind:"Vidéo récompensée",rewarded:true,seconds:config.fakeRewardedSeconds,
          text:reason==="solution"?"Regarde jusqu’au bout pour voir la solution du niveau.":"Regarde jusqu’au bout pour obtenir ta récompense."});
      }
    }
  };

  async function run(kind,arg){
    if(showing)return {completed:false};
    showing=true;
    try{DGAds.onStart&&DGAds.onStart(kind);}catch(e){}
    let result={completed:false};
    try{
      result=await providers[config.provider][kind](arg);
    }catch(e){
      console.warn("[ADS] échec",kind,e);
    }
    if(!result.notShown)markAdShown();
    showing=false;
    try{DGAds.onEnd&&DGAds.onEnd(kind);}catch(e){}
    return result;
  }

  const DGAds={
    config,
    onStart:null,   // le jeu y coupe la musique
    onEnd:null,

    /* Appelé à chaque passage au niveau suivant après une victoire.
       N'affiche une pub que si toutes les règles de fréquence sont respectées. */
    async maybeInterstitial(ctx){
      if(!config.enabled || window.CG_EDITOR_MODE)return false;
      if(window.DGPremium&&DGPremium.isOn())return false; // Premium : plus aucune pub
      winsSinceAd++;
      // dans l'application, la prochaine pub se charge pendant les niveaux qui précèdent
      if(config.provider==="admob"&&(ctx&&ctx.chapterIndex||0)>=1&&winsSinceAd>=config.interstitialEveryLevels-1)admob.preload();
      if(!config.debug){
        if(config.firstChapterAdFree && (ctx&&ctx.chapterIndex||0)<1)return false;
        if(winsSinceAd<config.interstitialEveryLevels)return false;
        if((now()-readLastAd())/1000<config.minSecondsBetweenAds)return false;
      }
      const r=await run("interstitial");
      return !r.notShown;
    },

    /* Pub choisie par le joueur. Sans pub disponible, la récompense est offerte. */
    async showRewarded(reason){
      if(!config.enabled || window.CG_EDITOR_MODE)return true;
      if(window.DGPremium&&DGPremium.isOn())return true; // Premium : la récompense est offerte
      const result=await run("rewarded",reason);
      return !!result.completed;
    }
  };

  window.DGAds=DGAds;
})();
