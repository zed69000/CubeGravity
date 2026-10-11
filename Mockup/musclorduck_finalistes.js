/* MusclorDuck – finalistes.
   Chargé après le script de splash_musclorduck.html : il ne garde que les 13 propositions retenues et ajoute
   deux variations pour chacune, rangées à côté de l'originale.

   Règle de dessin pour tout ce qui est « au trait » (encre, craie, lino, stylo) : chaque forme est remplie avec la
   couleur du papier. Un bras passe donc DEVANT ou DERRIÈRE le torse, on ne voit plus les traits se croiser. */
(function(){
  const KEEP=["z","u","t","s","r","p","q","l","m","j","f","d","b"];
  const INK="#17130f";

  // ---------- poses ----------
  const thick=(d,w)=>d.replace(/stroke-width="7"/g,'stroke-width="'+w+'"');
  // la pose du crabe, avec une vraie tête de canard : grosse, ronde, bec large
  function duckCrab(){
    const leg='fill="none" stroke="'+O+'" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"';
    return '<path class="leg" d="M136 236V276M136 276L120 286M136 276L136 290M136 276L150 286" '+leg+'/><path class="leg" d="M166 236V276M166 276L150 286M166 276L166 290M166 276L182 286" '+leg+'/>'+
      '<path d="M54 104Q150 70 246 104Q238 166 184 240H116Q62 166 54 104Z" fill="'+Y+'" '+S()+'/>'+
      '<path d="M104 146Q128 164 148 146M152 146Q172 164 196 146M150 166V228M132 182H168M134 200H166M136 218H164" fill="none" '+S(6)+'/>'+
      '<g transform="translate(0 12)">'+armI+mirror(armI)+'</g>'+
      '<circle cx="150" cy="50" r="38" fill="'+Y+'" '+S()+'/>'+
      '<ellipse cx="122" cy="60" rx="9" ry="6" fill="'+P+'"/><ellipse cx="178" cy="60" rx="9" ry="6" fill="'+P+'"/>'+
      '<path d="M124 32L142 40M176 32L158 40" fill="none" '+S(6)+'/><circle cx="134" cy="46" r="4.5" fill="'+K+'"/><circle cx="166" cy="46" r="4.5" fill="'+K+'"/>'+
      '<path d="M128 56Q150 44 172 56Q164 76 150 76Q136 76 128 56Z" fill="'+O+'" '+S(5)+'/>';
  }
  // le caneton : grosse tête, corps rond, une toute petite aile qui contracte
  function chick(){
    return '<path d="M48 104V118M72 104V118M48 118L40 124M48 118L54 124M72 118L64 124M72 118L80 124" fill="none" stroke="'+O+'" stroke-width="5" stroke-linecap="round"/>'+
      '<path d="M30 74Q16 82 22 96Q32 98 36 86Z" fill="#ffd95a" '+S(5)+'/>'+
      '<ellipse cx="60" cy="80" rx="34" ry="28" fill="#ffd95a" '+S(5)+'/>'+
      '<path d="M88 72Q110 64 106 42Q98 34 92 44Q96 56 84 62Z" fill="#ffd95a" '+S(5)+'/>'+
      '<circle cx="60" cy="40" r="31" fill="#ffd95a" '+S(5)+'/>'+
      '<path d="M54 10q5 -13 11 0" fill="none" '+S(5)+'/>'+
      '<ellipse cx="38" cy="50" rx="7" ry="4.5" fill="'+P+'"/><ellipse cx="82" cy="50" rx="7" ry="4.5" fill="'+P+'"/>'+
      '<path d="M42 30L54 34M78 30L66 34" fill="none" '+S(4.5)+'/><circle cx="49" cy="40" r="3.6" fill="'+K+'"/><circle cx="71" cy="40" r="3.6" fill="'+K+'"/>'+
      '<path d="M53 48Q60 43 67 48Q60 57 53 48Z" fill="'+O+'" '+S(4)+'/>';
  }
  const blockDuck=document.querySelector(".card.f svg.duck").innerHTML;
  const POSE={
    flex:[()=>duck({}),"0 0 320 300"], up:[()=>duck({arms:"up"}),"0 0 300 300"], crossed:[duckCrossed,"0 0 300 300"],
    double:[duckDouble,"0 0 320 300"], curl:[duckCurl,"0 -14 344 314"], trophy:[duckTrophy,"0 -14 320 314"],
    crab:[duckCrab,"0 0 300 300"], block:[()=>blockDuck,"0 0 300 300"]
  };

  // ---------- rendus ----------
  // au trait, formes opaques (voir en-tête)
  const line=(d,paper,ink,sw,cls,extra)=>'<g class="lineart '+(cls||"")+'" style="--paper:'+paper+';--ink:'+ink+';--sw:'+(sw||6)+'px;'+(extra||"")+'">'+d+'</g>';
  const pic=(inner,vb,style)=>svg("",vb,inner,style);
  const at=(cls,html,style)=>'<div class="abs '+cls+'" style="'+style+'">'+html+'</div>';
  const two="Musclor<br>Duck";
  const games=(color,top,text)=>at("tag",text||"games","top:"+(top||86)+"%;color:"+color);
  const ribbon=(y,text,size)=>'<path d="M36 '+(y+30)+'L52 '+y+'H268L284 '+(y+30)+'L258 '+(y+30)+'L268 '+(y+56)+'H52L62 '+(y+30)+'Z" fill="#fff4d6" '+S(7)+'/>'+
    '<text x="160" y="'+(y+39)+'" text-anchor="middle" font-family="Permanent Marker,Rubik,sans-serif" font-size="'+(size||27)+'" fill="'+INK+'">'+text+'</text>';
  const arc=(id,r,text,fill,size)=>'<defs><path id="'+id+'" d="M150 150m-'+r+' 0a'+r+' '+r+' 0 1 1 '+(2*r)+' 0a'+r+' '+r+' 0 1 1 -'+(2*r)+' 0"/></defs><text class="keep" font-family="Bowlby One,Rubik,sans-serif" font-size="'+size+'" fill="'+fill+'" letter-spacing="2"><textPath href="#'+id+'">'+text+'</textPath></text>';
  const star=(x,y,s,fill)=>'<path d="M'+x+' '+(y-s)+'l'+(s*.3)+' '+(s*.7)+'l'+(s*.75)+' '+(s*.05)+'l'+(-s*.58)+' '+(s*.48)+'l'+(s*.2)+' '+(s*.74)+'l'+(-s*.67)+' '+(-s*.42)+'l'+(-s*.67)+' '+(s*.42)+'l'+(s*.2)+' '+(-s*.74)+'l'+(-s*.58)+' '+(-s*.48)+'l'+(s*.75)+' '+(-s*.05)+'Z" fill="'+fill+'" '+S(4)+'/>';

  const V={};
  // ===== Z · le tatouage =====
  V.z=[
    ["Bras croisés et cœur","Le videur devant un grand cœur rouge, le nom sur la banderole. Le classique « flash » de tatoueur.","#f1e2c0",
      pic('<g class="boil"><path d="M150 282L44 170Q4 112 50 70Q104 40 150 98Q196 40 250 70Q296 112 256 170Z" fill="#d8232f" '+S(8)+'/>'+thick(duckCrossed(),9)+
        '<g transform="translate(-10 0)">'+ribbon(262,"MUSCLOR DUCK",25)+'</g>'+star(34,60,13,"#ffc93c")+star(268,56,13,"#ffc93c")+'</g>',"0 0 300 330","top:9%")+games(INK,88,"games · no pain no quack")],
    ["Encre bleue","Une seule encre bleu-noir sur papier jauni, deux touches de rouge. Plus sobre, façon vieux carnet de tatoueur.","#efe6d2",
      pic('<g class="boil"><path d="M40 60l10 -22l10 22l-22 -14h24zM262 60l10 -22l10 22l-22 -14h24z" fill="#d8232f"/>'+
        line(thick(duck({}),9),"#efe6d2","#1d2a4a",8,"","--cheek:#d8232f")+'<g class="lineart" style="--paper:#efe6d2;--ink:#1d2a4a;--sw:7px"><path d="M-22 330L0 298H320L342 330L310 330L326 362H-6L10 330Z" fill="#fff4d6" '+S(7)+'/></g>'+
        '<text x="160" y="342" text-anchor="middle" font-family="Permanent Marker,Rubik,sans-serif" font-size="33" fill="#1d2a4a">MUSCLOR DUCK</text></g>',"-40 -10 400 390","top:20%")]
  ];
  // ===== U · le papier découpé =====
  V.u=[
    ["Nuit","Papier bleu nuit, lune et étoiles découpées, double biceps.","#1d2b53",
      '<div class="abs" style="left:50%;top:9%;width:72%;aspect-ratio:1;margin-left:-36%;border-radius:50%;background:#fff4d6;box-shadow:4px 6px 0 rgba(0,0,0,.3)"></div>'+
      pic('<g class="papercut">'+duckDouble()+'<path d="M30 30l6 14l15 1l-11 10l4 15l-14 -8l-13 8l4 -15l-12 -10l15 -1z" fill="#ffd166"/><path d="M286 210l4 9l10 1l-8 7l3 10l-9 -6l-9 6l3 -10l-8 -7l10 -1z" fill="#ff8fb1"/></g>',"0 0 320 300","top:17%")+
      at("name",two,"top:69%;font-size:12.8cqw;color:#fff4d6;text-shadow:3px 4px 0 rgba(0,0,0,.3)")+games("#ffd166",85)],
    ["Cible","Des cercles de papier empilés, comme une cible. Le canard contracte au centre.","#2ec4b6",
      '<div class="abs" style="left:50%;top:6%;width:92%;aspect-ratio:1;margin-left:-46%;border-radius:50%;background:#ff7a59;box-shadow:4px 6px 0 rgba(0,0,0,.2)"></div>'+
      '<div class="abs" style="left:50%;top:12.5%;width:70%;aspect-ratio:1;margin-left:-35%;border-radius:50%;background:#ffd166;box-shadow:4px 6px 0 rgba(0,0,0,.2)"></div>'+
      '<div class="abs" style="left:50%;top:19%;width:48%;aspect-ratio:1;margin-left:-24%;border-radius:50%;background:#fff4d6;box-shadow:4px 6px 0 rgba(0,0,0,.2)"></div>'+
      pic('<g class="papercut">'+duck({})+'</g>',"0 0 320 300","top:17%")+
      at("name",two,"top:69%;font-size:12.8cqw;color:#fff4d6;text-shadow:3px 4px 0 rgba(0,0,0,.25)")+games("#17130f",85)]
  ];
  // ===== T · le post-it =====
  V.t=[
    ["Corrigé","Le canard tient entier dans le post-it, et ses bras passent devant ou derrière le corps au lieu de s'y superposer.","#8d8f96",
      '<div class="vnote" style="background:#ffe86b;transform:rotate(-4deg)">'+pic(line(duckCurl(),"#ffe86b","#1c1c1c",5,"boil","--cheek:#ff8fb1")+'<path class="hl2" d="M252 58H326M40 196q-8 -24 4 -46"/>',POSE.curl[1])+'</div>'+
      '<div class="abs" style="left:34%;right:auto;top:5.5%;width:32%;height:4.5%;background:rgba(255,255,255,.55);transform:rotate(-7deg)"></div>'+
      at("marker",two,"top:71%;font-size:13.2cqw;color:#fff;transform:rotate(-3deg)")+games("#ffe86b",87)],
    ["La pile","Trois post-it empilés. Sur celui du dessus : le canard et sa liste de choses à faire.","#6f7480",
      '<div class="vnote" style="background:#ff9ec4;transform:rotate(-10deg);left:5%;right:13%"></div><div class="vnote" style="background:#9be7ff;transform:rotate(7deg);left:13%;right:5%"></div>'+
      '<div class="vnote" style="background:#ffe86b;transform:rotate(-2deg)">'+pic(line(duck({}),"#ffe86b","#1c1c1c",5,"boil","--cheek:#ff8fb1"),"0 -6 320 440","top:0;width:78%!important;left:11%!important")+
        '<div class="abs chalk" style="bottom:5%;font-size:6.8cqw;color:#1c1c1c;line-height:1.05">1. muscu &nbsp; 2. jeux<br>3. encore muscu</div></div>'+
      at("marker",two,"top:71%;font-size:13.2cqw;color:#fff;transform:rotate(-3deg)")+games("#ffe86b",87)]
  ];
  // ===== S · la linogravure =====
  V.s=[
    ["Corrigée","Les bras croisés se lisent enfin : chaque forme est pleine, le trait gravé ne traverse plus le corps. Des rayons gravés autour.","#f0e6cf",
      '<div class="vblock" style="background:#17130f"></div>'+
      pic('<g class="boil"><path d="M150 150L20 30M150 150L280 30M150 150L10 150M150 150L290 150M150 150L60 290M150 150L240 290M150 150L150 6" fill="none" stroke="#f0e6cf" stroke-width="3" stroke-linecap="round" opacity=".55"/>'+
        line(duckCrossed(),"#17130f","#f0e6cf",6)+'</g>',"0 0 300 300","top:14%")+
      at("name",two,"top:70.5%;font-size:11.6cqw;color:#f0e6cf")+games("#f0e6cf",85.5)],
    ["Deux couleurs","Un bloc rouge, le canard en noir, les traits en réserve. Double biceps de face.","#f0e6cf",
      '<div class="vblock" style="background:#d8232f"></div>'+
      pic('<g class="boil">'+line(duckDouble(),"#17130f","#f0e6cf",7)+'</g>',"-56 -40 432 380","top:13%")+
      at("name",two,"top:69%;font-size:11.6cqw;color:#17130f")+games("#f0e6cf",84)]
  ];
  // ===== R · la gouache =====
  V.r=[
    ["Rose","Fond rose, grands coups de pinceau, le canard contracte.","#ff8fb1",
      pic('<path d="M26 50H290M16 124H300M34 198H284M22 270H294" fill="none" stroke="#ff6f9c" stroke-width="28" stroke-linecap="round"/><g class="gouache boil">'+duck({})+'</g>',"0 0 320 300","top:15%")+
      at("marker",two,"top:68%;font-size:14cqw;color:#fff;transform:rotate(-2deg)")+games("#fff",85)],
    ["La coupe","Bleu marine et moutarde. Il brandit sa coupe, peinte d'un seul geste.","#23395d",
      pic('<path d="M26 50H290M16 124H300M34 198H284M22 270H294" fill="none" stroke="#2c4874" stroke-width="28" stroke-linecap="round"/><g class="gouache boil">'+duckTrophy()+'</g>',POSE.trophy[1],"top:14%")+
      at("marker",two,"top:68%;font-size:14cqw;color:#ffc93c;transform:rotate(2deg)")+games("#ffc93c",85)]
  ];
  // ===== P · la craie =====
  V.p=[
    ["Corrigée","Une vraie tête de canard, grosse et ronde avec son bec, et des bras qui passent devant le torse sans s'y mélanger. Le programme de la semaine à côté.","#22312b",
      pic('<g filter="url(#chalk)">'+line(duckCrab(),"#22312b","#f4f1e6",7,"","--cheek:#ff8fb1;--beak:#ffb347")+'</g>',"0 0 300 300","top:8%")+
      at("chalk","lundi : bras · mardi : bras<br>mercredi : bras","top:64.5%;font-size:5.6cqw;color:#c9d2c5;line-height:1.15")+
      at("chalk","MusclorDuck","top:73%;font-size:16cqw;color:#f4f1e6;filter:url(#chalk)")+games("#ffc93c",88)],
    ["Craies de couleur","Craie jaune pour le corps, blanche pour le reste, des flèches et des notes comme sur un tableau d'entraîneur.","#2b2b2b",
      pic('<g filter="url(#chalk)">'+line(duckDouble(),"#2b2b2b","#ffe14a",7,"","--cheek:#ff8fb1;--beak:#ff9a3d")+
        '<path d="M34 262v22M44 262v22M54 262v22M64 262v22M28 284l42 -24" fill="none" stroke="#f4f1e6" stroke-width="4" stroke-linecap="round"/></g>',"0 0 320 300","top:14%")+
      at("chalk","MusclorDuck","top:68%;font-size:17.6cqw;color:#ffe14a;filter:url(#chalk)")+games("#f4f1e6",80)]
  ];
  // ===== Q · le carnet =====
  const lined="#fdfdf6 repeating-linear-gradient(#fdfdf6 0 21px,#b9d3f0 21px 22px)";
  const graph="linear-gradient(#cfe0f3 1px,transparent 1px) 0 0/16px 16px,linear-gradient(90deg,#cfe0f3 1px,transparent 1px) 0 0/16px 16px,#fbfbf4";
  V.q=[
    ["Un seul trait","Stylo bille sur papier ligné, un trait net au lieu de trois : plus de bras fantômes. Tache de café en prime.",lined,
      '<div class="abs" style="left:13%;right:auto;top:0;bottom:0;width:2px;background:#ff9aa8"></div>'+
      '<div class="abs" style="left:58%;right:auto;top:52%;width:34%;aspect-ratio:1;border-radius:50%;border:5px solid rgba(140,90,40,.28)"></div>'+
      pic(line(duckCurl(),"#fdfdf6","#1d3fae",3.6,"boil")+'<g filter="url(#wob2)" fill="none" stroke="#1d3fae" stroke-width="3" stroke-linecap="round"><path d="M30 30l8 -14l8 14l-14 -9h14zM20 250q10 -12 20 0t20 0M286 250l10 10M296 250l-10 10"/></g>',POSE.curl[1],"top:12%")+
      at("chalk","MusclorDuck","top:69%;font-size:17.6cqw;color:#1d3fae;transform:rotate(-4deg)")+games("#1d3fae",87)],
    ["Corrigé par le prof","Crayon gris sur papier quadrillé, et l'annotation du prof au stylo rouge : 20/20.",graph,
      pic(line(duckCrossed(),"#fbfbf4","#55504a",3.4,"boil"),"0 0 300 300","top:14%")+
      at("chalk","20/20","left:56%;right:auto;top:7%;width:38%;font-size:12cqw;color:#e02b2b;transform:rotate(-12deg);border:3px solid #e02b2b;border-radius:50%;padding:6px 0")+
      at("chalk","Très musclé. Hors sujet.","top:62%;font-size:7.6cqw;color:#e02b2b;transform:rotate(-3deg)")+
      at("chalk","MusclorDuck","top:70%;font-size:17.6cqw;color:#55504a")+games("#55504a",88)]
  ];
  // ===== L · le sticker =====
  const sticker=(d,sw)=>line(d,"#fff","#fff",sw||26)+thick(d,8);
  V.l=[
    ["Double biceps","Autocollant découpé sur fond pastel, avec deux petits autocollants autour. Le trait ne traverse plus les bras.","linear-gradient(160deg,#c9b6ff,#9be7ff 55%,#ffd1e8)",
      pic('<g class="boil">'+sticker(duckDouble())+'</g>'+'<g transform="rotate(-14 44 44)">'+line(star(44,46,22,"#fff"),"#fff","#fff",14)+star(44,46,22,"#ff4f6a")+'</g>'+
        '<g transform="rotate(12 278 240)">'+line(star(278,242,18,"#fff"),"#fff","#fff",14)+star(278,242,18,"#ffe14a")+'</g>',"0 0 320 300","top:15%")+
      at("marker",two,"top:68%;font-size:14cqw;color:#17130f;transform:rotate(-3deg)")+games("#17130f",85)],
    ["La planche","Une planche de quatre autocollants : il contracte, croise les bras, soulève sa barre, lève son haltère.","#5b5f6b",
      pic('<g class="boil"><g transform="translate(6 0) scale(.47) rotate(-5 160 150)">'+sticker(duck({}),30)+'</g><g transform="translate(160 4) scale(.5) rotate(6 150 150)">'+sticker(duckCrossed(),30)+'</g>'+
        '<g transform="translate(8 150) scale(.5) rotate(4 150 150)">'+sticker(duck({arms:"up"}),30)+'</g><g transform="translate(152 158) scale(.46) rotate(-6 170 150)">'+sticker(duckCurl(),30)+'</g></g>',"0 0 320 310","top:13%")+
      at("marker",two,"top:69%;font-size:13.6cqw;color:#fff;transform:rotate(-3deg)")+games("#ffc93c",86)]
  ];
  // ===== M · le crayon gras =====
  const crayon='<defs><pattern id="crY" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="9" height="9" fill="#f7cf63" opacity=".6"/><path d="M0 2.2H9M0 6.6H9" stroke="#efa10a" stroke-width="2.6"/></pattern></defs>';
  V.m=[
    ["Coloriage","Le corps est colorié au crayon, on voit les hachures. Trait brun qui tremble, sur papier kraft.","#d9b98a",
      pic(crayon+'<g class="crayon boil">'+duck({})+'</g>',"0 0 320 300","top:15%")+
      at("marker",two,"top:68%;font-size:13.6cqw;color:#2b1408;transform:rotate(2deg)")+games("#2b1408",85)],
    ["Le carton","Dessiné au gros feutre sur un carton de déménagement, avec son scotch et son marquage.","#c79a63",
      '<div class="abs" style="top:48%;height:9%;background:rgba(240,222,170,.6);transform:rotate(-3deg)"></div>'+
      pic(line(duckCrossed(),"#c79a63","#1b1b1b",8,"boil"),"0 0 300 300","top:13%")+
      at("name","FRAGILE<span style='font-size:.55em;display:block;letter-spacing:.2em'>↑ muscles ↑</span>","left:auto;right:5%;top:4%;width:42%;font-size:6.8cqw;color:#b3261e;border:3px solid #b3261e;padding:5px 2px;transform:rotate(5deg)")+
      at("name",two,"top:69%;font-size:12.4cqw;color:#1b1b1b;filter:url(#speck)")+games("#1b1b1b",86)]
  ];
  // ===== J · l'ombre =====
  V.j=[
    ["La lampe","Tout est repris à la main. Un caneton dessiné au feutre, tout petit sous sa lampe, et sur le mur une ombre au pinceau : lui, en colosse.","#f1dfba",
      '<div class="abs" style="top:-12%;left:50%;width:190%;aspect-ratio:1;margin-left:-95%;background:radial-gradient(circle,#fff6da 0 30%,rgba(255,246,218,0) 60%)"></div>'+
      '<div class="abs" style="top:auto;bottom:0;height:31%;background:#d9bd8a"></div>'+
      pic('<g opacity=".62" filter="url(#speck)" transform="translate(18 0) skewX(-7)">'+line(duckDouble(),"#4a3a30","#4a3a30",9)+'</g>'+
        '<g class="boil" transform="translate(232 206) scale(.56)">'+chick()+'</g>'+
        '<path d="M150 -12V18M118 18H182L196 44H104Z" fill="#3a2a22" stroke="#3a2a22" stroke-width="6" stroke-linejoin="round"/>',"0 -14 320 314","top:11%")+
      at("marker",two,"top:71%;font-size:12.8cqw;color:#3a2a22;transform:rotate(-2deg)")+games("#3a2a22",87)],
    ["La lampe torche","La nuit, un rond de lumière sur le mur. Le caneton lève son aile ; son ombre contracte un biceps énorme.","#141a33",
      '<div class="abs" style="top:7%;left:50%;width:96%;aspect-ratio:1;margin-left:-48%;border-radius:50%;background:radial-gradient(circle,#fff3c4 0 58%,#ffe9a0 66%,rgba(255,233,160,0) 72%)"></div>'+
      pic('<g opacity=".8" filter="url(#speck)" transform="translate(-6 4) scale(.96)">'+line(duck({}),"#1b2147","#1b2147",9)+'</g>'+
        '<g class="boil" transform="translate(190 206) scale(.56)">'+chick()+'</g>',"0 0 320 300","top:12%")+
      at("chalk","MusclorDuck","top:70%;font-size:17.6cqw;color:#fff3c4")+games("#9be7ff",87)]
  ];
  // ===== F · le bloc =====
  V.f=[
    ["Au feutre","Le même canard tout en angles, mais tracé au gros feutre qui tremble, sur fond orange.","#ff7a2e",
      pic('<g class="boil">'+line(blockDuck,"#fff","#fff",24)+thick(blockDuck,9)+'<path d="M24 150l-14 -6M24 170l-16 2M276 150l14 -6M276 170l16 2" fill="none" stroke="#17130f" stroke-width="6" stroke-linecap="round"/></g>',"0 0 300 300","top:10%")+
      at("marker",two,"top:68%;font-size:14cqw;color:#fff4d6;transform:rotate(-2deg)")+games("#17130f",85)],
    ["En papier","Les mêmes blocs découpés dans du papier turquoise, chacun avec son ombre, sur fond crème.","#fff4d6",
      pic('<g class="papercut recolor" style="--body:#2ec4b6;--shade:#0f6f68"><path d="M20 250L70 190L120 250Z" fill="#ff8fb1"/><path d="M200 60L250 10L290 60Z" fill="#ffd166"/>'+blockDuck+'</g>',"0 0 300 300","top:15%")+
      at("name",two,"top:68%;font-size:12.8cqw;color:#17130f")+games("#17130f",84)]
  ];
  // ===== D · l'haltère =====
  const sweat='<path class="sweat" d="M92 60q-6 10 0 14q6 -4 0 -14z" fill="#8fd8ff" stroke="#2b1408" stroke-width="3"/><path class="sweat s2" d="M214 56q-6 10 0 14q6 -4 0 -14z" fill="#8fd8ff" stroke="#2b1408" stroke-width="3"/>';
  V.d=[
    ["Trop lourd","La barre plie sous le poids, il tremble, le sol se fissure. Dessiné au feutre.","#ff8fb1",
      '<div class="abs" style="top:auto;bottom:0;height:27%;background:#2b1408"></div>'+
      pic('<g class="boil"><path d="M8 84Q150 14 292 84" fill="none" stroke="#2b1408" stroke-width="11" stroke-linecap="round"/>'+
        '<g transform="rotate(-24 26 78)"><rect x="6" y="38" width="34" height="84" rx="10" fill="#2b1408"/></g><g transform="rotate(24 274 78)"><rect x="260" y="38" width="34" height="84" rx="10" fill="#2b1408"/></g>'+
        '<g class="shake">'+duck({arms:"up"})+sweat+'</g><path d="M100 292l-22 14M118 294l-6 18M200 292l22 14M184 294l8 18" fill="none" stroke="#ff8fb1" stroke-width="4" stroke-linecap="round"/></g>',"0 0 300 320","top:19%")+
      at("name","MusclorDuck","top:77%;font-size:11.6cqw;color:#ffc93c")+games("#fff",90,"no pain · no quack")],
    ["Les donuts","Même barre, mais les poids sont deux énormes donuts au glaçage rose. Motivation personnelle.","#7dd3fc",
      '<div class="abs" style="top:auto;bottom:0;height:27%;background:#1d4e89"></div>'+
      pic('<g class="boil"><rect x="20" y="40" width="260" height="11" rx="5.5" fill="#2b1408"/>'+
        [34,266].map(x=>'<circle cx="'+x+'" cy="46" r="34" fill="#e8b06a" '+S(6)+'/><circle cx="'+x+'" cy="44" r="27" fill="#ff8fb1" '+S(4)+'/><circle cx="'+x+'" cy="46" r="9" fill="#7dd3fc" '+S(4)+'/>'+
          '<path d="M'+(x-16)+' 34l6 3M'+(x+10)+' 30l5 -4M'+(x+16)+' 52l5 3M'+(x-18)+' 54l5 -4M'+(x-2)+' 24l1 6" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>').join("")+
        duck({arms:"up"})+sweat+'</g>',"-8 0 316 300","top:21%")+
      at("marker","MusclorDuck","top:77%;font-size:11.6cqw;color:#ffc93c")+games("#fff",90,"no pain · no donut")]
  ];
  // ===== B · le blason =====
  V.b=[
    ["Tampon à l'encre","Le blason refait à la main, à l'encre bleu nuit sur papier : trait qui tremble, encre qui accroche mal.","#f3ead7",
      pic('<g filter="url(#speck)" transform="rotate(-7 150 150)"><g class="lineart" style="--paper:#f3ead7;--ink:#1d2a4a;--sw:6px"><circle cx="150" cy="150" r="142" fill="none"/><circle cx="150" cy="150" r="100" fill="none"/></g>'+
        arc("arcB1",112,"MUSCLORDUCK ★ NO PAIN NO QUACK ★ ","#1d2a4a",25)+
        '<g transform="translate(150 152) scale(.56) translate(-160 -150)">'+line(duckDouble(),"#f3ead7","#1d2a4a",9)+'</g></g>',"0 0 300 300","top:19%")+games("#1d2a4a",79,"games · depuis 2026")],
    ["L'écusson brodé","Le blason en écusson à coudre : feutrine verte et jaune, contours en points de couture.","#1f4d3a",
      pic('<circle cx="150" cy="150" r="144" fill="#ffc93c"/><circle cx="150" cy="150" r="136" fill="none" stroke="#fff4d6" stroke-width="5" stroke-dasharray="11 7"/>'+
        '<circle cx="150" cy="150" r="100" fill="#1f4d3a"/><circle cx="150" cy="150" r="93" fill="none" stroke="#fff4d6" stroke-width="4" stroke-dasharray="9 6"/>'+
        arc("arcB2",110,"MUSCLORDUCK ★ NO PAIN NO QUACK ★ ","#1f4d3a",25)+
        '<g class="stitch" transform="translate(150 152) scale(.54) translate(-160 -150)">'+duckDouble()+'</g>',"0 0 300 300","top:19%")+games("#ffc93c",79,"games · depuis 2026")]
  ];

  // ---------- mise en page : pour chaque finaliste, l'originale puis ses deux variations ----------
  const host=document.getElementById("final");
  KEEP.forEach(k=>{
    const orig=document.querySelector("#grid .card."+k+",#grid2 .card."+k+",#grid3 .card."+k+",#grid4 .card."+k);
    if(!orig)return;
    const head=orig.querySelector("h2").textContent, letter=head.split("·")[0].trim();
    const group=document.createElement("section");
    group.className="group";
    group.innerHTML='<h3>'+head+'</h3><div class="trio"></div>';
    const trio=group.querySelector(".trio");
    if(orig.closest(".hand"))orig.classList.add("hand"); // garde le grain et les polices manuscrites une fois déplacée
    orig.querySelector("h2").innerHTML='<span>'+letter+' ·</span> Originale';
    trio.appendChild(orig);
    V[k].forEach(([title,text,bg,html],i)=>{
      const card=document.createElement("section");
      card.className="card hand v"+k+(i+1);
      card.innerHTML='<h2><span>'+letter+(i+1)+' ·</span> '+title+'</h2><p>'+text+'</p><div class="phone" style="background:'+bg+'">'+html+'</div>';
      trio.appendChild(card);
    });
    host.appendChild(group);
  });
  // les propositions écartées disparaissent de la page
  document.querySelectorAll("#grid,#grid2,#grid3,#grid4").forEach(g=>g.remove());
  document.querySelectorAll("main>h3").forEach(h=>h.remove());
})();
