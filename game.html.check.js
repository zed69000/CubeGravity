window.CG_EDITOR_MODE=new URLSearchParams(location.search).get("editor")==="1";document.documentElement.classList.toggle("editor-enabled",window.CG_EDITOR_MODE);

/* V36: force gameplay mode, bypass old embedded face menu from previous single-page build. */
(function(){
  window.__skipMainMenu = true;
  window.__forceGameMode = true;

  function hideEmbeddedMenu(){
    const selectors = [
      "#mainMenu",".mainMenu","#startMenu",".startMenu","#homeMenu",".homeMenu",
      "#menu",".menu","#playFace",".faceButton",".click",".subtitle",".links",
      "[aria-label='Menu principal']","[aria-label='Lancer le jeu']"
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.setProperty("display","none","important");
        el.style.setProperty("visibility","hidden","important");
        el.style.setProperty("opacity","0","important");
        el.style.setProperty("pointer-events","none","important");
      });
    });

    // Common game containers, make sure they are visible if present.
    ["game","gameRoot","app","hud","stage","boardWrap"].forEach(id => {
      const el = document.getElementById(id);
      if(el){
        el.style.removeProperty("display");
        el.style.setProperty("visibility","visible");
        el.style.setProperty("opacity","1");
        el.style.setProperty("pointer-events","auto");
      }
    });

    document.body.classList.add("force-game-start");
  }

  function tryStartGame(){
    hideEmbeddedMenu();
    const fns = ["startGame","enterGame","beginGame","showGame","startLevel","initGame","resumeGame"];
    fns.forEach(name => {
      try {
        if (typeof window[name] === "function") window[name]();
      } catch(e) {}
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", tryStartGame);
  } else {
    tryStartGame();
  }
  window.addEventListener("load", tryStartGame);
  let n = 0;
  const timer = setInterval(() => {
    tryStartGame();
    n++;
    if(n > 20) clearInterval(timer);
  }, 100);
})();


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

const grid=document.getElementById("grid"),rot=document.getElementById("rot"),stage=document.getElementById("stage"),svg=document.querySelector("svg");
const modeLabel=document.getElementById("modeLabel"),status=document.getElementById("status"),tool=document.getElementById("tool");
const editPanel=document.getElementById("editPanel"),levelNameInput=document.getElementById("levelName"),playStats=document.getElementById("playStats");
const banner=document.getElementById("banner"),bannerTitle=document.getElementById("bannerTitle"),bannerText=document.getElementById("bannerText"),starsEl=document.getElementById("stars"),bannerAction=document.getElementById("bannerAction");

