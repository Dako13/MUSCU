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
  try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');res.end(await fs.readFile(target));}
  catch{res.writeHead(404).end();}
});

(async()=>{
  let browser;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
    const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>localStorage.setItem('dako_onboarded','1'));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.locator('#splash').waitFor({state:'detached'});
    const before=await page.evaluate(()=>{
      const s=PROGRAM[0];go('seance',s.id);startWorkout(s.id);
      return {id:s.ex[0].id,program:JSON.stringify(PROGRAMS),sets:s.ex[0].sets};
    });
    await page.locator('.card:visible [data-act="replaceex"]').click();
    assert(await page.locator('#sheet .replace-option').count()>0);
    await page.locator('#sheet .replace-option').first().click();
    const after=await page.evaluate(before=>{
      const id=DB.active.exerciseOrder[0],exercise=workoutExercise(DB.active,id);
      const cloud=DKO_DATA.cloud({schema:1,programs:PROGRAMS,activeId:ACTIVE_PID,workouts:DB.workouts,active:DB.active,settings:SETTINGS,body:BODY});
      return {id,name:exercise.name,sourceGone:!Object.hasOwn(DB.active.ex,before.id),sets:DB.active.ex[id].length,programSame:JSON.stringify(PROGRAMS)===before.program,cloudId:cloud.active.exerciseOrder[0]};
    },before);
    assert.notEqual(after.id,before.id);
    assert(after.name);
    assert(after.sourceGone);
    assert.equal(after.sets,before.sets);
    assert(after.programSame);
    assert.equal(after.cloudId,after.id);
    assert.equal(await page.locator('.card:visible').getAttribute('data-ex'),after.id);
    await page.locator('.card:visible [data-act="exinfo"]').click();
    assert.match(await page.locator('#sheet h2').textContent(),new RegExp(after.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.deepEqual(errors,[]);
    console.log('PASS: temporary workout replacement keeps the program unchanged and validates for cloud backup.');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
