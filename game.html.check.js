window.CG_EDITOR_MODE=new URLSearchParams(location.search).get("editor")==="1";document.documentElement.classList.toggle("editor-enabled",window.CG_EDITOR_MODE);
;
/* arrivée depuis une autre page du jeu : les rubans sont déjà fermés, on les ouvrira une fois prêt */
try{if(sessionStorage.getItem("dg_tx")==="1"){sessionStorage.removeItem("dg_tx");document.documentElement.classList.add("tx-in");}}catch(e){}
;

const BOARD=520; let W=11,H=11,T=BOARD/W,HALF=T/2;

function clampGridSize(v){
  v=parseInt(v,10);
  if(!Number.isFinite(v)) return 11;
  return Math.max(7, Math.min(15, v));
}
function setBoardSize(size){
  W=clampGridSize(size);
  H=W;
  T=BOARD/W;
  HALF=T/2;
}
function levelGridSize(level){
  return clampGridSize(level?.gridSize || gameSettings?.gridSize || 11);
}
function setBoardSizeFromLevel(level){
  setBoardSize(levelGridSize(level));
}
function getLevelContentBounds(rows){
  rows=(rows||[]).map(r=>String(r));
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,count=0;
  for(let y=0;y<rows.length;y++){
    const row=rows[y]||"";
    for(let x=0;x<row.length;x++){
      const ch=row[x];
      if(ch && ch!=="."){
        minX=Math.min(minX,x); minY=Math.min(minY,y);
        maxX=Math.max(maxX,x); maxY=Math.max(maxY,y);
        count++;
      }
    }
  }
  if(!count)return null;
  return {minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1,count};
}

function resizeCurrentLevelTo(size){
  const lvl=levels[currentLevel];
  if(!lvl) return;
  const oldMap=map();
  const target=clampGridSize(size);
  const bounds=getLevelContentBounds(oldMap);

  // V43.10 : réduction non destructive. Si le contenu ne rentre pas dans la
  // nouvelle grille, on refuse au lieu d'effacer des blocs en silence. Oui,
  // c'est fou, un outil d'édition qui ne mange pas le niveau.
  if(bounds && (bounds.width>target || bounds.height>target)){
    const input=document.getElementById("gridSizeInput");
    if(input) input.value=W;
    setStatus("Grille trop petite : le contenu actuel occupe "+bounds.width+"×"+bounds.height+". Réduction annulée pour ne supprimer aucun bloc.");
    return;
  }

  lvl.gridSize=target;
  setBoardSizeFromLevel(lvl);
  lvl.map=normalizeLevelMapSize(oldMap);
  baseMap=arr(lvl.map);
  normalize();
  lvl.map=map();
  const input=document.getElementById("gridSizeInput");
  if(input) input.value=W;
  resetPlay();
  setStatus("Grille niveau : "+W+"×"+H+". Redimensionnement centré sans suppression de blocs.");
}


function normalizeLevelMapSize(map){
  const targetW=W,targetH=H;
  const rows=(map||[]).map(r=>String(r));
  if(rows.length===targetH && rows.every(r=>r.length===targetW)) return rows;

  const out=Array.from({length:targetH},()=>Array(targetW).fill("."));
  const oldH=rows.length;
  const oldW=Math.max(0,...rows.map(r=>r.length));

  // V43.9 : resize centré sur le CONTENU utile, pas sur l'origine [0,0].
  // Avant, un +1 finissait soit accroché haut-gauche, soit poussé bas-droite.
  // Ici on prend la bounding box des tuiles non vides et on la recale au centre
  // de la nouvelle grille. Si on réduit trop, on croppe symétriquement autour du centre.
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(let y=0;y<oldH;y++){
    const row=rows[y]||"";
    for(let x=0;x<row.length;x++){
      const ch=row[x];
      if(ch && ch!=="."){
        minX=Math.min(minX,x); minY=Math.min(minY,y);
        maxX=Math.max(maxX,x); maxY=Math.max(maxY,y);
      }
    }
  }

  // Niveau vide : on garde une grille propre, inutile de déplacer le néant avec précision.
  if(!Number.isFinite(minX)) return out.map(r=>r.join(""));

  const contentW=maxX-minX+1;
  const contentH=maxY-minY+1;
  const dstMinX=Math.floor((targetW-contentW)/2);
  const dstMinY=Math.floor((targetH-contentH)/2);

  for(let y=minY;y<=maxY;y++){
    const row=rows[y]||"";
    for(let x=minX;x<=maxX;x++){
      const ch=row[x];
      if(!ch || ch===".") continue;
      const nx=(x-minX)+dstMinX;
      const ny=(y-minY)+dstMinY;
      if(nx<0 || nx>=targetW || ny<0 || ny>=targetH) continue;
      if(out[ny][nx]===".") out[ny][nx]=ch;
    }
  }
  return out.map(r=>r.join(""));
}

const grid=document.getElementById("grid"),rot=document.getElementById("rot"),stage=document.getElementById("stage"),svg=document.querySelector(".boardWrap svg");
const modeLabel=document.getElementById("modeLabel"),status=document.getElementById("status"),tool=document.getElementById("tool");
const editPanel=document.getElementById("editPanel"),levelNameInput=document.getElementById("levelName"),playStats=document.getElementById("playStats");
const banner=document.getElementById("banner"),bannerTitle=document.getElementById("bannerTitle"),bannerText=document.getElementById("bannerText"),starsEl=document.getElementById("stars"),bannerAction=document.getElementById("bannerAction");

let levels=[];
const GAME_VERSION="V49-neon-circuit";
setTimeout(()=>{const v=document.getElementById("gameVersionBadge"); if(v)v.textContent=GAME_VERSION;},0);
let gameSettings={fallDelayMs:135,rotationDurationMs:320};

let currentLevel=0,baseMap=[],b=[],p={x:0,y:0},start={x:0,y:0},exit={x:0,y:0};
let door=false,busy=false,edit=!!window.CG_EDITOR_MODE,moves=0,gameOver=false,confettiTimer=null,deadPlayer=false,idleTick=0,painting=false,lastPaintKey='',visualOri=0,soundOn=true,sfxOn=true,musicOn=true,audioCtx=null,rotatorCooldown=false,teleporterCooldownType=null,gamePaused=false;
let playerTrail=[]; // V43.18 : afterimages visuels pendant la chute, sans effet gameplay.
let eternalFallWraps=0,elevatorMusicTimer=null,elevatorMusicStarted=false,bgMusic=null,musicSourceNode=null,musicGainNode=null;
const BG_MUSIC_PATH="audio/music/Petals_in_Perfect_Order.mp3";
// V43.31 : audio protégé iPhone.
 // Musique MP3 routée dans WebAudio GainNode si possible, car iOS ignore parfois HTMLAudioElement.volume.
 // SFX = volume WebAudio global multiplié par un boost maître.
const DEFAULT_MUSIC_VOLUME=0.15;
const DEFAULT_SFX_VOLUME=0.30;
const SFX_GAIN_BOOST=10.0;
const SFX_MAX_GAIN=0.95;
let musicVolume=DEFAULT_MUSIC_VOLUME;
let sfxVolume=DEFAULT_SFX_VOLUME;
let activeSwitchKey=null;
let activeSwitchHeld=false;

function E(n,a){let e=document.createElementNS("http://www.w3.org/2000/svg",n);for(let k in a)e.setAttribute(k,a[k]);return e}
function rect(x,y,w,h,f,s,sw=4){grid.appendChild(E("rect",{x,y,width:w,height:h,fill:f,stroke:s,"stroke-width":sw,"pointer-events":"none"}))}
function text(x,y,t,f,sz=22){let a=E("text",{x,y,fill:f,"font-size":sz,"font-weight":900,"text-anchor":"middle","font-family":"Rubik,Arial,sans-serif","pointer-events":"none"});a.textContent=t;grid.appendChild(a)}


function arr(map){return normalizeLevelMapSize(map).map(r=>r.split(""))}
function map(){return baseMap.map(r=>r.join(""))}

function normalize(){
  let foundA=false,foundB=false;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(baseMap[y][x]=="A"){if(foundA)baseMap[y][x]=".";foundA=true;start={x,y}}
    if(baseMap[y][x]=="B"){if(foundB)baseMap[y][x]=".";foundB=true;exit={x,y}}
  }
  if(!foundA){baseMap[1][1]="A";start={x:1,y:1}}
  if(!foundB){baseMap[H-2][W-2]="B";exit={x:W-2,y:H-2}}
}

function clampNum(v,min,max,fallback){
  v=parseInt(v,10);
  if(!Number.isFinite(v))return fallback;
  return Math.max(min,Math.min(max,v));
}
function getFallDelayMs(){
  return clampNum(gameSettings.fallDelayMs,60,500,135);
}
function getRotationDurationMs(){
  return clampNum(gameSettings.rotationDurationMs,120,1000,320);
}
function syncSpeedInputs(){
  const f=document.getElementById("fallDelayInput");
  const r=document.getElementById("rotationDurationInput");
  if(f)f.value=getFallDelayMs();
  if(r)r.value=getRotationDurationMs();
}
function writeGlobalSettingsFromInputs(){
  const f=document.getElementById("fallDelayInput");
  const r=document.getElementById("rotationDurationInput");
  gameSettings.fallDelayMs=clampNum(f?.value,60,500,135);
  gameSettings.rotationDurationMs=clampNum(r?.value,120,1000,320);
}

function writeCurrentLevel(){
  normalize();
  levels[currentLevel].map=map();
  levels[currentLevel].name=levelNameInput.value.trim()||("Level "+(currentLevel+1));
  levels[currentLevel].biome=document.getElementById("biomeSelect").value||"cosmic";
  levels[currentLevel].difficulty=parseInt(document.getElementById("difficultyInput").value||levels[currentLevel].difficulty||1,10);
  levels[currentLevel].maxMoves=parseInt(levels[currentLevel].maxMoves||999,10);
  const gsi=document.getElementById("gridSizeInput");
  levels[currentLevel].gridSize=clampGridSize(gsi?.value || W || 11);
  writeGlobalSettingsFromInputs();
}
function loadFromLevel(idx){
  currentLevel=Math.max(0,Math.min(levels.length-1,idx));
  if(!levels[currentLevel].gridSize)levels[currentLevel].gridSize=11;
  setBoardSizeFromLevel(levels[currentLevel]);
  levels[currentLevel].map=normalizeLevelMapSize(levels[currentLevel].map);
  baseMap=arr(levels[currentLevel].map);
  levelNameInput.value=levels[currentLevel].name||("Level "+(currentLevel+1)); if(!levels[currentLevel].difficulty)levels[currentLevel].difficulty=1; document.getElementById("difficultyInput").value=levels[currentLevel].difficulty; const gsi=document.getElementById("gridSizeInput"); if(gsi)gsi.value=levels[currentLevel].gridSize||11; updateLockUI();
  if(!levels[currentLevel].biome)levels[currentLevel].biome=localStorage.getItem("gravity_cube_biome")||"cosmic";
  document.getElementById("biomeSelect").value=levels[currentLevel].biome;
  syncSpeedInputs();
  applyBiomeVisual(levels[currentLevel].biome);
  normalize(); resetPlay();
  scheduleCompanion(true);
}
function baseDoorOpen(){
  // La porte ouverte est maintenant une tuile O, pas un booléen planqué dans un coin. Civilisation.
  return false;
}
let fallToken=0;
function resetPlay(){
  if(moves>0&&!(gameOver&&!deadPlayer&&p.x===exit.x&&p.y===exit.y))dgHelpFail();
  fallToken++;
  setBoardSizeFromLevel(levels[currentLevel]);
  normalize();
  levels[currentLevel].map=map();
  b=arr(levels[currentLevel].map);
  door=baseDoorOpen();
  dgFallAnim=null;dgImpact=null;dgRot=null;dgMelody=[];dgQueue=[];dgWhoosh(0);
  moves=0;busy=false;gameOver=false;deadPlayer=false;rotatorCooldown=false;teleporterCooldownType=null;eternalFallWraps=0;gamePaused=false;activeSwitchKey=null;activeSwitchHeld=false;resetPlayerTrail();hideBanner();
  rot.setAttribute("transform",`rotate(0 ${BOARD/2} ${BOARD/2})`);visualOri=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(b[y][x]=="A"){p={x,y};start={x,y};b[y][x]="."}
    if(b[y][x]=="B")exit={x,y}
  }
  draw(); updateStats();
  if(!edit){if(musicOn)startElevatorMusic();busy=true;const token=fallToken;setTimeout(()=>{if(token===fallToken)fall();},getFallDelayMs());scheduleCompanion(false)}
}

function updateStats(){
  const l=levels[currentLevel];
  if(!l)return;
  const info=dgLevelPos(currentLevel);
  const titleEl=document.getElementById("title");
  titleEl.textContent="";
  const nameEl=document.createElement("span");
  nameEl.textContent=l.name||("Niveau "+info.pos);
  titleEl.appendChild(nameEl);

  const sub=document.createElement("small");
  sub.textContent="chapitre "+info.number+" · niveau "+info.pos;
  titleEl.appendChild(sub);
  const max=Number(l.maxMoves)||0;
  const html="<b"+(moves?' class="pop"':"")+">"+moves+"</b><span>/ "+(max||"?")+"</span><em>coups</em>";
  playStats.classList.toggle("over",max>0&&moves>max);
  playStats.innerHTML=html;
  dgTint(info.ci);
  if(!dgTutoActive)dgSetReact(dgReactLine(),false);
}

function isLocked(){return !!levels[currentLevel].locked}
function updateLockUI(){
  const b=document.getElementById("lockLevel");
  if(!b)return;
  b.textContent=isLocked()?"🔒 Locked":"🔓 Lock";
  b.className=isLocked()?"locked":"";
}
function toggleLock(){
  levels[currentLevel].locked=!levels[currentLevel].locked;
  updateLockUI();
  status.textContent=isLocked()?"Niveau protégé. Déverrouille pour modifier.":"Niveau déverrouillé.";
}
function ensureAudio(){
  if(!soundOn)return null;
  if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==="suspended")audioCtx.resume().catch(()=>{});
  return audioCtx;
}

function ensureMusicRouting(){
  if(!bgMusic)return null;
  const ac=ensureAudio();
  if(!ac)return null;

  if(!musicGainNode){
    musicGainNode=ac.createGain();
    musicGainNode.connect(ac.destination);
  }

  if(!musicSourceNode){
    try{
      musicSourceNode=ac.createMediaElementSource(bgMusic);
      musicSourceNode.connect(musicGainNode);
      bgMusic.volume=1;
    }catch(e){
      // Si le navigateur refuse la route WebAudio, on garde le fallback HTMLAudioElement.volume.
      console.warn("[AUDIO] routing musique WebAudio impossible, fallback HTML volume", e);
    }
  }

  return musicGainNode;
}
function clamp01(v){return Math.max(0,Math.min(1,Number(v)||0));}
function percent(v){return Math.round(clamp01(v)*100);}
function syncAudioSliders(){
  const ml=document.getElementById("musicVolumeLabel");
  const sl=document.getElementById("sfxVolumeLabel");
  const ms=document.getElementById("musicVolumeSlider");
  const ss=document.getElementById("sfxVolumeSlider");
  if(ml)ml.textContent=percent(musicVolume)+"%";
  if(sl)sl.textContent=percent(sfxVolume)+"%";
  if(ms && document.activeElement!==ms)ms.value=String(percent(musicVolume));
  if(ss && document.activeElement!==ss)ss.value=String(percent(sfxVolume));
}
function applyAudioVolumes(){
  musicVolume=clamp01(musicVolume);
  sfxVolume=clamp01(sfxVolume);

  const targetMusicVolume=(soundOn && musicOn) ? musicVolume : 0;

  if(bgMusic){
    if(musicGainNode && audioCtx){
      try{
        musicGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        musicGainNode.gain.setTargetAtTime(targetMusicVolume,audioCtx.currentTime,0.025);
        // Quand la musique passe par WebAudio, le volume HTML reste à 1.
        // Le vrai contrôle est musicGainNode.gain. Oui, iOS mérite une petite laisse.
        bgMusic.volume=1;
      }catch(e){
        bgMusic.volume=targetMusicVolume;
      }
    }else{
      bgMusic.volume=targetMusicVolume;
    }
  }

  syncAudioSliders();
}
function beep(freq=440,dur=.08,type="square",gain=.04,kind="sfx"){
  if(kind==="sfx" && (!soundOn || !sfxOn || sfxVolume<=0))return;
  if(kind==="music" && (!soundOn || !musicOn || musicVolume<=0))return;
  const ac=ensureAudio(); if(!ac)return;
  const o=ac.createOscillator(), g=ac.createGain(), f=ac.createBiquadFilter();
  o.type=type; o.frequency.value=freq;
  f.type="lowpass"; f.frequency.value=kind==="music"?1200:4200;
  const baseVolume = kind==="music" ? musicVolume : sfxVolume;
  const boost = kind==="sfx" ? SFX_GAIN_BOOST : 1;
  const maxGain = kind==="sfx" ? SFX_MAX_GAIN : 0.18;
  const finalGain=Math.max(0.0001,Math.min(maxGain,gain*baseVolume*boost));
  g.gain.setValueAtTime(finalGain,ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+Math.max(.02,dur));
  o.connect(f); f.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+dur);
}
function startElevatorMusic(){
  if(!soundOn || !musicOn || gamePaused || edit || gameOver)return;
  if(!bgMusic){
    bgMusic=new Audio(BG_MUSIC_PATH);
    bgMusic.loop=true;
    bgMusic.preload="auto";
    bgMusic.playsInline=true;
  }
  ensureMusicRouting();
  applyAudioVolumes();
  if(!bgMusic.paused)return;
  elevatorMusicStarted=true;
  bgMusic.play().catch(()=>{elevatorMusicStarted=false;});
}
function stopElevatorMusic(){
  if(elevatorMusicTimer){clearInterval(elevatorMusicTimer);elevatorMusicTimer=null;}
  elevatorMusicStarted=false;
  if(bgMusic)bgMusic.pause();
}
function updatePauseButtons(){
  const a=document.getElementById("pauseSfxToggle"),m=document.getElementById("pauseMusicToggle"),e=document.getElementById("soundToggle");
  if(a)a.textContent=sfxOn?"SFX ON":"SFX OFF";
  if(m)m.textContent=musicOn?"Music ON":"Music OFF";
  if(e)e.textContent=(soundOn&&sfxOn&&musicOn)?"🔊 Son":"🔈 Son";
}
function setPaused(v){
  gamePaused=!!v;
  const menu=document.getElementById("pauseMenu");
  if(menu)menu.classList.toggle("hidden",!gamePaused);
  if(gamePaused)stopElevatorMusic(); else if(!edit&&!gameOver)startElevatorMusic();
}
function soundRotate(d){
  // discret : la mélodie, ce sont les murs qui la jouent
  beep(d>0?330:294,.05,"sine",.012,"sfx");
}

function soundCrash(){beep(110,.14,"triangle",.026,"sfx");setTimeout(()=>beep(82,.18,"sine",.018,"sfx"),90)}
function soundLose(){beep(330,.16,"triangle",.026,"sfx");setTimeout(()=>beep(294,.18,"triangle",.022,"sfx"),170);setTimeout(()=>beep(247,.34,"sine",.018,"sfx"),350)}
function soundDoor(){beep(180,.045,"square",.024,"sfx");setTimeout(()=>beep(420,.10,"triangle",.024,"sfx"),60);}
function soundEternalFall(){beep(150,.14,"triangle",.025,"sfx");setTimeout(()=>beep(120,.20,"sine",.020,"sfx"),150);setTimeout(()=>beep(98,.28,"sine",.016,"sfx"),330)}
function userAudioGesture(){
  ensureAudio();
  // Ne jamais appeler bgMusic.load() ici : sur mobile, chaque rotation déclenche userAudioGesture(),
  // et load() remet le MP3 au début / provoque une coupure. La musique doit survivre aux rotations.
  if(musicOn && !gamePaused && !edit && !gameOver)startElevatorMusic();
}
function toggleSound(){
  soundOn=!soundOn; sfxOn=soundOn; musicOn=soundOn;
  updatePauseButtons();
  if(soundOn){userAudioGesture();status.textContent="Son activé.";}else{stopElevatorMusic();status.textContent="Son coupé.";}
}

