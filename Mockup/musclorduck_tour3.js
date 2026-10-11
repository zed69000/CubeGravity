/* MusclorDuck – troisième tour.
   Chargé après musclorduck_finalistes.js. La page a deux parties :
     1. les propositions retenues, dans une seule grille (S3 est fabriquée ici à partir de S1) ;
     2. plus rien d'autre : pour l'idée de l'ombre, seule la linogravure rouge J14 a été retenue.

   L'ombre est le canard musclé des propositions retenues, passé en tons sombres ; le petit est le même canard
   sans les muscles. Pour qu'on comprenne que c'est SON ombre, chaque proposition montre les quatre indices
   d'une ombre portée : une lampe d'un côté, le petit devant, une traînée d'ombre qui part de ses pattes et
   file sur le sol jusqu'au mur, et la grande ombre décalée du côté opposé à la lampe, dans la même pose. */
(function(){
  const KEPT=[".card.z",".card.vz2",".card.vs1",".card.vs2",".card.r",".card.vp2",".card.vb1"];

  const pic=(inner,vb,style)=>svg("",vb,inner,style);
  const at=(cls,html,style)=>'<div class="abs '+cls+'" style="'+style+'">'+html+'</div>';
  const card=(tag,title,text,bg,html)=>'<section class="card hand"><h2><span>'+tag+' ·</span> '+title+'</h2><p>'+text+'</p><div class="phone" style="background:'+bg+'">'+html+'</div></section>';
  // dessin en deux tons : `paper` remplit les formes (elles se cachent donc les unes les autres), `ink` trace
  const tone=(d,paper,ink,sw,extra)=>'<g class="lineart" style="--paper:'+paper+';--ink:'+ink+';--sw:'+(sw||7)+'px;'+(extra||"")+'">'+d+'</g>';
  const thick=(d,w)=>d.replace(/stroke-width="7"/g,'stroke-width="'+w+'"');

  /* Le petit : le même canard que le colosse, dans la même pose, mais avec deux petites ailes à la place des bras
     et sans abdos (cadre 300 x 300, pattes vers y = 278). */
  function miniDuck(){
    const wing='<path d="M220 128Q252 116 254 86Q246 74 236 84Q238 102 212 110Z" fill="'+Y+'" '+S()+'/>';
    return legs+wing+mirror(wing)+torso+face;
  }

  /* Bras croisés, d'après la silhouette de la référence (cadre 300 x 300, vu de face), en gros traits seulement :
       - deux énormes épaules-bras qui descendent jusqu'aux coudes. Les coudes sont les points les plus bas et les
         plus écartés de la silhouette ;
       - de chaque coude, un avant-bras épais remonte en diagonale vers le bras d'en face en s'affinant : les deux se
         croisent devant le ventre, sous les pectoraux ;
       - celui de derrière finit par une main posée à plat sur le biceps opposé ; celui de devant glisse sous l'autre bras.
     Chaque forme est pleine et posée dans l'ordre réel : on voit donc lequel passe devant. */
  function duckCrossed2(){
    // épaule + bras : une seule grosse masse, du haut de l'épaule jusqu'au coude
    const upper='<path d="M98 92Q52 76 30 112Q12 146 24 182Q32 204 54 208Q78 208 90 190Q106 150 98 92Z" fill="'+Y+'" '+S()+'/>'+
      '<path d="M30 140Q56 150 84 134" fill="none" '+S(6)+'/>';                                   // le creux entre épaule et biceps
    // avant-bras : gros au coude (à droite), il s'affine jusqu'au poignet et finit par une main à plat
    const fore='<path d="M269 202Q270 180 258 173Q236 154 210 154Q184 148 159 146L116 137Q100 122 80 122Q58 124 56 140Q58 158 78 162L108 163Q128 174 148 181Q172 196 194 204Q222 220 242 221Q266 220 269 202Z" fill="'+Y+'" '+S()+'/>';
    const fingers='<path d="M60 134H86M60 146H88" fill="none" '+S(5)+'/>';
    return legs+torso+
      '<path d="M100 122Q126 142 149 128M151 128Q174 142 200 122M150 106V128" fill="none" '+S(6)+'/>'+   // pectoraux
      '<path d="M150 232V242" fill="none" '+S(6)+'/>'+
      upper+                                              // bras gauche
      fore+fingers+                                       // avant-bras du bras droit : il remonte vers la gauche, main sur le biceps gauche
      '<g transform="translate(0 12)">'+mirror(fore)+'</g>'+   // avant-bras du bras gauche : il passe devant et file vers la droite
      mirror(upper)+                                      // bras droit, par-dessus : la main gauche est glissée dessous
      face;
  }

  /* L'ombre en linogravure rouge. Trois encres seulement : rouge, noir, crème, plus un rouge sombre pour l'ombre.
     Ce qui fait lire « c'est son ombre », sans aucune lampe :
       - l'ombre est une forme PLEINE et sombre (un dessin au trait se lit comme un second personnage) ;
       - elle touche les pattes du petit : les deux partent du même point ;
       - elle est penchée, étirée ou renversée, jamais simplement posée derrière. */
  const RED="#d8232f",DARK="#a3141f",BLK="#17130f",CRM="#f0e6cf";
  let clipN=0;
  // le grand et le petit, posés par leurs pattes au point (x, y)
  const big=(x,y,tf,fill,line,eyes)=>'<g transform="translate('+x+' '+y+') '+tf+' translate(-160 -286)">'+tone(duckDouble(),fill,line,6)+
    (eyes?'<path d="M132 60l16 7l-16 5zM188 60l-16 7l16 5z" fill="'+eyes+'"/>':'')+'</g>';
  const small=(x,y,k,fill,line)=>'<g transform="translate('+x+' '+y+') scale('+k+') translate(-150 -286)">'+tone(miniDuck(),fill,line,15)+'</g>';
  // tout ce qui dépasse du bloc rouge est coupé, comme à l'impression
  const inBlock=d=>{const id="blk"+(++clipN);return '<clipPath id="'+id+'"><rect x="-40" y="-76" width="400" height="728" rx="8"/></clipPath><g clip-path="url(#'+id+')">'+d+'</g>';};
  const lino=(tag,title,text,inner,nameTop,nameColor,under)=>card(tag,title,text,"#f0e6cf",
    '<div class="vblock" style="background:'+RED+'"></div>'+(under||"")+pic('<g class="boil">'+inBlock(inner)+'</g>',"-74 -44 468 400","top:10%")+
    at("name","Musclor<br>Duck","top:"+nameTop+"%;font-size:11.6cqw;color:"+(nameColor||BLK))+at("tag","games","top:"+(nameTop+15)+"%;color:"+CRM));
  /* L'ombre évasée : le colosse renversé, pattes en haut au point (x, y), dont la largeur passe régulièrement de
     `top` (celle du petit canard) à `bottom` (celle du colosse). SVG ne sait pas faire ce trapèze d'un coup : on
     empile de fines bandes horizontales, chacune un peu plus large que la précédente. */
  function flare(x,y,top,bottom,ky,fill,eyes){
    const N=56,H=254*ky,h=H/N,id="fl"+(++clipN);
    const duckShape=tone(duckDouble(),fill,fill,6)+'<path d="M132 60l16 7l-16 5zM188 60l-16 7l16 5z" fill="'+eyes+'"/>';
    let out='<defs><g id="'+id+'">'+duckShape+'</g></defs>';
    for(let i=0;i<N;i++){
      const sx=top+(bottom-top)*((i+.5)/N);
      out+='<clipPath id="'+id+'c'+i+'"><rect x="-200" y="'+(y+i*h-.4).toFixed(2)+'" width="720" height="'+(h+.8).toFixed(2)+'"/></clipPath>'+
        '<g clip-path="url(#'+id+'c'+i+')"><use href="#'+id+'" transform="translate('+x+' '+y+') scale('+sx.toFixed(4)+' '+(-ky)+') translate(-160 -286)"/></g>';
    }
    return out;
  }
  const floorLine='<path d="M-40 246H360" fill="none" stroke="'+CRM+'" stroke-width="4" stroke-linecap="round"/>';

  const SHADOW=[
    lino("J14","La linogravure rouge","Le petit canard noir et son ombre sur le mur : le colosse gravé au trait clair, dans le bloc rouge.",
      floorLine+big(192,246,"scale(.95)",RED,CRM)+'<path d="M58 290L150 246L246 246L112 296Z" fill="'+BLK+'"/>'+small(79,290,.3,BLK,CRM),69),
  ];

  // ---------- mise en page ----------
  const main=document.querySelector("main");
  const section=(title,sub,html,id)=>{const s=document.createElement("section");s.className="group";s.innerHTML='<h3>'+title+'</h3><p class="lead" style="margin:0 0 14px">'+sub+'</p><div class="grid" id="'+id+'">'+html+'</div>';main.appendChild(s);return s.querySelector(".grid");};
  const keptGrid=section("Retenus","Les propositions que tu gardes, avec tes retouches.","","kept");
  KEPT.forEach(sel=>{
    const c=document.querySelector(sel);
    if(!c)return;
    const group=c.closest(".group"),head=group?group.querySelector("h3").textContent:"";
    const letter=head.split("·")[0].trim(),label=head.split("·").slice(1).join("·").trim();
    const h2=c.querySelector("h2"),p=c.querySelector("p");
    if(/Originale/.test(h2.textContent))h2.innerHTML='<span>'+letter+' ·</span> '+label;
    else h2.innerHTML=h2.innerHTML.replace("</span> ","</span> "+label+" : ");
    if(sel===".card.vs1"){h2.innerHTML='<span>S1 ·</span> La linogravure';p.textContent="Un bloc d'encre noire, le videur aux bras croisés gravé en creux, des rayons autour.";}
    if(sel===".card.vp2")p.textContent="Craie jaune pour le corps, blanche pour le reste, sur un tableau noir.";
    keptGrid.appendChild(c);
    // S3 : S1 avec le nom écrit à la craie
    if(sel===".card.vs1"){
      const s3=c.cloneNode(true);
      s3.classList.replace("vs1","vs3");
      s3.querySelector("h2").innerHTML='<span>S3 ·</span> La linogravure : nom à la craie';
      s3.querySelector("p").textContent="La même gravure que S1, mais le nom est écrit à la craie par-dessus, d'une autre main.";
      const nameEl=s3.querySelector(".name");
      nameEl.className="abs chalk";
      nameEl.textContent="MusclorDuck";
      nameEl.style.cssText="top:71%;font-size:17cqw;color:#f0e6cf;filter:url(#chalk)";
      s3.querySelectorAll("[id]").forEach(e=>e.removeAttribute("id"));
      keptGrid.appendChild(s3);
    }
  });
  // S4 : la gravure de S1, redessinée avec des bras croisés lisibles
  const s1=keptGrid.querySelector(".vs1");
  if(s1){
    const s4=document.createElement("section");
    s4.className="card hand vs4";
    s4.innerHTML='<h2><span>S4 ·</span> La linogravure : bras lisibles</h2><p>S1 redessinée : un gros bras de chaque côté, et les deux avant-bras qui se croisent en X devant la poitrine, un poing posé sur le biceps d\'en face.</p>'+
      '<div class="phone" style="background:#f0e6cf"><div class="vblock" style="background:#17130f"></div>'+
      pic('<g class="boil"><path d="M150 150L20 30M150 150L280 30M150 150L10 150M150 150L290 150M150 150L60 290M150 150L240 290M150 150L150 6" fill="none" stroke="#f0e6cf" stroke-width="3" stroke-linecap="round" opacity=".55"/>'+
        tone(duckCrossed2(),"#17130f","#f0e6cf",6)+'</g>',"0 0 300 300","top:14%")+
      at("name","Musclor<br>Duck","top:70.5%;font-size:11.6cqw;color:#f0e6cf")+at("tag","games","top:85.5%;color:#f0e6cf")+'</div>';
    keptGrid.appendChild(s4);
  }
  // l'ordre voulu : Z, Z2, S1, S2, S3, S4, R, P2, B1
  const s3=keptGrid.querySelector(".vs3"),s2=keptGrid.querySelector(".vs2");
  if(s3&&s2)s2.after(s3);
  const s4=keptGrid.querySelector(".vs4");
  if(s4&&s3)s3.after(s4);
  document.getElementById("final").remove();
  // l'ombre : seule la linogravure rouge J14 a été retenue, elle rejoint les autres
  keptGrid.insertAdjacentHTML("beforeend",SHADOW.join(""));
  document.querySelector("h1").textContent="MusclorDuck · troisième tour";
  const lead=document.querySelector("main>p.lead");
  if(lead)lead.textContent="Les dix propositions retenues.";
  // Les dessins filtrés (craie, tampon) restent parfois vides après le déplacement des cartes dans la page :
  // on repose leur filtre une fois la mise en page terminée, ce qui force le navigateur à les redessiner.
  setTimeout(()=>document.querySelectorAll("svg g[filter]").forEach(g=>{
    const f=g.getAttribute("filter");
    g.removeAttribute("filter");
    requestAnimationFrame(()=>g.setAttribute("filter",f));
  }),400);
})();
