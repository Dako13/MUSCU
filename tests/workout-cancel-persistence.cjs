const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
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
      DB.workouts=[snapshotWorkout({id:'older',date:'2026-01-01',seance:s.id,dur:60,ex:{[e.id]:[{w:10,r:8,done:true}]}})];persist();
      startWorkout(s.id);go('seance',s.id);
      DB.active.ex[e.id][0]={w:22.5,r:7.5,done:true,doneElapsedMs:30000,doneAt:Date.now()};
      DB.active.exNotes={[e.id]:'Bonne isolation <test>'};persist();startTimer('Repos test',180);
      window.mirrorCalls=0;mirrorSoon=()=>window.mirrorCalls++;
      return {db:JSON.stringify(DB),stored:localStorage.getItem(KEY),active:JSON.stringify(DB.active),programs:localStorage.getItem(KEY_PROGRAMS),settings:localStorage.getItem(KEY_SETTINGS),history:JSON.stringify(DB.workouts)};
    });
    const reject=()=>p.evaluate(()=>{
      window.originalSetItem=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key===KEY)throw new DOMException('Test quota','QuotaExceededError');return window.originalSetItem.call(this,key,value);};
    });
    const restore=()=>p.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
    await reject();
    for(let attempt=0;attempt<2;attempt++){
      await p.evaluate(()=>cancelWorkout());
      assert.equal(await p.evaluate(()=>JSON.stringify(DB)),fixture.db);
      assert.equal(await p.evaluate(()=>localStorage.getItem(KEY)),fixture.stored);
      assert.equal(await p.evaluate(()=>window.mirrorCalls),0);
      assert.equal(await p.evaluate(()=>route.view),'seance');
      assert.equal(await p.evaluate(()=>!!tInt&&tbar.classList.contains('on')),true);
    }
    await restore();await p.evaluate(()=>cancelWorkout());
    assert.equal(await p.evaluate(()=>DB.active),null);
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(KEY)).active),null);
    assert.equal(await p.evaluate(()=>!!tInt||tbar.classList.contains('on')),false);
    assert.equal(await p.evaluate(()=>window.mirrorCalls),1);
    const cancelled=await p.evaluate(()=>localStorage.getItem(KEY));
    await p.setViewportSize({width:320,height:740});
    await p.waitForFunction(()=>getComputedStyle(document.getElementById('toast')).opacity==='1');
    await p.screenshot({path:path.join(os.tmpdir(),'dko-cancel-mobile.png')});
    const buttonBox=await p.locator('#_undo').boundingBox();
    assert(buttonBox.height>=43.9&&buttonBox.x>=0&&buttonBox.x+buttonBox.width<=320,JSON.stringify(buttonBox));
    await reject();
    for(let attempt=0;attempt<2;attempt++){
      await p.locator('#_undo').click();
      assert.equal(await p.evaluate(()=>DB.active),null);
      assert.equal(await p.evaluate(()=>localStorage.getItem(KEY)),cancelled);
      assert.equal(await p.evaluate(()=>window.mirrorCalls),1);
      assert(await p.locator('#_undo').isVisible());
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    }
    await p.screenshot({path:path.join(os.tmpdir(),'dko-cancel-retry-mobile.png')});
    await p.setViewportSize({width:1280,height:900});
    await p.screenshot({path:path.join(os.tmpdir(),'dko-cancel-retry-desktop.png')});
    await restore();await p.locator('#_undo').click();
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.active)),fixture.active);
    assert.equal(await p.evaluate(()=>window.mirrorCalls),2);
    await p.reload();await ready(p);
    // Reload may refresh the rest timer timestamp; all workout content must survive.
    assert.equal(await p.evaluate(()=>{const a={...DB.active};delete a.restTimer;return JSON.stringify(a);}),JSON.stringify((({restTimer,...a})=>a)(JSON.parse(fixture.active))));
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.workouts)),fixture.history);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS)),fixture.programs);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_SETTINGS)),fixture.settings);

    // An old Undo button cannot replace a newly started workout.
    await p.evaluate(()=>{cancelWorkout();window.oldUndo=document.getElementById('_undo');startWorkout(PROGRAM[0].id);});
    const newer=await p.evaluate(()=>({active:JSON.stringify(DB.active),stored:localStorage.getItem(KEY)}));
    await p.evaluate(()=>window.oldUndo.click());
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.active)),newer.active);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY)),newer.stored);

    // Refuse cancellation and restoration when another tab has newer data.
    const second=await context.newPage();await second.goto(url);await ready(second);
    await second.evaluate(()=>renameProgram(ACTIVE_PID,'Programme recent'));
    await p.locator('#storageConflict').waitFor();
    await p.evaluate(()=>cancelWorkout());
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.active)),newer.active);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY)),newer.stored);
    await second.close();await p.reload();await ready(p);
    await p.evaluate(()=>{cancelWorkout();window.conflictUndo=document.getElementById('_undo');clearTimeout(document.getElementById('toast')._h);});
    const third=await context.newPage();await third.goto(url);await ready(third);
    await third.evaluate(()=>renameProgram(ACTIVE_PID,'Encore plus recent'));
    await p.locator('#storageConflict').waitFor();
    await p.evaluate(()=>window.conflictUndo.click());
    assert.equal(await p.evaluate(()=>DB.active),null);
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(KEY)).active),null);
    assert.deepEqual(errors,[]);
    console.log('PASS: cancellation/undo failure and retry, active workout/timer preservation, reload, history/settings/program preservation, newer workout protection and cross-tab conflicts.');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