function hideBanner(){
  banner.classList.add("hidden");
  banner.classList.remove("lose");
  document.getElementById("winScreen").classList.add("hidden");
  stopConfetti();
}

function showBanner(title,msg,stars,kind){
  hideCompanion(false);stopElevatorMusic();
  const level=currentLevel, token=fallToken;
  const stillThere=()=>gameOver&&level===currentLevel&&token===fallToken; // le joueur a pu relancer pendant le tampon
  if(kind==="win"||kind==="final"){
    const ch=dgChapterOfLevel(currentLevel);
    const chapterDone=!!ch&&ch.levelIds[ch.levelIds.length-1]===currentLevel;
    dgTampon(kind==="final"||chapterDone?"BRAVO !":"MATCH !",()=>{if(stillThere())dgShowWin(kind,msg);});
    return;
  }
  // défaite : le date fait la tête, on propose de réessayer ou de voir la solution
  dgTampon("OUPS !",()=>{
    if(!stillThere())return;
    dgPortrait("bannerArt",dgCurPerson().kind,dgDateSex(),{eye:"sad",mouth:"sad"});
    bannerTitle.textContent=title;
    bannerText.textContent=msg;
    starsEl.textContent="";
    bannerAction.textContent="Réessayer";
    bannerAction.onclick=()=>resetPlay();
    const alt=document.getElementById("bannerAlt");
    alt.innerHTML=levels[currentLevel]?.solution?'💡 Voir la solution<span class="adtag">PUB</span>':"";
    alt.onclick=()=>dgRequestSolution();
    banner.classList.add("lose");
    banner.classList.remove("hidden");
  },true);
}
function starScore(){
  const max=levels[currentLevel].maxMoves||999;
  if(moves<=max)return 3;
  if(moves<=max+2)return 2;
  if(moves<=max+4)return 1;
  return 0;
}


/* ===== V67 VECTOR ASSET RUNTIME ===== */
let vectorAssetPack=null;



function validateVectorAssetsData(data){
  if(!data || !data.assets)throw new Error("vector_assets.json invalide : assets manquant");
  // les personnages (spirits.js) et les murs (tubes) sont dessinés par le jeu : seuls les blocs viennent du fichier
  const required=["button_off","button_on","block_up","block_down","danger","rotator_left","rotator_right","teleporter_1","teleporter_2","teleporter_3"];
  const missing=required.filter(k=>!data.assets[k]);
  if(missing.length)throw new Error("vector_assets.json incomplet : "+missing.join(", "));
  return true;
}

async function loadVectorAssets(){
  setLoadingText("Chargement vector_assets_runtime.json…");
  const candidates=["./vector_assets_runtime.json","vector_assets_runtime.json","/vector_assets_runtime.json","./vector_assets.json","vector_assets.json","/vector_assets.json"];
  let lastErr=null;
  for(const path of candidates){
    try{
      const url=path+"?cacheBust="+Date.now();
      console.log("[VECTOR_ASSETS] tentative",url);
      const res=await fetch(url,{cache:"no-store"});
      if(!res.ok)throw new Error("HTTP "+res.status+" sur "+path);
      const data=await res.json();
      validateVectorAssetsData(data);
      vectorAssetPack=data;
      window.__vectorAssetsLoadedFrom=path;
      window.__vectorDrawCount=0;
      const counts=Object.entries(data.assets).map(([k,v])=>k+":"+(v.layers?v.layers.length:0)).join(" | ");
      console.log("[VECTOR_ASSETS] OK",path,counts);
      return true;
    }catch(e){
      lastErr=e;
      console.warn("[VECTOR_ASSETS] échec",path,e);
    }
  }
  vectorAssetPack=null;
  window.__vectorAssetsLoadedFrom=null;
  showVectorAssetsError(lastErr);
  throw lastErr || new Error("vector_assets_runtime.json / vector_assets.json introuvables");
}
function vectorAsset(name){return vectorAssetPack&&vectorAssetPack.assets?vectorAssetPack.assets[name]:null}
function readCharacterGender(key,fallback){
  try{
    const v=localStorage.getItem(key);
    return (v==="boy"||v==="girl") ? v : fallback;
  }catch(e){return fallback;}
}

function vectorAnimTransform(l,t){
  const a=l.anim;if(!a||!a.type)return "";
  const speed=Number(a.speed??0.004), amp=Number(a.amp??1), ampX=Number(a.ampX??amp);
  const s=Math.sin(t*speed);
  const cx=Number(a.pivotX ?? l.pivotX ?? ((Number(l.x??0)+Number(l.w??40)/2)||20));
  const cy=Number(a.pivotY ?? l.pivotY ?? ((Number(l.y??0)+Number(l.h??40)/2)||20));
  if(a.type==="look")return `translate(${s*ampX} 0)`;
  if(a.type==="bob")return `translate(0 ${s*amp})`;
  if(a.type==="shake")return `translate(${Math.sin(t*speed*5)*amp} ${Math.cos(t*speed*7)*amp})`;
  if(a.type==="spin")return `rotate(${s*amp} ${cx} ${cy})`;
  if(a.type==="rot90")return `rotate(${90*s} ${cx} ${cy})`;
  if(a.type==="rot-90")return `rotate(${-90*s} ${cx} ${cy})`;
  if(a.type==="pulse"){const sc=1+s*amp*0.08;return `translate(${cx} ${cy}) scale(${sc}) translate(${-cx} ${-cy})`;}
  return "";
}
function vectorAnimOpacity(l,t){
  const a=l.anim;if(!a||a.type!=="blink")return l.opacity??1;
  return Math.sin(t*Number(a.speed??0.006))>0?1:0.2;
}
function appendVectorLayer(parent,l,t){
  let el; const shape=l.shape||"rect";

  if(shape==="compound"){
    const g=E("g",{});
    (l.parts||[]).forEach(part=>{
      const layer=part.layer||part;
      const wrap=E("g",{});
      if(part.groupTransform)wrap.setAttribute("transform",part.groupTransform);
      appendVectorLayer(wrap,layer,t);
      g.appendChild(wrap);
    });
    const trParts=[];
    const tx=Number(l.tx||0), ty=Number(l.ty||0);
    if(tx||ty)trParts.push(`translate(${tx} ${ty})`);
    const hasScale=Number.isFinite(Number(l.scaleX))||Number.isFinite(Number(l.scaleY));
    const hasRot=Number.isFinite(Number(l.rotation));
    if(hasScale||hasRot){
      const bb=layerBBox(l);
      const cx=Number(l.pivotX ?? (bb.x+bb.w/2));
      const cy=Number(l.pivotY ?? (bb.y+bb.h/2));
      const sx=Number.isFinite(Number(l.scaleX))?Number(l.scaleX):1;
      const sy=Number.isFinite(Number(l.scaleY))?Number(l.scaleY):1;
      const rr=Number.isFinite(Number(l.rotation))?Number(l.rotation):0;
      trParts.push(`translate(${cx} ${cy})`);
      if(rr)trParts.push(`rotate(${rr})`);
      if(sx!==1||sy!==1)trParts.push(`scale(${sx} ${sy})`);
      trParts.push(`translate(${-cx} ${-cy})`);
    }
    const tr=vectorAnimTransform(l,t); if(tr)trParts.push(tr);
    if(trParts.length)g.setAttribute("transform",trParts.join(" "));
    const op=vectorAnimOpacity(l,t);
    if(op!==1)g.setAttribute("opacity",op);
    g.setAttribute("pointer-events","none");
    parent.appendChild(g);
    return;
  }

  if(shape==="circle"){
    el=E("circle",{cx:l.x??20,cy:l.y??20,r:l.r??8});
  }else if(shape==="polygon"){
    const pts=(l.points||[]).map(p=>Array.isArray(p)?p.join(","):p).join(" ");
    el=E("polygon",{points:pts});
  }else if(shape==="path"){
    const d=l.d || (Array.isArray(l.points) ? pointsToPath(l.points,l.curveMode||"smooth") : "");
    el=E("path",{d:d,"stroke-linecap":"round","stroke-linejoin":"round"});
  }else if(shape==="text"){
    el=E("text",{x:l.x??20,y:l.y??20,"font-size":l.fontSize??12,"font-weight":900,"font-family":"Rubik,Arial,sans-serif","text-anchor":"middle"});
    el.textContent=l.text??"?";
  }else{
    el=E("rect",{x:l.x??0,y:l.y??0,width:l.w??10,height:l.h??10,rx:l.rx??0,ry:l.ry??l.rx??0});
  }
  el.setAttribute("fill",l.fill??"transparent");
  el.setAttribute("stroke",l.stroke??"transparent");
  el.setAttribute("stroke-width",l.strokeWidth??0);
  el.setAttribute("opacity",vectorAnimOpacity(l,t));
  const trParts=[];
  const hasScale=Number.isFinite(Number(l.scaleX))||Number.isFinite(Number(l.scaleY));
  const hasRot=Number.isFinite(Number(l.rotation));
  if(hasScale||hasRot){
    const bb=layerBBox(l);
    const cx=Number(l.pivotX ?? (bb.x+bb.w/2));
    const cy=Number(l.pivotY ?? (bb.y+bb.h/2));
    const sx=Number.isFinite(Number(l.scaleX))?Number(l.scaleX):1;
    const sy=Number.isFinite(Number(l.scaleY))?Number(l.scaleY):1;
    const r=Number.isFinite(Number(l.rotation))?Number(l.rotation):0;
    trParts.push(`translate(${cx} ${cy})`);
    if(r)trParts.push(`rotate(${r})`);
    if(sx!==1||sy!==1)trParts.push(`scale(${sx} ${sy})`);
    trParts.push(`translate(${-cx} ${-cy})`);
  }
  const tr=vectorAnimTransform(l,t); if(tr)trParts.push(tr);
  if(trParts.length)el.setAttribute("transform",trParts.join(" "));
  el.setAttribute("pointer-events","none");
  parent.appendChild(el);
}
function layerBBox(l){
  if(!l)return {x:0,y:0,w:0,h:0};

  if(l.shape==="compound"){
    const boxes=(l.parts||[]).map(part=>layerBBox(part.layer||part)).filter(Boolean);
    if(!boxes.length)return {x:0,y:0,w:0,h:0};
    const minX=Math.min(...boxes.map(b=>b.x)), minY=Math.min(...boxes.map(b=>b.y));
    const maxX=Math.max(...boxes.map(b=>b.x+b.w)), maxY=Math.max(...boxes.map(b=>b.y+b.h));
    return {x:minX,y:minY,w:maxX-minX,h:maxY-minY};
  }

  if(l.shape==="circle"){const r=Number(l.r??0);return {x:Number(l.x??0)-r,y:Number(l.y??0)-r,w:r*2,h:r*2};}
  if(l.shape==="polygon" || l.shape==="path" || l.shape==="line"){
    const pts=(l.points||[]).map(p=>Array.isArray(p)?p:String(p).split(",")).map(p=>({x:Number(p[0]??0),y:Number(p[1]??0)}));
    if(!pts.length)return {x:0,y:0,w:0,h:0};
    const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
    const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
    return {x:minX,y:minY,w:maxX-minX,h:maxY-minY};
  }
  if(l.shape==="text"){const fs=Number(l.fontSize??12),w=String(l.text??"").length*fs*0.6;return {x:Number(l.x??0)-w/2,y:Number(l.y??0)-fs,w:w,h:fs};}
  return {x:Number(l.x??0),y:Number(l.y??0),w:Number(l.w??10),h:Number(l.h??10)};
}
function groupBBox(g,layersList){
  const boxes=(g.children||[]).map(id=>layersList.find(l=>l.id===id)).filter(Boolean).map(layerBBox);
  if(!boxes.length)return {x:20,y:20,w:0,h:0};
  const minX=Math.min(...boxes.map(b=>b.x)), minY=Math.min(...boxes.map(b=>b.y));
  const maxX=Math.max(...boxes.map(b=>b.x+b.w)), maxY=Math.max(...boxes.map(b=>b.y+b.h));
  return {x:minX,y:minY,w:maxX-minX,h:maxY-minY};
}
function vectorGroupStaticTransform(g,bb){
  if(!g)return '';
  const tx=Number(g.tx||0),ty=Number(g.ty||0);
  const sx=Number.isFinite(Number(g.scaleX))?Number(g.scaleX):1;
  const sy=Number.isFinite(Number(g.scaleY))?Number(g.scaleY):1;
  const r=Number.isFinite(Number(g.rotation))?Number(g.rotation):0;
  if(!tx&&!ty&&!r&&sx===1&&sy===1)return '';
  const px=Number(g.pivotX??(bb.x+bb.w/2)),py=Number(g.pivotY??(bb.y+bb.h/2));
  const parts=[];
  if(tx||ty)parts.push(`translate(${tx} ${ty})`);
  parts.push(`translate(${px} ${py})`);
  if(r)parts.push(`rotate(${r})`);
  if(sx!==1||sy!==1)parts.push(`scale(${sx} ${sy})`);
  parts.push(`translate(${-px} ${-py})`);
  return parts.join(' ');
}
function appendVectorAssetLayers(parent,a,t){
  const layersList=Array.isArray(a.layers)?a.layers:[];
  const groupsList=Array.isArray(a.groups)?a.groups:[];
  // V43.49 : table stable id -> layer. Le rendu des enfants de groupe
  // utilise maintenant group.children, pas l'ordre global des layers.
  // Sinon un layer créé dans un groupe peut passer devant/derrière en jeu
  // alors que l'éditeur affiche autre chose. Petite trahison visuelle, donc non.
  const layerById=new Map(layersList.filter(Boolean).map(layer=>[layer.id,layer]));
  const childToGroup=new Map();
  groupsList.forEach(g=>(g.children||[]).forEach(id=>childToGroup.set(id,g)));
  const renderedGroups=new Set();
  layersList.forEach(l=>{
    if(!l || l.visible===false)return;
    const gr=childToGroup.get(l.id);
    if(gr){
      if(renderedGroups.has(gr.id))return;
      renderedGroups.add(gr.id);
      const bb=groupBBox(gr,layersList);
      const ge=E("g",{"data-vector-group":gr.id,"pointer-events":"none"});
      const trParts=[];const st=vectorGroupStaticTransform(gr,bb);if(st)trParts.push(st);
      const tr=vectorAnimTransform({...bb,pivotX:gr.anim?.pivotX??gr.pivotX,pivotY:gr.anim?.pivotY??gr.pivotY,anim:gr.anim},t);if(tr)trParts.push(tr);
      if(trParts.length)ge.setAttribute("transform",trParts.join(" "));
      // V43.49 : ordre interne fidèle. Si le groupe dit [A,B,C], le jeu dessine A puis B puis C.
      // Avant, le runtime reprenait l'ordre global layersList, donc l'ordre réglé dans le groupe
      // pouvait être ignoré, surtout après création d'une forme directement dans le groupe.
      (gr.children||[]).forEach(childId=>{
        const child=layerById.get(childId);
        if(child && child.visible!==false)appendVectorLayer(ge,child,t);
      });
      parent.appendChild(ge);
    }else{
      appendVectorLayer(parent,l,t);
    }
  });
}
function drawVectorAsset(name,X,Y,parent=grid,opts={}){
  const a=vectorAsset(name);
  if(!a || !Array.isArray(a.layers)){
    console.error("[VECTOR DRAW FAIL] asset absent ou invalide", name, a);
    return false;
  }
  const canvas=vectorAssetPack.canvasSize||40;
  const scale=T/canvas;
  const g=E("g",{transform:`translate(${X} ${Y}) scale(${scale})`,"pointer-events":"none","data-vector-asset":name});
  const t=Date.now();
  appendVectorAssetLayers(g,a,t);
  parent.appendChild(g);

  return true;
}


/* ===== V43.13 TELEPORTER GAMEPLAY =====
   Objectif : ajouter une brique lisible, limitée à 3 variantes de couleur,
   sans toucher au système de coups ni à la logique principale de gravité.

   Caractères utilisés dans levels.json :
   - "1" : téléporteur cyan
   - "2" : téléporteur rose
   - "3" : téléporteur vert

   Règle de gameplay : quand le cube arrive sur un téléporteur, il ressort
   sur l'autre téléporteur de la même couleur. Le plateau ne tourne pas.
   La gravité continue ensuite exactement dans le même sens visuel.
*/
const TELEPORTER_TYPES=["1","2","3"];
const TELEPORTER_STYLES={
  "1":{name:"cyan",label:"A",main:"#19e3ff",dark:"#0d1230",light:"#ffffff"},
  "2":{name:"rose",label:"B",main:"#ff4fd8",dark:"#0d1230",light:"#ffffff"},
  "3":{name:"vert",label:"C",main:"#7dff6a",dark:"#0d1230",light:"#ffffff"}
};

