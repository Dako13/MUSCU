const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context=vm.createContext({crypto:require('node:crypto').webcrypto,TextEncoder,structuredClone,setTimeout,clearTimeout,navigator:{onLine:true}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../MuscuApp/cloud-sync.js'),'utf8')+'\nglobalThis.factory=DKO_CLOUD;',context);
const {create}=context.factory;
const accounts=new Map(),instances=[];
function device(id,initial={value:'original'},storage=new Map()){
  let authUser={id,email:id+'@example.test'},listener,local=structuredClone(initial),calls=0,fail=false,restoreFails=false,mutateRead=null,allowed=true;
  const client={
    auth:{
      onAuthStateChange(cb){listener=cb;return{data:{subscription:{unsubscribe(){}}}};},
      async getSession(){return{data:{session:authUser?{user:authUser}:null}};},
      async signOut(){authUser=null;listener('SIGNED_OUT',null);return{};}
    },
    from(){return{select(){return this;},eq(){return this;},async maybeSingle(){
      if(fail)throw new Error('network');
      const data=structuredClone(accounts.get(authUser.id)||null);
      if(mutateRead)mutateRead();return{data};
    }};},
    async rpc(_name,{p_payload,p_expected_revision,p_user_id}){
      calls++;if(fail)throw new Error('network');
      if(p_user_id!==authUser.id)return{error:{code:'42501'}};
      const old=accounts.get(authUser.id);
      if((old?.revision||0)!==p_expected_revision)return{error:{code:'40001'}};
      const row={revision:p_expected_revision+1,payload:structuredClone(p_payload),updated_at:new Date().toISOString()};
      accounts.set(authUser.id,row);return{data:{revision:row.revision,updated_at:row.updated_at}};
    }
  };
  const store={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
  const cloud=create({client,project:'test',store,read:()=>structuredClone(local),validate:p=>{
    if(typeof p.value!=='string')throw new Error('invalid');return {programs:[],workouts:[],...structuredClone(p)};
  },restore:async(p,check,next,committed)=>{if(restoreFails)return false;check();local=structuredClone(p);store.setItem('dko_cloud_link',JSON.stringify(next));committed();return true;},canSync:()=>allowed});
  instances.push(cloud);
  return{cloud,storage,get local(){return local;},set(v){local=v;},get calls(){return calls;},fail(v){fail=v;},restoreFails(v){restoreFails=v;},allow(v){allowed=v;},race(fn){mutateRead=fn;},
    account(id){authUser={id,email:id+'@example.test'};listener('SIGNED_IN',{user:authUser});}};
}
(async()=>{
  try{
    const a=device('alice');await a.cloud.init();
    await a.cloud.sync();assert.equal(a.calls,0,'no upload before consent');
    assert(await a.cloud.sync({enable:true}));assert.equal(accounts.get('alice').revision,1);
    a.cloud.changed();assert.equal(a.cloud.state().pending,true);
    await a.cloud.sync();assert.equal(a.calls,1,'unchanged state is not uploaded again');
    assert.equal(a.cloud.state().pending,false);
    const b=device('alice',{value:'new phone'});await b.cloud.init();
    assert.equal(await b.cloud.sync({enable:true}),false);assert.equal(b.cloud.state().phase,'conflict');
    assert.equal(b.calls,0,'fresh device cannot overwrite existing cloud');
    assert(await b.cloud.restoreRemote());assert.equal(b.local.value,'original');
    a.set({value:'edit A'});assert(await a.cloud.sync());
    b.set({value:'edit B'});assert.equal(await b.cloud.sync(),false);assert.equal(b.cloud.state().phase,'conflict');
    assert.equal(accounts.get('alice').payload.value,'edit A');assert.equal(b.local.value,'edit B');
    a.set({value:'newer edit A'});assert(await a.cloud.sync());
    assert.equal(await b.cloud.sync({enable:true,overwrite:true}),false,'stale force overwrite rejected');
    assert.equal(accounts.get('alice').payload.value,'newer edit A');
    await b.cloud.inspect();assert(await b.cloud.sync({enable:true,overwrite:true}));
    assert.equal(accounts.get('alice').payload.value,'edit B');
    b.fail(true);b.set({value:'offline edit'});assert.equal(await b.cloud.sync(),false);
    assert.equal(b.local.value,'offline edit');assert.equal(accounts.get('alice').payload.value,'edit B');
    b.fail(false);assert(await b.cloud.sync());assert.equal(accounts.get('alice').payload.value,'offline edit');
    b.cloud.pause();b.set({value:'paused edit'});const before=b.calls;await b.cloud.sync();assert.equal(b.calls,before);
    const resumed=device('alice',b.local,b.storage);await resumed.cloud.init();await resumed.cloud.sync();assert.equal(resumed.calls,0,'pause persists across reload');
    b.account('bob');assert.equal(await b.cloud.sync({enable:true}),false);assert.equal(b.cloud.state().phase,'wrong-account');
    assert(!accounts.has('bob'),'other account never receives previous account data');
    accounts.set('bob',{revision:1,payload:{value:'bob data'},updated_at:new Date().toISOString()});
    await b.cloud.inspect();b.restoreFails(true);assert.equal(await b.cloud.restoreRemote(),false);assert.equal(b.local.value,'paused edit');
    b.restoreFails(false);assert(await b.cloud.restoreRemote());assert.equal(b.local.value,'bob data');
    b.set({value:'bob edit'});assert(await b.cloud.sync());assert.equal(accounts.get('alice').payload.value,'offline edit');
    await b.cloud.signOut();assert.equal(b.cloud.state().user,null);assert.equal(b.local.value,'bob edit');
    const c=device('charlie');await c.cloud.init();
    c.race(()=>c.account('david'));assert.equal(await c.cloud.sync({enable:true}),false);assert.equal(c.calls,0,'account race cannot upload');
    const bad=device('eve');accounts.set('eve',{revision:1,payload:{bad:true},updated_at:new Date().toISOString()});
    await bad.cloud.init();assert.equal(await bad.cloud.inspect(),false);assert.equal(bad.local.value,'original');
    const during=device('during-save');await during.cloud.init();
    during.race(()=>{during.set({value:'edit during save'});during.cloud.changed();});
    await during.cloud.sync({enable:true});assert.equal(during.cloud.state().pending,true,'new edit must not be marked saved');
    during.race(null);await during.cloud.sync();assert.equal(during.cloud.state().pending,false);
    const stale=device('stale-tab');await stale.cloud.init();
    stale.race(()=>stale.allow(false));
    assert.equal(await stale.cloud.sync({enable:true}),false,'stale tab cannot upload after remote read');
    assert.equal(stale.calls,0);assert.equal(accounts.has('stale-tab'),false);
    console.log('PASS: consent, account isolation, offline retry, reload, conflicts, stale force-save, restore failure, sign-out and auth race.');
  }finally{instances.forEach(c=>c.dispose());}
})().catch(e=>{console.error(e);process.exitCode=1;});
