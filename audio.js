/* ===== Date Gravity : moteur sonore =====
   Partagé par le menu (index.html) et le jeu (game.html).

   Une seule règle d'harmonie pour tout le jeu : DO MAJEUR (la mineur pour les passages plus doux).
   La musique, les notes des murs, les bruitages et la petite phrase de victoire sont tous dans cette gamme :
   quoi qu'il arrive en même temps, rien ne sonne faux.

   La musique n'est pas un fichier en boucle : elle est jouée en direct. Une suite de 4 accords par ambiance
   (une ambiance par chapitre, une pour le menu), un tapis doux, une basse, et des arpèges tirés au sort à chaque
   mesure, avec des respirations. Elle ne se répète donc jamais à l'identique.

   DGAudio.ctx()                        crée / réveille le contexte audio (à appeler sur un geste du joueur)
   DGAudio.setVolumes(musique, sons)    0..1 chacun
   DGAudio.music.start(style)           style : "menu" ou numéro de chapitre (0..7). Même style : ne fait rien.
   DGAudio.music.stop()  .duck(bool)    arrêt en fondu ; baisse pendant la victoire
   DGAudio.sfx.*                        bruitages (voir plus bas). Dernier paramètre facultatif de chacun : x, la position
                                        horizontale de la source à l'écran (0 = bord gauche, 1 = bord droit). Sans x : là où
                                        le doigt a touché il y a moins de 1,5 s, sinon le centre.
   DGAudio.hz(midi)  DGAudio.SCALE      outils d'harmonie (gamme pentatonique de do : do ré mi sol la)
*/
(function(){
  const AC=window.AudioContext||window.webkitAudioContext;
  const hz=m=>440*Math.pow(2,(m-69)/12);
  const SCALE=[0,2,4,7,9];                      // do ré mi sol la : consonant sur tous les accords ci-dessous
  const CHORDS={                                 // demi-tons au-dessus de do
    C:[0,4,7],Cmaj7:[0,4,7,11],Dm:[2,5,9],Dm7:[2,5,9,12],Em:[4,7,11],
    F:[5,9,12],Fmaj7:[5,9,12,16],G:[7,11,14],G6:[7,11,14,16],Am:[9,12,16],Am7:[9,12,16,19]
  };
  /* Une ambiance par chapitre : tempo, suite d'accords, densité des arpèges (0..1), clarté du son. */
  const STYLES={
    menu:{bpm:70,prog:["C","Am","Fmaj7","G6"],busy:.45,bright:1},
    0:{bpm:76,prog:["C","G","Am","F"],busy:.55,bright:1.1},          // premier pas : simple et lumineux
    1:{bpm:78,prog:["F","C","G","Am"],busy:.6,bright:1},              // sortir du cadre
    2:{bpm:74,prog:["Am","F","C","G"],busy:.5,bright:.95},            // boutons du cœur
    3:{bpm:68,prog:["Am","Em","F","G"],busy:.35,bright:.8},           // zones dangereuses : plus retenu
    4:{bpm:72,prog:["Dm7","G6","Cmaj7","Am7"],busy:.5,bright:.9},     // têtes qui tournent
    5:{bpm:80,prog:["F","G","Em","Am"],busy:.6,bright:1.05},          // coup de foudre
    6:{bpm:74,prog:["Am","Dm","G","C"],busy:.5,bright:.9},            // c'est compliqué
    7:{bpm:68,prog:["Fmaj7","G","Am7","C"],busy:.45,bright:1}         // le grand amour
  };

  let ctx=null,master,musicBus,musicVol,sfxBus,sfxSend,padBus,verb;
  let volMusic=.15,volSfx=.3;
  /* Volume du curseur -> niveau réel. Jamais au-delà de 1 au total (l'ancien SFX_GAIN = 2,4 faisait dépasser 0 dB dès
     que deux sons tombaient ensemble, d'où la saturation sur Android). Courbe en racine : aux réglages par défaut
     (musique .15, sons .3) on garde à peu près le niveau et l'équilibre d'avant, la musique sous les bruitages. */
  const MUSIC_GAIN=.33;
  const level=v=>Math.sqrt(Math.max(0,Math.min(1,v)));

  function impulse(sec){
    const n=Math.floor(ctx.sampleRate*sec),buf=ctx.createBuffer(2,n,ctx.sampleRate);
    for(let c=0;c<2;c++){const d=buf.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3.2);}
    return buf;
  }
  function init(){
    if(ctx){if(ctx.state==="suspended")ctx.resume().catch(()=>{});return ctx;}
    if(!AC)return null;
    // 'playback' : plus de marge pour le processeur du téléphone, pas de son qui hache quand le jeu est chargé
    try{ctx=new AC({latencyHint:"playback"});}catch(e){ctx=new AC();}
    /* Une seule chaîne de sortie, tout y passe (musique, bruitages, réverbération, menu) :
       master -> passe-haut 100 Hz -> compresseur doux -> LIMITEUR -> sortie .9 -> haut-parleur.
       - le passe-haut : un haut-parleur de téléphone ne descend pas sous ~150 Hz et distord quand on lui envoie des graves ;
       - le compresseur doux lie les sons entre eux, mais Chrome / WebView y ajoutent un gain automatique (+7 dB
         environ) : il remonte le niveau ; c'est le limiteur derrière qui garantit que rien ne sature ;
       - le master à 1.6 rend le niveau d'avant (mesuré : à .7, le jeu sortait 6 à 12 dB plus bas qu'avant la
         correction, les graves partis sous le passe-haut) ; le limiteur absorbe les empilements ;
       - le limiteur (seuil -3 dB, ratio 20, genou 0, attaque 2 ms) : rien ne dépasse, même quand tout s'empile. */
    master=ctx.createGain();master.gain.value=1.6;
    const hp=ctx.createBiquadFilter();hp.type="highpass";hp.frequency.value=100;hp.Q.value=.7;
    const comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-16;comp.knee.value=14;comp.ratio.value=3;comp.attack.value=.006;comp.release.value=.25;
    const lim=ctx.createDynamicsCompressor();
    lim.threshold.value=-3;lim.knee.value=0;lim.ratio.value=20;lim.attack.value=.002;lim.release.value=.1;
    const out=ctx.createGain();out.gain.value=.9;
    master.connect(hp);hp.connect(comp);comp.connect(lim);lim.connect(out);
    out.connect(ctx.destination);                 // le seul branchement sur la sortie
    // une petite réverbération commune : musique et bruitages « vivent dans la même pièce »
    verb=ctx.createConvolver();verb.buffer=impulse(2.4);
    const verbLp=ctx.createBiquadFilter();verbLp.type="lowpass";verbLp.frequency.value=3200;
    const verbOut=ctx.createGain();verbOut.gain.value=.32;
    verb.connect(verbLp);verbLp.connect(verbOut);verbOut.connect(master);
    musicVol=ctx.createGain();musicVol.connect(master);
    musicBus=ctx.createGain();musicBus.gain.value=0;musicBus.connect(musicVol);
    const ms=ctx.createGain();ms.gain.value=.55;musicBus.connect(ms);ms.connect(verb);
    padBus=ctx.createBiquadFilter();padBus.type="lowpass";padBus.frequency.value=950;padBus.Q.value=.4;padBus.connect(musicBus);
    // bruitages : chacun passe par sa propre voix (placement, distance) puis par ce bus ; l'envoi vers la réverb
    // a son bus à lui, réglé au même volume, pour que l'éloignement ajoute de la réverb son par son
    sfxBus=ctx.createGain();sfxBus.connect(master);
    sfxSend=ctx.createGain();sfxSend.connect(verb);
    applyVolumes();
    if(ctx.state==="suspended")ctx.resume().catch(()=>{});
    return ctx;
  }
  // Android peut créer le contexte suspendu (pas encore de geste, son pris par une autre appli) ou le suspendre
  // en arrière-plan ; rien ne le relançait, d'où un jeu muet jusqu'au redémarrage. On le coupe quand l'appli
  // passe derrière et on le relance au retour et à chaque geste qui l'autorise.
  function wake(){if(ctx&&ctx.state!=="running"&&ctx.state!=="closed")ctx.resume().catch(()=>{});}
  ["pointerup","touchend","click","keydown"].forEach(e=>window.addEventListener(e,wake,{capture:true,passive:true}));
  document.addEventListener("visibilitychange",()=>{
    if(!ctx)return;
    if(document.hidden){if(ctx.state==="running")ctx.suspend().catch(()=>{});}
    else wake();
  });
  window.addEventListener("pageshow",wake);
  function applyVolumes(){
    if(!ctx)return;
    const t=ctx.currentTime;
    musicVol.gain.setTargetAtTime(level(volMusic)*MUSIC_GAIN,t,.05);
    sfxBus.gain.setTargetAtTime(level(volSfx),t,.03);
    sfxSend.gain.setTargetAtTime(level(volSfx),t,.03);
  }

  /* ---------- instruments */
  function env(g,t,peak,att,dec,sus,rel,end){
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),t+att);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002,peak*sus),t+att+dec);
    g.gain.setValueAtTime(Math.max(.0002,peak*sus),end);
    g.gain.exponentialRampToValueAtTime(.0001,end+rel);
  }
  function osc(type,f,det,out,t,stop){
    const o=ctx.createOscillator();o.type=type;o.frequency.value=f;if(det)o.detune.value=det;
    o.connect(out);o.start(t);o.stop(stop);return o;
  }
  // tapis : chaque note de l'accord, deux oscillateurs légèrement désaccordés, attaque lente
  function pad(midis,t,dur,lvl){
    midis.forEach(m=>{
      const g=ctx.createGain();g.connect(padBus);
      env(g,t,lvl,1.1,.8,.75,1.6,t+dur);
      osc("triangle",hz(m),-7,g,t,t+dur+1.8);
      osc("sine",hz(m),7,g,t,t+dur+1.8);
    });
  }
  function bass(m,t,dur,lvl){
    const g=ctx.createGain(),f=ctx.createBiquadFilter();f.type="lowpass";f.frequency.value=320;
    g.connect(f);f.connect(musicBus);
    env(g,t,lvl,.03,.5,.55,.5,t+dur);
    osc("sine",hz(m),0,g,t,t+dur+.6);
    osc("triangle",hz(m+12),0,g,t,t+dur+.6);
  }
  // pincé façon kalimba : fondamentale douce, une harmonique qui s'éteint vite
  function pluck(m,t,lvl,out,len){
    out=out||musicBus;len=len||.9;
    const g=ctx.createGain(),g2=ctx.createGain();g.connect(out);g2.connect(out);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(lvl,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+len);
    g2.gain.setValueAtTime(.0001,t);g2.gain.exponentialRampToValueAtTime(lvl*.28,t+.004);g2.gain.exponentialRampToValueAtTime(.0001,t+len*.3);
    osc("sine",hz(m),0,g,t,t+len+.05);
    osc("triangle",hz(m)*3,0,g2,t,t+len*.3+.05);
  }
  function noise(t,dur,lvl,type,freq,q,out){
    const n=Math.max(1,Math.floor(ctx.sampleRate*dur)),buf=ctx.createBuffer(1,n,ctx.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
    const s=ctx.createBufferSource();s.buffer=buf;
    const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q||1;
    const g=ctx.createGain();g.gain.setValueAtTime(lvl,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(f);f.connect(g);g.connect(out||sfxBus);s.start(t);s.stop(t+dur+.02);
  }

  /* ---------- musique */
  const music={style:null,timer:null,nextBar:0,bar:0,ducked:false,motif:null};
  const rnd=a=>a[Math.floor(Math.random()*a.length)];
  // voicing : les notes de l'accord ramenées autour du mi 3 (tapis) ; la basse sur la fondamentale
  function voice(ch,lo){return ch.map(s=>{let m=48+s;while(m<lo)m+=12;while(m>=lo+12)m-=12;return m;}).sort((a,b)=>a-b);}
  // notes jouables pour l'arpège : notes de l'accord + gamme pentatonique, sur une octave et demie
  function pool(ch){
    const set=new Set();
    for(let m=64;m<=81;m++){const pc=m%12;if(ch.some(s=>s%12===pc)||SCALE.includes(pc))set.add(m);}
    return [...set];
  }
  const RHYTHMS=[                 // 8 croches par mesure : 1 = une note
    [1,0,1,0,1,0,1,0],[1,0,0,1,0,0,1,0],[1,0,1,1,0,1,0,0],[1,0,0,0,1,0,1,0],
    [0,0,1,0,0,1,1,0],[1,1,0,1,0,0,1,0],[1,0,0,1,0,1,0,1],[1,0,0,0,0,0,1,0]
  ];
  function scheduleBar(t){
    const st=STYLES[music.style]||STYLES.menu,beat=60/st.bpm,barLen=beat*4;
    const chName=st.prog[music.bar%st.prog.length],ch=CHORDS[chName];
    const section=Math.floor(music.bar/8)%4;                 // 8 mesures calmes, 8 plus vivantes, etc.
    const lively=section===1||section===3;
    // le tapis et la basse, toujours
    pad(voice(ch,52),t,barLen*.98,.032*st.bright);
    // basse entre sol 2 et sol 3 (98 à 196 Hz) : plus bas, le haut-parleur du téléphone ne la rend pas et distord
    let root=48+ch[0]%12;if(root>55)root-=12;
    bass(root,t,barLen*.9,.13);
    if(lively&&music.bar%2===1)bass(root+7,t+beat*2,beat*1.8,.075);
    // une mesure sur huit : on respire (tapis seul), sauf pendant les parties vivantes
    if(!lively&&music.bar%8===7)return;
    // l'arpège : un rythme tiré au sort, une petite ligne qui monte et descend dans les notes permises
    const p=pool(ch),busy=st.busy*(lively?1.25:.8);
    const rh=rnd(RHYTHMS);
    let idx=Math.floor(p.length*(.3+Math.random()*.4));
    for(let i=0;i<8;i++){
      if(!rh[i]||Math.random()>busy+.25)continue;
      idx=Math.max(0,Math.min(p.length-1,idx+rnd([-2,-1,-1,1,1,2])));
      const swing=(i%2?beat*.06:0)+(Math.random()-.5)*.012;  // un léger balancé, pas une boîte à rythmes
      pluck(p[idx],t+i*beat/2+swing,(.045+Math.random()*.025)*st.bright);
    }
    // dans les parties vivantes : un petit motif de 4 notes, repris et varié (on le retient sans qu'il lasse)
    if(lively){
      if(!music.motif||music.bar%8===0)music.motif=[0,1,2,3].map(()=>rnd(SCALE)+72);
      if(music.bar%2===0)music.motif.forEach((m,i)=>{
        const mm=(i===3&&music.bar%4===2)?m+rnd([-3,-2,2]):m;
        const pc=((mm%12)+12)%12;
        if(SCALE.includes(pc)||ch.some(s=>s%12===pc))pluck(mm,t+beat*(2+i*.5),.05*st.bright,musicBus,1.3);
      });
    }
  }
  function pump(){
    if(!ctx||music.style===null)return;
    while(music.nextBar<ctx.currentTime+.6){
      scheduleBar(music.nextBar);
      const st=STYLES[music.style]||STYLES.menu;
      music.nextBar+=60/st.bpm*4;music.bar++;
    }
  }
  music.start=function(style){
    if(!init())return;
    style=(style==null?"menu":style);
    if(typeof style==="number")style=((style%8)+8)%8;
    const t=ctx.currentTime;
    if(music.timer&&music.style===style){music.duck(false);return;}
    const fresh=!music.timer;
    music.style=style;music.bar=0;music.motif=null;
    if(fresh){
      music.nextBar=t+.08;
      music.timer=setInterval(pump,90);
    } // changement de chapitre : la nouvelle ambiance enchaîne à la mesure suivante
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setTargetAtTime(1,t,fresh?.8:.3);
    music.ducked=false;
    pump();
  };
  music.stop=function(){
    if(!ctx||!music.timer)return;
    const t=ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);musicBus.gain.setTargetAtTime(0,t,.35);
    clearInterval(music.timer);music.timer=null;music.style=null;
  };
  music.duck=function(on){
    if(!ctx||!music.timer||music.ducked===!!on)return;
    music.ducked=!!on;
    const t=ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);musicBus.gain.setTargetAtTime(on?.3:1,t,on?.15:.6);
  };
  music.playing=()=>!!music.timer;
  // pour les tests : programme n mesures d'un style d'un coup (rendu hors ligne, voir tools/audio)
  music._render=function(style,n){music.style=style;music.bar=0;music.motif=null;music.nextBar=.05;musicBus.gain.value=1;
    const st=STYLES[style];for(let i=0;i<n;i++){scheduleBar(music.nextBar);music.nextBar+=60/st.bpm*4;music.bar++;}};

  /* ---------- placement des bruitages (tous spatialisés)
     Chaque bruitage est joué à l'endroit de sa source à l'écran : x de 0 (bord gauche) à 1 (bord droit), donné par
     le jeu. Sans x, c'est là où le doigt a touché il y a moins de 1,5 s, sinon le centre. Panoramique limité à ±0,7
     (±0,3 pour les sons du menu) : un téléphone tenu en main n'a parfois qu'un haut-parleur.
     Distance (0 proche, 1 loin) : plus faible, plus sourd (passe-bas de 12 kHz vers 2 kHz) et plus réverbéré. */
  let touch={x:.5,t:-1e9};
  window.addEventListener("pointerdown",e=>{
    if(e.clientX==null||!window.innerWidth)return;
    touch={x:e.clientX/window.innerWidth,t:performance.now()};
  },{capture:true,passive:true});
  function whereX(x){
    if(typeof x==="number"&&isFinite(x))return Math.max(0,Math.min(1,x));
    return performance.now()-touch.t<1500?touch.x:.5;
  }
  const panOf=(x,ui)=>(whereX(x)*2-1)*(ui?.3:.7);
  // panoramique : StereoPanner, ou un PannerNode « equalpower » sur les vieux navigateurs qui ne l'ont pas
  function makePan(v){
    if(ctx.createStereoPanner){const n=ctx.createStereoPanner();n.pan.value=v;return n;}
    const n=ctx.createPanner();n.panningModel="equalpower";n.distanceModel="linear";n.refDistance=1;n.maxDistance=10;n.rolloffFactor=0;
    setPan(n,v,null);return n;
  }
  function setPan(n,v,t){
    v=Math.max(-.7,Math.min(.7,v));
    if(n.pan){if(t==null)n.pan.value=v;else n.pan.setTargetAtTime(v,t,.04);return;}
    const z=-Math.sqrt(1-v*v);
    if(n.positionX&&t!=null){n.positionX.setTargetAtTime(v,t,.04);n.positionZ.setTargetAtTime(z,t,.04);}
    else if(n.setPosition)n.setPosition(v,0,z);
  }
  /* Limite de voix : 8 bruitages en même temps au plus (le plus ancien s'efface en douceur), et jamais deux fois le
     même son à moins de 50 ms (deux sons identiques en phase : +6 dB d'un coup). */
  const MAX_VOICES=8,voices=[],lastAt={};
  // ouvre une voix : renvoie l'entrée où brancher le son, ou null si le son est un doublon
  function openVoice(key,x,o){
    const t=o.t,dist=o.dist||0,len=o.len||1;
    if(lastAt[key]!=null&&Math.abs(t-lastAt[key])<.05)return null;
    lastAt[key]=t;
    const now=ctx.currentTime;
    for(let i=voices.length-1;i>=0;i--)if(voices[i].end<now)voices.splice(i,1);
    let live=voices.filter(v=>v.end>t);
    while(live.length>=MAX_VOICES){
      const old=live.reduce((a,v)=>v.start<a.start?v:a);
      old.g.gain.cancelScheduledValues(now);old.g.gain.setTargetAtTime(0,Math.max(now,old.start),.012);
      old.end=now;voices.splice(voices.indexOf(old),1);live=live.filter(v=>v!==old);
    }
    const g=ctx.createGain();g.gain.value=1-.6*dist;
    const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.Q.value=.5;lp.frequency.value=12000*Math.pow(2000/12000,dist);
    const pan=makePan(panOf(x,o.ui));
    g.connect(lp);lp.connect(pan);pan.connect(sfxBus);
    const send=ctx.createGain();send.gain.value=.22+.35*dist;lp.connect(send);send.connect(sfxSend);
    voices.push({g,start:t,end:t+len});
    return Object.assign(g,{_pan:pan});
  }

  /* ---------- bruitages : tous accordés sur la gamme */
  const N={C4:60,D4:62,E4:64,G4:67,A4:69,C5:72,D5:74,E5:76,G5:79,A5:81,C6:84,E6:88,G6:91,C7:96};
  // un « boum » sans graves profonds : sinus de 120 à 200 Hz qui descend vite, plus un petit claquement aigu
  function boom(t,f0,f1,dur,peak,type,out){
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type||"sine";o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur*.6);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g);g.connect(out);o.start(t);o.stop(t+dur+.05);
  }
  const sfx={
    // rotation : un petit déclic de bois, à peine audible (on tourne très souvent) ; placé sous le doigt
    rotate(d,x){if(!init())return;const t=ctx.currentTime,v=openVoice("rotate",x,{t,len:.06,ui:true});if(!v)return;
      noise(t,.035,.09,"bandpass",d>0?2300:1900,6,v);},
    // une note pincée (les murs jouent la mélodie du niveau)
    note(freq,lvl,when,x){if(!init())return;const t=ctx.currentTime+(when||0);
      const v=openVoice("note"+Math.round(freq),x,{t,len:1.15});if(!v)return;
      const m=69+12*Math.log2(freq/440);pluck(m,t,lvl,v,1.1);},
    // atterrissage : un « pouf », plus fort pour une grande chute
    thump(imp,x){if(!init())return;imp=Math.max(0,Math.min(1,+imp||0));
      const t=ctx.currentTime,v=openVoice("thump",x,{t,len:.45});if(!v)return;
      boom(t,170+imp*30,120,.18+imp*.1,.12+imp*.2,"sine",v);
      noise(t,.04+imp*.03,.03+imp*.05,"bandpass",1800+imp*600,1.2,v);},
    // porte qui s'ouvre / se ferme : deux notes douces (placées sur le bouton qui les commande)
    door(x){if(!init())return;const t=ctx.currentTime,v=openVoice("door",x,{t,len:.8});if(!v)return;
      noise(t,.03,.05,"bandpass",1200,3,v);
      pluck(N.G4,t+.01,.09,v,.5);pluck(N.C5,t+.08,.08,v,.7);},
    // téléporteur : une petite gerbe qui monte, sur l'accord de do ; elle glisse du départ (x) à l'arrivée (x2)
    teleport(x,x2){if(!init())return;const t=ctx.currentTime,v=openVoice("teleport",x,{t,len:.6});if(!v)return;
      if(typeof x2==="number")setPan(v._pan,panOf(x2),t+.04);
      [N.C6,N.E6,N.G6,N.C7].forEach((m,i)=>pluck(m,t+i*.035,.05-i*.008,v,.45));},
    // case mortelle : un « bonk » mat
    crash(x){if(!init())return;const t=ctx.currentTime,v=openVoice("crash",x,{t,len:.45});if(!v)return;
      boom(t,200,125,.35,.2,"triangle",v);noise(t,.1,.07,"bandpass",1400,.9,v);},
    // perdu : quatre notes qui descendent, sans aigreur
    lose(x){if(!init())return;const t=ctx.currentTime+.15,v=openVoice("lose",x,{t,len:2.05});if(!v)return;
      [N.A4,N.G4,N.E4,N.C4].forEach((m,i)=>pluck(m,t+i*.16,.08-i*.008,v,i===3?1.4:.8));},
    // chute sans fin : une note qui glisse vers le bas (do 4, pas plus bas : le téléphone ne le rendrait pas)
    eternal(x){if(!init())return;const t=ctx.currentTime,v=openVoice("eternal",x,{t,len:1.05});if(!v)return;
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type="sine";o.frequency.setValueAtTime(hz(N.C5),t);o.frequency.exponentialRampToValueAtTime(hz(N.C4),t+.9);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.07,t+.03);g.gain.exponentialRampToValueAtTime(.0001,t+1);
      o.connect(g);g.connect(v);o.start(t);o.stop(t+1.05);},
    // souffle de la chute : un vent doux qui monte avec la vitesse et suit le personnage (x)
    wind:null,
    whoosh(v,x){if(!init())return;
      if(!sfx.wind){
        if(v<=0)return;
        const n=ctx.sampleRate,buf=ctx.createBuffer(1,n,n),d=buf.getChannelData(0);
        let last=0;for(let i=0;i<n;i++){last=(last+.02*(Math.random()*2-1))/1.02;d[i]=last*3.5;} // bruit « brun » : plus doux que le blanc
        const s=ctx.createBufferSource();s.buffer=buf;s.loop=true;
        const f=ctx.createBiquadFilter();f.type="lowpass";f.Q.value=.6;
        const g=ctx.createGain();g.gain.value=0;
        const pan=makePan(panOf(x));
        s.connect(f);f.connect(g);g.connect(pan);pan.connect(sfxBus);
        const send=ctx.createGain();send.gain.value=.22;g.connect(send);send.connect(sfxSend);
        s.start();
        sfx.wind={f,g,pan};
      }
      const t=ctx.currentTime;
      sfx.wind.g.gain.setTargetAtTime(.05*v,t,.05);
      sfx.wind.f.frequency.setTargetAtTime(350+v*1400,t,.05);
      if(v>0)setPan(sfx.wind.pan,panOf(x),t);},
    // mur fragile qui cède : un éclat de verre, puis deux notes qui tombent
    crack(x){if(!init())return;const t=ctx.currentTime,v=openVoice("crack",x,{t,len:.5});if(!v)return;
      noise(t,.16,.16,"highpass",2600,.8,v);noise(t,.07,.12,"bandpass",5200,4,v);
      pluck(N.E6,t+.02,.05,v,.35);pluck(N.C6,t+.09,.045,v,.4);},
    // tonnerre lointain : un grondement discret (l'orage du chapitre 6), loin, quelque part dans le ciel ;
    // grave mais au-dessus de 100 Hz, sinon le haut-parleur du téléphone le rendrait en grésillement
    thunder(x){if(!init())return;if(typeof x!=="number")x=.2+Math.random()*.6;
      const t=ctx.currentTime+.25,v=openVoice("thunder",x,{t,len:1.9,dist:.8});if(!v)return;
      noise(t,1.6,.11,"bandpass",260,.8,v);noise(t+.05,.5,.06,"bandpass",520,.9,v);},
    // cœur ramassé : une petite montée lumineuse
    pickup(x){if(!init())return;const t=ctx.currentTime,v=openVoice("pickup",x,{t,len:.8});if(!v)return;
      [N.G5,N.C6,N.E6,N.G6].forEach((m,i)=>pluck(m,t+i*.05,.06,v,.6));},
    // victoire : la phrase du niveau est rejouée par le jeu, puis cet accord (do majeur avec la neuvième)
    winChord(when,x){if(!init())return;const t=ctx.currentTime+(when||0),v=openVoice("winChord",x,{t,len:2.3});if(!v)return;
      [N.C4,N.E4,N.G4,N.D5,N.E5].forEach((m,i)=>pluck(m,t+i*.045,.06,v,2));},
    // menu : placé là où le doigt a touché, discrètement
    ui(kind,x){if(!init())return;const t=ctx.currentTime,v=openVoice("ui",x,{t,len:.75,ui:true});if(!v)return;
      if(kind==="open"){pluck(N.G4,t,.07,v,.5);pluck(N.D5,t+.07,.06,v,.6);}
      else if(kind==="close")pluck(N.E4,t,.06,v,.5);
      else{pluck(N.C5,t,.08,v,.5);pluck(N.G5,t+.06,.06,v,.6);}}
  };

  window.DGAudio={
    ctx:init,hz,SCALE,music,sfx,
    setVolumes(m,s){volMusic=Math.max(0,Math.min(1,+m||0));volSfx=Math.max(0,Math.min(1,+s||0));applyVolumes();},
    get context(){return ctx;}
  };
})();
