const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../MuscuApp'),out=path.join(os.tmpdir(),'dko-home-media');
const server=http.createServer(async(req,res)=>{
  if(req.url==='/supabase-config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.DKO_SUPABASE_CONFIG={};');return;}
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{const target=file===root?path.join(root,'index.html'):file;res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg'})[path.extname(target)]||'application/octet-stream');res.end(await fs.readFile(target));}
  catch{res.writeHead(404).end();}
});
(async()=>{
  let browser;
  await fs.mkdir(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
    await context.addInitScript(()=>{localStorage.setItem('dako_onboarded','1');localStorage.setItem('dko_cloud_welcome','1');});
    const p=await context.newPage(),errors=[],base='http://127.0.0.1:'+server.address().port+'/';
    p.on('pageerror',e=>errors.push(e.message));
    await p.goto(base);await p.waitForFunction(()=>STORAGE_READY&&navigator.serviceWorker.controller);
    await p.locator('#splash').waitFor({state:'detached'});
    await p.evaluate(()=>document.fonts.ready);
    const original=await p.evaluate(()=>JSON.stringify({PROGRAMS,DB,SETTINGS,BODY}));
    for(const [width,height] of [[320,568],[390,844],[1280,900]]){
      await p.setViewportSize({width,height});await p.evaluate(()=>go('home'));
      assert(await p.locator('.stage-start').evaluate(el=>el.getBoundingClientRect().bottom<=document.getElementById('tabbar').getBoundingClientRect().top));
      if(width===390)assert(await p.locator('.weekly-lead').evaluate(el=>el.getBoundingClientRect().bottom<=document.getElementById('tabbar').getBoundingClientRect().top),'weekly summary must be visible on mobile');
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await p.screenshot({path:path.join(out,'home-'+width+'.png'),animations:'disabled'});
      await p.evaluate(()=>go('suivi'));
      assert(await p.locator('.followup-empty').isVisible());
      assert.equal(await p.locator('.suivigrid,.suivi-safe,.suiviseg').count(),0);
      assert(await p.locator('[data-act=bilan]').isVisible(),'body tracking must remain available before the first workout');
      await p.screenshot({path:path.join(out,'empty-followup-'+width+'.png'),animations:'disabled'});
      await p.locator('.followup-empty [data-act=home]').click();
      assert.equal(await p.evaluate(()=>route.view),'home');
    }
    assert.equal(await p.evaluate(()=>JSON.stringify({PROGRAMS,DB,SETTINGS,BODY})),original,'viewing must preserve user data');
    await p.evaluate(()=>{startWorkout(PROGRAM[0].id);go('suivi');});
    await p.locator('.followup-empty [data-act=open]').click();
    assert.equal(await p.evaluate(()=>route.seance),await p.evaluate(()=>DB.active.seance));
    await p.evaluate(()=>{
      DB.active=null;stopTimer();
      const s=PROGRAM[0],e=s.ex[0];
      DB.workouts=[snapshotWorkout({date:todayISO(),seance:s.id,ex:{[e.id]:[{w:20,r:8,done:true}]}})];
      persist();go('suivi');
    });
    assert(await p.locator('.suiviseg').isVisible());assert.equal(await p.locator('.hcard').count(),1);
    const matches=await p.evaluate(()=>({valid:exImage('Développé couché (haltères)'),unsupported:exImage('Hip Thrust (machine)'),wrongEquipment:exImage('Élévations latérales (poulie)'),unilateral:exImage('Tirage vertical unilatéral câble (banc assis)')}));
    assert(matches.valid.endsWith('Dumbbell_Bench_Press/0.jpg'));
    assert.equal(matches.unsupported,null);assert.equal(matches.wrongEquipment,null);assert.equal(matches.unilateral,null);
    const photos=await p.evaluate(()=>EXERCISE_PHOTOS);
    const review=await context.newPage();await review.setViewportSize({width:1200,height:1350});
    await review.setContent('<html><body style="margin:16px;font:14px sans-serif;display:grid;grid-template-columns:repeat(3,1fr);gap:16px">'+photos.map(photo=>'<section><p>'+photo.id+'</p>'+[0,1].map(i=>'<img style="width:48%;height:230px;object-fit:contain" src="'+base+'images/exercises/'+photo.id+'/'+i+'.jpg">').join('')+'</section>').join('')+'</body></html>');
    await review.locator('img').evaluateAll(images=>Promise.all(images.map(im=>im.decode())));
    assert.equal(await review.locator('img').count(),24);
    await review.screenshot({path:path.join(out,'photo-review.png'),fullPage:true});await review.close();
    await p.setViewportSize({width:390,height:844});await p.evaluate(()=>go('machines'));
    await p.locator('#mq').fill('développé couché haltères');
    const row=p.locator('#mlist .mrow:visible').first();
    await row.locator('img').evaluate(im=>im.decode());
    await p.screenshot({path:path.join(out,'library-photos.png'),animations:'disabled'});
    await row.click();
    assert.equal(await p.locator('.movement-photos img').count(),2);
    await p.locator('.movement-photos img').evaluateAll(images=>Promise.all(images.map(im=>im.decode())));
    await p.screenshot({path:path.join(out,'movement-detail.png'),animations:'disabled'});
    await p.evaluate(()=>closeSheet());
    await context.setOffline(true);await p.reload();await p.waitForFunction(()=>STORAGE_READY);
    await p.evaluate(()=>go('machines'));await p.locator('#mq').fill('développé couché haltères');
    await p.locator('#mlist .mrow:visible').first().click();
    await p.locator('.movement-photos img').evaluateAll(images=>Promise.all(images.map(im=>im.decode())));
    assert.equal(await p.evaluate(async()=>{
      const cached=await caches.open('dako-'+APP_VERSION);
      const found=await Promise.all(EXERCISE_PHOTOS.flatMap(photo=>[0,1].map(i=>cached.match('./images/exercises/'+photo.id+'/'+i+'.jpg'))));
      return found.filter(Boolean).length;
    }),24);
    await context.setOffline(false);
    const broken=await browser.newContext({viewport:{width:320,height:568},serviceWorkers:'block'});
    await broken.addInitScript(()=>{localStorage.setItem('dako_onboarded','1');localStorage.setItem('dko_cloud_welcome','1');});
    await broken.route('**/images/exercises/**',r=>r.abort());
    const b=await broken.newPage();await b.goto(base);await b.waitForFunction(()=>STORAGE_READY);
    await b.evaluate(()=>go('machines'));await b.locator('#mq').fill('développé couché haltères');
    const failed=b.locator('#mlist .mrow:visible').first();
    await failed.locator('img').waitFor({state:'detached'});
    assert(await failed.locator('.exercise-preview svg').isVisible());
    await failed.click();await b.locator('.movement-photos img').waitFor({state:'detached'});
    assert(await b.locator('#sheet h2').isVisible());
    await broken.route('**/exercise-media.js',r=>r.abort());
    await b.reload();await b.waitForFunction(()=>STORAGE_READY);
    await b.evaluate(()=>go('machines'));await b.locator('#mq').fill('développé couché haltères');
    assert(await b.locator('#mlist .mrow:visible').first().isVisible(),'missing optional media must not prevent startup');
    await broken.close();
    assert.deepEqual(errors,[]);
    console.log('PASS: compact home, empty/active/existing followup, preserved body tracking and data, exact photo mappings, 24 offline photos, broken-image fallback. Screenshots: '+out);
  }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
