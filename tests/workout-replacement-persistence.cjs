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
      DB.workouts=[snapshotWorkout({id:'older',date:'2026-01-01',seance:s.id,dur:60,ex:{[e.id]:[{w:22.5,r:7.5,done:true}]}})];persist();go('seance',s.id);startWorkout(s.id);
      DB.active.exNotes={[e.id]:'Isolation correcte <test>'};DB.active.restByEx={[e.id]:90};persist();startTimer('Repos test',180);
      window.originalActive=DB.active;window.mirrorCalls=0;mirrorSoon=()=>window.mirrorCalls++;
      return {sid:s.id,eid:e.id,programs:localStorage.getItem(KEY_PROGRAMS),settings:localStorage.getItem(KEY_SETTINGS),history:JSON.stringify(DB.workouts),active:JSON.stringify(DB.active)};
    });
    const state=()=>p.evaluate(()=>({db:JSON.stringify(DB),stored:localStorage.getItem(KEY),focus:FOCUS_EX}));
    const before=await state();
    await p.locator('.card:visible [data-act=replaceex]').click();
    const choice=p.locator('#sheet .replace-option').first();
    const chosenName=await choice.locator('span').textContent();
    p.once('dialog',d=>d.dismiss());await choice.click();
    assert.deepEqual(await state(),before);assert(await choice.isVisible());
    await p.evaluate(()=>{
      window.originalSetItem=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key===KEY)throw new DOMException('Test quota','QuotaExceededError');return window.originalSetItem.call(this,key,value);};
    });
    for(let attempt=0;attempt<2;attempt++){
      p.once('dialog',d=>d.accept());await choice.click();
      assert.deepEqual(await state(),before);
      assert(await choice.isVisible());
      assert.equal(await p.evaluate(()=>window.mirrorCalls),0);
      assert.equal(await p.evaluate(()=>!!tInt&&tbar.classList.contains('on')),true);
      assert.equal(await p.evaluate(()=>JSON.stringify(window.originalActive)),fixture.active);
    }
    await p.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
    p.once('dialog',d=>d.accept());await choice.click();
    assert.equal(await p.evaluate(()=>window.mirrorCalls),1);
    assert.equal(await p.evaluate(()=>JSON.stringify(window.originalActive)),fixture.active);
    assert.equal(await p.evaluate(()=>!!tInt&&tbar.classList.contains('on')),true);
    const replacement=await p.evaluate(()=>DB.active.exerciseOrder[0]);
    assert.notEqual(replacement,fixture.eid);
    assert.equal(await p.locator('.card:visible').getAttribute('data-ex'),replacement);
    await p.reload();await ready(p);
    assert.equal(await p.evaluate(()=>DB.active.exerciseOrder[0]),replacement);
    assert.equal(await p.evaluate(id=>workoutExercise(DB.active,id).name,replacement),chosenName);
    assert.equal(await p.evaluate(id=>DB.active.exNotes[id],replacement),'Isolation correcte <test>');
    assert.equal(await p.evaluate(id=>DB.active.restByEx[id],replacement),90);
    assert.equal(await p.evaluate(id=>[DB.active.ex,DB.active.exMeta,DB.active.exNotes,DB.active.restByEx].every(map=>!Object.hasOwn(map,id)),fixture.eid),true);
    assert.deepEqual(await p.evaluate(id=>DB.active.ex[id],replacement),JSON.parse(fixture.active).ex[fixture.eid].map(()=>({w:null,r:null,done:false})));
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.workouts)),fixture.history);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS)),fixture.programs);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_SETTINGS)),fixture.settings);
    // Completed sets cannot be replaced, and a stale picker cannot overwrite newer data.
    await p.evaluate(id=>{DB.active.ex[id][0]={w:20,r:8,done:true};persist();},replacement);
    const validated=await state();
    assert.equal(await p.evaluate(id=>replaceActiveExercise(id,replacementCandidates(activeExercise(id))[0]),replacement),false);
    assert.deepEqual(await state(),validated);
    await p.evaluate(id=>{DB.active.ex[id][0]={w:null,r:null,done:false};persist();showReplaceExercise(id);},replacement);
    const second=await context.newPage();await second.goto(url);await ready(second);
    await second.evaluate(()=>renameProgram(ACTIVE_PID,'Programme recent'));
    await p.locator('#storageConflict').waitFor();
    const stale=await state();
    await p.evaluate(()=>document.querySelector('#sheet .replace-option').click());
    assert.deepEqual(await state(),stale);
    assert(await p.locator('#sheet .replace-option').first().isVisible());
    assert.deepEqual(errors,[]);
    console.log('PASS: replacement failure/retry, retained picker and source references, cancellation, notes/rest transfer, running timer, reload, history/program/settings preservation, validated sets and cross-tab conflicts.');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