let levels=[];
const GAME_VERSION="V43.21-inclusive-shared";
setTimeout(()=>{const v=document.getElementById("gameVersionBadge"); if(v)v.textContent=GAME_VERSION;},0);
let gameSettings={fallDelayMs:135,rotationDurationMs:320};
let fallbackLevels=[]; // V57: aucun niveau de gameplay en dur. levels.json est obligatoire.
const EMBEDDED_LEVELS_DATA={"version":5,"settings":{"fallDelayMs":60,"rotationDurationMs":120,"boardWidth":11,"boardHeight":11,"boardReduction":"13x13_to_11x11_crop_outer_ring_preserve_edge_blocks","defaultGridSize":11,"gridSizePerLevel":true},"levels":[{"name":"Nouveau niveau 51","maxMoves":999,"locked":true,"difficulty":1,"gridSize":7,"biome":"rainbow","map":["####.##","#A....#","#..##.#",".##.#..","......#","....#B#","....###"]},{"name":"Nouveau niveau 52","maxMoves":999,"locked":true,"difficulty":1,"gridSize":7,"biome":"rainbow","map":["..#....","#A...#.",".#.....",".#.....","....##.","....B..",".....##"]},{"name":"Nouveau niveau 53","maxMoves":999,"locked":true,"difficulty":1,"gridSize":7,"biome":"rainbow","map":["..#....",".#.....",".OS....","..ADB..","..#....",".......","......."]},{"name":"02 - Base","maxMoves":2,"locked":true,"difficulty":2,"biome":"forest","solution":"RL","map":["..B........",".#######...",".#.....#...",".#.....#...",".#.#####...","...........","...........","...###.#.##","...#......#","...#.....A.","...########"],"gridSize":11},{"name":"03 - Base","maxMoves":5,"locked":true,"difficulty":3,"biome":"desert","solution":"RLLRL","map":["...........","...A.......","...........","........##B","....###....","........###",".........##",".####......","........##.","...........","..........."],"gridSize":11},{"name":"04 - Base","maxMoves":4,"locked":true,"difficulty":4,"biome":"ice","solution":"LLLL","map":["...........",".......#..A",".......#...","...........",".......#...","......B#...",".....#####.","....#######",".......#...",".......#...","..........."],"gridSize":11},{"name":"05 - Base","maxMoves":3,"locked":true,"difficulty":5,"biome":"rainbow","solution":"LLL","map":["...........","...A.......","...........","......#####",".......B#..","....#####..","........#..","..####..#..","........#..","#.##....#..","..........."],"gridSize":11},{"name":"06 - Bouton","maxMoves":5,"locked":true,"difficulty":6,"biome":"cosmic","solution":"LLLLL","map":["...........","...........","...#B......",".###.##D##.","...#.......","...#.......",".S.#....A..","...#.......","###########","...#.......","..........."],"gridSize":11},{"name":"07 - Bouton","maxMoves":3,"locked":true,"difficulty":7,"biome":"forest","solution":"LRR","map":["...........",".B#........","..######...","..#........",".S.........","..#........","..#........","..D........","###........","A.#........","..........."],"gridSize":11},{"name":"08 - Bouton","maxMoves":6,"locked":true,"difficulty":8,"biome":"desert","solution":"RLRLRL","map":["...........","...........","...........","....#......","...B....##.",".####......","....####...","D..........","...........","...S.......","..A........"],"gridSize":11},{"name":"09 - Bouton","maxMoves":5,"locked":true,"difficulty":9,"biome":"ice","solution":"LRRLL","map":["...........","...........","...........","....#.O###D","....#......","A...####...","....#B.....","..####.....","....#......","#.###......","..........S"],"gridSize":11},{"name":"10 - Jeanne labyrinthe","maxMoves":999,"locked":true,"difficulty":10,"biome":"desert","requiredMechanic":"button","solution":"LRRRLLL","solutionUses":["O","S"],"designNote":"Niveau de Jeanne injecté dans le chapitre bouton/porte.","validation":{"testedSolvable":true,"mainBrickRequired":true,"forcedPosition":10,"source":"capture / ancien Nouveau niveau 21"},"map":["....#......","#...#......","...S#...##.","...##..#.#.",".......D.#.","..#....D.#.","..#...##.#.","..#...#B.#.","..#....##..","..#.A#.....","..#.##....."],"gridSize":11},{"name":"11 - Bouton","maxMoves":5,"locked":true,"difficulty":11,"biome":"rainbow","solution":"RRRRR","map":["S..........","...........","...........","...#..####D","..B#.......","...#####...","...#.......","..####.....","...#.......","##.#.......","..A........"],"gridSize":11},{"name":"12 - Danger","maxMoves":5,"locked":true,"difficulty":12,"biome":"cosmic","solution":"LLLLL","map":[".........S.",".....#...X.",".....#.....",".....#.....",".....#.....",".########D.",".....#.....",".....#.....",".....#B....",".A####.##..","..........."],"gridSize":11},{"name":"13 - Danger","maxMoves":5,"locked":true,"difficulty":13,"biome":"forest","solution":"LLLLL","map":["......A....","...#.......","...#.......","...#....S..","...#.......","...#X......","...#B......",".##D##.....","#.#####O...","...#.......","..........."],"gridSize":11},{"name":"14 - Danger","maxMoves":6,"locked":true,"difficulty":14,"biome":"desert","solution":"RRLRLR","map":["...........","...........","...###.....","..A........",".......###.",".###.......","..........X","...........","##.......S.","B..#D##...#","...###...##"],"gridSize":11},{"name":"15 - Danger","maxMoves":8,"locked":true,"difficulty":15,"biome":"ice","solution":"LLLLLLRL","map":["...........","...........",".....X....#","##......O.#",".###.......","...A###....","...........","...........","......#D#..",".......B..#","..S......##"],"gridSize":11},{"name":"16 - Danger","maxMoves":3,"locked":true,"difficulty":16,"biome":"rainbow","solution":"RRR","map":["...........","...........","...........","...X...#...",".#######.#.",".......#B.S",".......#...",".......#...","#######D###",".....A.#...","...X......."],"gridSize":11},{"name":"16 - Danger","maxMoves":7,"locked":true,"difficulty":16,"biome":"rainbow","solution":"RRRRRRR","map":["...........","...........","...........","...X...#...",".#######.#.",".......#B.S",".......#...",".......#...","#######D###",".....A.#...","...X......."],"gridSize":11},{"name":"17 - Rotateur","maxMoves":8,"locked":true,"difficulty":17,"biome":"cosmic","solution":"RRRLRRRR","map":["###........","B.....R....","....D.##...","..###......","...........",".####......",".....##....","...........","...S.....X.","...AX......","..........."],"gridSize":11},{"name":"18 - Rotateur","maxMoves":8,"locked":true,"difficulty":18,"biome":"forest","solution":"RRRRRRLR","map":["......L....",".##.####...",".#.....#...",".#.....#...",".##.####...","..B........","........X..","X..#.######","...#...S.AD","...#......#","...####.###"],"gridSize":11},{"name":"19 - Rotateur","maxMoves":8,"locked":true,"difficulty":19,"biome":"desert","solution":"RRLLRRLL","map":["...........",".###A##....",".#.....D...",".#.X..S#...",".#.#####...","...........","...X.......","....###.###","...#.......","...#......#","R.B###.O###"],"gridSize":11},{"name":"20 - Rotateur","maxMoves":12,"locked":true,"difficulty":20,"biome":"ice","solution":"LLLLRRLRLLLL","map":["...........",".####..#..R",".#.....#...",".#A....O...",".#####.#...",".....X.....","..S..L...B.","...##.#..##","..X#......#","...#.......","...##D###.#"],"gridSize":11},{"name":"21 - Rotateur","maxMoves":9,"locked":true,"difficulty":21,"biome":"rainbow","solution":"RLLLRRRRR","map":[".X.........","...........",".L.........","....X######",".....#S.A..",".R..##.#...",".....#.....","..####.....",".....#B....","###D.#.....","..........."],"gridSize":11},{"name":"22 - Premier sourire","maxMoves":6,"locked":true,"difficulty":22,"biome":"love","solution":"RRRLLL","map":["...........","..######...","..#.....#..","...#DD#B#..","......##...",".........##","####.....A#","..S#.......",".....######","...........",".#........."],"gridSize":11},{"name":"23 - Message maladroit","maxMoves":7,"locked":true,"difficulty":23,"biome":"garden","solution":"RLLLRRR","map":["......#....","......#...#",".##...#S...",".#.#..##...",".#.D.......",".#.D....#..",".#.##...#..",".#.B#...#..","..##....#..",".....#A.#..",".....##.#.."],"gridSize":11},{"name":"24 - Café annulé","maxMoves":8,"locked":true,"difficulty":24,"biome":"kiss","solution":"LLRRRLLL","map":[".........#.","...........","######.....",".......#S..","#A.....####","##.........","...##......","..#B#DD#...","..#.....#..","...######..","..........."],"gridSize":11},{"name":"25 - Silence radio","maxMoves":9,"locked":true,"difficulty":25,"biome":"starry","solution":"LLLRRRLLL","map":[".....##.#..",".....#A.#..","..##....#..",".#.B#...#..",".#.##...#..",".#.D....#..",".#.D.......",".#.#..##...",".##...#S...","......#...#","......#...."],"gridSize":11},{"name":"26 - Mauvais timing","maxMoves":9,"locked":true,"difficulty":26,"biome":"rainbow","solution":"RLLLLLRRR","map":["..#.##.....","..#.A#.....","..#....##..","..#...#B.#.","..#...##.#.","..#....D.#.",".......D.#.","...##..#.#.","...S#...##.","#...#......","....#......"],"gridSize":11},{"name":"27 - Deuxième chance","maxMoves":3,"locked":true,"difficulty":27,"biome":"forest","solution":"RRR","map":["........A..",".......#.##",".......#...",".....####..",".......#...","...#####...",".......#B..","D####..#...","...........","...........","..........S"],"gridSize":11},{"name":"28 - Conversation bancale","maxMoves":3,"locked":true,"difficulty":28,"biome":"love","solution":"LLL","map":["..A........","##.#.......","...#.......","..####.....","...#.......","...#####...","..B#.......","...#..####D","...........","...........","S.........."],"gridSize":11},{"name":"29 - Presque rendez-vous","maxMoves":5,"locked":true,"difficulty":29,"biome":"desert","solution":"LLLLL","map":["..........S","...........","...........","D####..#...",".......#B..","...#####...",".......#...",".....####..",".......#...",".......#.##","........A.."],"gridSize":11},{"name":"30 - Profil mystère","maxMoves":3,"locked":true,"difficulty":30,"biome":"garden","solution":"LLL","map":["...........","..##.####A.","....B#.....",".....#.....",".....#.....",".D########.",".....#.....",".....#.....",".....#.....",".X...#.....",".S........."],"gridSize":11},{"name":"31 - Trop loin","maxMoves":3,"locked":true,"difficulty":31,"biome":"ice","solution":"RRR","map":["...........",".A####.##..",".....#B....",".....#.....",".....#.....",".########D.",".....#.....",".....#.....",".....#.....",".....#...X.",".........S."],"gridSize":11},{"name":"32 - Trop vite","maxMoves":4,"locked":true,"difficulty":32,"biome":"kiss","solution":"RLLL","map":["...........",".A...#.....",".#...#.....",".#...#.....",".#...#.....",".#########.","..B..#.....",".#...#.....",".#...#.....",".....D...XS","..........."],"gridSize":11},{"name":"33 - Trop compliqué","maxMoves":4,"locked":true,"difficulty":33,"biome":"cosmic","solution":"LLLL","map":["...........","SX...D.....",".....#...#.",".....#...#.",".....#..B..",".#########.",".....#...#.",".....#...#.",".....#...#.",".....#...A.","..........."],"gridSize":11},{"name":"34 - Le bon détour","maxMoves":5,"locked":true,"difficulty":34,"biome":"starry","solution":"RRRRR","map":[".S.........",".X...#.....",".....#.....",".....#.....",".....#.....",".D########.",".....#.....",".....#.....","....B#.....","..##.####A.","..........."],"gridSize":11},{"name":"35 - Papillons prudents","maxMoves":3,"locked":true,"difficulty":35,"biome":"rainbow","solution":"LLL","map":["...........",".......#...","...O#####.#",".....##D##.","......B#...","......X#...",".......#...","..S....#...",".......#...",".......#...","....A......"],"gridSize":11},{"name":"36 - Promesse fragile","maxMoves":3,"locked":true,"difficulty":36,"biome":"love","solution":"RRR","map":["...........","...#.......","#.#####O...",".##D##.....","...#B......","...#X......","...#.......","...#....S..","...#.......","...#.......","......A...."],"gridSize":11},{"name":"37 - Le doute","maxMoves":5,"locked":true,"difficulty":37,"biome":"garden","solution":"LLRRR","map":["....A......",".......#...",".......#...","..S....#...",".......#...","......X#...","......B#...",".....##D##.","...O#####.#",".......#...","..........."],"gridSize":11},{"name":"38 - Le retour","maxMoves":6,"locked":true,"difficulty":38,"biome":"kiss","solution":"LLRLRL","map":["...........","...........",".....###...","........A..",".###.......",".......###.","X..........","...........",".S.......##","#...##D#..B","##...###..."],"gridSize":11},{"name":"39 - Nouvelle rencontre","maxMoves":1,"locked":true,"difficulty":39,"biome":"forest","solution":"L","map":["..##.....##","..........#","...O....#..","........DB.",".....#..#..","..X..#.....",".....#.....","....#A.....","....#.....S","...##......","...#......."],"gridSize":11},{"name":"40 - Signes contradictoires","maxMoves":2,"locked":true,"difficulty":40,"biome":"starry","solution":"RL","map":["###.....S..","...B.......","..#D#......","...........","...........","....###A...","#......###.","#.O......##",".....X.....","...........","..........."],"gridSize":11},{"name":"41 - L’étincelle","maxMoves":2,"locked":true,"difficulty":41,"biome":"rainbow","solution":"LR","map":["..S......##",".......B..#","......#D#..","...........","...........","...A###....",".###......#","##......O.#",".....X.....","...........","..........."],"gridSize":11},{"name":"42 - Rendez-vous réel","maxMoves":3,"locked":true,"difficulty":42,"biome":"love","solution":"RRL","map":[".......#...","......##...","S.....#....",".....A#....",".....#.....",".....#..X..","..#..#.....",".BD........","..#....O...","#......#...","##.....#..."],"gridSize":11},{"name":"43 - Main tendue","maxMoves":8,"locked":true,"difficulty":43,"biome":"garden","solution":"RRRRRRLR","map":["...........","...........","#....X.....","#.O......##",".......###.","....###A...","...........","...........","..#D#......","#..B.......","##......S.."],"gridSize":11},{"name":"44 - Pas si simple","maxMoves":4,"locked":true,"difficulty":44,"biome":"cosmic","solution":"RRRR","map":[".....S..#..","....#...#..",".....B..#..","...#####D#.","....#...#..","....#...#A.","....#...#..","...X#...#.X","....#...#..","....#...#..","........#.."],"gridSize":11},{"name":"45 - Ça recommence","maxMoves":5,"locked":true,"difficulty":45,"biome":"kiss","solution":"RRRRR","map":[".......X...","...#.A.....","###D#######","...#.......","...#.......","S.B#.......",".#.#######.","...#...X...","...........","...........","..........."],"gridSize":11},{"name":"46 - Enfin fluide","maxMoves":5,"locked":true,"difficulty":46,"biome":"starry","solution":"LLLLL","map":["...X.......",".....A.#...","#######D###",".......#...",".......#...",".......#B.S",".#######.#.","...X...#...","...........","...........","..........."],"gridSize":11},{"name":"47 - Le vrai choix","maxMoves":6,"locked":true,"difficulty":47,"biome":"rainbow","solution":"RRRRRR","map":["..#........","..#...#....","..#...#....","X.#...#X...","..#...#....",".A#...#....","..#...#....",".#D#####...","..#..B.....","..#...#....","..#..S....."],"gridSize":11},{"name":"48 - Dernier virage","maxMoves":7,"locked":true,"difficulty":48,"biome":"love","solution":"LLLLLLL","map":["...........","...........","...........","...#...X...",".#.#######.","S.B#.......","...#.......","...#.......","###D#######","...#.A.....",".......X..."],"gridSize":11},{"name":"49 - Presque sûr","maxMoves":6,"locked":true,"difficulty":49,"biome":"garden","solution":"RLRRRR","map":["...........","......XA...",".X.....S...","...........","....##.....","......####.","...........","......###..","...##.D....","....R.....B","........###"],"gridSize":11},{"name":"50 - La bonne personne","maxMoves":6,"locked":true,"difficulty":50,"biome":"kiss","solution":"LRLLLL","map":["...........","...AX......","...S.....X.","...........",".....##....",".####......","...........","..###......","....D.##...","B.....L....","###........"],"gridSize":11}]}; // fallback shipping si fetch levels.json échoue

