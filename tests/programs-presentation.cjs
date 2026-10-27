const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../MuscuApp'),out=path.join(os.tmpdir(),'dko-presentation');
const server=http.createServer(async(req,res)=>{
  if(req.url==='/supabase-config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.DKO_SUPABASE_CONFIG={};');return;}
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{const target=file===root?path.join(root,'index.html'):file;res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');res.end(await fs.readFile(target));}
  catch{res.writeHead(404).end();}
});
(async()=>{
  let browser;
  await fs.mkdir(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
    const p=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(()=>{localStorage.setItem('dako_onboarded','1');localStorage.setItem('dko_cloud_welcome','1');});
    await p.goto('http://127.0.0.1:'+server.address().port+'/');
    await p.waitForFunction(()=>typeof STORAGE_READY!=='undefined'&&STORAGE_READY);
    await p.locator('#splash').waitFor({state:'detached'});
    const fixture=await p.evaluate(()=>{
      const s=PROGRAM[0],e=s.ex[0];
      s.title='Dos, ischio-jambiers et deltoides posterieurs <test>';
      DB.workouts=[snapshotWorkout({date:todayISO(),seance:s.id,ex:{[e.id]:[{w:25,r:10,done:true}]},exNotes:{[e.id]:'Note a conserver'}})];
      persist();savePrograms();go('programs');
      return {programs:JSON.stringify(PROGRAMS),history:JSON.stringify(DB.workouts),settings:JSON.stringify(SETTINGS),ids:PROGRAM.map(s=>s.id)};
    });
    const action=sid=>p.locator('[data-act=sessionactions][data-s="'+sid+'"]');
    const dragFirstBelowSecond=async(cancel=false)=>{
      // Raw mouse coordinates need stable cards after the menu/render animation.
      await p.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
      const cards=p.locator('[data-dragsort=seance] > [data-dragitem]');
      await cards.nth(1).scrollIntoViewIfNeeded();
      await cards.first().locator('.grip').hover();
      const target=await cards.nth(1).boundingBox();
      await p.mouse.down();
      await p.locator('.dragging').waitFor({state:'visible'});
      await p.mouse.move(target.x+target.width/2,target.y+target.height*.8);
      await p.waitForFunction(id=>document.querySelector('[data-dragsort=seance] > [data-dragitem]')?.dataset.sid===id,fixture.ids[1]);
      assert.equal(await cards.first().getAttribute('data-sid'),fixture.ids[1],'drag must visually move the card before release');
      if(cancel)await p.locator('.dragging').dispatchEvent('pointercancel');
      await p.mouse.up();
    };
    for(const width of [320,390,1280]){
      await p.setViewportSize({width,height:844});
      await p.evaluate(()=>go('programs'));
      assert(await p.locator('.seancelist').evaluate(el=>el.scrollWidth<=el.clientWidth));
      assert.equal(await p.locator('.scard.mgmt').first().locator('button').count(),2);
      assert(await action(fixture.ids[0]).evaluate(el=>el.getBoundingClientRect().width>=44));
      await p.screenshot({path:path.join(out,'programs-'+width+'.png'),animations:'disabled'});
      await p.evaluate(()=>go('machines'));
      const personal=p.locator('[data-act=personalexercise]').first();
      assert(await personal.isVisible());
      assert(await personal.evaluate(el=>{
        const n=el.querySelector('.mrow-n').getBoundingClientRect(),m=el.querySelector('.mrow-mu').getBoundingClientRect();
        return m.top>=n.bottom+4&&el.scrollWidth<=el.clientWidth;
      }),'personal exercise metadata must have its own line');
      assert(await p.locator('#mlist').evaluate(el=>el.scrollWidth<=el.clientWidth));
      await p.screenshot({path:path.join(out,'library-'+width+'.png'),animations:'disabled'});
    }
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),fixture.programs);
    assert.equal(await p.evaluate(()=>JSON.stringify(SETTINGS)),fixture.settings);
    await p.setViewportSize({width:390,height:844});
    await p.evaluate(()=>go('programs'));
    await action(fixture.ids[0]).click();
    assert(await p.locator('[data-session-move="-1"]').isDisabled());
    await p.screenshot({path:path.join(out,'session-actions.png'),animations:'disabled'});
    await p.keyboard.press('Escape');
    assert(await action(fixture.ids[0]).evaluate(el=>el===document.activeElement));
    await action(fixture.ids[0]).click();
    await p.locator('[data-session-move="1"]').click();
    assert.deepEqual(await p.evaluate(()=>PROGRAM.slice(0,2).map(s=>s.id)),[fixture.ids[1],fixture.ids[0]]);
    assert(await action(fixture.ids[0]).evaluate(el=>el===document.activeElement));
    await p.reload();await p.locator('#splash').waitFor({state:'detached'});
    await p.evaluate(()=>go('programs'));
    assert.deepEqual(await p.evaluate(()=>PROGRAM.slice(0,2).map(s=>s.id)),[fixture.ids[1],fixture.ids[0]]);
    await action(fixture.ids[0]).click();await p.locator('[data-session-move="-1"]').click();
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),fixture.programs);
    assert.deepEqual(await p.evaluate(()=>{
      const ids=PROGRAM.map(s=>s.id);
      return [reorderSeances(ids.slice(1)),reorderSeances(ids.map(()=>ids[0])),reorderSeances(ids.map((id,i)=>i===0?'missing':id)),moveSeance(ids[0],0)];
    }),[false,false,false,false]);
    await dragFirstBelowSecond(true);
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),fixture.programs,'cancelled drag must preserve the program');
    assert.equal(await p.locator('[data-dragsort=seance] > [data-dragitem]').first().getAttribute('data-sid'),fixture.ids[0]);
    await dragFirstBelowSecond();
    await p.reload();await p.locator('#splash').waitFor({state:'detached'});await p.evaluate(()=>go('programs'));
    assert.deepEqual(await p.evaluate(()=>PROGRAM.slice(0,2).map(s=>s.id)),[fixture.ids[1],fixture.ids[0]],'drag order must survive reload');
    await action(fixture.ids[0]).click();await p.locator('[data-session-move="-1"]').click();
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),fixture.programs);
    await action(fixture.ids.at(-1)).click();
    assert(await p.locator('[data-session-move="1"]').isDisabled());
    await p.keyboard.press('Escape');
    await p.locator('[data-act=editseance][data-s="'+fixture.ids[0]+'"]').click();
    assert(await p.locator('#exlist').isVisible());
    await p.evaluate(()=>{startWorkout(PROGRAM[0].id);go('programs');});
    const activeBefore=await p.evaluate(()=>JSON.stringify(DB.active));
    await action(fixture.ids[0]).click();
    assert(await p.locator('#sessionDelete').isDisabled());
    assert(await p.locator('#sessionDeleteReason').isVisible());
    assert.equal(await p.evaluate(()=>deleteSeance(PROGRAM[0].id)),false);
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.active)),activeBefore);
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),fixture.programs);
    await p.evaluate(()=>{closeSheet();DB.active=null;persist();go('programs');});
    await action(fixture.ids[0]).click();
    const storedBefore=await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS));
    await p.evaluate(()=>{
      window.originalSetItem=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key===KEY_PROGRAMS)throw new DOMException('Test quota','QuotaExceededError');return window.originalSetItem.call(this,key,value);};
    });
    await p.locator('[data-session-move="1"]').click();
    assert(await p.locator('[data-session-move="1"]').isVisible(),'failed reorder must keep the menu open');
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),fixture.programs);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS)),storedBefore);
    assert.match(await p.locator('#toast').textContent(),/Sauvegarde impossible/);
    await p.keyboard.press('Escape');
    await dragFirstBelowSecond();
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),fixture.programs,'failed drag must preserve memory');
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS)),storedBefore);
    assert.equal(await p.locator('[data-dragsort=seance] > [data-dragitem]').first().getAttribute('data-sid'),fixture.ids[0],'failed drag must restore the displayed order');
    await action(fixture.ids[0]).click();
    p.once('dialog',d=>d.accept());await p.locator('#sessionDelete').click();
    assert(await p.locator('#sessionDelete').isVisible(),'failed deletion must keep the menu open');
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),fixture.programs);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS)),storedBefore);
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.workouts)),fixture.history);
    assert.match(await p.locator('#toast').textContent(),/Sauvegarde impossible/);
    await p.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;closeSheet();});
    await p.reload();await p.locator('#splash').waitFor({state:'detached'});
    await p.evaluate(()=>go('programs'));
    await action(fixture.ids[0]).click();
    p.once('dialog',d=>d.dismiss());await p.locator('#sessionDelete').click();
    assert.equal(await p.evaluate(()=>JSON.stringify(PROGRAMS)),fixture.programs);
    assert(await p.locator('#sessionDelete').isVisible());
    p.once('dialog',d=>d.accept());await p.locator('#sessionDelete').click();
    assert.equal(await p.evaluate(()=>PROGRAM.length),fixture.ids.length-1);
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.workouts)),fixture.history);
    await p.reload();await p.locator('#splash').waitFor({state:'detached'});
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.workouts)),fixture.history);
    assert.equal(await p.evaluate(()=>JSON.stringify(SETTINGS)),fixture.settings);
    assert.deepEqual(errors,[]);
    console.log('PASS: responsive library rows, session actions, keyboard focus, atomic button/drag reorder, cancelled drag, deletion cancellation and history preservation. Screenshots: '+out);
  }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
