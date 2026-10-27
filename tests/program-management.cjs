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
      DB.workouts=[snapshotWorkout({date:todayISO(),seance:s.id,ex:{[e.id]:[{w:20,r:8,done:true}]},exNotes:{[e.id]:'Note conservee'}})];persist();
      return {pid:ACTIVE_PID,history:JSON.stringify(DB.workouts),settings:JSON.stringify(SETTINGS)};
    });
    for(const action of ['blank','template','duplicate','rename','activate','session']){
      await p.evaluate(()=>go('programs'));
      const before=await p.evaluate(()=>({programs:JSON.stringify(PROGRAMS),pid:ACTIVE_PID,stored:localStorage.getItem(KEY_PROGRAMS),count:PROGRAMS.length,sessions:PROGRAM.length}));
      let button;
      if(action==='blank'||action==='template'){
        await p.evaluate(()=>showNewProgram());await p.locator('#npName').fill('Nouveau <'+action+'>');
        button=p.locator(action==='blank'?'#npBlank':'#npDefault');
      }else if(action==='rename'){
        await p.evaluate(pid=>showRenameProgram(pid),fixture.pid);await p.locator('#rnName').fill('Nom modifie <test>');button=p.locator('#rnOk');
      }else button=p.locator(action==='session'?'[data-act=saddseance]':'[data-act="'+(action==='duplicate'?'pdup':'pactivate')+'"][data-p="'+fixture.pid+'"]');
      await p.evaluate(()=>{
        window.originalSetItem=Storage.prototype.setItem;
        Storage.prototype.setItem=function(key,value){if(key===KEY_PROGRAMS)throw new DOMException('Test quota','QuotaExceededError');return window.originalSetItem.call(this,key,value);};
        window.mirrorCalls=0;window.originalMirrorSoon=mirrorSoon;mirrorSoon=()=>window.mirrorCalls++;
      });
      for(let attempt=0;attempt<2;attempt++){
        await button.click();
        assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),before.programs,action+' must not modify memory on failure');
        assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS)),before.stored);
        assert.equal(await p.evaluate(()=>ACTIVE_PID),before.pid);
        assert.equal(await p.evaluate(()=>route.view),'programs');
        assert.equal(await p.evaluate(()=>window.mirrorCalls),0);
        assert.match(await p.locator('#toast').textContent(),/Modification non enregistrée/);
        assert(await button.isVisible());
      }
      if(action==='rename')assert.equal(await p.locator('#rnName').inputValue(),'Nom modifie <test>');
      if(action==='blank'||action==='template')assert.equal(await p.locator('#npName').inputValue(),'Nouveau <'+action+'>');
      await p.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});await button.click();
      assert.equal(await p.evaluate(()=>window.mirrorCalls),1);
      const after=await p.evaluate(()=>({programs:PROGRAMS,pid:ACTIVE_PID,route:route.view}));
      if(['blank','template','duplicate'].includes(action))assert.equal(after.programs.length,before.count+1);
      if(action==='blank')assert.equal(after.programs.at(-1).seances[0].ex.length,0);
      if(action==='template')assert(after.programs.at(-1).seances.some(s=>s.ex.length>0));
      if(action==='duplicate'){
        const strip=sessions=>sessions.map(({id,...s})=>({...s,ex:s.ex.map(({id,...e})=>e)}));
        assert.deepEqual(strip(after.programs.at(-1).seances),strip(after.programs.find(p=>p.id===fixture.pid).seances));
      }
      if(action==='rename')assert.equal(after.programs.find(p=>p.id===fixture.pid).name,'Nom modifie <test>');
      if(action==='activate')assert.equal(after.pid,fixture.pid);
      if(action==='session'){assert.equal(after.programs.find(p=>p.id===after.pid).seances.length,before.sessions+1);assert.equal(after.route,'edit');}
      const ids=after.programs.flatMap(p=>[p.id,...p.seances.flatMap(s=>[s.id,...s.ex.map(e=>e.id)])]);
      assert.equal(ids.length,new Set(ids).size,'new copies must have independent IDs');
      await p.reload();await ready(p);
      assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),JSON.stringify(after.programs));
      assert.equal(await p.evaluate(()=>ACTIVE_PID),after.pid);
      assert.equal(await p.evaluate(()=>JSON.stringify(DB.workouts)),fixture.history);
      assert.equal(await p.evaluate(()=>JSON.stringify(SETTINGS)),fixture.settings);
    }
    const second=await context.newPage();await second.goto(url);await ready(second);
    const newer=await second.evaluate(()=>{renameProgram(ACTIVE_PID,'Nom recent');return localStorage.getItem(KEY_PROGRAMS);});
    await p.locator('#storageConflict').waitFor();
    const stale=await p.evaluate(()=>JSON.stringify(PROGRAMS));
    assert.deepEqual(await p.evaluate(()=>[createProgram('Refuse',false),duplicateProgram(ACTIVE_PID),renameProgram(ACTIVE_PID,'Refuse'),setActiveProgram(PROGRAMS[1].id),addSeance()]),[null,null,false,false,null]);
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),stale);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS)),newer);
    assert.deepEqual(errors,[]);
    console.log('PASS: program create/duplicate/rename/activate and session creation, failed saves preserve state and input, retry/reload without duplicates, independent IDs, history/settings and cross-tab protection.');
  }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
