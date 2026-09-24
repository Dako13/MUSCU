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
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
    const context=await browser.newContext({viewport:{width:320,height:568},serviceWorkers:'block',acceptDownloads:true});
    const base='http://127.0.0.1:'+server.address().port+'/';
    const first=await context.newPage();await first.goto(base);await first.waitForFunction(()=>typeof STORAGE_READY!=='undefined'&&STORAGE_READY);
    await first.locator('#obGo').click();
    const second=await context.newPage();await second.goto(base);await second.waitForFunction(()=>typeof STORAGE_READY!=='undefined'&&STORAGE_READY);
    assert.equal(await second.evaluate(()=>STORAGE_CONFLICT),false);
    const before=await second.evaluate(()=>localStorage.getItem(KEY));
    await first.evaluate(()=>{PROGRAMS[0].name='Programme modifié dans le premier onglet';savePrograms();});
    await second.locator('#storageConflict').waitFor();
    assert.deepEqual(await second.evaluate(()=>[STORAGE_CONFLICT,STORAGE_WRITABLE]),[true,false]);
    await second.evaluate(()=>{PROGRAMS[0].name='Ancienne copie modifiée';savePrograms();DB.workouts.push({id:'stale',date:todayISO(),seance:'stale',dur:0,ex:{}});persist();});
    assert.equal(await second.evaluate(()=>JSON.parse(localStorage.getItem(KEY_PROGRAMS)).programs[0].name),'Programme modifié dans le premier onglet');
    assert.equal(await second.evaluate(()=>localStorage.getItem(KEY)),before);
    await second.waitForTimeout(650);
    assert.equal(await second.evaluate(async()=>JSON.parse((await idbGet('snapshot')).data[KEY_PROGRAMS]).programs[0].name),'Programme modifié dans le premier onglet');
    await second.screenshot({path:path.join(os.tmpdir(),'dko-cross-tab-320.png'),animations:'disabled'});
    assert(await second.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'conflict dialog overflows 320px');
    const lastBackup=await second.evaluate(()=>localStorage.getItem('dako_lastbackup'));
    const [download]=await Promise.all([second.waitForEvent('download'),second.locator('#conflictExport').click()]);
    assert.match(download.suggestedFilename(),/^dako-copie-onglet-.*\.json$/);
    assert.equal(await second.evaluate(()=>localStorage.getItem('dako_lastbackup')),lastBackup);
    await second.locator('#conflictReload').click();await second.waitForFunction(()=>typeof STORAGE_READY!=='undefined'&&STORAGE_READY&&!STORAGE_CONFLICT);
    assert.equal(await second.evaluate(()=>PROGRAMS[0].name),'Programme modifié dans le premier onglet');
    assert.equal(await second.locator('#storageConflict').count(),0);
    assert.equal(await second.evaluate(()=>DB.workouts.some(w=>w.id==='stale')),false);
    await first.evaluate(()=>{
      window.releaseIDB=false;
      const open=indexedDB.open('dako_store',1);
      open.onsuccess=()=>{
        const db=open.result,tx=db.transaction('kv','readwrite'),store=tx.objectStore('kv');
        const keepAlive=()=>{const request=store.get('test-lock');request.onsuccess=()=>{if(!window.releaseIDB)keepAlive();};};
        keepAlive();window.idbBlocked=true;tx.oncomplete=()=>db.close();
      };
    });
    await first.waitForFunction(()=>window.idbBlocked);
    const third=await context.newPage();await third.goto(base);
    await third.waitForFunction(()=>typeof STORAGE_READY!=='undefined'&&typeof PROGRAMS!=='undefined'&&!STORAGE_READY&&PROGRAMS.length>0);
    assert.equal(await third.evaluate(()=>PROGRAMS[0].name),'Programme modifié dans le premier onglet');
    await first.evaluate(()=>{PROGRAMS[0].name='Modification pendant le démarrage';savePrograms();window.releaseIDB=true;});
    await third.locator('#storageConflict').waitFor();
    assert.equal(await third.evaluate(()=>STORAGE_WRITABLE),false);
    assert.equal(await third.evaluate(()=>JSON.parse(localStorage.getItem(KEY_PROGRAMS)).programs[0].name),'Modification pendant le démarrage');
    await third.locator('#conflictReload').click();await third.waitForFunction(()=>typeof STORAGE_READY!=='undefined'&&STORAGE_READY&&!STORAGE_CONFLICT);
    assert.equal(await third.evaluate(()=>PROGRAMS[0].name),'Modification pendant le démarrage');
    console.log('PASS cross-tab: stale tab locked, writes refused, export available, IndexedDB preserved, reload receives latest data');
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
