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
   DGAudio.sfx.*                        bruitages (voir plus bas)
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

  let ctx=null,master,musicBus,musicVol,sfxBus,padBus,verb;
  let volMusic=.15,volSfx=.3;
  const MUSIC_GAIN=1.1,SFX_GAIN=2.4;            // volume du curseur -> niveau réel (la musique reste sous les bruitages)

  function impulse(sec){
    const n=Math.floor(ctx.sampleRate*sec),buf=ctx.createBuffer(2,n,ctx.sampleRate);
    for(let c=0;c<2;c++){const d=buf.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3.2);}
    return buf;
  }
  function init(){
    if(ctx){if(ctx.state==="suspended")ctx.resume().catch(()=>{});return ctx;}
    if(!AC)return null;
    ctx=new AC();
    // un compresseur doux en bout de chaîne : quand plusieurs sons tombent ensemble, rien ne sature
    const comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-16;comp.knee.value=14;comp.ratio.value=3.5;comp.attack.value=.006;comp.release.value=.25;
    comp.connect(ctx.destination);
    master=ctx.createGain();master.gain.value=.9;master.connect(comp);
    // une petite réverbération commune : musique et bruitages « vivent dans la même pièce »
    verb=ctx.createConvolver();verb.buffer=impulse(2.4);
    const verbLp=ctx.createBiquadFilter();verbLp.type="lowpass";verbLp.frequency.value=3200;
    const verbOut=ctx.createGain();verbOut.gain.value=.32;
    verb.connect(verbLp);verbLp.connect(verbOut);verbOut.connect(master);
    musicVol=ctx.createGain();musicVol.connect(master);
    musicBus=ctx.createGain();musicBus.gain.value=0;musicBus.connect(musicVol);
    const ms=ctx.createGain();ms.gain.value=.55;musicBus.connect(ms);ms.connect(verb);
    padBus=ctx.createBiquadFilter();padBus.type="lowpass";padBus.frequency.value=950;padBus.Q.value=.4;padBus.connect(musicBus);
    sfxBus=ctx.createGain();sfxBus.connect(master);
    const ss=ctx.createGain();ss.gain.value=.22;sfxBus.connect(ss);ss.connect(verb);
    applyVolumes();
    if(ctx.state==="suspended")ctx.resume().catch(()=>{});
    return ctx;
  }
  function applyVolumes(){
    if(!ctx)return;
    const t=ctx.currentTime;
    musicVol.gain.setTargetAtTime(volMusic*MUSIC_GAIN,t,.05);
    sfxBus.gain.setTargetAtTime(volSfx*SFX_GAIN,t,.03);
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
    let root=36+ch[0]%12;if(root>43)root-=12;                  // basse entre sol 1 et sol 2
    bass(root,t,barLen*.9,.16);
    if(lively&&music.bar%2===1)bass(root+7,t+beat*2,beat*1.8,.09);
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

  /* ---------- bruitages : tous accordés sur la gamme */
  const N={C4:60,D4:62,E4:64,G4:67,A4:69,C5:72,D5:74,E5:76,G5:79,A5:81,C6:84,E6:88,G6:91,C7:96};
  const sfx={
    // rotation : un petit déclic de bois, à peine audible (on tourne très souvent)
    rotate(d){if(!init())return;const t=ctx.currentTime;noise(t,.035,.09,"bandpass",d>0?2300:1900,6);},
    // une note pincée (les murs jouent la mélodie du niveau)
    note(freq,lvl,when){if(!init())return;const t=ctx.currentTime+(when||0);
      const m=69+12*Math.log2(freq/440);pluck(m,t,lvl,sfxBus,1.1);},
    // atterrissage : un « pouf » grave, plus fort pour une grande chute
    thump(imp){if(!init())return;const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
      o.type="sine";o.frequency.setValueAtTime(hz(45)*(1+imp*.5),t);o.frequency.exponentialRampToValueAtTime(hz(33),t+.12);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12+imp*.2,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+.18+imp*.1);
      o.connect(g);g.connect(sfxBus);o.start(t);o.stop(t+.35);
      noise(t,.05+imp*.04,.04+imp*.06,"lowpass",500+imp*500,.7);},
    // porte qui s'ouvre / se ferme : deux notes douces
    door(){if(!init())return;const t=ctx.currentTime;noise(t,.03,.05,"bandpass",1200,3);
      pluck(N.G4,t+.01,.09,sfxBus,.5);pluck(N.C5,t+.08,.08,sfxBus,.7);},
    // téléporteur : une petite gerbe qui monte, sur l'accord de do
    teleport(){if(!init())return;const t=ctx.currentTime;
      [N.C6,N.E6,N.G6,N.C7].forEach((m,i)=>pluck(m,t+i*.035,.05-i*.008,sfxBus,.45));},
    // case mortelle : un « bonk » mat
    crash(){if(!init())return;const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
      o.type="triangle";o.frequency.setValueAtTime(hz(43),t);o.frequency.exponentialRampToValueAtTime(hz(31),t+.25);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.2,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.35);
      o.connect(g);g.connect(sfxBus);o.start(t);o.stop(t+.4);noise(t,.12,.09,"lowpass",700,.7);},
    // perdu : quatre notes qui descendent, sans aigreur
    lose(){if(!init())return;const t=ctx.currentTime+.15;
      [N.A4,N.G4,N.E4,N.C4].forEach((m,i)=>pluck(m,t+i*.16,.08-i*.008,sfxBus,i===3?1.4:.8));},
    // chute sans fin : une note qui glisse vers le bas
    eternal(){if(!init())return;const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
      o.type="sine";o.frequency.setValueAtTime(hz(N.C5),t);o.frequency.exponentialRampToValueAtTime(hz(N.C4-12),t+.9);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.07,t+.03);g.gain.exponentialRampToValueAtTime(.0001,t+1);
      o.connect(g);g.connect(sfxBus);o.start(t);o.stop(t+1.05);},
    // souffle de la chute : un vent doux qui monte avec la vitesse
    wind:null,
    whoosh(v){if(!init())return;
      if(!sfx.wind){
        if(v<=0)return;
        const n=ctx.sampleRate,buf=ctx.createBuffer(1,n,n),d=buf.getChannelData(0);
        let last=0;for(let i=0;i<n;i++){last=(last+.02*(Math.random()*2-1))/1.02;d[i]=last*3.5;} // bruit « brun » : plus doux que le blanc
        const s=ctx.createBufferSource();s.buffer=buf;s.loop=true;
        const f=ctx.createBiquadFilter();f.type="lowpass";f.Q.value=.6;
        const g=ctx.createGain();g.gain.value=0;
        s.connect(f);f.connect(g);g.connect(sfxBus);s.start();
        sfx.wind={f,g};
      }
      const t=ctx.currentTime;
      sfx.wind.g.gain.setTargetAtTime(.05*v,t,.05);
      sfx.wind.f.frequency.setTargetAtTime(350+v*1400,t,.05);},
    // mur fragile qui cède : un éclat de verre, puis deux notes qui tombent
    crack(){if(!init())return;const t=ctx.currentTime;noise(t,.16,.16,"highpass",2600,.8);noise(t,.07,.12,"bandpass",5200,4);
      pluck(N.E6,t+.02,.05,sfxBus,.35);pluck(N.C6,t+.09,.045,sfxBus,.4);},
    // tonnerre lointain : un grondement grave, discret (l'orage du chapitre 6)
    thunder(){if(!init())return;const t=ctx.currentTime+.25;noise(t,1.6,.09,"lowpass",180,.7);noise(t+.05,.5,.05,"lowpass",420,.8);},
    // cœur ramassé : une petite montée lumineuse
    pickup(){if(!init())return;const t=ctx.currentTime;
      [N.G5,N.C6,N.E6,N.G6].forEach((m,i)=>pluck(m,t+i*.05,.06,sfxBus,.6));},
    // victoire : la phrase du niveau est rejouée par le jeu, puis cet accord (do majeur avec la neuvième)
    winChord(when){if(!init())return;const t=ctx.currentTime+(when||0);
      [N.C4,N.E4,N.G4,N.D5,N.E5].forEach((m,i)=>pluck(m,t+i*.045,.06,sfxBus,2));},
    // menu
    ui(kind){if(!init())return;const t=ctx.currentTime;
      if(kind==="open"){pluck(N.G4,t,.07,sfxBus,.5);pluck(N.D5,t+.07,.06,sfxBus,.6);}
      else if(kind==="close")pluck(N.E4,t,.06,sfxBus,.5);
      else{pluck(N.C5,t,.08,sfxBus,.5);pluck(N.G5,t+.06,.06,sfxBus,.6);}}
  };

  window.DGAudio={
    ctx:init,hz,SCALE,music,sfx,
    setVolumes(m,s){volMusic=Math.max(0,Math.min(1,+m||0));volSfx=Math.max(0,Math.min(1,+s||0));applyVolumes();},
    get context(){return ctx;}
  };
})();
