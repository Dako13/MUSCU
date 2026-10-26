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
    const p=await context.newPage(),errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(()=>{localStorage.setItem('dako_onboarded','1');localStorage.setItem('dko_cloud_welcome','1');});
    const url='http://127.0.0.1:'+server.address().port+'/';
    await p.goto(url);await ready(p);
    const fixture=await p.evaluate(()=>{
      const sid=PROGRAM[0].id,pid=ACTIVE_PID,e=PROGRAM[0].ex[0];
      DB.workouts=[snapshotWorkout({date:todayISO(),seance:sid,ex:{[e.id]:[{w:20,r:8,done:true}]},exNotes:{[e.id]:'Historique conserve'}})];persist();
      const other=createProgram('Programme secondaire',true);setActiveProgram(pid);go('programs');
      return {sid,pid,other,history:JSON.stringify(DB.workouts),settings:JSON.stringify(SETTINGS),programs:JSON.stringify(PROGRAMS),stored:localStorage.getItem(KEY_PROGRAMS)};
    });
    const unchanged=async()=>{
      assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),fixture.programs);
      assert.equal(await p.evaluate(()=>ACTIVE_PID),fixture.pid);
      assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS)),fixture.stored);
      assert.equal(await p.evaluate(()=>JSON.stringify(DB.workouts)),fixture.history);
      assert.equal(await p.evaluate(()=>JSON.stringify(SETTINGS)),fixture.settings);
    };
    const remove=pid=>p.locator('[data-act=pdel][data-p="'+pid+'"]');
    p.once('dialog',d=>d.dismiss());await remove(fixture.pid).click();await unchanged();
    await p.evaluate(()=>showSettings());
    p.once('dialog',d=>d.dismiss());await p.locator('#setReset').click();await unchanged();
    await p.evaluate(()=>closeSheet());
    await p.evaluate(()=>{
      window.originalSetItem=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key===KEY_PROGRAMS)throw new DOMException('Test quota','QuotaExceededError');return window.originalSetItem.call(this,key,value);};
      window.mirrorCalls=0;window.originalMirrorSoon=mirrorSoon;mirrorSoon=()=>window.mirrorCalls++;
    });
    for(const pid of [fixture.pid,fixture.other]){
      p.once('dialog',d=>d.accept());await remove(pid).click();await unchanged();
      assert(await remove(pid).isVisible());
      assert.match(await p.locator('#toast').textContent(),/Modification non enregistrée/);
    }
    await p.evaluate(()=>showSettings());
    p.once('dialog',d=>d.accept());await p.locator('#setReset').click();await unchanged();
    assert(await p.locator('#setReset').isVisible(),'failed reset must keep settings open');
    assert.equal(await p.evaluate(()=>window.mirrorCalls),0);
    await p.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;mirrorSoon=window.originalMirrorSoon;closeSheet();});

    await p.evaluate(sid=>startWorkout(sid),fixture.sid);
    const active=await p.evaluate(()=>JSON.stringify(DB.active));
    assert.equal(await p.evaluate(pid=>deleteProgram(pid),fixture.pid),false);
    assert.equal(await p.evaluate(()=>resetProgram()),false);
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.active)),active);
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),fixture.programs);
    await p.evaluate(()=>{DB.active=null;persist();go('programs');});
    p.once('dialog',d=>d.accept());await remove(fixture.pid).click();
    assert.equal(await p.evaluate(()=>ACTIVE_PID),fixture.other);
    assert.equal(await p.evaluate(()=>PROGRAMS.length),1);
    assert.equal(await p.evaluate(()=>deleteProgram(ACTIVE_PID)),false,'last program must be retained');
    await p.reload();await ready(p);
    assert.equal(await p.evaluate(()=>ACTIVE_PID),fixture.other);
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.workouts)),fixture.history);
    assert.equal(await p.evaluate(()=>JSON.stringify(SETTINGS)),fixture.settings);

    const untouched=await p.evaluate(()=>{const active=ACTIVE_PID,id=createProgram('Autre programme intact',true);setActiveProgram(active);return {id,program:JSON.stringify(PROGRAMS.find(p=>p.id===id))};});
    const oldIds=await p.evaluate(()=>PROGRAM.flatMap(s=>[s.id,...s.ex.map(e=>e.id)]));
    await p.evaluate(()=>showSettings());p.once('dialog',d=>d.accept());await p.locator('#setReset').click();
    assert.equal(await p.evaluate(()=>route.view),'home');
    const newIds=await p.evaluate(()=>PROGRAM.flatMap(s=>[s.id,...s.ex.map(e=>e.id)]));
    assert(newIds.length>0&&newIds.every(id=>!oldIds.includes(id)));
    assert.equal(new Set(newIds).size,newIds.length);
    await p.reload();await ready(p);
    assert.deepEqual(await p.evaluate(()=>PROGRAM.flatMap(s=>[s.id,...s.ex.map(e=>e.id)])),newIds);
    assert.equal(await p.evaluate(id=>JSON.stringify(PROGRAMS.find(p=>p.id===id)),untouched.id),untouched.program);
    assert.equal(await p.evaluate(id=>deleteProgram(id),untouched.id),true);
    assert.equal(await p.evaluate(()=>ACTIVE_PID),fixture.other,'deleting an inactive program must retain the selection');
    await p.evaluate(()=>{SETTINGS.programOrigin='neutral';saveSettings();});
    assert.equal(await p.evaluate(()=>resetProgram()),true);
    await p.reload();await ready(p);
    assert.equal(await p.evaluate(()=>PROGRAM.length),0);
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.workouts)),fixture.history);

    await p.evaluate(()=>createProgram('Troisieme programme',true));
    const beforeConflict=await p.evaluate(()=>({programs:JSON.stringify(PROGRAMS),pid:ACTIVE_PID}));
    const second=await context.newPage();await second.goto(url);await ready(second);
    const newer=await second.evaluate(()=>{renameProgram(ACTIVE_PID,'Nom depuis autre onglet');return localStorage.getItem(KEY_PROGRAMS);});
    await p.locator('#storageConflict').waitFor();
    assert.equal(await p.evaluate(()=>deleteProgram(ACTIVE_PID)),false);
    assert.equal(await p.evaluate(()=>resetProgram()),false);
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),beforeConflict.programs);
    assert.equal(await p.evaluate(()=>ACTIVE_PID),beforeConflict.pid);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS)),newer);
    assert.deepEqual(errors,[]);
    console.log('PASS: deletion/reset cancellation, quota failure preservation, active/last program protection, successful deletion and legacy/neutral reset, reload, history/settings and cross-tab protection.');
  }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
