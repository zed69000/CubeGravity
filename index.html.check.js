/* retour depuis le jeu : les rubans sont déjà fermés, on les ouvrira une fois prêt */
try{if(sessionStorage.getItem("dg_tx")==="1"){sessionStorage.removeItem("dg_tx");document.documentElement.classList.add("tx-in");}}catch(e){}
;

/* ===== V49 NÉON CIRCUIT : menu principal ===== */
const PROGRESS_KEY="gravity_cube_player_progress_v2";
const PROJECT_ZIP_NAME="date_gravity_project_pc.zip";
const PROJECT_PASSWORD="Lulu69";
const overlay=document.getElementById("optionsOverlay");
const soundToggle=document.getElementById("soundToggle");
let bandColors=["#f6ff3d","#19e3ff","#0d1230"];

/* --- plein écran : demandé au premier geste, avant de quitter la page (iOS perd le geste sinon) */
const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const isStandalone=()=>window.navigator.standalone===true||window.matchMedia("(display-mode: standalone)").matches||window.matchMedia("(display-mode: fullscreen)").matches;
async function requestMenuFullscreen(showHelp=false){
  if(isStandalone())return true;
  const target=document.documentElement;
  try{
    if(target.requestFullscreen){await target.requestFullscreen({navigationUI:"hide"});return true;}
    if(target.webkitRequestFullscreen){target.webkitRequestFullscreen();return true;}
  }catch(e){console.warn("[MENU FULLSCREEN]",e);}
  if(showHelp&&isIOS())alert("Sur iPhone, pour le vrai plein écran : Partager → Sur l’écran d’accueil, puis lance Date Gravity depuis son icône.");
  return false;
}
document.getElementById("fullscreenBtn").addEventListener("click",()=>requestMenuFullscreen(true));
document.addEventListener("click",async e=>{
  const link=e.target.closest&&e.target.closest('a[href^="game.html"]');
  if(!link||e.defaultPrevented)return;
  e.preventDefault();
  playButtonSound();
  await requestMenuFullscreen(false);
  leaveTo(link.getAttribute("href"));
},true);

/* --- rubans : ils se ferment avant de partir vers le jeu, et s'ouvrent quand on en revient */
const BAND_IN=[{transform:"translateX(-130%) skewX(-18deg)"},{transform:"translateX(0) skewX(-18deg)"}];
const BAND_OUT=[{transform:"translateX(0) skewX(-18deg)"},{transform:"translateX(130%) skewX(-18deg)"}];
const reducedMotion=()=>!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
function leaveTo(url){
  const layer=document.getElementById("txLayer");
  if(!layer||reducedMotion()){window.location.href=url;return;}
  try{sessionStorage.setItem("dg_tx","1");}catch(e){}
  layer.classList.add("block");
  let last;
  bandColors.forEach((c,i)=>{
    const b=document.createElement("div");b.className="band";b.style.background=c;layer.appendChild(b);
    last=b.animate(BAND_IN,{duration:280,delay:i*60,easing:"cubic-bezier(.6,0,.4,1)",fill:"forwards"});
  });
  last.finished.then(()=>{window.location.href=url;});
}
function bootReveal(){
  const root=document.documentElement, layer=document.getElementById("txLayer");
  if(!layer||!root.classList.contains("tx-in"))return;
  let last;
  [...layer.querySelectorAll(".band.boot")].forEach((b,i)=>{last=b.animate(BAND_OUT,{duration:300,delay:60+i*60,easing:"cubic-bezier(.6,0,.4,1)",fill:"forwards"});});
  last.finished.then(()=>root.classList.remove("tx-in"));
}
// retour arrière du navigateur : la page peut revenir du cache avec les rubans fermés
window.addEventListener("pageshow",e=>{if(e.persisted){document.querySelectorAll("#txLayer .band:not(.boot)").forEach(b=>b.remove());document.getElementById("txLayer").classList.remove("block");}});

/* --- petite musique et sons du menu (Web Audio, aucun fichier) : mêmes notes pincées que les murs du jeu */
let audioCtx=null,menuMusicTimer=null,menuMusicOn=true,musicStep=0;
function getAudio(){
  if(!menuMusicOn)return null;
  if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==="suspended")audioCtx.resume().catch(()=>{});
  return audioCtx;
}
function pluck(freq,gain=.03,when=0){
  const ac=getAudio();
  if(!ac)return;
  const t=ac.currentTime+when;
  [[1,"triangle",1],[2,"sine",.32]].forEach(v=>{
    const o=ac.createOscillator(),g=ac.createGain();
    o.type=v[1];o.frequency.value=freq*v[0];
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(gain*v[2],t+.012);
    g.gain.exponentialRampToValueAtTime(.0001,t+.5);
    o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+.54);
  });
}
function playButtonSound(){pluck(523.25,.06);pluck(783.99,.05,.06);}
function playOpenSound(){pluck(392,.05);pluck(587.33,.04,.07);}
function playCloseSound(){pluck(329.63,.045);}
function startMenuMusic(){
  if(!menuMusicOn||menuMusicTimer)return;
  if(!getAudio())return;
  const bass=[130.81,130.81,146.83,130.81,98,98,110,146.83];
  const melody=[523.25,587.33,659.25,783.99,659.25,587.33,440,392];
  const tick=()=>{
    if(!menuMusicOn)return;
    const i=musicStep++%melody.length;
    pluck(bass[i],.016);
    pluck(melody[i],.012,.14);
    if(i%2)pluck(melody[(i+3)%melody.length],.007,.3);
  };
  tick();
  menuMusicTimer=setInterval(tick,480);
}
function stopMenuMusic(){if(menuMusicTimer){clearInterval(menuMusicTimer);menuMusicTimer=null;}}
function setMusicState(v){
  menuMusicOn=!!v;
  try{localStorage.setItem("dcg_menu_music_on",menuMusicOn?"1":"0");}catch(e){}
  soundToggle.textContent="♪ Musique du menu : "+(menuMusicOn?"oui":"non");
  if(menuMusicOn)startMenuMusic();else stopMenuMusic();
}
try{const saved=localStorage.getItem("dcg_menu_music_on");if(saved!==null)menuMusicOn=saved==="1";}catch(e){}
soundToggle.textContent="♪ Musique du menu : "+(menuMusicOn?"oui":"non");
["pointerdown","keydown"].forEach(evt=>window.addEventListener(evt,()=>{if(menuMusicOn)startMenuMusic();},{once:true,passive:true}));
soundToggle.addEventListener("click",()=>setMusicState(!menuMusicOn));

