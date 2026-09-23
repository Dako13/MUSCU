'use strict';
window.DKOCloudUI=(()=>{
  let client=null,cloud=null,loading=false,authBusy=false,notice='',returnPending=false;
  const config=window.DKO_SUPABASE_CONFIG||{};
  // Only a publishable key is accepted. Admin and legacy JWT secrets stay out of the browser.
  const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url||'')&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey||'');
  function read(){
    return DKO_DATA.cloud({schema:1,programs:PROGRAMS,activeId:ACTIVE_PID,workouts:DB.workouts,active:DB.active,settings:SETTINGS,body:BODY});
  }
  async function restore(payload,current,link,committed){
    if(DB.active||route.view==='edit')throw new Error('Finish the current session or editor first');
    if(!STORAGE_WRITABLE||sheet.dataset.importing)return false;
    sheet.dataset.importing='1';
    const before=storageSnapshot();
    try{
      const recovery={...before,data:{...before.data,
        [KEY_PROGRAMS]:JSON.stringify({programs:PROGRAMS,activeId:ACTIVE_PID}),
        [KEY]:JSON.stringify(DB),[KEY_SETTINGS]:JSON.stringify(SETTINGS),[KEY_BODY]:JSON.stringify(BODY)}};
      if(!await idbSet('before-cloud-restore',recovery))return false;
      current();
      const next={
        [KEY_PROGRAMS]:JSON.stringify({programs:payload.programs,activeId:payload.activeId}),
        [KEY]:JSON.stringify({workouts:payload.workouts,active:payload.active,migrated:true}),
        [KEY_SETTINGS]:JSON.stringify(payload.settings),[KEY_BODY]:JSON.stringify(payload.body),
        dko_cloud_link:JSON.stringify(link)
      };
      try{writeLocalBatch(next)}catch(e){return false;}
      window.DKOCoachUI?.restored();
      committed();
      clearInterval(tInt);tInt=null;tbar.classList.remove('on','fin');releaseWake();
      loadProgram();DB=loadDB();SETTINGS=loadSettings();BODY=loadBody();
      applyTheme();go('home');
      const timer=DB.active?.restTimer;
      if(timer&&timer.end>Date.now())startTimer(timer.label,(timer.end-Date.now())/1000);
      else if(timer){delete DB.active.restTimer;persist();}
      await mirrorSnapshot();return true;
    }finally{delete sheet.dataset.importing;}
  }
  function statusText(s){
    if(s.message)return s.message;
    if(s.mismatch)return 'Compte différent de celui des données locales';
    return s.enabled?'Sauvegarde automatique activée':'Sauvegarde automatique non activée';
  }
  function update(){
    refreshBadge();
    window.DKOCoachUI?.accountChanged();
    if(!sheet.classList.contains('on')||!document.getElementById('cloudPanel'))return;
    const s=cloud?.state();
    if(document.getElementById('cloudGoogle')&&!s?.user){
      document.getElementById('cloudNotice').textContent=notice;
      document.getElementById('cloudGoogle').disabled=authBusy;return;
    }
    show();
  }
  function refreshBadge(){
    const badge=document.getElementById('cloudStatus');if(!badge)return;
    const s=cloud?.state();let label='Sur cet appareil uniquement';
    if(!STORAGE_WRITABLE)label='Sauvegarde locale impossible';
    else if(loading)label='Vérification de la sauvegarde';
    else if(s?.mismatch||s?.phase==='conflict')label='Sauvegarde : action nécessaire';
    else if(s?.enabled){
      if(!navigator.onLine)label='Hors ligne · copie locale';
      else if(s.phase==='error')label='Sauvegarde en ligne indisponible';
      else if(s.phase==='saving')label='Sauvegarde en cours';
      else if(s.pending)label='Modifications locales · en attente';
      else if(s.phase==='saved')label='Sauvegardé en ligne';
      else label='Vérification de la sauvegarde';
    }
    badge.textContent=label;
    badge.dataset.saved=String(STORAGE_WRITABLE&&s?.enabled&&s.phase==='saved'&&!s.pending&&navigator.onLine);
  }
  function show(){
    const s=cloud?.state(),disabled=s?.busy?' disabled':'';
    let content='<h2>Compte et sauvegarde</h2><div id="cloudPanel">';
    if(!configured){
      content+='<p>Le cloud n’est pas encore activé pour Dko.</p><p class="sp">Tes données restent sur cet appareil. La sauvegarde fichier reste disponible.</p>';
    }else if(loading){
      content+='<p role="status">Connexion au service…</p>';
    }else if(!client){
      content+='<p>Service indisponible. Rouvre l’application pour réessayer.</p>';
    }else if(!s?.user){
      content+='<p>Ton suivi, dans ton espace privé.</p>'
        +'<div class="sbtns"><button class="sbtn pri" id="cloudGoogle"'+(authBusy?' disabled':'')+'>Continuer avec Google</button></div>'
        +'<div class="sbtns"><button class="sbtn" id="cloudSkip">Continuer sans compte</button></div>'
        +'<p class="sp">Tes données restent sur cet appareil. La sauvegarde en ligne sera proposée après la connexion.</p>';
    }else{
      content+='<p class="cloud-email">'+esc(s.user.email||'Compte connecté')+'</p>'
        +'<p role="status">'+esc(statusText(s))+'</p>'
        +(s.lastSync?'<p class="sp">Dernière sauvegarde : '+esc(new Date(s.lastSync).toLocaleString('fr-FR'))+'</p>':'')
        +'<p class="sp">Programmes, séances, ressentis, profil et mensurations sont sauvegardés sur Supabase dans ton espace privé. La déconnexion conserve les données sur cet appareil.</p>';
      if(!s.mismatch){
        content+='<div class="sbtns"><button class="sbtn pri" id="cloudSave"'+disabled+'>'+(s.enabled?'Sauvegarder maintenant':'Activer la sauvegarde automatique')+'</button>'
          +(s.enabled?'<button class="sbtn" id="cloudPause"'+disabled+'>Désactiver</button>':'')+'</div>';
      }else content+='<p class="sp">Reconnecte le compte d’origine, ou restaure la sauvegarde de ce compte. Aucun envoi des données locales vers un autre compte.</p>';
      content+='<div class="sbtns"><button class="sbtn" id="cloudInspect"'+disabled+'>Consulter la sauvegarde en ligne</button></div>';
      if(s.remote){
        content+='<div class="rectitle">En ligne</div><p>'+s.remote.workouts+' séances · '+s.remote.programs+' programmes</p><p class="sp">'+esc(new Date(s.remote.updated_at).toLocaleString('fr-FR'))+'</p>'
          +'<div class="sbtns"><button class="sbtn" id="cloudRestore"'+disabled+'>Restaurer sur cet appareil</button><button class="sbtn" id="cloudRemoteExport"'+disabled+'>Exporter la copie en ligne</button>'
          +(s.phase==='conflict'&&!s.mismatch?'<button class="sbtn danger" id="cloudReplace"'+disabled+'>Remplacer la copie en ligne</button>':'')+'</div>';
      }
      content+='<div class="sbtns"><button class="sbtn" id="cloudSignOut"'+disabled+'>Se déconnecter</button></div>';
    }
    content+='<p class="sp" id="cloudNotice" role="status">'+esc(notice)+'</p>'
      +'<div class="sbtns"><button class="sbtn" id="cloudExport">'+uiIcon('database')+'Exporter mes données locales</button></div>'
      +'<div class="sbtns"><button class="sbtn" id="cloudRecovery">Exporter la copie avant restauration</button></div></div>';
    sheet.innerHTML=content;openSheet();
    document.getElementById('cloudExport').onclick=downloadBackup;
    document.getElementById('cloudRecovery').onclick=exportRecovery;
    const bind=(id,fn)=>{const el=document.getElementById(id);if(el)el.onclick=fn;};
    bind('cloudGoogle',signIn);
    bind('cloudSkip',()=>{rememberWelcome();closeSheet();});
    bind('cloudSave',()=>{
      if(!s.enabled&&!window.confirm('Activer la sauvegarde de tes données Dko sur ce compte Supabase ?'))return;
      notice='';cloud.sync({enable:true});
    });
    bind('cloudInspect',()=>cloud.inspect());
    bind('cloudRemoteExport',()=>{
      const p=cloud.remotePayload();if(!p)return;
      downloadJSON({app:'dako',version:7,programmes:p.programs,programme_actif:p.activeId,seances:p.workouts,active:p.active,reglages:p.settings,bilan_forme:p.body},'dko-cloud.json');
    });
    bind('cloudPause',()=>cloud.pause());
    bind('cloudSignOut',()=>cloud.signOut());
    bind('cloudRestore',()=>{
      if(DB.active||route.view==='edit'){notice='Termine la séance ou l’édition en cours avant de restaurer.';update();return;}
      if(window.confirm('Remplacer les données de cet appareil par la sauvegarde en ligne ? Une copie locale de sécurité sera conservée.'))cloud.restoreRemote();
    });
    bind('cloudReplace',()=>{
      if(window.confirm('Remplacer la sauvegarde en ligne par les données de cet appareil ? Les changements des autres appareils ne seront pas fusionnés. Exporte les deux versions avant de continuer.'))cloud.sync({enable:true,overwrite:true});
    });
  }
  function rememberWelcome(){try{localStorage.setItem('dko_cloud_welcome','1');}catch{}}
  function offer(){
    if(!configured||loading||!cloud||!STORAGE_READY||DB.active||route.view==='edit'||sheet.classList.contains('on'))return;
    let seen=true;try{seen=!!localStorage.getItem('dko_cloud_welcome');}catch{}
    if(returnPending||(!cloud.state().user&&!seen)){
      returnPending=false;rememberWelcome();show();
    }
  }
  async function signIn(){
    if(authBusy)return;
    if(DB.active||route.view==='edit'){notice='Termine la séance ou l’édition en cours avant de te connecter.';update();return;}
    if(!STORAGE_WRITABLE||!navigator.onLine){notice='Connexion indisponible. Tes données restent sur cet appareil.';update();return;}
    authBusy=true;notice='Ouverture de Google…';update();rememberWelcome();
    try{
      await mirrorSnapshot();
      const {error}=await client.auth.signInWithOAuth({provider:'google',options:{
        redirectTo:new URL('./',location.href).href,
        queryParams:{prompt:'select_account'}
      }});
      if(error)throw error;
    }catch{notice='Connexion indisponible. Réessaie plus tard.';}
    finally{authBusy=false;update();}
  }
  async function exportRecovery(){
    const snap=await idbGet('before-cloud-restore');
    if(!snap?.data){notice='Aucune copie avant restauration sur cet appareil.';update();return;}
    try{
      const db=JSON.parse(snap.data[KEY]),ps=JSON.parse(snap.data[KEY_PROGRAMS]);
      const payload={app:'dako',version:7,programmes:ps.programs,programme_actif:ps.activeId,seances:db.workouts,active:db.active,
        reglages:JSON.parse(snap.data[KEY_SETTINGS]),bilan_forme:JSON.parse(snap.data[KEY_BODY]||'[]')};
      downloadJSON(payload,'dko-avant-restauration.json');
    }catch{notice='Copie de sécurité illisible.';update();}
  }
  function downloadJSON(payload,name){
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  async function init(){
    if(!configured||cloud)return;
    loading=true;
    try{
      // Exchange PKCE codes explicitly so errors never replace local data or stay in the URL.
      const callback=new URL(location.href),fragment=new URLSearchParams(callback.hash.slice(1));
      const code=callback.searchParams.get('code');
      const failed=callback.searchParams.has('error')||fragment.has('error');
      returnPending=!!code||failed;
      if(returnPending){
        for(const key of ['code','error','error_code','error_description'])callback.searchParams.delete(key);
        if(fragment.has('error'))callback.hash='';
        history.replaceState(null,'',callback.pathname+callback.search+callback.hash);
      }
      client=supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'},
        global:{fetch:async(input,init={})=>{
          const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
          try{return await fetch(input,{...init,signal:init.signal||controller.signal});}finally{clearTimeout(timeout);}
        }}});
      if(failed)notice='Connexion annulée ou refusée. Tes données restent sur cet appareil.';
      else if(code){
        const {error}=await client.auth.exchangeCodeForSession(code);
        if(error)notice='Connexion non terminée. Réessaie depuis cette application, sur le même appareil.';
      }
      const store={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>{localStorage.setItem(key,value);mirrorSnapshot();}};
      cloud=DKO_CLOUD.create({client,project:config.url.replace(/\/$/,''),store,read,validate:DKO_DATA.cloud,restore,
        canSync:()=>STORAGE_READY&&STORAGE_WRITABLE&&!sheet.dataset.importing,onChange:update});
      await cloud.init();
    }catch{notice='Service cloud indisponible. Tes données restent locales.';}
    finally{loading=false;update();setTimeout(offer,0);}
  }
  window.addEventListener('online',()=>cloud?.changed());
  window.addEventListener('offline',refreshBadge);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')cloud?.changed();});
  document.addEventListener('app:sheet-closed',()=>setTimeout(offer,0));
  if(STORAGE_READY)init();else document.addEventListener('app:ready',init,{once:true});
  return {show,refreshBadge,coachContext:()=>({client,project:config.url,state:cloud?.state(),loading}),changed:()=>{cloud?.changed();refreshBadge();}};
})();
