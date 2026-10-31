/* ===== DATE GRAVITY : mes autres jeux (pub maison) =====
   Une pub gratuite pour les autres jeux du même studio : elle prend la place d'une partie des pubs entre
   deux niveaux (ads.js) et a sa carte dans les options du menu. Aucun annonceur, aucun paiement.
   Ajouter un jeu = une entrée dans GAMES ; avec une vidéo (9:16, légère : 540x960, environ 2 Mo), elle passe
   à la place de l'image, avec son son. Un jeu n'est montré que là où il est téléchargeable
   (android : identifiant Google Play ; ios : identifiant App Store, à ajouter quand il y sera).

     DGPromo.available()  -> les jeux à montrer sur cette plateforme
     DGPromo.show()       -> Promise, résolue quand le joueur ferme la pub maison
     DGPromo.open(game)   -> ouvre la fiche du jeu sur la boutique
     DGPromo.SHARE        -> part des pubs entre deux niveaux remplacées par la pub maison
*/
(function(){
  const GAMES=[
    {name:"La Bataille Galactique",android:"com.musclorduck.battlecards",
      pitch:"Pose, bluffe, renverse ! Un jeu de cartes spatial avec des alliés à combiner.",
      art:"promo/bataille.webp",icon:"promo/bataille-icon.webp",video:"promo/bataille.mp4"}
  ];
  const SHARE=1/3;
  const cap=window.Capacitor;
  const platform=cap&&cap.getPlatform?cap.getPlatform():"web";
  const tr=(s,v)=>window.DGi18n?DGi18n.t(s,v):s;

  // sur le site, la fiche Google Play reste le meilleur lien (c'est là que le jeu s'installe)
  function storeUrl(g){
    if(platform==="ios")return g.ios?"https://apps.apple.com/app/id"+g.ios:null;
    return g.android?"https://play.google.com/store/apps/details?id="+g.android+"&referrer=utm_source%3Ddategravity":null;
  }
  function available(){return GAMES.filter(storeUrl);}
  function open(g){const u=storeUrl(g);if(u)window.open(u,"_blank");}

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

  // la pub maison : on peut la fermer tout de suite, elle ne retient jamais le joueur
  function show(g){
    g=g||available()[Math.floor(Math.random()*available().length)];
    if(!g)return Promise.resolve({completed:false,notShown:true});
    injectStyle();
    return new Promise(resolve=>{
      const ov=document.createElement("div");
      ov.id="dgPromo";
      ov.setAttribute("role","dialog");
      ov.setAttribute("aria-modal","true");
      ov.innerHTML='<div class="card"><div class="top"></div><img class="art" alt=""><div class="body"><h4></h4><p></p>'+
        '<button type="button" class="go"></button><button type="button" class="later"></button></div></div>';
      ov.querySelector(".top").textContent=tr("Un autre jeu du même studio");
      ov.querySelector("img").src=g.art;
      let vid=null;
      if(g.video){
        // la vidéo du jeu, avec son son ; si le navigateur refuse le son sans geste, elle passe en muet
        vid=document.createElement("video");
        vid.src=g.video;vid.poster=g.art;vid.playsInline=true;vid.setAttribute("playsinline","");vid.preload="auto";
        ov.querySelector("img").replaceWith(vid);
        ov.classList.add("vid");
        vid.play().catch(()=>{vid.muted=true;vid.play().catch(()=>{});});
      }
      ov.querySelector("h4").textContent=g.name;
      ov.querySelector("p").textContent=tr(g.pitch);
      ov.querySelector(".go").textContent=tr("Découvrir le jeu");
      ov.querySelector(".later").textContent=tr("Plus tard");
      const swallow=e=>{e.stopPropagation();if(e.key!=="Tab")e.preventDefault();};
      window.addEventListener("keydown",swallow,true);
      const done=r=>{window.removeEventListener("keydown",swallow,true);if(vid){vid.pause();vid.removeAttribute("src");vid.load();}ov.remove();resolve(r);};
      ov.querySelector(".go").onclick=()=>{open(g);done({completed:true});};
      ov.querySelector(".later").onclick=()=>done({completed:true});
      document.body.appendChild(ov);
    });
  }

  window.DGPromo={SHARE,available,show,open,storeUrl};
})();