let currentLevel=0,baseMap=[],b=[],p={x:0,y:0},start={x:0,y:0},exit={x:0,y:0};
let door=false,busy=false,edit=!!window.CG_EDITOR_MODE,moves=0,gameOver=false,confettiTimer=null,deadPlayer=false,idleTick=0,painting=false,lastPaintKey='',visualOri=0,squash=0,soundOn=true,sfxOn=true,musicOn=true,audioCtx=null,rotatorCooldown=false,teleporterCooldownType=null,gamePaused=false;
let playerTrail=[]; // V43.18 : afterimages visuels pendant la chute, sans effet gameplay.
let wallNoteIndex=0,lastWallSoundAt=0,eternalFallWraps=0,elevatorMusicTimer=null,elevatorMusicStarted=false,musicStep=0,bgMusic=null,musicSourceNode=null,musicGainNode=null;
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
function text(x,y,t,f,sz=22){let a=E("text",{x,y,fill:f,"font-size":sz,"font-weight":900,"text-anchor":"middle","font-family":"monospace","pointer-events":"none"});a.textContent=t;grid.appendChild(a)}

/* ===== V51 ASSET RUNTIME ===== */
let assetPack=null;

async function loadAssets(){
  setLoadingText("Chargement assets.json…");
  // V57 : assets.json externe obligatoire en priorité, mais on teste plusieurs chemins.
  // Aucun asset gameplay n'est embarqué ici : si assets.json manque, on tombe seulement sur les fallbacks graphiques codés.
  const candidates=["./assets.json","assets.json","/assets.json"];
  let lastErr=null;
  for(const path of candidates){
    try{
      const url=path+"?cacheBust="+Date.now();
      console.log("[ASSETS] tentative", url);
      const res=await fetch(url,{cache:"no-store"});
      if(!res.ok)throw new Error("HTTP "+res.status+" sur "+path);
      const data=await res.json();
      if(!data || !data.assets || !data.palette)throw new Error("assets.json invalide : assets/palette manquants");
      assetPack=data;
      console.log("[ASSETS] OK depuis", path, Object.keys(assetPack.assets||{}));
      return true;
    }catch(e){
      lastErr=e;
      console.warn("[ASSETS] échec", path, e);
    }
  }
  assetPack=null;
  console.error("[ASSETS] ECHEC assets.json après tous les chemins", lastErr);
  return false;
}

function getAssetPixels(name){
  if(!assetPack || !assetPack.assets)return null;
  const a=assetPack.assets[name];
  if(Array.isArray(a))return a;
  if(a && Array.isArray(a.pixels))return a.pixels;
  return null;
}

function drawPixelAsset(name,x,y,parent=grid,opts={}){
  const pixels=getAssetPixels(name);
  if(!pixels || !pixels.length)return false;

  const pal=(assetPack && assetPack.palette) ? assetPack.palette : {};
  const size=assetPack.assetSize || pixels.length || 16;
  const scale=T/size;
  const alpha=opts.alpha==null ? 1 : opts.alpha;

  const anim=assetPack && assetPack.animation;
  const shouldEyeShift=anim && anim.enabled && Array.isArray(anim.eyeShiftAssets) && anim.eyeShiftAssets.includes(name);
  let eyeShift=0;
  if(shouldEyeShift){
    const seq=anim.eyeShiftPixels || [0,1,0,-1];
    const interval=anim.eyeShiftIntervalMs || 420;
    eyeShift=seq[Math.floor(Date.now()/interval)%seq.length] || 0;
  }

  for(let py=0;py<pixels.length;py++){
    const row=String(pixels[py]||"");
    for(let px=0;px<row.length;px++){
      const key=row[px];
      let col=pal[key];
      if(!col || col==="transparent")continue;

      let dx=0;
      if(shouldEyeShift && key==="0" && py>=3 && py<=8){
        dx=eyeShift;
        const targetX=px+dx;
        if(targetX<0 || targetX>=row.length) dx=0;
      }

      parent.appendChild(E("rect",{
        x:x+(px+dx)*scale,
        y:y+py*scale,
        width:Math.ceil(scale),
        height:Math.ceil(scale),
        fill:col,
        opacity:alpha,
        "pointer-events":"none"
      }));
    }
  }
  return true;
}

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
function resetPlay(){
  setBoardSizeFromLevel(levels[currentLevel]);
  normalize();
  levels[currentLevel].map=map();
  b=arr(levels[currentLevel].map);
  door=baseDoorOpen();
  moves=0;busy=false;gameOver=false;deadPlayer=false;rotatorCooldown=false;teleporterCooldownType=null;eternalFallWraps=0;gamePaused=false;activeSwitchKey=null;activeSwitchHeld=false;resetPlayerTrail();hideBanner();
  rot.setAttribute("transform",`rotate(0 ${BOARD/2} ${BOARD/2})`);visualOri=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(b[y][x]=="A"){p={x,y};start={x,y};b[y][x]="."}
    if(b[y][x]=="B")exit={x,y}
  }
  draw(); updateStats();
  if(!edit){if(musicOn)startElevatorMusic();busy=true;setTimeout(fall,getFallDelayMs());scheduleCompanion(false)}
}

function cleanLevelDisplayName(raw, fallbackIndex){
  const name = String(raw || "").trim();
  if(!name) return "Niveau " + (fallbackIndex + 1);
  const m = name.match(/^(\d+)\s*[-–—]\s*(.+)$/);
  if(m) return m[1] + " - " + m[2].trim();
  return (fallbackIndex + 1) + " - " + name;
}

function updateStats(){
  const max=levels[currentLevel].maxMoves||"?";
  const rawName=levels[currentLevel].name||("Niveau "+(currentLevel+1));
  const name=cleanLevelDisplayName(rawName,currentLevel);
  const titleEl=document.getElementById("title");
  if(edit){
    playStats.textContent="";
    if(titleEl)titleEl.innerHTML='<span class="t-mark">▣</span> <span class="t-gravity">GRAVITY</span> <span class="t-cube">CUBE</span> <span class="t-mark">▣</span> <span id="modeLabel"></span>';
  }else{
    if(titleEl)titleEl.textContent=(currentLevel+1)+" - "+name;
    playStats.innerHTML =
      '<div class="objectiveLine" title="Résumé du niveau">'+
        '<span class="metric metricMoves"><i>⟳</i><small>Coups</small><b>'+moves+'</b></span>'+
        '<span class="metric metricGoal"><i>★</i><small>Objectif 3♥</small><b>'+max+'</b></span>'+
        '<span class="metric metricDiff"><i>✦</i><small>Difficulté</small><b>'+(levels[currentLevel].difficulty||1)+'</b></span>'+
      '</div>';
  }
  const badge=document.getElementById("levelBadge");
  if(badge)badge.textContent=name;
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
function soundMove(){beep(210,.045,"square",.012,"sfx")}
function soundRotate(d){
  if(d>0){beep(260,.055,"triangle",.026,"sfx");setTimeout(()=>beep(360,.07,"sine",.022,"sfx"),65)}
  else{beep(360,.055,"triangle",.026,"sfx");setTimeout(()=>beep(240,.07,"sine",.022,"sfx"),65)}
}
function soundLand(d=1){
  const now=performance.now();
  if(now-lastWallSoundAt<110)return;
  lastWallSoundAt=now;
  const notes=[196,220,246.94,261.63,293.66,329.63,349.23,392];
  const f=notes[wallNoteIndex++%notes.length];
  beep(f,.105,"sine",.028,"sfx");
  setTimeout(()=>beep(f*2,.055,"triangle",.010,"sfx"),55);
}
function soundCrash(){beep(110,.14,"triangle",.026,"sfx");setTimeout(()=>beep(82,.18,"sine",.018,"sfx"),90)}
function soundWin(){
  [523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.12,"triangle",.034,"sfx"),i*85));
  for(let i=0;i<10;i++)setTimeout(()=>beep(650+Math.random()*500,.045,"sine",.012,"sfx"),230+i*50);
}
function soundLove(){beep(523,.08,"sine",.03,"sfx");setTimeout(()=>beep(784,.12,"sine",.028,"sfx"),100)}
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

