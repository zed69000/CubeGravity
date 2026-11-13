/* ===== Date Gravity : fêtes de l'année =====
   Noël (1er décembre au 6 janvier) et Saint-Valentin (7 au 15 février).
   Pendant une fête : un décor en plus (guirlande et neige, ou cœurs qui montent), une victoire à ses couleurs,
   et une tête et une couleur de perso offertes à tout le monde, gardées pour toujours.
   Pour essayer hors saison : game.html?fete=noel (ou valentin, ou aucune). */
(function(){
  const FETES={
    noel:{from:[12,1],to:[1,6],greet:"Joyeux Noël",items:["bonnet_noel","sapin"],
      colors:["#ff3b4e","#3ddc84","#ffd23f","#ffffff"]},
    valentin:{from:[2,7],to:[2,15],greet:"Bonne Saint-Valentin",items:["coeur","guimauve"],
      colors:["#ff3b6b","#ff8fc0","#ffd0e6","#ffffff"],hearts:true}
  };
  const OWN_KEY="dg_fete_items";
  function inRange(f,d){
    const md=(d.getMonth()+1)*100+d.getDate(), a=f.from[0]*100+f.from[1], b=f.to[0]*100+f.to[1];
    return a<=b?(md>=a&&md<=b):(md>=a||md<=b); // Noël passes the new year
  }
  function currentKey(){
    let q=null;
    try{q=new URLSearchParams(location.search).get("fete")||sessionStorage.getItem("dg_fete_test");}catch(e){}
    if(q){
      try{sessionStorage.setItem("dg_fete_test",q);}catch(e){}
      return FETES[q]?q:null;
    }
    const d=new Date();
    return Object.keys(FETES).find(k=>inRange(FETES[k],d))||null;
  }
  const key=currentKey(), fete=key?FETES[key]:null;

  function owned(){try{return JSON.parse(localStorage.getItem(OWN_KEY)||"[]")||[];}catch(e){return [];}}
  // given during the holiday, kept afterwards
  if(fete){
    const have=owned(), add=fete.items.filter(k=>!have.includes(k));
    if(add.length)try{localStorage.setItem(OWN_KEY,JSON.stringify(have.concat(add)));}catch(e){}
  }

  const tile=(w,h,body)=>'url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'">'+body+'</svg>')+'")';
  function css(){
    if(document.getElementById("dgFeteCss"))return;
    const st=document.createElement("style");st.id="dgFeteCss";
    st.textContent=
      ".dgFete{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}"+
      ".dgFete.fixed{position:fixed}"+
      ".dgFete .fall{position:absolute;left:-20%;right:-20%;top:-300px;bottom:-300px;background-repeat:repeat;will-change:transform}"+
      ".dgFete .wire{position:absolute;left:0;top:0;width:100%;height:46px;overflow:visible}"+
      ".dgFete .bulb{position:absolute;width:9px;height:13px;margin-left:-4.5px;border-radius:50% 50% 45% 45%;box-shadow:0 0 9px 3px currentColor;animation:dgBulb 2.2s ease-in-out infinite}"+
      ".dgFete .bulb::before{content:'';position:absolute;left:2px;top:-4px;width:5px;height:5px;border-radius:1px;background:#2b3350}"+
      "@keyframes dgBulb{0%,100%{opacity:.45}50%{opacity:1}}"+
      ".dgFeteGreet{display:block;width:max-content;margin:.4rem auto 0;padding:.35rem .95rem;border-radius:99rem;font:800 1.05rem/1.2 Rubik,Arial,sans-serif;color:#0d1230;letter-spacing:.02em}"+
      "@media (prefers-reduced-motion:reduce){.dgFete .bulb{animation:none}}";
    document.head.appendChild(st);
  }
  function garland(box){
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("class","wire");svg.setAttribute("viewBox","0 0 100 46");svg.setAttribute("preserveAspectRatio","none");
    const n=Math.max(6,Math.round((box.clientWidth||window.innerWidth)/58)), seg=100/n;
    let d="M0 8";
    for(let i=0;i<n;i++)d+="Q"+(seg*i+seg/2).toFixed(2)+" 34 "+(seg*(i+1)).toFixed(2)+" 8";
    svg.innerHTML='<path d="'+d+'" fill="none" stroke="#2b3350" stroke-width="2" vector-effect="non-scaling-stroke"/>';
    box.appendChild(svg);
    const cols=["#ff3b4e","#3ddc84","#ffd23f","#3fa9ff","#ff8fc0"];
    for(let i=0;i<n;i++)for(const t of [.3,.7]){
      const b=document.createElement("i");b.className="bulb";
      const y=8+(1-Math.pow(2*t-1,2))*13; // on the quadratic sag
      b.style.left=(seg*(i+t))+"%";b.style.top=(y+3)+"px";
      const c=cols[(i*2+(t>.5?1:0))%cols.length];b.style.background=c;b.style.color=c;
      b.style.animationDelay=(-((i*2+(t>.5?1:0))%5)*.44)+"s";
      box.appendChild(b);
    }
  }
  function layer(box,img,size,dur,dir,op,drift){
    const d=document.createElement("div");d.className="fall";d.style.backgroundImage=img;d.style.opacity=op;
    box.appendChild(d);
    if(!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches))
      d.animate([{transform:"translate3d(0,0,0)"},{transform:"translate3d("+drift+"px,"+(dir*size)+"px,0)"}],{duration:dur*1000,iterations:Infinity,easing:"linear"});
  }
  /* adds the holiday decor to a backdrop element (the game's #gfx, or the menu page with fixed:true) */
  function decorate(host,opt){
    if(!fete||!host)return;
    css();
    const old=host.querySelector(":scope > .dgFete");if(old)old.remove();
    const box=document.createElement("div");box.className="dgFete"+(opt&&opt.fixed?" fixed":"");box.setAttribute("aria-hidden","true");
    if(key==="noel"){
      layer(box,tile(160,160,'<circle cx="20" cy="30" r="2.6" fill="#fff"/><circle cx="110" cy="80" r="1.8" fill="#fff"/><circle cx="70" cy="140" r="2.2" fill="#fff"/><circle cx="140" cy="20" r="1.4" fill="#fff"/>'),160,10,1,.8,30);
      layer(box,tile(240,240,'<circle cx="60" cy="60" r="3.6" fill="#fff"/><circle cx="190" cy="170" r="3" fill="#fff"/>'),240,7,1,.5,-40);
    }else{
      const h=(x,y,s,c)=>'<path transform="translate('+x+' '+y+') scale('+s+')" d="M12 21s-7-4.35-9.5-8.5C.5 9 2.5 5 6.5 5c2 0 3.5 1 5.5 3c2-2 3.5-3 5.5-3c4 0 6 4 4 7.5C19 16.65 12 21 12 21z" fill="'+c+'"/>';
      layer(box,tile(200,200,h(20,30,.8,"#ff5f8f")+h(130,110,.6,"#ffb3d1")+h(80,170,.5,"#ff3b6b")),200,16,-1,.45,20);
      layer(box,tile(300,300,h(60,40,1.1,"#ff8fc0")+h(220,210,.9,"#ff5f8f")),300,24,-1,.3,-30);
    }
    host.appendChild(box);
    if(key==="noel")requestAnimationFrame(()=>garland(box));
  }
  /* small greeting under a title */
  function greet(afterEl){
    if(!fete||!afterEl)return;
    css();
    const p=document.createElement("span");p.className="dgFeteGreet";
    p.style.background="linear-gradient(90deg,"+fete.colors[0]+","+fete.colors[1]+")";
    p.textContent=window.tr?tr(fete.greet):fete.greet;
    afterEl.insertAdjacentElement("afterend",p);
  }
  window.DGFete={key,fete,decorate,greet,
    owns:k=>owned().includes(k),
    colors:()=>fete?fete.colors:null,
    heartsOnly:()=>!!(fete&&fete.hearts)};
})();
