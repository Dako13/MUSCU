const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const {PGlite}=require(process.env.PGLITE_PATH||'@electric-sql/pglite');
const root=path.resolve(__dirname,'../MuscuApp'),db=new PGlite();
const student='00000000-0000-0000-0000-000000000001',coach='00000000-0000-0000-0000-000000000002';
let queue=Promise.resolve();
function queryAs(id,action,args={},fn='dko_coach'){
 if(!['dko_coach','dko_coach_template'].includes(fn))throw new Error('Unknown RPC');
 const p=queue.then(async()=>{await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);return (await db.query(`select ${fn}($1,$2::jsonb) as r`,[action,JSON.stringify({account:id,...args})])).rows[0].r;});
 queue=p.catch(()=>{});return p;
}
const server=http.createServer(async(req,res)=>{
 if(req.url==='/test-rpc'){
  let body='';for await(const part of req)body+=part;
  try{const {id,action,args,fn}=JSON.parse(body);const data=await queryAs(id,action,args,fn);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data,error:null}));}
  catch(e){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:null,error:{code:e.code,message:e.message}}));}return;
 }
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname),target=file===root?path.join(root,'index.html'):file;
 if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');res.end(await fs.readFile(target));}catch{res.writeHead(404).end();}
});
(async()=>{
 let browser;
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,is_anonymous boolean default false);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;`);
  for(const id of [student,coach])await db.query('insert into auth.users(id) values($1)',[id]);
  for(const name of ['202609200001_private_backups.sql','20260923092448_dko_coaching.sql','20260923145548_coach_templates.sql'])await db.exec(await fs.readFile(path.join(__dirname,'../supabase/migrations',name),'utf8'));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({channel:'msedge',headless:true});
  const errors=[];
  async function connect(page,id){
   await page.evaluate(id=>{
    window.testState={user:{id},enabled:true,phase:'saved',mismatch:false};
    DKOCloudUI.coachContext=()=>({project:'test',state:testState,client:{rpc:async(fn,body)=>fetch('/test-rpc',{method:'POST',body:JSON.stringify({id:testState.user.id,fn,...body})}).then(r=>r.json())}});
    DKOCoachUI.accountChanged();
   },id);
  }
  async function pageFor(id){
   const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
   await context.route('**/supabase-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.DKO_SUPABASE_CONFIG={};'}));
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.addInitScript(()=>localStorage.setItem('dako_onboarded','1'));
   await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.locator('#splash').waitFor({state:'detached'});
   await connect(page,id);return page;
  }
  const s=await pageFor(student),c=await pageFor(coach);
  const ready=page=>page.waitForFunction(()=>!document.querySelector('[data-coach="refresh"]')?.disabled);
  const before=await s.evaluate(()=>{
   PROGRAMS=[{id:'p_student',name:'Programme élève',seances:[{id:'s_student',title:'Jambes',tab:'A',rest:180,ex:[{id:'e_student',name:'Squat',sets:3,reps:'8',unit:'kg',ref:40,musP:['quads'],musS:[],notes:'Consigne avant coach'}]}]}];ACTIVE_PID='p_student';savePrograms();
   DB.workouts=[snapshotWorkout({id:'w_old',date:'2026-09-20',seance:'s_student',dur:1200,ex:{e_student:[{w:40,r:8,done:true}]},exNotes:{e_student:'Bon ressenti'}})];persist();
   SETTINGS.objectif='Privé';BODY=[{date:'2026-09-20',vals:{poids:78}}];saveSettings();saveBody();
   return {workouts:JSON.stringify(DB.workouts),settings:JSON.stringify(SETTINGS),body:JSON.stringify(BODY)};
  });
  const payload=await s.evaluate(()=>DKO_DATA.cloud({schema:1,programs:PROGRAMS,activeId:ACTIVE_PID,workouts:DB.workouts,active:null,settings:SETTINGS,body:BODY}));
  queue=queue.then(async()=>{await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[student]);await db.query('select dko_save_backup($1::jsonb,0,$2::uuid)',[JSON.stringify(payload),student]);});await queue;
  for(const [page,label] of [[s,'Élève test'],[c,'Coach test']]){
   await page.evaluate(()=>DKOCoachUI.open());await page.locator('#coachRegister input').fill(label);await page.locator('#coachRegister button').click();await page.locator('.coach-identity').waitFor();
  }
  await c.locator('[data-mode="templates"]').click();await c.locator('[data-coach="new-template"]').click();
  await c.locator('[data-field="p.name"]').fill('Jambes modèle');await c.locator('[data-coach="new-session"]').click();
  await c.locator('[data-field="s.title"]').fill('Jambes modèle');await c.locator('[data-coach="new-exercise"]').click();
  await c.locator('[data-field="e.name"]').fill('Presse à cuisses');await c.locator('[data-field="e.ref"]').fill('99');
  await c.locator('#coachEditor button[type="submit"]').click();await c.getByText('Modèle enregistré.',{exact:true}).waitFor();
  assert(await c.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'template list overflows mobile');
  await c.screenshot({path:path.join(require('node:os').tmpdir(),'dko-coach-templates-mobile.png'),fullPage:true,animations:'disabled'});
  await c.setViewportSize({width:320,height:568});
  assert(await c.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'template list overflows 320px');
  await c.setViewportSize({width:390,height:844});
  const model=(await queryAs(coach,'list',{},'dko_coach_template'))[0];
  assert.equal((await queryAs(coach,'read',{id:model.id},'dko_coach_template')).program.seances[0].ex[0].ref,null);
  assert.deepEqual(await queryAs(student,'list',{},'dko_coach_template'),[]);
  await c.locator('[data-mode="coach"]').click();await c.locator('#coachJoin').waitFor();
  await s.locator('#coachConsent').check();await s.locator('[data-coach="enable"]').click();await s.locator('.coach-code code').waitFor();
  const code=await s.locator('.coach-code code').textContent();
  await c.locator('[data-mode="coach"]').click();await c.locator('#coachJoin input').fill(code);await c.locator('#coachJoin button').click();await c.locator('[data-coach="edit"]').waitFor();
  assert.equal(await c.locator('#coachProgressExercise option').textContent(),'Squat');
  assert.equal(await c.locator('.coach-progress-table tbody').textContent(),'2026-09-2040 kg8');
  assert.equal(await c.getByText('Bon ressenti',{exact:true}).count(),0);
  await c.setViewportSize({width:1280,height:900});await c.screenshot({path:path.join(require('node:os').tmpdir(),'dko-coach-dossier-desktop.png'),fullPage:true,animations:'disabled'});
  await c.evaluate(()=>{
    const original=DKOCloudUI.coachContext;
    window.restoreCoachContext=()=>{DKOCloudUI.coachContext=original;};
    DKOCloudUI.coachContext=()=>{
      const context=original(),rpc=context.client.rpc;
      return {...context,client:{...context.client,rpc:async(name,body)=>{
        const result=await rpc(name,body);
        if(name==='dko_coach'&&body.action==='read'&&result.data?.workouts?.length){
          const workout=result.data.workouts[0];
          result.data.workouts=Array.from({length:25},(_,i)=>({...workout,id:'w_page_'+i,
            ex:{...workout.ex,e_assisted:[{w:45,r:8,done:true},{w:30,r:8,done:true}]},
            exMeta:{...workout.exMeta,e_assisted:{name:'Dips (machine assistée)',unit:'kg'}}}));
        }
        return result;
      }}};
    };
  });
  await c.locator('[data-coach="back"]').click();await c.locator('[data-coach="student"]').waitFor();await c.locator('[data-coach="student"]').click();
  await c.locator('#coachHistoryList .coach-workout').first().waitFor();
  assert.equal(await c.locator('#coachHistoryList .coach-workout').count(),20);
  assert.equal(await c.locator('#coachHistoryCount').textContent(),'20 sur 25 séances');
  await c.locator('#coachProgressExercise').selectOption('e_assisted');
  assert.match(await c.locator('.coach-progress-table thead').textContent(),/Assistance min\./);
  assert.match(await c.locator('.coach-progress-table tbody tr').first().textContent(),/30 kg/);
  await c.locator('[data-coach="history-more"]').click();
  assert.equal(await c.locator('#coachHistoryList .coach-workout').count(),25);
  assert.equal(await c.locator('[data-coach="history-more"]').count(),0);
  await c.evaluate(()=>restoreCoachContext());
  await c.locator('[data-coach="back"]').click();await c.locator('[data-coach="student"]').waitFor();
  assert.equal(await c.locator('.coach-overview b').first().textContent(),'1');
  await c.locator('#coachStudentSearch').fill('eleve');
  assert.equal(await c.locator('.coach-student:visible').count(),1,'search ignores accents');
  await c.locator('#coachStudentSearch').fill('introuvable');
  assert.equal(await c.locator('.coach-student:visible').count(),0);
  assert.equal(await c.locator('#coachListCount').textContent(),'0 sur 1 élève');
  await c.locator('#coachStudentSearch').fill('');
  await c.locator('[data-filter="review"]').click();
  assert.equal(await c.locator('.coach-student:visible').count(),Number(await c.locator('.coach-student').first().getAttribute('data-review')==='true'));
  await c.locator('[data-filter="all"]').click();
  assert.equal(await c.locator('.coach-student:visible').count(),1);
  await c.setViewportSize({width:320,height:568});
  assert(await c.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'coach student filters overflow 320px');
  await c.screenshot({path:path.join(require('node:os').tmpdir(),'dko-coach-students-320.png'),fullPage:true,animations:'disabled'});
  await c.setViewportSize({width:1280,height:900});
  await c.locator('#coachStudentSearch').fill('introuvable');
  await c.locator('[data-coach="refresh"]').click();await ready(c);
  assert.equal(await c.locator('#coachStudentSearch').inputValue(),'introuvable');
  assert.equal(await c.locator('.coach-student:visible').count(),0);
  await c.locator('#coachStudentSearch').fill('');
  await c.screenshot({path:path.join(require('node:os').tmpdir(),'dko-coach-students-desktop.png'),fullPage:true,animations:'disabled'});
  await c.locator('[data-coach="student"]').click();await c.locator('[data-coach="edit"]').waitFor();await c.setViewportSize({width:390,height:844});
  await c.locator('[data-coach="edit"]').click();await c.locator('[data-field="e.sets"]').first().fill('7');
  assert.equal(await c.evaluate(()=>JSON.parse(localStorage.getItem('dko_coach_draft:test|'+testState.user.id)).programs[0].seances[0].ex[0].sets),7);
  assert.equal(await c.evaluate(()=>JSON.stringify(exportPayload()).includes('dko_coach_draft')),false);
  await c.reload();await c.locator('#splash').waitFor({state:'detached'});await connect(c,coach);
  await c.evaluate(()=>DKOCoachUI.open());await c.locator('[data-mode="coach"]').click();await c.locator('[data-coach="resume-draft"]').waitFor();
  await c.screenshot({path:path.join(require('node:os').tmpdir(),'dko-coach-draft-mobile.png'),fullPage:true,animations:'disabled'});
  await c.locator('[data-coach="resume-draft"]').click();await c.locator('[data-field="e.sets"]').first().waitFor();
  assert.equal(await c.locator('[data-field="e.sets"]').first().inputValue(),'7');
  await c.locator('[data-coach="cancel"]').click();
  assert.equal(await c.evaluate(()=>localStorage.getItem('dko_coach_draft:test|'+testState.user.id)),null);
  const ownCoach=await c.evaluate(()=>JSON.stringify(PROGRAMS));
  await c.locator('[data-coach="edit"]').click();await c.locator('[data-field="e.sets"]').fill('4');await c.locator('[data-field="s.rest"]').fill('240');
  await c.locator('[data-coach="library"]').click();await c.locator('#coachSearch').fill('Curl bayésien');
  await c.locator('#coachResults [data-coach="detail"]').first().click();
  assert(await c.locator('#coachResults .library-detail').getByText('Place la poulie basse derrière toi',{exact:false}).isVisible());
  assert.equal(await c.locator('#coachSearch').inputValue(),'Curl bayésien');
  await c.locator('#coachSearch').fill('exercice-introuvable-xyz');await c.getByText('Aucun exercice répertorié.').waitFor();await c.locator('#coachLibrary [data-coach="custom"]').click();
  await c.locator('[data-field="e.name"]').nth(1).fill('Exercice sur mesure');
  await c.locator('[data-coach="library"]').click();await c.locator('#coachSearch').fill('Curl bayésien');
  await c.locator('#coachResults [data-coach="add"]').first().click();
  assert.match(await c.locator('[data-field="e.name"]').nth(2).inputValue(),/Curl bayésien/);
  await c.locator('[data-field="summary"]').fill('Repos augmenté et exercices ajoutés');
  await c.locator('[data-coach="template-save-current"]').click();await c.getByText(/Modèle enregistré. Les charges cibles personnelles/).waitFor();
  await c.locator('[data-coach="template-import"]').click();await c.locator(`[data-template-id="${model.id}"]`).click();
  await c.waitForFunction(()=>document.querySelectorAll('#coachProgram option').length===2);
  assert.equal(await c.locator('#coachProgram option').count(),2);
  assert.equal(await c.locator('[data-field="e.ref"]').first().inputValue(),'');
  await c.locator('#coachProgram').selectOption('0');
  await c.screenshot({path:path.join(require('node:os').tmpdir(),'dko-coach-editor-mobile.png'),fullPage:true,animations:'disabled'});
  await c.locator('#coachEditor button[type="submit"]').click();await c.getByText(/Version 2 publiée/).waitFor();
  await s.locator('[data-coach="refresh"]').click();await ready(s);await s.getByText('Programmes à jour',{exact:true}).waitFor();
  assert.equal(await s.evaluate(()=>PROGRAMS[0].seances[0].ex[0].sets),4);assert.equal(await s.evaluate(()=>PROGRAMS[0].seances[0].rest),240);
  assert.equal(await s.evaluate(()=>PROGRAMS.length),2);
  assert.equal(await s.evaluate(()=>PROGRAMS[1].seances[0].ex[0].ref),null);
  assert.notEqual(await s.evaluate(()=>PROGRAMS[0].id),await s.evaluate(()=>PROGRAMS[1].id));
  assert.equal(await c.evaluate(()=>JSON.stringify(PROGRAMS)),ownCoach,'coach personal programs untouched');
  assert.deepEqual(await s.evaluate(()=>({workouts:JSON.stringify(DB.workouts),settings:JSON.stringify(SETTINGS),body:JSON.stringify(BODY)})),before);
  await c.locator('[data-coach="history"]').click();await c.locator('[data-coach="restore-version"]').last().click();
  assert.equal(await c.locator('[data-field="e.sets"]').first().inputValue(),'3');await c.locator('[data-coach="cancel"]').click();
  await c.locator('[data-coach="edit"]').click();await c.locator('[data-field="e.sets"]').first().fill('9');
  const concurrent=await queryAs(student,'self');concurrent.programs[0].seances[0].ex[0].reps='12';
  await queryAs(student,'publish',{revision:concurrent.revision,programs:concurrent.programs});
  await c.locator('#coachEditor button[type="submit"]').click();await c.getByText(/Le programme a changé ailleurs/).waitFor();
  assert.equal(await c.locator('[data-field="e.sets"]').first().inputValue(),'9');
  await c.evaluate(()=>{DKOCoachUI.leave();DKOCoachUI.open();});await c.locator('[data-coach="resume-draft"]').waitFor();
  await c.locator('[data-coach="resume-draft"]').click();await c.getByText(/Le programme a changé depuis ce brouillon/).waitFor();
  assert.equal(await c.locator('#coachEditor').count(),0);
  assert.equal(await c.locator('[data-coach="export-saved-draft"]').count(),1);
  await c.locator('[data-coach="discard-saved-draft"]').click();await c.locator('[data-coach="student"]').click();await c.locator('[data-coach="edit"]').waitFor();
  await c.locator('[data-coach="back"]').click();await c.locator('[data-coach="student"]').click();
  // Current workouts freeze their prescription; program reception waits for completion.
  await s.evaluate(()=>startWorkout('s_student'));
  const active=await s.evaluate(()=>JSON.stringify(DB.active));
  let remote=await queryAs(student,'self');remote.programs[0].seances[0].ex[0].sets=5;
  await queryAs(coach,'publish',{student,revision:remote.revision,programs:remote.programs});
  await s.evaluate(()=>DKOCoachUI.open());await s.locator('[data-coach="refresh"]').click();await s.getByText(/Mise à jour en attente/).waitFor();
  assert.equal(await s.evaluate(()=>PROGRAMS[0].seances[0].ex[0].sets),4);assert.equal(await s.evaluate(()=>JSON.stringify(DB.active)),active);
  await s.evaluate(()=>{DB.active=null;persist();});await s.locator('[data-coach="refresh"]').click();await ready(s);await s.getByText('Programmes à jour',{exact:true}).waitFor();assert.equal(await s.evaluate(()=>PROGRAMS[0].seances[0].ex[0].sets),5);
  // Rights are enforced server-side, including a coach with an already-open draft.
  await c.locator('[data-coach="edit"]').click();await c.locator('[data-field="e.sets"]').first().fill('6');
  await s.locator('[data-permission]').selectOption('read');await ready(s);await s.getByText('Programmes à jour',{exact:true}).waitFor();
  await c.locator('#coachEditor button[type="submit"]').click();await c.getByText('Accès indisponible ou retiré par l’élève.').waitFor();
  remote=await queryAs(student,'self');assert.equal(remote.programs[0].seances[0].ex[0].sets,5);
  await s.locator('[data-permission]').selectOption('blocked');await ready(s);await s.getByText('Programmes à jour',{exact:true}).waitFor();
  await c.locator('#coachJoin input').fill(code);await c.locator('#coachJoin button').click();await c.getByText('Code invalide ou accès bloqué.').waitFor();
  const revisionBeforeTemplateEdit=(await queryAs(student,'self')).revision;
  await c.locator('[data-mode="templates"]').click();await c.locator(`[data-coach="template-edit"][data-id="${model.id}"]`).click();
  await c.locator('[data-field="p.name"]').fill('Jambes modèle révisé');await c.locator('#coachEditor button[type="submit"]').click();
  await c.getByText('Jambes modèle révisé',{exact:true}).waitFor();
  assert.equal((await queryAs(student,'self')).revision,revisionBeforeTemplateEdit,'editing a template must not publish to students');
  await c.locator(`[data-coach="template-delete"][data-id="${model.id}"]`).click();
  await c.getByText('Modèle supprimé.',{exact:true}).waitFor();
  assert.equal((await queryAs(student,'self')).revision,revisionBeforeTemplateEdit,'deleting a template must not alter students');
  await c.locator('[data-coach="new-template"]').click();await c.locator('[data-field="p.name"]').fill('Brouillon privé');
  assert(await c.evaluate(()=>!!localStorage.getItem('dko_coach_draft:test|'+testState.user.id)));
  await c.reload();await c.locator('#splash').waitFor({state:'detached'});await connect(c,coach);
  await c.evaluate(()=>DKOCoachUI.open());await c.locator('[data-mode="templates"]').click();
  await c.locator('[data-coach="resume-draft"]').click();
  assert.equal(await c.locator('[data-field="p.name"]').inputValue(),'Brouillon privé');
  await c.evaluate(()=>{testState.user=null;DKOCoachUI.accountChanged();});
  assert.equal(await c.evaluate(()=>localStorage.getItem('dko_coach_draft:test|00000000-0000-0000-0000-000000000002')),null);
  await connect(c,coach);
  // Missing sync base after a restored backup must not publish stale programs.
  await s.evaluate(()=>{DKOCoachUI.restored();PROGRAMS[0].name='Copie restaurée';savePrograms();});await s.locator('[data-coach="refresh"]').click();await s.getByText(/Deux versions différentes/).waitFor();
  await s.locator('[data-coach="compare"]').click();await s.locator('[data-coach="use-remote"]').click();await s.getByText('Programmes à jour',{exact:true}).waitFor();assert.equal(await s.evaluate(()=>PROGRAMS[0].name),'Programme élève');
  for(const theme of ['dark','rose'])for(const width of [320,390,1280]){
   await s.setViewportSize({width,height:900});await s.evaluate(theme=>{SETTINGS.theme=theme;applyTheme();render();},theme);
   assert(await s.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${theme} ${width}`);
   await s.screenshot({path:path.join(require('node:os').tmpdir(),`dko-coach-${theme}-${width}.png`),fullPage:true,animations:'disabled'});
  }
  await c.setViewportSize({width:1280,height:900});await c.screenshot({path:path.join(require('node:os').tmpdir(),'dko-coach-dashboard-desktop.png'),fullPage:true,animations:'disabled'});
  await s.evaluate(()=>{testState.user=null;DKOCoachUI.accountChanged();});await s.getByText('Connecte-toi pour accéder au suivi coach.').waitFor();assert.equal(await s.locator('.coach-code').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS coach browser: two accounts + real SQL, private coach templates, fresh IDs and stripped personal loads, explicit publish/receive, custom exercise fallback, unchanged private data, active session freeze, permission revocation, restore conflict, sign-out, mobile/desktop and both themes.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
