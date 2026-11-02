/* Date Gravity: scenes for the GDD preview in the developer space.
   Loaded by tuning.js only with ?tuning=preview, before the other game scripts; players never get this file.

   Each chapter of the GDD (?gdd=<slug>) opens its screen and, when it has something to show, replays it alone.
   The real game code runs the demo: real turns, real timers, real rules, so a slider acts as it does in play.

   While previewing, saves live in memory, nothing is posted, no real ad or purchase can start. */
(function(){
  if(!window.Tuning||!Tuning.preview)return;

  const query=new URLSearchParams(location.search);
  const SLUG=query.get("gdd")||"";
  const FREE=query.get("free")==="1"; // the viewer followed a link in the preview: free play, no demo

  /* ---------- isolation, in place before any game script reads a save ---------- */

  function memoryStorage(seed){
    const m=new Map(Object.entries(seed));
    return {
      get length(){return m.size;},
      key(i){return [...m.keys()][i]??null;},
      getItem(k){k=String(k);return m.has(k)?m.get(k):null;},
      setItem(k,v){m.set(String(k),String(v));},
      removeItem(k){m.delete(String(k));},
      clear(){m.clear();},
    };
  }
  function shadow(name,store){
    Object.defineProperty(window,name,{value:store,configurable:true,writable:true});
    if(window[name]!==store)throw new Error("[GDD] "+name+" cannot be replaced");
  }
  const met={};
  for(let i=1;i<=8;i++)met["w0"+i]=true; // no "new date" card over the demo
  const STAGES=["core","wrap","button","death","rotator","teleporter","fragile","heart"];
  const seed={dg_lang:"fr",gravity_cube_player_progress_v2:JSON.stringify({best:{},met})};
  STAGES.forEach(s=>{seed["gravity_cube_companion_v34_seen_"+s]="1";});
  let realSession=null;
  try{realSession=window.sessionStorage;}catch(e){}
  shadow("localStorage",memoryStorage(seed));
  shadow("sessionStorage",memoryStorage({}));

  const realFetch=window.fetch&&window.fetch.bind(window);
  if(realFetch)window.fetch=(url,opt)=>{
    const method=String((opt&&opt.method)||(url&&url.method)||"GET").toUpperCase();
    return method==="GET"?realFetch(url,opt):Promise.resolve(new Response(null,{status:204}));
  };
  if(navigator.sendBeacon)try{navigator.sendBeacon=()=>true;}catch(e){}
  window.open=()=>null;

  /* The game's own studio screen would cover the first scene. The head script already flagged it as seen. */
  const root=document.documentElement;
  if(root.classList.contains("splash")){
    root.classList.remove("splash");
    try{realSession.removeItem("dg_splash");}catch(e){}
  }

  /* Links must stay inside the preview, otherwise a tap would open the real game on the real save. */
  function keepPreview(url){
    const u=new URL(url,location.href);
    u.searchParams.set("tuning","preview");
    if(SLUG)u.searchParams.set("gdd",SLUG);
    u.searchParams.set("free","1");
    u.hash=location.hash;
    return u.pathname.split("/").pop()+u.search+u.hash;
  }
  window.addEventListener("click",e=>{
    const a=e.target.closest&&e.target.closest("a[href]");
    if(!a)return;
    if(new URL(a.href,location.href).origin!==location.origin){e.preventDefault();e.stopPropagation();return;}
    a.setAttribute("href",keepPreview(a.getAttribute("href")));
  },true);

  /* ---------- caption ---------- */

  const CAP_H=2*14+10, CAP_LIVE_H=3*14+10;
  const style=document.createElement("style");
  style.textContent=
    "#gddCap{position:fixed;left:0;right:0;top:0;z-index:2147483647;box-sizing:border-box;padding:5px 10px;overflow:hidden;"+
    "background:#0d1230;border-bottom:1px dashed #2b3a8c;color:#c6d0f2;font:500 11.5px/14px Rubik,Arial,sans-serif;pointer-events:none}"+
    "#atelier{display:none!important}"+ // the editors work on the real browser storage
    "#gddCap b{color:#f6ff3d;font-weight:800}"+
    "#gddCap u{text-decoration:none;color:#eaf0ff;font-weight:800}"+
    "#gddCap .live{display:block;color:#19e3ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}"+
    "#gddFinger{position:fixed;z-index:2147483646;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;pointer-events:none;"+
    "border:2px dashed #f6ff3d;background:rgba(246,255,61,.22);display:none}";
  document.head.appendChild(style);
  const bar=document.createElement("div");
  bar.id="gddCap";
  bar.setAttribute("aria-live","off");
  bar.innerHTML='<span class="txt"></span><span class="live"></span>';
  (document.body||root).appendChild(bar);
  const capTxt=bar.querySelector(".txt"), capLive=bar.querySelector(".live");

  // Texts are set with u() for slider names; the game reserves the height through its safe-area variable.
  const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
  const u=s=>"<u>« "+esc(s)+" »</u>";
  let capTitle="";
  function caption(text){capTxt.innerHTML="<b>"+esc(capTitle)+"</b> "+text;}
  function live(text){if(capLive.textContent!==text)capLive.textContent=text;}
  function reserve(withLive){
    const h=withLive?CAP_LIVE_H:CAP_H;
    bar.style.height=h+"px";
    capLive.style.display=withLive?"":"none";
    root.style.setProperty("--safe-area-inset-top",h+"px");
  }

  /* ---------- scene runner ---------- */

  const STOP={}, RETRY={};
  let runId=0;
  const $=id=>document.getElementById(id);
  function runner(id){
    const check=()=>{if(id!==runId)throw STOP;};
    return {
      async sleep(ms){
        const end=performance.now()+ms;
        for(;;){
          check();
          const left=end-performance.now();
          if(left<=0)return;
          await new Promise(r=>setTimeout(r,Math.min(left,80)));
        }
      },
      async until(cond,max=20000){
        const end=performance.now()+max;
        for(;;){
          check();
          if(cond())return;
          if(performance.now()>end)throw RETRY;
          await new Promise(r=>setTimeout(r,40));
        }
      },
    };
  }

  // Lets a repetition start from a known place whatever the previous one, or the viewer, left on screen.
  function clearScreens(){
    document.querySelectorAll(".screen.show").forEach(s=>dgHideScreen(s.id));
    if(gamePaused)setPaused(false);
    hideBanner();
  }
  function saveDemoProgress(fill){
    const pr={best:{},met};
    if(fill)dgChapters.forEach((c,ci)=>c.levelIds.forEach((id,n)=>{
      const stars=fill(ci,n,c.levelIds.length);
      if(stars)pr.best[levelKey(id)]={moves:1,stars};
    }));
    saveProgress(pr);
  }
  const quietHelp=()=>{dgHelp={level:currentLevel,fails:0,since:performance.now(),snooze:false,on:dgHelp.on};};
  const settled=()=>!busy&&!dgRot&&!dgTx.busy;

  function makeHelpers(r){
    return Object.assign(r,{
      // Opens a level with no trace of the previous attempt, then waits for the entry fall to finish.
      async open(i){
        await r.until(()=>!dgTx.busy);
        clearScreens();
        moves=0;
        loadFromLevel(i);
        quietHelp();
        await r.until(settled);
      },
      async restart(){
        moves=0;
        hideBanner();
        resetPlay();
        quietHelp();
        await r.until(settled);
      },
      async solve(pace){
        for(const c of dgSolution()){
          await r.until(settled);
          await r.sleep(pace);
          if(gameOver)break;
          turn(c==="R"?1:-1);
        }
        await r.until(()=>!$("winScreen").classList.contains("hidden"));
      },
      async scrollTo(id){
        await r.until(()=>!dgTx.busy);
        dgAdvance(id);
        await r.until(settled);
      },
    });
  }

  /* ---------- measures taken on the real game functions ---------- */

  const seen={spin:0,fallMs:0,fallCases:0,shake:-1,tampon:0,slide:0};
  function installMeasures(){
    const spin=dgSpin;
    dgSpin=function(d,from,done){
      const t=performance.now();
      return spin(d,from,()=>{seen.spin=performance.now()-t;done();});
    };
    const fallFn=fall;
    let fallAt=0;
    fall=function(){fallAt=performance.now();return fallFn();};
    const land=dgLand;
    dgLand=function(dist){
      if(dist>0){seen.fallMs=performance.now()-fallAt;seen.fallCases=dist;}
      return land(dist);
    };
    stage.animate=function(frames,opt){
      const m=frames&&frames[1]&&/translate\(0,([\d.]+)px\)/.exec(frames[1].transform||"");
      if(m)seen.shake=parseFloat(m[1]);
      return Element.prototype.animate.call(this,frames,opt);
    };
    const tampon=dgTampon;
    dgTampon=function(word,swap,dark){
      const t=performance.now();
      return tampon(word,()=>{seen.tampon=performance.now()-t-170;if(swap)swap();},dark);
    };
    const advance=dgAdvance;
    dgAdvance=function(target){
      const t=performance.now();
      advance(target);
      const wait=()=>{if(dgTx.busy)setTimeout(wait,20);else seen.slide=performance.now()-t;};
      wait();
    };
  }
  const ms=v=>Math.round(v)+" ms";
  const dec=v=>(Math.round(v*10)/10).toFixed(1).replace(".",",");

  /* ---------- simulated finger, read by the game's own gesture code ---------- */

  function fingerAt(el,x,y){el.style.left=x+"px";el.style.top=y+"px";}
  function makeFinger(r){
    const el=document.createElement("div");
    el.id="gddFinger";
    document.body.appendChild(el);
    const send=(type,x,y)=>svg.dispatchEvent(new PointerEvent(type,{pointerId:77,pointerType:"touch",isPrimary:true,bubbles:true,clientX:x,clientY:y,button:0}));
    let cur=null;
    return {
      // Turns the finger around the board centre up to `angle` degrees, calling onAngle at each step.
      async drag(angle,speed,onAngle){
        const br=svg.getBoundingClientRect(),cx=br.left+br.width/2,cy=br.top+br.height/2,rad=br.width*.42;
        const start=-140;
        const at=a=>{const t=(start+a)*Math.PI/180;return [cx+rad*Math.cos(t),cy+rad*Math.sin(t)];};
        const t0=performance.now();
        let [x,y]=at(0);
        cur={x,y};
        el.style.display="block";
        fingerAt(el,x,y);
        send("pointerdown",x,y);
        for(;;){
          await r.sleep(16);
          const a=Math.min(angle,(performance.now()-t0)/1000*speed);
          [x,y]=at(a);
          cur={x,y};
          fingerAt(el,x,y);
          send("pointermove",x,y);
          if(onAngle)onAngle(a);
          if(a>=angle)return;
        }
      },
      release(){
        if(!cur)return;
        send("pointerup",cur.x,cur.y);
        cur=null;
        el.style.display="none";
      },
    };
  }

  /* ---------- scenes ---------- */

  const n=(k,d)=>Tuning.num(k,d);
  let liveFn=null;

  const SCENES={
    "vue-ensemble":{page:"menu",title:"Vue d'ensemble.",
      text:"Le menu du jeu : toi et la personne à rejoindre. Aucun réglage. Touche « Jouer » pour essayer."},

    "technique":{page:"menu",title:"Technique.",
      text:"Rien à voir en jeu : voici les options (langue, version en bas). Aucun réglage dans ce chapitre.",
      start(){if(typeof openOptions==="function")openOptions();}},

    "boucle-de-jeu":{page:"game",title:"Boucle de jeu.",
      text:"Tourner, tomber, s'arrêter sur la rencontre, puis le niveau suivant. Aucun réglage dans ce chapitre.",
      live(){
        if(gameOver)return "Arrêt sur la rencontre : niveau gagné en "+moves+" coup"+(moves>1?"s":"");
        if(dgRot)return "Le plateau pivote : "+moves+" coup"+(moves>1?"s":"");
        if(dgFallAnim)return "La gravité fait tomber le personnage";
        return "Plateau immobile : le prochain coup se prépare";
      },
      async run(r){
        await r.open(2);
        await r.solve(900);
        await r.sleep(1200);
        await r.scrollTo(3);
        await r.solve(900);
        await r.sleep(1200);
        await r.scrollTo(4);
        await r.solve(900);
        await r.sleep(1500);
      }},

    "personnages":{page:"game",title:"Personnages.",
      noLive:true,
      text:"Les huit rencontres, leur fiche et leurs souvenirs, puis toi sur le plateau. Aucun réglage ici.",
      async run(r){
        saveDemoProgress((ci,i)=>i<8-ci?3-(i%2):0);
        await r.until(()=>!dgTx.busy);
        clearScreens();
        dgShowCollection();
        await r.sleep(3200);
        for(let ci=0;ci<dgChapters.length;ci++){
          dgShowPerson(ci);
          await r.sleep(2300);
        }
        await r.open(0);
        await r.solve(1100);
        await r.sleep(1600);
      }},

    "niveaux":{page:"game",title:"Niveaux.",
      noLive:true,
      text:"Les 8 chapitres, puis les niveaux de chacun, couronne sur le dernier. Aucun réglage ici.",
      async run(r){
        saveDemoProgress((ci,i,len)=>i<Math.ceil(len*(.95-ci*.09))?3-(i%3):0);
        await r.until(()=>!dgTx.busy);
        clearScreens();
        dgShowChapterList();
        await r.sleep(3000);
        for(let ci=0;ci<dgChapters.length;ci++){
          dgShowChapterScreen(ci);
          await r.sleep(2200);
        }
      }},

    "progression":{page:"game",title:"Progression.",text:"",
      async run(r){
        saveDemoProgress((ci,i,len)=>(ci===0&&i<len-1)||(ci===1&&i<Math.ceil(len*.7))?2:0);
        await r.until(()=>!dgTx.busy);
        clearScreens();
        caption("Un chapitre s'ouvre à 70 % du précédent : le 3 est ouvert, le 4 non.");
        liveFn=()=>"Niveaux réussis et cœurs, chapitre par chapitre";
        dgShowChapterList();
        await r.sleep(3500);
        // A saved game without a hint count takes the slider value, as a new player does.
        saveDemoProgress((ci,i,len)=>ci===0&&i<len-1?2:0);
        await r.open(5);
        caption("Bouge "+u("Indices au départ")+" : le compteur d'un nouveau joueur.");
        liveFn=()=>"Indices au départ, lus par le jeu : "+dgHints();
        dgHelpOffer();
        await r.sleep(3500);
        banner.classList.add("hidden");
        caption("Bouge "+u("Indices par chapitre terminé")+" : la récompense de fin de chapitre.");
        const before=dgHints();
        liveFn=()=>"Indices : "+before+(dgHints()!==before?" puis "+dgHints()+" (+"+(dgHints()-before)+")":"");
        await r.sleep(800);
        await r.solve(700);
        await r.sleep(3800);
      }},

    "mecaniques":{page:"game",title:"Mécaniques.",
      text:"Bouge "+u("Vitesse de chute")+" ou "+u("Vitesse de rotation du plateau")+" : le prochain coup change.",
      live(){return (seen.spin?"Quart de tour "+ms(seen.spin):"")+(seen.fallCases?" · chute de "+seen.fallCases+" case"+(seen.fallCases>1?"s ":" ")+ms(seen.fallMs):"");},
      async run(r){
        for(const i of [6,24,36,48,60,72,84]){
          // The companion introduces each brick, as on a first encounter.
          STAGES.forEach(s=>localStorage.removeItem("gravity_cube_companion_v34_seen_"+s));
          await r.open(i);
          await r.sleep(1700);
          await r.solve(520);
          await r.sleep(900);
        }
      }},

    "controles":{page:"game",title:"Contrôles.",text:"",
      async run(r){
        const f=r.finger;
        try{
          // Fires when the finger crosses the slider's angle.
          caption("Bouge "+u("Angle pour jouer un coup")+" : le doigt tourne, le coup part à cet angle.");
          await r.open(12);
          await r.sleep(500);
          let fired=null, cur=0;
          liveFn=()=>fired!==null?"Coup parti à "+fired+"° (réglage "+n("commandes.angle_coup",55)+"°)":"Doigt : "+cur+"°";
          await f.drag(88,26,a=>{cur=Math.round(a);if(fired===null&&moves>0)fired=cur;});
          f.release();
          await r.sleep(1500);

          // The same two gestures every time: only the slider decides their outcome.
          caption("Bouge "+u("Angle suffisant au lâcher")+" : doigt lâché à 15° puis 30°, le coup part ou non.");
          for(const angle of [15,30]){
            await r.restart();
            await r.sleep(350);
            liveFn=()=>"Lâché à "+angle+"° (réglage "+n("commandes.angle_lacher",18)+"°)";
            await f.drag(angle,40);
            await r.sleep(300);
            f.release();
            await r.sleep(350);
            const played=moves>0;
            liveFn=()=>"Lâché à "+angle+"° : "+(played?"coup joué":"le plateau revient")+" (réglage "+n("commandes.angle_lacher",18)+"°)";
            await r.sleep(1500);
          }

          caption("Bouge "+u("Coups en attente")+" : 7 coups demandés d'un coup, le surplus est perdu.");
          await r.open(4); // alternating turns stay clear of the exit on this level
          await r.sleep(500);
          liveFn=()=>"Demandés : 7 · joués : "+moves+" (1 + "+n("commandes.file_attente",3)+" en attente)";
          for(const d of [1,-1,1,-1,1,-1,1])turn(d);
          await r.until(()=>settled()&&!dgQueue.length);
          await r.sleep(2000);
        }finally{f.release();}
      }},

    "direction-artistique":{page:"game",title:"Direction artistique.",text:"",
      async run(r){
        const shake="Bouge "+u("Force maximale de la secousse")+" : le choc à l'atterrissage.";
        const stamp="Bouge "+u("Pause du tampon")+" : le temps du mot MATCH.";
        const slide="Bouge "+u("Défilement entre deux niveaux")+" : la vitesse du glissement.";
        liveFn=()=>"Secousse "+(seen.shake>=0?dec(seen.shake)+" px":"-")+" · tampon "+(seen.tampon?ms(seen.tampon):"-")+" · glissement "+(seen.slide?ms(seen.slide):"-");
        for(const i of [3,7,25,37,49,61,73,85]){
          await r.open(i);
          caption(shake);
          let stamped=false;
          const win=setInterval(()=>{if(gameOver&&!stamped){stamped=true;caption(stamp);}},60);
          try{await r.solve(650);}finally{clearInterval(win);}
          await r.sleep(700);
          caption(slide);
          await r.scrollTo(i+1);
          await r.sleep(800);
        }
      }},

    "son":{page:"game",title:"Son.",sound:true,
      text:"Bouge "+u("Volume de la musique en jeu")+" ou "+u("Volume des bruitages en jeu")+" : voir la pause.",
      live(){return "Musique "+percent(musicVolume)+" % · bruitages "+percent(sfxVolume)+" %"+(touched?"":" · touche l'écran pour entendre");},
      async run(r){
        await r.open(5);
        await r.solve(700);
        await r.sleep(1500);
        await r.restart();
        await r.sleep(500);
        setPaused(true);
        await r.sleep(3200);
        setPaused(false);
      }},

    "interface":{page:"game",title:"Interface.",text:"",
      async run(r){
        // Long enough for the arrow and the reminder at their highest values.
        caption("Bouge "+u("Durée de la flèche TOI")+" ou "+u("Attente avant le rappel du geste")+".");
        await r.open(4);
        let arrow=0, hint=0;
        liveFn=()=>"Flèche "+(arrow?"partie après "+dec(arrow/1000)+" s":"visible")+" · rappel "+(hint?"après "+dec(hint/1000)+" s":"attendu");
        await r.until(()=>{
          const now=performance.now();
          if(!arrow&&!dgYouOn(now))arrow=now-dgYouAt;
          if(!hint&&$("swipeHint").classList.contains("show"))hint=now-dgIdleAt;
          return arrow&&hint;
        },12000);
        await r.sleep(1200);

        const helpOn=()=>$("companionDock").classList.contains("help");
        const off=()=>{dgHelp.on=false;$("companionDock").classList.remove("help");};

        caption("Bouge "+u("Essais avant le coup de pouce")+" : l'aide vient après ce nombre d'essais.");
        off();
        await r.restart();
        await r.sleep(400);
        liveFn=()=>"Essais ratés : "+dgHelp.fails+" sur "+n("aide.essais",2)+(helpOn()?" · aide proposée":"");
        for(let i=0;i<8&&!helpOn();i++){
          turn(i%2?-1:1);
          await r.until(settled);
          await r.sleep(450);
          resetPlay();
          await r.until(settled);
          await r.sleep(350);
        }
        await r.until(helpOn,3000);
        await r.sleep(2200);

        caption("Bouge "+u("Coups de trop avant le coup de pouce")+" : au-delà de l'objectif du niveau.");
        off();
        await r.restart();
        await r.sleep(400);
        const max=Number(levels[currentLevel].maxMoves)||0;
        liveFn=()=>"Coups : "+moves+" · objectif "+max+" · aide à "+(max+n("aide.coups_de_trop",3))+(helpOn()?" · aide proposée":"");
        for(let i=0;i<max+9&&!helpOn();i++){
          turn(i%2?-1:1);
          await r.until(settled);
          await r.sleep(280);
        }
        await r.until(helpOn,3000);
        await r.sleep(2200);

        // Waiting for real would take up to 5 minutes: the level's start time moves back, the game's rule does the rest.
        caption("Bouge "+u("Temps avant le coup de pouce")+" : ici en accéléré, 6 s pour toute l'attente.");
        off();
        await r.restart();
        const secs=n("aide.secondes",90);
        liveFn=()=>"Temps sur le niveau (accéléré) : "+Math.min(secs,Math.round((performance.now()-dgHelp.since)/1000))+" s sur "+n("aide.secondes",90)+" s"+(helpOn()?" · aide proposée":"");
        let last=performance.now();
        await r.until(()=>{
          const now=performance.now();
          dgHelp.since-=(now-last)*(n("aide.secondes",90)/6-1);
          last=now;
          return helpOn();
        },12000);
        await r.sleep(2200);
        off();

        caption("Le menu de pause : indices, volumes, commandes, chapitres.");
        liveFn=()=>"";
        await r.restart();
        await r.sleep(300);
        setPaused(true);
        await r.sleep(3000);
        setPaused(false);
      }},

    "monetisation":{page:"game",title:"Monétisation.",text:"",
      async run(r){
        await r.open(mone.next);
        for(let k=0;k<30;k++){
          caption(mone.step%2===0
            ?"Bouge "+u("Niveaux entre deux publicités")+" ou "+u("Écart minimum entre deux publicités")+"."
            :"Bouge "+u("Part de pub maison")+" : nos autres jeux remplacent une part des pubs.");
          mone.step++;
          liveFn=mone.line;
          await r.solve(420);
          await r.sleep(700);
          // Each win counts as a minute of play, or the time rule could not be seen in a loop.
          mone.clock+=60000;
          await mone.proceed(r);
        }
      }},
  };

  /* Between-level ads driven by the real rule in ads.js: only the fake ad and the house ad can appear. */
  const mone={
    next:6,step:0,clock:0,wins:0,ads:0,house:0,lastAt:0,
    line(){
      const every=n("pub.intervalle_niveaux",4), gap=n("pub.delai_secondes",120);
      const since=mone.lastAt?Math.round((Date.now()-mone.lastAt)/1000):null;
      return "Victoires "+mone.wins+"/"+every+" · écart "+(since===null?"-":since+" s")+"/"+gap+" s · pubs "+mone.ads+", maison "+mone.house;
    },
    install(){
      const clockNow=Date.now.bind(Date);
      Date.now=()=>clockNow()+mone.clock;
      const ask=DGAds.maybeInterstitial;
      DGAds.maybeInterstitial=async ctx=>{
        mone.wins++;
        const shown=await ask.call(DGAds,ctx);
        if(shown){mone.ads++;mone.wins=0;mone.lastAt=Date.now();}
        return shown;
      };
      const show=DGPromo.show;
      DGPromo.show=g=>{
        // Still image only: the catalog's videos have sound, and each one streams from the network.
        DGPromo.available().forEach(x=>{x.video=null;});
        const res=show(g);
        res.then(v=>{if(!v.notShown)mone.house++;});
        return res;
      };
    },
    async proceed(r){
      const from=currentLevel;
      $("winNext").click();
      await r.until(()=>{
        const promo=document.querySelector("#dgPromo .later");
        if(promo&&!mone.waiting){mone.waiting=setTimeout(()=>{mone.waiting=0;promo.click();},2600);}
        const offer=!banner.classList.contains("hidden");
        if(offer&&!mone.waiting){mone.waiting=setTimeout(()=>{mone.waiting=0;$("bannerAlt").click();},2200);}
        return currentLevel!==from&&settled()&&!dgUiOpen();
      },30000);
      if(currentLevel>10)await r.open(6);
    },
  };

  /* ---------- start and viewer takeover ---------- */

  let scene=SCENES[SLUG]||null;
  let touched=false, demoRunning=false, lastTouch=0;
  const RESUME_MS=30000;
  const FREE_TEXT="À toi de jouer : rien n'est sauvegardé, aucune pub ni aucun achat réel.";

  capTitle=scene?scene.title:"Aperçu.";
  caption(FREE?FREE_TEXT:(scene&&scene.text)||(scene?"":"Pas de scène prévue pour ce chapitre : le jeu tel quel."));
  reserve(!!(!FREE&&scene&&scene.page==="game"&&!scene.noLive));

  // An older catalog can still point a chapter to the wrong page.
  const onMenu=/(^|\/)(index\.html)?$/.test(location.pathname);
  if(scene&&!FREE&&scene.page==="game"&&onMenu){
    location.replace("game.html"+location.search+location.hash);
    return;
  }

  let sound=null;
  function muteDemo(){
    if(scene.sound||sound)return;
    sound={soundOn,sfxOn,musicOn};
    stopElevatorMusic();
    soundOn=false;sfxOn=false;musicOn=false;
  }
  function restoreSound(){
    if(!sound)return;
    soundOn=sound.soundOn;sfxOn=sound.sfxOn;musicOn=sound.musicOn;
    sound=null;
    userAudioGesture();
  }

  async function startDemo(){
    const id=++runId;
    demoRunning=true;
    capTitle=scene.title;
    if(scene.text)caption(scene.text);
    reserve(!scene.noLive);
    muteDemo();
    const r=makeHelpers(runner(id));
    r.finger=finger(r);
    for(;;){
      try{
        liveFn=scene.live||null;
        await scene.run(r);
      }catch(e){
        if(e===STOP)return;
        if(e!==RETRY)console.warn("[GDD]",e);
        await new Promise(res=>setTimeout(res,600));
        if(id!==runId)return;
      }
    }
  }
  let fingerEl=null;
  function finger(r){
    if(fingerEl){fingerEl.remove();fingerEl=null;}
    const f=makeFinger(r);
    fingerEl=$("gddFinger");
    return f;
  }

  function takeOver(){
    runId++;
    demoRunning=false;
    lastTouch=performance.now();
    if(fingerEl)fingerEl.style.display="none";
    restoreSound();
    liveFn=null;
    reserve(true);
    live("La démonstration reprend après 30 s sans toucher.");
    caption(FREE_TEXT);
  }
  function onViewerInput(e){
    if(!e.isTrusted)return;
    lastTouch=performance.now();
    if(!demoRunning)return;
    if(scene.sound&&!touched){touched=true;userAudioGesture();return;} // the first touch only unlocks the sound
    takeOver();
  }

  function boot(){
    if(window.DGPremium){
      DGPremium.buy=()=>Promise.resolve(false);
      DGPremium.restore=()=>Promise.resolve(false);
    }
    if(window.DGAds&&DGAds.config){
      DGAds.config.provider="fake";
    }
    if(SLUG==="monetisation"&&!FREE&&window.DGAds&&window.DGPromo)mone.install();
    else{
      if(window.DGAds&&DGAds.config)DGAds.config.enabled=false;
      if(window.DGPromo)DGPromo.show=()=>Promise.resolve({completed:false,notShown:true});
    }
    if(typeof dgLeaveTo==="function"){
      const leave=dgLeaveTo;
      dgLeaveTo=url=>leave(keepPreview(url));
    }
    if(!scene||FREE)return;
    if(scene.page==="menu"){if(scene.start)scene.start();return;}
    if(typeof dgAdvance!=="function")return;

    window.addEventListener("pointerdown",onViewerInput,true);
    window.addEventListener("keydown",onViewerInput,true);
    setInterval(()=>{
      if(liveFn&&demoRunning)try{live(liveFn());}catch(e){}
      if(!demoRunning&&performance.now()-lastTouch>RESUME_MS)startDemo();
    },150);

    (function ready(){
      if(!(levels.length&&Array.isArray(b)&&b.length)){setTimeout(ready,60);return;}
      // Any level of the campaign can be opened by the demo.
      const unlocked=dgLevelUnlocked;
      dgLevelUnlocked=i=>demoRunning||unlocked(i);
      installMeasures();
      startDemo();
    })();
  }
  document.addEventListener("DOMContentLoaded",boot);
})();
