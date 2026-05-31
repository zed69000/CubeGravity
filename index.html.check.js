
const overlay=document.getElementById("optionsOverlay");
const soundToggle=document.getElementById("soundToggle");
const soundHint=document.getElementById("soundHint");

let audioCtx=null;
let menuMusicTimer=null;
let menuMusicOn=true;
let audioUnlocked=false;
let musicStep=0;

function getAudio(){
  if(!menuMusicOn)return null;
  if(!audioCtx){
    audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  }
  if(audioCtx.state==="suspended"){
    audioCtx.resume().catch(()=>{});
  }
  audioUnlocked=true;
  return audioCtx;
}

function beep(freq=440,dur=.08,type="sine",gain=.04){
  const ac=getAudio();
  if(!ac)return;
  const o=ac.createOscillator();
  const g=ac.createGain();
  const f=ac.createBiquadFilter();
  o.type=type;
  o.frequency.setValueAtTime(freq,ac.currentTime);
  f.type="lowpass";
  f.frequency.setValueAtTime(1450,ac.currentTime);
  g.gain.setValueAtTime(Math.max(.0001,gain),ac.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+dur);
  o.connect(f);
  f.connect(g);
  g.connect(ac.destination);
  o.start();
  o.stop(ac.currentTime+dur+.02);
}

function playButtonSound(){
  beep(740,.045,"triangle",.035);
  setTimeout(()=>beep(980,.05,"sine",.018),45);
}

function playOpenSound(){
  beep(420,.07,"triangle",.03);
  setTimeout(()=>beep(640,.08,"sine",.02),70);
}

function playCloseSound(){
  beep(330,.07,"triangle",.025);
}

function startMenuMusic(){
  if(!menuMusicOn || menuMusicTimer)return;
  const ac=getAudio();
  if(!ac)return;
  const bass=[196,196,220,196,174.61,174.61,196,220];
  const melody=[392,440,493.88,440,392,349.23,392,440];
  const tick=()=>{
    if(!menuMusicOn)return;
    const i=musicStep++%melody.length;
    beep(bass[i],.42,"sine",.006);
    setTimeout(()=>beep(melody[i],.16,"triangle",.009),90);
    setTimeout(()=>beep(melody[(i+2)%melody.length],.14,"sine",.0045),260);
  };
  tick();
  menuMusicTimer=setInterval(tick,560);
}

function stopMenuMusic(){
  if(menuMusicTimer){
    clearInterval(menuMusicTimer);
    menuMusicTimer=null;
  }
}

function setMusicState(v){
  menuMusicOn=!!v;
  localStorage.setItem("dcg_menu_music_on",menuMusicOn?"1":"0");
  soundToggle.textContent=menuMusicOn?"♪ Musique menu : ON":"♪ Musique menu : OFF";
  soundHint.textContent=menuMusicOn?"♪ Menu":"♪ Off";
  if(menuMusicOn)startMenuMusic();
  else stopMenuMusic();
}

try{
  const saved=localStorage.getItem("dcg_menu_music_on");
  if(saved!==null)menuMusicOn=saved==="1";
}catch(e){}

setMusicState(menuMusicOn);

["pointerdown","mousedown","touchstart","keydown"].forEach(evt=>{
  window.addEventListener(evt,()=>{
    if(menuMusicOn)startMenuMusic();
  },{once:true,passive:true});
});

document.querySelectorAll(".jsReactive").forEach(el=>{
  const press=()=>{
    el.classList.add("isPressed");
    if(el.tagName!=="A")playButtonSound();
  };
  const release=()=>el.classList.remove("isPressed");
  el.addEventListener("pointerdown",press);
  el.addEventListener("mousedown",press);
  el.addEventListener("touchstart",press,{passive:true});
  el.addEventListener("pointerup",release);
  el.addEventListener("pointercancel",release);
  el.addEventListener("mouseleave",release);
  el.addEventListener("mouseup",release);
  el.addEventListener("touchend",release);
  el.addEventListener("click",()=>{
    if(menuMusicOn)startMenuMusic();
    if(el.tagName==="A")playButtonSound();
  });
});

