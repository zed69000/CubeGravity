/* Joueur automatique pour l'audit de redondance (outil de test, hors du jeu).
   Il enchaîne la campagne comme un joueur : écrans, victoires, bouton Suivant, et une erreur de temps en temps.
   Tout ce qui s'affiche est noté dans window.__audit.events. */
(function(){
  const A=window.__audit={events:[],done:false,level:-1,t0:performance.now()};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const vis=el=>el&&!el.classList.contains("hidden")&&getComputedStyle(el).display!=="none";
  const log=(type,text,extra)=>A.events.push(Object.assign({t:Math.round(performance.now()-A.t0),lvl:currentLevel,type,text:(text||"").trim().replace(/\s+/g," ")},extra||{}));
  // tout ce qui apparaît à l'écran
  const bubble=document.getElementById("companionText");
  if(bubble)new MutationObserver(()=>log("bulle",bubble.textContent)).observe(bubble,{childList:true,characterData:true,subtree:true});
  const tx=document.getElementById("txLayer");
  if(tx)new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.classList&&n.classList.contains("stamp"))log("tampon",n.textContent);if(n.classList&&n.classList.contains("band"))log("rubans","");}))).observe(tx,{childList:true});
  const hint=document.getElementById("swipeHint");
  if(hint)new MutationObserver(()=>{if(hint.classList.contains("show"))log("rappel-swipe","");}).observe(hint,{attributes:true,attributeFilter:["class"]});
  const help=document.querySelector(".react");
  if(help)new MutationObserver(()=>{if(help.classList.contains("help"))log("aide-proposee","");}).observe(help,{attributes:true,attributeFilter:["class"]});
  const winS=document.getElementById("winScreen"),banner=document.getElementById("banner");
  async function settle(){
    // ferme les écrans qui bloquent (carte de rencontre, fin de chapitre…) comme le ferait un joueur
    for(let k=0;k<60;k++){
      const sc=document.querySelector(".screen.show");
      if(sc){const t=sc.querySelector("h2,h3,.name,#pfName");log("ecran",sc.id+" : "+(t?t.textContent:""));const b=sc.querySelector(".btn:not(.ghost)")||sc.querySelector(".btn");if(b)b.click();await wait(700);continue;}
      if(vis(banner)){log("bandeau",(document.getElementById("bannerTitle")||{}).textContent+" — "+(document.getElementById("bannerText")||{}).textContent);const b=banner.querySelector(".btn:not(.ghost)")||banner.querySelector(".btn");if(b)b.click();await wait(700);continue;}
      if(busy||dgTx.busy){await wait(120);continue;}
      return;
    }
  }
  async function move(d){let g=0;while((busy||dgTx.busy)&&g++<200)await wait(40);turn(d);await wait(60);}
  async function finishMoves(){let g=0;while((busy||dgTx.busy)&&g++<250)await wait(40);}
  A.run=async function(from,to,errorRate){
    for(let lv=from;lv<=to;lv++){
      await settle();
      if(currentLevel!==lv){log("saut","attendu "+lv+", ouvert "+currentLevel);}
      A.level=currentLevel;
      const sol=levels[currentLevel].solution||"";
      const tStart=performance.now();
      // une erreur de temps en temps : un mauvais coup, puis on recommence le niveau
      if(Math.random()<errorRate&&sol){
        await move(sol[0]==="R"?-1:1);await finishMoves();await wait(400);
        if(vis(banner)){await settle();}
        else{log("erreur","mauvais coup puis recommencer");resetPlay();await wait(900);}
      }
      for(const c of sol){await move(c==="R"?1:-1);if(gameOver)break;}
      await finishMoves();
      for(let k=0;k<40&&!vis(winS);k++)await wait(100);
      if(!vis(winS)){log("probleme","pas d'écran de victoire");continue;}
      log("victoire",document.getElementById("winTitle").textContent+" · "+document.getElementById("winMoves").textContent,{dur:Math.round(performance.now()-tStart)});
      await wait(900);
      const tNext=performance.now();
      const nx=document.getElementById("winNext");
      if(lv===to)break;
      nx.click();
      await wait(300);await settle();
      for(let k=0;k<80&&(busy||dgTx.busy);k++)await wait(100);
      log("transition","",{dur:Math.round(performance.now()-tNext)});
    }
    A.done=true;
  };
})();
