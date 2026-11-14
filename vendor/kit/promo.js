// Studio kit v4, promo: copied by `npm run kit`, never edit it here.
/* Studio kit, embedded tool "promo": the house ad for the studio's other games, read from the catalog.
   Embedded (copied into the game by `npm run kit`), because the game asks for it while it starts and it must work
   offline in the app. The source lives in games-catalog/public/kit/embed/promo.js: never edit the copy in a game.

   Free promotion for the studio's other games: it can replace part of the between-level ads and fill a
   "my other games" card in the options. No advertiser, no payment.
   The list lives online (catalog.json), so a game is added or changed without a new app release.
   The last copy is kept on the device; nothing here ever waits on the network before the game starts.
   A game is only shown where it can be installed (store id for the current platform).

     GamePromo.available()  -> games to show on this platform
     GamePromo.show()       -> Promise, resolved when the player closes the house ad
     GamePromo.open(game)   -> opens the game's store page (counted as a click from the options card)
     GamePromo.onChange     -> called when a fresher catalog arrives
     GamePromo.SHARE        -> share of between-level ads replaced by the house ad (default, the GDD can change it)

   Set by kit.json: id, android, and "promo": {"pool": "adult"} for a game shown only beside adult games.
   The texts follow window.GameKit.lang(), otherwise the page's language (<html lang>), otherwise the device's.
   Code lines are plain ASCII (accents written \uXXXX): the texts show right whatever charset the game page declares.
*/
(function(){
  const KIT={"id":"date-gravity","android":"com.dategravity.app","gddPreview":"gdd-preview.js"};
  const BASE="https://games-catalog.sebastienalzamora.workers.dev";
  const opt=KIT.promo||{};
  const CATALOG_URL=BASE+"/catalog.json"+(opt.pool==="adult"?"?pool=adult":"");
  const STATS_URL=BASE+"/api/stats/event";
  const SELF={id:KIT.id,android:KIT.android||""};
  const CACHE_KEY="kit_promo_"+KIT.id;
  const TIMEOUT_MS=4000;
  const SHARE=1/3;
  const cap=window.Capacitor;
  const platform=cap&&cap.getPlatform?cap.getPlatform():"web";
  // [title above the card, main button, close button]
  const TEXT={
    fr:["Un autre jeu du m\u00eame studio", "D\u00e9couvrir le jeu", "Plus tard"],
    en:["Another game from the same studio", "Discover the game", "Later"],
    es:["Otro juego del mismo estudio", "Descubrir el juego", "M\u00e1s tarde"],
    de:["Ein weiteres Spiel vom selben Studio", "Spiel entdecken", "Sp\u00e4ter"],
    pt:["Outro jogo do mesmo est\u00fadio", "Conhecer o jogo", "Depois"],
    zh:["\u540c\u4e00\u5de5\u4f5c\u5ba4\u7684\u53e6\u4e00\u6b3e\u6e38\u620f", "\u4e86\u89e3\u8fd9\u6b3e\u6e38\u620f", "\u4ee5\u540e\u518d\u8bf4"],
    ja:["\u540c\u3058\u30b9\u30bf\u30b8\u30aa\u306e\u30b2\u30fc\u30e0", "\u30b2\u30fc\u30e0\u3092\u898b\u308b", "\u3042\u3068\u3067"],
    ko:["\uac19\uc740 \uc2a4\ud29c\ub514\uc624\uc758 \ub2e4\ub978 \uac8c\uc784", "\uac8c\uc784 \ubcf4\uae30", "\ub098\uc911\uc5d0"],
  };
  function lang(){
    let l="";
    try{const h=window.GameKit&&window.GameKit.lang;l=typeof h==="function"?h():"";}catch(e){}
    l=String(l||document.documentElement.lang||navigator.language||"fr").slice(0,2).toLowerCase();
    return TEXT[l]?l:"en";
  }
  const tr=i=>TEXT[lang()][i];

  // catalog texts are either a plain string or one string per language
  function local(v){
    if(!v||typeof v==="string")return v||"";
    const l=lang();
    return v[l]||v.en||v.fr||Object.values(v)[0]||"";
  }
  function media(path,base){
    if(!path)return null;
    try{const u=new URL(path,base);return u.protocol==="https:"?u.href:null;}catch(e){return null;}
  }
  function parse(cat,base){
    const out=[];
    for(const g of (cat&&cat.games)||[]){
      if(!g||!g.id||g.id===SELF.id)continue;
      const store=g.store||{};
      if(SELF.android&&store.android===SELF.android)continue;
      const name=local(g.name);
      if(!name)continue;
      out.push({id:g.id,name,pitch:local(g.pitch),android:store.android||null,ios:store.ios||null,
        icon:media(g.icon,base),art:media(g.poster,base),video:media(g.video,base)});
    }
    return out;
  }

  let games=[];
  try{
    const saved=JSON.parse(localStorage.getItem(CACHE_KEY)||"null");
    if(saved&&saved.data)games=parse(saved.data,CATALOG_URL);
  }catch(e){}

  const api={SHARE,available,show,open,storeUrl,onChange:null};
  (function refresh(){
    if(!window.fetch)return;
    const ctl=window.AbortController?new AbortController():null;
    const timer=setTimeout(()=>ctl&&ctl.abort(),TIMEOUT_MS);
    fetch(CATALOG_URL,{signal:ctl&&ctl.signal,cache:"no-cache"})
      .then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
      .then(data=>{
        games=parse(data,CATALOG_URL);
        try{localStorage.setItem(CACHE_KEY,JSON.stringify({at:Date.now(),data}));}catch(e){}
        try{api.onChange&&api.onChange();}catch(e){}
      })
      .catch(()=>{}) // offline or catalog down: the saved copy stays in use
      .finally(()=>clearTimeout(timer));
  })();

  // on the website, the Google Play page is still the best link (that is where the game installs);
  // the referrer names the game the click came from (e.g. utm_source=dategravity), read in the Play Console
  function storeUrl(g){
    if(platform==="ios")return g.ios?"https://apps.apple.com/app/id"+g.ios:null;
    return g.android?"https://play.google.com/store/apps/details?id="+g.android+"&referrer=utm_source%3D"+encodeURIComponent(SELF.id.replace(/-/g,"")):null;
  }
  function available(){return games.filter(storeUrl);}
  // anonymous counters for the catalog stats: which game was shown or clicked, and from which game
  function stat(g,event){
    if(window.Tuning&&Tuning.preview)return;
    try{
      const body=JSON.stringify({game:g.id,from:SELF.id,event});
      if(navigator.sendBeacon&&navigator.sendBeacon(STATS_URL,body))return;
      fetch(STATS_URL,{method:"POST",body,mode:"no-cors",keepalive:true}).catch(()=>{});
    }catch(e){}
  }
  function open(g,event){const u=storeUrl(g);if(!u)return;stat(g,event||"card_click");window.open(u,"_blank");}

  function injectStyle(){
    if(document.getElementById("kitPromoStyle"))return;
    const st=document.createElement("style");
    st.id="kitPromoStyle";
    st.textContent=
      "#kitPromo{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(7,9,26,.82);font-family:Rubik,Arial,sans-serif;color:#eaf0ff;animation:kitPromoIn .2s ease both}"+
      "@keyframes kitPromoIn{from{opacity:0}to{opacity:1}}"+
      "#kitPromo .card{width:min(92vw,380px);border-radius:26px;overflow:hidden;background:#131a45;box-shadow:inset 0 0 0 2px #2b3a8c,0 0 40px rgba(25,227,255,.25)}"+
      "#kitPromo .top{padding:12px 16px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8fa0d8}"+
      "#kitPromo img.art{display:block;width:100%;aspect-ratio:768/375;object-fit:cover;background:#0d1230}"+
      "#kitPromo .body{padding:14px 16px 16px;text-align:center}"+
      "#kitPromo h4{margin:0 0 6px;font:900 20px/1.1 Rubik,Arial,sans-serif;text-transform:uppercase}"+
      "#kitPromo p{margin:0 0 14px;font-size:13.5px;line-height:1.4;color:#c6d0f2}"+
      "#kitPromo button{appearance:none;border:0;display:block;width:100%;border-radius:999px;font:900 15px/1 Rubik,Arial,sans-serif;cursor:pointer;touch-action:manipulation}"+
      "#kitPromo .go{padding:14px;background:linear-gradient(90deg,#f6ff3d,#19e3ff);color:#0d1230;box-shadow:0 0 18px rgba(25,227,255,.45)}"+
      "#kitPromo.vid .card{width:min(92vw,calc((100dvh - 190px)*9/16),380px)}"+
      "#kitPromo video{display:block;width:100%;aspect-ratio:9/16;object-fit:cover;background:#0d1230}"+
      "#kitPromo.vid .body{padding:12px 14px 14px}#kitPromo.vid h4,#kitPromo.vid p{display:none}"+
      "#kitPromo .later{margin-top:8px;padding:11px;background:#172052;color:#eaf0ff;box-shadow:inset 0 0 0 2px #2b3a8c;font-weight:800;font-size:14px}";
    document.head.appendChild(st);
  }

  // the house ad can be closed at once, it never holds the player back
  function show(g){
    const list=available();
    g=g||list[Math.floor(Math.random()*list.length)];
    // media are streamed from the catalog site: without a network there is nothing worth showing
    if(!g||navigator.onLine===false||!g.art)return Promise.resolve({completed:false,notShown:true});
    injectStyle();
    return new Promise(resolve=>{
      const ov=document.createElement("div");
      ov.id="kitPromo";
      ov.setAttribute("role","dialog");
      ov.setAttribute("aria-modal","true");
      ov.innerHTML='<div class="card"><div class="top"></div><img class="art" alt=""><div class="body"><h4></h4><p></p>'+
        '<button type="button" class="go"></button><button type="button" class="later"></button></div></div>';
      ov.querySelector(".top").textContent=tr(0);
      const img=ov.querySelector("img");
      img.src=g.art;
      let vid=null,stall=0;
      // back to the still image when the video cannot play (no codec, slow or broken link)
      const toImage=()=>{
        clearTimeout(stall);
        if(!vid)return;
        vid.pause();vid.removeAttribute("src");vid.load();
        vid.replaceWith(img);ov.classList.remove("vid");
        vid=null;
      };
      if(g.video){
        // the game's video, with its sound; if sound is refused without a gesture it plays muted
        vid=document.createElement("video");
        vid.src=g.video;vid.poster=g.art;vid.playsInline=true;vid.setAttribute("playsinline","");vid.preload="auto";
        img.replaceWith(vid);
        ov.classList.add("vid");
        vid.addEventListener("error",toImage);
        vid.addEventListener("playing",()=>clearTimeout(stall));
        stall=setTimeout(toImage,6000);
        vid.play().catch(()=>{if(!vid)return;vid.muted=true;vid.play().catch(toImage);});
      }
      ov.querySelector("h4").textContent=g.name;
      ov.querySelector("p").textContent=g.pitch;
      ov.querySelector(".go").textContent=tr(1);
      ov.querySelector(".later").textContent=tr(2);
      const swallow=e=>{e.stopPropagation();if(e.key!=="Tab")e.preventDefault();};
      window.addEventListener("keydown",swallow,true);
      const done=r=>{window.removeEventListener("keydown",swallow,true);clearTimeout(stall);if(vid){vid.pause();vid.removeAttribute("src");vid.load();}ov.remove();resolve(r);};
      ov.querySelector(".go").onclick=()=>{open(g,"click");done({completed:true});};
      ov.querySelector(".later").onclick=()=>done({completed:true});
      document.body.appendChild(ov);
      stat(g,"impression");
    });
  }

  window.GamePromo=api;
})();