function isTeleporterChar(c){
  // Test volontairement centralisé : si un jour tu veux changer les symboles
  // de map, tu ne pars pas à la chasse au "1", "2", "3" dans tout le fichier.
  return TELEPORTER_TYPES.includes(String(c));
}
function teleporterStyle(c){
  return TELEPORTER_STYLES[String(c)] || TELEPORTER_STYLES["1"];
}
function teleporterAssetName(c){
  return "teleporter_"+String(c);
}
function teleporterLabel(c){
  return teleporterStyle(c).label;
}
function findTeleportersInGrid(m,type){
  // Retourne tous les téléporteurs d'une même couleur, triés en ordre stable.
  // Usage normal : 2 cases. S'il y en a plus, on enchaîne au suivant pour éviter
  // un comportement aléatoire, parce que le hasard dans un puzzle, c'est rarement brillant.
  const pts=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(m[y] && m[y][x]===type)pts.push({x,y});
  }
  pts.sort((a,b)=>(a.y-b.y)||(a.x-b.x));
  return pts;
}
function pairedTeleporterPosition(m,from){
  const type=m?.[from.y]?.[from.x];
  if(!isTeleporterChar(type))return null;
  const pts=findTeleportersInGrid(m,type);
  if(pts.length<2)return null;
  const i=pts.findIndex(q=>q.x===from.x && q.y===from.y);
  if(i<0)return null;
  return pts[(i+1)%pts.length];
}
function currentTeleporterType(){
  if(!p || !b[p.y])return null;
  const c=b[p.y][p.x];
  return isTeleporterChar(c) ? c : null;
}
function refreshTeleporterCooldown(){
  // Le cooldown empêche de ressortir d'un téléporteur puis d'être renvoyé
  // immédiatement dans l'autre sens. Il se réarme uniquement quand le cube
  // quitte cette couleur. Même après une rotation manuelle, donc pas de ping-pong idiot.
  const c=currentTeleporterType();
  if(!c || c!==teleporterCooldownType)teleporterCooldownType=null;
}
function soundTeleport(){
  beep(520,.045,"sine",.026,"sfx");
  setTimeout(()=>beep(780,.055,"triangle",.018,"sfx"),48);
  setTimeout(()=>beep(1040,.045,"sine",.012,"sfx"),95);
}
function teleportFx(x,y,type){
  const svgRect=svg.getBoundingClientRect();
  const scale=svgRect.width/BOARD;
  const cx=svgRect.left + (x*T+HALF)*scale;
  const cy=svgRect.top + (y*T+HALF)*scale;
  const col=teleporterStyle(type).main;
  for(let i=0;i<18;i++){
    const d=document.createElement("div");
    d.className="gravel";
    d.style.left=(cx-3+(Math.random()*18-9))+"px";
    d.style.top=(cy-3+(Math.random()*18-9))+"px";
    d.style.background=col;
    d.style.boxShadow="0 0 10px "+col;
    d.style.setProperty("--dx",(Math.random()*90-45)+"px");
    d.style.setProperty("--dy",(Math.random()*90-45)+"px");
    document.body.appendChild(d);
    setTimeout(()=>d.remove(),650);
  }
}
function tryTeleportFromCurrentTile(){
  const type=currentTeleporterType();
  if(!type)return false;
  if(teleporterCooldownType===type)return false;

  const target=pairedTeleporterPosition(b,p);
  if(!target){
    status.textContent="Téléporteur "+teleporterLabel(type)+" sans paire.";
    return false;
  }

  const from={x:p.x,y:p.y};
  resetPlayerTrail(); // Téléportation instantanée : pas de fausse traînée entre deux cases éloignées.
  p={x:target.x,y:target.y};
  teleporterCooldownType=type;
  eternalFallWraps=0;
  status.textContent="Téléporteur "+teleporterLabel(type)+" : "+from.x+","+from.y+" → "+p.x+","+p.y+".";
  soundTeleport();
  teleportFx(from.x,from.y,type);
  teleportFx(p.x,p.y,type);
  draw();
  return true;
}
/* ===== V43.18 PLAYER SPEED TRAIL =====
   Trail purement visuel : il ne modifie ni la physique, ni le nombre de coups,
   ni le BFS. On garde quelques anciennes positions du cube pendant une chute,
   puis on les dessine en silhouettes translucides derrière lui.

   Le rendu est volontairement simple et peu coûteux : pas de filtre SVG, pas de
   blur temps réel, pas de magie qui transforme un petit jeu mobile en radiateur.
*/
const PLAYER_TRAIL_MAX=5;
const PLAYER_TRAIL_LIFE_MS=260;

function resetPlayerTrail(){
  playerTrail=[];
}

function prunePlayerTrail(now=Date.now()){
  playerTrail=playerTrail.filter(t=>now-t.time<PLAYER_TRAIL_LIFE_MS);
  if(playerTrail.length>PLAYER_TRAIL_MAX){
    playerTrail=playerTrail.slice(playerTrail.length-PLAYER_TRAIL_MAX);
  }
}

function pushPlayerTrailCell(x,y,fallDistance=1){
  if(edit||deadPlayer||gameOver)return;
  playerTrail.push({x,y,time:Date.now(),fallDistance});
  prunePlayerTrail();
}

/* ===== V49 rendu du plateau =====
   Deux calques : le décor (damier, tubes) n'est reconstruit que lorsque le plateau change ;
   les blocs, les personnages et les effets sont redessinés à chaque image.
   Les murs ne sont pas des cases : ce sont des tubes continus, à la couleur du chapitre. */
let dgStaticG=null,dgDynG=null;
function dgBoardAngle(){
  const m=/rotate\(([-\d.e]+)/.exec(rot.getAttribute("transform")||"");
  return m?Number(m[1])||0:0;
}
function dgDrawStatic(cell){
  let key=(edit?"E":"P")+W+dgC1+dgC2;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)key+=cell(x,y)==="#"?"#":".";
  if(!edit&&key===dgStaticKey&&dgStaticG&&dgStaticG.parentNode===grid)return;
  dgStaticKey=key;
  grid.innerHTML="";
  dgStaticG=E("g",{"pointer-events":"none"});
  dgDynG=E("g",{"pointer-events":"none"});
  grid.appendChild(dgStaticG);grid.appendChild(dgDynG);
  const defs=E("defs",{});
  defs.innerHTML='<linearGradient id="dgTube" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="'+BOARD+'" y2="'+BOARD+'"><stop offset="0" stop-color="'+dgC1+'"/><stop offset="1" stop-color="'+dgC2+'"/></linearGradient>'+
    '<linearGradient id="dgStreak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd23f" stop-opacity="0"/><stop offset="1" stop-color="#ffd23f" stop-opacity=".8"/></linearGradient>'+
    '<radialGradient id="dgHalo"><stop offset="0" stop-color="#ff4f8b" stop-opacity=".6"/><stop offset="1" stop-color="#ff4f8b" stop-opacity="0"/></radialGradient>';
  // motif très léger à l'intérieur des murs, différent selon le chapitre : hachures, pois, chevrons, croix
  const u=T*.26,pw=Math.max(.6,T*.028),ps=' fill="none" stroke="#fff" stroke-width="'+pw+'" stroke-linecap="round"';
  const motifs=[
    '<path d="M'+(-u*.25)+' '+(u*.25)+'L'+(u*.25)+' '+(-u*.25)+'M0 '+u+'L'+u+' 0M'+(u*.75)+' '+(u*1.25)+'L'+(u*1.25)+' '+(u*.75)+'"'+ps+'/>',
    '<circle cx="'+(u*.25)+'" cy="'+(u*.25)+'" r="'+(pw*1.1)+'" fill="#fff"/><circle cx="'+(u*.75)+'" cy="'+(u*.75)+'" r="'+(pw*1.1)+'" fill="#fff"/>',
    '<path d="M0 '+(u*.65)+'L'+(u*.5)+' '+(u*.35)+'L'+u+' '+(u*.65)+'"'+ps+'/>',
    '<path d="M'+(u*.5)+' '+(u*.28)+'V'+(u*.72)+'M'+(u*.28)+' '+(u*.5)+'H'+(u*.72)+'"'+ps+'/>'
  ];
  defs.innerHTML+='<pattern id="dgPat" patternUnits="userSpaceOnUse" width="'+u+'" height="'+u+'">'+motifs[dgChapterIndexOfLevel(currentLevel||0)%motifs.length]+'</pattern>';
  dgStaticG.appendChild(defs);
  // damier discret en tuiles arrondies, teinté par le chapitre
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    dgStaticG.appendChild(E("rect",{x:x*T+T*.08,y:y*T+T*.08,width:T*.84,height:T*.84,rx:T*.2,fill:(x+y)%2?dgC2:dgC1,opacity:(x+y)%2?.07:.035,stroke:edit?"rgba(255,255,255,.16)":"none","stroke-width":1}));
  }
  // murs : chaque mur remplit sa case, et deux murs voisins se soudent. On lit d'un coup d'œil où l'on va se poser.
  const wall=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&cell(x,y)==="#";
  const m=T*.2,s=T-2*m,r=T*.3;
  const box=(x,y,w,h)=>"M"+x+" "+y+"h"+w+"v"+h+"h"+(-w)+"Z";
  let d="";
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(!wall(x,y))continue;
    const X=x*T+m,Y=y*T+m,cx=x*T+HALF,cy=y*T+HALF,rt=wall(x+1,y),dn=wall(x,y+1);
    d+="M"+(X+r)+" "+Y+"h"+(s-2*r)+"a"+r+" "+r+" 0 0 1 "+r+" "+r+"v"+(s-2*r)+"a"+r+" "+r+" 0 0 1 "+(-r)+" "+r+"h"+(-(s-2*r))+"a"+r+" "+r+" 0 0 1 "+(-r)+" "+(-r)+"v"+(-(s-2*r))+"a"+r+" "+r+" 0 0 1 "+r+" "+(-r)+"Z";
    if(rt)d+=box(cx,Y,T,s);
    if(dn)d+=box(X,cy,s,T);
    if(rt&&dn&&wall(x+1,y+1))d+=box(cx,cy,T,T);
  }
  dgTubeD=d;
  if(d){
    const P=a=>dgStaticG.appendChild(E("path",Object.assign({"stroke-linecap":"round","stroke-linejoin":"round"},a)));
    // un tube creux : le contour lumineux est tracé puis l'intérieur est rebouché (ce qui efface aussi les soudures)
    P({d,fill:"none",stroke:"url(#dgTube)","stroke-width":T*.46,opacity:.15});  // halo (pas de filtre de flou : trop coûteux sur mobile)
    P({d,fill:"none",stroke:"url(#dgTube)","stroke-width":T*.2});
    P({d,fill:"#0d1230",stroke:"none"});
    P({d,fill:"url(#dgTube)",stroke:"none",opacity:.1});
    P({d,fill:"url(#dgPat)",stroke:"none",opacity:.13});
  }
}
/* un esprit dans une case, ancré par les pieds : l'écrasement et l'étirement partent du sol */
function dgDrawSpirit(parent,kind,sex,X,Y,o){
  o=o||{};
  const s=T/40*.84,cx=X+HALF,cy=Y+HALF;
  const el=E("g",{transform:"rotate("+(o.rot||0)+" "+cx+" "+cy+") translate("+(cx+(o.dx||0))+" "+(Y+T*.97+(o.dy||0))+") scale("+(s*(o.sx||1))+" "+(s*(o.sy||1))+") translate(-20 -39)"});
  el.innerHTML=DGSpirit.svg(kind,sex,o.state);
  parent.appendChild(el);
}
function drawPlayerSpeedTrail(){
  if(edit||deadPlayer||!playerTrail.length)return;
  const now=Date.now();
  prunePlayerTrail(now);
  for(const t of playerTrail){
    const life=1-(now-t.time)/PLAYER_TRAIL_LIFE_MS;
    if(life<=0)continue;
    dgDynG.appendChild(E("circle",{cx:t.x*T+HALF,cy:t.y*T+HALF,r:T*.13*life,fill:"#ffd23f",opacity:(life*.55).toFixed(3)}));
  }
}
function draw(){
  const now=performance.now();
  const cell=(x,y)=>edit?baseMap[y][x]:b[y][x];
  dgDrawStatic(cell);
  const g=dgDynG,ang=dgBoardAngle();
  g.textContent="";
  // 1) blocs : pendant une rotation ils restent à l'endroit, les pictos se lisent toujours
  let dateCell=null;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const c=cell(x,y);
    if(c==="."||c==="#")continue;
    if(c==="B"){dateCell={x,y};continue;}
    if(c==="A"){if(edit)dgDrawSpirit(g,"flamme",dgMeSex(),x*T,y*T);continue;}
    let name=null;
    if(c==="S")name=buttonIsPressed(x,y)?"button_on":"button_off";
    else if(c==="R")name="rotator_right";
    else if(c==="L")name="rotator_left";
    else if(isTeleporterChar(c))name=teleporterAssetName(c);
    else if(c==="X")name="danger";
    else if(c==="D")name="block_up";
    else if(c==="O")name="block_down";
    if(!name)continue;
    if(ang){
      const tg=E("g",{transform:"rotate("+(-ang)+" "+(x*T+HALF)+" "+(y*T+HALF)+")"});
      drawVectorAsset(name,x*T,y*T,tg);
      g.appendChild(tg);
    }else drawVectorAsset(name,x*T,y*T,g);
  }
  const lean=dgRot?dgRot.dir*14*Math.sin(Math.PI*dgRot.k):0;
  const imp=dgImpact?dgImpact.imp:0, idt=dgImpact?now-dgImpact.t:1e9;
  const won=gameOver&&!deadPlayer&&p.x===exit.x&&p.y===exit.y, lost=gameOver&&!won;
  const hop=t0=>-Math.abs(Math.sin((now+t0)/170))*T*.13;
  // 2) la personne à rejoindre : halo, regard qui suit le joueur, sursaut quand il se prend un mur
  if(dateCell){
    const X=dateCell.x*T,Y=dateCell.y*T,person=dgCurPerson();
    if(edit)dgDrawSpirit(g,person.kind,dgDateSex(),X,Y);
    else{
      const k=.5+.5*Math.sin(now*.0042);
      g.appendChild(E("circle",{cx:X+HALF,cy:Y+HALF,r:T*(.85+.18*k),fill:"url(#dgHalo)",opacity:(.95-.35*k).toFixed(3)}));
      const o={rot:-ang,state:{t:now}};
      if(won){o.state.eye="happy";o.state.mouth="grin";o.dy=hop(260);o.dx=-T*.25;}
      else if(lost){o.state.eye="sad";o.state.mouth="sad";}
      else{
        const dx=p.x-dateCell.x,dy=p.y-dateCell.y,n=Math.hypot(dx,dy)||1;
        o.state.ex=dx/n*1.5;o.state.ey=dy/n*1.2;
        if((now+900)%3700<130)o.state.eye="blink";
        if(idt<300&&imp>.25){o.dy=-imp*T*.16*Math.sin(Math.PI*idt/300);o.state.mouth="o";}
      }
      dgDrawSpirit(g,person.kind,dgDateSex(),X,Y,o);
      if(!gameOver){
        const ph=(now%1800)/1800;
        const h=E("text",{x:X+T*.86+ph*T*.1,y:Y+T*.12-ph*T*.5,fill:"#ff4f8b","font-size":T*(.2+.14*ph),"text-anchor":"middle",opacity:Math.sin(Math.PI*ph).toFixed(3),transform:"rotate("+(-ang)+" "+(X+HALF)+" "+(Y+HALF)+")"});
        h.textContent="♥";
        g.appendChild(h);
      }
    }
  }
  drawPlayerSpeedTrail();
  // 3) le joueur : il s'étire en tombant, s'écrase à l'impact, puis rebondit
  if(!edit&&!deadPlayer){
    let py=p.y,fv=0;
    const fa=dgFallAnim;
    if(fa&&fa.x===p.x&&fa.to===p.y){
      const k=Math.min(1,(now-fa.t0)/fa.dur);
      py=fa.from+(fa.to-fa.from)*k;fv=fa.v;
    }
    const X=p.x*T,Y=py*T;
    const o={rot:-ang+lean,state:{t:now}};
    if(fv>.12){
      const len=T*(.5+fv*1.6);
      g.appendChild(E("rect",{x:X+T*.27,y:Y+T*.55-len,width:T*.46,height:len,rx:T*.2,fill:"url(#dgStreak)",opacity:Math.min(1,fv*1.2).toFixed(3)}));
    }
    if(won){o.state.eye="happy";o.state.mouth="grin";o.dy=hop(0);o.dx=T*.25;}
    else if(lost){o.state.eye="sad";o.state.mouth="sad";}
    else if(fa&&fv>0){
      o.sx=1-fv*.2;o.sy=1+fv*.38;
      o.state.stretch=fv;o.state.ey=1.5;
      if(fv>.35)o.state.mouth="o";
    }else{
      if(idt<420){
        const s=imp*Math.exp(-idt/85)*Math.cos(idt/36);
        o.sx=1+s*.42;o.sy=1-s*.36;
        if(idt<170&&imp>.3)o.state.eye="hit";
        if(idt<220&&imp>.2)o.state.mouth="o";
      }
      if(!o.state.eye){
        if(now%3400<130)o.state.eye="blink";
        else if(dateCell){
          const dx=dateCell.x-p.x,dy=dateCell.y-p.y,n=Math.hypot(dx,dy)||1;
          o.state.ex=dx/n*1.5;o.state.ey=dy/n*1.2;
        }
      }
      if(!busy)o.dy=Math.sin(now/420)*T*.012;
    }
    dgDrawSpirit(g,"flamme",dgMeSex(),X,Y,o);
    // l'écho de la chute : une onde lumineuse part du point d'impact et court dans les murs
    if(dgImpact&&dgImpact.flash&&idt<520&&dgTubeD){
      const k=idt/520,ex=dgImpact.x*T+HALF,ey=((dgImpact.y+1)%H)*T,R=T*(.3+k*(2.2+3.2*imp));
      const mk=E("mask",{id:"dgEcho",maskUnits:"userSpaceOnUse",x:-T,y:-T,width:BOARD+2*T,height:BOARD+2*T});
      mk.appendChild(E("circle",{cx:ex,cy:ey,r:R,fill:"none",stroke:"#ffffff","stroke-width":T*(.9+.8*imp)}));
      g.appendChild(mk);
      const eg=E("g",{mask:"url(#dgEcho)",opacity:(Math.pow(1-k,1.4)*(.45+.55*imp)).toFixed(3)});
      eg.appendChild(E("path",{d:dgTubeD,fill:"none",stroke:"#ffffff","stroke-width":T*.24,"stroke-linejoin":"round"}));
      eg.appendChild(E("path",{d:dgTubeD,fill:"#0d1230",stroke:"none"}));
      eg.appendChild(E("path",{d:dgTubeD,fill:"url(#dgTube)",stroke:"none",opacity:.55}));
      g.appendChild(eg);
    }
    if(dgImpact&&dgImpact.flash&&idt<300){
      const k=idt/300,fx=dgImpact.x*T;
      const rx=T*(.3+k*(.35+.75*imp));
      g.appendChild(E("ellipse",{cx:fx+HALF,cy:(dgImpact.y+1)*T-T*.03,rx,ry:rx*.26,fill:"none",stroke:"#ffffff","stroke-width":Math.max(.5,T*.06*(1-k)),opacity:(1-k).toFixed(3)}));
    }
  }
  if(edit){
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      let c=E("rect",{x:x*T,y:y*T,width:T,height:T,fill:"rgba(0,0,0,0.001)",stroke:"transparent",class:"hitcell"});
      c.dataset.x=x;c.dataset.y=y;
      c.addEventListener("pointerdown",startPaint);
      c.addEventListener("pointerenter",paintEnter);
      c.addEventListener("pointermove",paintMove);
      grid.appendChild(c);
    }
  }
  if(!window.CG_EDITOR_MODE && edit){ edit=false; }
  const editing=edit && window.CG_EDITOR_MODE;
  document.body.classList.toggle("editing",editing);
  const editToggle=document.getElementById("toggleEdit");
  editToggle.textContent=editing?"Quitter l’édition":"Éditer";
  editToggle.className=editing?"active":"";
  editPanel.className=editing?"":"hidden";
  document.getElementById("levelInput").value=currentLevel+1;updateLockUI();
}
/* la poussière du décor tombe en continu (elle montre le sens de la gravité) et accélère pendant une chute */
function dgMotes(dt){
  const v=dgFallAnim?dgFallAnim.v:0;
  dgMoteY=(dgMoteY+dt*(.035+v*.5))%100000;
  const m=document.getElementById("motes");
  if(m)m.style.setProperty("--my",dgMoteY.toFixed(1));
}

let levelUndoStack=[];
let paintSessionUndo=false;
const LEVEL_UNDO_LIMIT=100;
function currentLevelSnapshot(){
  return JSON.stringify({
    map:map(),
    name:levels[currentLevel]?.name,
    maxMoves:levels[currentLevel]?.maxMoves,
    locked:levels[currentLevel]?.locked,
    difficulty:levels[currentLevel]?.difficulty,
    biome:levels[currentLevel]?.biome
  });
}
function pushLevelUndo(reason="edit"){
  if(!levels[currentLevel])return;
  const snap=currentLevelSnapshot();
  if(levelUndoStack[levelUndoStack.length-1]===snap)return;
  levelUndoStack.push(snap);
  if(levelUndoStack.length>LEVEL_UNDO_LIMIT)levelUndoStack.shift();
}
function undoLevelEdit(){
  if(!edit){status.textContent="Undo disponible en mode édition.";return;}
  const snap=levelUndoStack.pop();
  if(!snap){status.textContent="Rien à annuler.";return;}
  const s=JSON.parse(snap);
  baseMap=arr(s.map);
  Object.assign(levels[currentLevel],s,{map:s.map});
  levelNameInput.value=s.name||levelNameInput.value;
  document.getElementById("difficultyInput").value=s.difficulty||1;
  document.getElementById("biomeSelect").value=s.biome||"cosmic";
  normalize();
  draw();
  status.textContent="Undo : modification annulée.";
}
function stopPaint(){
  painting=false;
  lastPaintKey="";
  paintSessionUndo=false;
}

