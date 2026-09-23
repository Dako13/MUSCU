const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const box={};vm.createContext(box);vm.runInContext(fs.readFileSync('MuscuApp/coach-sync.js','utf8')+';this.sync=DKO_COACH_SYNC;',box);
const {decide,create}=box.sync;
(async()=>{
 assert.equal(decide({local:'a',remote:'b',base:null,revision:2}),'conflict');
 assert.equal(decide({local:'a',remote:'b',base:{hash:'a',revision:1},revision:2}),'download');
 assert.equal(decide({local:'b',remote:'a',base:{hash:'a',revision:1},revision:1}),'upload');
 assert.equal(decide({local:'c',remote:'b',base:{hash:'a',revision:1},revision:2}),'conflict');
 assert.equal(decide({local:'a',remote:'b',base:{hash:'a',revision:1},revision:2,blocked:true}),'waiting');
 let local=['a'],remote={code:'code',programs:['a'],revision:1},base=null,blocked=false,acks=0,writes=0,applies=0,wait=null;
 const service=create({read:()=>local,hash:async doc=>JSON.stringify(doc),getBase:()=>base,setBase:v=>base=v,blocked:()=>blocked,
  apply:async(doc,guard)=>{guard();local=doc;applies++;},api:async(action,args)=>{
   if(action==='self'){if(wait)await wait;return structuredClone(remote);}
   if(action==='publish'){if(args.revision!==remote.revision)throw {code:'40001'};remote={...remote,programs:args.programs,revision:remote.revision+1};writes++;return {revision:remote.revision};}
   if(action==='ack')acks++;
  }});
 await service.sync();assert.equal(service.state().phase,'saved');assert.equal(base.revision,1);
 remote.programs=['b'];remote.revision=2;blocked=true;await service.sync();assert.equal(service.state().phase,'waiting');assert.equal(applies,0);
 blocked=false;await service.sync();assert.deepEqual(local,['b']);assert.equal(applies,1);
 local=['c'];await service.sync();assert.equal(writes,1);assert.deepEqual(remote.programs,['c']);
 local=['d'];remote.programs=['e'];remote.revision++;await service.sync();assert.equal(service.state().phase,'conflict');assert.equal(writes,1);
 assert.equal(await service.resolve('remote'),true);assert.deepEqual(local,['e']);
 service.invalidate();local=['f'];await service.sync();assert.equal(service.state().phase,'conflict');
 assert.equal(await service.resolve('local'),true);assert.deepEqual(remote.programs,['f']);
 local=['own-edit'];remote.programs=['later'];remote.revision++;await service.sync();assert.equal(service.state().phase,'conflict');
 let release;wait=new Promise(r=>release=r);const staleResolve=service.resolve('local');blocked=true;release();
 assert.equal(await staleResolve,false,'blocked local state cannot publish after remote read');blocked=false;wait=null;local=['f'];
 remote.programs=['g'];remote.revision++;wait=new Promise(r=>release=r);const pending=service.sync();service.invalidate();release();await pending;
 assert.equal(base,null,'restore invalidates an in-flight read');assert.deepEqual(local,['f']);
 wait=null;await service.sync();assert.equal(service.state().phase,'conflict');
 wait=new Promise(r=>release=r);const signingOut=service.sync();service.dispose();release();await signingOut;assert.deepEqual(local,['f']);
 console.log('PASS coach synchronization: bootstrap, download, upload, conflicts, active-session deferral, explicit resolution, restore and sign-out races.');
})().catch(e=>{console.error(e);process.exitCode=1;});
