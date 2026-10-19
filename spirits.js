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
    const P=KINDS[kind]||KINDS.flamme,fem=sex==="f";
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
  /* Les deux couleurs de chaque chapitre : tubes du plateau, boutons, halos. */
  const WORLDS=[["#f6ff3d","#19e3ff"],["#19e3ff","#b06cff"],["#ff9a3d","#ff4fd8"],["#7dff6a","#19b8ff"],["#ff4fd8","#7a5cff"],["#ffe14a","#ff7a3d"],["#ff5fa2","#ffd23f"],["#a8f4fa","#ff4f8b"]];
  window.DGSpirit={KINDS,PEOPLE,WORLDS,RANKS,MEMORIES,svg,portrait,status,nextRank,person:i=>PEOPLE[((i%PEOPLE.length)+PEOPLE.length)%PEOPLE.length]};
})();