function paintCell(x,y){
  if(!edit)return;
  if(isLocked()){
    status.innerHTML='<span class="lockedWarn">Niveau verrouillé.</span>';
    return;
  }
  if(!paintSessionUndo){pushLevelUndo("paint");paintSessionUndo=true;}
  const key=x+","+y;
  if(key===lastPaintKey)return;
  lastPaintKey=key;

  let v=tool.value;
  if(v=="A"){
    for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++)if(baseMap[yy][xx]=="A")baseMap[yy][xx]=".";
  }
  if(v=="B"){
    for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++)if(baseMap[yy][xx]=="B")baseMap[yy][xx]=".";
  }

  baseMap[y][x]=v;
  normalize();
  draw();
}
function startPaint(ev){
  if(!edit)return;
  ev.preventDefault();
  painting=true;
  paintSessionUndo=false;
  lastPaintKey="";
  try{ev.currentTarget.setPointerCapture(ev.pointerId)}catch(e){}
  const t=ev.currentTarget;
  paintCell(+t.dataset.x,+t.dataset.y);
}
function paintEnter(ev){
  if(!edit||!painting)return;
  const t=ev.currentTarget;
  paintCell(+t.dataset.x,+t.dataset.y);
}
function paintMove(ev){
  if(!edit||!painting)return;
  const el=document.elementFromPoint(ev.clientX,ev.clientY);
  if(el&&el.dataset&&el.dataset.x!==undefined){
    paintCell(+el.dataset.x,+el.dataset.y);
  }
}
window.addEventListener("pointerup",stopPaint);
window.addEventListener("pointercancel",stopPaint);
window.addEventListener("blur",stopPaint);
document.addEventListener("mouseleave",stopPaint);
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopPaint()});

function block(c){return c=="#"||c=="D"} // D bloque. O ne bloque jamais.
function solid(x,y){return x<0||y<0||x>=W||y>=H||block(b[y][x])}
function cw(m){let o=Array.from({length:H},()=>Array(W).fill("."));for(let y=0;y<H;y++)for(let x=0;x<W;x++)o[x][H-1-y]=m[y][x];return o}
function ccw(m){let o=Array.from({length:H},()=>Array(W).fill("."));for(let y=0;y<H;y++)for(let x=0;x<W;x++)o[W-1-x][y]=m[y][x];return o}
function pcw(q){return{x:H-1-q.y,y:q.x}}function pccw(q){return{x:q.y,y:W-1-q.x}}
function apply(d){resetPlayerTrail();visualOri=(visualOri+d+4)%4;if(d>0){b=cw(b);p=pcw(p);exit=pcw(exit)}else{b=ccw(b);p=pccw(p);exit=pccw(exit)}}
function toggleDoors(){
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(b[y][x]=="D")b[y][x]="O";else if(b[y][x]=="O")b[y][x]="D";}
}
function turn(d,fromAngle=0){
  if(edit||gameOver||gamePaused||dgUiOpen())return;
  if(busy){if(dgQueue.length<2)dgQueue.push(d);return;} // le plateau bouge encore : le coup attend son tour
  hideCompanion(false);clearTimeout(companionTimer);clearTimeout(companionIdleTimer);
  busy=true;moves++;rotatorCooldown=false;userAudioGesture();soundRotate(d);updateStats();
  dgSpin(d,(Math.sign(fromAngle)===d)?fromAngle:0,()=>{apply(d);draw();fall();});
}

function shake(dist){
  // le choc vient du bas : le plateau s'enfonce puis remonte
  if(dist<=0||!stage.animate)return;
  const amp=Math.min(9,2+dist*1.1);
  stage.animate([{transform:"translate(0,0)"},{transform:"translate(0,"+amp+"px)"},{transform:"translate(0,"+(-amp*.45)+"px)"},{transform:"translate(0,"+(amp*.2)+"px)"},{transform:"translate(0,0)"}],{duration:190,easing:"ease-out"});
}

function buttonIsPressed(x,y){
  // V48 runtime fix: le bouton est "appuyé" quand le cube est sur la case.
  // Et même sinon, son rendu reste cliquable visuellement.
  return !edit && p && p.x===x && p.y===y && b[y] && b[y][x]==="S";
}

function touchSwitch(){
  if(!p || !b[p.y])return false;
  const onSwitch=b[p.y][p.x]==="S";
  if(!onSwitch){
    // Le bouton ne sera réarmé qu'après avoir réellement quitté une case bouton.
    activeSwitchKey=null;
    activeSwitchHeld=false;
    return false;
  }

  // Important : pendant une rotation, la case bouton et le joueur changent de coordonnées ensemble.
  // On ne doit donc pas utiliser uniquement x,y pour décider d'un nouveau déclenchement.
  // Tant que le cube est encore sur un bouton, l'état des portes reste figé.
  if(activeSwitchHeld)return false;

  activeSwitchHeld=true;
  activeSwitchKey=p.x+","+p.y;
  toggleDoors();
  soundDoor();
  status.textContent="Bouton activé : portes inversées.";
  draw();
  return true;
}

function canFallOneCell(){
  if(!p)return false;
  const nx=wrapX(p.x);
  const ny=wrapY(p.y+1);
  return !solid(nx,ny);
}

function dissolvePlayer(){
  const boardRect=document.querySelector(".boardWrap").getBoundingClientRect();
  const svgRect=svg.getBoundingClientRect();
  const scale=svgRect.width/BOARD;
  const cx=svgRect.left + (p.x*T+HALF)*scale;
  const cy=svgRect.top + (p.y*T+HALF)*scale;
  const colors=["#ff9a2e","#ffd23f","#ff4f6a","#ffffff","#19e3ff"];
  for(let i=0;i<38;i++){
    let d=document.createElement("div");
    d.className="deathPixel";
    d.style.left=(cx-3 + (Math.random()*26-13))+"px";
    d.style.top=(cy-3 + (Math.random()*26-13))+"px";
    d.style.background=colors[Math.floor(Math.random()*colors.length)];
    d.style.setProperty("--dx",(Math.random()*120-60)+"px");
    d.style.setProperty("--dy",(Math.random()*120-60)+"px");
    document.body.appendChild(d);
    setTimeout(()=>d.remove(),700);
  }
}


function floatingHearts(){
  const svgRect=svg.getBoundingClientRect();
  const scale=svgRect.width/BOARD;
  const cx=svgRect.left + (p.x*T+HALF)*scale;
  const cy=svgRect.top + (p.y*T+T*.25)*scale;
  const hearts=["♥","❤","♡"];
  for(let i=0;i<10;i++){
    let h=document.createElement("div");
    h.className="heart";
    h.textContent=hearts[i%hearts.length];
    h.style.left=(cx+(Math.random()*42-21))+"px";
    h.style.top=(cy+(Math.random()*18-9))+"px";
    h.style.color=i%2?"#ff4f8b":"#ffe14a";
    h.style.animationDelay=(i*.08)+"s";
    document.body.appendChild(h);
    setTimeout(()=>h.remove(),1700);
  }
}



function bigHeart(){
  const svgRect=svg.getBoundingClientRect();
  const scale=svgRect.width/BOARD;
  const cx=svgRect.left + (p.x*T+HALF)*scale;
  const cy=svgRect.top + (p.y*T+T*.3)*scale;
  let h=document.createElement("div");
  h.className="bigHeart";
  h.textContent="♥";
  h.style.left=cx+"px";
  h.style.top=cy+"px";
  h.style.color="#ff4f8b";
  document.body.appendChild(h);
  setTimeout(()=>h.remove(),1600);
}
function gravelFx(distance){
  if(distance<=0)return;
  const svgRect=svg.getBoundingClientRect();
  const scale=svgRect.width/BOARD;
  const cx=svgRect.left + (p.x*T+HALF)*scale;
  const cy=svgRect.top + (p.y*T+T*.85)*scale;
  const count=Math.min(22,6+distance*3);
  const colors=[dgC1,dgC2,"#ffffff",dgC1];
  for(let i=0;i<count;i++){
    let d=document.createElement("div");
    d.className="gravel";
    d.style.left=(cx+(Math.random()*24-12))+"px";
    d.style.top=(cy+(Math.random()*8-4))+"px";
    d.style.background=d.style.color=colors[Math.floor(Math.random()*colors.length)];
    d.style.setProperty("--dx",(Math.random()*70-35)+"px");
    d.style.setProperty("--dy",(-8-Math.random()*28)+"px");
    document.body.appendChild(d);
    setTimeout(()=>d.remove(),650);
  }
}


function wrapX(x){ return x<0 ? W-1 : (x>=W ? 0 : x); }
function wrapY(y){ return y<0 ? H-1 : (y>=H ? 0 : y); }
function isDeathTile(x,y){ return b[y] && b[y][x] === "X"; }
function isRotatorTile(x,y){ return b[y] && (b[y][x] === "R" || b[y][x] === "L"); }
function rotatorDir(x,y){ return b[y][x] === "R" ? 1 : -1; }

function autoRotateFromTile(dir){
  busy=true;
  rotatorCooldown=true;
  const token=fallToken;
  dgSpin(dir,0,()=>{apply(dir);draw();setTimeout(()=>{if(token===fallToken)fall();},getFallDelayMs());});
}

function triggerDeathTile(){
  gameOver=true;
  deadPlayer=true;
  dgFallAnim=null;dgWhoosh(0);
  status.textContent="Mort : case ☠.";
  soundCrash();soundLose();
  dissolvePlayer();
  draw();
  showBanner("Oups… râteau","Tu as touché un cœur brisé. "+dgDateName()+" a levé les yeux au ciel.","","lose");
  busy=false;
}

function triggerEternalFall(){
  gameOver=true;
  busy=false;
  dgWhoosh(0);
  status.textContent="Chute éternelle détectée.";
  soundEternalFall();
  soundLose();
  showBanner("Perdu de vue","Tu es tombé dans le vide trois fois de suite. "+dgDateName()+" ne te voit plus.","","lose");
}

function fall(){
  if(edit||gameOver||gamePaused){busy=false;return;}
  let dist=0;
  let safety=0;
  const token=fallToken;

  const step=()=>{
    if(token!==fallToken)return;
    if(edit||gameOver||gamePaused){busy=false;return}
    if(safety++>160){
      busy=false;
      status.textContent="Boucle stoppée pour sécurité.";
      return;
    }

    touchSwitch();

    if(isDeathTile(p.x,p.y)){
      triggerDeathTile();
      return;
    }

    refreshTeleporterCooldown();
    if(tryTeleportFromCurrentTile()){
      setTimeout(step,getFallDelayMs());
      return;
    }

    // Rotateur : se déclenche une seule fois tant que le cube n’a pas quitté la case.
    // Sinon il tourne en boucle comme une IA junior en panique. Non merci.
    if(isRotatorTile(p.x,p.y) && !rotatorCooldown){
      const d=rotatorDir(p.x,p.y);
      status.textContent=d>0 ? "Rotateur droite activé." : "Rotateur gauche activé.";
      autoRotateFromTile(d);
      return;
    }

    const leavesBottom=(p.y+1)>=H;
    let nx=wrapX(p.x);
    let ny=wrapY(p.y+1);

    if(!solid(nx,ny)){
      if(leavesBottom){
        eternalFallWraps++;
        if(eternalFallWraps>=3){triggerEternalFall();return;}
      }
      const oldKey=p.x+","+p.y;
      pushPlayerTrailCell(p.x,p.y,dist);
      // les règles avancent d'une case d'un coup ; l'image, elle, glisse entre les deux (voir draw)
      const ms=dgStepDelay(dist);
      dgFallAnim={x:nx,from:leavesBottom?-1:p.y,to:ny,t0:performance.now(),dur:ms,v:dgStepSpeed(ms)};
      dgWhoosh(dgFallAnim.v);
      p.y=ny;
      p.x=nx;
      const newKey=p.x+","+p.y;
      if(newKey!==oldKey)rotatorCooldown=false;
      dist++;
      touchSwitch();
      setTimeout(step,ms);
    }else{
      const switched=touchSwitch();

      // Si le bouton vient d’ouvrir une porte sous le cube, on ne force pas un arrêt artificiel.
      // Le niveau réagit immédiatement et la chute reprend sur la même frame logique.
      if(switched && canFallOneCell()){
        setTimeout(step,getFallDelayMs());
        return;
      }

      eternalFallWraps=0;
      dgLand(dist);
      draw();
      busy=false;
      if(p.x==exit.x&&p.y==exit.y){
        gameOver=true;
        let s=starScore();
        let stars="♥".repeat(s)+"♡".repeat(3-s);
        status.textContent="Niveau gagné.";
        bigHeart();
        floatingHearts();
        startConfetti();
        saveWinProgress();
        if(currentLevel===levels.length-1){
          showBanner("","Tu as terminé les "+levels.length+" niveaux. Après tous ces rendez-vous, cette fois c'était la bonne personne.","","final");
        }else{
          showBanner("","",stars,"win");
        }
      }
    }
  };
  step();
}

function confettiBurst(count=24){
  const colors=[dgC1,dgC2,"#ffffff","#ff4f8b","#ffe14a"];
  const glyphs=["","","♥","♥","✦"];
  const host=document.getElementById("fxLayer");
  for(let i=0;i<count;i++){
    let c=document.createElement("div");
    c.className="confetti";
    const glyph=glyphs[Math.floor(Math.random()*glyphs.length)];
    const col=colors[Math.floor(Math.random()*colors.length)];
    c.style.left=(Math.random()*100)+"%";
    c.style.animationDelay=(Math.random()*.18)+"s";
    c.style.animationDuration=(1.0+Math.random()*1.0)+"s";
    if(glyph){
      c.textContent=glyph;
      c.style.color=col;
    }else{
      c.style.background=col;
      c.style.borderRadius=(Math.random()>.6?"50%":"2px");
    }
    host.appendChild(c);
    setTimeout(()=>c.remove(),2600);
  }
}

function startConfetti(){
  stopConfetti();
  confettiBurst(52);
  confettiTimer=setInterval(()=>confettiBurst(18),360);
}
function stopConfetti(){
  if(confettiTimer){clearInterval(confettiTimer);confettiTimer=null}
}

function applyBiomeVisual(name){
  // V47 : l'ambiance vient du chapitre (teinte du décor), plus du biome du niveau.
  // Le champ biome reste dans levels.json pour ne pas casser l'éditeur.
  try{localStorage.setItem("gravity_cube_biome",name)}catch(e){}
}

