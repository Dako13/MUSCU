const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
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
    const p=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(()=>{localStorage.setItem('dako_onboarded','1');localStorage.setItem('dko_cloud_welcome','1');});
    await p.goto('http://127.0.0.1:'+server.address().port+'/');await ready(p);
    const fixture=await p.evaluate(()=>{
      const s=PROGRAM[0],e=s.ex[0];
      DB.workouts=['Haut du corps','Jambes','Dos'].map((title,i)=>{
        const w=snapshotWorkout({id:'history-'+i,date:'2026-11-0'+(i+1),seance:s.id,dur:600,session:{title,tab:'S'+i},ex:{[e.id]:[{w:20+i,r:8,done:true}]},exNotes:{[e.id]:['Bonne isolation','Équilibre correct','<img src=x onerror="window.injected=true">'][i]}});
        w.exMeta[e.id].name=['Développé couché haltères','Presse à cuisses','Tirage vertical'][i];return w;
      });persist();startWorkout(s.id);go('suivi');
      window.mirrorCalls=0;mirrorSoon=()=>window.mirrorCalls++;
      return {db:JSON.stringify(DB),stored:localStorage.getItem(KEY),programs:localStorage.getItem(KEY_PROGRAMS),settings:localStorage.getItem(KEY_SETTINGS),active:JSON.stringify(DB.active),eid:e.id};
    });
    const search=p.locator('#historyQuery'),cards=p.locator('#historyList .hcard:visible');
    assert.equal(await cards.count(),3);
    for(const [q,expected] of [['DEVELOPPE HALTERES',['0']],['equilibre',['1']],['Dos',['2']],['2026-11-02',['1']],['02/11/2026',['1']],['bonne isolation',['0']],['introuvable',[]],['   ',['2','1','0']]]){
      await search.fill(q);
      assert.deepEqual(await cards.locator('[data-act=wedit]').evaluateAll(nodes=>nodes.map(n=>n.dataset.w)),expected);
      assert.equal(await p.locator('#historyEmpty').isVisible(),expected.length===0);
      assert.equal(await search.evaluate(el=>document.activeElement===el),true);
    }
    await search.fill('"/><img src=x onerror="window.injected=true">');
    await p.evaluate(()=>render());
    assert.equal(await search.inputValue(),'"/><img src=x onerror="window.injected=true">');
    assert.equal(await p.evaluate(()=>!!window.injected),false);
    assert.equal(await p.locator('#historyList img').count(),0);
    await p.locator('#historyClear').click();assert.equal(await cards.count(),3);
    assert.equal(await search.evaluate(el=>document.activeElement===el),true);
    await search.fill('presse');await cards.locator('summary').click();
    await search.fill('cuisses');assert(await cards.locator('details').evaluate(el=>el.open));
    await p.locator('[data-act=suivitab][data-t=stats]').click();
    await p.locator('[data-act=suivitab][data-t=history]').click();
    assert.equal(await search.inputValue(),'cuisses');assert.equal(await cards.count(),1);
    assert.equal(await p.evaluate(()=>JSON.stringify(DB)),fixture.db);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY)),fixture.stored);
    assert.equal(await p.evaluate(()=>window.mirrorCalls),0);
    for(const width of [320,390,1280]){
      await p.setViewportSize({width,height:900});
      for(const theme of ['dark','rose']){
        await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
        await p.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
        const box=await search.boundingBox();assert(box.x>=0&&box.x+box.width<=width);
        assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        await p.screenshot({path:path.join(os.tmpdir(),`dko-history-search-${width}-${theme}.png`),fullPage:true});
      }
    }
    // Filtered actions must retain the original database index, not the visible index.
    await cards.locator('summary').click();await cards.locator('[data-act=wedit]').click();
    await p.locator('.we-note').first().fill('Note modifiee');await p.locator('#wsave').click();
    assert.equal(await p.evaluate(id=>DB.workouts[1].exNotes[id],fixture.eid),'Note modifiee');
    assert.equal(await p.evaluate(id=>DB.workouts[0].exNotes[id],fixture.eid),'Bonne isolation');
    await cards.locator('summary').click();p.once('dialog',d=>d.accept());await cards.locator('[data-act=wdel]').click();
    assert.deepEqual(await p.evaluate(()=>DB.workouts.map(w=>w.id)),['history-0','history-2']);
    assert(await p.locator('#historyEmpty').isVisible());
    await p.locator('#historyClear').click();assert.equal(await cards.count(),2);
    assert.deepEqual(await cards.locator('[data-act=wedit]').evaluateAll(nodes=>nodes.map(n=>n.dataset.w)),['1','0']);
    assert.equal(await p.evaluate(()=>JSON.stringify(DB.active)),fixture.active);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_PROGRAMS)),fixture.programs);
    assert.equal(await p.evaluate(()=>localStorage.getItem(KEY_SETTINGS)),fixture.settings);
    await p.reload();await ready(p);await p.evaluate(()=>go('suivi'));
    assert.equal(await search.inputValue(),'');assert.equal(await cards.count(),2);
    assert.deepEqual(errors,[]);
    console.log('PASS: history search by saved exercise/title/note/date, accents/multiple terms, empty/clear, focus/open details, tab retention, no writes, escaping, filtered edit/delete indices, reload and responsive themes.');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
