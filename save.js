/* ===== DATE GRAVITY : sauvegarde =====
   Le jeu lit et écrit sa partie dans localStorage, de façon synchrone, comme sur le site web.
   Dans l'application, ce localStorage n'est qu'une copie de travail : iOS peut l'effacer quand le
   téléphone manque de place, et il ne suit pas le joueur sur un nouveau téléphone.

   Ici, chaque écriture d'une clé du joueur est recopiée, un instant plus tard, dans le stockage natif
   (plugin Preferences : SharedPreferences sur Android, UserDefaults sur iOS). Les sauvegardes du
   téléphone (Google sur Android, iCloud sur iPhone) emportent ce stockage-là avec elles.
   Au lancement, si le localStorage a perdu la partie et que le stockage natif l'a, on la remet en
   place et on recharge la page une fois.

   Sur le site web, rien ne change : localStorage seul.
     DGSave.native    -> true dans l'application
     DGSave.flush()   -> recopie tout de suite (Promise)
*/
(function(){
  const cap=window.Capacitor;
  // les pages masquent ce qui ne sert que sur le site (html.native .webOnly)
  if(cap&&cap.isNativePlatform&&cap.isNativePlatform())document.documentElement.classList.add("native");
  const Prefs=cap&&cap.isNativePlatform&&cap.isNativePlatform()&&cap.Plugins?cap.Plugins.Preferences:null;
  const BLOB="dg_save_v1";
  const PROGRESS="gravity_cube_player_progress_v2";
  // les clés du joueur : progression, look, réglages, tutoriels vus. Pas l'éditeur ni les essais de niveaux.
  const mine=k=>typeof k==="string"&&/^(dg_|dcg_|gravity_cube_)/.test(k)&&!/^(dg_editor_test|gravity_cube_levels_draft|dg_save_)/.test(k);
  if(!Prefs){window.DGSave={native:false,flush(){return Promise.resolve();}};return;}

  const proto=Storage.prototype, set=proto.setItem, remove=proto.removeItem, clear=proto.clear;
  let timer=0;
  function snapshot(){
    const data={};
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(mine(k))data[k]=localStorage.getItem(k);
    }
    return data;
  }
  function flush(){
    clearTimeout(timer);timer=0;
    try{return Prefs.set({key:BLOB,value:JSON.stringify({t:Date.now(),data:snapshot()})}).catch(e=>console.warn("[SAVE]",e));}
    catch(e){console.warn("[SAVE]",e);return Promise.resolve();}
  }
  // plusieurs écritures d'affilée (fin de niveau) ne font qu'une copie
  function later(){if(!timer)timer=setTimeout(flush,400);}
  proto.setItem=function(k,v){set.call(this,k,v);if(this===localStorage&&mine(k))later();};
  proto.removeItem=function(k){remove.call(this,k);if(this===localStorage&&mine(k))later();};
  proto.clear=function(){clear.call(this);if(this===localStorage)later();};
  // l'application passe en arrière-plan : on ne garde rien en attente
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&timer)flush();});
  window.addEventListener("pagehide",()=>{if(timer)flush();});

  const restored=Prefs.get({key:BLOB}).then(r=>{
    let saved=null;
    try{saved=JSON.parse((r&&r.value)||"null");}catch(e){}
    const data=saved&&saved.data;
    if(!data){flush();return false;} // première ouverture avec la sauvegarde native : on part de ce qu'il y a
    if(localStorage.getItem(PROGRESS)!=null||data[PROGRESS]==null)return false;
    Object.keys(data).forEach(k=>{if(mine(k))set.call(localStorage,k,data[k]);});
    let again=false;
    try{again=sessionStorage.getItem("dg_save_restored")==="1";sessionStorage.setItem("dg_save_restored","1");}catch(e){}
    if(!again)location.reload();
    return true;
  }).catch(e=>{console.warn("[SAVE]",e);return false;});

  window.DGSave={native:true,flush,restored};
})();