function setBiome(name){
  levels[currentLevel].biome=name;
  applyBiomeVisual(name);
  status.textContent="Biome du niveau sauvegardé : "+name+".";
}
function saveLocal(){writeCurrentLevel();localStorage.setItem("gravity_cube_levels_draft",JSON.stringify({version:5,settings:gameSettings,levels}));status.textContent="Brouillon local sauvegardé."}
function loadLocal(){
  let raw=localStorage.getItem("gravity_cube_levels_draft");
  if(!raw){status.textContent="Aucune sauvegarde locale.";return false}
  const data=JSON.parse(raw);
  if(Array.isArray(data)){
    levels=data;
    gameSettings={fallDelayMs:135,rotationDurationMs:320};
  }else{
    levels=data.levels||[];
    gameSettings={...gameSettings,...(data.settings||{})};
  }
  syncSpeedInputs();
  loadFromLevel(Math.min(currentLevel,levels.length-1));
  status.textContent="Brouillon local chargé.";
  return true;
}
function exportJson(){
  writeCurrentLevel();
  let blob=new Blob([JSON.stringify({version:5,settings:gameSettings,levels},null,2)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="levels.json";
  a.click();
  URL.revokeObjectURL(a.href);
  status.textContent="levels.json exporté. Remplace ce fichier sur Netlify.";
}
function importJson(file){
  let r=new FileReader();
  r.onload=()=>{
    let data=JSON.parse(r.result);
    levels=data.levels||data;
    gameSettings={...gameSettings,...(data.settings||{})};
    syncSpeedInputs();
    const fallbackBiome=data.biome||"cosmic";
    levels.forEach(l=>{if(!l.biome)l.biome=fallbackBiome});
    currentLevel=0;
    saveLocal();
    loadFromLevel(0);
    status.textContent="JSON importé avec biomes par niveau.";
  };
  r.readAsText(file);
}
function generatedMap(){
  const templates=[
[
".............",
"....B........",
"...###.......",
".....#.......",
".....#...X...",
"...R##.......",
".....#.......",
".....#.......",
"...###.......",
"...A.........",
".............",
".............",
"............."],
[
".............",
"..B..........",
"..##.........",
"...#.....X...",
"...#.........",
"...##L.......",
"....#........",
"....#........",
"....###......",
"......A......",
".............",
".............",
"............."],
[
".............",
".........B...",
"........###..",
"...X......#..",
"..........#..",
"......R####..",
"..........#..",
"......L...#..",
"......#####..",
"..A..........",
".............",
".............",
"............."]
  ];
  return normalizeLevelMapSize(templates[Math.floor(Math.random()*templates.length)]);
}
function addLevel(){writeCurrentLevel();levels.push({id:"L"+Date.now().toString(36),chapter:levels[currentLevel]?.chapter,name:"Nouveau niveau "+(levels.length+1),maxMoves:999,locked:false,difficulty:1,gridSize:W,biome:document.getElementById("biomeSelect").value||"cosmic",map:generatedMap()});loadFromLevel(levels.length-1);edit=true;draw();calcMoves();status.textContent="Nouveau niveau ajouté avec une base."}
function genLevel(){if(isLocked()){status.innerHTML='<span class="lockedWarn">Niveau verrouillé.</span>';return}pushLevelUndo("gen");baseMap=arr(generatedMap());normalize();levels[currentLevel].map=map();resetPlay();edit=true;draw();calcMoves();status.textContent="Base générée pour ce niveau."}
function clearMap(){if(isLocked()){status.innerHTML='<span class="lockedWarn">Niveau verrouillé.</span>';return}pushLevelUndo("clear");baseMap=Array.from({length:H},()=>Array(W).fill("."));baseMap[1][1]="A";baseMap[H-2][W-2]="B";normalize();levels[currentLevel].map=map();resetPlay();edit=true;draw();status.textContent="Carte vidée."}
function goLevel(i){writeCurrentLevel();loadFromLevel(i);saveCurrentProgress();status.textContent="Niveau "+(currentLevel+1)+" chargé : "+(levels[currentLevel].name||"sans nom")+"."}
function goInput(){let n=parseInt(document.getElementById("levelInput").value,10);if(!isNaN(n))goLevel(n-1)}

function calcMoves(){
  try{
    writeCurrentLevel();
    let raw=arr(levels[currentLevel].map);
    let pts=solverFindPoints(raw);
    let start=solverFall({m:raw,p:pts.p,ex:pts.ex});
    const maxDepth=32;
    if(start.dead){
      levels[currentLevel].maxMoves=999;
      solverPopup('Calc coups','Impossible dès le départ : <b>'+start.reason+'</b>',false);
      updateStats();
      return;
    }
    let q=[{...start,path:[]}];
    let seen=new Set([solverKey(start)]);
    while(q.length){
      let s=q.shift();
      if(s.p.x==s.ex.x && s.p.y==s.ex.y){
        levels[currentLevel].maxMoves=s.path.length;
        levels[currentLevel].solution=s.path.map(d=>d>0?'R':'L').join('');
        updateStats();
        solverPopup('Calc coups','Objectif 3♥ = <b>'+s.path.length+' coup(s)</b><br>Solution : <b>'+(levels[currentLevel].solution||'déjà sur la sortie')+'</b>',true);
        return;
      }
      if(s.path.length>=maxDepth)continue;
      for(let d of [-1,1]){
        let n=solverRotate(s,d);
        if(n.dead)continue;
        let k=solverKey(n);
        if(!seen.has(k)){
          seen.add(k);
          q.push({...n,path:s.path.concat(d)});
        }
      }
    }
    levels[currentLevel].maxMoves=999;
    updateStats();
    solverPopup('Calc coups','Aucune solution trouvée jusqu’à <b>'+maxDepth+' coups</b>.',false);
  }catch(e){
    console.error('[CALC] erreur',e);
    solverPopup('Calc coups','Erreur JS : <b>'+(e.message||e)+'</b>',false);
  }
}


function setGroupState(g,collapsed){
  g.classList.toggle("collapsed",collapsed);
  const b=g.querySelector("[data-fold]");
  if(b)b.textContent=collapsed?"▸":"▾";
}
function toggleCompactEditor(){
  const groups=[...document.querySelectorAll("#editPanel .group")];
  const anyCollapsed=groups.some(g=>g.classList.contains("collapsed"));
  if(anyCollapsed){
    groups.forEach(g=>setGroupState(g,false));
    document.getElementById("compactEdit").textContent="Compact";
  }else{
    groups.forEach((g,i)=>setGroupState(g,i!==0));
    document.getElementById("compactEdit").textContent="Ouvrir tout";
  }
}
document.querySelectorAll("[data-fold]").forEach(btn=>{
  btn.onclick=()=>{
    const g=btn.closest(".group");
    g.classList.toggle("collapsed");
    btn.textContent=g.classList.contains("collapsed")?"▸":"▾";
  };
});
document.getElementById("compactEdit").onclick=toggleCompactEditor;


function sortByDifficulty(){
  writeCurrentLevel();
  levels.sort((a,b)=>(a.difficulty||1)-(b.difficulty||1));
  currentLevel=savedStartLevel();
  loadFromLevel(currentLevel);
  status.textContent="Niveaux triés par difficulté.";
}
function askDeleteUnlocked(){
  writeCurrentLevel();
  const unlocked=levels.filter(l=>!l.locked).length;
  const locked=levels.length-unlocked;
  const box=document.getElementById("confirmBox");
  document.getElementById("confirmText").innerHTML=
    "Tu vas supprimer <b>"+unlocked+"</b> niveau(x) non verrouillé(s).<br>Il restera <b>"+locked+"</b> niveau(x) verrouillé(s).<br><br>Export levels.json avant, si tu tiens à tes brouillons. Spoiler : tu y tiens toujours après avoir cliqué.";
  box.classList.remove("hidden");
}
function cancelDeleteUnlocked(){
  document.getElementById("confirmBox").classList.add("hidden");
}
function confirmDeleteUnlocked(){
  writeCurrentLevel();
  const kept=levels.filter(l=>l.locked);
  if(kept.length===0){
    status.textContent="Suppression annulée : aucun niveau verrouillé à garder.";
    cancelDeleteUnlocked();
    return;
  }
  levels=kept;
  currentLevel=0;
  cancelDeleteUnlocked();
  loadFromLevel(0);
  saveLocal();
  status.textContent="Tous les niveaux non verrouillés ont été supprimés.";
}



function deleteCurrentLevel(){
  if(!levels.length){status.textContent="Aucun niveau à supprimer.";return;}
  const label=(currentLevel+1)+" - "+(levels[currentLevel].name||"sans nom");
  if(!confirm("Supprimer le niveau courant : "+label+" ?\n\nCette action modifie la liste en mémoire. Exporte ensuite levels.json."))return;
  levels.splice(currentLevel,1);
  if(!levels.length){
    levels.push({name:"Nouveau niveau 1",maxMoves:999,locked:false,difficulty:1,biome:"cosmic",map:generatedMap()});
  }
  currentLevel=Math.max(0,Math.min(currentLevel,levels.length-1));
  levelUndoStack=[];
  loadFromLevel(currentLevel);
  status.textContent="Niveau supprimé. Exporte levels.json pour conserver ce changement.";
}

function cloneGrid(m){ return m.map(r=>r.slice ? r.slice() : r.split("")); }
function solverFindPoints(m){
  let p={x:0,y:0}, ex={x:0,y:0};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(m[y][x]=="A"){p={x,y};m[y][x]="."}
    if(m[y][x]=="B"){ex={x,y}}
  }
  return {p,ex};
}
function solverBlock(c){ return c=="#" || c=="D"; }
function solverWrapX(x){ return x<0?W-1:(x>=W?0:x); }
function solverWrapY(y){ return y<0?H-1:(y>=H?0:y); }
function solverCw(m){
  let o=Array.from({length:H},()=>Array(W).fill("."));
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)o[x][H-1-y]=m[y][x];
  return o;
}
function solverCcw(m){
  let o=Array.from({length:H},()=>Array(W).fill("."));
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)o[W-1-x][y]=m[y][x];
  return o;
}
function solverPcw(q){return{x:H-1-q.y,y:q.x}}
function solverPccw(q){return{x:q.y,y:W-1-q.x}}
function solverToggleDoors(m){
  return m.map(row=>row.map(c=>c=="D"?"O":c=="O"?"D":c));
}
function solverFall(state){
  let m=cloneGrid(state.m), p={...state.p}, ex={...state.ex};
  let safety=0, rotCooldown=!!state.rotCooldown, switchHeld=!!state.switchHeld, tpCooldown=state.tpCooldown||null;
  while(true){
    if(safety++>180)return {dead:true, reason:"boucle pendant la chute"};
    let c=m[p.y][p.x];

    if(c=="X")return {dead:true, reason:"mort"};
    if(c=="S"){
      if(!switchHeld){
        m=solverToggleDoors(m);
        switchHeld=true;
      }
    }else{
      switchHeld=false;
    }

    if(!isTeleporterChar(c)||c!==tpCooldown)tpCooldown=null;
    if(isTeleporterChar(c) && tpCooldown!==c){
      const target=pairedTeleporterPosition(m,p);
      if(target){
        p={x:target.x,y:target.y};
        tpCooldown=c;
        continue;
      }
    }

    if((c=="R"||c=="L") && !rotCooldown){
      let d=c=="R"?1:-1;
      if(d>0){m=solverCw(m); p=solverPcw(p); ex=solverPcw(ex);}
      else{m=solverCcw(m); p=solverPccw(p); ex=solverPccw(ex);}
      rotCooldown=true;
      continue;
    }

    let nx=solverWrapX(p.x), ny=solverWrapY(p.y+1);
    if(!solverBlock(m[ny][nx])){
      let old=p.x+","+p.y;
      p={x:nx,y:ny};
      if((p.x+","+p.y)!==old)rotCooldown=false;
      continue;
    }

    return {dead:false,m,p,ex,rotCooldown,switchHeld,tpCooldown};
  }
}
function solverRotate(state,d){
  let m=cloneGrid(state.m), p={...state.p}, ex={...state.ex};
  if(d>0){m=solverCw(m); p=solverPcw(p); ex=solverPcw(ex);}
  else{m=solverCcw(m); p=solverPccw(p); ex=solverPccw(ex);}
  return solverFall({m,p,ex,switchHeld:!!state.switchHeld,tpCooldown:state.tpCooldown||null});
}
function solverKey(s){
  return s.p.x+","+s.p.y+"|"+s.ex.x+","+s.ex.y+"|sw="+(s.switchHeld?1:0)+"|tp="+(s.tpCooldown||"")+"|"+s.m.map(r=>r.join("")).join("");
}
function testCurrentLevel(){
  try{
    writeCurrentLevel();
    let raw=arr(levels[currentLevel].map);
    let pts=solverFindPoints(raw);
    let start=solverFall({m:raw,p:pts.p,ex:pts.ex});
    const maxDepth=32;

    if(start.dead){
      solverPopup('Test du jeu','Impossible dès le départ : <b>'+start.reason+'</b>',false);
      return;
    }

    let q=[{...start,path:[]}];
    let seen=new Set([solverKey(start)]);

    while(q.length){
      let s=q.shift();
      if(s.p.x==s.ex.x && s.p.y==s.ex.y){
        const path=s.path.map(d=>d>0?"↻":"↺").join(" ");
        levels[currentLevel].maxMoves=s.path.length;
        levels[currentLevel].solution=s.path.map(d=>d>0?'R':'L').join('');
        updateStats();
        solverPopup('Test du jeu','OK, finissable en <b>'+s.path.length+' coup(s)</b><br>Solution : <b>'+(path||'déjà sur la sortie')+'</b>',true);
        return;
      }
      if(s.path.length>=maxDepth)continue;
      for(let d of [-1,1]){
        let n=solverRotate(s,d);
        if(n.dead)continue;
        let k=solverKey(n);
        if(!seen.has(k)){
          seen.add(k);
          q.push({...n,path:s.path.concat(d)});
        }
      }
    }

    solverPopup('Test du jeu','Aucune solution trouvée jusqu’à <b>'+maxDepth+' coups</b>.<br>Niveau probablement bloquant.',false);
  }catch(e){
    console.error('[TEST] erreur',e);
    solverPopup('Test du jeu','Erreur JS : <b>'+(e.message||e)+'</b>',false);
  }
}




// V45 : la progression est rangée par id de niveau. Avant elle l'était par position,
// donc insérer ou réordonner un niveau décalait toute la sauvegarde du joueur.
const PROGRESS_KEY="gravity_cube_player_progress_v2";

function levelKey(idx){
  const l=levels[idx];
  return (l&&l.id) ? String(l.id) : ("i"+idx);
}
function levelIndexFromKey(key){
  for(let i=0;i<levels.length;i++)if(levelKey(i)===key)return i;
  return -1;
}
function loadProgress(){
  try{
    const pr=JSON.parse(localStorage.getItem(PROGRESS_KEY)||"{}")||{};
    if(!pr.best)pr.best={};
    return pr;
  }catch(e){
    return {current:null,best:{}};
  }
}
function saveProgress(data){
  try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(data));}catch(e){}
}
function saveCurrentProgress(){
  const pr=loadProgress();
  pr.current=levelKey(currentLevel);
  saveProgress(pr);
}
function saveWinProgress(){
  const pr=loadProgress();
  const stars=starScore();
  const key=levelKey(currentLevel);
  const old=pr.best[key];
  if(!old || moves<old.moves || stars>old.stars){
    pr.best[key]={moves:moves,stars:stars};
  }
  pr.current=levelKey(Math.min(currentLevel+1,levels.length-1));
  saveProgress(pr);
}
function savedStartLevel(){
  const idx=levelIndexFromKey(loadProgress().current);
  return idx<0 ? 0 : idx;
}

let companionTimer=null, companionIdleTimer=null;
const COMPANION_VERSION="v34";

function currentLevelString(){
  try{return (levels[currentLevel].map||[]).join("");}
  catch(e){return "";}
}
function currentMechanics(){
  const s=currentLevelString();
  return {button:/[SDO]/.test(s), death:s.includes("X"), rot:/[RL]/.test(s), teleporter:/[123]/.test(s)};
}
function companionStage(){
  const m=currentMechanics();
  if(m.teleporter)return "teleporter";
  if(m.rot)return "rotator";
  if(m.death)return "death";
  if(m.button)return "button";
  if(typeof dgChapterOfLevel==="function" && dgChapterOfLevel(currentLevel)?.mechanic==="wrap")return "wrap";
  return currentLevel===0 ? "core" : "";
}
function companionSeenKey(stage){
  return "gravity_cube_companion_"+COMPANION_VERSION+"_seen_"+stage;
}
function companionMessage(kind="intro"){
  const stage=companionStage();
  if(stage==="core"){
    return "Glisse à droite ou à gauche pour tourner le plateau. Je tombe, et je m'arrête au premier obstacle.";
  }
  if(stage==="wrap"){
    return kind==="hint"
      ? "Indice : un bord ouvert n'est pas un mur. Regarde où je réapparais de l'autre côté."
      : "Nouveauté : les bords sont ouverts. Si je sors d'un côté, je reviens par l'autre. Mais trois tours dans le vide, et c'est la chute éternelle.";
  }
  if(stage==="button"){
    return kind==="hint"
      ? "Indice : la clé inverse tous les cadenas. Le bon moment compte plus que la vitesse."
      : "Nouveauté : la clé. Quand je passe dessus, les cadenas fermés s'ouvrent et les cadenas ouverts se referment.";
  }
  if(stage==="death"){
    return kind==="hint"
      ? "Indice : vise d'abord une case sûre où atterrir. La sortie vient après."
      : "Nouveauté : le cœur brisé. Si je le touche, c'est le râteau assuré. On l'évite.";
  }
  if(stage==="rotator"){
    return kind==="hint"
      ? "Indice : le rotateur tourne le monde à ta place. Prévois ma chute après cette rotation forcée."
      : "Nouveauté : le rotateur. Quand je le touche, le plateau tourne tout seul, puis je retombe.";
  }
  if(stage==="teleporter"){
    return kind==="hint"
      ? "Indice : A mène à A, B mène à B. Après la sortie, je continue à tomber dans le même sens."
      : "Nouveauté : les portails. J'entre par une lettre, je ressors par la même lettre. Le plateau ne tourne pas.";
  }
  return kind==="hint"
    ? "Indice : pense en étapes : rotation, chute, arrêt, prochaine rotation."
    : "";
}

function showCompanion(msg, markSeen=false){
  if(edit||gameOver||!msg)return;
  dgSetReact(msg,true);
  if(markSeen){
    const stage=companionStage();
    if(stage){
      try{localStorage.setItem(companionSeenKey(stage),"1")}catch(e){}
    }
  }
}

function hideCompanion(showHelp=true){
  if(levels[currentLevel])dgSetReact(dgReactLine(),false);
}

function scheduleCompanion(forceIntro=false){
  clearTimeout(companionTimer);
  clearTimeout(companionIdleTimer);
  if(edit||gameOver)return;

  const help=document.getElementById("companionHelp");
  if(help)help.classList.remove("hidden");

  const stage=companionStage();
  if(stage){
    let seen=false;
    try{seen=localStorage.getItem(companionSeenKey(stage))==="1"}catch(e){}
    if(!seen){
      companionTimer=setTimeout(()=>showCompanion(companionMessage("intro"),true),550);
      return;
    }
  }

  // Aide légère après attente seulement, et le joueur peut la passer.
  companionIdleTimer=setTimeout(()=>{
    if(!edit&&!gameOver&&moves===0){
      showCompanion(companionMessage("hint"),false);
    }
  },9000);
}

document.getElementById("companionSkip").onclick=()=>{
  const stage=companionStage();
  if(stage){
    try{localStorage.setItem(companionSeenKey(stage),"1")}catch(e){}
  }
  hideCompanion(true);
};

document.getElementById("toggleEdit").onclick=()=>{if(!window.CG_EDITOR_MODE){edit=false;draw();return;}edit=!edit;if(!edit){resetPlay();scheduleCompanion(true)}else{busy=false;gameOver=false;hideBanner();hideCompanion(false);draw()}};
document.getElementById("companionSkip").onclick=()=>{
  const stage=companionStage();
  if(stage){
    try{localStorage.setItem(companionSeenKey(stage),"1")}catch(e){}
  }
  hideCompanion(true);
};
document.getElementById("companionHelp").onclick=()=>{
  userAudioGesture();
  if(dgHelp.on)dgHelpOffer();
  else showCompanion(companionMessage("hint"),false);
};
document.getElementById("pauseBtn")?.addEventListener("click",()=>{userAudioGesture();setPaused(!gamePaused);});
document.getElementById("pauseResume")?.addEventListener("click",()=>setPaused(false));
document.getElementById("pauseSfxToggle")?.addEventListener("click",()=>{
  sfxOn=!sfxOn;
  if(sfxOn && sfxVolume<=0)sfxVolume=DEFAULT_SFX_VOLUME;
  soundOn=sfxOn||musicOn;
  applyAudioVolumes();
  updatePauseButtons();
});
document.getElementById("pauseMusicToggle")?.addEventListener("click",()=>{
  musicOn=!musicOn;
  if(musicOn && musicVolume<=0)musicVolume=DEFAULT_MUSIC_VOLUME;
  soundOn=sfxOn||musicOn;
  applyAudioVolumes();
  updatePauseButtons();
  if(musicOn&&!gamePaused)startElevatorMusic();else stopElevatorMusic();
});
document.getElementById("musicVolumeSlider")?.addEventListener("input",e=>{
  musicVolume=clamp01(Number(e.target.value)/100);
  musicOn=musicVolume>0;
  soundOn=sfxOn||musicOn;
  applyAudioVolumes();
  updatePauseButtons();
  if(musicOn&&!gamePaused)startElevatorMusic();else stopElevatorMusic();
});
document.getElementById("sfxVolumeSlider")?.addEventListener("input",e=>{
  sfxVolume=clamp01(Number(e.target.value)/100);
  sfxOn=sfxVolume>0;
  soundOn=sfxOn||musicOn;
  applyAudioVolumes();
  updatePauseButtons();
});
document.getElementById("pauseRestart")?.addEventListener("click",()=>{setPaused(false);resetPlay();});
document.getElementById("pauseMainMenu")?.addEventListener("click",()=>{setPaused(false);stopElevatorMusic();dgLeaveTo("index.html");});
document.getElementById("pauseSolution")?.addEventListener("click",()=>{setPaused(false);showLevelRecap();});
if(window.DGAds){
  DGAds.onStart=()=>stopElevatorMusic();
  DGAds.onEnd=()=>{if(musicOn&&!edit&&!gameOver&&!gamePaused)startElevatorMusic();};
}
applyAudioVolumes();
updatePauseButtons();
document.getElementById("sideLeft").onclick=()=>turn(-1);document.getElementById("sideRight").onclick=()=>turn(1);document.getElementById("reset").onclick=()=>{userAudioGesture();resetPlay();};
document.getElementById("saveLocal").onclick=saveLocal;document.getElementById("loadLocal").onclick=loadLocal;
document.getElementById("exportJson").onclick=exportJson;document.getElementById("importBtn").onclick=()=>document.getElementById("importFile").click();
document.getElementById("openSvgAssetEditor")?.addEventListener("click",()=>window.open("asset_svg_editor.html","_blank"));
document.getElementById("importFile").onchange=e=>{if(e.target.files[0])importJson(e.target.files[0])};
document.getElementById("addLevel").onclick=addLevel;document.getElementById("genLevel").onclick=genLevel;document.getElementById("clear").onclick=clearMap;
document.getElementById("lvl1").onclick=()=>goLevel(0);document.getElementById("prevLvl").onclick=()=>goLevel(currentLevel-1);document.getElementById("nextLvl").onclick=()=>goLevel(currentLevel+1);document.getElementById("goLvl").onclick=goInput;
document.getElementById("undoLevel").onclick=undoLevelEdit;
document.getElementById("calcMoves").onclick=calcMoves;
document.getElementById("testGame").onclick=testCurrentLevel;
document.getElementById("difficultyInput").onchange=()=>{levels[currentLevel].difficulty=parseInt(document.getElementById("difficultyInput").value||1,10);updateStats();};
const gridSizeInput=document.getElementById("gridSizeInput"); if(gridSizeInput){gridSizeInput.onchange=()=>resizeCurrentLevelTo(gridSizeInput.value);} const applyGridSizeBtn=document.getElementById("applyGridSize"); if(applyGridSizeBtn){applyGridSizeBtn.onclick=()=>resizeCurrentLevelTo(document.getElementById("gridSizeInput").value);}

