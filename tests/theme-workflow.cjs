const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'../MuscuApp');
const out=path.join(os.tmpdir(),'dko-themes');
const themes=[['dark','#ff4353'],['rose','#ee8dbb'],['emerald','#65dab0'],['gold','#e9c57a'],['glacier','#75d7e4']];
const server=http.createServer(async(req,res)=>{
  if(req.url==='/supabase-config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.DKO_SUPABASE_CONFIG={};');return;}
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{const target=file===root?path.join(root,'index.html'):file;res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');res.end(await fs.readFile(target));}
  catch{res.writeHead(404).end();}
});

(async()=>{
  let browser;
  await fs.mkdir(out,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
    const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>localStorage.setItem('dako_onboarded','1'));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.locator('#splash').waitFor({state:'detached'});
    const program=await page.evaluate(()=>JSON.stringify(PROGRAMS));
    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:844});
      for(const [theme,accent] of themes){
        await page.evaluate(()=>showSettings());
        await page.locator('#themeChips [data-th="'+theme+'"]').click();
        const actual=await page.evaluate(()=>({theme:SETTINGS.theme,stored:JSON.parse(localStorage.getItem('muscu_settings')).theme,accent:getComputedStyle(document.documentElement).getPropertyValue('--ac').trim(),valid:DKO_DATA.settings(exportPayload().reglages).theme,program:JSON.stringify(PROGRAMS),overflow:document.documentElement.scrollWidth>innerWidth}));
        assert.deepEqual(actual,{theme,stored:theme,accent,valid:theme,program,overflow:false});
        assert.equal(await page.locator('#themeChips [aria-pressed="true"]').count(),1);
        assert.equal(await page.locator('#sheet').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
        const actualMap=await page.evaluate(()=>silhouette('front',()=>0).match(/viewBox="([^"]+)"/)[1]);
        assert.equal(actualMap,theme==='rose'?await page.evaluate(()=>BODY_VB_FRONT_F):await page.evaluate(()=>BODY_VB_FRONT));
        if(width===390){await page.locator('#sheet').evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.join(out,'settings-'+theme+'.png'),animations:'disabled'});}
        await page.evaluate(()=>closeSheet());
        if(width===390)await page.screenshot({path:path.join(out,'home-'+theme+'.png'),animations:'disabled'});
      }
    }
    await page.setViewportSize({width:390,height:844});
    await page.reload();await page.locator('#splash').waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>SETTINGS.theme),'glacier');
    assert.deepEqual(errors,[]);
    console.log('Theme workflow passed; screenshots: '+out);
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