function hideBanner(){banner.classList.add("hidden");banner.classList.remove("lose");svg.style.filter="none";stopConfetti()}
function showBanner(title,msg,stars,kind){hideCompanion(false);stopElevatorMusic();
  bannerTitle.textContent=title; bannerText.textContent=msg; starsEl.textContent=stars||"";
  bannerAction.textContent=kind==="win"?"NEXT LEVEL":"RESTART LEVEL";
  bannerAction.onclick=()=>{ if(kind==="win"){goLevel((currentLevel+1)%levels.length)} else resetPlay(); };
  if(kind==="lose"){svg.style.filter="grayscale(1) brightness(.55)";banner.classList.add("lose")}
  else banner.classList.remove("lose");
  banner.classList.remove("hidden");
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

function setVectorStatus(text,kind=""){ /* debug disabled */ }


function validateVectorAssetsData(data){
  if(!data || !data.assets)throw new Error("vector_assets.json invalide : assets manquant");
  const required=["player","destination","button_off","button_on","block_up","block_down","wall","danger","rotator_left","rotator_right"];
  const missing=required.filter(k=>!data.assets[k]);
  if(missing.length)throw new Error("vector_assets.json incomplet : "+missing.join(", "));
  return true;
}

async function loadVectorAssets(){
  setLoadingText("Chargement vector_assets_runtime.json…");
  const candidates=["./vector_assets_runtime.json","vector_assets_runtime.json","/vector_assets_runtime.json","./vector_assets.json","vector_assets.json","/vector_assets.json"];
  let lastErr=null;
  setVectorStatus("SVG loading...\\nexpected 3563ce4af1","");
  for(const path of candidates){
    try{
      const url=path+"?cacheBust="+Date.now();
      console.log("[VECTOR_ASSETS] tentative",url);
      const res=await fetch(url,{cache:"no-store"});
      if(!res.ok)throw new Error("HTTP "+res.status+" sur "+path);
      const data=await res.json();
      validateVectorAssetsData(data);
      vectorAssetPack=data;
      applyVectorThemeToGame();
      window.__vectorAssetsLoadedFrom=path;
      window.__vectorDrawCount=0;
      const counts=Object.entries(data.assets).map(([k,v])=>k+":"+(v.layers?v.layers.length:0)).join(" | ");
      console.log("[VECTOR_ASSETS] OK",path,counts);
      setVectorStatus("SVG ON\\n"+path+"\\nplayer:"+(data.assets.player.layers||[]).length+" layers\\nexpected:3563ce4af1","ok");
      return true;
    }catch(e){
      lastErr=e;
      console.warn("[VECTOR_ASSETS] échec",path,e);
    }
  }
  vectorAssetPack=null;
  window.__vectorAssetsLoadedFrom=null;
  setVectorStatus("SVG OFF\\nvector_assets.json introuvable","bad");
  showVectorAssetsError(lastErr);
  throw lastErr || new Error("vector_assets_runtime.json / vector_assets.json introuvables");
}
function vectorAsset(name){return vectorAssetPack&&vectorAssetPack.assets?vectorAssetPack.assets[name]:null}
function vectorAssetExists(name){
  const a=vectorAsset(name);
  return !!(a && Array.isArray(a.layers));
}
function readCharacterGender(key,fallback){
  try{
    const v=localStorage.getItem(key);
    return (v==="boy"||v==="girl") ? v : fallback;
  }catch(e){return fallback;}
}
function selectedCharacterAsset(role){
  const meGender=readCharacterGender("dcg_me_gender","boy");
  const dateGender=readCharacterGender("dcg_date_gender","girl");
  const candidate=role==="player" ? "player_"+meGender : "date_"+dateGender;
  const fallback=role==="player" ? "player" : "destination";
  return vectorAssetExists(candidate) ? candidate : fallback;
}
function applyVectorThemeToGame(){
  const th=vectorAssetPack?.themePreview||{};
  const root=document.documentElement;
  if(th.background)root.style.setProperty('--gc-bg',th.background);
  if(th.board)root.style.setProperty('--gc-board',th.board);
  if(th.border)root.style.setProperty('--gc-border',th.border);
  if(th.grid)root.style.setProperty('--gc-grid',th.grid);
  const stage=document.getElementById('stage');
  const boardSvg=document.querySelector('.boardWrap svg');
  const wrap=document.querySelector('.boardWrap');
  if(stage && th.background)stage.style.background=th.background;
  if(boardSvg && th.board)boardSvg.style.background=th.board;
  if(wrap && th.border)wrap.style.boxShadow=`0 22px 44px rgba(0,0,0,.45), 0 0 0 3px ${th.border}`;
}
function vectorGridStroke(){return vectorAssetPack?.themePreview?.grid || 'rgba(255,255,255,.10)';}
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
    el=E("path",{d:d});
  }else if(shape==="text"){
    el=E("text",{x:l.x??20,y:l.y??20,"font-size":l.fontSize??12,"font-weight":900,"font-family":"monospace","text-anchor":"middle"});
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
      layersList.forEach(child=>{
        if(child && child.visible!==false && (gr.children||[]).includes(child.id))appendVectorLayer(ge,child,t);
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

  window.__vectorDrawCount=(window.__vectorDrawCount||0)+1;
  window.__lastVectorAssetDrawn=name;
  if(window.__vectorDrawCount<=8 || window.__vectorDrawCount%25===0){
    const layerCount=(a.layers||[]).length;
    const groupCount=(a.groups||[]).length;
    const first=(a.layers||[]).slice(0,3).map(l=>l.id).join(",");
    setVectorStatus("SVG ON\n"+(window.__vectorAssetsLoadedFrom||"?")+"\ndraw:"+window.__vectorDrawCount+" · "+name+"\nlayers:"+layerCount+" groups:"+groupCount+" · "+first,"ok");
  }
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
  "1":{name:"cyan",label:"I",main:"#29e7ff",dark:"#073168",light:"#dffcff"},
  "2":{name:"rose",label:"II",main:"#ff4f93",dark:"#5a1238",light:"#ffe0f0"},
  "3":{name:"vert",label:"III",main:"#52f28a",dark:"#063b24",light:"#e1ffe9"}
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
function drawTeleporterFallback(c,X,Y){
  // Fallback pur SVG : utilisé si l'asset vectoriel externe manque.
  // Même design pour les 3 variantes, seules les couleurs changent.
  const st=teleporterStyle(c);
  grid.appendChild(E("circle",{cx:X+HALF,cy:Y+HALF,r:T*.37,fill:st.dark,stroke:st.main,"stroke-width":4,"pointer-events":"none"}));
  grid.appendChild(E("circle",{cx:X+HALF,cy:Y+HALF,r:T*.25,fill:"rgba(255,255,255,.04)",stroke:st.light,"stroke-width":2,"pointer-events":"none"}));
  grid.appendChild(E("circle",{cx:X+HALF,cy:Y+HALF,r:T*.11,fill:st.main,stroke:st.light,"stroke-width":1,"pointer-events":"none"}));
  text(X+HALF,Y+HALF+5,teleporterLabel(c),st.light,Math.max(10,T*.24));
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

function drawPlayerSpeedTrail(){
  if(edit||deadPlayer||!playerTrail.length)return;
  const now=Date.now();
  prunePlayerTrail(now);

  for(let i=0;i<playerTrail.length;i++){
    const t=playerTrail[i];
    const age=now-t.time;
    const life=1-age/PLAYER_TRAIL_LIFE_MS;
    if(life<=0)continue;

    const X=t.x*T;
    const Y=t.y*T;
    const alpha=Math.max(0,Math.min(.30,life*.28));
    const scale=0.82+life*.12;

    // Silhouette jaune du cube : lisible, mais assez transparente pour ne pas
    // confondre le joueur avec sa traînée. Oui, on évite de mentir au joueur.
    const g=E("g",{
      transform:`translate(${X+HALF} ${Y+HALF}) scale(${scale}) translate(${-HALF} ${-HALF})`,
      opacity:alpha,
      "pointer-events":"none"
    });

    g.appendChild(E("rect",{
      x:7,y:7,width:T-14,height:T-14,rx:Math.max(2,T*.08),ry:Math.max(2,T*.08),
      fill:"#ffd640",
      stroke:"#fff0a8",
      "stroke-width":Math.max(1,T*.045),
      "pointer-events":"none"
    }));

    // Petit trait vertical pour accentuer la chute sans ajouter un effet cartoon
    // trop bruyant. La gravité reste celle du jeu, le trail ne décide de rien.
    g.appendChild(E("rect",{
      x:HALF-Math.max(2,T*.045),
      y:T*.14,
      width:Math.max(3,T*.09),
      height:T*.68,
      rx:Math.max(1,T*.04),
      fill:"rgba(255,255,255,.55)",
      "pointer-events":"none"
    }));

    grid.appendChild(g);
  }
}

function draw(){
  grid.innerHTML="";
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    grid.appendChild(E("rect",{x:x*T,y:y*T,width:T,height:T,fill:"none",stroke:vectorGridStroke(),"stroke-width":1,"pointer-events":"none"}));
    let c=edit?baseMap[y][x]:b[y][x],X=x*T,Y=y*T;
    if(c=="#"){
      if(drawVectorAsset("wall",X,Y)){}else if(!drawPixelAsset("wall",X,Y)){
        grid.appendChild(E("rect",{x:X+2,y:Y+7,width:T-4,height:T-7,rx:2,ry:2,fill:"#6d2aa8",stroke:"#301447","stroke-width":3,"pointer-events":"none"}));
        grid.appendChild(E("rect",{x:X+2,y:Y+2,width:T-4,height:T-10,rx:2,ry:2,fill:"#c775ff",stroke:"#7d36bf","stroke-width":3,"pointer-events":"none"}));
      }
    }
    if(c=="B"){
      if(drawVectorAsset(selectedCharacterAsset("date"),X,Y)){}else if(!drawPixelAsset("destination",X,Y)){
        rect(X+4,Y+4,T-8,T-8,"#ff4f93","#8a1745");
      }
    }
    if(c=="A"&&edit){
      if(drawVectorAsset(selectedCharacterAsset("player"),X,Y)){}else if(!drawPixelAsset("player",X,Y)){
        rect(X+4,Y+4,T-8,T-8,"#ffd640","#a56500");
        text(X+HALF,Y+34,"A","#111",12);
      }
    }
    if(c=="S"){
      const pressed=(typeof buttonIsPressed==="function") ? buttonIsPressed(x,y) : false;
      const assetName=pressed ? "button_on" : "button_off";
      if(drawVectorAsset(assetName,X,Y)){}else if(!drawPixelAsset(assetName,X,Y)){
        const ring=pressed?"#ffd1eb":"#ccb8c7";
        const core=pressed?"#ff4f93":"#9a7d92";
        grid.appendChild(E("rect",{x:X+12,y:Y+12,width:T-24,height:T-24,rx:4,ry:4,fill:"#171a2d",stroke:ring,"stroke-width":3,"pointer-events":"none"}));
        grid.appendChild(E("rect",{x:X+16,y:Y+16,width:T-32,height:T-32,rx:3,ry:3,fill:core,stroke:ring,"stroke-width":2,"pointer-events":"none"}));
      }
    }
    if(c=="R"||c=="L"){
      const right=c=="R";
      const assetName=right ? "rotator_right" : "rotator_left";
      if(drawVectorAsset(assetName,X,Y)){}else if(!drawPixelAsset(assetName,X,Y)){
        grid.appendChild(E("rect",{x:X+5,y:Y+5,width:T-10,height:T-10,rx:3,ry:3,fill:"#073168",stroke:"#29e7ff","stroke-width":4,"pointer-events":"none"}));
        text(X+HALF,Y+29,right?"↻":"↺","#eefcff",28);
      }
    }
    if(isTeleporterChar(c)){
      // Téléporteur : même silhouette pour les 3 couleurs.
      // On tente l'asset vectoriel d'abord, puis un fallback SVG autonome.
      const assetName=teleporterAssetName(c);
      if(drawVectorAsset(assetName,X,Y)){}else if(!drawPixelAsset(assetName,X,Y)){
        drawTeleporterFallback(c,X,Y);
      }
    }
    if(c=="X"){
      if(drawVectorAsset("danger",X,Y)){}else if(!drawPixelAsset("danger",X,Y)){
        grid.appendChild(E("rect",{x:X+6,y:Y+6,width:T-12,height:T-12,rx:2,ry:2,fill:"#ff304f",stroke:"#5a0010","stroke-width":3,"pointer-events":"none"}));
      }
    }
    if(c=="D"||c=="O"){
      const assetName=c=="D" ? "block_up" : "block_down";
      if(drawVectorAsset(assetName,X,Y)){}else if(!drawPixelAsset(assetName,X,Y)){
        if(c=="D"){
          grid.appendChild(E("rect",{x:X+7,y:Y+7,width:T-14,height:T-20,rx:2,ry:2,fill:"#ff4f93",stroke:"#ffd1eb","stroke-width":3,"pointer-events":"none"}));
        }else{
          grid.appendChild(E("rect",{x:X+11,y:Y+18,width:T-22,height:T-28,rx:1,ry:1,fill:"#404552",stroke:"#737987","stroke-width":2,"pointer-events":"none"}));
        }
      }
    }
  }
  drawPlayerSpeedTrail();

  if(!edit&&!deadPlayer){
    let X=p.x*T,Y=p.y*T;
    let idle=(!busy&&!gameOver)?Math.sin(idleTick*.12)*1.4:0;
    let sx=1+squash*.22, sy=1-squash*.18;
    let inv=-visualOri*90;
    let grp=E("g",{transform:`translate(${X+HALF} ${Y+HALF+idle}) rotate(${inv}) scale(${sx} ${sy}) translate(${-HALF} ${-HALF})`,"pointer-events":"none"});
    if(drawVectorAsset(selectedCharacterAsset("player"),0,0,grp)){}else if(!drawPixelAsset("player",0,0,grp)){
      grp.appendChild(E("rect",{x:4,y:4,width:T-8,height:T-8,rx:2,ry:2,fill:"#ffd640",stroke:"#a56500","stroke-width":4}));
    }
    grid.appendChild(grp);
  }
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    let c=E("rect",{x:x*T,y:y*T,width:T,height:T,fill:"rgba(0,0,0,0.001)",stroke:"transparent",class:"hitcell"});
    c.dataset.x=x;c.dataset.y=y;
    c.addEventListener("pointerdown",startPaint);
    c.addEventListener("pointerenter",paintEnter);
    c.addEventListener("pointermove",paintMove);
    grid.appendChild(c);
  }
  if(!window.CG_EDITOR_MODE && edit){ edit=false; }
  document.body.classList.toggle("editing",edit && window.CG_EDITOR_MODE);
  modeLabel.textContent=(edit && window.CG_EDITOR_MODE ? "EDIT" : "PLAY");
  const editToggle=document.getElementById("toggleEdit");
  editToggle.textContent=(edit && window.CG_EDITOR_MODE)?"ÉDITION":"⚙";
  editToggle.title=(edit && window.CG_EDITOR_MODE)?"Quitter l’édition":"Ouvrir les outils";
  editToggle.className=(edit && window.CG_EDITOR_MODE)?"active gearBtn":"gearBtn";
  editPanel.className=(edit && window.CG_EDITOR_MODE)?"":"hidden";
  document.getElementById("levelInput").value=currentLevel+1;updateLockUI();
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
function outside(x,y){return x<0||y<0||x>=W||y>=H}
function cw(m){let o=Array.from({length:H},()=>Array(W).fill("."));for(let y=0;y<H;y++)for(let x=0;x<W;x++)o[x][H-1-y]=m[y][x];return o}
function ccw(m){let o=Array.from({length:H},()=>Array(W).fill("."));for(let y=0;y<H;y++)for(let x=0;x<W;x++)o[W-1-x][y]=m[y][x];return o}
function pcw(q){return{x:H-1-q.y,y:q.x}}function pccw(q){return{x:q.y,y:W-1-q.x}}
function apply(d){resetPlayerTrail();visualOri=(visualOri+d+4)%4;if(d>0){b=cw(b);p=pcw(p);exit=pcw(exit)}else{b=ccw(b);p=pccw(p);exit=pccw(exit)}}
function toggleDoors(){
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(b[y][x]=="D")b[y][x]="O";else if(b[y][x]=="O")b[y][x]="D";}
}
function turn(d){
  if(edit||busy||gameOver||gamePaused)return;
  hideCompanion(false);clearTimeout(companionTimer);clearTimeout(companionIdleTimer);
  busy=true;moves++;rotatorCooldown=false;userAudioGesture();soundRotate(d);updateStats();
  const dur=getRotationDurationMs();
  const interval=16;
  const step=Math.max(2,90/(dur/interval));
  let a=0,target=d*90,timer=setInterval(()=>{
    a+=d*step;
    rot.setAttribute("transform","rotate("+a+" 260 260)");
    if(Math.abs(a)>=Math.abs(target)){
      clearInterval(timer);
      rot.setAttribute("transform",`rotate(0 ${BOARD/2} ${BOARD/2})`);
      apply(d);draw();fall();
    }
  },interval);
}
function shake(dist){if(dist<=0)return;let amp=Math.min(7,1.5+dist*.7),s=[[amp,0],[-amp*.65,0],[amp*.35,0],[0,0]],i=0;(function tick(){let v=s[i++];stage.style.transform=`translate(${v[0]}px,${v[1]}px)`;if(i<s.length)setTimeout(tick,25);else stage.style.transform="translate(0,0)"})()}

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
  const colors=["#f1c453","#ffd978","#5b3600","#ffffff","#111111"];
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
    h.style.color=i%2?"#ff6b9b":"#ffd1df";
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
  h.style.color="#ff6b9b";
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
  const colors=["#8aa0ff","#b8bddc","#74778b","#f1c453"];
  for(let i=0;i<count;i++){
    let d=document.createElement("div");
    d.className="gravel";
    d.style.left=(cx+(Math.random()*24-12))+"px";
    d.style.top=(cy+(Math.random()*8-4))+"px";
    d.style.background=colors[Math.floor(Math.random()*colors.length)];
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
  const dur=getRotationDurationMs();
  const interval=16;
  const step=Math.max(2,90/(dur/interval));
  let a=0,target=dir*90;
  let timer=setInterval(()=>{
    a+=dir*step;
    rot.setAttribute("transform","rotate("+a+" 260 260)");
    if(Math.abs(a)>=Math.abs(target)){
      clearInterval(timer);
      rot.setAttribute("transform",`rotate(0 ${BOARD/2} ${BOARD/2})`);
      apply(dir);
      draw();
      setTimeout(()=>fall(),getFallDelayMs());
    }
  },interval);
}

function triggerDeathTile(){
  gameOver=true;
  deadPlayer=true;
  status.textContent="Mort : case ☠.";
  soundCrash();soundLose();
  dissolvePlayer();
  draw();
  showBanner("MORT ☠","La tronche de la mort t'a pulvérisé.", "☆☆☆","lose");
  busy=false;
}

function triggerEternalFall(){
  gameOver=true;
  busy=false;
  status.textContent="Chute éternelle détectée.";
  soundEternalFall();
  soundLose();
  showBanner("CHUTE ÉTERNELLE","Vous avez été pris dans une chute éternelle.","☆☆☆","lose");
}

function fall(){
  if(edit||gameOver||gamePaused){busy=false;return;}
  let dist=0;
  let safety=0;

  const step=()=>{
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
      p.y=ny;
      p.x=nx;
      const newKey=p.x+","+p.y;
      if(newKey!==oldKey)rotatorCooldown=false;
      dist++;
      touchSwitch();
      draw();
      setTimeout(step,getFallDelayMs());
    }else{
      const switched=touchSwitch();

      // Si le bouton vient d’ouvrir une porte sous le cube, on ne force pas un arrêt artificiel.
      // Le niveau réagit immédiatement et la chute reprend sur la même frame logique.
      if(switched && canFallOneCell()){
        setTimeout(step,getFallDelayMs());
        return;
      }

      eternalFallWraps=0;
      shake(dist);
      soundLand(dist);
      squash=Math.min(1,0.25+dist*.11);
      setTimeout(()=>{squash=0;draw()},130);
      gravelFx(dist);
      draw();
      busy=false;
      if(p.x==exit.x&&p.y==exit.y){
        gameOver=true;
        let s=starScore();
        let stars="♥".repeat(s)+"♡".repeat(3-s);
        status.textContent="Niveau gagné.";
        soundLove();
        soundWin();
        bigHeart();
        floatingHearts();
        startConfetti();
        saveWinProgress();
        if(currentLevel>=49 || currentLevel===levels.length-1){
          showBanner(
            "DESTINÉE VALIDÉE 💖",
            "Vous avez terminé les 50 niveaux. Votre date a enfin fonctionné. Il n’y a plus qu’à tenir les 3 prochaines années pour passer le cap. Tout au long du jeu, vous avez réussi à rencontrer différentes personnes, mais rien n’avait vraiment abouti. Cette fois, la dernière était la bonne — ou le bon.",
            "💖 🌸 💋 ⭐ 💐",
            "final"
          );
        }else{
          showBanner("DESTINÉE RETROUVÉE","« "+levels[currentLevel].name+" » · "+moves+" coups · objectif 3♥ : "+levels[currentLevel].maxMoves,stars,"win");
        }
      }
    }
  };
  step();
}

function spawnBgDots(clear=false, biomeOverride=null){
  const bg=document.getElementById("pixelBg");
  if(!bg)return;
  if(clear)bg.innerHTML="";
  const biome=biomeOverride || document.body.className.match(/biome-([a-z]+)/)?.[1] || localStorage.getItem("gravity_cube_biome") || "cosmic";
  const palettes={
    cosmic:["#00e5ff","#ff2bd6","#7c4dff","#fff000","#00e676"],
    forest:["#00ff66","#b6ff00","#00c853","#ffea00","#31ffb7"],
    desert:["#ff8a00","#ffd000","#ff3d00","#fff176","#ff6b00"],
    ice:["#00d5ff","#d8fbff","#59f0ff","#ffffff","#7c9cff"],
    rainbow:["#ff2bd6","#ff8a00","#fff000","#00e676","#00b8ff"],
    love:["#ff4f93","#ffd1eb","#ff8fc2","#ffd640","#ffffff"],
    garden:["#52f28a","#b6ff00","#ffd640","#ff8fc2","#ffffff"],
    kiss:["#ff6b9b","#ffd1df","#ff304f","#ffd640","#ffffff"],
    starry:["#405cff","#29e7ff","#ffe35a","#ffffff","#9b6cff"]
  };
  const types={
    cosmic:["star","spark","cloud","plant","spark"],
    forest:["plant","plant","rock","spark","cloud"],
    desert:["rock","spark","cloud","rock","star"],
    ice:["spark","cloud","rock","star","spark"],
    rainbow:["star","spark","cloud","plant","spark"],
    love:["heart","kiss","flower","star","heart"],
    garden:["flower","heart","plant","star","kiss"],
    kiss:["kiss","heart","star","flower","kiss"],
    starry:["star","star","heart","spark","flower"]
  };
  const p=palettes[biome]||palettes.cosmic;
  const t=types[biome]||types.cosmic;
  const shapes=[
    {x:"7%",y:"14%",s:78,c:p[0],t:t[0]},
    {x:"82%",y:"13%",s:66,c:p[1],t:t[1]},
    {x:"9%",y:"70%",s:90,c:p[2],t:t[2]},
    {x:"82%",y:"68%",s:84,c:p[3],t:t[3]},
    {x:"46%",y:"8%",s:62,c:p[4],t:t[4]},
    {x:"17%",y:"42%",g:"♡",c:p[1]},
    {x:"88%",y:"42%",g:"✦",c:p[4]},
    {x:"27%",y:"84%",g:"🌸",c:p[2]},
    {x:"72%",y:"84%",g:"💋",c:p[0]},
    {x:"50%",y:"90%",g:"♥",c:p[1]}
  ];
  for(const sh of shapes){
    const d=document.createElement("div");
    if(sh.g){
      d.className="biomeGlyph";
      d.textContent=sh.g;
      d.style.left=sh.x;
      d.style.top=sh.y;
      d.style.color=sh.c;
      d.style.animationDelay=(-Math.random()*7)+"s";
      bg.appendChild(d);
      continue;
    }
    d.className="pxshape";
    d.style.left=sh.x; d.style.top=sh.y; d.style.width=sh.s+"px"; d.style.height=sh.s+"px";
    d.innerHTML=pixelShape(sh.c,sh.t);
    bg.appendChild(d);
  }
}
function pixelShape(c,t){
  if(t==="heart")return `<svg viewBox="0 0 16 16"><rect x="4" y="3" width="3" height="3" fill="${c}"/><rect x="9" y="3" width="3" height="3" fill="${c}"/><rect x="3" y="5" width="10" height="4" fill="${c}"/><rect x="5" y="9" width="6" height="2" fill="${c}"/><rect x="7" y="11" width="2" height="2" fill="${c}"/></svg>`;
  if(t==="flower")return `<svg viewBox="0 0 16 16"><rect x="7" y="7" width="2" height="2" fill="#ffd640"/><rect x="7" y="2" width="2" height="4" fill="${c}"/><rect x="7" y="10" width="2" height="4" fill="${c}"/><rect x="2" y="7" width="4" height="2" fill="${c}"/><rect x="10" y="7" width="4" height="2" fill="${c}"/><rect x="5" y="5" width="6" height="6" fill="rgba(255,255,255,.22)"/></svg>`;
  if(t==="kiss")return `<svg viewBox="0 0 16 16"><rect x="3" y="6" width="10" height="2" fill="${c}"/><rect x="4" y="4" width="8" height="2" fill="${c}"/><rect x="4" y="8" width="8" height="2" fill="${c}"/><rect x="6" y="10" width="4" height="2" fill="${c}"/><rect x="5" y="5" width="2" height="1" fill="rgba(255,255,255,.55)"/></svg>`;
  if(t==="star")return `<svg viewBox="0 0 16 16"><rect x="7" y="1" width="2" height="4" fill="${c}"/><rect x="7" y="11" width="2" height="4" fill="${c}"/><rect x="1" y="7" width="4" height="2" fill="${c}"/><rect x="11" y="7" width="4" height="2" fill="${c}"/><rect x="6" y="6" width="4" height="4" fill="${c}"/></svg>`;
  if(t==="plant")return `<svg viewBox="0 0 16 16"><rect x="7" y="6" width="2" height="8" fill="${c}"/><rect x="4" y="8" width="3" height="2" fill="${c}"/><rect x="9" y="5" width="4" height="2" fill="${c}"/><rect x="5" y="3" width="2" height="3" fill="${c}"/><rect x="6" y="14" width="4" height="1" fill="${c}"/></svg>`;
  if(t==="rock")return `<svg viewBox="0 0 16 16"><rect x="3" y="6" width="10" height="6" fill="${c}"/><rect x="5" y="4" width="6" height="2" fill="${c}"/><rect x="2" y="8" width="2" height="3" fill="${c}"/><rect x="12" y="7" width="2" height="4" fill="${c}"/><rect x="5" y="7" width="2" height="1" fill="rgba(255,255,255,.45)"/></svg>`;
  if(t==="spark")return `<svg viewBox="0 0 16 16"><rect x="7" y="2" width="2" height="12" fill="${c}"/><rect x="2" y="7" width="12" height="2" fill="${c}"/><rect x="5" y="5" width="6" height="6" fill="${c}"/></svg>`;
  return `<svg viewBox="0 0 16 16"><rect x="3" y="6" width="10" height="4" fill="${c}"/><rect x="5" y="4" width="6" height="2" fill="${c}"/><rect x="2" y="8" width="12" height="3" fill="${c}"/><rect x="5" y="7" width="2" height="1" fill="rgba(255,255,255,.45)"/></svg>`;
}
function confettiBurst(count=24){
  const colors=["#ffd640","#52f28a","#3fc1ff","#ff6b9b","#9b6cff","#ff8fc2"];
  const glyphs=["","♥","♡","🌸","💋","⭐","✦"];
  for(let i=0;i<count;i++){
    let c=document.createElement("div");
    c.className="confetti";
    const glyph=glyphs[Math.floor(Math.random()*glyphs.length)];
    c.style.left=(Math.random()*100)+"vw";
    c.style.animationDelay=(Math.random()*.18)+"s";
    c.style.animationDuration=(1.0+Math.random()*1.0)+"s";
    c.style.transform=`translateY(-20px) rotate(${Math.random()*180}deg)`;
    if(glyph){
      c.textContent=glyph;
      c.style.width='18px';
      c.style.height='18px';
      c.style.background='transparent';
      c.style.color=colors[Math.floor(Math.random()*colors.length)];
    }else{
      c.style.background=colors[Math.floor(Math.random()*colors.length)];
      c.style.borderRadius=(Math.random()>.6?'50%':'2px');
    }
    stage.appendChild(c);
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
  document.body.classList.remove("biome-cosmic","biome-forest","biome-desert","biome-ice","biome-rainbow","biome-love","biome-garden","biome-kiss","biome-starry");
  document.body.classList.add("biome-"+name);
  try{localStorage.setItem("gravity_cube_biome",name)}catch(e){}
  spawnBgDots(true,name);
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
function addLevel(){writeCurrentLevel();levels.push({name:"Nouveau niveau "+(levels.length+1),maxMoves:999,locked:false,difficulty:1,gridSize:W,biome:document.getElementById("biomeSelect").value||"cosmic",map:generatedMap()});loadFromLevel(levels.length-1);edit=true;draw();calcMoves();status.textContent="Nouveau niveau ajouté avec une base."}
function genLevel(){if(isLocked()){status.innerHTML='<span class="lockedWarn">Niveau verrouillé.</span>';return}pushLevelUndo("gen");baseMap=arr(generatedMap());normalize();levels[currentLevel].map=map();resetPlay();edit=true;draw();calcMoves();status.textContent="Base générée pour ce niveau."}
function clearMap(){if(isLocked()){status.innerHTML='<span class="lockedWarn">Niveau verrouillé.</span>';return}pushLevelUndo("clear");baseMap=Array.from({length:H},()=>Array(W).fill("."));baseMap[1][1]="A";baseMap[H-2][W-2]="B";normalize();levels[currentLevel].map=map();resetPlay();edit=true;draw();status.textContent="Carte vidée."}
function goLevel(i){writeCurrentLevel();loadFromLevel(i);saveCurrentProgress();status.textContent="Niveau "+(currentLevel+1)+" chargé : "+(levels[currentLevel].name||"sans nom")+"."}
function goInput(){let n=parseInt(document.getElementById("levelInput").value,10);if(!isNaN(n))goLevel(n-1)}

function simFall(state){
  let {map,p}=state; let steps=0; let switchesHit=0; let tpCooldown=state.tpCooldown||null;
  const isBlock=(c)=>c=="#"||c=="D";
  const out=(x,y)=>x<0||y<0||x>=W||y>=H;
  const sol=(x,y)=>out(x,y)||isBlock(map[y][x]);
  while(true){
    const c=map[p.y]&&map[p.y][p.x];
    if(!isTeleporterChar(c)||c!==tpCooldown)tpCooldown=null;
    if(isTeleporterChar(c)&&tpCooldown!==c){
      const target=pairedTeleporterPosition(map,p);
      if(target){p={x:target.x,y:target.y};tpCooldown=c;steps++;if(steps>80)return {dead:true};continue;}
    }
    if(c=="S"){
      switchesHit++;
      if(switchesHit>8)return {dead:true};
      map=map.map(r=>r.map(c=>c=="D"?"O":c=="O"?"D":c));
    }
    let nx=p.x,ny=p.y+1;
    if(out(nx,ny))return {dead:true};
    if(!sol(nx,ny)){p={x:nx,y:ny};steps++; if(steps>80)return {dead:true}; continue;}
    if(map[p.y]&&map[p.y][p.x]=="S"){
      switchesHit++;
      if(switchesHit>8)return {dead:true};
      map=map.map(r=>r.map(c=>c=="D"?"O":c=="O"?"D":c));
    }
    return {map,p,dead:false,tpCooldown};
  }
}
function simRotate(state,d){
  let map=state.map,p=state.p,ex=state.exit;
  const rcw=(m)=>{let o=Array.from({length:H},()=>Array(W).fill("."));for(let y=0;y<H;y++)for(let x=0;x<W;x++)o[x][H-1-y]=m[y][x];return o};
  const rccw=(m)=>{let o=Array.from({length:H},()=>Array(W).fill("."));for(let y=0;y<H;y++)for(let x=0;x<W;x++)o[W-1-x][y]=m[y][x];return o};
  const qcw=(q)=>({x:H-1-q.y,y:q.x}), qccw=(q)=>({x:q.y,y:W-1-q.x});
  if(d>0){map=rcw(map);p=qcw(p);ex=qcw(ex)} else {map=rccw(map);p=qccw(p);ex=qccw(ex)}
  return simFall({map,p,exit:ex,tpCooldown:state.tpCooldown||null});
}
function stateKey(s){return s.p.x+","+s.p.y+"|"+s.exit.x+","+s.exit.y+"|tp="+(s.tpCooldown||"")+"|"+s.map.map(r=>r.join("")).join("")}
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




const PROGRESS_KEY="gravity_cube_player_progress_v1";

function loadProgress(){
  try{
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)||'{"currentLevel":0,"highestLevel":0,"best":{}}');
  }catch(e){
    return {currentLevel:0,highestLevel:0,best:{}};
  }
}
function saveProgress(data){
  try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(data));}catch(e){}
}
function saveCurrentProgress(){
  const pr=loadProgress();
  pr.currentLevel=currentLevel;
  pr.highestLevel=Math.max(pr.highestLevel||0,currentLevel);
  saveProgress(pr);
}
function saveWinProgress(){
  const pr=loadProgress();
  const stars=starScore();
  const best=pr.best||{};
  const old=best[currentLevel];
  if(!old || moves<old.moves || stars>old.stars){
    best[currentLevel]={moves:moves,stars:stars};
  }
  pr.best=best;
  pr.currentLevel=Math.min(currentLevel+1,levels.length-1);
  pr.highestLevel=Math.max(pr.highestLevel||0,currentLevel+1);
  saveProgress(pr);
}
function savedStartLevel(){
  const pr=loadProgress();
  let idx=parseInt(pr.currentLevel||0,10);
  if(!Number.isFinite(idx))idx=0;
  return Math.max(0,Math.min(levels.length-1,idx));
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
  return currentLevel===0 ? "core" : "";
}
function companionSeenKey(stage){
  return "gravity_cube_companion_"+COMPANION_VERSION+"_seen_"+stage;
}
function companionMessage(kind="intro"){
  const stage=companionStage();
  if(stage==="core"){
    return "Tourne le plateau pour me déplacer. Je tombe seulement après la rotation. Cherche surtout où je vais m'arrêter.";
  }
  if(stage==="button"){
    return kind==="hint"
      ? "Indice : le bouton inverse les portes. Le bon moment compte plus que la vitesse."
      : "Nouvelle brique : le bouton. Quand je passe dessus, les portes ouvertes se ferment et les portes fermées s'ouvrent.";
  }
  if(stage==="death"){
    return kind==="hint"
      ? "Indice : vise d'abord une case sûre où atterrir. La sortie vient après."
      : "Nouvelle brique : la mort. Si je touche la tête de mort, je me désintègre en pixels. Dramatique, mais clair.";
  }
  if(stage==="rotator"){
    return kind==="hint"
      ? "Indice : le rotateur tourne le monde à ta place. Prévois ma chute après cette rotation forcée."
      : "Nouvelle brique : le rotateur. Quand je le touche, le plateau tourne automatiquement puis la gravité reprend.";
  }
  if(stage==="teleporter"){
    return kind==="hint"
      ? "Indice : une couleur mène à la même couleur. Après la sortie, je continue à tomber dans le même sens."
      : "Nouvelle brique : le téléporteur. J'entre dans une couleur, je ressors par l'autre de la même couleur. Le plateau ne tourne pas.";
  }
  return kind==="hint"
    ? "Indice : pense en étapes : rotation, chute, arrêt, prochaine rotation."
    : "";
}

