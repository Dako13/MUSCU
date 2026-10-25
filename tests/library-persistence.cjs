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
      DB.workouts=[snapshotWorkout({date:todayISO(),seance:sid,ex:{[e.id]:[{w:20,r:8,done:true}]},exNotes:{[e.id]:'Note a conserver'}})];persist();
      SETTINGS.exerciseLibrary=[{name:'Exercice personnel test',sets:4,reps:'7-9',unit:'kg',rest:75,increment:1.25,musP:['dos'],musS:['biceps'],notes:'Reglage personnel'}];saveSettings();
      createProgram('Programme intact',false);setActiveProgram(pid);go('machines');
      return {sid,pid,history:JSON.stringify(DB.workouts),other:JSON.stringify(PROGRAMS.find(p=>p.id!==pid)),key:libraryKey(SETTINGS.exerciseLibrary[0]),personal:SETTINGS.exerciseLibrary[0]};
    });
    for(const kind of ['machine','personal']){
      const before=await p.evaluate(()=>({programs:JSON.stringify(PROGRAMS),settings:JSON.stringify(SETTINGS),stored:localStorage.getItem(KEY_PROGRAMS),storedSettings:localStorage.getItem(KEY_SETTINGS),count:PROGRAM[0].ex.length}));
      await p.evaluate(({kind,key})=>{if(kind==='machine')showMachine(0);else showPersonalExercise(key);},{kind,key:fixture.key});
      const selector=kind==='machine'?'[data-act=machadd]':'[data-personalsession]';
      await p.evaluate(kind=>{
        window.originalSetItem=Storage.prototype.setItem;
        window.failKey=kind==='machine'?KEY_PROGRAMS:KEY_SETTINGS;
        Storage.prototype.setItem=function(key,value){if(key===window.failKey)throw new DOMException('Test quota','QuotaExceededError');return window.originalSetItem.call(this,key,value);};
        window.mirrorCalls=0;window.originalMirrorSoon=mirrorSoon;mirrorSoon=()=>window.mirrorCalls++;
      },kind);
      for(let attempt=0;attempt<2;attempt++){
        await p.locator('#sheet '+selector).first().click();
        assert(await p.locator('#sheet '+selector).first().isVisible(),'failed addition must keep the sheet open');
        assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),before.programs);
        assert.equal(await p.evaluate(()=>JSON.stringify(SETTINGS)),before.settings);
        assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS)),before.stored,'partial program write must be rolled back');
        assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_SETTINGS)),before.storedSettings);
        assert.equal(await p.evaluate(()=>window.mirrorCalls),0);
        assert.match(await p.locator('#toast').textContent(),/Ajout non enregistré/);
      }
      await p.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
      await p.locator('#sheet '+selector).first().click();
      assert.equal(await p.evaluate(()=>PROGRAM[0].ex.length),before.count+1,'retry must add exactly one exercise');
      assert.equal(await p.evaluate(()=>window.mirrorCalls),1);
      if(kind==='personal'){
        const added=await p.evaluate(()=>{const {id,...e}=PROGRAM[0].ex.at(-1);return e;});
        assert.deepEqual(added,fixture.personal);
        assert.equal(await p.evaluate(()=>SETTINGS.exerciseRecent[0]),fixture.key);
      }
      await p.reload();await ready(p);
      assert.equal(await p.evaluate(()=>PROGRAM[0].ex.length),before.count+1);
      assert.equal(await p.evaluate(()=>new Set(PROGRAM[0].ex.map(e=>e.id)).size),before.count+1);
      assert.equal(await p.evaluate(()=>JSON.stringify(DB.workouts)),fixture.history);
      assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS.find(p=>p.id!==ACTIVE_PID))),fixture.other);
      const settings=await p.evaluate(()=>{const {exerciseRecent,...rest}=SETTINGS;return rest;});
      const {exerciseRecent,...originalSettings}=JSON.parse(before.settings);assert.deepEqual(settings,originalSettings);
    }
    await p.evaluate(sid=>{startWorkout(sid);go('machines');},fixture.sid);
    const active=await p.evaluate(()=>({programs:JSON.stringify(PROGRAMS),workout:JSON.stringify(DB.active)}));
    await p.evaluate(()=>showMachine(0));await p.locator('#sheet [data-act=machadd]').first().click();
    assert.match(await p.locator('#toast').textContent(),/Termine la séance/);
    await p.evaluate(key=>showPersonalExercise(key),fixture.key);await p.locator('#sheet [data-personalsession]').first().click();
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),active.programs);
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.active)),active.workout);
    await p.evaluate(()=>{DB.active=null;persist();closeSheet();});

    // A stale library detail must not overwrite a newer program from another tab.
    const second=await context.newPage();await second.goto(url);await ready(second);
    const newer=await second.evaluate(()=>{renameProgram(ACTIVE_PID,'Version autre onglet');return localStorage.getItem(KEY_PROGRAMS);});
    await p.locator('#storageConflict').waitFor();
    const stale=await p.evaluate(()=>JSON.stringify(PROGRAMS));
    assert.equal(await p.evaluate(sid=>addLibraryExerciseToSeance(sid,SETTINGS.exerciseLibrary[0],true),fixture.sid),false);
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),stale);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS)),newer);
    assert.deepEqual(errors,[]);
    console.log('PASS: machine/personal additions, repeated quota failures, multi-key rollback, retry/reload without duplicates, metadata and history preservation, active workout and cross-tab protection.');
  }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
