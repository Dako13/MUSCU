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
      DB.workouts=[0,1].map(i=>snapshotWorkout({id:'history-'+i,date:todayISO(),seance:s.id,dur:300,endedAt:Date.now()-10000,ex:{[e.id]:[{w:20+i,r:8,done:true},{w:20+i,r:7,done:true}]},exNotes:{[e.id]:'Note '+i}}));persist();
      startWorkout(s.id);go('suivi');
      return {eid:e.id,programs:JSON.stringify(PROGRAMS),settings:JSON.stringify(SETTINGS),active:JSON.stringify(DB.active),other:JSON.stringify(DB.workouts[1])};
    });
    const unchangedOthers=async()=>{
      assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),fixture.programs);
      assert.equal(await p.evaluate(()=>JSON.stringify(SETTINGS)),fixture.settings);
      assert.equal(await p.evaluate(()=>JSON.stringify(DB.active)),fixture.active);
      assert.equal(await p.evaluate(()=>JSON.stringify(DB.workouts.find(w=>w.id==='history-1'))),fixture.other);
    };
    const rejectSaves=()=>p.evaluate(()=>{
      window.originalSetItem=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key===KEY)throw new DOMException('Test quota','QuotaExceededError');return window.originalSetItem.call(this,key,value);};
      window.mirrorCalls=0;window.originalMirrorSoon=mirrorSoon;mirrorSoon=()=>window.mirrorCalls++;
    });
    const restoreSaves=()=>p.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
    const before=await p.evaluate(()=>({db:JSON.stringify(DB),stored:localStorage.getItem(KEY)}));
    await p.evaluate(()=>showEditWorkout(0));
    await p.locator('.we[data-k=w]').first().fill('22,5');
    await p.locator('.we[data-k=r]').first().fill('7,5');
    await p.locator('.we-note').first().fill('Ressenti corrige <test>');
    await p.locator('.wsetdel').last().click();
    await rejectSaves();
    for(let attempt=0;attempt<2;attempt++){
      await p.locator('#wsave').click();assert(await p.locator('#wsave').isVisible());
      assert.equal(await p.locator('.we-note').first().inputValue(),'Ressenti corrige <test>');
      assert.equal(await p.locator('.wrow').count(),1);
      assert.equal(await p.evaluate(()=>JSON.stringify(DB)),before.db);
      assert.equal(await p.evaluate(()=>localStorage.getItem(KEY)),before.stored);
      assert.equal(await p.evaluate(()=>window.mirrorCalls),0);
      assert.match(await p.locator('#toast').textContent(),/Modification non enregistrée/);
    }
    await restoreSaves();await p.locator('#wsave').click();
    assert.equal(await p.evaluate(()=>window.mirrorCalls),1);await unchangedOthers();
    await p.reload();await ready(p);await unchangedOthers();
    assert.deepEqual(await p.evaluate(id=>DB.workouts[0].ex[id],fixture.eid),[{w:22.5,r:7.5,done:true}]);
    assert.equal(await p.evaluate(id=>DB.workouts[0].exNotes[id],fixture.eid),'Ressenti corrige <test>');
    assert.equal(await p.evaluate(()=>DB.workouts[0].endedAt),undefined);
    await p.evaluate(()=>{go('suivi');app.querySelector('[data-act=wdel][data-w="0"]').closest('details').open=true;});
    const del=p.locator('[data-act=wdel][data-w="0"]');
    const beforeDelete=await p.evaluate(()=>({db:JSON.stringify(DB),stored:localStorage.getItem(KEY)}));
    p.once('dialog',d=>d.dismiss());await del.click();
    assert.equal(await p.evaluate(()=>JSON.stringify(DB)),beforeDelete.db);
    await rejectSaves();p.once('dialog',d=>d.accept());await del.click();
    assert(await del.isVisible());assert.equal(await p.evaluate(()=>JSON.stringify(DB)),beforeDelete.db);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY)),beforeDelete.stored);
    assert.equal(await p.evaluate(()=>window.mirrorCalls),0);
    assert.match(await p.locator('#toast').textContent(),/Modification non enregistrée/);
    await restoreSaves();p.once('dialog',d=>d.accept());await del.click();
    assert.equal(await p.evaluate(()=>window.mirrorCalls),1);
    await p.reload();await ready(p);await unchangedOthers();
    assert.deepEqual(await p.evaluate(()=>DB.workouts.map(w=>w.id)),['history-1']);
    assert.deepEqual(await p.evaluate(()=>[-1,1,0.5,NaN].map(deleteWorkout)),[false,false,false,false]);

    await p.evaluate(()=>showEditWorkout(0));await p.locator('.we-note').first().fill('Brouillon ancien onglet');
    const second=await context.newPage();await second.goto(url);await ready(second);
    const newer=await second.evaluate(()=>{renameProgram(ACTIVE_PID,'Nom recent');return localStorage.getItem(KEY);});
    await p.locator('#storageConflict').waitFor();
    const stale=await p.evaluate(()=>JSON.stringify(DB));
    await p.evaluate(()=>document.getElementById('wsave').click());
    assert.equal(await p.evaluate(()=>deleteWorkout(0)),false);
    assert.equal(await p.evaluate(()=>JSON.stringify(DB)),stale);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY)),newer);
    assert.equal(await p.locator('.we-note').first().inputValue(),'Brouillon ancien onglet');
    assert.deepEqual(errors,[]);
    console.log('PASS: historical edit/delete quota rollback, retained notes/rows, retry/reload, deletion cancellation, active workout/program/settings preservation, cross-tab conflicts.');
  }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