function persistentTipText(){
  const raw = companionMessage("hint") || "Tourne le plateau pour me déplacer.";
  return raw.startsWith("Indice") || raw.startsWith("Astuce") ? raw : ("Astuce : " + raw);
}

function showCompanion(msg, markSeen=false){
  if(edit||gameOver||!msg)return;
  const dock=document.getElementById("companionDock");
  const help=document.getElementById("companionHelp");
  const txt=document.getElementById("companionText");
  const skip=document.getElementById("companionSkip");
  if(!dock||!txt)return;
  txt.textContent=msg;
  dock.classList.remove("hidden");
  dock.classList.remove("tipVisible");
  if(skip)skip.textContent="Passer";
  if(help)help.classList.add("hidden");
  if(markSeen){
    const stage=companionStage();
    if(stage){
      try{localStorage.setItem(companionSeenKey(stage),"1")}catch(e){}
    }
  }
}
function hideCompanion(showHelp=true){
  const dock=document.getElementById("companionDock");
  const help=document.getElementById("companionHelp");
  if(dock){
    dock.classList.add("hidden");
    dock.classList.remove("tipVisible");
  }
  if(help){
    if(showHelp&&!edit&&!gameOver)help.classList.remove("hidden");
    else help.classList.add("hidden");
  }
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
document.getElementById("companionHelp").onclick=()=>showCompanion(companionMessage("hint"),false);

document.getElementById("toggleEdit").onclick=()=>{if(!window.CG_EDITOR_MODE){edit=false;draw();return;}edit=!edit;if(!edit){resetPlay();scheduleCompanion(true)}else{busy=false;gameOver=false;hideBanner();hideCompanion(false);draw()}};
document.getElementById("companionSkip").onclick=()=>{
  const stage=companionStage();
  if(stage){
    try{localStorage.setItem(companionSeenKey(stage),"1")}catch(e){}
  }
  hideCompanion(true);
};
document.getElementById("companionHelp").onclick=()=>showCompanion(companionMessage("hint"),false);
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
document.getElementById("pauseMainMenu")?.addEventListener("click",()=>{setPaused(false);stopElevatorMusic();window.location.href="index.html";});
applyAudioVolumes();
updatePauseButtons();
document.getElementById("title")?.addEventListener("click",showLevelRecap);
document.getElementById("playStats")?.addEventListener("click",showLevelRecap);
document.getElementById("levelBadge")?.addEventListener("click",showLevelRecap);
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
  ["core","button","death","rotator","teleporter"].forEach(s=>{
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
}
function showInfoBanner(title,html){
  if(!banner)return;
  bannerTitle.textContent=title;
  bannerText.innerHTML=html;
  starsEl.textContent="";
  bannerAction.textContent="OK";
  bannerAction.onclick=()=>banner.classList.add("hidden");
  banner.classList.remove("lose");
  banner.classList.remove("hidden");
}
function showLevelRecap(){
  if(edit || !levels[currentLevel])return;
  const l=levels[currentLevel];
  const best=loadProgress().best?.[currentLevel] || null;
  const solution=l.solution ? String(l.solution).replaceAll("L","↺ ").replaceAll("R","↻ ").trim() : "Non calculée";
  showInfoBanner((currentLevel+1)+" - "+(l.name||"Niveau"),
    "Objectif 3♥ : <b>"+(l.maxMoves||"?")+" coup(s)</b><br>"+
    "Difficulté : <b>"+(l.difficulty||1)+"</b><br>"+
    (best?"Meilleur score : <b>"+best.moves+" coup(s)</b><br>":"")+
    "Solution connue : <b>"+solution+"</b>");
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

  status.style.display="block";
  status.textContent="OK : niveaux chargés depuis "+source+" ("+levels.length+" niveau(x)).";
}

function showLevelsJsonError(err){
  hideLoadingOverlay();
  console.error("[LEVELS] ECHEC CHARGEMENT levels.json", err);
  levels=[];
  status.style.display="block";
  const proto=location.protocol || "";
  const localHint=proto==="file:" ? " Tu ouvres le jeu en file:// : lance run_local_server.bat ou importe le fichier manuellement." : "";
  status.textContent="ERREUR : levels.json non chargé. Vérifie que levels.json est à côté de index.html."+localHint;

  bannerTitle.textContent="levels.json introuvable";
  bannerText.innerHTML=
    "Le jeu ne charge aucun niveau en dur.<br>"+
    "Fichiers attendus au même niveau : <b>index.html</b>, <b>levels.json</b>, <b>assets.json</b>.<br>"+
    "Protocole actuel : <b>"+proto+"</b><br>"+
    (proto==="file:" ? "En local, utilise <b>run_local_server.bat</b> ou le bouton Importer levels.json.<br>" : "")+
    "<button id='manualLevelsImport' style='margin-top:12px;background:#52f28a;color:#051407;font-size:16px;padding:12px 18px;border-radius:12px'>Importer levels.json</button>";
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
  // Shipping robuste : on tente le fichier externe, puis le snapshot embarqué dans game.html.
  // Comme ça, si le serveur, le cache ou le chemin joue au clown, le joueur voit quand même le jeu.
  try{
    const result=await fetchJsonFromCandidates("LEVELS",["./levels.json","levels.json","/levels.json"]);
    applyLevelsData(result.data,result.path);
  }catch(err){
    console.warn("[LEVELS] levels.json externe indisponible, fallback embarqué utilisé",err);
    try{
      applyLevelsData(EMBEDDED_LEVELS_DATA,"fallback embarqué game.html");
      status.textContent="OK : niveaux chargés depuis le fallback embarqué. Replace levels.json quand tu publies.";
    }catch(fallbackErr){
      showLevelsJsonError(err);
    }
  }
}

setInterval(()=>{idleTick++; if(!edit&&!busy&&!gameOver){draw()}},120);

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
loadAssets()
  .then(()=>loadVectorAssets())
  .then(()=>loadStaticLevels())
  .catch(err=>{
    console.error("[BOOT] arrêt volontaire : vector_assets.json obligatoire",err);
    setVectorStatus("SVG OFF\nBOOT STOP","bad");
    if(typeof banner!=="undefined"){
      bannerTitle.textContent="vector_assets.json obligatoire";
      bannerText.innerHTML="Le jeu est en mode strict SVG.<br>Il faut un fichier <b>vector_assets.json</b> au même niveau que <b>index.html</b>.<br><br>Erreur : "+String(err.message||err);
      starsEl.textContent="";
      bannerAction.textContent="OK";
      bannerAction.onclick=()=>banner.classList.add("hidden");
      banner.classList.remove("hidden");
    }
  });


// V33 main menu: click/tap the big face to enter the game.
(function(){
  const menu=document.getElementById("mainMenu");
  const head=document.getElementById("mainMenuHead");
  function closeMainMenu(){
    if(!menu)return;
    menu.classList.add("hidden");
    setPaused(false); userAudioGesture();
    try{ if(typeof scheduleCompanion === "function") scheduleCompanion(false); }catch(e){}
  }
  if(menu) menu.addEventListener("pointerdown", closeMainMenu, {passive:true});
  if(head) head.addEventListener("keydown", e=>{
    if(e.key==="Enter"||e.key===" "){
      e.preventDefault();
      closeMainMenu();
    }
  });
})();




/* ===== V77 mobile fullscreen behavior ===== */
(function(){
  const btn = document.getElementById("fullscreenBtn");
  if(!btn) return;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const isStandalone = () =>
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches;

  function showFullscreenHelp(){
    const msg = isIOS
      ? "Sur iPhone, Safari ne permet pas toujours le vrai plein écran par bouton. Pour avoir le rendu plein écran : bouton Partager → Ajouter à l’écran d’accueil → lance le jeu depuis l’icône."
      : "Ton navigateur bloque le plein écran. Lance le jeu depuis Chrome/Edge et appuie sur le bouton plein écran.";

    if(typeof banner !== "undefined" && banner && typeof bannerTitle !== "undefined"){
      bannerTitle.textContent = "Plein écran";
      bannerText.textContent = msg;
      if(typeof starsEl !== "undefined") starsEl.textContent = "";
      bannerAction.textContent = "OK";
      bannerAction.onclick = () => banner.classList.add("hidden");
      banner.classList.remove("hidden");
    }else{
      alert(msg);
    }
  }

  async function requestFullscreenSafe(){
    if(isStandalone()){
      btn.style.display = "none";
      return;
    }

    const target = document.documentElement;

    try{
      if(target.requestFullscreen){
        await target.requestFullscreen({navigationUI:"hide"});
        btn.style.display = "none";
        return;
      }
      if(target.webkitRequestFullscreen){
        target.webkitRequestFullscreen();
        btn.style.display = "none";
        return;
      }

      showFullscreenHelp();
    }catch(err){
      console.warn("[FULLSCREEN] impossible", err);
      showFullscreenHelp();
    }
  }

  btn.addEventListener("click", requestFullscreenSafe);

  document.addEventListener("fullscreenchange", () => {
    btn.style.display = document.fullscreenElement ? "none" : "";
  });
  document.addEventListener("webkitfullscreenchange", () => {
    btn.style.display = document.webkitFullscreenElement ? "none" : "";
  });

  if(isStandalone()){
    btn.style.display = "none";
  }
})();




/* ===== V78 force fullscreen button visible on mobile browser ===== */
(function(){
  const btn=document.getElementById("fullscreenBtn");
  if(!btn)return;

  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);

  const isStandalone=()=>window.navigator.standalone===true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches;

  function forceButtonVisibility(){
    if(isStandalone()){
      btn.style.display="none";
      return;
    }
    btn.style.display="flex";
    btn.style.visibility="visible";
    btn.style.opacity="1";
  }

  forceButtonVisibility();
  window.addEventListener("resize", forceButtonVisibility);
  window.addEventListener("orientationchange", forceButtonVisibility);

  btn.addEventListener("click", async ()=>{
    if(isIOS){
      const msg="Sur iPhone : bouton Partager → Ajouter à l’écran d’accueil → relance le jeu depuis l’icône pour avoir le vrai plein écran.";
      if(typeof banner!=="undefined" && banner && typeof bannerTitle!=="undefined"){
        bannerTitle.textContent="Plein écran iPhone";
        bannerText.textContent=msg;
        if(typeof starsEl!=="undefined")starsEl.textContent="";
        bannerAction.textContent="OK";
        bannerAction.onclick=()=>banner.classList.add("hidden");
        banner.classList.remove("hidden");
      }else alert(msg);
      return;
    }

    try{
      const target=document.documentElement;
      if(target.requestFullscreen) await target.requestFullscreen({navigationUI:"hide"});
      else if(target.webkitRequestFullscreen) target.webkitRequestFullscreen();
    }catch(e){
      console.warn("[FULLSCREEN]",e);
    }
  }, {capture:true});
})();




/* ===== V78 clamp bottom gameplay controls ===== */
(function(){
  function clampControls(){
    const candidates=[...document.querySelectorAll("button")].filter(b=>{
      const t=(b.textContent||"").toLowerCase();
      const id=(b.id||"").toLowerCase();
      const cl=(b.className||"").toString().toLowerCase();
      return t.includes("reset") || id.includes("reset") || cl.includes("reset");
    });
    const reset=candidates[0];
    if(!reset || !reset.parentElement)return;
    const row=reset.parentElement;
    const buttons=[...row.querySelectorAll("button")];
    if(buttons.length<3)return;

    row.style.boxSizing="border-box";
    row.style.maxWidth="100vw";
    row.style.width="100%";
    row.style.paddingLeft="10px";
    row.style.paddingRight="10px";
    row.style.display="grid";
    row.style.gridTemplateColumns="minmax(0,1fr) minmax(74px,.46fr) minmax(0,1fr)";
    row.style.gap="8px";
    row.style.overflow="visible";

    buttons.forEach(b=>{
      b.style.minWidth="0";
      b.style.maxWidth="100%";
      b.style.boxSizing="border-box";
    });
  }
  window.addEventListener("load", clampControls);
  window.addEventListener("resize", clampControls);
  window.addEventListener("orientationchange", clampControls);
  setTimeout(clampControls, 250);
})();



/* V35: bypass old internal menu because index.html is now the real menu. */
(function(){
  function forceGameStart(){
    document.body.classList.add("force-game-start");
    ["mainMenu","startMenu","homeMenu"].forEach(id=>{
      const el=document.getElementById(id);
      if(el){ el.style.display="none"; el.style.pointerEvents="none"; }
    });
    document.querySelectorAll(".mainMenu,.menuOverlay").forEach(el=>{
      el.style.display="none";
      el.style.pointerEvents="none";
    });
    try {
      window.__skipMainMenu = true;
      localStorage.setItem("gravity_cube_skip_embedded_menu","1");
    } catch(e) {}
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", forceGameStart);
  else forceGameStart();
  window.addEventListener("load", forceGameStart);
})();

if(window.CG_EDITOR_MODE){console.log("Editor mode enabled");}

/* ===== V43.29 fullscreen moved into pause menu ===== */
(function(){
  const btn=document.getElementById("pauseFullscreen");
  if(!btn)return;

  function isIOS(){
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
  }

  function showFullscreenHelp(){
    const msg=isIOS()
      ? "Sur iPhone, Safari ne donne pas toujours le vrai plein écran par bouton. Pour le rendu plein écran : Partager → Ajouter à l’écran d’accueil, puis lance le jeu depuis l’icône."
      : "Ton navigateur bloque le plein écran. Essaie depuis Chrome/Edge ou lance le jeu en mode application.";
    if(typeof banner!=="undefined" && banner && typeof bannerTitle!=="undefined"){
      bannerTitle.textContent="Plein écran";
      bannerText.textContent=msg;
      if(typeof starsEl!=="undefined")starsEl.textContent="";
      bannerAction.textContent="OK";
      bannerAction.onclick=()=>banner.classList.add("hidden");
      banner.classList.remove("hidden");
    }else{
      alert(msg);
    }
  }

  btn.addEventListener("click",async()=>{
    try{
      const target=document.documentElement;
      if(target.requestFullscreen){
        await target.requestFullscreen({navigationUI:"hide"});
        return;
      }
      if(target.webkitRequestFullscreen){
        target.webkitRequestFullscreen();
        return;
      }
      showFullscreenHelp();
    }catch(e){
      console.warn("[PAUSE FULLSCREEN]",e);
      showFullscreenHelp();
    }
  });
})();


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
