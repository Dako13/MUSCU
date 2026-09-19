const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'../MuscuApp');
const out=path.join(os.tmpdir(),'dko-quality');
const server=http.createServer(async(req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const target=file===root?path.join(root,'index.html'):file;
  try{
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json'})[path.extname(target)]||'application/octet-stream');
    res.end(await fs.readFile(target));
  }catch{res.writeHead(404).end();}
});
let browser,base;
const errors=[];
async function open(serviceWorkers='block'){
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers});
  await ctx.addInitScript(()=>{localStorage.setItem('dako_onboarded','1');localStorage.setItem('dako_lastbackup',new Date().toISOString().slice(0,10));});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await ready(page);return page;
}
async function ready(page){
  await page.waitForFunction(()=>typeof STORAGE_READY!=='undefined'&&STORAGE_READY);
  await page.locator('#splash').waitFor({state:'detached'});
}
async function importPreview(page,data){
  await page.evaluate(data=>{showData();document.getElementById('shArea').value=JSON.stringify(data);doImport();},data);
}
async function importMerge(page){
  await page.locator('#importMerge').click();
  await page.waitForFunction(()=>!sheet.dataset.importing);
}
(async()=>{
  await fs.mkdir(out,{recursive:true});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/';
  try{
    browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
    let p=await open();
    const ids=await p.evaluate(()=>({sid:PROGRAM[0].id,ex:PROGRAM[0].ex[0].id}));

    // Library search remains complete after changing filters and clearing a query.
    await p.evaluate(()=>go('machines'));
    assert(await p.locator('.mrow').first().evaluate(el=>el.getBoundingClientRect().bottom<innerHeight-80));
    await p.locator('#mq').fill('curl');await p.locator('#machineFilters summary').click();
    await p.locator('[data-act="mfl"][data-l="broche"]').click();
    await p.locator('#mq').fill('');
    assert.equal(await p.locator('.mrow:visible').count(),await p.evaluate(()=>MACHINES.filter(m=>machineLoad(m)==='broche').length));
    await p.locator('[data-act="mfreset"]').click();
    await p.locator('#mq').fill('developpe');const n=await p.locator('.mrow:visible').count();
    await p.locator('#mq').fill('développé');assert(n>0);assert.equal(await p.locator('.mrow:visible').count(),n);
    await p.locator('#mq').fill('qwerty-not-found');assert(await p.locator('#machineEmpty').isVisible());
    await p.evaluate(()=>showMachine(0));
    const old=await p.evaluate(()=>PROGRAM[0].ex.length);
    await p.locator('[data-act="machadd"]').first().click();
    assert.equal(await p.evaluate(()=>PROGRAM[0].ex.length),old+1);

    // Modal focus/keyboard behavior and picker text layout.
    await p.evaluate(()=>{go('edit',PROGRAM[0].id);showLibPicker();});
    assert.equal(await p.locator('#sheet').getAttribute('role'),'dialog');
    assert(await p.evaluate(()=>sheet.contains(document.activeElement)&&app.inert));
    await p.keyboard.press('Shift+Tab');assert(await p.evaluate(()=>sheet.contains(document.activeElement)));
    for(const width of [320,390,1440]){
      await p.setViewportSize({width,height:900});
      assert(await p.evaluate(()=>sheet.scrollWidth<=sheet.clientWidth+1));
      await p.locator('#libq').fill('vertical');
      await p.screenshot({path:path.join(out,'picker-'+width+'.png')});
    }
    await p.keyboard.press('Escape');assert(await p.evaluate(()=>!sheet.classList.contains('on')&&!app.inert&&sheet.inert));
    await p.evaluate(()=>{showLibPicker();sheet.scrollTop=500;showSettings();});
    assert.equal(await p.evaluate(()=>sheet.scrollTop),0);await p.keyboard.press('Escape');

    // Program edits cannot disappear through navigation without confirmation.
    await p.locator('#es-title').fill('UNSAVED');
    p.once('dialog',d=>d.dismiss());await p.locator('[data-v="home"]').click();
    assert.equal(await p.evaluate(()=>route.view),'edit');
    await p.locator('[data-act="esave"]').click();
    assert.equal(await p.evaluate(()=>PROGRAM[0].title),'UNSAVED');

    // Strict entry validation, rest timer persistence, and active-session guards.
    await p.evaluate(sid=>{go('seance',sid);startWorkout(sid);},ids.sid);
    await p.locator('.w').first().fill('-10');await p.locator('.r').first().fill('-5');await p.locator('.chk').first().click();
    assert.equal(await p.evaluate(id=>DB.active.ex[id][0].done,ids.ex),false);
    await p.locator('.w').first().fill('20junk');await p.locator('.r').first().fill('10');await p.locator('.chk').first().click();
    assert.equal(await p.evaluate(id=>DB.active.ex[id][0].done,ids.ex),false);
    await p.locator('.w').first().fill('20,5');await p.locator('.chk').first().click();
    assert.equal(await p.evaluate(id=>DB.active.ex[id][0].w,ids.ex),20.5);
    await p.locator('.r').first().fill('100001');
    assert.equal(await p.evaluate(id=>DB.active.ex[id][0].done,ids.ex),false);
    await p.locator('.r').first().fill('10');await p.locator('.chk').first().click();
    const end=await p.evaluate(()=>DB.active.restTimer.end);
    await p.reload();await ready(p);
    assert(await p.evaluate(end=>tInt!==null&&Math.abs(tEndAt-end)<100,end));
    await p.evaluate(sid=>{deleteSeance(sid);go('edit',sid);},ids.sid);
    assert(await p.evaluate(sid=>!!SEANCE[sid]&&route.view!=='edit',ids.sid));
    await p.evaluate(()=>{finishWorkout();closeSheet();});
    const frozen=await p.evaluate(id=>({name:DB.workouts[0].exMeta[id].name,vol:volumeByMuscle('2000-01-01')}),ids.ex);
    await p.evaluate(()=>{PROGRAM[0].ex[0].name='RENAMED';savePrograms();PROGRAM[0].ex.shift();savePrograms();});
    assert(await p.evaluate(name=>historyHTML().includes(esc(name)),frozen.name));
    assert.deepEqual(await p.evaluate(()=>volumeByMuscle('2000-01-01')),frozen.vol);
    assert(await p.evaluate(()=>exProgressCard().includes('Progression par exercice')));

    // Entire backups are validated before any mutation. Cancel really cancels.
    const saved=await p.evaluate(()=>JSON.stringify(exportPayload()));
    const invalid=JSON.parse(saved);invalid.programmes[0].name='SHOULD NOT APPLY';invalid.seances[0].ex[ids.ex][0].w=-10;
    await importPreview(p,invalid);
    assert.equal(await p.evaluate(()=>PROGRAMS[0].name),JSON.parse(saved).programmes[0].name);
    assert.equal(await p.locator('#importMerge').count(),0);
    const malicious=JSON.parse(saved);malicious.programmes[0].seances[0].ex[0].sets='<img src=x onerror=window.__marker=1>';
    await importPreview(p,malicious);assert.equal(await p.locator('#importMerge').count(),0);
    assert.equal(await p.evaluate(()=>window.__marker),undefined);
    const backup=JSON.parse(saved);backup.seances[0].id='import-unique';backup.seances[0].date='2026-01-02';
    await importPreview(p,backup);await p.locator('#importCancel').click();
    assert.equal(await p.evaluate(()=>DB.workouts.length),1);
    await importPreview(p,backup);await importMerge(p);assert.equal(await p.evaluate(()=>DB.workouts.length),2);
    await importPreview(p,backup);await importMerge(p);assert.equal(await p.evaluate(()=>DB.workouts.length),2);
    // Same-day sessions with different IDs are retained, never deduplicated by date.
    backup.seances[0].id='import-same-day';await importPreview(p,backup);await importMerge(p);
    assert.equal(await p.evaluate(()=>DB.workouts.length),3);
    await importPreview(p,{seances:[]});p.once('dialog',d=>d.dismiss());await p.locator('#importReplace').click();
    assert.equal(await p.evaluate(()=>DB.workouts.length),3);await p.keyboard.press('Escape');
    // Simulated quota failure rolls back all local keys and preserves live state.
    await p.evaluate(()=>{window.__set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='muscu_v3'&&!window.__quotaThrown){window.__quotaThrown=true;throw new DOMException('Quota','QuotaExceededError');}return window.__set.call(this,k,v);};});
    backup.seances[0].id='import-quota';await importPreview(p,backup);await importMerge(p);
    assert.equal(await p.evaluate(()=>DB.workouts.length),3);
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(KEY)).workouts.length),3);
    await p.evaluate(()=>{Storage.prototype.setItem=window.__set;closeSheet();});

    // Recover the IndexedDB mirror before writing any defaults over it.
    const before=await p.evaluate(async()=>{clearTimeout(_mirT);await mirrorSnapshot();const value=JSON.stringify(DB.workouts);localStorage.clear();return value;});
    await p.reload();await ready(p);
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.workouts)),before);
    await p.evaluate(()=>{createProgram('Second',true);resetProgram();});
    assert(await p.evaluate(()=>{const ids=PROGRAMS.flatMap(p=>p.seances.flatMap(s=>[s.id,...s.ex.map(e=>e.id)]));return new Set(ids).size===ids.length;}));

    // Representative mobile/desktop layouts in both themes.
    const metrics=[];
    for(const width of [320,390,1440])for(const theme of ['dark','rose']){
      await p.setViewportSize({width,height:900});
      await p.evaluate(theme=>{SETTINGS.theme=theme;applyTheme();},theme);
      for(const view of ['home','machines','seance','edit','suivi']){
        await p.evaluate(view=>{closeSheet();if(view==='edit'&&DB.active){DB.active=null;stopTimer();}go(view,['seance','edit'].includes(view)?PROGRAM[0].id:null);if(view==='seance')startWorkout(PROGRAM[0].id);if(view==='machines'){MFILTER.open=false;render();}},view);
        await p.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
        assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),view+' overflows at '+width);
        metrics.push(await p.evaluate(({view,width,theme})=>({view,width,theme,firstSeries:document.querySelector('.strow')?.getBoundingClientRect().y,firstResult:document.querySelector('.mrow:not([hidden])')?.getBoundingClientRect().y}),{view,width,theme}));
        if(width!==1440||theme==='dark')await p.screenshot({path:path.join(out,view+'-'+theme+'-'+width+'.png')});
      }
    }
    await fs.writeFile(path.join(out,'metrics.json'),JSON.stringify(metrics,null,2));
    if(process.env.AXE_PATH){
      await p.addScriptTag({path:process.env.AXE_PATH});
      const accessibility={};
      await p.setViewportSize({width:390,height:844});
      for(const theme of ['dark','rose'])for(const view of ['home','machines','seance','edit','settings']){
        await p.evaluate(({theme,view})=>{
          closeSheet();DB.active=null;stopTimer();SETTINGS.theme=theme;applyTheme();
          if(view==='settings'){go('home');showSettings();}
          else{go(view,['seance','edit'].includes(view)?PROGRAM[0].id:null);if(view==='seance')startWorkout(PROGRAM[0].id);}
        },{theme,view});
        await p.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
        accessibility[theme+'-'+view]=await p.evaluate(async()=>{
          const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
          return result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
        });
      }
      await fs.writeFile(path.join(out,'accessibility.json'),JSON.stringify(accessibility,null,2));
      console.log('Accessibility:',JSON.stringify(Object.fromEntries(Object.entries(accessibility).map(([k,v])=>[k,v.map(x=>[x.id,x.nodes.length])]))));
      assert(Object.values(accessibility).every(v=>!v.length),'Automated accessibility regression');
    }
    await p.context().close();
    p=await open();
    // Full replacement also restores the in-progress workout, notes, and timer.
    const activeBackup=await p.evaluate(()=>{
      go('seance',PROGRAM[0].id);startWorkout(PROGRAM[0].id);
      DB.active.exNotes[PROGRAM[0].ex[0].id]='Active backup';startTimer('Test repos',120);persist();
      const result=exportPayload();DB.active=null;stopTimer();persist();return result;
    });
    await importPreview(p,activeBackup);p.once('dialog',d=>d.accept());await p.locator('#importReplace').click();
    await p.waitForFunction(()=>!sheet.dataset.importing);
    assert.equal(await p.evaluate(()=>Object.values(DB.active.exNotes)[0]),'Active backup');
    assert(await p.evaluate(()=>tInt!==null));
    await p.evaluate(()=>{closeSheet();showData();});
    await p.locator('#backupFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(activeBackup))});
    await p.locator('#importCancel').click();
    // A failed ordinary save must never overwrite the healthy recovery mirror.
    const healthy=await p.evaluate(async()=>{
      clearTimeout(_mirT);await mirrorSnapshot();const snap=await idbGet('snapshot');
      window.__set=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError');};
      DB.workouts=[];persist();await mirrorSnapshot();Storage.prototype.setItem=window.__set;
      return {before:snap.data[KEY],after:(await idbGet('snapshot')).data[KEY],protected:!STORAGE_WRITABLE};
    });
    assert.equal(healthy.before,healthy.after);assert(healthy.protected);
    await p.context().close();
    p=await open('allow');
    await p.evaluate(()=>navigator.serviceWorker.ready);
    await p.reload();await ready(p);await p.context().setOffline(true);
    await p.reload();await ready(p);
    assert.equal(await p.evaluate(()=>typeof DKO_DATA.workout),'function');
    await p.evaluate(()=>go('machines'));assert(await p.locator('.mrow').count()>50);
    await p.context().close();
    assert.deepEqual(errors,[]);
    console.log('PASS: library, modal/focus, editor guard, numeric validation, timer reload, active protection, historical snapshots, atomic import, cancellation, deduplication, quota rollback, IDB recovery, IDs, responsive themes, offline.');
    console.log('Screenshots and metrics: '+out);
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
