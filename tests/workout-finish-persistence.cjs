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
    const url='http://127.0.0.1:'+server.address().port+'/';
    for(const automatic of [false,true]){
      const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
      const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
      await p.addInitScript(()=>{localStorage.setItem('dako_onboarded','1');localStorage.setItem('dko_cloud_welcome','1');});
      await p.goto(url);await ready(p);
      const fixture=await p.evaluate(()=>{
        const s=PROGRAM[0],e=s.ex[0];
        DB.workouts=[snapshotWorkout({id:'older',date:'2026-01-01',seance:s.id,dur:60,ex:{[e.id]:[{w:10,r:8,done:true}]}})];persist();
        startWorkout(s.id);go('seance',s.id);
        DB.active.start=Date.now()-60000;
        DB.active.ex[e.id][0]={w:22.5,r:7.5,done:true,doneElapsedMs:30000,doneAt:Date.now()-30000};
        DB.active.exNotes={[e.id]:'Bonne isolation <test>'};persist();startTimer(180,'Repos test');
        return {db:JSON.stringify(DB),stored:localStorage.getItem(KEY),programs:localStorage.getItem(KEY_PROGRAMS),settings:localStorage.getItem(KEY_SETTINGS),id:DB.active.id,eid:e.id,endedAt:DB.active.ex[e.id][0].doneAt,older:JSON.stringify(DB.workouts[0])};
      });
      await p.evaluate(()=>{
        window.originalSetItem=Storage.prototype.setItem;
        Storage.prototype.setItem=function(key,value){if(key===KEY)throw new DOMException('Test quota','QuotaExceededError');return window.originalSetItem.call(this,key,value);};
        window.mirrorCalls=0;mirrorSoon=()=>window.mirrorCalls++;
      });
      for(let attempt=0;attempt<2;attempt++){
        assert.equal(await p.evaluate(automatic=>finishWorkout({automatic}),automatic),false);
        assert.equal(await p.evaluate(()=>JSON.stringify(DB)),fixture.db);
        assert.equal(await p.evaluate(()=>localStorage.getItem(KEY)),fixture.stored);
        assert.equal(await p.evaluate(()=>window.mirrorCalls),0);
        assert.equal(await p.evaluate(()=>!!tInt&&tbar.classList.contains('on')),true);
      }
      // A retry must work without resetting the sticky storage warning flag.
      await p.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
      assert.equal(await p.evaluate(()=>STORAGE_WRITABLE),false);
      assert.equal(await p.evaluate(automatic=>finishWorkout({automatic}),automatic),true);
      assert.equal(await p.evaluate(()=>DB.active),null);
      assert.equal(await p.evaluate(()=>window.mirrorCalls),1);
      assert.equal(await p.evaluate(()=>!!tInt||tbar.classList.contains('on')),false);
      await p.evaluate(automatic=>finishWorkout({automatic}),automatic);
      assert.equal(await p.evaluate(()=>DB.workouts.length),2);
      assert.equal(await p.evaluate(()=>window.mirrorCalls),1);
      await p.reload();await ready(p);
      assert.equal(await p.evaluate(()=>DB.active),null);
      const saved=await p.evaluate(id=>DB.workouts.find(w=>w.id===id),fixture.id);
      assert.equal(saved.dur,30);assert.equal(saved.endedAt,fixture.endedAt);
      assert.deepEqual(saved.ex[fixture.eid],[{w:22.5,r:7.5,done:true}]);
      assert.equal(saved.exNotes[fixture.eid],'Bonne isolation <test>');
      assert.equal(await p.evaluate(()=>JSON.stringify(DB.workouts[0])),fixture.older);
      assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS)),fixture.programs);
      assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_SETTINGS)),fixture.settings);
      assert.equal(await p.evaluate(()=>DB.workouts.length),2);

      // A stale tab must never finalize over newer data from another tab.
      await p.evaluate(()=>{startWorkout(PROGRAM[0].id);const e=PROGRAM[0].ex[0];DB.active.ex[e.id][0]={w:20,r:8,done:true};persist();});
      const second=await context.newPage();await second.goto(url);await ready(second);
      const newer=await second.evaluate(()=>{renameProgram(ACTIVE_PID,'Programme recent');return localStorage.getItem(KEY);});
      await p.locator('#storageConflict').waitFor();
      const stale=await p.evaluate(()=>JSON.stringify(DB));
      assert.equal(await p.evaluate(automatic=>finishWorkout({automatic}),automatic),false);
      assert.equal(await p.evaluate(()=>JSON.stringify(DB)),stale);
      assert.equal(await p.evaluate(()=>localStorage.getItem(KEY)),newer);
      assert.deepEqual(errors,[]);await context.close();
    }
    console.log('PASS: manual/automatic finish failure, retry, timer preservation, single save, reload, notes, decimal reps, duration, existing data and cross-tab conflict.');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
