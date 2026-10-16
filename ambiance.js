/* ===== Date Gravity : ambiances (moment de la journée + météo) =====
   Un décor d'humeur derrière le plateau : la lumière (aube, jour, fin d'après-midi, coucher de soleil, crépuscule, nuit)
   et une météo (neige, pluie, orage, feuilles, sable, pétales, lucioles, étoiles filantes).

   Tout est fait pour le téléphone : les particules sont des motifs qui se répètent, posés sur des calques que la carte
   graphique fait glisser (transform) sans jamais rien repeindre. L'orage n'est qu'un voile qui s'allume un instant.
   Rien ne bouge si le système demande moins d'animations.

   DGAmbiance.apply(host, {time, weather})   host : l'élément décor (dans le jeu, #gfx)
   DGAmbiance.CHAPTERS                        l'ambiance de chaque chapitre
*/
(function(){
  const TIMES={
    // ciel du haut, ciel du bas, teinte des halos
    dawn:   {top:"#3a2a6b",bottom:"#ff9fb5",glow:"#ffb3c7",veil:.30},
    day:    {top:"#1d3f8f",bottom:"#58c6ff",glow:"#9fe8ff",veil:.18},
    golden: {top:"#4a2c6e",bottom:"#ffbf5a",glow:"#ffd27a",veil:.26},
    sunset: {top:"#3b1d63",bottom:"#ff6a5a",glow:"#ff8a6a",veil:.34},
    dusk:   {top:"#141a4d",bottom:"#7a4fd1",glow:"#b49aff",veil:.28},
    night:  {top:"#050620",bottom:"#1a1f5c",glow:"#7d8cff",veil:.22}
  };
  // la lumière et la météo de chaque chapitre (dans l'ordre des chapitres)
  const CHAPTERS=[
    {time:"dawn",weather:"none"},       // Premier pas : une aube calme
    {time:"day",weather:"leaves"},      // Sortir du cadre : du vent dans les feuilles
    {time:"golden",weather:"sand"},     // Boutons du cœur : fin d'après-midi, sable qui vole
    {time:"night",weather:"snow"},      // Zones dangereuses : la neige
    {time:"night",weather:"stars"},     // Têtes qui tournent : nuit étoilée, étoiles filantes
    {time:"dusk",weather:"storm"},      // Coup de foudre : l'orage, évidemment
    {time:"dusk",weather:"rain"},       // C'est compliqué : une pluie fine
    {time:"sunset",weather:"petals"}    // Le grand amour : coucher de soleil et pétales
  ];
  const svgTile=(w,h,body)=>'url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'">'+body+'</svg>')+'")';
  // chaque météo : des calques (motif, taille du motif, durée d'un tour, dérive horizontale, opacité)
  const WEATHER={
    snow:[
      {tile:svgTile(120,120,'<circle cx="18" cy="22" r="2.2" fill="#fff"/><circle cx="78" cy="64" r="1.6" fill="#fff"/><circle cx="104" cy="12" r="1.2" fill="#fff"/><circle cx="46" cy="98" r="1.9" fill="#fff"/>'),size:120,dur:9,drift:30,op:.85},
      {tile:svgTile(180,180,'<circle cx="40" cy="50" r="3.2" fill="#fff"/><circle cx="140" cy="130" r="2.6" fill="#fff"/>'),size:180,dur:6,drift:-40,op:.6,blur:1}
    ],
    rain:[
      {tile:svgTile(90,140,'<path d="M20 10l-4 22M64 70l-4 22M44 118l-3 16" stroke="#bfe6ff" stroke-width="1.4" stroke-linecap="round"/>'),size:140,dur:.9,drift:-30,op:.55},
      {tile:svgTile(130,200,'<path d="M30 20l-6 34M100 120l-6 34" stroke="#bfe6ff" stroke-width="2" stroke-linecap="round"/>'),size:200,dur:.7,drift:-46,op:.4}
    ],
    storm:"rain",
    leaves:[
      {tile:svgTile(220,220,'<path d="M30 40q10-14 22-6q-6 14-22 6z" fill="#7dff6a" opacity=".85"/><path d="M160 150q12-10 22 0q-10 12-22 0z" fill="#c2f57e" opacity=".8"/><path d="M120 60q8-12 18-4q-6 10-18 4z" fill="#52f28a" opacity=".7"/>'),size:220,dur:11,drift:120,op:.75}
    ],
    sand:[
      {tile:svgTile(160,90,'<circle cx="10" cy="20" r="1.2" fill="#ffe1a0"/><circle cx="90" cy="60" r="1" fill="#ffe1a0"/><circle cx="130" cy="14" r="1.4" fill="#ffd27a"/><circle cx="50" cy="80" r=".9" fill="#ffd27a"/>'),size:90,dur:14,drift:260,op:.7}
    ],
    petals:[
      {tile:svgTile(200,200,'<ellipse cx="40" cy="40" rx="6" ry="3.4" transform="rotate(30 40 40)" fill="#ff8fc0"/><ellipse cx="150" cy="120" rx="5" ry="3" transform="rotate(-40 150 120)" fill="#ffd0e6"/><ellipse cx="100" cy="180" rx="5.5" ry="3.2" transform="rotate(70 100 180)" fill="#ff6fae"/>'),size:200,dur:12,drift:70,op:.85},
      {tile:svgTile(260,260,'<ellipse cx="60" cy="90" rx="8" ry="4.6" transform="rotate(-20 60 90)" fill="#ffb3d1"/>'),size:260,dur:8,drift:-50,op:.6}
    ],
    stars:[]  // le ciel étoilé et les étoiles filantes sont ajoutés à part
  };
  let flashTimer=0,shootTimer=0;

  function css(){
    if(document.getElementById("dgAmbCss"))return;
    const st=document.createElement("style");st.id="dgAmbCss";
    st.textContent=
      ".dgAmb{position:absolute;inset:0;overflow:hidden;pointer-events:none}"+
      ".dgAmb .sky{position:absolute;inset:0;transition:opacity .8s}"+
      ".dgAmb .fx{position:absolute;left:-30%;right:-30%;top:-260px;bottom:-60px;will-change:transform;background-repeat:repeat}"+
      ".dgAmb .starsBg{position:absolute;inset:0;background-repeat:repeat;opacity:.9;animation:dgTw 4s ease-in-out infinite alternate}"+
      ".dgAmb .starsBg.b{animation-delay:-2s;opacity:.6}"+
      ".dgAmb .flash{position:absolute;inset:0;background:#dfe9ff;opacity:0}"+
      ".dgAmb .flash.on{animation:dgFlash .9s ease-out}"+
      ".dgAmb .shoot{position:absolute;width:140px;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,#fff);opacity:0;transform:rotate(-24deg)}"+
      ".dgAmb .shoot.on{animation:dgShoot 1.1s ease-out}"+
      ".dgAmb .fly{position:absolute;width:6px;height:6px;border-radius:50%;background:#fff6a8;box-shadow:0 0 10px 3px rgba(255,236,120,.7);animation:dgFly 7s ease-in-out infinite alternate,dgBlink 2.4s ease-in-out infinite}"+
      "@keyframes dgTw{from{opacity:.35}to{opacity:.95}}"+
      "@keyframes dgFlash{0%{opacity:0}8%{opacity:.55}16%{opacity:.1}24%{opacity:.4}100%{opacity:0}}"+
      "@keyframes dgShoot{0%{opacity:0;translate:0 0}15%{opacity:1}100%{opacity:0;translate:-320px 150px}}"+
      "@keyframes dgFly{from{translate:0 0}to{translate:var(--fx) var(--fy)}}"+
      "@keyframes dgBlink{0%,100%{opacity:.25}50%{opacity:1}}"+
      ".dgWeather #motes{display:none}"+
      "@media (prefers-reduced-motion:reduce){.dgAmb .fx,.dgAmb .fly,.dgAmb .starsBg{animation:none!important}}";
    document.head.appendChild(st);
  }
  function apply(host,opt){
    if(!host)return;
    css();
    opt=opt||{};
    const time=TIMES[opt.time]||TIMES.night;
    let box=host.querySelector(".dgAmb");
    if(box)box.remove();
    clearInterval(flashTimer);clearInterval(shootTimer);
    box=document.createElement("div");box.className="dgAmb";box.setAttribute("aria-hidden","true");
    // le ciel : visible en haut et en bas de l'écran, le plateau occupe le milieu
    const sky=document.createElement("div");sky.className="sky";
    sky.style.background="linear-gradient(180deg,"+time.top+" 0%,transparent 34%,transparent 66%,"+time.bottom+" 100%)";
    sky.style.opacity=time.veil*2.2;
    box.appendChild(sky);
    host.style.setProperty("--ambGlow",time.glow);
    const reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w=opt.weather||"none";
    // une météo qui tombe montre déjà la gravité : la poussière du décor (les petits traits) s'efface
    host.classList.toggle("dgWeather",!!(WEATHER[w]&&WEATHER[w].length||WEATHER[w]==="rain"));
    if(w==="stars"||opt.time==="night"){
      // un ciel étoilé : deux calques qui scintillent en décalé
      ["a","b"].forEach((k,i)=>{
        const s=document.createElement("div");s.className="starsBg "+k;
        s.style.backgroundImage=svgTile(i?170:110,i?170:110,i?'<circle cx="30" cy="40" r="1.2" fill="#fff"/><circle cx="120" cy="140" r=".9" fill="#cfd8ff"/>':'<circle cx="20" cy="80" r=".9" fill="#fff"/><circle cx="90" cy="20" r="1.1" fill="#fff"/><circle cx="60" cy="60" r=".7" fill="#e6ecff"/>');
        s.style.webkitMaskImage=s.style.maskImage="linear-gradient(#000 0,#000 30%,transparent 45%,transparent 70%,#000 85%)";
        box.appendChild(s);
      });
    }
    const layers=WEATHER[w]==="rain"?WEATHER.rain:(WEATHER[w]||[]);
    layers.forEach(L=>{
      const d=document.createElement("div");d.className="fx";
      d.style.backgroundImage=L.tile;d.style.opacity=L.op;
      if(L.blur)d.style.filter="blur("+L.blur+"px)";
      if(!reduce)d.animate([{transform:"translate3d(0,0,0)"},{transform:"translate3d("+L.drift+"px,"+L.size+"px,0)"}],{duration:L.dur*1000,iterations:Infinity,easing:"linear"});
      box.appendChild(d);
    });
    if(w==="storm"){
      const f=document.createElement("div");f.className="flash";box.appendChild(f);
      const strike=()=>{f.classList.remove("on");void f.offsetWidth;f.classList.add("on");if(window.DGAmbiance.onThunder)try{DGAmbiance.onThunder();}catch(e){}};
      if(!reduce)flashTimer=setInterval(()=>{if(Math.random()<.45)strike();},5200);
    }
    if(w==="stars"&&!reduce){
      const s=document.createElement("div");s.className="shoot";box.appendChild(s);
      shootTimer=setInterval(()=>{if(Math.random()<.5){s.style.left=(40+Math.random()*55)+"%";s.style.top=(4+Math.random()*16)+"%";s.classList.remove("on");void s.offsetWidth;s.classList.add("on");}},3800);
    }
    if(w==="petals"||w==="fireflies"){
      for(let i=0;i<7;i++){
        const f=document.createElement("div");f.className="fly";
        f.style.left=(5+Math.random()*90)+"%";f.style.top=(Math.random()<.5?4+Math.random()*22:72+Math.random()*24)+"%";
        f.style.setProperty("--fx",(Math.random()*80-40)+"px");f.style.setProperty("--fy",(Math.random()*60-30)+"px");
        f.style.animationDelay=(-Math.random()*7)+"s,"+(-Math.random()*2.4)+"s";
        box.appendChild(f);
      }
    }
    host.appendChild(box);
  }
  window.DGAmbiance={TIMES,CHAPTERS,WEATHER:Object.keys(WEATHER),apply,onThunder:null};
})();
