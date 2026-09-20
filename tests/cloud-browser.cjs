const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../MuscuApp');
const server=http.createServer(async(req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const target=file===root?path.join(root,'index.html'):file;
  try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');res.end(await fs.readFile(target));}
  catch{res.writeHead(404).end();}
});
const rows=new Map();let requests=0,writeRequests=0;
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
const jwt=id=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'test-signature'].join('.');
(async()=>{
 let browser;
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},acceptDownloads:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.addInitScript(()=>localStorage.setItem('dako_onboarded','1'));
  await page.route('**/supabase-config.js',r=>r.fulfill({contentType:'text/javascript',body:"window.DKO_SUPABASE_CONFIG={url:'https://dko-test.supabase.co',publishableKey:'sb_publishable_test'};"}));
  await context.route('https://dko-test.supabase.co/**',async route=>{
    requests++;const req=route.request(),url=new URL(req.url()),body=req.postDataJSON();
    const respond=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(url.pathname.endsWith('/otp'))return respond({});
    if(url.pathname.endsWith('/verify')){
      const id=body.email==='bob@example.test'?b:a;
      return respond({access_token:jwt(id),refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user:{id,email:body.email,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}});
    }
    if(url.pathname.endsWith('/logout'))return respond({});
    const token=req.headers().authorization?.split(' ')[1];
    const id=token?JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub:null;
    if(!id)return respond({message:'Unauthorized'},401);
    if(url.pathname.endsWith('/dko_backups'))return respond(rows.has(id)?[structuredClone(rows.get(id))]:[]);
    if(url.pathname.endsWith('/dko_save_backup')){
      writeRequests++;const old=rows.get(id);
      if(body.p_user_id!==id)return respond({code:'42501',message:'Account changed'},403);
      if((old?.revision||0)!==body.p_expected_revision)return respond({code:'40001',message:'Conflict'},409);
      const next={revision:body.p_expected_revision+1,payload:body.p_payload,updated_at:new Date().toISOString()};rows.set(id,next);
      return respond({revision:next.revision,updated_at:next.updated_at});
    }
    return respond({message:'Unhandled mock route'},500);
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.locator('#splash').waitFor({state:'detached'});
  const original=await page.evaluate(()=>JSON.stringify(PROGRAMS));
  await page.evaluate(()=>DKOCloudUI.show());
  if(process.env.AXE_PATH){
    await page.addScriptTag({path:process.env.AXE_PATH});
    const result=await page.evaluate(()=>axe.run('#sheet',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
    assert.deepEqual(result.violations.map(v=>v.id),[],'cloud login accessibility');
  }
  const login=async email=>{
    await page.locator('#cloudEmail').fill(email);
    await page.locator('#cloudLogin button').click();
    await page.getByText('Code demandé.',{exact:false}).waitFor();
    await page.locator('#cloudCode').fill('123456');await page.locator('#cloudVerify button').click();
    await page.locator('#cloudSignOut').waitFor();
  };
  await login('alice@example.test');assert.equal(writeRequests,0);
  await page.locator('#cloudSave').click();
  await page.waitForFunction(()=>document.getElementById('cloudPanel').textContent.includes('Sauvegarde à jour'));
  assert.equal(rows.get(a).revision,1);assert(rows.get(a).payload.programs.length);
  await page.evaluate(()=>{PROGRAMS[0].name='Programme local';savePrograms();});
  await page.waitForTimeout(3500);assert.equal(rows.get(a).revision,2);assert.equal(rows.get(a).payload.programs[0].name,'Programme local');
  await page.reload();await page.locator('#splash').waitFor({state:'detached'});
  await page.evaluate(()=>DKOCloudUI.show());await page.locator('#cloudSignOut').waitFor();
  await page.waitForTimeout(1500);assert.equal(rows.get(a).revision,2,'reload does not duplicate upload');
  // A remote device changes the snapshot; this device must not overwrite it.
  const peer=rows.get(a);peer.revision++;peer.payload.programs[0].name='Programme autre appareil';
  await page.evaluate(()=>{PROGRAMS[0].name='Changement non synchronise';savePrograms();});
  await page.locator('#cloudReplace').waitFor();assert.equal(rows.get(a).payload.programs[0].name,'Programme autre appareil');
  const downloadPromise=page.waitForEvent('download');await page.locator('#cloudRemoteExport').click();
  const remoteBackup=JSON.parse(await fs.readFile(await(await downloadPromise).path(),'utf8'));
  assert.equal(remoteBackup.programmes[0].name,'Programme autre appareil');
  await page.locator('#cloudRestore').click();
  await page.getByText('Sauvegarde restaurée',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>PROGRAMS[0].name),'Programme autre appareil');
  const recovery=await page.evaluate(()=>idbGet('before-cloud-restore'));
  assert.equal(JSON.parse(recovery.data.dako_programs).programs[0].name,'Changement non synchronise');
  const recoveryDownload=page.waitForEvent('download');await page.locator('#cloudRecovery').click();
  const previous=JSON.parse(await fs.readFile(await(await recoveryDownload).path(),'utf8'));
  assert.equal(previous.programmes[0].name,'Changement non synchronise');assert.equal(previous.reglages.theme,'dark');
  await page.locator('#cloudSignOut').click();await page.locator('#cloudEmail').waitFor();
  await login('bob@example.test');assert.equal(await page.locator('#cloudSave').count(),0);
  assert.equal(rows.has(b),false,'account switch does not upload previous user data');
  assert(await page.evaluate(()=>{const el=document.getElementById('cloudPanel');return el.scrollWidth<=el.clientWidth;}),'mobile content fits');
  if(process.env.AXE_PATH){
    await page.addScriptTag({path:process.env.AXE_PATH});
    const result=await page.evaluate(()=>axe.run('#sheet',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
    assert.deepEqual(result.violations.map(v=>v.id),[],'cloud account accessibility');
  }
  await page.screenshot({path:path.join(require('node:os').tmpdir(),'dko-cloud-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await page.screenshot({path:path.join(require('node:os').tmpdir(),'dko-cloud-desktop.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  // With no deployment configuration, opening Dko must not contact Supabase.
  const blank=await browser.newPage({serviceWorkers:'block'});let external=0;
  blank.on('request',r=>{if(r.url().includes('.supabase.co/'))external++;});
  await blank.goto('http://127.0.0.1:'+server.address().port+'/');await blank.locator('#splash').waitFor({state:'detached'});
  await blank.evaluate(()=>{closeSheet();DKOCloudUI.show();});
  await blank.getByText('Le cloud n’est pas encore activé pour Dko.').waitFor();assert.equal(external,0);
  assert(original.length>0&&requests>0);
  console.log('PASS browser: bundled Supabase SDK, email OTP, explicit consent, autosave, reload, conflict, remote export, restore/recovery, account switch and unconfigured offline-only mode.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