document.getElementById("openOptions").addEventListener("click",()=>{
  playOpenSound();
  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden","false");
});
document.getElementById("closeOptions").addEventListener("click",()=>{
  playCloseSound();
  overlay.classList.remove("show");
  overlay.setAttribute("aria-hidden","true");
});
soundToggle.addEventListener("click",()=>{
  setMusicState(!menuMusicOn);
});
overlay.addEventListener("click",e=>{
  if(e.target===overlay){
    playCloseSound();
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden","true");
  }
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden","true");
  }
});

const SVG_NS="http://www.w3.org/2000/svg";

function svgEl(tag,attrs={}){
  const e=document.createElementNS(SVG_NS,tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if(v!==undefined && v!==null && v!=="") e.setAttribute(k,String(v));
  });
  return e;
}

function layerOpacity(layer){
  if(layer.visible===false)return 0;
  if(layer.opacity===undefined || layer.opacity===null)return 1;
  return Number(layer.opacity);
}

function normalizeStroke(v){
  return (!v || v==="transparent" || v==="rgba(0,0,0,0)") ? "none" : v;
}

function applyCommon(el,layer){
  el.setAttribute("fill",layer.fill || "none");
  el.setAttribute("stroke",normalizeStroke(layer.stroke));
  if(layer.strokeWidth!==undefined)el.setAttribute("stroke-width",String(layer.strokeWidth));
  const op=layerOpacity(layer);
  if(op!==1)el.setAttribute("opacity",String(op));

  const px=Number(layer.pivotX ?? 20);
  const py=Number(layer.pivotY ?? 20);
  const tx=Number(layer.tx ?? 0);
  const ty=Number(layer.ty ?? 0);
  const sx=Number(layer.scaleX ?? 1);
  const sy=Number(layer.scaleY ?? 1);
  const rot=Number(layer.rotation ?? layer.rot ?? 0);
  const transforms=[];
  if(tx||ty)transforms.push(`translate(${tx} ${ty})`);
  if(rot)transforms.push(`rotate(${rot} ${px} ${py})`);
  if(sx!==1 || sy!==1)transforms.push(`translate(${px} ${py}) scale(${sx} ${sy}) translate(${-px} ${-py})`);
  if(transforms.length)el.setAttribute("transform",transforms.join(" "));
  return el;
}

function pointsToString(points){
  return (points||[]).map(p=>`${Number(p[0])},${Number(p[1])}`).join(" ");
}

function makePathD(points){
  if(!points || !points.length)return "";
  const first=points[0];
  let d=`M ${Number(first[0])} ${Number(first[1])}`;
  for(let i=1;i<points.length;i++)d+=` L ${Number(points[i][0])} ${Number(points[i][1])}`;
  return d;
}

function drawLayer(layer){
  if(!layer || layer.visible===false)return null;
  const shape=layer.shape;
  let el=null;

  if(shape==="rect"){
    el=svgEl("rect",{
      x:layer.x ?? 0,
      y:layer.y ?? 0,
      width:layer.w ?? layer.width ?? 1,
      height:layer.h ?? layer.height ?? 1,
      rx:layer.rx ?? 0,
      ry:layer.ry ?? layer.rx ?? 0
    });
  }else if(shape==="circle"){
    el=svgEl("circle",{
      cx:layer.cx ?? layer.x ?? 20,
      cy:layer.cy ?? layer.y ?? 20,
      r:layer.r ?? 1
    });
  }else if(shape==="ellipse"){
    el=svgEl("ellipse",{
      cx:layer.cx ?? layer.x ?? 20,
      cy:layer.cy ?? layer.y ?? 20,
      rx:layer.rx ?? layer.w ?? 1,
      ry:layer.ry ?? layer.h ?? 1
    });
  }else if(shape==="polygon"){
    el=svgEl("polygon",{points:pointsToString(layer.points)});
  }else if(shape==="path"){
    const d=layer.d || makePathD(layer.points);
    if(!d)return null;
    el=svgEl("path",{d});
  }else if(shape==="line"){
    el=svgEl("line",{
      x1:layer.x1 ?? layer.x ?? 0,
      y1:layer.y1 ?? layer.y ?? 0,
      x2:layer.x2 ?? 40,
      y2:layer.y2 ?? 40
    });
  }else if(shape==="text"){
    el=svgEl("text",{
      x:layer.x ?? 20,
      y:layer.y ?? 20,
      "font-size":layer.fontSize ?? 16,
      "font-weight":layer.fontWeight ?? 900,
      "text-anchor":layer.textAnchor ?? "middle",
      "font-family":layer.fontFamily ?? "Arial, sans-serif"
    });
    el.textContent=layer.text || "";
  }

  if(!el)return null;
  return applyCommon(el,layer);
}


