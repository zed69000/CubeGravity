/* ===== DATE GRAVITY PREMIUM =====
   Un achat unique qui retire toutes les pubs : plus d'interstitiel, et les solutions sont offertes.
   Partagé par le menu (index.html) et le jeu (game.html).

     DGPremium.isOn()     -> true si le joueur a le Premium
     DGPremium.price()    -> le prix à afficher, dans la langue du joueur
     DGPremium.buy()      -> Promise<boolean>, true si l'achat a abouti
     DGPremium.restore()  -> Promise<boolean>, true si un achat a été retrouvé (bouton exigé par Apple)
     DGPremium.onChange   -> rappel quand l'état change

   Pour l'instant le seul « magasin » est un achat de TEST : une fenêtre qui simule le paiement, pour juger
   le parcours. Aucun argent ne circule. Avant publication :
     1. créer le produit non consommable PRODUCT_ID dans App Store Connect et Google Play ;
     2. brancher un vrai magasin dans `store` (mêmes trois méthodes), qui donnera aussi le prix local ;
     3. passer TEST_PURCHASES à false, sinon n'importe qui obtient le Premium gratuitement.
*/
(function(){
  const PRODUCT_ID="com.dategravity.app.premium";
  const TEST_PURCHASES=true;
  const PRICE_EUR=2.99;
  const KEY="dg_premium";

  function isOn(){try{return localStorage.getItem(KEY)==="1";}catch(e){return false;}}
  function setOn(v){
    try{if(v)localStorage.setItem(KEY,"1");else localStorage.removeItem(KEY);}catch(e){}
    apply();
    try{DGPremium.onChange&&DGPremium.onChange(isOn());}catch(e){}
  }
  // Le jeu masque les étiquettes « PUB » d'après cette classe.
  function apply(){if(document.body)document.body.classList.toggle("premium",isOn());}

  /* Fenêtre d'achat de test. Résout true si le joueur « achète ». */
  function fakeCheckout(){
    return new Promise(resolve=>{
      const ov=document.createElement("div");
      ov.setAttribute("role","dialog");
      ov.setAttribute("aria-modal","true");
      ov.style.cssText="position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(7,9,26,.82);font-family:Rubik,Arial,sans-serif;color:#eaf0ff";
      ov.innerHTML='<div style="width:min(92vw,340px);padding:20px;border-radius:24px;background:#131a45;box-shadow:inset 0 0 0 2px #2b3a8c,0 0 40px rgba(25,227,255,.25);text-align:center">'+
        '<div style="font-size:11px;font-weight:800;letter-spacing:.08em;color:#8fa0d8">ACHAT DE TEST · AUCUN PAIEMENT RÉEL</div>'+
        '<div style="margin:14px 0 4px;font:900 22px/1.1 Rubik,Arial,sans-serif;text-transform:uppercase">Date Gravity Premium</div>'+
        '<div style="font-size:13px;color:#8fa0d8">'+PRODUCT_ID+'</div>'+
        '<div style="margin:14px 0;font:900 30px/1 Rubik,Arial,sans-serif;color:#f6ff3d">'+price()+'</div>'+
        '<button type="button" data-ok style="display:block;width:100%;padding:13px;border:0;border-radius:999px;background:linear-gradient(90deg,#f6ff3d,#19e3ff);color:#0d1230;font:900 15px/1 Rubik,Arial,sans-serif;cursor:pointer">Acheter (test)</button>'+
        '<button type="button" data-no style="display:block;width:100%;margin-top:8px;padding:11px;border:0;border-radius:999px;background:#172052;color:#eaf0ff;font:800 14px/1 Rubik,Arial,sans-serif;cursor:pointer">Annuler</button></div>';
      const done=v=>{ov.remove();resolve(v);};
      ov.querySelector("[data-ok]").onclick=()=>done(true);
      ov.querySelector("[data-no]").onclick=()=>done(false);
      document.body.appendChild(ov);
    });
  }

  // Le magasin. À remplacer par le vrai (App Store / Google Play) : mêmes méthodes, mêmes retours.
  const store={
    price(){
      try{return new Intl.NumberFormat((window.DGi18n&&DGi18n.lang)||"fr",{style:"currency",currency:"EUR"}).format(PRICE_EUR);}
      catch(e){return PRICE_EUR.toFixed(2).replace(".",",")+" €";}
    },
    buy(){return TEST_PURCHASES?fakeCheckout():Promise.resolve(false);},
    restore(){return Promise.resolve(false);} // un achat de test ne laisse aucune trace à retrouver
  };
  function price(){return store.price();}

  const DGPremium={
    PRODUCT_ID,
    onChange:null,
    isOn,
    price,
    async buy(){
      if(isOn())return true;
      let ok=false;
      try{ok=!!(await store.buy());}catch(e){console.warn("[PREMIUM] achat",e);}
      if(ok)setOn(true);
      return ok;
    },
    async restore(){
      let ok=false;
      try{ok=!!(await store.restore());}catch(e){console.warn("[PREMIUM] restauration",e);}
      if(ok)setOn(true);
      return ok||isOn();
    }
  };
  window.DGPremium=DGPremium;
  if(document.body)apply();else document.addEventListener("DOMContentLoaded",apply);
})();
