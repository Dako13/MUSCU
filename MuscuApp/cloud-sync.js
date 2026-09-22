'use strict';
/* One private snapshot per account, with optimistic concurrency on the server.
   Downloads never replace local data without an explicit restore. */
const DKO_CLOUD=(()=>{
  const LINK_KEY='dko_cloud_link';
  const canonical=v=>JSON.stringify(sort(v));
  function sort(v){
    if(Array.isArray(v))return v.map(sort);
    if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));
    return v;
  }
  async function fingerprint(payload){
    const bytes=new TextEncoder().encode(canonical(payload));
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
  }
  function create({client,project,store,read,validate,restore,canSync,onChange=()=>{}}){
    let user=null,link={},remote=null,busy=false,epoch=0,timer=null,disposed=false;
    let phase='signed-out',message='',lastSync=null,authSubscription;
    let changeCounter=0,savedCounter=0;
    try{link=JSON.parse(store.getItem(LINK_KEY))||{};}catch{}
    const owner=()=>user?project+'|'+user.id:null;
    const bound=()=>!!user&&link.owner===owner();
    const mismatch=()=>!!link.owner&&!!user&&!bound();
    const state=()=>({user:user?{id:user.id,email:user.email}:null,phase,message,busy,pending:changeCounter!==savedCounter,
      enabled:bound()&&!!link.enabled,mismatch:mismatch(),lastSync,
      remote:remote?{revision:remote.revision,updated_at:remote.updated_at,
        workouts:remote.payload.workouts.length,programs:remote.payload.programs.length}:null});
    function emit(){if(!disposed)onChange(state());}
    function save(next){store.setItem(LINK_KEY,JSON.stringify(next));link=next;lastSync=next.lastSync||null;}
    function fail(e){
      if(e?.code==='40001'){phase='conflict';message='Une autre sauvegarde a changé. Aucune donnée écrasée.';}
      else{phase='error';message=navigator.onLine===false?'Hors ligne · sauvegarde en attente':'Sauvegarde indisponible · données conservées sur cet appareil';}
    }
    function schedule(delay=2500){
      clearTimeout(timer);
      if(disposed||!bound()||!link.enabled||phase==='conflict')return;
      timer=setTimeout(()=>sync(),delay);
    }
    async function operation(action,quiet=false){
      if(busy||!user||disposed)return false;
      const before=JSON.stringify(state());
      busy=true;if(!quiet)emit();const ticket=epoch;
      const current=()=>{if(disposed||ticket!==epoch)throw new Error('Account changed');};
      try{return await action(current);}
      catch(e){if(ticket===epoch)fail(e);return false;}
      finally{busy=false;if(!quiet||JSON.stringify(state())!==before)emit();if(bound()&&link.enabled&&phase!=='conflict')schedule(30000);}
    }
    async function fetchRemote(current){
      const {data,error}=await client.from('dko_backups').select('revision,payload,updated_at').eq('user_id',user.id).maybeSingle();
      current();if(error)throw error;
      if(data){
        if(!Number.isSafeInteger(data.revision)||data.revision<1)throw new Error('Invalid revision');
        data.payload=validate(data.payload);
      }
      remote=data;return data;
    }
    async function sync({enable=false,overwrite=false}={}){
      return operation(async current=>{
        if(mismatch()){phase='wrong-account';message='Ces données locales sont liées à un autre compte. Aucun envoi autorisé.';return false;}
        if(!canSync()){phase='waiting';message='Sauvegarde en attente';return false;}
        if(!enable&&(!bound()||!link.enabled))return false;
        if(phase==='conflict'&&!enable&&!overwrite)return false;
        const revisionAtRead=changeCounter,local=validate(read()),hash=await fingerprint(local);current();
        if(!enable&&!overwrite&&bound()&&hash===link.hash){savedCounter=revisionAtRead;phase='saved';message='Sauvegarde à jour';return true;}
        phase='saving';message='Sauvegarde en cours';emit();
        // A force-save uses the revision actually shown in the conflict dialog.
        const expected=overwrite?remote?.revision:null;
        const row=overwrite?remote:await fetchRemote(current);
        if(overwrite&&expected==null)throw new Error('No reviewed revision');
        const revision=row?.revision||0;
        if(row&&await fingerprint(row.payload)===hash){
          current();save({owner:owner(),revision,hash,enabled:true,lastSync:row.updated_at});
          savedCounter=revisionAtRead;
          phase='saved';message='Sauvegarde à jour';return true;
        }
        current();
        if(!overwrite&&revision!==(bound()?link.revision:0)){
          phase='conflict';message='Une sauvegarde différente existe en ligne. Choisis laquelle conserver.';return false;
        }
        const {data,error}=await client.rpc('dko_save_backup',{p_payload:local,p_expected_revision:revision,p_user_id:user.id});
        current();if(error)throw error;
        if(!data||!Number.isSafeInteger(data.revision))throw new Error('Invalid save response');
        save({owner:owner(),revision:data.revision,hash,enabled:true,lastSync:data.updated_at});
        savedCounter=revisionAtRead;
        remote={...data,payload:local};phase='saved';message='Sauvegarde à jour';
        return true;
      },!enable&&!overwrite);
    }
    async function inspect(){
      return operation(async current=>{
        await fetchRemote(current);
        phase=mismatch()?'wrong-account':'ready';message=remote?'Sauvegarde disponible':'Aucune sauvegarde en ligne';
        return true;
      });
    }
    async function restoreRemote(){
      return operation(async current=>{
        if(!canSync()||!remote)return false;
        const reviewed=remote;
        const latest=await fetchRemote(current);
        if(!latest||latest.revision!==reviewed.revision){phase='conflict';message='La sauvegarde a changé. Vérifie sa nouvelle date avant de restaurer.';return false;}
        const payload=validate(latest.payload),hash=await fingerprint(payload);current();
        // The app adapter creates a durable recovery copy before replacing data.
        const next={owner:owner(),revision:latest.revision,hash,enabled:true,lastSync:latest.updated_at};
        // Update the in-memory binding at the same point as the local data commit,
        // before any awaited UI/mirror work can deliver an auth-change event.
        if(!await restore(payload,current,next,()=>{link=next;lastSync=next.lastSync;}))throw new Error('Restore failed');
        current();save(next);
        savedCounter=changeCounter;
        phase='saved';message='Sauvegarde restaurée';return true;
      });
    }
    function setUser(next){
      if(next?.id===user?.id)return;
      epoch++;clearTimeout(timer);user=next;remote=null;
      lastSync=bound()?link.lastSync||null:null;
      phase=!user?'signed-out':mismatch()?'wrong-account':bound()&&link.enabled?'ready':'consent';message='';emit();
      if(bound()&&link.enabled)schedule(1000);
    }
    async function init(){
      const {data}=client.auth.onAuthStateChange((_event,session)=>setUser(session?.user||null));
      authSubscription=data.subscription;
      const {data:sessionData,error}=await client.auth.getSession();
      if(error){fail(error);emit();return;}
      setUser(sessionData.session?.user||null);emit();
    }
    function pause(){
      if(busy)return;
      clearTimeout(timer);if(bound())save({...link,enabled:false});
      phase='paused';message='Sauvegarde automatique désactivée';emit();
    }
    async function signOut(){
      if(busy)return;
      pause();const {error}=await client.auth.signOut({scope:'local'});
      if(error){fail(error);emit();return;}
      setUser(null);
    }
    function dispose(){disposed=true;epoch++;clearTimeout(timer);authSubscription?.unsubscribe();}
    return {init,state,sync,inspect,restoreRemote,pause,signOut,changed:()=>{changeCounter++;schedule();emit();},dispose,
      remotePayload:()=>user&&remote?structuredClone(remote.payload):null};
  }
  return {create,fingerprint};
})();