document.getElementById("fallDelayInput").oninput=()=>{writeGlobalSettingsFromInputs();status.textContent="Chute globale : "+getFallDelayMs()+" ms.";};
document.getElementById("rotationDurationInput").oninput=()=>{writeGlobalSettingsFromInputs();status.textContent="Rotation globale : "+getRotationDurationMs()+" ms.";};

document.getElementById("sortDifficulty").onclick=sortByDifficulty;
document.getElementById("resetProgress").onclick=()=>{localStorage.removeItem(PROGRESS_KEY);status.textContent="Progression joueur remise à zéro.";};
document.getElementById("resetTutorial").onclick=()=>{
  ["core","wrap","button","death","rotator","teleporter"].forEach(s=>{
    try{localStorage.removeItem(companionSeenKey(s))}catch(e){}
  });
  status.textContent="Tutoriel compagnon remis à zéro.";
};
document.getElementById("deleteLevel").onclick=deleteCurrentLevel;
document.getElementById("deleteUnlocked").onclick=askDeleteUnlocked;
document.getElementById("confirmCancel").onclick=cancelDeleteUnlocked;
document.getElementById("confirmDelete").onclick=confirmDeleteUnlocked;
document.getElementById("lockLevel").onclick=toggleLock;
document.getElementById("soundToggle").onclick=toggleSound;
document.getElementById("biomeSelect").onchange=e=>setBiome(e.target.value);
levelNameInput.onchange=()=>{levels[currentLevel].name=levelNameInput.value.trim()||levels[currentLevel].name;updateStats();draw()};
window.onkeydown=e=>{
  const k=e.key.toLowerCase();
  if(e.key=="ArrowLeft"||k=="a"||k=="q")turn(-1);
  if(e.key=="ArrowRight"||k=="d")turn(1);
  if(k=="r")resetPlay();
};

function setLoadingText(msg){
  const el=document.getElementById("loadingText");
  if(el)el.textContent=msg;
}
function hideLoadingOverlay(){
  const el=document.getElementById("loadingOverlay");
  if(el)el.classList.add("hidden");
  dgBootReveal();
}
function showInfoBanner(title,html){
  document.getElementById("bannerArt").innerHTML="";
  bannerTitle.textContent=title;
  bannerText.innerHTML=html;
  starsEl.textContent="";
  bannerAction.textContent="OK";
  bannerAction.onclick=()=>banner.classList.add("hidden");
  document.getElementById("bannerAlt").textContent="";
  banner.classList.remove("lose");
  banner.classList.remove("hidden");
}

function solverPopup(title,html,ok){
  status.innerHTML='<span class="'+(ok?'testOk':'testBad')+'">'+html.replace(/<br>/g,' ')+'</span>';
  if(edit)showInfoBanner(title,html);
}

async function fetchJsonFromCandidates(kind,candidates){
  let lastErr=null;
  for(const path of candidates){
    try{
      const url=path+"?cacheBust="+Date.now();
      console.log("["+kind+"] tentative", url);
      const res=await fetch(url,{cache:"no-store"});
      if(!res.ok)throw new Error("HTTP "+res.status+" sur "+path);
      const data=await res.json();
      console.log("["+kind+"] OK depuis", path);
      return {data,path};
    }catch(e){
      lastErr=e;
      console.warn("["+kind+"] échec", path, e);
    }
  }
  throw lastErr || new Error(kind+" introuvable");
}

function applyLevelsData(data,source){
  gameSettings={...gameSettings,...(data.settings||{})};
  syncSpeedInputs();

  levels=data.levels||data;
  if(!Array.isArray(levels) || !levels.length){
    throw new Error("levels.json chargé depuis "+source+" mais aucun niveau trouvé.");
  }

  levels.forEach(l=>{
    if(!l.biome)l.biome="cosmic";
    if(l.locked===undefined)l.locked=false;
    if(!l.maxMoves)l.maxMoves=999;
    if(!l.difficulty)l.difficulty=1;
  });

  currentLevel=savedStartLevel();
  if(currentLevel>=levels.length)currentLevel=0;

  console.log("[LEVELS] OK source =",source,"|",levels.length,"niveau(x)",levels.map(l=>l.name));
  loadFromLevel(currentLevel);
  setLoadingText("Préparation du niveau…");
  requestAnimationFrame(()=>setTimeout(hideLoadingOverlay,120));

  
  status.textContent="OK : niveaux chargés depuis "+source+" ("+levels.length+" niveau(x)).";
}

function showLevelsJsonError(err){
  hideLoadingOverlay();
  console.error("[LEVELS] ECHEC CHARGEMENT levels.json", err);
  levels=[];
  
  const proto=location.protocol || "";
  const localHint=proto==="file:" ? " Tu ouvres le jeu en file:// : lance run_local_server.bat ou importe le fichier manuellement." : "";
  status.textContent="ERREUR : levels.json non chargé. Vérifie que levels.json est à côté de index.html."+localHint;

  bannerTitle.textContent="levels.json introuvable";
  bannerText.innerHTML=
    "Le jeu ne charge aucun niveau en dur.<br>"+
    "Fichiers attendus au même niveau : <b>index.html</b>, <b>levels.json</b>, <b>vector_assets.json</b>.<br>"+
    "Protocole actuel : <b>"+proto+"</b><br>"+
    (proto==="file:" ? "En local, utilise <b>run_local_server.bat</b> ou le bouton Importer levels.json.<br>" : "")+
    "<button id='manualLevelsImport' class='btn sm' style='margin-top:1rem'>Importer levels.json</button>";
  starsEl.textContent="";
  bannerAction.textContent="Fermer";
  bannerAction.onclick=()=>banner.classList.add("hidden");
  banner.classList.remove("hidden");

  setTimeout(()=>{
    const btn=document.getElementById("manualLevelsImport");
    if(btn)btn.onclick=manualImportLevelsJson;
  },0);
}

function manualImportLevelsJson(){
  const input=document.createElement("input");
  input.type="file";
  input.accept=".json,application/json";
  input.onchange=async()=>{
    const file=input.files && input.files[0];
    if(!file)return;
    try{
      const text=await file.text();
      const data=JSON.parse(text);
      applyLevelsData(data,"import manuel "+file.name);
      banner.classList.add("hidden");
    }catch(e){
      console.error("[LEVELS] import manuel échoué", e);
      alert("Import levels.json impossible : "+(e.message||e));
    }
  };
  input.click();
}

async function loadStaticLevels(){
  setLoadingText("Chargement levels.json…");
  // levels.json est la seule source des niveaux : s'il manque, on l'explique au lieu de servir une vieille copie.
  try{
    const result=await fetchJsonFromCandidates("LEVELS",["./levels.json","levels.json","/levels.json"]);
    applyLevelsData(result.data,result.path);
  }catch(err){
    showLevelsJsonError(err);
  }
}

/* ===== V43.49 IN-GAME ANIMATION LOOP =====
   Avant, les animations vectorielles du jeu étaient rafraîchies environ toutes les
   120 ms quand le cube ne bougeait pas. Résultat : pulse/look/spin visibles dans
   l'éditeur, mais plus saccadés en jeu. Là on passe par requestAnimationFrame,
   avec un cap à 60 fps et un garde-fou pour ne rien dessiner avant le chargement.
*/
const INGAME_ANIM_FPS=60;
let lastIngameAnimTs=0;
function ingameAnimationLoop(ts){
  if(!lastIngameAnimTs)lastIngameAnimTs=ts;
  const minDt=1000/INGAME_ANIM_FPS;
  const dt=ts-lastIngameAnimTs;
  if(dt>=minDt){
    idleTick+=dt/120; // garde la vitesse d'idle d'origine malgré le FPS plus élevé.
    lastIngameAnimTs=ts;
    // après la victoire ou la défaite on continue de dessiner : les personnages réagissent encore
    if(levels.length && Array.isArray(b) && b.length && !edit && !gamePaused && !document.querySelector(".screen.show")){
      dgMotes(dt);
      dgIdle();
      dgHelpUpdate();
      dgFlush();
      draw();
    }
  }
  requestAnimationFrame(ingameAnimationLoop);
}
requestAnimationFrame(ingameAnimationLoop);

function updateGlobalScale(){
  const w=window.innerWidth||document.documentElement.clientWidth||1280;
  const h=window.innerHeight||document.documentElement.clientHeight||720;
  const portrait=w<h;

  // Référence volontairement simple : tout le HUD suit le même coefficient.
  // Desktop large ≈ 1, petites fenêtres/iPhone < 1.
  const refW=portrait ? 390 : 1280;
  const refH=portrait ? 844 : 720;
  const s=Math.max(0.74,Math.min(1,Math.min(w/refW,h/refH)));
  document.documentElement.style.setProperty("--uiScale",s.toFixed(3));
}
window.addEventListener("resize",updateGlobalScale);
window.addEventListener("orientationchange",()=>setTimeout(updateGlobalScale,80));
updateGlobalScale();


/* ===== V44 CHAPTER CAMPAIGN / RELEASE PROGRESSION UI ===== */
const DG_CHAPTER_UNLOCK_PERCENT=70;
let dgChapters=[];
let dgSelectedChapter=0;

function dgPad2(n){return String(n).padStart(2,"0");}
function dgDataLevels(data){return Array.isArray(data?.levels)?data.levels:(Array.isArray(data)?data:[]);}
let dgRawChapters=null;
function dgBuildChapters(data){
  const list=dgDataLevels(data);
  const raw=Array.isArray(data?.chapters)?data.chapters:null;
  dgRawChapters=raw&&raw.length?raw:null;
  const norm=(c,i)=>({
    ...c,
    id:c.id||("chapter_"+(i+1)),
    number:c.number||i+1,
    name:c.name||("Chapitre "+dgPad2(i+1)),
    subtitle:c.subtitle||c.title||"",
    levelIds:Array.isArray(c.levelIds)?c.levelIds.slice():[],
    unlockPercent:Number(c.unlockPercent||DG_CHAPTER_UNLOCK_PERCENT)
  });
  if(dgRawChapters&&list.some(l=>l&&l.chapter)){
    // V45 : chaque niveau porte son chapitre (level.chapter). L'ordre du fichier fait
    // l'ordre dans le chapitre, donc ajouter ou supprimer un niveau ne casse plus rien.
    dgChapters=dgRawChapters.map((c,i)=>({...norm(c,i),levelIds:[]}));
    const byId=new Map(dgChapters.map(c=>[c.id,c]));
    list.forEach((l,i)=>{(byId.get(l&&l.chapter)||dgChapters[dgChapters.length-1]).levelIds.push(i);});
    dgChapters=dgChapters.filter(c=>c.levelIds.length);
  }else if(dgRawChapters){
    dgChapters=dgRawChapters.map(norm);
  }else{
    const titles=["Premier pas","Boutons du cœur","Zones dangereuses","Rotations","Rendez-vous","Dernier choix","Master dates"];
    const size=9;
    dgChapters=[];
    for(let i=0;i<list.length;i+=size){
      const idx=dgChapters.length;
      dgChapters.push({
        id:"c"+dgPad2(idx+1),
        number:idx+1,
        name:"Chapitre "+dgPad2(idx+1),
        subtitle:titles[idx]||("Progression "+dgPad2(idx+1)),
        levelIds:list.slice(i,i+size).map((_,j)=>i+j),
        unlockPercent:DG_CHAPTER_UNLOCK_PERCENT
      });
    }
  }
  if(!dgChapters.length&&list.length){
    dgChapters=[{id:"c01",number:1,name:"Chapitre 01",subtitle:"Premier pas",levelIds:list.map((_,i)=>i),unlockPercent:DG_CHAPTER_UNLOCK_PERCENT}];
  }
}
function dgChapterOfLevel(idx){
  return dgChapters.find(c=>(c.levelIds||[]).includes(idx)) || dgChapters[0] || null;
}
function dgChapterIndexOfLevel(idx){
  return Math.max(0,dgChapters.findIndex(c=>(c.levelIds||[]).includes(idx)));
}
function dgProgress(){return loadProgress ? loadProgress() : {best:{},highestLevel:0,currentLevel:0};}
function dgLevelCompleted(idx){const pr=dgProgress();return !!(pr.best&&pr.best[levelKey(idx)]);}
function dgChapterProgress(ch){
  const ids=(ch&&ch.levelIds)||[];
  if(!ids.length)return {done:0,total:0,percent:0,stars:0};
  const pr=dgProgress();
  let done=0,stars=0;
  ids.forEach(id=>{const b=pr.best&&pr.best[levelKey(id)]; if(b){done++; stars+=Number(b.stars||0);}});
  return {done,total:ids.length,percent:Math.round(done/ids.length*100),stars};
}
function dgChapterUnlocked(chIndex){
  if(window.CG_EDITOR_MODE)return true;
  if(chIndex<=0)return true;
  const prev=dgChapters[chIndex-1];
  const p=dgChapterProgress(prev);
  const need=Number(dgChapters[chIndex]?.unlockPercent||DG_CHAPTER_UNLOCK_PERCENT);
  return p.percent>=need;
}
function dgLevelUnlocked(idx){
  if(window.CG_EDITOR_MODE)return true;
  const ci=dgChapterIndexOfLevel(idx);
  if(!dgChapterUnlocked(ci))return false;
  const ch=dgChapters[ci];
  if(!ch)return idx===0;
  const pos=ch.levelIds.indexOf(idx);
  if(pos<=0)return true;
  return dgLevelCompleted(ch.levelIds[pos-1]);
}
function dgFirstPlayableLevel(){
  for(const ch of dgChapters){
    for(const id of ch.levelIds){ if(dgLevelUnlocked(id)&&!dgLevelCompleted(id)) return id; }
  }
  for(let i=0;i<levels.length;i++) if(dgLevelUnlocked(i)) return i;
  return 0;
}
function dgSafeStartLevel(){
  let idx=levelIndexFromKey(dgProgress().current);
  if(idx<0)idx=0;
  return dgLevelUnlocked(idx)?idx:dgFirstPlayableLevel();
}
/* ===== V49 NÉON CIRCUIT : interface et sensations =====
   Tout ce qui s'affiche ou s'entend en dehors des règles du jeu passe par ici :
   écrans (chapitres, niveaux, rencontres), fenêtres (victoire, défaite, indice), transitions,
   notes de musique, effets de chute et d'impact. Les règles (turn / fall / blocs) ne changent pas. */
const DG_WORLDS=DGSpirit.WORLDS; // deux couleurs par chapitre, partagées avec le menu
const DG_MECH_LABEL={base:"tourner, tomber",wrap:"bords ouverts",button:"clés et cadenas",danger:"cœurs brisés",rotator:"rotateurs",teleporter:"téléporteurs",mix:"tout mélangé"};
let dgC1=DG_WORLDS[0][0],dgC2=DG_WORLDS[0][1];
let dgTutoActive=false;
let dgSkipProfileOnce=false;
let dgFallAnim=null;   // case en cours de franchissement : {x,from,to,t0,dur,v,n}
let dgImpact=null;     // dernier atterrissage : {t,imp,x,y,flash}
let dgRot=null;        // rotation en cours : {dir,angle,k}
let dgMelody=[];       // les notes jouées depuis le début du niveau
let dgMoteY=0,dgLastDraw=0,dgTubeD="",dgStaticKey="";

function setStatus(t){status.textContent=t;}
function showVectorAssetsError(err){console.error("[VECTOR_ASSETS]",err);}
/* --- qui est qui */
function dgMeSex(){return readCharacterGender("dcg_me_gender","boy")==="girl"?"f":"m";}
function dgDateSex(){return readCharacterGender("dcg_date_gender","girl")==="boy"?"m":"f";}
function dgCurPerson(){return DGSpirit.person(dgChapterIndexOfLevel(currentLevel||0));}
function dgDateName(){return dgCurPerson().name;}
function dgPortrait(el,kind,sex,state){
  if(typeof el==="string")el=document.getElementById(el);
  if(el)el.innerHTML=DGSpirit.portrait(kind,sex,state);
}
function dgLevelPos(idx){
  const ch=dgChapterOfLevel(idx), ci=dgChapterIndexOfLevel(idx);
  return {ch,ci,number:(ch&&ch.number)||ci+1,pos:ch?ch.levelIds.indexOf(idx)+1:idx+1};
}
/* Un décor par chapitre, à l'image de la personne qu'on y rencontre : teinte du fond + motif
   (vagues, feuilles, étoiles, nuages, lunes, éclairs, pétales, cristaux). */
const DG_BIOMES=[
  ["#0b1533","M0 44q22 -18 45 0t45 0t45 0t45 0M0 134q22 -18 45 0t45 0t45 0t45 0"],
  ["#0a1a22","M28 52q20 -30 42 0q-22 30 -42 0zM28 52h42"],
  ["#1a0f2e","M44 24l6 15l15 6l-15 6l-6 15l-6 -15l-15 -6l15 -6z"],
  ["#0e1836","M26 62a12 12 0 0 1 12 -14a16 16 0 0 1 30 -2a12 12 0 0 1 10 16z"],
  ["#120d34","M50 26a22 22 0 1 0 20 34a17 17 0 1 1 -20 -34z"],
  ["#1c1420","M52 18l-18 34h14l-8 30l26 -40h-15l10 -24z"],
  ["#220f2a","M48 50q-20 -20 0 -30q20 10 0 30q20 -20 30 0q-10 20 -30 0q20 20 0 30q-20 -10 0 -30q-20 20 -30 0q10 -20 30 0z"],
  ["#0c1a2e","M50 18l18 22l-18 30l-18 -30zM32 40h36"]
];
let dgTintIndex=-1;
function dgTint(ci){
  ci=ci%DG_WORLDS.length;
  if(ci===dgTintIndex)return;
  dgTintIndex=ci;
  const w=DG_WORLDS[ci],bio=DG_BIOMES[ci%DG_BIOMES.length],root=document.documentElement.style;
  dgC1=w[0];dgC2=w[1];
  root.setProperty("--c1",dgC1);
  root.setProperty("--c2",dgC2);
  root.setProperty("--bg",bio[0]);
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" fill="none" stroke="'+dgC2+'" stroke-opacity=".5" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="'+bio[1]+'"/><g transform="translate(98 94) scale(.7)"><path d="'+bio[1]+'"/></g></svg>';
  root.setProperty("--biome",'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")');
}
/* Coup de pouce. Le joueur « peine » sur un niveau après deux essais ratés ou recommencés, trois coups
   de trop, ou une minute et demie sans réussir. La personne à rejoindre propose alors son aide : une
   bulle « ? » au-dessus de sa tête, et sa réplique change. Rien ne s'ouvre tout seul. */
