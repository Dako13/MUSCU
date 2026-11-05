const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../MuscuApp');
const server=http.createServer(async(req,res)=>{
  if(req.url==='/supabase-config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.DKO_SUPABASE_CONFIG={};');return;}
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{
    const target=file===root?path.join(root,'index.html'):file;
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');
    res.end(await fs.readFile(target));
  }catch{res.writeHead(404).end();}
});
async function ready(p){
  await p.waitForFunction(()=>typeof STORAGE_READY!=='undefined'&&STORAGE_READY);
  await p.locator('#splash').waitFor({state:'detached'});
}
(async()=>{
  let browser;
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(()=>{localStorage.setItem('dako_onboarded','1');localStorage.setItem('dko_cloud_welcome','1');});
    const url='http://127.0.0.1:'+server.address().port+'/';await p.goto(url);await ready(p);
    const fixture=await p.evaluate(()=>{
      const s=PROGRAM[0],e=s.ex[0];
      DB.workouts=[snapshotWorkout({id:'older',date:'2026-01-01',seance:s.id,dur:60,ex:{[e.id]:[{w:22.5,r:7.5,done:true}]}})];persist();go('seance',s.id);
      window.mirrorCalls=0;mirrorSoon=()=>window.mirrorCalls++;
      return {sid:s.id,other:PROGRAM[1].id,eid:e.id,programs:localStorage.getItem(KEY_PROGRAMS),settings:localStorage.getItem(KEY_SETTINGS),history:JSON.stringify(DB.workouts)};
    });
    const state=()=>p.evaluate(()=>({db:JSON.stringify(DB),stored:localStorage.getItem(KEY),focus:FOCUS_EX,route:JSON.stringify(route)}));
    const reject=()=>p.evaluate(()=>{
      window.originalSetItem=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key===KEY)throw new DOMException('Test quota','QuotaExceededError');return window.originalSetItem.call(this,key,value);};
    });
    const restore=()=>p.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
    const before=await state();await reject();
    for(let attempt=0;attempt<2;attempt++){
      await p.locator('[data-act=start]').click();
      assert.deepEqual(await state(),before);
      assert.equal(await p.evaluate(()=>window.mirrorCalls),0);
    }
    await restore();await p.locator('[data-act=start]').click();
    assert.equal(await p.evaluate(()=>window.mirrorCalls),1);
    assert.deepEqual(await p.evaluate(eid=>DB.active.ex[eid][0],fixture.eid),{w:22.5,r:7.5,done:false});
    await p.evaluate(eid=>{
      DB.active.ex[eid][0]={w:25,r:7.5,done:true,doneElapsedMs:10000,doneAt:Date.now()};
      DB.active.exNotes={[eid]:'Ressenti a conserver'};persist();startTimer('Repos test',180);window.mirrorCalls=0;
    },fixture.eid);
    const running=await state();
    // Repeated start is a no-op for recorded sets, notes, timer and workout ID.
    assert.equal(await p.evaluate(sid=>startWorkout(sid),fixture.sid),true);
    assert.deepEqual(await state(),running);
    assert.equal(await p.evaluate(()=>window.mirrorCalls),0);
    assert.equal(await p.evaluate(()=>!!tInt&&tbar.classList.contains('on')),true);
    p.once('dialog',d=>d.dismiss());
    assert.equal(await p.evaluate(sid=>startWorkout(sid),fixture.other),false);
    assert.deepEqual(await state(),running);
    await reject();
    for(let attempt=0;attempt<2;attempt++){
      p.once('dialog',d=>d.accept());
      assert.equal(await p.evaluate(sid=>startWorkout(sid),fixture.other),false);
      assert.deepEqual(await state(),running);
      assert.equal(await p.evaluate(()=>window.mirrorCalls),0);
      assert.equal(await p.evaluate(()=>!!tInt&&tbar.classList.contains('on')),true);
    }
    await restore();p.once('dialog',d=>d.accept());
    assert.equal(await p.evaluate(sid=>startWorkout(sid),fixture.other),true);
    assert.equal(await p.evaluate(()=>DB.active.seance),fixture.other);
    assert.equal(await p.evaluate(()=>!!tInt||tbar.classList.contains('on')),false);
    assert.equal(await p.evaluate(()=>window.mirrorCalls),1);
    await p.reload();await ready(p);
    assert.equal(await p.evaluate(()=>DB.active.seance),fixture.other);
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.workouts)),fixture.history);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS)),fixture.programs);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_SETTINGS)),fixture.settings);
    const after=await state();
    assert.equal(await p.evaluate(()=>startWorkout('unknown-session')),false);
    assert.equal(await p.evaluate(sid=>{STORAGE_READY=false;try{return startWorkout(sid);}finally{STORAGE_READY=true;}},fixture.sid),false);
    assert.deepEqual(await state(),after);
    const second=await context.newPage();await second.goto(url);await ready(second);
    await second.evaluate(()=>renameProgram(ACTIVE_PID,'Programme recent'));
    await p.locator('#storageConflict').waitFor();
    assert.equal(await p.evaluate(sid=>startWorkout(sid),fixture.sid),false);
    assert.deepEqual(await state(),after);
    assert.deepEqual(errors,[]);
    console.log('PASS: new/replacement workout failure and retry, real start button, repeated start, confirmation, timer/notes/history/settings preservation, reload, invalid session, readiness and cross-tab conflicts.');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
