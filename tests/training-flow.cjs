const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../MuscuApp'),out=path.join(os.tmpdir(),'dko-training');
const server=http.createServer(async(req,res)=>{
  if(req.url==='/supabase-config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.DKO_SUPABASE_CONFIG={};');return;}
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const target=file===root?path.join(root,'index.html'):file;
  try{
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');
    res.end(await fs.readFile(target));
  }catch{res.writeHead(404).end();}
});
async function settled(p){
  await p.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
}
(async()=>{
  let browser;
  await fs.mkdir(out,{recursive:true});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
    const p=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(()=>{localStorage.setItem('dako_onboarded','1');localStorage.setItem('dako_lastbackup',new Date().toISOString().slice(0,10));});
    await p.goto('http://127.0.0.1:'+server.address().port+'/');
    await p.locator('#splash').waitFor({state:'detached'});
    const ids=await p.evaluate(()=>{
      const s=PROGRAM[0];go('seance',s.id);startWorkout(s.id);
      return {sid:s.id,ex:s.ex[0].id,other:s.ex[1].id,program:JSON.stringify(PROGRAMS)};
    });
    const card=p.locator('.card[data-ex]:visible');
    assert.equal(await card.locator('.previous-set').count(),0);
    await p.evaluate(({sid,ex,other})=>{
      const d=new Date();d.setDate(d.getDate()-2);
      DB.workouts=[snapshotWorkout({id:'test-history',seance:sid,date:isoOf(d),dur:600,ex:{
        [ex]:[{w:20,r:10,done:true},{w:20,r:8,done:true}],
        [other]:[{w:10,r:10,done:true}]
      }})];persist();render();
    },ids);
    assert.match(await card.locator('.previous-set').first().textContent(),/20.*10/);
    assert.match(await card.locator('.previous-set').nth(2).textContent(),/Pas de série précédente/);
    assert.equal(await card.locator('.w').first().inputValue(),'');
    const compatibility=await p.evaluate(({ex})=>{
      const e=EXO[ex],old=DB.workouts[0].exMeta[ex].unit;
      DB.workouts[0].exMeta[ex].unit='lb';
      const result=previousExercise(e);DB.workouts[0].exMeta[ex].unit=old;
      return result;
    },ids);
    assert.equal(compatibility,null);
    assert(await p.evaluate(({ex})=>{
      const active=structuredClone(DB.active),prior=DB.workouts[0],original=prior.exMeta[ex].unit;
      active.ex[ex][0]={w:25,r:10,done:true};prior.exMeta[ex].unit='lb';
      const isolated=comparisonSummary(active)===null&&comparableBest(ex,workoutExercise(active,ex),active.date)===null;
      prior.exMeta[ex].unit=original;
      active.ex[ex][0].w=null;
      return isolated&&comparisonSummary(active).rows[0].now.vol===null;
    },ids));
    const progressChecks=await p.evaluate(()=>{
      const original=DB.workouts,date=todayISO();
      const meta=(name,unit='kg')=>({name,unit});
      const set=(w,r)=>[{w,r,done:true}];
      const first={id:'one',date,ex:{a:set(20,8),b:set(20,8),c:set(20,8),d:set(null,8)},exMeta:{a:meta('A'),b:meta('B'),c:meta('C'),d:meta('D','reps')}};
      const second={id:'two',date,ex:{a:set(20,9),b:set(25,6),c:set(25,8),d:set(null,10),e:set(10,8)},exMeta:{a:meta('A'),b:meta('B'),c:meta('C','lb'),d:meta('D','reps'),e:meta('E')}};
      const third={id:'three',date,ex:{a:set(20,8)},exMeta:{a:meta('A')}};
      DB.workouts=[first,second,third];
      try{
        const result=workoutProgressMap();
        return {first:progressText(result.get(first)),second:{compared:result.get(second).compared,improved:result.get(second).improved},third:progressText(result.get(third)),period:periodProgress(date,null,result)};
      }finally{DB.workouts=original;}
    });
    assert.deepEqual(progressChecks,{first:'—',second:{compared:3,improved:2},third:'0/1',period:{compared:3,improved:1}});

    // Per-workout rests never edit the program or an already-running timer.
    await card.locator('[data-act="restset"]').click();
    await p.locator('#exerciseRest').fill('-1');await p.locator('#restSave').click();
    assert.equal(await p.locator('#exerciseRest').getAttribute('aria-invalid'),'true');
    await p.locator('[data-rest="90"]').click();await p.locator('#restSave').click();
    assert.equal(await p.evaluate(id=>DB.active.restByEx[id],ids.ex),90);
    await card.locator('.w').first().fill('25');await card.locator('.r').first().fill('10');await card.locator('.chk').first().click();
    assert(await p.evaluate(()=>Math.abs(tEndAt-Date.now()-90000)<2000));
    const end=await p.evaluate(()=>tEndAt);
    await p.locator('#tplus').click();assert.equal(await p.evaluate(()=>tEndAt),end+30000);
    await p.locator('#tminus').click();assert.equal(await p.evaluate(()=>tEndAt),end);
    await card.locator('[data-act="restset"]').click();
    await p.locator('#exerciseRest').fill('120');await p.locator('#restSave').click();
    assert.equal(await p.evaluate(()=>tEndAt),end);
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),ids.program);
    const exported=await p.evaluate(()=>exportPayload());
    const restored=await p.evaluate(w=>DKO_DATA.workout(w,true),exported.active);
    assert.equal(restored.restByEx[ids.ex],120);
    for(const invalid of [0,-5,1.5,'junk']){
      const bad=structuredClone(exported.active);bad.restByEx[ids.ex]=invalid;
      assert(await p.evaluate(w=>{try{DKO_DATA.workout(w,true);return false;}catch{return true;}},bad));
    }
    const unknown=structuredClone(exported.active);unknown.restByEx.unknown=60;
    assert(await p.evaluate(w=>{try{DKO_DATA.workout(w,true);return false;}catch{return true;}},unknown));
    await p.reload();await p.locator('#splash').waitFor({state:'detached'});
    await p.locator('.stage-start').click();
    assert.equal(await p.evaluate(id=>DB.active.restByEx[id],ids.ex),120);
    assert(await p.evaluate(end=>Math.abs(tEndAt-end)<100,end));
    await card.locator('[data-act="restset"]').click();await p.locator('#restReset').click();
    assert.equal(await p.evaluate(id=>DB.active.restByEx[id],ids.ex),undefined);
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),ids.program);

    // Timer/series remain readable at small widths and in both themes.
    for(const width of [320,390,1440])for(const theme of ['dark','rose']){
      await p.setViewportSize({width,height:900});
      await p.evaluate(theme=>{SETTINGS.theme=theme;applyTheme();render();},theme);await settled(p);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert(await p.locator('#timerbar').evaluate(el=>el.scrollWidth<=el.clientWidth));
      assert(await p.locator('#tminus').evaluate(el=>el.getBoundingClientRect().width>=44));
      await card.locator('.strow').first().scrollIntoViewIfNeeded();
      await p.screenshot({path:path.join(out,'series-'+theme+'-'+width+'.png')});
    }
    await p.evaluate(()=>startTimer('Fin de repos',10));await p.locator('#tminus').click();
    assert.equal(await p.locator('#tleft').textContent(),'0:00');
    assert(await p.locator('#tplus').isDisabled());
    await p.locator('#tskip').click();
    assert(await p.evaluate(()=>!DB.active.restTimer));
    await p.evaluate(()=>finishWorkout());
    assert.equal(await p.locator('.summary-comparison tbody tr').count(),1);
    assert.match(await p.locator('.summary-comparison').textContent(),/2 séries.*20 kg\/bras × 10 reps/);
    assert.match(await p.locator('.summary-comparison').textContent(),/1 série.*25 kg\/bras × 10 reps/);
    assert.match(await p.locator('.recwrap').textContent(),/Records de charge/);
    for(const width of [320,390,1440]){
      await p.setViewportSize({width,height:900});
      await settled(p);
      assert(await p.locator('#sheet').evaluate(el=>el.scrollWidth<=el.clientWidth));
      await p.screenshot({path:path.join(out,'summary-'+width+'.png')});
    }
    if(process.env.AXE_PATH){
      await p.addScriptTag({path:process.env.AXE_PATH});
      for(const state of ['summary','rest','timer']){
        if(state==='rest'){
          await p.evaluate(sid=>{closeSheet();go('seance',sid);startWorkout(sid);},ids.sid);
          await card.locator('[data-act="restset"]').click();
        }
        if(state==='timer')await p.evaluate(()=>{closeSheet();startTimer('Repos',90);});
        await settled(p);
        const violations=await p.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
        assert.deepEqual(violations,[],state);
      }
    }
    await p.evaluate(()=>{closeSheet();SUIVI='stats';go('suivi');});
    assert.match(await p.locator('.statgrid').textContent(),/Exos en progrès/);
    assert.match(await p.locator('.charttitle').allTextContents().then(x=>x.join(' ')),/Séries par semaine/);
    assert.doesNotMatch(await p.locator('#app').textContent(),/Tonnage|kg soulevés/);
    for(const width of [320,390,1440]){
      await p.setViewportSize({width,height:900});await settled(p);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`stats overflow ${width}`);
      await p.screenshot({path:path.join(out,'progress-stats-'+width+'.png'),animations:'disabled'});
    }
    await p.evaluate(()=>{closeSheet();stopTimer();DB.active=null;DB.workouts=[];go('seance',PROGRAM[0].id);startWorkout(PROGRAM[0].id);});
    assert.equal(await p.evaluate(()=>Object.keys(DB.active.restByEx||{}).length),0);
    await card.locator('.w').first().fill('15');await card.locator('.r').first().fill('8');await card.locator('.chk').first().click();
    await p.evaluate(()=>finishWorkout());
    assert.match(await p.locator('.recwrap').textContent(),/Premières références/);
    assert.doesNotMatch(await p.locator('.recwrap').textContent(),/Records/);
    assert.equal(await p.locator('.summary-comparison').count(),0);
    // Creating a session has a durable default, independent of other users
    // and of per-exercise / current-workout exceptions.
    await p.evaluate(()=>{closeSheet();go('programs');});
    const originals=await p.evaluate(()=>JSON.stringify(PROGRAM));
    const personal=await p.evaluate(()=>SETTINGS.rest);
    await p.locator('[data-act="saddseance"]').click();
    const sid=await p.evaluate(()=>route.seance);
    assert.equal(await p.locator('#es-rest').inputValue(),'');
    await p.locator('[data-act="sessionrest"][data-rest="90"]').click();
    p.once('dialog',d=>d.dismiss());await p.locator('[data-v="home"]').click();
    assert.equal(await p.evaluate(()=>route.view),'edit');
    await p.locator('[data-act="eadd"]').click();
    await p.locator('.e-name').first().fill('Exercice repos commun');
    assert.match(await p.locator('.e-rest').first().getAttribute('placeholder'),/90/);
    const draft=await p.evaluate(()=>JSON.stringify(PROGRAMS));
    await p.locator('#es-rest').fill('-1');await p.locator('[data-act="esave"]').click();
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),draft);
    await p.locator('#es-rest').fill('95');
    await p.locator('[data-act="eadd"]').click();
    await p.locator('.e-name').nth(1).fill('Exercice repos specifique');
    await p.locator('.e-rest').nth(1).fill('240');
    for(const width of [320,390,1440]){
      await p.setViewportSize({width,height:900});
      await p.locator('#es-rest').scrollIntoViewIfNeeded();await settled(p);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await p.screenshot({path:path.join(out,'session-editor-'+width+'.png')});
    }
    if(process.env.AXE_PATH){
      const violations=await p.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>v.id));
      assert.deepEqual(violations,[]);
    }
    await p.locator('[data-act="esave"]').click();
    assert.equal(await p.evaluate(sid=>SEANCE[sid].rest,sid),95);
    assert.equal(await p.evaluate(()=>SETTINGS.rest),personal);
    assert.equal(await p.evaluate(sid=>JSON.stringify(PROGRAM.filter(s=>s.id!==sid)),sid),originals);
    assert.match(await p.locator('.smeta').textContent(),/1:35/);
    const programs=await p.evaluate(()=>exportPayload().programmes);
    const cleaned=await p.evaluate(data=>DKO_DATA.programs(data),programs);
    assert.equal(cleaned.flatMap(p=>p.seances).find(s=>s.id===sid).rest,95);
    const invalid=structuredClone(programs);invalid.flatMap(p=>p.seances).find(s=>s.id===sid).rest=0;
    assert(await p.evaluate(data=>{try{DKO_DATA.programs(data);return false;}catch{return true;}},invalid));
    await p.reload();await p.locator('#splash').waitFor({state:'detached'});
    await p.evaluate(sid=>{go('seance',sid);startWorkout(sid);},sid);
    assert.deepEqual(await p.evaluate(sid=>SEANCE[sid].ex.map(e=>restForExercise(e)),sid),[95,240]);
    await card.locator('.r').first().fill('8');await card.locator('.chk').first().click();
    assert(await p.evaluate(()=>Math.abs(tEndAt-Date.now()-95000)<2000));
    await p.evaluate(()=>{DB.active=null;stopTimer();persist();go('edit',PROGRAM[PROGRAM.length-1].id);});
    await p.locator('[data-act="sessionrest"][data-rest=""]').click();
    await p.locator('[data-act="esave"]').click();
    assert.equal(await p.evaluate(sid=>SEANCE[sid].rest,sid),null);
    assert.equal(await p.evaluate(sid=>restForExercise(EXO[SEANCE[sid].ex[0].id]),sid),personal);
    const otherUser=await browser.newPage({serviceWorkers:'block'});
    await otherUser.addInitScript(()=>localStorage.setItem('dako_onboarded','1'));
    await otherUser.goto('http://127.0.0.1:'+server.address().port+'/');
    await otherUser.locator('#splash').waitFor({state:'detached'});
    assert.equal(await otherUser.evaluate(sid=>!!SEANCE[sid],sid),false);
    assert.equal(await otherUser.evaluate(()=>SETTINGS.rest),180);
    await otherUser.close();
    assert.deepEqual(errors,[]);
    console.log('PASS: prior series, unit compatibility, workout/session/exercise rest precedence, creation/edit/validation/reset, dirty guard, timer/reload, backup schema, user isolation, records, summary, layouts and accessibility.');
    console.log('Screenshots: '+out);
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