let dgHelp={level:-1,fails:0,since:0,snooze:false,on:false};
function dgHelpTrack(){
  if(dgHelp.level!==currentLevel)dgHelp={level:currentLevel,fails:0,since:performance.now(),snooze:false,on:dgHelp.on};
}
function dgHelpFail(){dgHelpTrack();dgHelp.fails++;dgHelp.snooze=false;}
function dgHelpUpdate(){
  dgHelpTrack();
  const l=levels[currentLevel],max=Number(l&&l.maxMoves)||0;
  const stuck=dgHelp.fails>=2||(max>0&&max<999&&moves>=max+3)||performance.now()-dgHelp.since>90000;
  const on=stuck&&!dgHelp.snooze&&!gameOver&&!edit&&!!(l&&l.solution);
  if(on===dgHelp.on)return;
  dgHelp.on=on;
  document.getElementById("companionDock").classList.toggle("help",on);
  if(!dgTutoActive)dgSetReact(dgReactLine(),false);
}
function dgHelpOffer(){
  const person=dgCurPerson(),alt=document.getElementById("bannerAlt");
  dgPortrait("bannerArt",person.kind,dgDateSex(),{eye:"happy"});
  bannerTitle.textContent="Un coup de pouce ?";
  bannerText.textContent=person.name+" peut te montrer comment la rejoindre. Tu peux aussi continuer à chercher.".replace("la rejoindre",dgDateSex()==="m"?"le rejoindre":"la rejoindre");
  starsEl.textContent="";
  bannerAction.innerHTML='💡 Voir la solution<span class="adtag">PUB</span>';
  bannerAction.onclick=()=>{dgHelp.snooze=true;banner.classList.add("hidden");dgRequestSolution();};
  alt.textContent="Je continue";
  alt.onclick=()=>{dgHelp.snooze=true;banner.classList.add("hidden");};
  banner.classList.remove("lose");
  banner.classList.remove("hidden");
}
/* Commandes : glisser (par défaut) ou deux boutons de rotation. Le choix se fait dans les options du menu
   ou dans la pause ; il est gardé dans le téléphone. Le geste reste actif même avec les boutons. */
const DG_CONTROLS_KEY="dg_controls";
function dgControls(){
  try{return localStorage.getItem(DG_CONTROLS_KEY)==="buttons"?"buttons":"swipe";}catch(e){return "swipe";}
}
function dgApplyControls(){
  const buttons=dgControls()==="buttons";
  document.body.classList.toggle("btnCtl",buttons);
  document.getElementById("pauseControls").textContent="Commandes : "+(buttons?"boutons":"glisser");
}
document.getElementById("pauseControls").onclick=()=>{
  try{localStorage.setItem(DG_CONTROLS_KEY,dgControls()==="buttons"?"swipe":"buttons");}catch(e){}
  dgApplyControls();
};
dgApplyControls();
/* rappel du swipe : seulement quand le joueur ne fait rien depuis un moment (plus longtemps s'il connaît déjà le geste) */
let dgIdleAt=performance.now(),dgHintOn=false,dgHintDelay=3500;
function dgIdle(){
  const el=document.getElementById("swipeHint");
  if(!el)return;
  const now=performance.now();
  if(busy||gameOver||stage.classList.contains("swiping")||dgUiOpen())dgIdleAt=now;
  const on=now-dgIdleAt>dgHintDelay;
  if(on===dgHintOn)return;
  dgHintOn=on;
  el.classList.toggle("show",on);
  if(!on){
    let n=0;
    try{n=Number(localStorage.getItem("dg_swipe_count"))||0;}catch(e){}
    dgHintDelay=n>=3?12000:3500;
  }
}
document.addEventListener("pointerdown",()=>{dgIdleAt=performance.now();},{passive:true});
/* ce que la rencontre du chapitre est devenue (voir DGSpirit.status) */
function dgRelation(ci){
  const ch=dgChapters[ci];
  const p=ch?dgChapterProgress(ch):{done:0,total:1,stars:0};
  return Object.assign({done:p.done,total:p.total,stars:p.stars},DGSpirit.status(p.done,p.total,p.stars));
}

/* --- transitions
   Règle : les RUBANS pour tout ce qui est navigation, le TAMPON pour les moments de jeu,
   et un DÉFILEMENT du plateau entre deux niveaux d'un même chapitre. */
const dgTx={busy:false};
const DG_BAND_IN=[{transform:"translateX(-130%) skewX(-18deg)"},{transform:"translateX(0) skewX(-18deg)"}];
const DG_BAND_OUT=[{transform:"translateX(0) skewX(-18deg)"},{transform:"translateX(130%) skewX(-18deg)"}];
function dgReducedMotion(){return !!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);}
function dgBandsOut(layer,bands){
  let last;
  bands.forEach((b,i)=>{last=b.animate(DG_BAND_OUT,{duration:300,delay:60+i*60,easing:"cubic-bezier(.6,0,.4,1)",fill:"forwards"});});
  return last.finished.then(()=>{bands.forEach(b=>b.remove());layer.classList.remove("block");dgTx.busy=false;});
}
function dgRubans(swap,opts={}){
  const layer=document.getElementById("txLayer");
  if(!layer||dgTx.busy||dgReducedMotion()){if(swap)swap();return Promise.resolve();}
  dgTx.busy=true;
  layer.classList.add("block");
  const bands=[dgC1,dgC2,"#0d1230"].map(c=>{const b=document.createElement("div");b.className="band";b.style.background=c;layer.appendChild(b);return b;});
  let last;
  bands.forEach((b,i)=>{last=b.animate(DG_BAND_IN,{duration:280,delay:i*60,easing:"cubic-bezier(.6,0,.4,1)",fill:"forwards"});});
  return last.finished.then(()=>{
    try{if(swap)swap();}catch(e){console.error("[TX]",e);}
    if(opts.stay)return; // on quitte la page : les rubans restent fermés, la page suivante les ouvrira
    return dgBandsOut(layer,bands);
  });
}
function dgLeaveTo(url){
  try{sessionStorage.setItem("dg_tx","1");}catch(e){}
  dgRubans(()=>{window.location.href=url;},{stay:true});
}
function dgBootReveal(){
  const root=document.documentElement, layer=document.getElementById("txLayer");
  if(!layer||!root.classList.contains("tx-in"))return;
  const bands=[...layer.querySelectorAll(".band.boot")];
  dgTx.busy=true;
  layer.classList.add("block");
  dgBandsOut(layer,bands).then(()=>root.classList.remove("tx-in"));
}
function dgTampon(word,swap,dark){
  const layer=document.getElementById("txLayer");
  if(!layer||dgTx.busy||dgReducedMotion()){if(swap)swap();return Promise.resolve();}
  dgTx.busy=true;
  layer.classList.add("block");
  const st=document.createElement("div");
  st.className="stamp"+(dark?" dark":"");
  const sp=document.createElement("span");sp.textContent=word;st.appendChild(sp);
  layer.appendChild(st);
  const base="translate(-50%,-50%) rotate(-10deg) ";
  return st.animate([{opacity:0,transform:base+"scale(3.4)"},{opacity:1,transform:base+"scale(1)"}],{duration:170,easing:"cubic-bezier(.3,0,.2,1)",fill:"forwards"}).finished.then(()=>{
    dgThump(.8);
    document.getElementById("app").animate([{transform:"translate(0,0)"},{transform:"translate(-.5rem,.3rem)"},{transform:"translate(.4rem,-.3rem)"},{transform:"translate(-.3rem,.2rem)"},{transform:"none"}],{duration:180});
    return new Promise(r=>setTimeout(r,280));
  }).then(()=>{
    try{if(swap)swap();}catch(e){console.error("[TX]",e);}
    return st.animate([{opacity:1,transform:base+"scale(1)"},{opacity:0,transform:base+"scale(5)"}],{duration:260,easing:"ease-in",fill:"forwards"}).finished;
  }).then(()=>{st.remove();layer.classList.remove("block");dgTx.busy=false;});
}
/* Niveau suivant : l'ancien plateau sort du cadre, le nouveau entre en le suivant.
   Le sens change à chaque niveau (bas, gauche, haut, droite), comme une carte qu'on parcourt. */
function dgAdvance(target){
  const info=dgLevelPos(target), pr=loadProgress();
  const newPerson=info.pos===1 && !(pr.met&&info.ch&&pr.met[info.ch.id]);
  const wrap=document.querySelector(".boardWrap");
  if(newPerson||dgReducedMotion()||dgTx.busy||!wrap||!wrap.animate){dgRubans(()=>goLevel(target));return;}
  const dv=[[0,1],[-1,0],[0,-1],[1,0]][target%4];
  const r=wrap.getBoundingClientRect(), sr=stage.getBoundingClientRect();
  const ghost=wrap.cloneNode(true);
  ghost.querySelectorAll("[id]").forEach(e=>e.removeAttribute("id"));
  ghost.classList.add("ghostBoard");
  ghost.style.left=(r.left-sr.left)+"px";ghost.style.top=(r.top-sr.top)+"px";ghost.style.width=r.width+"px";
  stage.appendChild(ghost);
  dgTx.busy=true;
  goLevel(target); // dessine déjà le niveau suivant, hors champ
  const dist=Math.max(sr.width,sr.height)*1.15;
  const opt={duration:500,easing:"cubic-bezier(.65,0,.25,1)",fill:"both"};
  ghost.animate([{transform:"none"},{transform:"translate("+(dv[0]*dist)+"px,"+(dv[1]*dist)+"px)"}],opt);
  const a=wrap.animate([{transform:"translate("+(-dv[0]*dist)+"px,"+(-dv[1]*dist)+"px)"},{transform:"none"}],opt);
  dgPluck(dgNoteAt(1,target%7),.014);
  a.finished.then(()=>{ghost.remove();a.cancel();dgTx.busy=false;resetPlay();});
}

/* --- écrans pleins */
function dgShowScreen(id){
  const el=document.getElementById(id);
  if(!el)return;
  el.classList.add("show");
  el.setAttribute("aria-hidden","false");
}
function dgHideScreen(id){
  const el=document.getElementById(id);
  if(!el)return;
  el.classList.remove("show");
  el.setAttribute("aria-hidden","true");
}
function dgUiOpen(){
  return !!document.querySelector(".screen.show") || !banner.classList.contains("hidden") || !document.getElementById("winScreen").classList.contains("hidden");
}

/* --- bulle : tutoriel, indice, ou petite phrase selon l'avancée */
function dgReactLine(){
  if(dgHelp.on)return "Besoin d'un coup de pouce ? Touche-moi.";
  const max=Number(levels[currentLevel]?.maxMoves)||0;
  if(moves===0)return "Je t'attends, viens !";
  const left=max-moves;
  if(left>1)return "Encore "+left+" coups pour le sans-faute.";
  if(left===1)return "Plus qu'un coup pour le sans-faute !";
  if(left===0)return "C'était le dernier coup du sans-faute…";
  return "Prends ton temps, je ne bouge pas.";
}
function dgSetReact(text,tuto){
  const t=document.getElementById("companionText");
  const bubble=document.getElementById("reactBubble");
  const skip=document.getElementById("companionSkip");
  if(!t)return;
  if(t.textContent!==text){
    t.textContent=text;
    if(bubble){bubble.classList.remove("pop");void bubble.offsetWidth;bubble.classList.add("pop");}
  }
  if(skip)skip.classList.toggle("hidden",!tuto);
  dgTutoActive=!!tuto;
}

/* --- musique du plateau
   Chaque mur a sa note, toujours la même : en avançant dans le niveau on compose une petite phrase,
   rejouée à la victoire. Gamme pentatonique (aucune fausse note possible), une tonalité par chapitre. */
