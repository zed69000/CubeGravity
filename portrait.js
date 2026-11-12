/* Portrait only on phones. A browser cannot always lock the screen, so a phone held sideways gets a
   full-screen card asking to turn it back. Computers (wide screens, mouse) and tablets keep playing as is.
   In fullscreen the browser is also asked to lock portrait, which Android Chrome allows. */
(function(){
  const css=document.createElement("style");
  css.textContent=
    "#dgTurnPhone{display:none;position:fixed;inset:0;z-index:9999;background:#0d1230;color:#fff;"+
    "flex-direction:column;align-items:center;justify-content:center;gap:18px;font:800 24px/1.3 Rubik,Arial,sans-serif;text-align:center;padding:16px}"+
    "#dgTurnPhone svg{width:min(110px,30vh);height:min(110px,30vh);overflow:visible;animation:dgTurnPhone 2.4s ease-in-out infinite}"+
    "#dgTurnPhone rect{fill:none;stroke:#19e3ff;stroke-width:3}"+
    "#dgTurnPhone circle{fill:#19e3ff}"+
    "#dgTurnPhone path{fill:none;stroke:#f6ff3d;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}"+
    "@keyframes dgTurnPhone{0%,20%{transform:rotate(-90deg)}55%,100%{transform:rotate(0)}}"+
    "@media (orientation:landscape) and (pointer:coarse) and (max-height:520px){#dgTurnPhone{display:flex}}";
  document.head.appendChild(css);
  const card=document.createElement("div");
  card.id="dgTurnPhone";
  card.setAttribute("role","alert");
  card.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="20" y="6" width="24" height="44" rx="5"/><circle cx="32" cy="43" r="2.2"/><path d="M10 40a24 24 0 0 0 14 18M24 58l-6 0M24 58l1-6"/></svg><div>Tourne ton téléphone</div>';
  document.body.appendChild(card);
  function lock(){
    try{const o=screen.orientation;if(o&&o.lock)o.lock("portrait").catch(()=>{});}catch(e){}
  }
  document.addEventListener("fullscreenchange",()=>{if(document.fullscreenElement)lock();});
  lock();
})();
