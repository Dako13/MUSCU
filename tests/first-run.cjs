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
  try{const target=file===root?path.join(root,'index.html'):file;res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');res.end(await fs.readFile(target));}
  catch{res.writeHead(404).end();}
});

(async()=>{
  let browser;
  const out=path.join(os.tmpdir(),'dko-first-run');await fs.mkdir(out,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
    const base='http://127.0.0.1:'+server.address().port+'/';
    const open=async init=>{
      const context=await browser.newContext({viewport:{width:320,height:568},serviceWorkers:'block'});
      if(init)await context.addInitScript(init);
      const page=await context.newPage();
      await page.goto(base);await page.waitForFunction(()=>STORAGE_READY);await page.locator('#splash').waitFor({state:'detached'});
      return page;
    };
    const blank=await open();
    assert.equal(await blank.evaluate(()=>FRESH_INSTALL),true);
    assert.equal(await blank.evaluate(()=>PROGRAM.length),0);
    assert.deepEqual(await blank.evaluate(()=>[SETTINGS.poids,SETTINGS.taille,SETTINGS.age,SETTINGS.salle,SETTINGS.programOrigin]),[null,null,null,'','neutral']);
    assert.equal(await blank.locator('[data-plan="blank"]').count(),1);
    await blank.screenshot({path:path.join(out,'onboarding-320.png'),animations:'disabled'});
    await blank.locator('#obGo').click();
    assert.equal(await blank.evaluate(()=>PROGRAM.length),0);
    assert.match(await blank.locator('.session-stage').textContent(),/Créer une séance/);
    assert.equal(await blank.evaluate(()=>DKO_DATA.settings(exportPayload().reglages).poids),null);
    assert.equal(await blank.evaluate(()=>exportPayload().profil.sexe),undefined);
    await blank.screenshot({path:path.join(out,'empty-home-320.png'),animations:'disabled'});
    await blank.reload();await blank.waitForFunction(()=>STORAGE_READY);
    assert.equal(await blank.evaluate(()=>PROGRAM.length),0);
    assert.equal(await blank.evaluate(()=>SETTINGS.poids),null);

    const example=await open();
    await example.locator('[data-plan="starter"]').click();await example.locator('#obGo').click();
    assert.equal(await example.evaluate(()=>PROGRAM.length),3);
    assert.equal(await example.evaluate(()=>PROGRAM.every(s=>s.ex.length===5&&s.ex.every(e=>e.ref===null))),true);
    assert.equal(await example.evaluate(()=>DKO_DATA.cloud({schema:1,programs:PROGRAMS,activeId:ACTIVE_PID,workouts:DB.workouts,active:null,settings:SETTINGS,body:BODY}).programs[0].seances.length),3);
    await example.reload();await example.waitForFunction(()=>STORAGE_READY);
    assert.equal(await example.evaluate(()=>PROGRAM.length),3);
    await example.evaluate(()=>{createProgram('Autre',true);});
    assert.equal(await example.evaluate(()=>PROGRAM.length),3);
    await example.waitForTimeout(700);
    assert.equal(await example.evaluate(async()=>JSON.parse((await idbGet('snapshot')).data.dako_programs).programs.length),2,'mirror did not catch up after program creation');
    await example.evaluate(()=>localStorage.clear());
    await example.waitForTimeout(700);
    assert.equal(await example.evaluate(async()=>JSON.parse((await idbGet('snapshot')).data.dako_programs).programs.length),2,'mirror changed while localStorage was empty');
    const context=example.context();await example.close();
    const recovered=await context.newPage();await recovered.goto(base);await recovered.waitForFunction(()=>STORAGE_READY);
    assert.equal(await recovered.evaluate(()=>PROGRAMS.length),2,JSON.stringify(await recovered.evaluate(async()=>({fresh:FRESH_INSTALL,stored:localStorage.getItem('dako_programs'),mirror:(await idbGet('snapshot'))?.data?.dako_programs}))));
    assert.equal(await recovered.evaluate(()=>SETTINGS.programOrigin),'neutral');

    const legacy=await open(()=>{localStorage.setItem('dako_onboarded','1');localStorage.setItem('muscu_program',JSON.stringify([{id:'old',title:'Mon ancienne séance',tab:'A',ex:[]}]))});
    assert.equal(await legacy.evaluate(()=>FRESH_INSTALL),false);
    assert.equal(await legacy.evaluate(()=>PROGRAM[0].title),'Mon ancienne séance');
    assert.equal(await legacy.evaluate(()=>SETTINGS.poids),96);
    assert.equal(await legacy.locator('[data-plan]').count(),0);
    console.log('PASS first run: blank profile, optional starter, reload, cloud schema, legacy preservation');
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
