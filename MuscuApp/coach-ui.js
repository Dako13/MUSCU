'use strict';
/* Coach dossiers never enter the student's local database or private backups.
   This adapter owns consent, account boundaries and guarded program application. */
window.DKOCoachUI=(()=>{
  let owner='',epoch=0,service=null,timer=null,mode='student',profile=null,students=[],dossier=null,draft=null,baseline='',busy=false,notice='',phase='idle',selectedProgram=0,selectedSession=0,progressExercise='';
  const ctx=()=>window.DKOCloudUI?.coachContext()||{};
  const clone=v=>structuredClone(v),normalize=v=>DKO_DATA.programs(v);
  const local=()=>normalize(PROGRAMS);
  const ownKey=()=>`dko_coach_base:${owner}`;
  const readBase=()=>{try{return JSON.parse(localStorage.getItem(ownKey()))||null;}catch{return null;}};
  const writeBase=value=>{if(value)localStorage.setItem(ownKey(),JSON.stringify(value));else localStorage.removeItem(ownKey());};
  const ownAllowed=()=>{const s=ctx().state;return STORAGE_READY&&STORAGE_WRITABLE&&s?.enabled&&!s.mismatch&&!['conflict','error'].includes(s.phase);};
  const blocked=()=>!ownAllowed()||!!DB.active||route.view==='edit'||!!sheet.dataset.importing;
  const dirty=()=>!!draft&&JSON.stringify(draft)!==baseline;
  const check=token=>{if(token!==epoch||!ctx().state?.user)throw new Error('Compte changé');};
  const stamp=value=>value?new Date(value).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Jamais';
  const button=(action,label,icon='',extra='',primary=false)=>`<button type="button" class="sbtn${primary?' pri':''}" data-coach="${action}" ${extra}>${icon?uiIcon(icon):''}${esc(label)}</button>`;
  const iconButton=(action,label,icon,extra='')=>`<button type="button" class="coach-icon" data-coach="${action}" title="${esc(label)}" aria-label="${esc(label)}" ${extra}>${uiIcon(icon)}</button>`;
  const field=(name,label,value,extra='',tag='input')=>`<label class="coach-field"><span>${esc(label)}</span>${tag==='textarea'?`<textarea data-field="${name}" ${extra}>${esc(value||'')}</textarea>`:`<input data-field="${name}" value="${esc(value??'')}" ${extra}>`}</label>`;
  const errorText=e=>e.code==='40001'?'Le programme a changé ailleurs. Ton brouillon est conservé. Recharge le dossier ou exporte ton brouillon avant de recommencer.':e.code==='42501'?'Accès indisponible ou retiré par l’élève.':e.message==='rate_limit'?'Trop de tentatives. Réessaie dans une heure.':e.message==='invalid_code'?'Code invalide ou accès bloqué.':'Action non effectuée. Vérifie ta connexion et réessaie.';
  async function api(action,args={}){
    const token=epoch,{client,state}=ctx();
    if(!client||!state?.user||!navigator.onLine)throw new Error('Connexion requise');
    const {data,error}=await client.rpc('dko_coach',{action,args:{...args,account:state.user.id}});check(token);
    if(error)throw error;if(data?.error)throw new Error(data.error);return data;
  }
  async function apply(doc,current){
    if(blocked())throw new Error('Programme local occupé');
    const programs=normalize(doc);if(!programs.length)throw new Error('Programme vide');
    const before=JSON.stringify(PROGRAMS),old=localStorage.getItem(KEY_PROGRAMS),token=epoch;
    if(!await idbSet('before-coach-update',{programs:clone(PROGRAMS),activeId:ACTIVE_PID,date:Date.now()}))throw new Error('Copie de sécurité impossible');
    current();check(token);
    if(blocked()||JSON.stringify(PROGRAMS)!==before||localStorage.getItem(KEY_PROGRAMS)!==old)throw new Error('Programme local modifié');
    const activeId=programs.some(p=>p.id===ACTIVE_PID)?ACTIVE_PID:programs[0].id;
    // No await between the last guard and commit. History keeps its exercise snapshots.
    localStorage.setItem(KEY_PROGRAMS,JSON.stringify({programs,activeId}));
    loadProgram();mirrorSoon();
    if(route.view!=='coach')render();
  }
  function accountChanged(){
    const c=ctx(),next=c.state?.user?`${c.project}|${c.state.user.id}`:'';
    if(next===owner)return;
    epoch++;service?.dispose();service=null;owner=next;profile=null;students=[];dossier=null;draft=null;baseline='';notice='';phase='idle';busy=false;
    clearTimeout(timer);
    if(owner){
      service=DKO_COACH_SYNC.create({api,read:local,apply,blocked,hash:DKO_CLOUD.fingerprint,getBase:readBase,setBase:writeBase,
        onChange:s=>{profile=s.profile;phase=s.phase;paintStatus();if(mode==='student'&&!busy&&!document.activeElement?.matches('input,select,textarea'))paint();},
        onApplied:()=>toast('Programme du coach reçu. Historique conservé.')});
      changed();
    }
    paint();
  }
  function status(){
    if(!navigator.onLine)return 'Hors ligne · données locales conservées';
    if(profile?.code&&!ownAllowed())return 'Sauvegarde privée à activer ou à vérifier avant la synchronisation';
    return {idle:'Vérification du suivi',disabled:'Suivi non activé',saved:'Programmes à jour',waiting:'Mise à jour en attente · séance ou édition en cours',conflict:'Deux versions différentes · comparaison nécessaire',error:'Synchronisation indisponible · données locales conservées'}[phase]||'';
  }
  function paintStatus(){const el=document.getElementById('coachStatus');if(el)el.textContent=status();}
  function paint(){if(route.view==='coach'){app.innerHTML=html();mount();}}
  function changed(){clearTimeout(timer);if(owner)timer=setTimeout(tick,1600);}
  async function tick(){
    if(!owner)return;
    if(document.visibilityState==='visible'&&navigator.onLine){
      if(ownAllowed())await service?.sync();
      if(route.view==='coach'&&dossier&&!busy)await checkDossier();
    }
    clearTimeout(timer);timer=setTimeout(tick,30000);
  }
  async function refresh(){
    profile=await api('self');
    if(mode==='coach')students=await api('students');
    if(ownAllowed())await service?.sync();
  }
  async function checkDossier(){
    const id=dossier?.id;if(!id)return;
    try{
      const fresh=await api('read',{student:id});if(dossier?.id!==id)return;
      if(fresh.mode!=='full'&&draft){draft=null;baseline='';notice='L’élève a limité ton accès à la lecture.';}
      if(!draft){dossier=fresh;paint();}
      else if(fresh.revision!==dossier.revision){notice='Une version plus récente existe. Exporte ton brouillon avant de recharger.';paintStatus();const n=document.getElementById('coachNotice');if(n)n.textContent=notice;}
    }catch(e){if(dossier?.id===id){if(e.code==='42501'){dossier=null;draft=null;students=[];}notice=errorText(e);paint();}}
  }
  async function run(fn){
    if(busy)return;busy=true;notice='';const token=epoch;toggleBusy();
    try{await fn();check(token);}catch(e){if(token===epoch){notice=errorText(e);if(e.code==='42501'){dossier=null;draft=null;students=[];}}}
    finally{if(token===epoch){busy=false;paint();}}
  }
  function toggleBusy(){app.querySelectorAll('#coachRoot button,#coachRoot input,#coachRoot select,#coachRoot textarea').forEach(el=>{el.disabled=true;});}
  function leave(){if(dirty()&&!confirm('Quitter sans publier le brouillon du coach ?'))return false;draft=null;baseline='';dossier=null;return true;}
  function open(){closeSheet();go('coach');if(route.view==='coach')run(refresh);}
  function html(){
    let h='<section id="coachRoot" class="coach"><header class="coach-head"><div><div class="coach-eyebrow">DKO</div><h1>Coaching</h1></div>'+iconButton('refresh','Actualiser','refresh-cw')+'</header>';
    if(!ctx().state?.user)return h+'<p>Connecte-toi pour accéder au suivi coach.</p>'+button('account','Compte et sauvegarde','users')+'</section>';
    h+=`<div class="coach-tabs" role="group" aria-label="Espace coaching">${['student','coach'].map((m,i)=>`<button data-coach="mode" data-mode="${m}" aria-pressed="${mode===m}">${i?'Mes élèves':'Mon coach'}</button>`).join('')}</div>`;
    h+='<p id="coachNotice" class="coach-notice" role="status">'+esc(notice)+'</p>';
    if(dossier&&mode==='coach')return h+dossierHTML()+'</section>';
    if(!profile)return h+`<form id="coachRegister"><h2>Ton nom affiché</h2><label class="coach-field"><span>Nom ou pseudonyme</span><input name="label" required maxlength="80" autocomplete="nickname"></label><button class="sbtn pri" type="submit">Enregistrer</button></form></section>`;
    h+='<div class="coach-identity"><span>'+esc(profile.label)+'</span>'+button('rename','Modifier le nom','notebook-pen')+'</div>';
    h+=mode==='student'?studentHTML():coachHTML();return h+'</section>';
  }
  function studentHTML(){
    let h='<p id="coachStatus" class="coach-status" role="status">'+esc(status())+'</p>';
    if(!profile.code){
      h+='<h2>Partager avec mon coach</h2><p>Ton code donne accès à tes programmes et à ton historique d’entraînement. Le coach peut modifier tes programmes dès qu’il le saisit.</p><p class="sp">Ton compte, ton profil et tes mensurations restent privés. Tu peux limiter ou bloquer chaque coach à tout moment.</p>';
      if(!ownAllowed())h+=button('account','Activer ou vérifier la sauvegarde','database');
      else h+='<label class="coach-check"><input id="coachConsent" type="checkbox">J’autorise ce partage et les modifications de programme par les coachs qui disposent de mon code.</label>'+button('enable','Créer mon code de partage','users','',true);
      return h;
    }
    h+='<h2>Mon code personnel</h2><div class="coach-code"><code>'+profile.code.match(/.{1,4}/g).map(part=>'<span>'+esc(part)+'</span>').join('')+'</code>'+iconButton('copy','Copier mon code','copy')+'</div><p class="sp">Sans expiration. À transmettre uniquement à ton coach.</p>';
    h+='<label class="coach-check"><input id="coachNotes" type="checkbox" '+(profile.shareNotes?'checked':'')+'>Partager aussi mes ressentis par exercice</label>';
    if(phase==='conflict')h+='<section class="coach-conflict"><h3>Choisir la version des programmes</h3><p>Aucune version n’a été écrasée.</p>'+button('compare','Comparer les programmes','layout-list')+'</section>';
    h+='<h2>Mes coachs</h2>'+(profile.coaches.length?profile.coaches.map(c=>`<div class="coach-permission"><strong>${esc(c.label)}</strong><label><span class="sr-only">Droits de ${esc(c.label)}</span><select data-permission="${esc(c.id)}">${[['full','Accès complet'],['read','Lecture seule'],['blocked','Bloqué']].map(([v,l])=>`<option value="${v}" ${c.mode===v?'selected':''}>${l}</option>`).join('')}</select></label></div>`).join(''):'<p class="sp">Aucun coach associé.</p>');
    return h+'<div class="coach-actions">'+button('rotate','Changer mon code','refresh-cw')+button('disable','Arrêter le partage','x')+button('recovery','Copie avant modification','database')+'</div>';
  }
  function coachHTML(){
    return '<form id="coachJoin"><h2>Ajouter un élève</h2><label class="coach-field"><span>Code personnel de l’élève</span><input name="code" required maxlength="64" autocomplete="off" spellcheck="false" placeholder="Code transmis par l’élève"></label><button class="sbtn pri" type="submit">'+uiIcon('plus')+'Associer l’élève</button></form><h2>Mes élèves <span class="coach-count">'+students.length+'</span></h2>'
      +(students.length?'<div class="coach-students">'+students.map(s=>`<button class="coach-student" data-coach="student" data-id="${esc(s.id)}"><span class="coach-avatar">${esc(s.label.slice(0,1).toUpperCase())}</span><span><strong>${esc(s.label)}</strong><small>${s.sessions} séances · ${s.mode==='full'?'Accès complet':'Lecture seule'}</small><small>Dernière sauvegarde : ${esc(stamp(s.lastSync))}</small></span>${uiIcon('chevron-right')}<span class="coach-delivery">${s.appliedRevision>=s.revision?'Programme reçu':'En attente de réception'}</span></button>`).join('')+'</div>':'<p class="sp">Aucun élève associé.</p>')+'<p class="sp">Historique visible après la sauvegarde de l’élève. Jusqu’à 200 élèves affichés.</p>';
  }
  function dossierHTML(){
    const d=dossier;
    let h=button('back','Mes élèves','chevron-left')+`<div class="coach-dossier-head"><h2>${esc(d.label)}</h2><span>${d.mode==='full'?'Accès complet':'Lecture seule'} · version ${d.revision}</span></div><p class="sp">${d.appliedRevision>=d.revision?'Programme reçu sur un appareil de l’élève':'Publication en attente de réception'} · sauvegarde du ${esc(stamp(d.lastSync))}</p>`;
    if(draft)return h+editorHTML();
    h+='<div class="coach-actions">'+(d.mode==='full'?button('edit','Modifier les programmes','notebook-pen','',true):'')+button('history','Versions précédentes','clock-3')+'</div>';
    h+='<h3>Programmes</h3>'+programSummary(d.programs);
    const ws=(d.workouts||[]).map(w=>DKO_DATA.workout(w));
    const since=new Date();since.setDate(since.getDate()-28);const count=ws.filter(w=>w.date>=since.toISOString().slice(0,10)).length;
    h+=`<div class="coach-metrics"><div><strong>${count}</strong><span>Séances / 28 jours</span></div><div><strong>${ws.length}</strong><span>Séances disponibles</span></div></div>`+progressHTML(ws)+'<h3>Historique d’entraînement</h3>';
    h+=ws.length?ws.map(w=>`<details class="coach-workout"><summary><strong>${esc(w.session?.title||'Séance')}</strong><span>${esc(w.date)} · ${Math.round((w.dur||0)/60)} min</span></summary>${Object.entries(w.ex).map(([id,sets])=>`<div class="coach-performance"><strong>${esc(w.exMeta?.[id]?.name||d.programs.flatMap(p=>p.seances).flatMap(s=>s.ex).find(e=>e.id===id)?.name||'Exercice')}</strong><p>${sets.filter(s=>s.done).map(s=>esc(`${s.w??'–'} ${w.exMeta?.[id]?.unit||'kg'} × ${s.r??'–'}`)).join(' · ')||'Aucune série validée'}</p>${w.exNotes[id]?'<p class="coach-feeling">'+esc(w.exNotes[id])+'</p>':''}</div>`).join('')}</details>`).join(''):'<p class="sp">Aucune séance sauvegardée pour le moment.</p>';
    return h+'<p class="sp">Les 500 dernières séances sont disponibles. Les performances enregistrées ne sont pas modifiables par le coach.</p>';
  }
  function programSummary(programs){return (programs||[]).map(p=>`<div class="coach-summary"><strong>${esc(p.name)}</strong>${p.seances.map(s=>`<details><summary>${esc(s.title)} · ${s.ex.length} exercices</summary>${s.ex.map(e=>`<p>${esc(e.name)}<small>${e.sets} × ${esc(e.reps)} · ${e.ref==null?'Charge libre':esc(e.ref+' '+e.unit)} · repos ${e.rest??s.rest??'personnel'}${e.rest||s.rest?' s':''}</small></p>`).join('')}</details>`).join('')}</div>`).join('');}
  function progressHTML(workouts){
    const exercises=new Map();for(const w of workouts)for(const id of Object.keys(w.ex))if(!exercises.has(id))exercises.set(id,w.exMeta?.[id]?.name||id);
    if(!exercises.size)return '';
    if(!exercises.has(progressExercise))progressExercise=exercises.keys().next().value;
    const rows=workouts.filter(w=>w.ex[progressExercise]?.some(s=>s.done)).slice(0,12);
    return '<h3>Progression par exercice</h3><label class="coach-field"><span>Exercice suivi</span><select id="coachProgressExercise">'+[...exercises].map(([id,name])=>`<option value="${esc(id)}" ${id===progressExercise?'selected':''}>${esc(name)}</option>`).join('')+'</select></label><div class="coach-progress-table"><table><thead><tr><th>Date</th><th>Charge max.</th><th>Reps totales</th></tr></thead><tbody>'+rows.map(w=>{
      const sets=w.ex[progressExercise].filter(s=>s.done),weights=sets.map(s=>s.w).filter(v=>v!=null);
      return `<tr><td>${esc(w.date)}</td><td>${weights.length?esc(Math.max(...weights)+' '+(w.exMeta?.[progressExercise]?.unit||'kg')):'–'}</td><td>${esc(sets.reduce((sum,s)=>sum+(s.r||0),0))}</td></tr>`;
    }).join('')+'</tbody></table></div><p class="sp">Les 12 dernières séances de cet exercice. Charge affichée telle que saisie, y compris pour une machine assistée.</p>';
  }
  function editorHTML(){
    selectedProgram=Math.min(selectedProgram,draft.length-1);const p=draft[selectedProgram];selectedSession=Math.min(selectedSession,Math.max(0,p.seances.length-1));const s=p.seances[selectedSession];
    let h='<div class="coach-actions">'+button('cancel','Annuler','x')+button('draft-export','Exporter le brouillon','database')+'</div><form id="coachEditor"><div class="coach-toolbar"><label class="coach-field"><span>Programme</span><select id="coachProgram">'+draft.map((p,i)=>`<option value="${i}" ${i===selectedProgram?'selected':''}>${esc(p.name)}</option>`).join('')+'</select></label>'+iconButton('new-program','Ajouter un programme','plus')+iconButton('delete-program','Supprimer ce programme','trash-2',draft.length<2?'disabled':'')+'</div>';
    h+=field('p.name','Nom du programme',p.name,'required maxlength="5000"');
    h+='<div class="coach-toolbar"><label class="coach-field"><span>Séance</span><select id="coachSession">'+p.seances.map((s,i)=>`<option value="${i}" ${i===selectedSession?'selected':''}>${esc(s.title)}</option>`).join('')+'</select></label>'+iconButton('new-session','Ajouter une séance','plus')+(s?iconButton('duplicate-session','Dupliquer cette séance','copy')+iconButton('delete-session','Supprimer cette séance','trash-2'):'')+'</div>';
    if(s){
      h+='<section class="coach-session">'+field('s.title','Titre de séance',s.title,'required maxlength="5000"')+'<div class="coach-grid">'+field('s.tab','Étiquette',s.tab,'maxlength="5000"')+field('s.rest','Repos de base (secondes)',s.rest,'type="number" min="1" max="86400" step="1" placeholder="Réglage de l’élève"')+'</div>'+field('s.sub','Sous-titre',s.sub,'maxlength="5000"')+field('s.warn','Consignes de séance',s.warn,'maxlength="5000"','textarea')+'</section>';
      h+=s.ex.map((e,i)=>`<section class="coach-exercise" data-ex-index="${i}"><header><h3>Exercice ${i+1}</h3><div>${iconButton('ex-up','Monter','arrow-up',`data-index="${i}" ${i===0?'disabled':''}`)}${iconButton('ex-down','Descendre','arrow-down',`data-index="${i}" ${i===s.ex.length-1?'disabled':''}`)}${iconButton('ex-copy','Dupliquer','copy',`data-index="${i}"`)}${iconButton('ex-delete','Supprimer','trash-2',`data-index="${i}"`)}</div></header>${field('e.name','Nom',e.name,'required maxlength="5000"')}<div class="coach-grid">${field('e.sets','Séries',e.sets,'type="number" min="1" max="100" step="1" required')}${field('e.reps','Répétitions cibles',e.reps,'required maxlength="80"')}${field('e.ref','Charge cible',e.ref,'inputmode="decimal"')}${field('e.unit','Unité',e.unit,'maxlength="80"')}${field('e.rest','Repos spécifique (s)',e.rest,'type="number" min="1" max="86400" step="1" placeholder="Repos de séance"')}${field('e.increment','Incrément de charge',e.increment,'inputmode="decimal" placeholder="Automatique"')}</div><details><summary>Muscles et informations complémentaires</summary><div class="coach-grid">${muscleField('musP','Muscles principaux',e.musP)}${muscleField('musS','Muscles secondaires',e.musS)}</div>${field('e.refText','Indication de charge',e.refText,'maxlength="5000"')}${field('e.ceiling','Badge',e.ceiling,'maxlength="5000"')}${field('e.yt','Recherche vidéo',e.yt,'maxlength="5000"')}</details>${field('e.notes','Consignes techniques',e.notes,'maxlength="5000"','textarea')}</section>`).join('');
      h+='<div class="coach-actions">'+button('library','Bibliothèque','search')+button('new-exercise','Exercice non répertorié','plus')+'</div>';
    }
    h+='<div class="coach-publish">'+field('summary','Message de mise à jour','','maxlength="500" placeholder="Ex. : repos augmenté sur le squat"')+'<button type="submit" class="sbtn pri">'+uiIcon('check')+'Publier pour l’élève</button><p class="sp">La séance en cours reste inchangée. Réception à la prochaine synchronisation disponible.</p></div></form>';return h;
  }
  function muscleField(key,label,values){return `<label class="coach-field"><span>${label}</span><select multiple size="5" data-field="e.${key}">${MUSCLES.map(m=>`<option value="${m.id}" ${(values||[]).includes(m.id)?'selected':''}>${esc(mLabel(m.id))}</option>`).join('')}</select></label>`;}
  function editInput(el){
    if(!draft||!el.dataset.field||el.dataset.field==='summary')return;
    const [scope,key]=el.dataset.field.split('.'),p=draft[selectedProgram],s=p.seances[selectedSession];
    const target=scope==='p'?p:scope==='s'?s:s.ex[+el.closest('[data-ex-index]').dataset.exIndex];
    target[key]=el.multiple?[...el.selectedOptions].map(o=>o.value):['sets','ref','rest','increment'].includes(key)?(el.value.trim()===''?null:Number(el.value.replace(',','.'))):el.value;
  }
  function mount(){
    const root=document.getElementById('coachRoot');if(!root)return;
    root.onclick=e=>{const b=e.target.closest('[data-coach]');if(b)action(b.dataset.coach,b);};
    root.oninput=e=>editInput(e.target);
    root.onchange=e=>{
      const el=e.target;
      if(el.id==='coachProgram'){selectedProgram=+el.value;selectedSession=0;paint();}
      else if(el.id==='coachSession'){selectedSession=+el.value;paint();}
      else if(el.id==='coachProgressExercise'){progressExercise=el.value;paint();}
      else if(el.dataset.permission)run(async()=>{await api('permission',{coach:el.dataset.permission,mode:el.value});await refresh();});
      else if(el.id==='coachNotes')run(async()=>{await api('notes',{enabled:el.checked});await refresh();});
    };
    root.onsubmit=e=>{
      e.preventDefault();const form=e.target;
      if(form.id==='coachRegister'){const label=new FormData(form).get('label');run(async()=>{await api('register',{label});await refresh();});}
      else if(form.id==='coachJoin'){const code=new FormData(form).get('code');run(async()=>{const joined=await api('join',{code});await refresh();await loadStudent(joined.student);});}
      else if(form.id==='coachEditor')publish(form);
    };
    if(busy)toggleBusy();
  }
  async function loadStudent(id){
    const d=await api('read',{student:id});d.programs=normalize(d.programs);d.workouts=(d.workouts||[]).map(w=>DKO_DATA.workout(w));
    dossier=d;draft=null;baseline='';selectedProgram=selectedSession=0;
  }
  function startDraft(programs){draft=clone(programs);baseline=JSON.stringify(dossier.programs);selectedProgram=selectedSession=0;}
  function publish(form){
    if(!form.reportValidity()||dossier.mode!=='full')return;
    let doc;try{doc=normalize(draft);}catch(e){notice=e.message;document.getElementById('coachNotice').textContent=notice;return;}
    const summary=form.querySelector('[data-field="summary"]').value;
    run(async()=>{const result=await api('publish',{student:dossier.id,revision:dossier.revision,programs:doc,summary});
      draft=null;baseline='';await loadStudent(dossier.id);notice='Version '+result.revision+' publiée. En attente de réception par l’élève.';});
  }
  function action(a,b){
    if(busy)return;
    if(a==='account'){window.DKOCloudUI.show();return;}
    if(a==='copy'){navigator.clipboard.writeText(profile.code.match(/.{1,4}/g).join('-')).then(()=>toast('Code copié'),()=>toast('Copie indisponible. Sélectionne le code.'));return;}
    if(a==='mode'){if(!leave())return;mode=b.dataset.mode;run(refresh);return;}
    if(a==='refresh'){if(!leave())return;run(refresh);return;}
    if(a==='student'){run(()=>loadStudent(b.dataset.id));return;}
    if(a==='back'){if(leave())run(refresh);return;}
    if(a==='edit'){startDraft(dossier.programs);paint();return;}
    if(a==='cancel'){if(dirty()&&!confirm('Abandonner ce brouillon ?'))return;draft=null;baseline='';paint();return;}
    if(a==='draft-export'){download({programmes:draft},'dko-brouillon-coach.json');return;}
    if(a==='library'){library();return;}
    if(a==='compare'){compare();return;}
    if(a==='history'){run(async()=>showHistory(await api('history',{student:dossier.id})));return;}
    if(a==='recovery'){run(async()=>{const r=await idbGet('before-coach-update');if(!r){notice='Aucune copie de sécurité disponible.';return;}download({app:'dako',version:7,programmes:r.programs,programme_actif:r.activeId},'dko-avant-coach.json');});return;}
    if(a==='rename'){const label=prompt('Nom affiché aux élèves et aux coachs',profile.label);if(label?.trim())run(async()=>{await api('register',{label:label.trim()});await refresh();});return;}
    if(a==='enable'){if(!document.getElementById('coachConsent')?.checked){toast('Confirme le partage avant de créer ton code');return;}run(async()=>{if(!ownAllowed())throw new Error('Sauvegarde requise');await api('enable',{programs:local()});await refresh();});return;}
    if(a==='rotate'||a==='disable'){
      if(!confirm(a==='rotate'?'Invalider l’ancien code ? Les coachs déjà associés conservent leurs droits.':'Bloquer tous les coachs et désactiver ton code ? Tes programmes et ton historique restent sur ton appareil.'))return;
      run(async()=>{await api(a);await refresh();});return;
    }
    if(!draft)return;
    const p=draft[selectedProgram],s=p.seances[selectedSession],i=+b.dataset?.index;
    if(a==='new-program'){if(draft.length>=100)return;draft.push({id:uid('p_'),name:'Nouveau programme',seances:[]});selectedProgram=draft.length-1;selectedSession=0;}
    else if(a==='delete-program'){if(draft.length<2||!confirm('Supprimer ce programme du brouillon ?'))return;draft.splice(selectedProgram,1);selectedProgram=0;selectedSession=0;}
    else if(a==='new-session'){if(p.seances.length>=100)return;p.seances.push({id:uid('s_'),title:'Nouvelle séance',tab:'Séance',sub:'',warn:'',rest:180,ex:[]});selectedSession=p.seances.length-1;}
    else if(a==='duplicate-session'){if(p.seances.length>=100)return;const next=clone(s);next.id=uid('s_');next.title+=' (copie)';next.ex.forEach(e=>e.id=uid('e_'));p.seances.push(next);selectedSession=p.seances.length-1;}
    else if(a==='delete-session'){if(!confirm('Supprimer cette séance du brouillon ?'))return;p.seances.splice(selectedSession,1);selectedSession=0;}
    else if(a==='new-exercise'){if(s.ex.length>=100)return;s.ex.push({id:uid('e_'),name:'Nouvel exercice',sets:3,reps:'8–10',unit:'kg',ref:null,musP:[],musS:[],notes:''});}
    else if(a==='ex-delete'){if(!confirm('Supprimer cet exercice du brouillon ?'))return;s.ex.splice(i,1);}
    else if(a==='ex-copy'){if(s.ex.length>=100)return;s.ex.splice(i+1,0,{...clone(s.ex[i]),id:uid('e_')});}
    else if(a==='ex-up'&&i>0)[s.ex[i-1],s.ex[i]]=[s.ex[i],s.ex[i-1]];
    else if(a==='ex-down'&&i<s.ex.length-1)[s.ex[i+1],s.ex[i]]=[s.ex[i],s.ex[i+1]];
    paint();
  }
  function library(){
    const entries=libraryCatalog(),token=epoch;
    sheet.innerHTML='<h2>Bibliothèque d’exercices</h2><div id="coachLibrary"><label class="coach-field"><span>Rechercher</span><input id="coachSearch" type="search" placeholder="Nom ou marque"></label><div class="coach-grid"><label class="coach-field"><span>Muscle</span><select id="coachMuscle"><option value="">Tous</option>'+MUSCLES.map(m=>`<option value="${m.id}">${esc(mLabel(m.id))}</option>`).join('')+'</select></label><label class="coach-field"><span>Chargement</span><select id="coachLoad"><option value="">Tous</option>'+Object.entries(LOAD_SHORT).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')+'</select></label></div><div id="coachResults"></div><div class="coach-actions">'+button('custom','Exercice non répertorié','plus')+'</div></div>';openSheet();
    const show=()=>{
      const q=searchKey(document.getElementById('coachSearch').value),mus=document.getElementById('coachMuscle').value,load=document.getElementById('coachLoad').value;
      const filtered=entries.map((m,i)=>({m,i})).filter(({m})=>(!q||searchKey(m.n+' '+m.b).includes(q))&&(!mus||m.p.includes(mus))&&(!load||machineLoad(m)===load));
      document.getElementById('coachResults').innerHTML='<p class="sp">'+filtered.length+' résultats'+(filtered.length>80?' · 80 affichés, affine ta recherche':'')+'</p>'+filtered.slice(0,80).map(({m,i})=>`<button class="coach-library-row" data-add="${i}"><span><strong>${esc(m.n)}</strong><small>${esc(m.b)} · ${esc(LOAD_SHORT[machineLoad(m)])}</small></span>${uiIcon('plus')}</button>`).join('')+(filtered.length?'':'<p>Aucun exercice répertorié.</p>');
    };
    document.getElementById('coachLibrary').oninput=show;
    document.getElementById('coachLibrary').onclick=e=>{
      if(token!==epoch||!draft){closeSheet();return;}
      const b=e.target.closest('[data-add]');
      if(b){const s=draft[selectedProgram].seances[selectedSession];if(s.ex.length>=100){toast('100 exercices maximum par séance');return;}s.ex.push({...clone(entries[+b.dataset.add].exercise),id:uid('e_')});closeSheet();paint();}
      else if(e.target.closest('[data-coach="custom"]')){closeSheet();action('new-exercise',{});}
    };show();
  }
  function compare(){
    const remote=service?.state().profile;if(!remote)return;
    sheet.innerHTML='<h2>Deux versions des programmes</h2><div class="coach-compare"><section><h3>Sur cet appareil</h3>'+programSummary(local())+'</section><section><h3>Partagée · version '+remote.revision+'</h3>'+programSummary(remote.programs)+'</section></div><div class="coach-actions">'+button('export-local','Exporter la version locale','database')+button('export-remote','Exporter la version partagée','database')+button('use-remote','Recevoir la version partagée','check')+button('use-local','Publier ma version locale','check')+'</div>';openSheet();
    const token=epoch;sheet.onclick=async e=>{const a=e.target.closest('[data-coach]')?.dataset.coach;if(!a)return;
      if(token!==epoch){closeSheet();return;}
      if(a.startsWith('export')){download({app:'dako',version:7,programmes:a==='export-local'?local():remote.programs},'dko-programmes-'+a+'.json');return;}
      if(blocked()){toast('Termine ta séance ou vérifie la sauvegarde avant de choisir');return;}
      if(!confirm('Remplacer '+(a==='use-local'?'la version partagée':'les programmes de cet appareil')+' par la version choisie ?'))return;
      closeSheet();run(async()=>{if(!await service.resolve(a==='use-local'?'local':'remote'))throw new Error('Version modifiée');await refresh();});
    };
  }
  function showHistory(versions){
    const token=epoch;sheet.innerHTML='<h2>Versions précédentes</h2><p class="sp">Les 20 dernières versions. Restaurer prépare un brouillon, sans modifier les séances déjà réalisées.</p>'+versions.map((v,i)=>`<div class="coach-version"><strong>Version ${v.revision} · ${esc(v.author)}</strong><p>${esc(v.summary)}</p><small>${esc(stamp(v.date))}</small>${dossier.mode==='full'?button('restore-version','Préparer cette version','clock-3',`data-index="${i}"`):''}</div>`).join('');openSheet();
    sheet.onclick=e=>{const b=e.target.closest('[data-coach="restore-version"]');if(!b||token!==epoch||!dossier)return;startDraft(normalize(versions[+b.dataset.index].programs));closeSheet();paint();};
  }
  function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  document.addEventListener('app:sheet-closed',()=>{sheet.onclick=null;});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')changed();});
  window.addEventListener('online',changed);
  window.addEventListener('offline',()=>{notice='Hors ligne. Publication indisponible ; le brouillon reste en mémoire tant que cette page reste ouverte.';paint();});
  window.addEventListener('storage',e=>{if(e.key===KEY_PROGRAMS){service?.invalidate();changed();}});
  setTimeout(accountChanged,0);
  return {open,html,mount,dirty,leave,changed,accountChanged,restored:()=>service?.invalidate()};
})();