/* --- options */
function openOptions(){playOpenSound();overlay.classList.remove("hidden");overlay.setAttribute("aria-hidden","false");}
function closeOptions(){playCloseSound();overlay.classList.add("hidden");overlay.setAttribute("aria-hidden","true");}
document.getElementById("gearBtn").addEventListener("click",openOptions);
document.getElementById("closeOptions").addEventListener("click",closeOptions);
overlay.addEventListener("click",e=>{if(e.target===overlay)closeOptions();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!overlay.classList.contains("hidden"))closeOptions();});
document.getElementById("downloadProjectBtn").addEventListener("click",async()=>{
  playButtonSound();
  const code=window.prompt("Code d’accès pour télécharger le projet PC :");
  if(code===null)return;
  if(code!==PROJECT_PASSWORD){alert("Code incorrect.");return;}
  try{
    const res=await fetch(PROJECT_ZIP_NAME,{method:"HEAD",cache:"no-store"});
    if(!res.ok)throw new Error("missing");
    const a=document.createElement("a");
    a.href=PROJECT_ZIP_NAME+"?t="+Date.now();
    a.download=PROJECT_ZIP_NAME;
    document.body.appendChild(a);a.click();a.remove();
  }catch(err){
    alert("Fichier non disponible sur le site. Place un zip nommé '"+PROJECT_ZIP_NAME+"' à la racine du projet.");
  }
});

/* --- les personnages : moi (la flamme) et la personne du chapitre en cours, chacun en lui ou en elle */
function getStoredGender(key,fallback){
  try{const v=localStorage.getItem(key);return (v==="boy"||v==="girl")?v:fallback;}catch(e){return fallback;}
}
let meGender=getStoredGender("dcg_me_gender","boy");
let dateGender=getStoredGender("dcg_date_gender","girl");
let chapterIndex=0;
function updateMenuCharacters(){
  const person=DGSpirit.person(chapterIndex);
  document.getElementById("mePic").innerHTML=DGSpirit.portrait("flamme",meGender==="girl"?"f":"m");
  document.getElementById("datePic").innerHTML=DGSpirit.portrait(person.kind,dateGender==="boy"?"m":"f");
  document.getElementById("meCap").textContent=(meGender==="girl"?"elle":"lui")+" · changer ↻";
  document.getElementById("dateName").textContent=person.name;
  document.getElementById("dateCap").textContent=(dateGender==="boy"?"lui":"elle")+" · changer ↻";
}
document.getElementById("meChoice").addEventListener("click",()=>{
  meGender=meGender==="boy"?"girl":"boy";
  try{localStorage.setItem("dcg_me_gender",meGender);}catch(e){}
  playOpenSound();updateMenuCharacters();
});
document.getElementById("dateChoice").addEventListener("click",()=>{
  dateGender=dateGender==="boy"?"girl":"boy";
  try{localStorage.setItem("dcg_date_gender",dateGender);}catch(e){}
  playOpenSound();updateMenuCharacters();
});

/* --- où reprendre, cœurs gagnés, rencontres faites : lus dans la sauvegarde du jeu */
async function showResume(){
  let pr={};
  try{pr=JSON.parse(localStorage.getItem(PROGRESS_KEY)||"{}")||{};}catch(e){}
  const best=pr.best||{};
  document.getElementById("starChip").textContent="♥ "+Object.values(best).reduce((n,b)=>n+(Number(b&&b.stars)||0),0);
  const line=document.getElementById("resumeLine");
  try{
    const res=await fetch("levels.json?v="+Date.now(),{cache:"no-store"});
    const data=await res.json();
    const levels=data.levels||[], chapters=data.chapters||[];
    let idx=levels.findIndex(l=>l.id===pr.current);
    const started=idx>=0||Object.keys(best).length>0;
    if(idx<0)idx=0;
    const chId=levels[idx].chapter;
    chapterIndex=Math.max(0,chapters.findIndex(c=>c.id===chId));
    const pos=levels.slice(0,idx+1).filter(l=>l.chapter===chId).length;
    line.textContent=(started?"reprendre · ":"")+"chapitre "+(chapterIndex+1)+", niveau "+pos;
    const met=new Set(levels.filter(l=>best[l.id]).map(l=>l.chapter)).size;
    document.getElementById("metCount").textContent=met+"/"+chapters.length;
    // le menu prend les couleurs du chapitre en cours
    const w=DGSpirit.WORLDS[chapterIndex%DGSpirit.WORLDS.length];
    document.documentElement.style.setProperty("--c1",w[0]);
    document.documentElement.style.setProperty("--c2",w[1]);
    bandColors=[w[0],w[1],"#0d1230"];
  }catch(e){
    line.textContent="chapitre 1, niveau 1";
  }
  updateMenuCharacters();
}

updateMenuCharacters();
showResume().then(bootReveal,bootReveal);