const DG_SCALES=[[60,[0,2,4,7,9]],[62,[0,2,4,7,9]],[57,[0,3,5,7,10]],[64,[0,2,4,7,9]],[55,[0,2,4,7,9]],[58,[0,3,5,7,10]],[65,[0,2,4,7,9]],[60,[0,3,5,7,10]]];
const dgHz=midi=>440*Math.pow(2,(midi-69)/12);
function dgNoteAt(cx,cy){
  // le plateau a tourné : on ramène la case dans le repère d'origine pour qu'un mur garde sa note
  let q={x:cx,y:cy};
  for(let i=0;i<visualOri;i++)q={x:q.y,y:W-1-q.x};
  const sc=DG_SCALES[dgChapterIndexOfLevel(currentLevel||0)%DG_SCALES.length];
  const i=(((q.x*2+q.y*3)%10)+10)%10;
  return dgHz(sc[0]+sc[1][i%5]+12*Math.floor(i/5));
}
function dgGain(g){
  if(!soundOn||!sfxOn||sfxVolume<=0)return 0;
  return Math.min(SFX_MAX_GAIN,g*sfxVolume*SFX_GAIN_BOOST);
}
function dgPluck(freq,gain=.03,when=0){
  const vol=dgGain(gain);
  if(!vol||!audioCtx)return;
  const ac=audioCtx,t=ac.currentTime+when;
  [[1,"triangle",1],[2,"sine",.32]].forEach(v=>{
    const o=ac.createOscillator(),g=ac.createGain();
    o.type=v[1];o.frequency.value=freq*v[0];
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(vol*v[2],t+.012);
    g.gain.exponentialRampToValueAtTime(.0001,t+.52);
    o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+.56);
  });
}
function dgThump(imp){
  const vol=dgGain(.02+imp*.05);
  if(!vol||!audioCtx)return;
  const ac=audioCtx,t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();
  o.type="sine";o.frequency.setValueAtTime(150+imp*40,t);o.frequency.exponentialRampToValueAtTime(42,t+.13);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+.16+imp*.12);
  o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+.36);
}
let dgNoise=null;
function dgWhoosh(v){
  if(!audioCtx)return;
  const ac=audioCtx;
  if(!dgNoise){
    if(v<=0)return;
    const buf=ac.createBuffer(1,ac.sampleRate,ac.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const src=ac.createBufferSource();src.buffer=buf;src.loop=true;
    const f=ac.createBiquadFilter();f.type="bandpass";f.Q.value=1.2;
    const g=ac.createGain();g.gain.value=0;
    src.connect(f);f.connect(g);g.connect(ac.destination);src.start();
    dgNoise={f,g};
  }
  dgNoise.g.gain.setTargetAtTime(dgGain(.006)*v,ac.currentTime,.03);
  dgNoise.f.frequency.setTargetAtTime(500+v*2600,ac.currentTime,.03);
}
/* à la victoire : on rejoue la phrase du niveau, puis l'accord de la tonalité */
function dgPlayMelody(){
  const notes=dgMelody.slice(-14), bars=[...document.querySelectorAll("#winMelody i")];
  notes.forEach((f,i)=>{
    dgPluck(f,.024,i*.095);
    setTimeout(()=>{if(bars[i])bars[i].classList.add("on");},i*95);
  });
  const sc=DG_SCALES[dgChapterIndexOfLevel(currentLevel||0)%DG_SCALES.length], end=notes.length*.095+.06;
  [0,sc[1][2],7,12].forEach((semi,i)=>dgPluck(dgHz(sc[0]+semi),.02,end+i*.03));
}

/* --- chute et impact */
/* Coups en attente : un swipe fait pendant une rotation ou une chute n'est pas perdu, il part dès
   l'atterrissage. Deux au plus, pour ne pas enchaîner des coups que le joueur n'a pas vus venir. */
let dgQueue=[];
function dgFlush(){
  if(!dgQueue.length||busy)return;
  if(edit||gameOver||gamePaused||dgUiOpen()){dgQueue=[];return;}
  turn(dgQueue.shift());
}
/* tant qu'un coup attend, la chute et la rotation en cours se dépêchent */
function dgStepDelay(n){return Math.max(dgQueue.length?10:18,getFallDelayMs()*(dgQueue.length?1.1:1.9)*(Math.sqrt(n+1)-Math.sqrt(n)));}
function dgStepSpeed(ms){return Math.max(0,Math.min(1,(getFallDelayMs()*1.9/Math.max(1,ms)-1)/3.6));}
function dgLand(dist){
  dgFallAnim=null;
  dgWhoosh(0);
  const imp=Math.min(1,dist/6);
  dgImpact={t:performance.now(),imp:Math.max(.1,imp),x:p.x,y:p.y,flash:dist>0};
  if(dist>0){shake(dist);gravelFx(dist);dgThump(imp);}
  if(dist===0&&moves===0)return; // posé au départ du niveau : pas encore de note
  const f=dgNoteAt(wrapX(p.x),wrapY(p.y+1));
  if(!document.querySelector(".screen.show"))dgPluck(f,.022+imp*.02);
  dgMelody.push(f);
  if(dgMelody.length>32)dgMelody.shift();
}
/* rotation du plateau : il dépasse un peu les 90° puis revient */
function dgSpin(d,from,done){
  const full=Math.max(160,getRotationDurationMs()*1.5),token=fallToken,t0=performance.now();
  dgRot={dir:d,angle:from,k:0};
  if(dgImpact)dgImpact.flash=false;
  (function tick(now){
    if(token!==fallToken){dgRot=null;return;}
    const dur=dgQueue.length?full*.6:full;
    const k=Math.min(1,(now-t0)/dur),e=1+2.9*Math.pow(k-1,3)+1.9*Math.pow(k-1,2);
    const a=from+(d*90-from)*e;
    rot.setAttribute("transform","rotate("+a+" "+(BOARD/2)+" "+(BOARD/2)+")");
    dgRot.angle=a;dgRot.k=k;
    if(k<1){requestAnimationFrame(tick);return;}
    rot.setAttribute("transform","rotate(0 "+(BOARD/2)+" "+(BOARD/2)+")");
    dgRot=null;
    done();
  })(t0);
}

/* --- victoire : un bandeau bas, le plateau reste visible */
function dgShowWin(kind,finalText){
  const l=levels[currentLevel], s=starScore(), info=dgLevelPos(currentLevel);
  const last=currentLevel===levels.length-1;
  const chapterDone=!!info.ch && info.ch.levelIds[info.ch.levelIds.length-1]===currentLevel;
  document.getElementById("winTitle").textContent=last?"Fin de l'histoire":(chapterDone?"Chapitre terminé":"Match !");
  document.getElementById("winHearts").innerHTML="<span>♥</span>".repeat(s)+"<u>"+"♥".repeat(3-s)+"</u>";
  document.getElementById("winMoves").textContent=(last&&finalText?finalText+" ":"")+moves+" coup"+(moves>1?"s":"")+" · objectif "+(l.maxMoves||"?");
  // la phrase composée pendant le niveau
  const notes=dgMelody.slice(-14), lo=Math.min(...notes,9999), hi=Math.max(...notes,0);
  document.getElementById("winMelody").innerHTML=notes.map(f=>'<i style="height:'+(30+70*(hi>lo?(f-lo)/(hi-lo):.5))+'%"></i>').join("");
  // fin de chapitre : ce que la rencontre est devenue
  const relEl=document.getElementById("winRel");
  relEl.innerHTML="";
  if(chapterDone||last){
    const person=DGSpirit.person(info.ci), rel=dgRelation(info.ci);
    relEl.innerHTML='<div class="art">'+DGSpirit.portrait(person.kind,dgDateSex(),{eye:"happy",mouth:"grin"})+'</div><div><b></b><span></span></div>';
    relEl.querySelector("b").textContent=person.name+" · "+rel.label;
    relEl.querySelector("span").textContent=rel.stars+" / "+(rel.total*3)+" ♥"+(rel.rank<5?" · rejoue pour aller plus loin":"");
  }
  const next=document.getElementById("winNext"), replay=document.getElementById("winReplay");
  next.disabled=false;
  if(last){
    next.textContent="Mes rencontres";
    next.onclick=()=>dgRubans(()=>{hideBanner();dgShowCollection();});
  }else{
    next.textContent=chapterDone?"Chapitre suivant":"Suivant";
    next.onclick=()=>{
      // Un interstitiel peut s'intercaler ici, jamais ailleurs. DGAds décide de la fréquence.
      const target=currentLevel+1;
      next.disabled=true;
      const ad=window.DGAds?DGAds.maybeInterstitial({chapterIndex:info.ci}):Promise.resolve();
      ad.finally(()=>{next.disabled=false;dgAdvance(target);});
    };
  }
  replay.onclick=()=>resetPlay();
  document.getElementById("winScreen").classList.remove("hidden");
  dgPlayMelody();
}

/* --- solution contre pub récompensée */
const dgSolutionSeen=new Set(); // solutions déjà débloquées pendant cette session
async function dgRequestSolution(){
  if(edit || !levels[currentLevel])return;
  const key=levelKey(currentLevel);
  if(!levels[currentLevel].solution){showInfoBanner("Pas de solution","Ce niveau n'a pas encore de solution enregistrée.");return;}
  if(!(window.CG_EDITOR_MODE || dgSolutionSeen.has(key))){
    const ok=await (window.DGAds?DGAds.showRewarded("solution"):Promise.resolve(true));
    if(!ok || levelKey(currentLevel)!==key)return;
    dgSolutionSeen.add(key);
  }
  dgShowSolution();
}
function showLevelRecap(){return dgRequestSolution();}
function dgShowSolution(){
  const l=levels[currentLevel];
  const seq=String(l.solution||"");
  const helper=DGSpirit.person(dgChapterIndexOfLevel(currentLevel)+3);
  dgPortrait("bannerArt",helper.kind,dgDateSex()==="f"?"m":"f",{eye:"happy"});
  bannerTitle.textContent="Le coup de pouce";
  bannerText.textContent=helper.name+" te souffle la solution, depuis le début du niveau :";
  starsEl.innerHTML='<div class="seq">'+seq.split("").map(c=>c==="R"?'<b class="r">⟳</b>':'<b>⟲</b>').join("")+'</div>'+
    '<p>'+seq.length+' coup'+(seq.length>1?'s':'')+' · ⟳ tourne vers la droite, ⟲ tourne vers la gauche</p>';
  const alt=document.getElementById("bannerAlt");
  bannerAction.textContent="Recommencer";
  bannerAction.onclick=()=>resetPlay();
  alt.textContent=gameOver?"":"Fermer";
  alt.onclick=()=>banner.classList.add("hidden");
  banner.classList.remove("lose");
  banner.classList.remove("hidden");
}

/* --- nouvelle rencontre : affichée une seule fois, au premier niveau de chaque chapitre */
function dgShowIntro(){
  const info=dgLevelPos(currentLevel), person=DGSpirit.person(info.ci);
  document.getElementById("pfWhere").textContent="chapitre "+info.number;
  document.getElementById("pfBest").textContent=(info.ch?info.ch.levelIds.length:0)+" niveaux";
  dgPortrait("pfArt",person.kind,dgDateSex());
  document.getElementById("pfName").textContent=person.name;
  document.getElementById("pfBio").textContent=person.line;
  const tg=document.getElementById("pfTags");
  tg.innerHTML="";
  [info.ch&&info.ch.subtitle,DG_MECH_LABEL[info.ch&&info.ch.mechanic]].filter(Boolean).forEach(t=>{const sp=document.createElement("span");sp.textContent=t;tg.appendChild(sp);});
  dgShowScreen("profileScreen");
}
function dgOnLevelLoaded(){
  const info=dgLevelPos(currentLevel), person=DGSpirit.person(info.ci);
  dgPortrait("companionHelp",person.kind,dgDateSex());
  if(edit||dgSkipProfileOnce)return;
  const pr=loadProgress();
  if(info.ch && info.pos===1 && !(pr.met&&pr.met[info.ch.id]))dgShowIntro();
}

/* --- chapitres, niveaux, rencontres */
function dgRenderChapterList(){
  const host=document.getElementById("dgChapterRows");
  if(!host)return;
  host.innerHTML="";
  const current=dgChapterIndexOfLevel(dgFirstPlayableLevel());
  dgChapters.forEach((ch,i)=>{
    const p=dgChapterProgress(ch), open=dgChapterUnlocked(i), person=DGSpirit.person(i), w=DG_WORLDS[i%DG_WORLDS.length];
    const row=document.createElement("button");
    row.type="button";
    row.className="row"+(open?(i===current?" cur":""):" lock");
    row.style.setProperty("--rc1",w[0]);row.style.setProperty("--rc2",w[1]);
    row.innerHTML='<div class="av"></div><div class="tx"><b></b><span></span><em class="bar"><i></i></em></div><div class="st"></div>';
    dgPortrait(row.querySelector(".av"),person.kind,dgDateSex(),p.done>=p.total&&p.total?{eye:"happy",mouth:"grin"}:null);
    row.querySelector("b").textContent=ch.subtitle||ch.name;
    row.querySelector("span").textContent=(open?person.name:"???")+" · "+(DG_MECH_LABEL[ch.mechanic]||"");
    row.querySelector(".bar i").style.width=p.percent+"%";
    row.querySelector(".st").textContent=open?(p.done+"/"+p.total+(p.done>=p.total?" ✓":"")):"🔒";
    row.onclick=()=>{
      userAudioGesture();
      if(open)dgRubans(()=>dgShowChapterScreen(i));
    };
    host.appendChild(row);
  });
}
function dgShowChapterList(){
  setPaused(false);
  dgRenderChapterList();
  ["chapterScreen","profileScreen","collection"].forEach(dgHideScreen);
  dgShowScreen("chapterList");
}
function dgRenderChapterScreen(chapterIndex=dgSelectedChapter){
  if(!dgChapters.length)return;
  chapterIndex=Math.max(0,Math.min(dgChapters.length-1,chapterIndex));
  dgSelectedChapter=chapterIndex;
  const ch=dgChapters[chapterIndex], p=dgChapterProgress(ch), ids=ch.levelIds||[], person=DGSpirit.person(chapterIndex);
  document.getElementById("dgChapterSub").textContent=ch.subtitle||ch.name;
  document.getElementById("dgChapterMeter").textContent=person.name+" · "+p.done+" / "+p.total+" · "+p.stars+" ♥";
  document.getElementById("dgChapterTitle").textContent=p.percent+" %";
  const gridEl=document.getElementById("dgLevelGrid");
  const nextPlayable=dgFirstPlayableLevel();
  gridEl.innerHTML="";
  ids.forEach((id,pos)=>{
    const locked=!dgLevelUnlocked(id), done=dgLevelCompleted(id), boss=pos===ids.length-1;
    const btn=document.createElement("button");
    btn.type="button";
    btn.className="tile"+(locked?" lock":done?" done":"")+(id===nextPlayable&&!done?" cur":"");
    btn.style.animationDelay=(pos*22)+"ms";
    btn.innerHTML=(pos+1)+'<div class="ic"></div><span class="stars"></span>';
    const ic=btn.querySelector(".ic");
    if(locked)ic.textContent=boss?"👑":"🔒";
    else if(done)dgPortrait(ic,person.kind,dgDateSex(),{eye:"happy",mouth:"grin"});
    else dgPortrait(ic,"flamme",dgMeSex());
    const st=dgProgress().best?.[levelKey(id)];
    btn.querySelector(".stars").textContent=st?"♥".repeat(Math.max(0,Math.min(3,Number(st.stars)||0))):"";
    btn.onclick=()=>{
      userAudioGesture();
      if(locked)return;
      dgRubans(()=>{dgHideChapterScreen();loadFromLevel(id);});
    };
    gridEl.appendChild(btn);
  });
  const nextUnlocked=dgChapterUnlocked(chapterIndex+1);
  const prev=document.getElementById("dgPrevChapter"), next=document.getElementById("dgNextChapter");
  prev.disabled=chapterIndex<=0;
  prev.onclick=()=>{ if(chapterIndex>0)dgRenderChapterScreen(chapterIndex-1); };
  next.disabled=chapterIndex>=dgChapters.length-1 || !nextUnlocked;
  next.onclick=()=>{ if(chapterIndex<dgChapters.length-1 && nextUnlocked)dgRenderChapterScreen(chapterIndex+1); };
  const where=(chapterIndex+1)+" / "+dgChapters.length;
  const need=Number(dgChapters[chapterIndex+1]?.unlockPercent||DG_CHAPTER_UNLOCK_PERCENT);
  document.getElementById("dgNextCaption").textContent=(chapterIndex>=dgChapters.length-1||nextUnlocked)?where:(where+" · suite à "+need+" %");
}
function dgShowChapterScreen(chapterIndex=dgChapterIndexOfLevel(currentLevel||0)){
  setPaused(false);
  dgRenderChapterScreen(chapterIndex);
  ["profileScreen","collection"].forEach(dgHideScreen);
  dgShowScreen("chapterScreen");
}
function dgHideChapterScreen(){
  ["chapterScreen","chapterList","collection"].forEach(dgHideScreen);
}
/* la collection : une carte par personne rencontrée, avec ce qu'elle est devenue pour toi */
function dgRenderCollection(){
  const host=document.getElementById("colGrid");
  let met=0;
  host.innerHTML="";
  dgChapters.forEach((ch,i)=>{
    const person=DGSpirit.person(i), rel=dgRelation(i), w=DG_WORLDS[i%DG_WORLDS.length];
    if(rel.rank>0)met++;
    const card=document.createElement("button");
    card.type="button";
    card.className="pcard "+rel.key;
    card.style.setProperty("--pc1",w[0]);card.style.setProperty("--pc2",w[1]);
    card.innerHTML='<div class="art"></div><b></b><em></em><span class="bar"><i></i></span><small></small>';
    dgPortrait(card.querySelector(".art"),person.kind,dgDateSex(),rel.rank>=3?{eye:"happy",mouth:"grin"}:null);
    card.querySelector("b").textContent=rel.rank?person.name:"???";
    card.querySelector("em").textContent=rel.label;
    card.querySelector(".bar i").style.width=(rel.total?Math.round(rel.stars/(rel.total*3)*100):0)+"%";
    card.querySelector("small").textContent=rel.rank?(rel.stars+" / "+(rel.total*3)+" ♥"):("chapitre "+(i+1));
    card.onclick=()=>{ if(dgChapterUnlocked(i))dgRubans(()=>dgShowChapterScreen(i)); };
    host.appendChild(card);
  });
  document.getElementById("colCount").textContent=met+" / "+dgChapters.length;
}
function dgShowCollection(){
  setPaused(false);
  dgRenderCollection();
  ["chapterScreen","profileScreen"].forEach(dgHideScreen);
  dgShowScreen("collection");
}

document.getElementById("dgListBack").onclick=()=>dgLeaveTo("index.html");
document.getElementById("dgOpenCollection").onclick=()=>dgRubans(()=>dgShowCollection());
document.getElementById("colBack").onclick=()=>dgRubans(()=>dgShowChapterList());
document.getElementById("dgBackMenu").onclick=()=>dgRubans(()=>dgShowChapterList());
document.getElementById("pfBack").onclick=()=>dgRubans(()=>dgShowChapterScreen(dgChapterIndexOfLevel(currentLevel||0)));
document.getElementById("pfGo").onclick=()=>{
  userAudioGesture();
  const info=dgLevelPos(currentLevel), pr=loadProgress();
  pr.met=pr.met||{};
  if(info.ch)pr.met[info.ch.id]=true;
  saveProgress(pr);
  dgTampon("GO !",()=>{
    dgHideScreen("profileScreen");
    resetPlay(); // on rejoue la chute d'entrée, maintenant que le plateau est visible
  });
};
document.getElementById("pauseChapters").onclick=()=>{setPaused(false);dgRubans(()=>dgShowChapterList());};
document.getElementById("pauseFullscreen").onclick=async()=>{
  const target=document.documentElement;
  try{
    if(target.requestFullscreen){await target.requestFullscreen({navigationUI:"hide"});return;}
    if(target.webkitRequestFullscreen){target.webkitRequestFullscreen();return;}
  }catch(e){console.warn("[FULLSCREEN]",e);}
  setPaused(false);
  showInfoBanner("Plein écran","Sur iPhone, Safari ne propose pas le plein écran par bouton. Fais <b>Partager → Sur l'écran d'accueil</b>, puis lance le jeu depuis son icône.");
};

const dgOldApplyLevelsData=applyLevelsData;
applyLevelsData=function(data,source){
  dgBuildChapters(data);
  // Arrivée par "Chapitres" ou "Rencontres" du menu : on ouvre cet écran, pas la carte de rencontre du niveau en cours.
  const dgQuery=new URLSearchParams(location.search);
  const dgOpen=dgQuery.get("collection")==="1"?"collection":(dgQuery.get("chapters")==="1"?"chapters":"");
  dgSkipProfileOnce=!!dgOpen;
  dgOldApplyLevelsData(data,source);
  dgSkipProfileOnce=false;
  if(dgOpen==="collection")dgShowCollection();
  else if(dgOpen==="chapters")dgShowChapterList();
};

savedStartLevel=function(){return dgSafeStartLevel();};

const dgOldLoadFromLevel=loadFromLevel;
loadFromLevel=function(idx){
  idx=Math.max(0,Math.min(levels.length-1,parseInt(idx,10)||0));
  if(dgRawChapters)dgBuildChapters({chapters:dgRawChapters,levels}); // suit les ajouts/suppressions de l'éditeur
  if(!dgLevelUnlocked(idx)){
    dgShowChapterScreen(dgChapterIndexOfLevel(idx));
    return;
  }
  dgOldLoadFromLevel(idx);
  dgOnLevelLoaded();
};


const dgOldSaveWinProgress=saveWinProgress;
saveWinProgress=function(){
  dgOldSaveWinProgress();
};

const dgOldExportJson=exportJson;
exportJson=function(){
  writeCurrentLevel();
  const perLevel=levels.some(l=>l&&l.chapter);
  const chapters=dgChapters.map(c=>{const o={...c};if(perLevel)delete o.levelIds;return o;});
  const data={version:6,settings:gameSettings,chapters,levels};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="levels.json";
  a.click();
  URL.revokeObjectURL(a.href);
  status.textContent="levels.json exporté avec chapitres.";
};

loadVectorAssets()
  .then(()=>loadStaticLevels())
  .catch(err=>{
    console.error("[BOOT] arrêt volontaire : vector_assets.json obligatoire",err);
    if(typeof banner!=="undefined"){
      bannerTitle.textContent="vector_assets.json obligatoire";
      bannerText.innerHTML="Le jeu est en mode strict SVG.<br>Il faut un fichier <b>vector_assets.json</b> au même niveau que <b>index.html</b>.<br><br>Erreur : "+String(err.message||err);
      starsEl.textContent="";
      bannerAction.textContent="OK";
      bannerAction.onclick=()=>banner.classList.add("hidden");
      banner.classList.remove("hidden");
    }
  });


/* ===== V46 SWIPE ROTATION =====
   Glisser vers la droite = rotation horaire (comme l'ancien bouton ⟳), vers la gauche = anti-horaire.
   Pendant le geste le plateau suit le doigt de quelques degrés ; au-delà du seuil, lâcher valide le coup,
   en dessous le plateau revient à plat et aucun coup n'est compté. Les flèches du clavier marchent toujours. */
(function(){
  const MAX_TILT=24;
  const SWIPE_KEY="dg_swipe_count";
  const hint=document.getElementById("swipeHint");
  let sw=null;
  let learned=0;
  try{learned=Number(localStorage.getItem(SWIPE_KEY))||0;}catch(e){}

  function threshold(){return Math.max(36,Math.min(90,window.innerWidth*0.14));}
  function blocked(t){
    return !!(t&&t.closest&&t.closest("button,a,input,select,textarea,label,.screen,.overlay,#confirmBox,#top,#dgAdOverlay,#loadingOverlay"));
  }
  function canSwipe(){return !edit&&!gameOver&&!gamePaused&&levels.length>0;}
  function setTilt(a){rot.setAttribute("transform","rotate("+a+" "+(BOARD/2)+" "+(BOARD/2)+")");}
  function syncHint(dir){
    if(!hint)return;
    hint.classList.toggle("learned",learned>=3);
    hint.classList.toggle("left",dir<0);
    hint.classList.toggle("right",dir>0);
  }
  function springBack(from){
    const t0=performance.now();
    (function step(now){
      if(busy||sw)return; // un vrai coup ou un nouveau geste a pris la main
      const k=Math.min(1,(now-t0)/130);
      setTilt(from*(1-k)*(1-k));
      if(k<1)requestAnimationFrame(step);
    })(t0);
  }

  document.addEventListener("pointerdown",e=>{
    if(e.pointerType==="mouse"&&e.button!==0)return;
    if(sw||blocked(e.target)||!canSwipe())return;
    const br=svg.getBoundingClientRect();
    sw={id:e.pointerId,x:e.clientX,y:e.clientY,tilt:0,active:false,dir:e.clientY>br.top+br.height/2?-1:1};
  },{passive:true});

  document.addEventListener("pointermove",e=>{
    if(!sw||e.pointerId!==sw.id)return;
    if(!canSwipe()){sw=null;stage.classList.remove("swiping");syncHint(0);return;}
    const dx=e.clientX-sw.x,dy=e.clientY-sw.y;
    if(!sw.active){
      if(Math.abs(dx)<8)return;
      if(Math.abs(dy)>Math.abs(dx)*1.2){sw=null;return;} // geste vertical : pas un swipe
      sw.active=true;
      stage.classList.add("swiping");
    }
    sw.tilt=Math.max(-MAX_TILT,Math.min(MAX_TILT,dx/threshold()*14))*sw.dir;
    if(busy)sw.tilt=0;else setTilt(sw.tilt);
    syncHint(Math.abs(dx)>=threshold()?Math.sign(dx):0);
  },{passive:true});

  function end(e,cancelled){
    if(!sw||e.pointerId!==sw.id)return;
    const s=sw;
    sw=null;
    stage.classList.remove("swiping");
    syncHint(0);
    if(!s.active)return;
    const dx=e.clientX-s.x;
    if(!cancelled&&Math.abs(dx)>=threshold()&&canSwipe()){
      learned++;
      try{localStorage.setItem(SWIPE_KEY,String(learned));}catch(err){}
      syncHint(0);
      turn((dx>0?1:-1)*s.dir,s.tilt);
    }else{
      springBack(s.tilt);
    }
  }
  document.addEventListener("pointerup",e=>end(e,false),{passive:true});
  document.addEventListener("pointercancel",e=>end(e,true),{passive:true});
  syncHint(0);
})();

;

/* ===== V43.31 audio slider safety: do not regress music volume on iPhone ===== */
(function(){
  function bindAudioSliderSafety(){
    const ms=document.getElementById("musicVolumeSlider");
    const ss=document.getElementById("sfxVolumeSlider");

    if(ms && !ms.dataset.v4331Bound){
      ms.dataset.v4331Bound="1";
      ["input","change","pointerup","touchend"].forEach(evt=>{
        ms.addEventListener(evt,()=>{
          if(typeof musicVolume!=="undefined")musicVolume=Math.max(0,Math.min(1,Number(ms.value)/100));
          if(typeof musicOn!=="undefined")musicOn=musicVolume>0;
          if(typeof soundOn!=="undefined")soundOn=(typeof sfxOn==="undefined"?true:sfxOn)||musicOn;
          if(typeof ensureMusicRouting==="function")ensureMusicRouting();
          if(typeof applyAudioVolumes==="function")applyAudioVolumes();
          if(typeof updatePauseButtons==="function")updatePauseButtons();
        },{passive:true});
      });
    }

    if(ss && !ss.dataset.v4331Bound){
      ss.dataset.v4331Bound="1";
      ["input","change","pointerup","touchend"].forEach(evt=>{
        ss.addEventListener(evt,()=>{
          if(typeof sfxVolume!=="undefined")sfxVolume=Math.max(0,Math.min(1,Number(ss.value)/100));
          if(typeof sfxOn!=="undefined")sfxOn=sfxVolume>0;
          if(typeof soundOn!=="undefined")soundOn=sfxOn||(typeof musicOn==="undefined"?true:musicOn);
          if(typeof applyAudioVolumes==="function")applyAudioVolumes();
          if(typeof updatePauseButtons==="function")updatePauseButtons();
        },{passive:true});
      });
    }
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bindAudioSliderSafety);
  else bindAudioSliderSafety();
})();
