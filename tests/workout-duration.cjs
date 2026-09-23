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
  const target=file===root?path.join(root,'index.html'):file;
  try{
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');
    res.end(await fs.readFile(target));
  }catch{res.writeHead(404).end();}
});
(async()=>{
  let browser;
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    browser=await chromium.launch({headless:true,channel:'msedge'});
    const p=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}});
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(()=>{
      localStorage.setItem('dako_onboarded','1');
      window.__time=Number(localStorage.getItem('test-clock'))||Date.now();
      Date.now=()=>window.__time;
    });
    await p.goto('http://127.0.0.1:'+server.address().port+'/');
    await p.locator('#splash').waitFor({state:'detached'});
    await p.evaluate(()=>{
      PROGRAM[0].ex=PROGRAM[0].ex.slice(0,1);PROGRAM[0].ex[0].sets=2;savePrograms();
    });
    const begin=()=>p.evaluate(()=>{closeSheet();go('seance',PROGRAM[0].id);startWorkout(PROGRAM[0].id);});
    const advance=ms=>p.evaluate(ms=>{window.__time+=ms;localStorage.setItem('test-clock',String(window.__time));},ms);
    const validate=async(i,reps='7,5')=>{
      const row=p.locator('.card:visible .strow').nth(i);
      await row.locator('.w').fill('20');await row.locator('.r').fill(reps);await row.locator('.chk').click();
    };
    const finish=()=>p.evaluate(()=>{finishWorkout();closeSheet();return DB.workouts.at(-1);});
    await begin();await advance(60000);await validate(0);
    assert.equal(await p.evaluate(()=>lastValidatedElapsed(DB.active)),60000);
    assert.equal(await p.evaluate(()=>Object.values(DB.active.ex)[0][0].r),7.5);
    assert.deepEqual(await p.evaluate(()=>repsRange('7,5-9.5')),[7.5,9.5]);
    await advance(30000);await p.locator('[data-act="pause"]').click();
    await advance(600000);await p.locator('[data-act="pause"]').click();
    await advance(30000);await validate(1,'0.5');
    assert.equal(await p.locator('#elapsed').textContent(),'2:00');
    const active=await p.evaluate(()=>DKO_DATA.workout(exportPayload().active,true));
    assert.equal(Object.values(active.ex)[0][1].doneElapsedMs,120000);
    await advance(600000);
    assert.equal(await p.evaluate(()=>elapsedStr()),'2:00');
    assert.equal((await finish()).dur,120);

    // Undoing the latest OK must fall back to the previous remaining OK.
    await begin();await advance(20000);await validate(0);
    await advance(10000);await validate(1);
    await p.locator('.card:visible .chk').nth(1).click();
    assert.equal(await p.evaluate(()=>lastValidatedElapsed(DB.active)),20000);
    await advance(600000);assert.equal((await finish()).dur,20);

    // Invalid edits clear both validation and its timestamp.
    await begin();await advance(10000);await validate(0,'0.5');
    await p.locator('.card:visible [data-act="stepr"][data-d="-1"]').first().click();
    assert(await p.evaluate(()=>{const st=Object.values(DB.active.ex)[0][0];return !st.done&&st.doneElapsedMs==null;}));
    for(const value of ['0','-1','7..5','Infinity','100001']){
      await p.locator('.card:visible .r').first().fill(value);
      await p.locator('.card:visible .chk').first().click();
      assert.equal(await p.evaluate(()=>Object.values(DB.active.ex)[0][0].done),false);
    }
    await validate(0);await finish();

    // Exactly three hours after the start, a partial workout is saved once.
    await begin();await advance(45000);await validate(0);
    let count=await p.evaluate(()=>DB.workouts.length);
    await p.evaluate(()=>{window.__time=DB.active.start+AUTO_FINISH_MS-1;});
    assert.equal(await p.evaluate(()=>checkWorkoutTimeout()),false);
    await p.evaluate(()=>{window.__time++;checkWorkoutTimeout();checkWorkoutTimeout();});
    assert.equal(await p.evaluate(()=>DB.active),null);
    assert.equal(await p.evaluate(()=>DB.workouts.length),count+1);
    assert.equal(await p.evaluate(()=>DB.workouts.at(-1).dur),45);

    // Simulate iOS suspending the page, then reopening it after the deadline.
    await begin();await advance(30000);await validate(0);
    count=await p.evaluate(()=>DB.workouts.length);
    await p.evaluate(()=>{persist();localStorage.setItem('test-clock',String(DB.active.start+AUTO_FINISH_MS+600000));});
    await p.reload();await p.locator('#splash').waitFor({state:'detached'});
    assert.equal(await p.evaluate(()=>DB.active),null);
    assert.equal(await p.evaluate(()=>DB.workouts.length),count+1);
    assert.equal(await p.evaluate(()=>DB.workouts.at(-1).dur),30);
    await p.reload();await p.locator('#splash').waitFor({state:'detached'});
    assert.equal(await p.evaluate(()=>DB.workouts.length),count+1);

    // An unvalidated draft is paused, not silently discarded or counted.
    await begin();await p.locator('.session-note').first().fill('Brouillon a conserver');
    count=await p.evaluate(()=>DB.workouts.length);
    await p.evaluate(()=>{window.__time=DB.active.start+AUTO_FINISH_MS+1000;checkWorkoutTimeout();});
    assert(await p.evaluate(()=>!!DB.active.ps&&Object.values(DB.active.exNotes)[0]==='Brouillon a conserver'));
    assert.equal(await p.evaluate(()=>DB.workouts.length),count);
    assert.equal(await p.evaluate(()=>checkWorkoutTimeout()),false);
    await p.evaluate(()=>{DB.active=null;persist();});

    // A foreground catch-up must not discard a different session's editor.
    await begin();await advance(10000);await validate(0);
    await p.evaluate(()=>go('edit',PROGRAM[1].id));
    await p.locator('#es-title').fill('Modification a conserver');
    await p.evaluate(()=>{
      window.__time=DB.active.start+AUTO_FINISH_MS;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await p.evaluate(()=>DB.active),null);
    assert.equal(await p.evaluate(()=>route.view),'edit');
    assert.equal(await p.locator('#es-title').inputValue(),'Modification a conserver');
    await p.locator('[data-act="esave"]').click();

    // A failed automatic save retains the active workout in memory/storage.
    await begin();await advance(10000);await validate(0);
    const retained=await p.evaluate(()=>{
      const id=DB.active.id,before=DB.workouts.length,set=Storage.prototype.setItem;
      Storage.prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError');};
      try{window.__time=DB.active.start+AUTO_FINISH_MS;checkWorkoutTimeout();}
      finally{Storage.prototype.setItem=set;}
      const ok=DB.active?.id===id&&DB.workouts.length===before;
      STORAGE_WRITABLE=true;checkWorkoutTimeout();return ok;
    });
    assert(retained);assert.equal(await p.evaluate(()=>DB.active),null);

    // No guessed duration for an old draft without validation timestamps.
    await begin();await advance(10000);await validate(0);
    await p.evaluate(()=>{delete Object.values(DB.active.ex)[0][0].doneElapsedMs;window.__time=DB.active.start+AUTO_FINISH_MS;checkWorkoutTimeout();});
    assert.equal(await p.evaluate(()=>DB.workouts.at(-1).dur),null);
    assert.deepEqual(errors,[]);
    console.log('PASS: decimal reps, pauses, last-OK duration, completed clock freeze, undo, invalid edits, active backup, three-hour closure, reopen, deduplication, draft preservation and quota rollback.');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