let menuVectorPack=null;
const CHARACTER_KEYS={
  me:{boy:"player_boy",girl:"player_girl",fallback:"player"},
  date:{boy:"date_boy",girl:"date_girl",fallback:"destination"}
};
const CHARACTER_LABELS={boy:"garçon",girl:"fille"};

function getStoredGender(key, fallback){
  try{
    const v=localStorage.getItem(key);
    return (v==="boy"||v==="girl") ? v : fallback;
  }catch(e){return fallback;}
}
function setStoredGender(key,value){
  try{localStorage.setItem(key,value);}catch(e){}
}
function toggleGender(value){return value==="boy" ? "girl" : "boy";}

let meGender=getStoredGender("dcg_me_gender","boy");
let dateGender=getStoredGender("dcg_date_gender","girl");

async function loadMenuVectorPack(){
  const candidates=["vector_assets_runtime.json","./vector_assets_runtime.json","vector_assets.json","./vector_assets.json"];
  for(const path of candidates){
    try{
      const res=await fetch(path+"?v="+Date.now(),{cache:"no-store"});
      if(!res.ok)continue;
      const data=await res.json();
      if(data?.assets){
        menuVectorPack=data;
        console.log("[MAINMENU] vector assets loaded from",path);
        return data;
      }
    }catch(err){console.warn("[MAINMENU] vector asset failed",path,err);}
  }
  return null;
}

function menuAsset(role,gender){
  const keys=CHARACTER_KEYS[role];
  const wanted=keys?.[gender];
  if(menuVectorPack?.assets?.[wanted])return wanted;
  if(menuVectorPack?.assets?.[keys?.fallback])return keys.fallback;
  return null;
}

function drawMenuAsset(svgId,fallbackId,assetName,flip=false){
  const svg=document.getElementById(svgId);
  const fallback=document.getElementById(fallbackId);
  if(!svg || !fallback)return;
  const asset=assetName ? menuVectorPack?.assets?.[assetName] : null;
  const layers=asset?.layers;
  svg.innerHTML="";
  if(Array.isArray(layers) && layers.length){
    const root=svgEl("g", flip?{transform:"translate(40 0) scale(-1 1)"}:{});
    layers.forEach(layer=>{
      const el=drawLayer(layer);
      if(el)root.appendChild(el);
    });
    svg.appendChild(root);
    svg.classList.remove("assetHidden");
    fallback.classList.add("assetHidden");
  }else{
    svg.classList.add("assetHidden");
    fallback.classList.remove("assetHidden");
  }
}

function updateMenuCharacters(){
  const meAsset=menuAsset("me",meGender);
  const dateAsset=menuAsset("date",dateGender);
  drawMenuAsset("meChoiceSvg","meChoiceFallback",meAsset,false);
  drawMenuAsset("dateChoiceSvg","dateChoiceFallback",dateAsset,true);
  const meHint=document.getElementById("meChoiceHint");
  const dateHint=document.getElementById("dateChoiceHint");
  if(meHint)meHint.textContent=CHARACTER_LABELS[meGender]||meGender;
  if(dateHint)dateHint.textContent=CHARACTER_LABELS[dateGender]||dateGender;
}

async function initMenuCharacters(){
  await loadMenuVectorPack();
  updateMenuCharacters();
}

const meChoiceBtn=document.getElementById("meChoice");
const dateChoiceBtn=document.getElementById("dateChoice");
if(meChoiceBtn)meChoiceBtn.addEventListener("click",()=>{
  meGender=toggleGender(meGender);
  setStoredGender("dcg_me_gender",meGender);
  playOpenSound();
  updateMenuCharacters();
});
if(dateChoiceBtn)dateChoiceBtn.addEventListener("click",()=>{
  dateGender=toggleGender(dateGender);
  setStoredGender("dcg_date_gender",dateGender);
  playOpenSound();
  updateMenuCharacters();
});

initMenuCharacters();
