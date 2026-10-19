/* ===== V49 NÉON CIRCUIT : les esprits =====
   Dessin des personnages, partagé par le menu (index.html) et le jeu (game.html).
   Ils sont dessinés par code et non par vector_assets.json, parce que leur visage et leur
   corps réagissent en direct : étirement pendant la chute, yeux plissés à l'impact, regard, clignement.

   DGSpirit.svg(kind, sex, state) -> balisage SVG à placer dans une case 40 x 40.
     kind  : flamme, vague, feuille, etoile, nuage, lune, eclair, fleur, cristal
     sex   : "m" (crête courte) ou "f" (crête plus ample + deux mèches)
     state : {stretch, eye, ex, ey, mouth, t}
             eye   : dot | blink | hit | happy | sad
             mouth : smile | o | grin | sad
*/
(function(){
  const KINDS={
    flamme:{body:"#ff9a2e",crest:"#ffd23f",scarf:"#ff4f6a",line:"#3a1205",d:"M7 17Q2 6 11 8Q10 -4 19 2Q22 -8 28 3Q38 1 33 17Z"},
    vague:{body:"#2fd0e0",crest:"#a8f4fa",scarf:"#b06cff",line:"#06324a",d:"M7 17Q4 5 15 6Q22 -4 31 4Q26 5 27 9Q36 8 33 17Z"},
    feuille:{body:"#6fd86a",crest:"#c2f57e",scarf:"#ff9a3d",line:"#123f1c",d:"M20 17Q5 14 8 1Q18 4 20 12Q22 4 32 1Q35 14 20 17Z"},
    etoile:{body:"#a585ff",crest:"#ffe14a",scarf:"#ff5fa2",line:"#2a1670",d:"M20 -6L24 6L36 6L26 13L30 17H10L14 13L4 6L16 6Z"},
    nuage:{body:"#e6e2ff",crest:"#ffffff",scarf:"#19c8ff",line:"#3a3190",d:"M5 18Q0 8 10 8Q12 -1 21 3Q29 -3 32 7Q41 8 35 18Z"},
    lune:{body:"#6f7dff",crest:"#fff3a6",scarf:"#ffd23f",line:"#151a66",d:"M11 17Q2 8 11 -3Q10 8 20 10Q30 8 29 -3Q38 8 29 17Z"},
    eclair:{body:"#ffe14a",crest:"#ffffff",scarf:"#19e3ff",line:"#5a4300",d:"M9 17L15 4L13 11L22 -5L20 8L30 0L27 17Z"},
    fleur:{body:"#ff7ab8",crest:"#ffd0e6",scarf:"#7dff6a",line:"#6a0f3d",d:"M20 17Q8 18 7 9Q8 2 15 6Q15 -4 20 -4Q25 -4 25 6Q32 2 33 9Q32 18 20 17Z"},
    cristal:{body:"#6ff0d8",crest:"#d4b8ff",scarf:"#ff4fd8",line:"#0d4a42",d:"M11 17L8 8L14 0L20 7L26 -3L32 8L29 17Z"}
  };
  const LOCKS=["M5 16Q-3 22 3 31Q5 34 7 30Q4 24 6 18Z","M35 16Q43 22 37 31Q35 34 33 30Q36 24 34 18Z"];

  function svg(kind,sex,o){
    o=o||{};
    const P=(kind&&typeof kind==="object")?kind:(KINDS[kind]||KINDS.flamme),fem=sex==="f";
    const st=' stroke="'+P.line+'" stroke-width="2" stroke-linejoin="round"';
    const t=o.t||0,flick=1+Math.sin(t/90+(P.body.charCodeAt(2)%7))*.05;
    const cs=(1+(o.stretch||0)*1.1)*flick;
    let s='<circle cx="20" cy="24" r="27" fill="'+P.body+'" opacity=".16"/>';
    if(fem)s+=LOCKS.map(d=>'<path d="'+d+'" fill="'+P.crest+'"'+st+'/>').join("");
    // elle : même crête, plus ample
    s+='<g transform="translate(20 17) scale('+(fem?1.14:1)+' '+(fem?1.1*cs:cs)+') translate(-20 -17)"><path d="'+P.d+'" fill="'+P.crest+'"'+st+'/></g>';
    s+='<rect x="4" y="13" width="32" height="26" rx="9" fill="'+P.body+'"'+st+'/>';
    s+='<path d="M5 29H35V30a9 9 0 0 1 -9 9H14a9 9 0 0 1 -9 -9Z" fill="#000" opacity=".14"/><path d="M9 17Q10 15 14 15" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>';
    s+='<path d="M4.5 32H35.5V35.5Q20 40 4.5 35.5Z" fill="'+P.scarf+'"'+st+'/>';
    s+=fem?'<path d="M20 32.6L23 35.6L20 38.8L17 35.6Z" fill="#fff3a6" stroke="'+P.line+'" stroke-width="1.2" stroke-linejoin="round"/>'
          :'<circle cx="20" cy="35.2" r="2.4" fill="#fff3a6" stroke="'+P.line+'" stroke-width="1.2"/>';
    s+='<ellipse cx="8.6" cy="28" rx="'+(fem?3:2.4)+'" ry="'+(fem?2:1.6)+'" fill="#ff5d8f" opacity="'+(fem?.65:.45)+'"/><ellipse cx="31.4" cy="28" rx="'+(fem?3:2.4)+'" ry="'+(fem?2:1.6)+'" fill="#ff5d8f" opacity="'+(fem?.65:.45)+'"/>';
    const ex=o.ex||0,ey=o.ey||0,e=o.eye||"dot",L=P.line;
    if(e==="hit")s+='<path d="M10.6 21.4L15 24L10.6 26.6M29.4 21.4L25 24L29.4 26.6" fill="none" stroke="'+L+'" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
    else if(e==="happy")s+='<path d="M10 25Q13.3 20.6 16.6 25M23.4 25Q26.7 20.6 30 25" fill="none" stroke="'+L+'" stroke-width="2.2" stroke-linecap="round"/>';
    else if(e==="blink")s+='<path d="M11 24H15.6M24.4 24H29" stroke="'+L+'" stroke-width="2.2" stroke-linecap="round"/>';
    else if(e==="sad")s+='<circle cx="13.3" cy="25" r="2.4" fill="'+L+'"/><circle cx="26.7" cy="25" r="2.4" fill="'+L+'"/><path d="M9.6 20.4L16 22M30.4 20.4L24 22" stroke="'+L+'" stroke-width="1.9" stroke-linecap="round"/>';
    else s+='<circle cx="'+(13.3+ex)+'" cy="'+(24+ey)+'" r="2.5" fill="'+L+'"/><circle cx="'+(26.7+ex)+'" cy="'+(24+ey)+'" r="2.5" fill="'+L+'"/><circle cx="'+(14.1+ex)+'" cy="'+(23.2+ey)+'" r=".8" fill="#fff"/><circle cx="'+(27.5+ex)+'" cy="'+(23.2+ey)+'" r=".8" fill="#fff"/>';
    if(fem&&e!=="hit")s+='<path d="M8.9 21.2L6.9 19.4M31.1 21.2L33.1 19.4" stroke="'+L+'" stroke-width="1.3" stroke-linecap="round"/>';
    const m=o.mouth||"smile";
    if(m==="o")s+='<ellipse cx="20" cy="30" rx="2.1" ry="2.6" fill="'+L+'"/>';
    else if(m==="grin")s+='<path d="M16 28.6Q20 34 24 28.6Z" fill="'+L+'"/>';
    else if(m==="sad")s+='<path d="M17 31Q20 28.6 23 31" fill="none" stroke="'+L+'" stroke-width="1.8" stroke-linecap="round"/>';
    else s+='<path d="M17 29.2Q20 31.8 23 29.2" fill="none" stroke="'+L+'" stroke-width="1.8" stroke-linecap="round"/>';
    return s;
  }
  // portrait autonome (cartes, listes, fenêtres)
  function portrait(kind,sex,state){
    return '<svg viewBox="-8 -13 56 58" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+svg(kind,sex,state)+'</svg>';
  }

  /* Une rencontre par chapitre. Les prénoms sont volontairement mixtes : chacun existe en lui et en elle. */
  const PEOPLE=[
    {name:"Nami",kind:"vague",line:"Toujours partant·e pour un détour.",vow:"Tous mes détours menaient à toi."},
    {name:"Sylve",kind:"feuille",line:"Adore sortir des sentiers battus.",vow:"Hors des sentiers, j'ai trouvé mieux : toi."},
    {name:"Astre",kind:"etoile",line:"A la clé de toutes les portes.",vow:"La dernière porte, c'est toi qui l'as ouverte."},
    {name:"Nimbe",kind:"nuage",line:"Marche sur des œufs, et toi avec.",vow:"Avec toi, je marche enfin sur un nuage."},
    {name:"Lune",kind:"lune",line:"Te fait tourner la tête.",vow:"Tu tournes, je gravite. Pour toujours."},
    {name:"Volt",kind:"eclair",line:"Le coup de foudre, version express.",vow:"Le coup de foudre a duré. Qui l'eût cru ?"},
    {name:"Pétale",kind:"fleur",line:"C'est compliqué, mais ça sent bon.",vow:"C'était compliqué. Ça valait le coup."},
    {name:"Opale",kind:"cristal",line:"Rare. Vraiment rare.",vow:"Rare, oui. Et maintenant, à toi."}
  ];
  /* Les paliers d'une relation, d'après la part de cœurs gagnés dans le chapitre (r).
     Âme sœur demande tous les cœurs, donc tous les niveaux. */
  const RANKS=[
    {key:"known",label:"Connaissance",r:0},
    {key:"friend",label:"Pote",r:.35},
    {key:"crush",label:"Crush",r:.6},
    {key:"love",label:"Grand amour",r:.85},
    {key:"soul",label:"Âme sœur",r:1}
  ];
  /* Ce que la rencontre est devenue, d'après la part de cœurs gagnés dans son chapitre.
     Une rencontre ne finit pas forcément en histoire d'amour, et on peut toujours faire mieux en rejouant. */
  function status(done,total,stars){
    if(!done)return {key:"none",label:"Pas encore rencontré·e",rank:0};
    const r=stars/(3*total);
    let i=RANKS.length-1;
    while(i>0&&r<RANKS[i].r)i--;
    return {key:RANKS[i].key,label:RANKS[i].label,rank:i+1};
  }
  /* Le palier suivant et les cœurs qui manquent pour l'atteindre (null au sommet). */
  function nextRank(done,total,stars){
    const cur=status(done,total,stars).rank;
    if(!total||cur>=RANKS.length)return null;
    const R=RANKS[cur];
    return {key:R.key,label:R.label,rank:cur+1,hearts:Math.max(0,Math.ceil(R.r*3*total-1e-9)-stars)};
  }
  /* Les souvenirs d'une rencontre, à collectionner dans l'album : un par palier, plus un gagné sans aide.
     rank  : palier de relation à atteindre ; clean : niveaux du chapitre gagnés sans indice.
     icon  : pictogramme dessiné par game.html (DG_ICONS).
     gift  : indices offerts quand le joueur découvre le souvenir.
     line  : {name} est le prénom ; sans line, c'est la phrase secrète de la personne (vow). */
  const MEMORIES=[
    {key:"meet",icon:"eye",title:"Premier regard",line:"{name} t'a remarqué·e dès le premier saut.",rank:1,gift:1,state:{eye:"dot",mouth:"o"}},
    {key:"friend",icon:"rings",title:"Ça accroche",line:"Vous riez des mêmes chutes.",rank:2,gift:1,state:{eye:"happy",mouth:"smile"}},
    {key:"crush",icon:"pulse",title:"Le cœur s'emballe",line:"{name} rougit quand tu fais tourner le monde.",rank:3,gift:2,state:{eye:"blink",mouth:"grin"}},
    {key:"clean",icon:"chute",title:"Sans filet",line:"Des rendez-vous réussis sans le moindre indice.",clean:6,gift:2,state:{eye:"dot",mouth:"grin"}},
    {key:"love",icon:"spark",title:"Grand amour",line:"{name} ne regarde plus que toi.",rank:4,gift:3,state:{eye:"happy",mouth:"grin"}},
    {key:"soul",icon:"ring",title:"Âme sœur",rank:5,gift:5,state:{eye:"happy",mouth:"grin"}}
  ];
  /* Pictogrammes au trait (grille 24 x 24), dessinés dans la couleur du texte. */
  const ICONS={
    eye:"M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12ZM15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0Z",
    rings:"M14 12a5 5 0 1 1-10 0a5 5 0 1 1 10 0ZM20 12a5 5 0 1 1-10 0a5 5 0 1 1 10 0Z",
    pulse:"M12 20.5S3 15 3 8.8a4.6 4.6 0 0 1 9-2a4.6 4.6 0 0 1 9 2c0 6.2-9 11.7-9 11.7ZM6.5 11.5h3l1.3-2.4 2 4.8 1.4-2.4h3.3",
    chute:"M3 11a9 7.5 0 0 1 18 0ZM3 11l9 8.5 9-8.5M9 11l3 8.5 3-8.5",
    spark:"M10.5 20.5S3 16 3 10.6a4 4 0 0 1 7.5-1.8a4 4 0 0 1 7.5 1.8c0 5.4-7.5 9.9-7.5 9.9ZM19 2.5v5M16.5 5h5",
    ring:"M9 7.5L7.5 5 9.5 2.5h5L16.5 5 15 7.5ZM18 15a6 6 0 1 1-12 0a6 6 0 1 1 12 0Z",
    lock:"M6 11h12v9.5H6ZM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
    photo:"M3.5 5.5h17v13h-17ZM3.5 15l5-5 4 4 2.5-2.5 5.5 5.5M16 8.5h.01",
    heart:"M12 20.5S3 15 3 8.8a4.6 4.6 0 0 1 9-2a4.6 4.6 0 0 1 9 2c0 6.2-9 11.7-9 11.7Z",
    bulb:"M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.4 10.9c.5.4.9 1 .9 1.7V16h5v-.4c0-.7.4-1.3.9-1.7A6 6 0 0 0 12 3Z"
  };
  function icon(name){return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="'+(ICONS[name]||"")+'"/></svg>';}

  /* --- le look du joueur : une tête (la crête) et une couleur, à débloquer.
     Ces têtes n'appartiennent qu'au joueur, pour qu'on ne le confonde jamais avec une rencontre.
     Têtes : avec les cœurs gagnés (hearts). Couleurs : avec les souvenirs découverts dans l'album (mem). */
  const HEADS=[
    {key:"flamme",name:"Flamme",hearts:0,d:KINDS.flamme.d},
    {key:"meche",name:"Mèche",hearts:10,d:"M7 17Q3 5 15 4Q28 3 36 -5Q36 7 27 9Q34 11 33 17Z"},
    {key:"chat",name:"Chat",hearts:25,d:"M6 17L7 -1L16 9H24L33 -1L34 17Z"},
    {key:"bonnet",name:"Bonnet",hearts:45,d:"M6 17Q5 4 20 4Q35 4 34 17ZM15.5 3.5a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0Z"},
    {key:"lapin",name:"Lapin",hearts:70,d:"M8 17Q8 10 13 9Q8 4 6 -3Q15 1 16 9H24Q25 1 34 -3Q32 4 27 9Q32 10 32 17Z"},
    {key:"punk",name:"Crête punk",hearts:100,d:"M8 17L10 7L14 11L16 -3L20 9L24 -7L26 9L30 -1L31 11L33 17Z"},
    {key:"antenne",name:"Antennes",hearts:140,d:"M9 17Q10 9 20 9Q30 9 31 17ZM13 10L9 2.5L11.2 1.5L15.5 9.5ZM27 10L31 2.5L28.8 1.5L24.5 9.5ZM6.8 1a3 3 0 1 0 6 0a3 3 0 1 0 -6 0ZM27.2 1a3 3 0 1 0 6 0a3 3 0 1 0 -6 0Z"},
    {key:"couronne",name:"Couronne",hearts:200,d:"M7 17L7.5 2L13.5 9.5L20 -1L26.5 9.5L32.5 2L33 17Z"}
  ];
  const SKINS=[
    {key:"braise",name:"Braise",mem:0,body:"#ff9a2e",crest:"#ffd23f",scarf:"#ff4f6a",line:"#3a1205"},
    {key:"menthe",name:"Menthe",mem:2,body:"#5fe3b0",crest:"#e9fff3",scarf:"#ff5fa2",line:"#0d3b2c"},
    {key:"ocean",name:"Océan",mem:5,body:"#3fa9ff",crest:"#bff0ff",scarf:"#ffd23f",line:"#0a2a55"},
    {key:"corail",name:"Corail",mem:9,body:"#ff6f7d",crest:"#ffd0a8",scarf:"#ffe14a",line:"#4a0d1a"},
    {key:"lavande",name:"Lavande",mem:14,body:"#b18cff",crest:"#ffe0fb",scarf:"#19e3ff",line:"#2a1670"},
    {key:"neon",name:"Néon",mem:20,body:"#7dff6a",crest:"#f6ff3d",scarf:"#ff4fd8",line:"#0f3d0a"},
    {key:"nuit",name:"Nuit",mem:28,body:"#3a3f7a",crest:"#19e3ff",scarf:"#f6ff3d",line:"#0a0d24"},
    {key:"or",name:"Or",mem:38,body:"#ffd23f",crest:"#fff7c2",scarf:"#ff4fd8",line:"#4a3300"}
  ];
  const LOOK_KEY="dg_me_look";
  function readLook(){
    let l=null;
    try{l=JSON.parse(localStorage.getItem(LOOK_KEY)||"null");}catch(e){}
    l=l||{};
    return {head:HEADS.some(h=>h.key===l.head)?l.head:"flamme",skin:SKINS.some(k=>k.key===l.skin)?l.skin:"braise"};
  }
  function saveLook(l){try{localStorage.setItem(LOOK_KEY,JSON.stringify({head:l.head,skin:l.skin}));}catch(e){}}
  // le joueur prêt à dessiner : à passer à svg() / portrait() à la place d'un nom d'esprit
  function me(l){
    l=l||readLook();
    const h=HEADS.find(x=>x.key===l.head)||HEADS[0], k=SKINS.find(x=>x.key===l.skin)||SKINS[0];
    return {body:k.body,crest:k.crest,scarf:k.scarf,line:k.line,d:h.d};
  }
  // ce que la sauvegarde a gagné : cœurs de tous les niveaux, souvenirs découverts
  function earned(pr){
    pr=pr||{};
    const hearts=Object.values(pr.best||{}).reduce((n,b)=>n+(Number(b&&b.stars)||0),0);
    let mem=0;
    Object.values(pr.mem||{}).forEach(box=>Object.values(box||{}).forEach(v=>{if(v===2)mem++;}));
    return {hearts,mem};
  }
  function lookOpen(item,e){return item.hearts!=null?e.hearts>=item.hearts:e.mem>=item.mem;}

  /* Les deux couleurs de chaque chapitre : tubes du plateau, boutons, halos. */
  const WORLDS=[["#f6ff3d","#19e3ff"],["#19e3ff","#b06cff"],["#ff9a3d","#ff4fd8"],["#7dff6a","#19b8ff"],["#ff4fd8","#7a5cff"],["#ffe14a","#ff7a3d"],["#ff5fa2","#ffd23f"],["#a8f4fa","#ff4f8b"]];
  window.DGSpirit={KINDS,PEOPLE,WORLDS,RANKS,MEMORIES,HEADS,SKINS,icon,readLook,saveLook,me,earned,lookOpen,svg,portrait,status,nextRank,person:i=>PEOPLE[((i%PEOPLE.length)+PEOPLE.length)%PEOPLE.length]};
})();
