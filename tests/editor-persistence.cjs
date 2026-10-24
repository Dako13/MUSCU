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
    await p.addInitScript(()=>{localStorage.setItem('dako_onboarded','1');localStorage.setItem('dko_cloud_welcome','1');});
    context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
    p.on('pageerror',e=>errors.push(e.message));
    const url='http://127.0.0.1:'+server.address().port+'/';
    await p.goto(url);await ready(p);
    const fixture=await p.evaluate(()=>{
      const s=PROGRAM[0],e=s.ex[0],pid=ACTIVE_PID;
      DB.workouts=[snapshotWorkout({date:todayISO(),seance:s.id,ex:{[e.id]:[{w:25,r:10,done:true}]},exNotes:{[e.id]:'Ressenti a conserver'}})];persist();
      createProgram('Autre programme',false);setActiveProgram(pid);
      go('edit',s.id);
      return {sid:s.id,pid,programs:JSON.stringify(PROGRAMS),other:JSON.stringify(PROGRAMS.find(p=>p.id!==pid)),history:JSON.stringify(DB.workouts),settings:JSON.stringify(SETTINGS),stored:localStorage.getItem(KEY_PROGRAMS)};
    });
    await p.locator('#es-title').fill('Seance modifiee <test>');
    await p.locator('#es-rest').fill('150');
    await p.locator('.e-name').first().fill('Exercice personnalise');
    await p.locator('.e-notes').first().fill('Reglage du banc a conserver');
    await p.locator('[data-act=eadd]').click();
    await p.locator('.e-name').last().fill('Nouvel exercice');
    const draft=await p.evaluate(()=>editorState());
    await p.evaluate(()=>{
      window.originalSetItem=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key===KEY_PROGRAMS)throw new DOMException('Test quota','QuotaExceededError');return window.originalSetItem.call(this,key,value);};
      window.mirrorCalls=0;window.originalMirrorSoon=mirrorSoon;mirrorSoon=()=>window.mirrorCalls++;
    });
    for(let attempt=0;attempt<2;attempt++){
      await p.locator('[data-act=esave]').click();
      assert.equal(await p.evaluate(()=>route.view),'edit');
      assert.equal(await p.evaluate(()=>editorState()),draft);
      assert.equal(await p.evaluate(()=>editorDirty()),true);
      assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),fixture.programs);
      assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS)),fixture.stored);
      assert.equal(await p.evaluate(()=>window.mirrorCalls),0,'failed save must not notify cloud or overwrite recovery');
      assert.match(await p.locator('#toast').textContent(),/Enregistrement impossible/);
    }
    p.once('dialog',d=>d.dismiss());await p.evaluate(()=>go('home'));
    assert.equal(await p.evaluate(()=>editorState()),draft,'navigation cancellation preserves the draft');
    await p.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
    await p.locator('[data-act=esave]').click();
    assert.equal(await p.evaluate(()=>route.view),'seance');
    assert.equal(await p.evaluate(()=>window.mirrorCalls),1);
    assert.equal(await p.evaluate(()=>editorDirty()),false);
    assert.match(await p.locator('#toast').textContent(),/Séance enregistrée/);
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS.find(p=>p.id!==ACTIVE_PID))),fixture.other);
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.workouts)),fixture.history);
    assert.equal(await p.evaluate(()=>JSON.stringify(SETTINGS)),fixture.settings);
    await p.reload();await ready(p);
    assert.deepEqual(await p.evaluate(sid=>({title:SEANCE[sid].title,rest:SEANCE[sid].rest,name:SEANCE[sid].ex[0].name,notes:SEANCE[sid].ex[0].notes,last:SEANCE[sid].ex.at(-1).name}),fixture.sid),{
      title:'Seance modifiee <test>',rest:150,name:'Exercice personnalise',notes:'Reglage du banc a conserver',last:'Nouvel exercice'
    });
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.workouts)),fixture.history);
    assert.equal(await p.evaluate(()=>JSON.stringify(SETTINGS)),fixture.settings);
    assert.equal(await p.evaluate(()=>ACTIVE_PID),fixture.pid);

    // An outdated editor must keep its draft without replacing the newer program.
    await p.evaluate(sid=>go('edit',sid),fixture.sid);
    await p.locator('#es-title').fill('Brouillon ancien onglet');
    const beforeConflict=await p.evaluate(()=>({programs:JSON.stringify(PROGRAMS),draft:editorState()}));
    const second=await context.newPage();await second.goto(url);await ready(second);
    const newer=await second.evaluate(()=>{renameProgram(ACTIVE_PID,'Nom depuis autre onglet');return localStorage.getItem(KEY_PROGRAMS);});
    await p.locator('#storageConflict').waitFor();
    assert.equal(await p.evaluate(sid=>collectEdit(sid),fixture.sid),false);
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),beforeConflict.programs);
    assert.equal(await p.evaluate(()=>editorState()),beforeConflict.draft);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS)),newer);
    assert.equal(await p.evaluate(()=>editorDirty()),true);
    assert.deepEqual(errors,[]);
    console.log('PASS: editor draft retained on repeated storage failures, navigation protection, successful retry/reload, other programs/history/settings preserved, cross-tab conflict protection.');
  }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
