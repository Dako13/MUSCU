const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../MuscuApp'),out=path.join(os.tmpdir(),'dko-library');
const server=http.createServer(async(req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const target=file===root?path.join(root,'index.html'):file;
  try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');res.end(await fs.readFile(target));}
  catch{res.writeHead(404).end();}
});
(async()=>{
  let browser;
  await fs.mkdir(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    browser=await chromium.launch({headless:true,channel:'msedge'});
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await context.route('**/supabase-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.DKO_SUPABASE_CONFIG={};'}));
    const p=await context.newPage(),errors=[];p.setDefaultTimeout(60000);
    p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
    await p.addInitScript(()=>{localStorage.setItem('dako_onboarded','1');localStorage.setItem('dko_cloud_welcome','1');});
    console.log('Loading application');
    await p.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>typeof STORAGE_READY!=='undefined'&&STORAGE_READY);
    await p.locator('#splash').waitFor({state:'detached'});
    const catalogCheck=await p.evaluate(()=>{
      const names=new Set();
      for(const m of MACHINES){const key=libraryKey(machineAsExercise(m));if(names.has(key))throw new Error('Duplicate catalog key '+key);names.add(key);}
      for(const m of EXERCISE_CATALOG){
        if(machineTip(m)!==m.tip||machineLoad(m)!==m.load||exPattern(machineAsExercise(m))!==m.pattern)throw new Error('Lost metadata '+m.n);
        if(machineChains(m).length)throw new Error('Invented location '+m.n);
      }
      for(const m of MATRIX_CATALOG){
        if(machineTip(m)!==m.tip||machineLoad(m)!==m.load||exPattern(machineAsExercise(m))!==m.pattern)throw new Error('Lost Matrix metadata '+m.n);
        if(!machineChains(m).includes('Basic-Fit'))throw new Error('Missing Basic-Fit brand '+m.n);
      }
      go('machines');return {new:EXERCISE_CATALOG.length,total:MACHINES.length};
    });
    console.log('Catalog: '+JSON.stringify(catalogCheck));
    assert(catalogCheck.new>=140);
    await p.locator('#mq').fill('bayesian');
    assert.equal(await p.locator('#mlist .mrow:visible').count(),1);
    await p.locator('#mlist .mrow:visible').click();
    assert(await p.locator('#sheet').getByText('Place la poulie basse derrière toi', {exact:false}).isVisible());
    await p.screenshot({path:path.join(out,'bayesian-detail.png'),animations:'disabled'});
    await p.evaluate(()=>closeSheet());
    await p.locator('#mq').fill('barre incliné développé');
    assert(await p.locator('#mlist .mrow:visible').count()>0);
    await p.evaluate(()=>{MFILTER.l='corps';MFILTER.q='';render();});
    assert(await p.locator('#mlist .mrow:visible').count()>=20);
    await p.screenshot({path:path.join(out,'bodyweight-library.png'),animations:'disabled'});
    await p.evaluate(()=>{MFILTER.c='Basic-Fit';MFILTER.b='Matrix';MFILTER.l='disques';MFILTER.q='';render();});
    assert(await p.locator('#mlist .mrow:visible').count()>=13);
    await p.locator('#mq').fill('MG-PL78');
    assert.equal(await p.locator('#mlist .mrow:visible').count(),1);
    await p.locator('#mlist .mrow:visible').click();
    assert(await p.locator('#sheet h2').getByText('Hip thrust (Magnum Glute Trainer)').isVisible());
    assert(await p.locator('#sheet').getByText('MG-PL78', {exact:false}).isVisible());
    await p.screenshot({path:path.join(out,'matrix-glute-detail.png'),animations:'disabled'});
    await p.locator('#sheet [data-act=machadd]').first().click();
    assert(await p.evaluate(()=>PROGRAM[0].ex.some(e=>e.name==='Hip thrust (Magnum Glute Trainer) (Matrix)'&&e.notes.includes('coussin de bassin'))));
    await p.evaluate(()=>{closeSheet();MFILTER={g:null,b:null,c:null,l:null,q:'',open:false};});
    const sid=await p.evaluate(()=>{go('edit',PROGRAM[0].id);return PROGRAM[0].id;});
    const originalCount=await p.locator('#exlist .ecard').count();
    await p.locator('[data-act=elib]').click();
    await p.evaluate(()=>{LIBFILTER.c='Basic-Fit';LIBFILTER.b='Matrix';LIBFILTER.l='broche';showLibPicker();});
    await p.locator('#libq').fill('VS-S72');
    assert.equal(await p.locator('#liblist .mrow:visible').count(),1);
    await p.evaluate(()=>{LIBFILTER.c=null;LIBFILTER.b=null;LIBFILTER.l=null;showLibPicker();});
    await p.locator('#libq').fill('bayesian');
    assert.equal(await p.locator('#liblist .mrow:visible').count(),1);
    await p.locator('#liblist [data-libdetail]:visible').click();
    assert(await p.locator('#liblist .library-detail').getByText('Place la poulie basse derrière toi',{exact:false}).isVisible());
    assert.equal(await p.locator('#libq').inputValue(),'bayesian');
    assert.equal(await p.locator('#liblist input:checked').count(),0);
    await p.locator('#liblist input[type=checkbox]:visible').check();
    assert.match(await p.locator('#libAddSelected').textContent(),/\(1\)/);
    await p.locator('#liblist input[type=checkbox]:visible').uncheck();
    for(const width of [320,390]){
      await p.setViewportSize({width,height:844});
      assert(await p.locator('#sheet').evaluate(el=>el.scrollWidth<=el.clientWidth),`library detail overflow ${width}`);
      await p.screenshot({path:path.join(out,'picker-detail-'+width+'.png'),animations:'disabled'});
    }
    await p.locator('#libq').fill('Ma machine introuvable');
    assert(await p.locator('#libEmpty').isVisible());
    await p.locator('#libEmpty [data-libmode=custom]').click();
    assert.equal(await p.locator('#libCustomName').inputValue(),'Ma machine introuvable');
    await p.locator('#libCustomSets').fill('4');
    await p.locator('#libCustomPrimary').selectOption('dos');
    await p.locator('#libCustomNotes').fill('Un bras a la fois <test>');
    await p.locator('[data-libmode=browse]').click();
    await p.locator('.lib-modes [data-libmode=custom]').click();
    assert.equal(await p.locator('#libCustomSets').inputValue(),'4');
    assert.equal(await p.locator('#libCustomNotes').inputValue(),'Un bras a la fois <test>');
    for(const width of [320,390,1440]){
      await p.setViewportSize({width,height:900});
      assert(await p.locator('#sheet').evaluate(el=>el.scrollWidth<=el.clientWidth));
      await p.screenshot({path:path.join(out,'custom-'+width+'.png')});
    }
    await p.locator('#libCustomAdd').click();
    assert.equal(await p.locator('#exlist .ecard').count(),originalCount+1);
    await p.locator('[data-act=elib]').click();
    await p.locator('#libq').fill('');
    await p.locator('[data-libscope=personal]').click();
    await p.locator('#libq').fill('Ma machine introuvable');
    const custom=p.locator('#liblist .library-choice:visible');
    await custom.locator('[data-libfavorite]').click();
    await custom.locator('[data-libdetail]').click();
    assert(await p.locator('#liblist .library-detail').getByText('Un bras a la fois <test>',{exact:true}).isVisible());
    await custom.locator('input').check();
    await p.locator('[data-libscope=all]').click();
    await p.locator('#libq').fill('leg press');
    await p.locator('#liblist input:visible').first().check();
    assert.match(await p.locator('#libAddSelected').textContent(),/\(2\)/);
    await p.locator('#libAddSelected').click();
    assert.equal(await p.locator('#exlist .ecard').count(),originalCount+3);
    await p.locator('.e-increment').first().fill('1,25');
    await p.locator('[data-act=esave]').click();
    assert.equal(await p.evaluate(sid=>SEANCE[sid].ex[0].increment,sid),1.25);
    const preserved=await p.evaluate(()=>{
      const cloud=DKO_DATA.cloud({schema:1,programs:PROGRAMS,activeId:ACTIVE_PID,workouts:DB.workouts,active:DB.active,settings:SETTINGS,body:BODY});
      return cloud.settings;
    });
    assert.equal(preserved.exerciseLibrary[0].name,'Ma machine introuvable');
    assert.equal(preserved.exerciseFavorites.length,1);assert.equal(preserved.exerciseRecent.length,2);
    await p.reload({waitUntil:'domcontentloaded'});await p.locator('#splash').waitFor({state:'detached'});
    assert.equal(await p.evaluate(()=>SETTINGS.exerciseLibrary[0].sets),4);
    await p.evaluate(sid=>{go('edit',sid);showLibPicker();},sid);
    await p.locator('[data-libscope=favorites]').click();
    assert.equal(await p.locator('#liblist .library-choice').count(),1);
    for(const width of [320,390,1440]){
      await p.setViewportSize({width,height:900});
      for(const theme of ['dark','rose']){
        await p.evaluate(theme=>{SETTINGS.theme=theme;applyTheme();},theme);
        assert(await p.locator('#sheet').evaluate(el=>el.scrollWidth<=el.clientWidth));
        await p.screenshot({path:path.join(out,'favorites-'+theme+'-'+width+'.png')});
      }
    }
    console.log('Library, draft, selection, favorites, reload and backup passed');
    const checks=await p.evaluate(sid=>{
      closeSheet();go('seance',sid);startWorkout(sid);
      const source=activeExerciseList(SEANCE[sid],DB.active)[0],oldId=source.id;
      DB.active.exNotes[oldId]='Note conservee';DB.active.restByEx={[oldId]:95};
      const candidates=replacementCandidates(source);
      const noCurl=candidates.every(c=>exPattern(c.value)!=='curl');
      replaceActiveExercise(oldId,candidates[0]);
      const id=DB.active.exerciseOrder[0];
      const saved=DKO_DATA.workout(DB.active,true);
      const e={...EXO[SEANCE[sid].ex[0].id],increment:1.25,reps:'8–10'};
      DB.workouts=[snapshotWorkout({date:todayISO(),seance:sid,ex:{[e.id]:[{w:20,r:10,done:true}]}})];
      return {noCurl,note:saved.exNotes[id],rest:saved.restByEx[id],removed:saved.restByEx[oldId]===undefined,ref:activeExercise(id).ref,target:suggestTargets(e)[0].w};
    },sid);
    assert.deepEqual(checks,{noCurl:true,note:'Note conservee',rest:95,removed:true,ref:null,target:21.25});
    assert.deepEqual(errors,[]);
    const offlineContext=await browser.newContext({serviceWorkers:'allow'});
    await offlineContext.addInitScript(()=>{localStorage.setItem('dako_onboarded','1');localStorage.setItem('dko_cloud_welcome','1');});
    const offlinePage=await offlineContext.newPage();
    await offlinePage.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
    await offlinePage.waitForFunction(()=>navigator.serviceWorker.controller&&typeof STORAGE_READY!=='undefined'&&STORAGE_READY);
    await offlineContext.setOffline(true);
    await offlinePage.reload({waitUntil:'domcontentloaded'});
    await offlinePage.waitForFunction(()=>typeof STORAGE_READY!=='undefined'&&STORAGE_READY);
    assert.equal(await offlinePage.evaluate(()=>MACHINES.length),catalogCheck.total);
    assert.equal(await offlinePage.evaluate(()=>machineLoad(MATRIX_CATALOG.find(m=>m.model==='MG-PL78'))),'disques');
    await offlineContext.close();
    console.log('PASS: full catalog available offline after service-worker installation.');
    console.log('PASS: library workflow, data preservation, replacement, 1.25 increments, mobile/desktop layouts. Screenshots: '+out);
  }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
