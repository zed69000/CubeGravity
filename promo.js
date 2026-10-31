/* ===== DATE GRAVITY : other games from the same studio (house ad) =====
   Free promotion for the studio's other games: it replaces part of the between-level ads (ads.js)
   and has its own card in the menu options. No advertiser, no payment.
   The list lives online (games-catalog repo), so a game is added or changed without a new app release.
   The last copy is kept on the device; nothing here ever waits on the network before the game starts.
   A game is only shown where it can be installed (store id for the current platform).

     DGPromo.available()  -> games to show on this platform
     DGPromo.show()       -> Promise, resolved when the player closes the house ad
     DGPromo.open(game)   -> opens the game's store page (counted as a click from the options card)
     DGPromo.onChange     -> called when a fresher catalog arrives
     DGPromo.SHARE        -> share of between-level ads replaced by the house ad
*/
(function(){
  const CATALOG_URL="https://games-catalog.sebastienalzamora.workers.dev/catalog.json";
  const STATS_URL="https://games-catalog.sebastienalzamora.workers.dev/api/stats/event";
  const SELF={id:"date-gravity",android:"com.dategravity.app"};
  const CACHE_KEY="dg_promo_catalog";
  const TIMEOUT_MS=4000;
  const SHARE=1/3;
  const cap=window.Capacitor;
  const platform=cap&&cap.getPlatform?cap.getPlatform():"web";
  const tr=(s,v)=>window.DGi18n?DGi18n.t(s,v):s;
  const lang=window.DGi18n?DGi18n.lang:"fr";

  // catalog texts are either a plain string or one string per language
  function local(v){
    if(!v||typeof v==="string")return v||"";
    return v[lang]||v.en||v.fr||Object.values(v)[0]||"";
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
      if(store.android===SELF.android)continue;
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

  // on the website, the Google Play page is still the best link (that is where the game installs)
  function storeUrl(g){
    if(platform==="ios")return g.ios?"https://apps.apple.com/app/id"+g.ios:null;
    return g.android?"https://play.google.com/store/apps/details?id="+g.android+"&referrer=utm_source%3Ddategravity":null;
  }
  function available(){return games.filter(storeUrl);}
  // anonymous counters for the catalog stats: which game was shown or clicked, and from which game
  function stat(g,event){
    try{
      const body=JSON.stringify({game:g.id,from:SELF.id,event});
      if(navigator.sendBeacon&&navigator.sendBeacon(STATS_URL,body))return;
      fetch(STATS_URL,{method:"POST",body,mode:"no-cors",keepalive:true}).catch(()=>{});
    }catch(e){}
  }
  function open(g,event){const u=storeUrl(g);if(!u)return;stat(g,event||"card_click");window.open(u,"_blank");}

  function injectStyle(){
    if(document.getElementById("dgPromoStyle"))return;
    const st=document.createElement("style");
    st.id="dgPromoStyle";
    st.textContent=
      "#dgPromo{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(7,9,26,.82);font-family:Rubik,Arial,sans-serif;color:#eaf0ff;animation:dgPromoIn .2s ease both}"+
      "@keyframes dgPromoIn{from{opacity:0}to{opacity:1}}"+
      "#dgPromo .card{width:min(92vw,380px);border-radius:26px;overflow:hidden;background:#131a45;box-shadow:inset 0 0 0 2px #2b3a8c,0 0 40px rgba(25,227,255,.25)}"+
      "#dgPromo .top{padding:12px 16px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8fa0d8}"+
      "#dgPromo img.art{display:block;width:100%;aspect-ratio:768/375;object-fit:cover;background:#0d1230}"+
      "#dgPromo .body{padding:14px 16px 16px;text-align:center}"+
      "#dgPromo h4{margin:0 0 6px;font:900 20px/1.1 Rubik,Arial,sans-serif;text-transform:uppercase}"+
      "#dgPromo p{margin:0 0 14px;font-size:13.5px;line-height:1.4;color:#c6d0f2}"+
      "#dgPromo button{appearance:none;border:0;display:block;width:100%;border-radius:999px;font:900 15px/1 Rubik,Arial,sans-serif;cursor:pointer;touch-action:manipulation}"+
      "#dgPromo .go{padding:14px;background:linear-gradient(90deg,#f6ff3d,#19e3ff);color:#0d1230;box-shadow:0 0 18px rgba(25,227,255,.45)}"+
      "#dgPromo.vid .card{width:min(92vw,calc((100dvh - 190px)*9/16),380px)}"+
      "#dgPromo video{display:block;width:100%;aspect-ratio:9/16;object-fit:cover;background:#0d1230}"+
      "#dgPromo.vid .body{padding:12px 14px 14px}#dgPromo.vid h4,#dgPromo.vid p{display:none}"+
      "#dgPromo .later{margin-top:8px;padding:11px;background:#172052;color:#eaf0ff;box-shadow:inset 0 0 0 2px #2b3a8c;font-weight:800;font-size:14px}";
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
      ov.id="dgPromo";
      ov.setAttribute("role","dialog");
      ov.setAttribute("aria-modal","true");
      ov.innerHTML='<div class="card"><div class="top"></div><img class="art" alt=""><div class="body"><h4></h4><p></p>'+
        '<button type="button" class="go"></button><button type="button" class="later"></button></div></div>';
      ov.querySelector(".top").textContent=tr("Un autre jeu du même studio");
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
      ov.querySelector(".go").textContent=tr("Découvrir le jeu");
      ov.querySelector(".later").textContent=tr("Plus tard");
      const swallow=e=>{e.stopPropagation();if(e.key!=="Tab")e.preventDefault();};
      window.addEventListener("keydown",swallow,true);
      const done=r=>{window.removeEventListener("keydown",swallow,true);clearTimeout(stall);if(vid){vid.pause();vid.removeAttribute("src");vid.load();}ov.remove();resolve(r);};
      ov.querySelector(".go").onclick=()=>{open(g,"click");done({completed:true});};
      ov.querySelector(".later").onclick=()=>done({completed:true});
      document.body.appendChild(ov);
      stat(g,"impression");
    });
  }

  window.DGPromo=api;
})();
