'use strict';
/* =====================================================
   DKO — suivi d'entraînement
   v4.0.0 : sauvegarde fichier + rappel, édition/suppression
   historique, calculateurs 1RM/plaques, conseils+enseigne
   par machine, repos par exercice, profil éditable.
   v3.4.0 : bibliothèque de machines (marque + muscle).
   v3.3.0 : Bilan Forme. v3.2.0 : démos animées.
   ===================================================== */
const APP_VERSION='4.35.0';
const AUTO_FINISH_MS=3*60*60*1000;
let STORAGE_READY=false;
let STORAGE_WRITABLE=true;

/* ================== UTILITAIRES ================== */
function esc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function uiIcon(name){return '<svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24"><use href="./icons/ui.svg#'+name+'"></use></svg>';}
function toolButton(action,icon,label){return '<button class="icon-button" data-act="'+action+'" aria-label="'+label+'" data-tooltip="'+label+'">'+uiIcon(icon)+'</button>';}
function numOrNull(v){if(v==null||String(v).trim()==='')return null;const n=Number(String(v).trim().replace(',','.'));return Number.isFinite(n)?n:null}
function intOrNull(v){const n=numOrNull(v);return Number.isInteger(n)?n:null}
function todayISO(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function fmtN(n){return String(n).replace('.',',')}
function fmtKg(n){return n.toLocaleString('fr-FR')}
function fmtDateShort(iso){const[y,m,d]=iso.split('-');return new Date(+y,m-1,+d).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}
function diffDays(iso){
  const[y,m,d]=iso.split('-');
  return Math.round((new Date().setHours(0,0,0,0)-new Date(+y,m-1,+d).getTime())/86400000);
}
function daysAgo(iso){
  const diff=diffDays(iso);
  if(diff<=0)return 'aujourd’hui';if(diff===1)return 'hier';if(diff<7)return 'il y a '+diff+' j';
  if(diff<30)return 'il y a '+Math.round(diff/7)+' sem';return fmtDateShort(iso);
}
function fmtDur(sec){if(sec==null)return null;const m=Math.round(sec/60);return m<60?m+' min':Math.floor(m/60)+' h '+String(m%60).padStart(2,'0')}
function fmtT(s){s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}

/* ================== MUSCLES ================== */
const MUSCLES=[
 {id:'pecs',label:'Pectoraux',rec:72},
 {id:'dos',label:'Dos',rec:72},
 {id:'delt_ant',label:'Deltoïde antérieur',rec:48},
 {id:'delt_lat',label:'Deltoïde latéral',rec:48},
 {id:'delt_post',label:'Deltoïde postérieur',rec:48},
 {id:'biceps',label:'Biceps',rec:48},
 {id:'triceps',label:'Triceps',rec:48},
 {id:'avant_bras',label:'Avant-bras',rec:48},
 {id:'quadriceps',label:'Quadriceps',rec:72},
 {id:'ischios',label:'Ischio-jambiers',rec:72},
 {id:'fessiers',label:'Fessiers',rec:72},
 {id:'mollets',label:'Mollets',rec:48},
 {id:'abdos',label:'Abdominaux',rec:48},
 {id:'adducteurs',label:'Adducteurs',rec:48},
 {id:'lombaires',label:'Lombaires',rec:48}
];
const MUSCLE_BY_ID={};MUSCLES.forEach(m=>MUSCLE_BY_ID[m.id]=m);
function normMuscle(tok){
  const t=String(tok||'').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s-]+/g,'_');
  if(MUSCLE_BY_ID[t])return t;
  const alias={pectoraux:'pecs',poitrine:'pecs',dorsaux:'dos',lats:'dos',
    epaules:'delt_lat',deltoide_anterieur:'delt_ant',deltoide_lateral:'delt_lat',
    deltoide_posterieur:'delt_post',arriere_epaule:'delt_post',
    quadri:'quadriceps',quads:'quadriceps',ischio:'ischios',ischio_jambiers:'ischios',
    fessier:'fessiers',mollet:'mollets',avant_bras:'avant_bras',forearms:'avant_bras'};
  return alias[t]||null;
}
function parseMuscles(str){
  return String(str||'').split(',').map(normMuscle).filter(Boolean)
    .filter((v,i,a)=>a.indexOf(v)===i);
}

/* ================== PROGRAMME PAR DÉFAUT ================== */
const PROFILE={sexe:'homme',taille_cm:186,poids_kg:96,age:25,niveau:'avancé',salle:'Basic Fit',
 repos:'3 min',fourchette_reps:'7–10 (jamais +12)',methode:'top set / back-off · dégressive sur dernière série uniquement'};

const DEFAULT_PROGRAM=[
{id:'j1',tab:'J1',title:'Dos épaisseur + postérieur',sub:'Dos · Postérieur',
 warn:'Latéraux / postérieur / face pull : élan = trop lourd. La tension fait le muscle.',ex:[
 {id:'j1e1',name:'Row appui poitrine unilatéral (neutre)',sets:3,reps:'6–10/bras',ref:77.6,unit:'kg/bras',
  musP:['dos'],musS:['biceps','delt_post'],
  yt:'chest supported row unilatéral machine technique',
  notes:'TS 77,6 kg/bras ×6–8 + 2 back-off ~68 ×8–10. Prise neutre, coude vers l’arrière et le haut, rétraction complète. Départ bras GAUCHE. Négative 3s, pause 1s.'},
 {id:'j1e2',name:'Tirage triangle serré',sets:3,reps:'6–10',ref:100,unit:'kg',
  musP:['dos'],musS:['biceps'],
  yt:'tirage horizontal prise serrée triangle technique',
  notes:'TS 100 ×6–8 + 2 back-off ~76 ×8–10. Prise neutre serrée (triangle). Tirer vers le nombril, serrer les omoplates, hold 1s.'},
 {id:'j1e3',name:'Diverging seated row unilatéral',sets:3,reps:'6–10/bras',ref:107,unit:'kg',
  musP:['dos'],musS:['biceps'],
  yt:'diverging seated row machine unilatéral technique',
  notes:'TS 107 ×6–8 + 2 back-off ~94 ×8–10. Prise neutre, rotation du buste pour dégager le pad. Coude vers l’arrière, serrer l’omoplate, hold 1s.'},
 {id:'j1e4',name:'Face pull corde',sets:3,reps:'10–12',ref:40,unit:'kg',
  musP:['delt_post'],musS:['dos'],
  yt:'face pull corde technique épaule',
  notes:'Straight sets. Mains vers le bas, coudes qui partent vers l’arrière, rotation des poignets en fin. Trapèze exclu du mouvement.'},
 {id:'j1e5',name:'Rear delt fly câble poulies croisées',sets:3,reps:'10–12',ref:null,unit:'à calibrer',
  musP:['delt_post'],musS:[],
  yt:'rear delt fly câble poulies croisées technique',
  notes:'Straight sets. Penché 70°, bras croisés quasi-tendus, arc vers l’arrière-extérieur, contraction 1s, épaules basses. Caler la charge.'}]},

{id:'j2',tab:'J2',title:'Pectoraux horizontal + abdos',sub:'Pectoraux · Abdos',
 warn:'Au plafond matériel sur haltères (50) : progresser via tempo / rest-pause.',ex:[
 {id:'j2e1',name:'Développé couché haltères',sets:3,reps:'8–10',ref:50,unit:'kg/bras',ceiling:'PLAFOND HALTÈRES',
  musP:['pecs'],musS:['triceps','delt_ant'],
  yt:'développé couché haltères technique',
  notes:'Plafond matériel : la TS devient une série rest-pause/tempo, 2 back-off standards à 50 (pas de charge inférieure pertinente → réduire via tempo). Coudes ~70°, descendre à l’étirement, pousser sans verrouiller. Négative 3s.'},
 {id:'j2e2',name:'Press Matrix',sets:3,reps:'6–10',ref:113,unit:'kg',ceiling:'PLAFOND ~123',
  musP:['pecs'],musS:['triceps','delt_ant'],
  yt:'chest press machine technique',
  notes:'TS 113 ×6–8 + 2 back-off ~100 ×8–10. Position n°2. Marge restante avant le plafond (~123).'},
 {id:'j2e3',name:'Pec fly câble incliné allongé',sets:3,reps:'9–10',ref:20,unit:'kg/côté',
  musP:['pecs'],musS:[],
  yt:'pec fly câble incliné banc technique',
  notes:'Straight sets. Allongé incliné entre les poulies : étirement max, flexion de coude fixe, refermer sans croiser.'},
 {id:'j2e4',name:'Câble double avec poulie oiseau',sets:3,reps:'10–12',ref:13.5,unit:'kg/côté',
  musP:['delt_post'],musS:[],
  yt:'câble oiseau reverse fly double poulie technique',
  notes:'Straight sets. Arc vers l’arrière, coudes quasi-fixes, contraction 1s, épaules basses.'},
 {id:'j2e5',name:'Crunch machine Matrix',sets:3,reps:'12–15',ref:null,unit:'progressif',
  musP:['abdos'],musS:[],
  yt:'abdominal crunch machine technique',
  notes:'1er passage abdos de la semaine. Enrouler la colonne, souffler, contraction, pas de traction sur la nuque.'}]},

{id:'j3',tab:'J3',title:'Épaules + triceps',sub:'Latéral prioritaire',
 warn:'Latéraux : léger et strict. Press épaules : surveiller le tendon GAUCHE, stop si douleur tendineuse.',ex:[
 {id:'j3e1',name:'Press épaules machine',sets:3,reps:'8–10',ref:101,unit:'kg',ceiling:'RIR 2 · 4 SEM.',
  musP:['delt_ant','delt_lat'],musS:['triceps'],
  yt:'développé épaules machine technique',
  notes:'Straight sets. RIR 2 pendant 4 semaines, puis éligible TS/back-off. Progression : 3×10 → +5 kg → retour 3×8. Retour reps-only si signal tendineux (tendon gauche).'},
 {id:'j3e2',name:'Élévation latérale unilatérale câble (poulie bassin)',sets:3,reps:'10–12',ref:11.3,unit:'kg',
  musP:['delt_lat'],musS:[],
  yt:'élévation latérale câble unilatéral technique',
  notes:'Straight sets. Poulie au bassin, penché léger côté opposé, iso 2s, départ gauche. Léger et strict, pas d’élan.'},
 {id:'j3e3',name:'Pushdown barre EZ ou poignées V',sets:3,reps:'8–10',ref:40,unit:'kg',
  musP:['triceps'],musS:[],
  yt:'pushdown triceps barre EZ technique',
  notes:'Straight sets. Recalibrer ~38–41 kg. Coudes fixes au corps, verrouillage complet. Dégressive sur la dernière série uniquement.'},
 {id:'j3e4',name:'Overhead triceps corde',sets:3,reps:'10–12',ref:22.6,unit:'kg',
  musP:['triceps'],musS:[],
  yt:'extension triceps overhead corde technique',
  notes:'Straight sets. Tête longue. Coudes au plafond et fixes, extension vers le haut, étirement en bas.'},
 {id:'j3e5',name:'Élévation latérale haltère lean-away',sets:3,reps:'10–12',ref:null,unit:'léger',
  musP:['delt_lat'],musS:[],
  yt:'lean away lateral raise haltère technique',
  notes:'Straight sets. Stop à l’horizontale. Anti-trapèze : épaule basse, initier au coude. Retour au câble si le trapèze compense.'}]},

{id:'j4',tab:'J4',title:'Dos largeur + biceps',sub:'Dos · Biceps',
 warn:'Unilatéral : commencer par le bras gauche, aligner le droit dessus.',ex:[
 {id:'j4e1',name:'Tirage vertical barre pronation',sets:3,reps:'6–10',ref:127,unit:'kg',
  musP:['dos'],musS:['biceps'],
  yt:'tirage vertical poitrine prise large technique',
  notes:'TS 127 ×6–8 (dernier ×7, objectif ×8) + 2 back-off 113 ×8–10. Prise large, tirer vers la clavicule, coudes vers les hanches, étirement complet. Négative 3s.'},
 {id:'j4e2',name:'Tirage vertical unilatéral câble (banc assis)',sets:3,reps:'8–10/côté',ref:50,unit:'kg',
  musP:['dos'],musS:['biceps'],
  yt:'tirage vertical unilatéral câble technique',
  notes:'Straight sets. Assis, penché léger côté opposé, tirer le coude vers la hanche. Départ gauche.'},
 {id:'j4e3',name:'Curl alterné haltère',sets:3,reps:'7–8',ref:24,unit:'kg/bras',
  musP:['biceps'],musS:['avant_bras'],
  yt:'curl alterné haltères technique',
  notes:'Straight sets. Supination complète en haut, coudes fixes, pas de balancement.'},
 {id:'j4e4',name:'Pull-over câble (finisher)',sets:2,reps:'10–12',ref:27,unit:'kg',
  musP:['dos'],musS:[],
  yt:'pull over câble debout dos technique',
  notes:'Finisher 2 séries. Bras quasi-tendus, étirement du lat en haut, tirer vers les hanches. Skip si dos saturé.'},
 {id:'j4e5',name:'Curl pupitre Matrix unilatéral',sets:3,reps:'8–10/bras',ref:45,unit:'kg/bras',
  musP:['biceps'],musS:[],
  yt:'curl pupitre machine technique',
  notes:'Straight sets. Bras sur le pad, négative 3s, pause 1s en bas.'}]},

{id:'j5',tab:'J5',title:'Pectoraux incliné + latéral',sub:'Pectoraux · Latéral',
 warn:'Incliné : pas de verrouillage, étirement complet en bas. Latéral : léger et strict.',ex:[
 {id:'j5e1',name:'Press incliné machine Matrix',sets:3,reps:'6–10',ref:50,unit:'kg',
  musP:['pecs'],musS:['delt_ant','triceps'],
  yt:'développé incliné machine technique',
  notes:'TS 50 ×6–8 + 2 back-off ~44 ×8–10. Incliné 30° max, pas de verrouillage, étirement en bas.'},
 {id:'j5e2',name:'Smith incliné',sets:3,reps:'8',refText:'barre Smith + 80 kg',
  musP:['pecs'],musS:['delt_ant','triceps'],
  yt:'développé incliné smith machine technique',
  notes:'Barre Smith + 80 kg. Descente contrôlée jusqu’au haut des pecs, pas de rebond.'},
 {id:'j5e3',name:'Pec fly câble allongé ou croisé haute',sets:3,reps:'10–12',ref:18,unit:'kg/côté',
  musP:['pecs'],musS:[],
  yt:'pec fly câble croisé pectoraux technique',
  notes:'Straight sets. Réf J2 −10 % (~18/côté). Arc, coudes fixes, pic de contraction 1s.'},
 {id:'j5e4',name:'Élévation latérale câble',sets:3,reps:'10–12',ref:11.3,unit:'kg',
  musP:['delt_lat'],musS:[],
  yt:'élévation latérale câble technique',
  notes:'Straight sets. Tempo 3s à la descente. Poulie bassin, penché léger, pas d’élan.'}]},

{id:'j6',tab:'J6',title:'Jambes légères + avant-bras + abdos',sub:'Jambes · Bras · Abdos',
 warn:'Sciatique : pas de compression axiale, dos soutenu. Canal carpien gauche : stop les curls si fourmillements.',ex:[
 {id:'j6e1',name:'Leg extension',sets:3,reps:'12–15',ref:null,unit:'à calibrer',
  musP:['quadriceps'],musS:[],
  yt:'leg extension technique',
  notes:'Straight sets. Contraction 1s en haut, descente contrôlée. +1 plateau visé à 3×15.'},
 {id:'j6e2',name:'Leg curl',sets:3,reps:'12–15',ref:null,unit:'à calibrer',
  musP:['ischios'],musS:[],
  yt:'leg curl assis technique',
  notes:'Straight sets. Amplitude complète, contraction en fin de mouvement.'},
 {id:'j6e3',name:'Curl barre en V poulie',sets:3,reps:'8–10',ref:38,unit:'kg',
  musP:['biceps'],musS:['avant_bras'],
  yt:'curl barre poulie basse technique',
  notes:'Straight sets. Coudes fixes, supination. Arrêt si fourmillement gauche (canal carpien).'},
 {id:'j6e4',name:'Reverse curl câble EZ',sets:3,reps:'10–12',ref:null,unit:'à calibrer',
  musP:['avant_bras'],musS:['biceps'],
  yt:'reverse curl câble EZ avant-bras technique',
  notes:'Straight sets. Prise pronation, poignets neutres, contrôle à la descente.'},
 {id:'j6e5',name:'Crunch machine Matrix',sets:3,reps:'12–15',ref:null,unit:'progressif',
  musP:['abdos'],musS:[],
  yt:'abdominal crunch machine technique',
  notes:'2e passage abdos de la semaine. Enrouler la colonne, souffler, contraction, pas de traction sur la nuque.'}]}
];
const DEFAULT_EX={};
for(const s of DEFAULT_PROGRAM)for(const e of s.ex)DEFAULT_EX[e.id]=e;

/* ================== PROGRAMMES (multi) ================== */
/* Stockage : { programs:[{id,name,seances:[...]}], activeId }.
   Migration depuis l'ancien format (1 seul programme) sans perte. */
const KEY_PROGRAMS='dako_programs';   /* nouveau format multi */
const KEY_PROGRAM='muscu_program';    /* ancien format (compat) */
let PROGRAMS=[],ACTIVE_PID=null,PROGRAM=[],SEANCE={},EXO={};

function uid(p){return (p||'id')+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-3)}
function activeProgram(){return PROGRAMS.find(p=>p.id===ACTIVE_PID)||PROGRAMS[0]||null}
function normEx(e,ref){
  if(!Array.isArray(e.musP)&&ref&&DEFAULT_EX[e.id]){e.musP=DEFAULT_EX[e.id].musP.slice();e.musS=DEFAULT_EX[e.id].musS.slice()}
  if(!Array.isArray(e.musP))e.musP=[];
  if(!Array.isArray(e.musS))e.musS=[];
}
function normalizePrograms(){
  for(const p of PROGRAMS){
    if(!p.id)p.id=uid('p_');
    if(!p.name)p.name='Programme';
    if(!Array.isArray(p.seances))p.seances=[];
    for(const s of p.seances){
      if(!s.id)s.id=uid('s_');
      if(!Array.isArray(s.ex))s.ex=[];
      for(const e of s.ex){if(!e.id)e.id=uid('e_');normEx(e,true);}
    }
  }
  if(!PROGRAMS.some(p=>p.id===ACTIVE_PID))ACTIVE_PID=(PROGRAMS[0]||{}).id||null;
}
function loadProgram(){
  let store=null;
  try{store=JSON.parse(localStorage.getItem(KEY_PROGRAMS))}catch(e){}
  if(store&&Array.isArray(store.programs)&&store.programs.length){
    PROGRAMS=store.programs;ACTIVE_PID=store.activeId||store.programs[0].id;
    normalizePrograms();
  }else{
    /* migration : on enveloppe le programme existant (custom ou défaut) */
    let legacy=null;
    try{legacy=JSON.parse(localStorage.getItem(KEY_PROGRAM))}catch(e){}
    const hasCustom=Array.isArray(legacy)&&legacy.length;
    const seances=hasCustom?legacy:JSON.parse(JSON.stringify(DEFAULT_PROGRAM));
    PROGRAMS=[{id:'p_main',name:hasCustom?'Mon programme':'Programme principal',seances}];
    ACTIVE_PID='p_main';
    normalizePrograms();savePrograms();
  }
  buildMaps();
}
function buildMaps(){
  SEANCE={};EXO={};
  /* SEANCE et EXO couvrent TOUS les programmes (navigation + historique global) */
  for(const p of PROGRAMS)for(const s of (p.seances||[])){
    SEANCE[s.id]=s;
    for(const e of (s.ex||[]))EXO[e.id]=Object.assign({seance:s.id,program:p.id},e);
  }
  const act=activeProgram();
  PROGRAM=act?act.seances:[]; /* PROGRAM = séances du programme actif (accueil, reco, records) */
}
function savePrograms(){if(STORAGE_READY){try{localStorage.setItem(KEY_PROGRAMS,JSON.stringify({programs:PROGRAMS,activeId:ACTIVE_PID}))}catch(e){storeFailed()}mirrorSoon();}buildMaps()}
const saveProgram=savePrograms; /* compat : édition de séance */
function resetProgram(){ /* réinitialise le programme ACTIF au modèle par défaut */
  const act=activeProgram();if(!act)return false;
  if(DB.active&&act.seances.some(s=>s.id===DB.active.seance)){toast('Termine la séance en cours avant de réinitialiser');return false;}
  act.seances=regenIds(JSON.parse(JSON.stringify(DEFAULT_PROGRAM)));
  normalizePrograms();savePrograms();
  return true;
}
/* ---- gestion des programmes ---- */
function regenIds(seances,keepDefault){
  for(const s of seances){
    if(!keepDefault)s.id=uid('s_');
    for(const e of (s.ex||[])){if(!keepDefault)e.id=uid('e_');}
  }
  return seances;
}
function blankSeance(){return{id:uid('s_'),tab:'Séance',title:'Nouvelle séance',sub:'',warn:'',ex:[]}}
function setActiveProgram(pid){if(PROGRAMS.some(p=>p.id===pid)){ACTIVE_PID=pid;savePrograms()}}
function createProgram(name,fromDefault){
  const pid=uid('p_');
  const seances=fromDefault?regenIds(JSON.parse(JSON.stringify(DEFAULT_PROGRAM))):[blankSeance()];
  PROGRAMS.push({id:pid,name:name||'Nouveau programme',seances});
  ACTIVE_PID=pid;normalizePrograms();savePrograms();return pid;
}
function duplicateProgram(pid){
  const src=PROGRAMS.find(p=>p.id===pid);if(!src)return;
  const copy={id:uid('p_'),name:src.name+' (copie)',seances:regenIds(JSON.parse(JSON.stringify(src.seances)))};
  PROGRAMS.push(copy);ACTIVE_PID=copy.id;normalizePrograms();savePrograms();
}
function deleteProgram(pid){
  if(DB.active&&(PROGRAMS.find(p=>p.id===pid)?.seances||[]).some(s=>s.id===DB.active.seance)){toast('Termine la séance en cours avant de supprimer ce programme');return false;}
  if(PROGRAMS.length<=1){toast('Au moins un programme requis');return false}
  PROGRAMS=PROGRAMS.filter(p=>p.id!==pid);
  if(ACTIVE_PID===pid)ACTIVE_PID=PROGRAMS[0].id;
  savePrograms();return true;
}
function renameProgram(pid,name){const p=PROGRAMS.find(x=>x.id===pid);if(p&&name){p.name=name;savePrograms()}}
function addSeance(){const act=activeProgram();if(!act)return null;const s=blankSeance();act.seances.push(s);savePrograms();return s.id;}
function deleteSeance(sid){if(DB.active?.seance===sid){toast('Termine la séance en cours avant de la supprimer');return;}const act=activeProgram();if(!act)return;act.seances=act.seances.filter(s=>s.id!==sid);savePrograms();}
function moveSeance(sid,dir){const act=activeProgram();if(!act)return;const a=act.seances;const i=a.findIndex(s=>s.id===sid);if(i<0)return;const j=i+dir;if(j<0||j>=a.length)return;const t=a[i];a[i]=a[j];a[j]=t;savePrograms();}

/* ================== RÉGLAGES ================== */
const KEY_SETTINGS='muscu_settings';
let SETTINGS=loadSettings();
function applyTheme(){const t=(SETTINGS&&SETTINGS.theme)||'dark';if(t==='dark')document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',t);}
applyTheme();
function loadSettings(){
  let s=null;
  try{s=JSON.parse(localStorage.getItem(KEY_SETTINGS))}catch(e){}
  if(!s||typeof s!=='object')s={};
  return{
    rest:[90,120,180,240].includes(s.rest)?s.rest:180,
    poids:numOrNull(s.poids)||PROFILE.poids_kg,
    taille:intOrNull(s.taille)||PROFILE.taille_cm,
    age:intOrNull(s.age)||PROFILE.age,
    objectif:(typeof s.objectif==='string'?s.objectif:''),
    salle:(typeof s.salle==='string'&&s.salle)?s.salle:'On Air',
    niveau:(typeof s.niveau==='string')?s.niveau:'',
    theme:(['dark','rose'].indexOf(s.theme)>=0?s.theme:'dark'),
    ...(Array.isArray(s.exerciseLibrary)?{exerciseLibrary:s.exerciseLibrary}:{}),
    ...(Array.isArray(s.exerciseFavorites)?{exerciseFavorites:s.exerciseFavorites}:{}),
    ...(Array.isArray(s.exerciseRecent)?{exerciseRecent:s.exerciseRecent}:{})
  };
}
function saveSettings(){try{localStorage.setItem(KEY_SETTINGS,JSON.stringify(SETTINGS))}catch(e){storeFailed()}mirrorSoon()}

/* ================== BILAN FORME (poids + mensurations) ================== */
const MEASURES=[
 {id:'poids',label:'Poids',unit:'kg'},
 {id:'mg',label:'Masse grasse',unit:'%'},
 {id:'taille',label:'Tour de taille',unit:'cm'},
 {id:'poitrine',label:'Poitrine',unit:'cm'},
 {id:'bras',label:'Bras',unit:'cm'},
 {id:'cuisse',label:'Cuisse',unit:'cm'},
 {id:'hanches',label:'Hanches',unit:'cm'},
 {id:'mollet',label:'Mollet',unit:'cm'}
];
const MEASURE_BY_ID={};MEASURES.forEach(m=>MEASURE_BY_ID[m.id]=m);
const KEY_BODY='dako_body';
let BODY=loadBody();
function loadBody(){
  let a=null;try{a=JSON.parse(localStorage.getItem(KEY_BODY))}catch(e){}
  if(!Array.isArray(a))a=[];
  a=a.filter(b=>b&&typeof b.date==='string'&&b.vals&&typeof b.vals==='object');
  a.sort((x,y)=>x.date<y.date?-1:1);
  return a;
}
function saveBody(){try{localStorage.setItem(KEY_BODY,JSON.stringify(BODY))}catch(e){storeFailed()}mirrorSoon()}
function addBody(entry){
  const i=BODY.findIndex(b=>b.date===entry.date);
  if(i>=0)BODY[i]={date:entry.date,vals:Object.assign({},BODY[i].vals,entry.vals)};
  else BODY.push(entry);
  BODY.sort((x,y)=>x.date<y.date?-1:1);
  const lp=lastVal('poids');
  if(lp!=null){SETTINGS.poids=lp;saveSettings();}
  saveBody();
}
function bodySeries(id){return BODY.filter(b=>b.vals[id]!=null).map(b=>({date:b.date,v:b.vals[id]}))}
function lastVal(id){const s=bodySeries(id);return s.length?s[s.length-1].v:null}
function prevVal(id){const s=bodySeries(id);return s.length>1?s[s.length-2].v:null}
function firstVal(id){const s=bodySeries(id);return s.length?s[0].v:null}

/* ================== BIBLIOTHÈQUE DE MACHINES ================== */
/* Classées par marque (b) et muscles ciblés (p=principaux, s=secondaires).
   Base composée à partir des gammes commerciales courantes (indicatif). */
const XLABEL={abdos:'Abdominaux',adducteurs:'Adducteurs',cardio:'Cardio',lombaires:'Lombaires'};
function mLabel(id){return (MUSCLE_BY_ID[id]&&MUSCLE_BY_ID[id].label)||XLABEL[id]||id;}
const MACHINES=[
 /* Pectoraux */
 {n:'Chest Press',b:'Technogym',p:['pecs'],s:['triceps','delt_ant'],t:'Machine'},
 {n:'Chest Press',b:'Matrix',p:['pecs'],s:['triceps','delt_ant'],t:'Machine'},
 {n:'ISO-Lateral Bench Press',b:'Hammer Strength',p:['pecs'],s:['triceps','delt_ant'],t:'Convergente'},
 {n:'ISO-Lateral Incline Press',b:'Hammer Strength',p:['pecs'],s:['delt_ant','triceps'],t:'Convergente'},
 {n:'ISO-Lateral Decline Press',b:'Hammer Strength',p:['pecs'],s:['triceps'],t:'Convergente'},
 {n:'Chest Press',b:'Gym80',p:['pecs'],s:['triceps','delt_ant'],t:'Machine'},
 {n:'Incline Press',b:'Technogym',p:['pecs'],s:['delt_ant','triceps'],t:'Machine'},
 {n:'Pec Deck (Fly)',b:'Technogym',p:['pecs'],s:[],t:'Machine'},
 {n:'Pec Deck (Fly)',b:'Gym80',p:['pecs'],s:[],t:'Machine'},
 {n:'Cable Crossover',b:'Matrix',p:['pecs'],s:['delt_ant'],t:'Poulies'},
 {n:'Cable Crossover',b:'Technogym',p:['pecs'],s:['delt_ant'],t:'Poulies'},
 {n:'Pec Fly (poulies, allongé)',b:'Matrix',p:['pecs'],s:[],t:'Poulies'},
 {n:'Développé couché (barre)',b:'Eleiko',p:['pecs'],s:['triceps','delt_ant'],t:'Charge libre'},
 {n:'Développé couché / incliné haltères',b:'Charge libre',p:['pecs'],s:['delt_ant','triceps'],t:'Haltères'},
 /* Dos */
 {n:'Lat Pulldown (tirage vertical)',b:'Technogym',p:['dos'],s:['biceps'],t:'Poulie haute'},
 {n:'Lat Pulldown',b:'Matrix',p:['dos'],s:['biceps'],t:'Poulie haute'},
 {n:'ISO-Lateral Front Lat Pulldown',b:'Hammer Strength',p:['dos'],s:['biceps'],t:'Convergente'},
 {n:'Seated Row (tirage horizontal)',b:'Technogym',p:['dos'],s:['biceps'],t:'Machine'},
 {n:'Seated Row',b:'Matrix',p:['dos'],s:['biceps'],t:'Machine'},
 {n:'ISO-Lateral Row',b:'Hammer Strength',p:['dos'],s:['biceps'],t:'Convergente'},
 {n:'ISO-Lateral High Row',b:'Hammer Strength',p:['dos'],s:['biceps','delt_post'],t:'Convergente'},
 {n:'ISO-Lateral D.Y. Row',b:'Hammer Strength',p:['dos'],s:['biceps'],t:'Convergente'},
 {n:'Pull-over',b:'Technogym',p:['dos'],s:[],t:'Machine'},
 {n:'Pull-over',b:'Gym80',p:['dos'],s:[],t:'Machine'},
 {n:'Tirage vertical unilatéral (poulie, banc devant)',b:'Matrix',p:['dos'],s:['biceps'],t:'Poulie'},
 {n:'Tirage horizontal unilatéral (poulie)',b:'Matrix',p:['dos'],s:['biceps'],t:'Poulie'},
 {n:'Pull-over (poulie)',b:'Matrix',p:['dos'],s:[],t:'Poulie'},
 {n:'Assisted Pull-up / Dips',b:'Matrix',p:['dos'],s:['biceps'],t:'Assistée'},
 {n:'T-Bar Row',b:'Hammer Strength',p:['dos'],s:['biceps'],t:'Charge libre'},
 {n:'Rowing barre / haltère',b:'Charge libre',p:['dos'],s:['biceps'],t:'Charge libre'},
 {n:'Soulevé de terre (barre)',b:'Eleiko',p:['dos','ischios','fessiers'],s:['lombaires','avant_bras'],t:'Charge libre'},
 {n:'Extension lombaire (banc à 45°)',b:'Technogym',p:['lombaires'],s:['fessiers','ischios'],t:'Machine'},
 /* Épaules */
 {n:'Shoulder Press',b:'Technogym',p:['delt_ant','delt_lat'],s:['triceps'],t:'Machine'},
 {n:'Shoulder Press',b:'Matrix',p:['delt_ant','delt_lat'],s:['triceps'],t:'Machine'},
 {n:'ISO-Lateral Shoulder Press',b:'Hammer Strength',p:['delt_ant','delt_lat'],s:['triceps'],t:'Convergente'},
 {n:'Shoulder Press',b:'Gym80',p:['delt_ant','delt_lat'],s:['triceps'],t:'Machine'},
 {n:'Lateral Raise (machine)',b:'Technogym',p:['delt_lat'],s:[],t:'Machine'},
 {n:'Lateral Raise (machine)',b:'Gym80',p:['delt_lat'],s:[],t:'Machine'},
 {n:'Élévation latérale (poulie)',b:'Matrix',p:['delt_lat'],s:[],t:'Poulie'},
 {n:'Rear Delt / Reverse Fly',b:'Technogym',p:['delt_post'],s:[],t:'Machine'},
 {n:'Face Pull (corde)',b:'Matrix',p:['delt_post'],s:['dos'],t:'Poulie'},
 {n:'Développé militaire (barre)',b:'Eleiko',p:['delt_ant'],s:['delt_lat','triceps'],t:'Charge libre'},
 /* Biceps */
 {n:'Biceps Curl (machine)',b:'Technogym',p:['biceps'],s:[],t:'Machine'},
 {n:'Preacher Curl (pupitre)',b:'Hammer Strength',p:['biceps'],s:[],t:'Machine'},
 {n:'Preacher Curl (pupitre)',b:'Technogym',p:['biceps'],s:[],t:'Machine'},
 {n:'Curl poulie basse',b:'Matrix',p:['biceps'],s:['avant_bras'],t:'Poulie'},
 {n:'Curl barre EZ / haltères',b:'Charge libre',p:['biceps'],s:['avant_bras'],t:'Charge libre'},
 {n:'Curl incliné (haltères)',b:'Charge libre',p:['biceps'],s:[],t:'Haltères'},
 {n:'Curl marteau (haltères)',b:'Charge libre',p:['biceps'],s:['avant_bras'],t:'Haltères'},
 /* Triceps */
 {n:'Triceps Extension (machine)',b:'Technogym',p:['triceps'],s:[],t:'Machine'},
 {n:'Dips (machine assistée)',b:'Matrix',p:['triceps'],s:['pecs','delt_ant'],t:'Assistée'},
 {n:'Dips (machine convergente)',b:'Hammer Strength',p:['triceps'],s:['pecs'],t:'Convergente'},
 {n:'Pushdown (poulie haute)',b:'Matrix',p:['triceps'],s:[],t:'Poulie'},
 {n:'Extension overhead (corde)',b:'Technogym',p:['triceps'],s:[],t:'Poulie'},
 /* Jambes (quadriceps / ischios) */
 {n:'Leg Press',b:'Technogym',p:['quadriceps','fessiers'],s:['ischios'],t:'Machine'},
 {n:'Leg Press 45°',b:'Hammer Strength',p:['quadriceps','fessiers'],s:['ischios'],t:'Charge libre'},
 {n:'Hack Squat',b:'Hammer Strength',p:['quadriceps'],s:['fessiers'],t:'Charge libre'},
 {n:'Hack Squat',b:'Gym80',p:['quadriceps'],s:['fessiers'],t:'Machine'},
 {n:'Leg Extension',b:'Technogym',p:['quadriceps'],s:[],t:'Machine'},
 {n:'Leg Extension',b:'Matrix',p:['quadriceps'],s:[],t:'Machine'},
 {n:'Leg Curl (assis)',b:'Technogym',p:['ischios'],s:[],t:'Machine'},
 {n:'Leg Curl (allongé)',b:'Technogym',p:['ischios'],s:['mollets'],t:'Machine'},
 {n:'Squat (barre + rack)',b:'Eleiko',p:['quadriceps','fessiers'],s:['ischios','lombaires'],t:'Charge libre'},
 {n:'Smith Machine',b:'Matrix',p:['quadriceps','fessiers'],s:['ischios'],t:'Guidée'},
 {n:'Fentes / Bulgarian (haltères)',b:'Charge libre',p:['quadriceps','fessiers'],s:['ischios'],t:'Haltères'},
 /* Fessiers */
 {n:'Hip Thrust (machine)',b:'Technogym',p:['fessiers'],s:['ischios'],t:'Machine'},
 {n:'Hip Thrust (barre)',b:'Charge libre',p:['fessiers'],s:['ischios'],t:'Charge libre'},
 {n:'Abducteurs (machine)',b:'Technogym',p:['fessiers'],s:[],t:'Machine'},
 {n:'Adducteurs (machine)',b:'Technogym',p:['adducteurs'],s:[],t:'Machine'},
 {n:'Glute / Kickback (poulie)',b:'Matrix',p:['fessiers'],s:[],t:'Poulie'},
 /* Mollets */
 {n:'Mollets debout (standing calf)',b:'Matrix',p:['mollets'],s:[],t:'Machine'},
 {n:'Mollets assis (seated calf)',b:'Technogym',p:['mollets'],s:[],t:'Machine'},
 /* Abdos */
 {n:'Abdominal Crunch (machine)',b:'Technogym',p:['abdos'],s:[],t:'Machine'},
 {n:'Rotary Torso',b:'Technogym',p:['abdos'],s:[],t:'Machine'},
 {n:'Crunch poulie haute (corde)',b:'Matrix',p:['abdos'],s:[],t:'Poulie'},
 {n:'Chaise romaine (relevé jambes)',b:'Charge libre',p:['abdos'],s:[],t:'Poids du corps'},
 /* Haltères & barre (charge libre) */
 {n:'Développé couché (haltères)',b:'Charge libre',p:['pecs'],s:['triceps','delt_ant'],t:'Haltères'},
 {n:'Développé incliné (haltères)',b:'Charge libre',p:['pecs'],s:['delt_ant','triceps'],t:'Haltères'},
 {n:'Écarté incliné (haltères)',b:'Charge libre',p:['pecs'],s:[],t:'Haltères'},
 {n:'Développé militaire (haltères)',b:'Charge libre',p:['delt_ant','delt_lat'],s:['triceps'],t:'Haltères'},
 {n:'Élévations latérales (haltères)',b:'Charge libre',p:['delt_lat'],s:[],t:'Haltères'},
 {n:'Oiseau / Reverse fly (haltères)',b:'Charge libre',p:['delt_post'],s:['dos'],t:'Haltères'},
 {n:'Haussements d’épaules / Shrugs (haltères)',b:'Charge libre',p:['dos'],s:[],t:'Haltères'},
 {n:'Rowing buste penché (barre)',b:'Charge libre',p:['dos'],s:['biceps','delt_post'],t:'Charge libre'},
 {n:'Rowing unilatéral (haltère, banc)',b:'Charge libre',p:['dos'],s:['biceps'],t:'Haltères'},
 {n:'Soulevé de terre roumain (barre)',b:'Charge libre',p:['ischios'],s:['fessiers'],t:'Charge libre'},
 {n:'Good morning (barre)',b:'Charge libre',p:['ischios'],s:['fessiers'],t:'Charge libre'},
 {n:'Fentes marchées (haltères)',b:'Charge libre',p:['quadriceps'],s:['fessiers','ischios'],t:'Haltères'},
 {n:'Squat bulgare (haltères, banc)',b:'Charge libre',p:['quadriceps'],s:['fessiers'],t:'Haltères'},
 {n:'Curl pupitre / Larry Scott (machine)',b:'Technogym',p:['biceps'],s:[],t:'Machine'},
 {n:'Extension triceps corde (poulie)',b:'Matrix',p:['triceps'],s:[],t:'Poulie'},
 {n:'Kickback triceps (poulie)',b:'Matrix',p:['triceps'],s:[],t:'Poulie'},
 {n:'Élévations latérales (poulie)',b:'Matrix',p:['delt_lat'],s:[],t:'Poulie'},
 {n:'Face pull (poulie, corde)',b:'Matrix',p:['delt_post'],s:['dos'],t:'Poulie'},
 /* Cardio */
 {n:'Tapis de course',b:'Technogym',p:['cardio'],s:[],t:'Cardio'},
 {n:'Tapis de course',b:'Life Fitness',p:['cardio'],s:[],t:'Cardio'},
 {n:'Vélo / vélo assis',b:'Matrix',p:['cardio'],s:[],t:'Cardio'},
 {n:'Rameur',b:'Technogym',p:['cardio'],s:['dos'],t:'Cardio'},
 {n:'Elliptique',b:'Technogym',p:['cardio'],s:[],t:'Cardio'},
 {n:'SkillMill',b:'Technogym',p:['cardio'],s:['fessiers'],t:'Cardio'},
 {n:'Stair / Climb',b:'Life Fitness',p:['cardio'],s:['fessiers'],t:'Cardio'},
 ...(typeof EXERCISE_CATALOG==='undefined'?[]:EXERCISE_CATALOG),
 ...(typeof MATRIX_CATALOG==='undefined'?[]:MATRIX_CATALOG)
];
const CATALOG_BY_NAME=new Map(MACHINES.filter(m=>m.pattern).flatMap(m=>[[searchKey(m.n),m],[searchKey(m.n+' ('+m.b+')'),m]]));
const MACHINE_GROUPS=[['pecs','Pecs',['pecs']],['dos','Dos',['dos','lombaires']],['epaules','Épaules',['delt_ant','delt_lat','delt_post']],['biceps','Biceps',['biceps']],['triceps','Triceps',['triceps']],['avant_bras','Avant-bras',['avant_bras']],['jambes','Jambes',['quadriceps','ischios']],['fessiers','Fessiers',['fessiers','adducteurs']],['mollets','Mollets',['mollets']],['abdos','Abdos',['abdos']],['cardio','Cardio',['cardio']]];
/* Marques réelles par enseigne (recherche 2026). Base indicative : composition courante des clubs, pas un inventaire club par club. */
const CHAINS=['On Air','Basic-Fit','Fitness Park'];
const BRAND_CHAINS={'Technogym':['On Air','Basic-Fit','Fitness Park'],'Matrix':['Basic-Fit'],'Hammer Strength':['Fitness Park','On Air'],'Gym80':['On Air'],'Eleiko':['Fitness Park','On Air'],'Life Fitness':['Basic-Fit','On Air'],'Charge libre':['On Air','Basic-Fit','Fitness Park']};
const TIP_BY_PATTERN={
 cardio:'Échauffe-toi progressivement, buste droit et regard loin ; règle l’intensité selon ta zone d’effort.',
 chestpress:'Règle l’assise pour avoir les poignées à hauteur de poitrine, coudes ~45°, pousse sans verrouiller et contrôle le retour.',
 benchpress:'Omoplates serrées, pieds ancrés, descends au niveau des pectoraux poignets solides, pousse sans rebond sur la poitrine.',
 inclinepress:'Banc à ~30°, descends en haut des pectoraux, coudes ~45°, pousse sans creuser le bas du dos.',
 shoulderpress:'Gaine les abdos, pousse au-dessus de la tête sans cambrer, descends jusqu’au niveau des oreilles.',
 fly:'Léger fléchissement des coudes maintenu, ouvre en grand pour étirer les pectoraux, resserre en les contractant.',
 pullover:'Bras quasi tendus, va chercher l’étirement derrière la tête, ramène en pensant « grand dorsal », pas les bras.',
 pulldown:'Poitrine haute, tire les coudes vers les hanches, étire complètement en haut sans te balancer.',
 rowhoriz:'Buste fixe, tire le coude vers l’arrière et serre les omoplates en fin de course, sans à-coups.',
 reardelt:'Buste penché ou poulie à hauteur du visage : ouvre vers l’arrière en serrant les épaules, sans tirer avec les bras.',
 lateral:'Léger et strict : épaule basse, initie au coude, monte jusqu’à l’horizontale sans élan.',
 shrug:'Monte les épaules droit vers les oreilles, pause en haut, redescends lentement sans rouler les épaules.',
 curl:'Coudes fixes contre le corps, supination complète en haut, retiens la descente.',
 triceps:'Coudes fixes le long du corps, verrouille en bas, garde la tension sur tout le mouvement.',
 legpress:'Pieds largeur d’épaules, descends jusqu’à ~90° aux genoux, pousse sans verrouiller, genoux dans l’axe des pieds.',
 squat:'Talons au sol, dos gainé, descends genoux dans l’axe des pieds, remonte en poussant le sol.',
 hipthrust:'Appui sur les talons, monte le bassin jusqu’à l’alignement, contracte les fessiers 1-2 s en haut sans cambrer.',
 hinge:'Charnière de hanche : fessiers en arrière, dos plat, descends jusqu’à l’étirement des ischios, remonte en serrant les fessiers.',
 lunge:'Grand pas, descends le genou arrière vers le sol, buste droit, pousse sur le talon avant pour remonter.',
 legext:'Contraction 1 s en haut, descente contrôlée, ne relâche jamais complètement la charge.',
 legcurl:'Amplitude complète, contracte les ischios en fin de mouvement, pas d’à-coups.',
 adductor:'Resserre les cuisses en contrôlant, courte pause en position fermée, retiens l’ouverture.',
 abductor:'Écarte les cuisses en contractant les fessiers, pause à l’ouverture, reviens en contrôlant.',
 calf:'Amplitude complète avec étirement en bas, pause 1 s en haut, pas de rebond.',
 abs:'Enroule la colonne en soufflant, contracte les abdos sans tirer sur la nuque, déroule lentement.'
};
function machineTip(m){return m.tip||TIP_BY_PATTERN[exPattern({name:m.n})]||'Mouvement contrôlé, amplitude complète, gaine le tronc.';}
function machineChains(m){return BRAND_CHAINS[m.b]||[];}
/* Type de chargement : broche (sélectorisée, pin) vs disques (plate-loaded) vs charge libre / poulie / poids du corps. */
function machineLoad(m){
  if(m.load)return m.load;
  const t=m.t||'',n=m.n||'';
  if(t==='Cardio')return 'cardio';
  if(t==='Poids du corps')return 'corps';
  if(/Poulie/i.test(t))return 'poulie';
  if(/Hack Squat|Leg Press 45|T-Bar/i.test(n))return 'disques';
  if(t==='Haltères')return 'libre';
  if(t==='Convergente'||t==='Guidée')return 'disques';
  if(t==='Assistée')return 'broche';
  if(t==='Charge libre')return 'libre';
  return 'broche';
}
const LOAD_SHORT={broche:'Broche (pin)',disques:'À disques (poids)',libre:'Charge libre',poulie:'Poulie',corps:'Poids du corps',cardio:'Cardio'};
const LOAD_DESC={broche:'Sélectorisée : tu choisis la charge avec une broche dans la pile, rien à porter.',disques:'Plate-loaded : tu charges et décharges les disques toi-même.',libre:'Charge libre (barre / haltères) : équilibre et gainage en plus.',poulie:'Poulie à broche : tension constante, réglage rapide.',corps:'Au poids du corps (lestable).',cardio:'Appareil cardio.'};
const LOAD_FILTER=[['broche','Pin / broche'],['disques','Poids / disques'],['libre','Charge libre'],['poulie','Poulie'],['corps','Poids du corps'],['cardio','Cardio']];

/* ================== DONNÉES SÉANCES ================== */
loadProgram(); /* doit précéder loadDB() : la migration s'appuie sur EXO */
const KEY='muscu_v3';
let DB=loadDB();
function loadDB(){
  let db=null;
  try{db=JSON.parse(localStorage.getItem(KEY))}catch(e){}
  if(!db||typeof db!=='object')db={workouts:[],active:null};
  if(!Array.isArray(db.workouts))db.workouts=[];
  /* migration depuis l'ancien format fichier V2 */
  if(!db.migrated){
    try{
      const old=JSON.parse(localStorage.getItem('muscu_logs_v2'));
      if(old&&typeof old==='object'){
        const byKey={};
        for(const exId in old){
          if(!EXO[exId]||!Array.isArray(old[exId]))continue;
          for(const en of old[exId]){
            if(!en||!en.d||!Array.isArray(en.s))continue;
            const k=en.d+'|'+EXO[exId].seance;
            if(!byKey[k])byKey[k]={date:en.d,seance:EXO[exId].seance,ex:{}};
            byKey[k].ex[exId]=en.s.map(x=>({w:numOrNull(x.w),r:numOrNull(x.r),done:true}));
          }
        }
        for(const k in byKey){
          const w=byKey[k];
          if(!db.workouts.some(x=>x.date===w.date&&x.seance===w.seance))
            db.workouts.push({date:w.date,seance:w.seance,dur:null,ex:w.ex});
        }
      }
    }catch(e){}
    db.migrated=true;
  }
  db.workouts.sort((a,b)=>a.date<b.date?-1:1);
  return db;
}
var _storeWarned=false; /* var volontaire (anti-TDZ) : storeFailed peut être appelé pendant la migration au chargement, AVANT cette ligne — ne pas repasser en let */
function storeFailed(){STORAGE_WRITABLE=false;if(_storeWarned)return;_storeWarned=true;try{toast('Sauvegarde impossible : exporte tes données avant de fermer l’app')}catch(e){}}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(DB))}catch(e){storeFailed()}mirrorSoon()}

/* Les ressentis appartiennent a une seance realisee, jamais au programme. */
function workoutNote(w,exId){
  const note=w&&w.exNotes&&w.exNotes[exId];
  return typeof note==='string'?note.slice(0,2000):'';
}
function cleanWorkoutNotes(notes){
  return Object.fromEntries(Object.entries(notes&&typeof notes==='object'?notes:{})
    .filter(([id,note])=>typeof note==='string'&&note.trim())
    .map(([id,note])=>[id,note.slice(0,2000).trim()]));
}
function workoutExerciseIds(w){
  return [...new Set([...Object.keys(w.ex||{}),...Object.keys(cleanWorkoutNotes(w.exNotes))])];
}
function workoutNoteField(w,exId,editing){
  return '<label class="workout-note"><span>Note · ressenti du jour</span>'
    +'<textarea class="'+(editing?'we-note':'session-note')+'" data-ex="'+esc(exId)+'" rows="2" maxlength="2000" placeholder="Isolation bonne, ressenti correct…">'
    +esc(workoutNote(w,exId))+'</textarea></label>';
}
function workoutNoteHTML(note){
  return note?'<div class="workout-note-read"><span>Ressenti</span><p>'+esc(note)+'</p></div>':'';
}
function previousNoteHTML(exId){
  let previous=null;
  for(const w of DB.workouts){
    if(workoutNote(w,exId).trim()&&(!previous||w.date>=previous.date))previous=w;
  }
  if(!previous)return '';
  return '<details class="previous-note"><summary>'+uiIcon('notebook-pen')+'<span>Dernier ressenti</span><time datetime="'+esc(previous.date)+'">'+esc(fmtDateShort(previous.date))+'</time></summary>'
    +'<p>'+esc(workoutNote(previous,exId))+'</p></details>';
}

/* ===== Sauvegarde durable — miroir IndexedDB (anti-purge iOS) =====
   localStorage reste le stockage de travail (synchrone). À chaque
   écriture, on recopie un instantané dans IndexedDB, plus résistant
   à l'effacement automatique d'iOS. Au démarrage, si le localStorage
   a été purgé mais que l'instantané existe, on le restaure. */
const IDB_NAME='dako_store',IDB_STORE='kv';
const MIRROR_KEYS=[KEY_PROGRAMS,KEY,KEY_SETTINGS,KEY_BODY,'dako_lastbackup','dko_cloud_link'];
function idbOpen(){return new Promise((res,rej)=>{let r;try{r=indexedDB.open(IDB_NAME,1)}catch(e){return rej(e)}r.onupgradeneeded=()=>{try{r.result.createObjectStore(IDB_STORE)}catch(e){}};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function idbSet(k,v){return idbOpen().then(db=>new Promise((res,rej)=>{const tx=db.transaction(IDB_STORE,'readwrite');tx.objectStore(IDB_STORE).put(v,k);tx.oncomplete=()=>{db.close();res(true)};tx.onerror=tx.onabort=()=>{db.close();rej(tx.error)}})).catch(()=>false)}
function idbGet(k){return idbOpen().then(db=>new Promise((res,rej)=>{const tx=db.transaction(IDB_STORE,'readonly');const rq=tx.objectStore(IDB_STORE).get(k);rq.onsuccess=()=>res(rq.result);rq.onerror=()=>rej(rq.error);tx.oncomplete=()=>db.close()})).catch(()=>null)}
function storageSnapshot(){const snap={v:1,t:Date.now(),data:{}};for(const k of MIRROR_KEYS){const v=localStorage.getItem(k);if(v!=null)snap.data[k]=v}return snap;}
function mirrorSnapshot(){if(!STORAGE_READY||!STORAGE_WRITABLE)return Promise.resolve(false);try{return idbSet('snapshot',storageSnapshot())}catch(e){return Promise.resolve(false)}}
var _mirT=null; /* var volontaire (anti-TDZ) : mirrorSoon peut être appelé pendant la migration au chargement (loadProgram->savePrograms), AVANT cette ligne — ne pas repasser en let */
function mirrorSoon(){if(!STORAGE_READY)return;clearTimeout(_mirT);_mirT=setTimeout(mirrorSnapshot,400);window.DKOCloudUI?.changed();window.DKOCoachUI?.changed();}
function maybeRestoreFromIDB(){
  return idbGet('snapshot').then(snap=>{
    if(!snap||!snap.data)return false;
    let restored=false;
    for(const k of MIRROR_KEYS){
      if(localStorage.getItem(k)==null&&typeof snap.data[k]==='string'){
        try{localStorage.setItem(k,snap.data[k]);restored=true;}catch(e){storeFailed();}
      }
    }
    return restored;
  }).catch(()=>false);
}

function snapshotWorkout(w){
  if(!w.id)w.id=uid('w_');
  return snapshotMetadata(w,EXO,SEANCE);
}
function snapshotMetadata(w,exercises,sessions){
  const s=sessions[w.seance];
  if(!w.session)w.session={title:s?.title||w.seance,tab:s?.tab||''};
  w.exMeta=w.exMeta||{};
  for(const id of workoutExerciseIds(w))if(!w.exMeta[id]){
    const e=exercises[id]||{};
    w.exMeta[id]={name:e.name||id,unit:e.unit||'kg',musP:(e.musP||[]).slice(),musS:(e.musS||[]).slice(),sets:e.sets,reps:e.reps,ref:e.ref,refText:e.refText,notes:e.notes||'',yt:e.yt||'',ceiling:e.ceiling,rest:e.rest,...(e.increment!=null?{increment:e.increment}:{})};
  }
  return w;
}
function workoutExercise(w,id){
  const saved=w?.exMeta?.[id],base=EXO[id];
  if(!saved)return base;
  return {...(base||{}),...saved,id};
}
function activeExercise(exId){return DB.active?workoutExercise(DB.active,exId):EXO[exId];}
function activeExerciseList(s,active){
  const order=active?.exerciseOrder||s.ex.map(e=>e.id);
  const original=new Map(s.ex.map(e=>[e.id,e]));
  return order.map(id=>{
    const saved=active?.exMeta?.[id];
    const base=original.get(id)||EXO[id]||{};
    return saved?{...base,...saved,id}:base.id?base:null;
  }).filter(Boolean);
}
function historicalExercises(){
  const all={...EXO};
  for(const w of DB.workouts)for(const id of workoutExerciseIds(w))all[id]={id,...workoutExercise(w,id)};
  return all;
}

/* requêtes */
function lastWorkoutOf(seanceId){const a=DB.workouts.filter(w=>w.seance===seanceId);return a.length?a[a.length-1]:null}
function exHistory(exId){
  const out=[];
  for(const w of DB.workouts){
    if(!w.ex||!w.ex[exId])continue;
    const sets=w.ex[exId].filter(s=>s.done&&(s.w!=null||s.r!=null));
    if(sets.length)out.push({date:w.date,sets,note:workoutNote(w,exId)});
  }
  return out;
}
function prevSets(exId){const h=exHistory(exId);return h.length?h[h.length-1].sets:null}
function previousExercise(e){
  let previous=null;
  for(const w of DB.workouts){
    if(w.date>(DB.active?.date||todayISO())||!(w.ex?.[e.id]||[]).some(s=>s.done&&(s.w!=null||s.r!=null)))continue;
    if(!previous||w.date>=previous.date)previous=w;
  }
  if(!previous)return null;
  const meta=workoutExercise(previous,e.id);
  if(meta?.name!==e.name||(meta?.unit||'kg')!==(e.unit||'kg'))return null;
  return {date:previous.date,sets:previous.ex[e.id].filter(s=>s.done&&(s.w!=null||s.r!=null))};
}
function comparisonSummary(current){
  let previous=null;
  for(const w of DB.workouts)if(w.seance===current.seance&&w.date<=current.date&&(!previous||w.date>=previous.date))previous=w;
  if(!previous)return null;
  const rows=[];
  for(const id of Object.keys(current.ex)){
    const now=workoutExercise(current,id),before=workoutExercise(previous,id);
    if(!now||!before||now.name!==before.name||(now.unit||'kg')!==(before.unit||'kg'))continue;
    const a=workoutStats({ex:{[id]:current.ex[id]}}),b=workoutStats({ex:{[id]:previous.ex[id]||[]}});
    if(a.sets&&b.sets){
      if(!current.ex[id].filter(s=>s.done).every(s=>s.w!=null&&s.r!=null))a.vol=null;
      if(!previous.ex[id].filter(s=>s.done).every(s=>s.w!=null&&s.r!=null))b.vol=null;
      rows.push({name:now.name,now:a,before:b});
    }
  }
  return rows.length?{date:previous.date,rows}:null;
}
function comparableBest(exId,current,date){
  let best=null;
  for(const w of DB.workouts){
    const meta=workoutExercise(w,exId);
    if(w.date>date||!meta||!current||meta.name!==current.name||(meta.unit||'kg')!==(current.unit||'kg'))continue;
    const value=maxW((w.ex[exId]||[]).filter(s=>s.done));
    if(value!=null&&(best==null||value>best))best=value;
  }
  return best;
}
function lastSessionLine(exId){
  const p=prevSets(exId);
  if(!p||!p.length)return '';
  const txt=p.map(s=>(s.w!=null?fmtN(s.w):'—')+'×'+(s.r!=null?fmtN(s.r):'—')).join(' · ');
  return '<div class="lastline" style="font-size:.8rem;color:var(--dim);padding:10px 2px 2px"><span class="lastlbl" style="color:var(--ac);font-weight:600">Dernière fois</span> '+txt+'</div>';
}
function maxW(sets){const ws=sets.map(s=>s.w).filter(w=>w!=null);return ws.length?Math.max(...ws):null}
function bestEver(exId){const h=exHistory(exId);let b=null;for(const en of h){const m=maxW(en.sets);if(m!=null&&(b==null||m>b))b=m}return b}
function workoutStats(w){
  let vol=0,sets=0;
  for(const exId in (w.ex||{}))for(const s of w.ex[exId])
    if(s.done&&s.w!=null&&s.r!=null){vol+=s.w*s.r;sets++}
    else if(s.done)sets++;
  return{vol:Math.round(vol),sets};
}
function sessionProgress(a){
  let done=0,total=0;
  for(const exId in a.ex){total+=a.ex[exId].length;done+=a.ex[exId].filter(s=>s.done).length}
  return{done,total};
}
function ytURL(e){return 'https://www.youtube.com/results?search_query='+encodeURIComponent(e.yt||e.name+' technique')}
/* Photos reelles des exercices — source free-exercise-db (Unlicense, domaine public), via CDN jsDelivr. Mapping fait main FR vers base. */
const EXIMG_BASE='https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/';
function exImgKey(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
const EXIMG={
 'row appui poitrine unilateral neutre':'Seated_Cable_Rows/0.jpg',
 'tirage triangle serre':'Seated_Cable_Rows/0.jpg',
 'diverging seated row unilateral':'Seated_Cable_Rows/0.jpg',
 'seated row':'Seated_Cable_Rows/0.jpg',
 'tirage horizontal':'Seated_Cable_Rows/0.jpg',
 'face pull corde':'Face_Pull/0.jpg',
 'face pull poulie corde':'Face_Pull/0.jpg',
 'rear delt fly cable poulies croisees':'Reverse_Machine_Flyes/0.jpg',
 'rear delt fly halteres penche':'Seated_Bent-Over_Rear_Delt_Raise/0.jpg',
 'oiseau reverse fly halteres':'Seated_Bent-Over_Rear_Delt_Raise/0.jpg',
 'developpe couche halteres':'Dumbbell_Bench_Press/0.jpg',
 'press matrix':'Leverage_Chest_Press/0.jpg',
 'chest press':'Leverage_Chest_Press/0.jpg',
 'iso lateral bench press':'Leverage_Chest_Press/0.jpg',
 'press incline machine':'Leverage_Incline_Chest_Press/0.jpg',
 'iso lateral incline press':'Leverage_Incline_Chest_Press/0.jpg',
 'developpe incline halteres':'Incline_Dumbbell_Press/0.jpg',
 'pec fly cable allonge sur banc':'Cable_Crossover/0.jpg',
 'cable croise poulie haute':'Cable_Crossover/0.jpg',
 'cable crossover technogym':'Cable_Crossover/0.jpg',
 'ecarte incline halteres':'Cable_Crossover/0.jpg',
 'pec fly':'Cable_Crossover/0.jpg',
 'elevation laterale unilaterale cable poulie bassin':'Side_Lateral_Raise/0.jpg',
 'elevation laterale haltere lean away':'Side_Lateral_Raise/0.jpg',
 'elevation laterale cable':'Side_Lateral_Raise/0.jpg',
 'elevations laterales halteres':'Side_Lateral_Raise/0.jpg',
 'elevations laterales poulie':'Side_Lateral_Raise/0.jpg',
 'press epaules machine':'Machine_Shoulder_Military_Press/0.jpg',
 'developpe militaire halteres':'Seated_Dumbbell_Press/0.jpg',
 'pushdown barre':'Triceps_Pushdown/0.jpg',
 'extension triceps corde poulie':'Triceps_Pushdown/0.jpg',
 'overhead triceps corde':'Cable_Rope_Overhead_Triceps_Extension/0.jpg',
 'overhead triceps':'Standing_Dumbbell_Triceps_Extension/0.jpg',
 'tirage vertical barre pronation':'Wide-Grip_Lat_Pulldown/0.jpg',
 'tirage vertical unilateral cable banc assis':'Wide-Grip_Lat_Pulldown/0.jpg',
 'lat pulldown':'Wide-Grip_Lat_Pulldown/0.jpg',
 'pull over cable finisher':'Straight-Arm_Pulldown/0.jpg',
 'curl alterne haltere':'Dumbbell_Alternate_Bicep_Curl/0.jpg',
 'curl pupitre matrix unilateral':'Preacher_Curl/0.jpg',
 'curl pupitre larry scott machine':'Preacher_Curl/0.jpg',
 'curl marteau halteres':'Hammer_Curls/0.jpg',
 'curl incline halteres':'Dumbbell_Bicep_Curl/0.jpg',
 'dips machine matrix':'Dips_-_Triceps_Version/0.jpg',
 'presse a cuisses':'Leg_Press/0.jpg',
 'leg extension':'Leg_Extensions/0.jpg',
 'leg curl':'Lying_Leg_Curls/0.jpg',
 'hack squat':'Hack_Squat/0.jpg',
 'souleve de terre roumain barre':'Romanian_Deadlift/0.jpg',
 'hip thrust barre':'Barbell_Hip_Thrust/0.jpg',
 'hip thrust machine':'Barbell_Hip_Thrust/0.jpg',
 'rowing buste penche barre':'Reverse_Grip_Bent-Over_Rows/0.jpg',
 'rowing unilateral haltere banc':'Bent_Over_Two-Dumbbell_Row/0.jpg',
 'mollets machine squat guide':'Standing_Calf_Raises/0.jpg',
 'mollets debout standing calf':'Standing_Calf_Raises/0.jpg',
 'abdominal crunch machine':'Cable_Crunch/0.jpg',
 'crunch poulie haute corde':'Cable_Crunch/0.jpg'
};
function exImage(name){const k=exImgKey(name);return EXIMG[k]?EXIMG_BASE+EXIMG[k]:null;}
function exPhotoHTML(name){const u=exImage(name);return u?'<div class="exphoto"><img src="'+u+'" alt="" loading="lazy" decoding="async"></div>':'';}
function bindExPhoto(){sheet.querySelectorAll('.exphoto img').forEach(im=>{const w=im.closest('.exphoto');const ok=()=>{if(w)w.classList.add('loaded')};if(im.complete&&im.naturalWidth)ok();im.addEventListener('load',ok,{once:true});im.addEventListener('error',()=>{if(w)w.remove();},{once:true});});}
function weekStart(d){const x=new Date(d);x.setHours(0,0,0,0);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);return x}
function isoOf(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}

/* ================== RÉCUPÉRATION MUSCULAIRE ================== */
/* Modèle : chaque séance charge les muscles travaillés (série validée :
   1 pt muscle principal, 0,5 pt secondaire). La fatigue décroît
   linéairement sur 48 h (petits muscles) ou 72 h (grands groupes).
   6 points de charge = fatigue maximale le jour même. */
function muscleFatigue(mid){
  const rec=(MUSCLE_BY_ID[mid]||{rec:48}).rec;
  const now=Date.now();
  let f=0;
  const since=new Date(now-rec*3.6e6);
  const minIso=isoOf(since);
  for(const w of DB.workouts){
    if(w.date<minIso)continue;
    const[y,mo,d]=w.date.split('-');
    const t=new Date(+y,mo-1,+d,12).getTime();
    const ageH=Math.max(0,(now-t)/3.6e6);
    if(ageH>=rec)continue;
    let load=0;
    for(const exId in (w.ex||{})){
      const e=workoutExercise(w,exId);if(!e)continue;
      const sets=w.ex[exId].filter(s=>s.done).length;
      if((e.musP||[]).includes(mid))load+=sets;
      else if((e.musS||[]).includes(mid))load+=sets*0.5;
    }
    if(load)f+=Math.min(1,load/6)*(1-ageH/rec);
  }
  if(DB.active){
    let load=0;
    for(const exId in DB.active.ex){
      const e=workoutExercise(DB.active,exId);if(!e)continue;
      const sets=DB.active.ex[exId].filter(s=>s.done).length;
      if((e.musP||[]).includes(mid))load+=sets;
      else if((e.musS||[]).includes(mid))load+=sets*0.5;
    }
    if(load)f+=Math.min(1,load/6);
  }
  return Math.min(1,f);
}
function muscleRecovery(mid){return Math.round(100*(1-muscleFatigue(mid)))}

function seanceRecoveryScore(s){
  const counts={};
  for(const e of s.ex)for(const m of (e.musP||[]))counts[m]=(counts[m]||0)+1;
  let sum=0,n=0;
  for(const m in counts){sum+=muscleRecovery(m)*counts[m];n+=counts[m]}
  return n?Math.round(sum/n):100;
}
function recommendSeance(){
  if(!PROGRAM.length||DB.active)return null;
  const today=todayISO();
  const info=PROGRAM.map(s=>{
    const last=lastWorkoutOf(s.id);
    return{id:s.id,score:seanceRecoveryScore(s),
      days:last?diffDays(last.date):9999,
      doneToday:!!last&&last.date===today};
  }).filter(x=>!x.doneToday);
  if(!info.length)return null;
  const ok=info.filter(x=>x.score>=75);
  const pool=ok.length?ok:info;
  pool.sort((a,b)=>b.days!==a.days?b.days-a.days:b.score-a.score);
  return pool[0];
}

/* ================== CIBLES AUTOMATIQUES ================== */
/* Double progression : +1 rep dans la fourchette, puis +charge et retour
   au bas de fourchette. Exercices plafonnés : reps uniquement (max 12). */
function repsRange(str){
  const m=String(str||'').match(/\d+(?:[.,]\d+)?/g)||[];
  const lo=m.length?numOrNull(m[0]):8;
  return[lo,m.length>1?numOrNull(m[1]):lo];
}
function wInc(w){return w>=60?2.5:w>=20?2:w>=10?1:0.5}
function exerciseIncrement(e,w){return Number.isFinite(e?.increment)&&e.increment>0?e.increment:wInc(w);}
function suggestTargets(e){
  const[lo,hi]=repsRange(e.reps);
  const prev=previousExercise(e)?.sets;
  const out=[];
  const n=Math.max(e.sets,prev?prev.length:0);
  for(let i=0;i<n;i++){
    const p=prev&&prev[i]?prev[i]:null;
    if(!p||(p.w==null&&p.r==null)){
      out.push(typeof e.ref==='number'?{w:e.ref,r:lo}:null);
      continue;
    }
    if(e.ceiling){
      if(p.r==null)out.push({w:p.w,r:lo});
      else if(p.r>=12)out.push({w:p.w,r:p.r});
      else out.push({w:p.w,r:p.r+1});
    }else if(p.r==null||p.w==null){
      out.push({w:p.w,r:p.r!=null?Math.min(p.r+1,hi):lo});
    }else if(p.r>=hi){
      out.push({w:Number((p.w+exerciseIncrement(e,p.w)).toFixed(4)),r:lo});
    }else{
      out.push({w:p.w,r:Math.min(p.r+1,hi)});
    }
  }
  return out;
}
function setShort(s){return s?(s.w!=null?fmtN(s.w):'—')+'×'+(s.r!=null?fmtN(s.r):'—'):'—'}
function firstUsefulSet(a){return(a||[]).find(s=>s&&(s.w!=null||s.r!=null))||null}
function targetCue(e){
  const targets=suggestTargets(e),prev=previousExercise(e)?.sets||[];
  const t=firstUsefulSet(targets),p=firstUsefulSet(prev);
  if(!t)return{tone:'base',title:'Cible à construire',body:'Valide une première séance pour générer une cible automatique.',target:'—'};
  let title='Même cible';
  if(e.ceiling)title='Monter les reps';
  else if(p&&t.w!=null&&p.w!=null&&t.w>p.w)title='Augmenter la charge';
  else if(p&&t.r!=null&&p.r!=null&&t.r>p.r)title='Ajouter une rep';
  const body=p?'Dernière fois '+setShort(p)+' · vise '+setShort(t):'Référence du programme · à adapter à ton niveau';
  return{tone:title==='Même cible'?'base':'hot',title,body,target:setShort(t)};
}
function activeExerciseScore(sets){
  const done=(sets||[]).filter(s=>s.done),best=maxW(done);
  return{done:done.length,total:(sets||[]).length,best};
}
function workoutCoachHTML(e,sets){
  const cue=targetCue(e),score=activeExerciseScore(sets);
  return '<div class="wcoach '+cue.tone+'"><div><div class="wcoach-k">Cible du jour</div><div class="wcoach-v">'+esc(cue.title)+' · <span class="num">'+esc(cue.target)+'</span></div>'
   +'<div class="wcoach-s">'+esc(cue.body)+'</div></div>'
   +'<div class="wcoach-r"><span class="num">'+score.done+'/'+score.total+'</span><small>Séries</small>'+(score.best!=null?'<b class="num">'+fmtN(score.best)+' kg</b>':'')+'</div>'
   +'</div>';
}

/* ================== ROUTAGE / RENDU ================== */
const app=document.getElementById('app');
let route={view:'home',seance:null};
let DASH_SIDE={sid:null,side:'front'};
let WORKOUT_MODE='focus',FOCUS_EX=null;
let MFILTER={g:null,b:null,c:null,l:null,q:'',open:false};
let LIBFILTER={mode:'browse',g:null,b:null,c:null,l:null,q:''};
let LIBSELECT=new Map(),LIBDRAFT=null,LIBSCOPE='all';
let STATSRANGE='week';   /* sélecteur Stats : 'week' | 'month' */
let STATEX=null;         /* exercice sélectionné pour la courbe de progression */
let SUIVI='history';     /* onglet Suivi fusionné : 'history' | 'stats' */
let editBaseline=null;
function editorState(){return JSON.stringify([...app.querySelectorAll('#es-title,#es-tab,#es-sub,#es-warn,#es-rest,#exlist .ecard')].map(el=>el.matches('.ecard')?[el.dataset.exid,...[...el.querySelectorAll('input,textarea,select')].map(input=>input.value)]:el.value));}
function editorDirty(){return route.view==='edit'&&editBaseline!==null&&editorState()!==editBaseline;}
function go(view,seance){
  if(view==='edit'&&DB.active?.seance===seance){toast('Termine la séance en cours avant de la modifier');return;}
  if(editorDirty()&&!window.confirm('Quitter sans enregistrer les modifications de cette séance ?'))return;
  if(route.view==='coach'&&view!=='coach'&&!window.DKOCoachUI?.leave())return;
  if(view==='edit'&&(route.view!=='edit'||route.seance!==seance)){LIBSELECT.clear();LIBDRAFT=null;LIBFILTER.mode='browse';}
  route={view,seance:seance||null};render();
  editBaseline=view==='edit'?editorState():null;
  window.scrollTo({top:0});
}
window.addEventListener('beforeunload',ev=>{if(editorDirty()||window.DKOCoachUI?.dirty()){ev.preventDefault();ev.returnValue='';}});

function render(){
  const tabFor={home:'home',seance:'home',edit:'programs',suivi:'suivi',stats:'suivi',history:'suivi',programs:'programs',machines:'programs',coach:'programs'};
  document.querySelectorAll('.tabbtn').forEach(b=>{
    const active=b.dataset.v===tabFor[route.view];b.classList.toggle('on',active);
    if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  app.dataset.view=route.view;
  app.dataset.workout=route.view==='seance'&&DB.active?.seance===route.seance?WORKOUT_MODE:'preview';
  if(route.view==='home')app.innerHTML=homeHTML();
  else if(route.view==='machines')app.innerHTML=machinesHTML();
  else if(route.view==='seance')app.innerHTML=seanceHTML(route.seance);
  else if(route.view==='edit')app.innerHTML=editHTML(route.seance);
  else if(route.view==='suivi'||route.view==='stats'||route.view==='history')app.innerHTML=suiviHTML();
  else if(route.view==='programs')app.innerHTML=programsHTML();
  else if(route.view==='coach')app.innerHTML=window.DKOCoachUI?.html()||'';
  else app.innerHTML=homeHTML();
  labelFields(app);
  syncExerciseFocus();
  window.DKOCloudUI?.refreshBadge?.();
  if(route.view==='coach')window.DKOCoachUI?.mount();
  const filters=app.querySelector('#machineFilters');
  if(filters)filters.addEventListener('toggle',()=>{MFILTER.open=filters.open});
  app.classList.remove('vin');void app.offsetWidth;app.classList.add('vin'); /* transition d'entrée */
}

/* ---------- accueil (dashboard) ---------- */
function sessionMuscles(s){
  const p=new Set(),sec=new Set();
  for(const e of (s.ex||[])){(e.musP||[]).forEach(m=>p.add(m));(e.musS||[]).forEach(m=>sec.add(m));}
  sec.forEach(m=>{if(p.has(m))sec.delete(m)});
  return{p,s:sec};
}
function weekStripHTML(now){
  /* bande de la semaine en cours : 7 pastilles (entraîné = rouge, aujourd'hui surligné) */
  const ws=weekStart(now);
  const labels=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const today=todayISO();
  const trained=new Set(DB.workouts.map(w=>w.date));
  let cells='';
  for(let i=0;i<7;i++){
    const d=new Date(ws);d.setDate(ws.getDate()+i);
    const iso=isoOf(d);
    const cls=(trained.has(iso)?' on':'')+(iso===today?' today':'')+(iso>today?' fut':'');
    cells+='<div class="wk-cell'+cls+'" aria-label="'+esc(d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}))+(trained.has(iso)?' · entraînement enregistré':'')+'"'+(iso===today?' aria-current="date"':'')+'><span class="wk-d">'+labels[i]+'</span><span class="wk-n num">'+d.getDate()+'</span><span class="wk-dot"></span></div>';
  }
  return '<div class="weekstrip">'+cells+'</div>';
}
function weeklyTrendHTML(now){
  const weeks=[];
  for(let i=5;i>=0;i--){
    const start=weekStart(now);start.setDate(start.getDate()-i*7);
    const end=new Date(start);end.setDate(end.getDate()+7);
    const a=isoOf(start),b=isoOf(end);
    const vol=DB.workouts.filter(w=>w.date>=a&&w.date<b).reduce((sum,w)=>sum+workoutStats(w).vol,0);
    weeks.push({date:start,label:start.getDate()+'/'+(start.getMonth()+1),vol});
  }
  const max=Math.max(1,...weeks.map(w=>w.vol));
  return '<div class="weekly-trend"><div class="section-caption">Tonnage · 6 semaines</div><div class="trend-bars">'
    +weeks.map((w,i)=>'<div class="trend-column" role="img" aria-label="'+esc('Semaine du '+w.label+' : '+fmtKg(w.vol)+' kg')+'" title="'+esc(fmtKg(w.vol)+' kg')+'"><div class="trend-track"><i class="'+(i===5?'current':'')+'" style="height:'+Math.max(w.vol?3:0,w.vol/max*100)+'%"></i></div><span>'+w.label+'</span></div>').join('')
    +'</div></div>';
}
function homeHTML(){
  const now=new Date(),weekW=DB.workouts.filter(w=>w.date>=isoOf(weekStart(now)));
  const weekVol=weekW.reduce((sum,w)=>sum+workoutStats(w).vol,0);
  const weekSets=weekW.reduce((sum,w)=>sum+workoutStats(w).sets,0);
  const reco=recommendSeance(),ap=activeProgram();
  const next=DB.active?SEANCE[DB.active.seance]:(reco?SEANCE[reco.id]:PROGRAM[0]);
  let h='<header class="dash-top"><div class="dash-brand"><h1>Dko<span>.</span></h1><span class="brand-caption">Journal d’entraînement</span></div>'
    +'<div class="hbtns">'+toolButton('data','database','Données et sauvegardes')+toolButton('settings','settings-2','Réglages')+'</div></header>';
  h+='<button class="cloud-status text-link" data-act="cloud" id="cloudStatus">Sauvegarde locale</button><div class="home-date">'+esc(now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}))+'</div><div class="home-layout">';
  if(next){
    const sm=sessionMuscles(next),val=m=>sm.p.has(m)?1:(sm.s.has(m)?.45:0);
    const side=DASH_SIDE.sid===next.id?DASH_SIDE.side:dominantSide(next);
    const muscles=[...sm.p].slice(0,3);
    const sets=next.ex.reduce((sum,e)=>sum+(Number(e.sets)||0),0);
    const active=!!DB.active;
    h+='<section class="session-stage" aria-labelledby="todayTitle">'
      +'<div class="stage-heading"><span class="eyebrow">'+(active?(DB.active.ps?'Séance en pause':'Séance en cours'):'Prochaine séance')+'</span><span class="stage-tag">'+esc(next.tab)+'</span></div>'
      +'<h2 id="todayTitle">'+esc(next.title)+'</h2>'
      +'<div class="stage-scene"><div class="stage-muscles">'+muscles.map(m=>'<div class="muscle-callout"><span></span><b>'+esc(mLabel(m))+'</b></div>').join('')+'</div>'
      +'<div class="stage-anatomy" role="img" aria-label="Muscles ciblés, vue '+(side==='front'?'de face':'de dos')+'">'+silhouette(side,val)+'</div>'
      +'<div class="stage-numbers"><div><b class="num">'+next.ex.length+'</b><span>exercices</span></div><div><b class="num">'+sets+'</b><span>séries prévues</span></div></div></div>'
      +'<div class="stage-foot"><span class="stage-readiness"><i></i>Récup. estimée <b>'+seanceRecoveryScore(next)+' %</b></span>'
      +'<div class="body-side" role="group" aria-label="Vue anatomique">'+['front','back'].map(v=>'<button data-act="bodyside" data-s="'+esc(next.id)+'" data-side="'+v+'" aria-pressed="'+(side===v)+'">'+(v==='front'?'Face':'Dos')+'</button>').join('')+'</div></div>'
      +'<button class="bigbtn stage-start" data-act="'+(active?'open':'quickstart')+'" data-s="'+esc(next.id)+'">'+uiIcon('play')+'<span>'+(active?'Reprendre la séance':'Commencer')+'</span>'
      +(active?'<span id="elapsed" class="num">'+elapsedStr()+'</span>':uiIcon('arrow-right'))+'</button></section>';
  }else{
    h+='<section class="session-stage"><div class="eyebrow">Ton entraînement</div><h2>À toi de jouer.</h2><button class="bigbtn" data-act="programs">Créer une séance '+uiIcon('arrow-right')+'</button></section>';
  }
  h+='<section class="week-panel" aria-labelledby="weekTitle"><div class="section-heading"><h2 id="weekTitle">Ta semaine</h2><button class="text-link" data-act="weeklystats">Tout le suivi '+uiIcon('arrow-up-right')+'</button></div>'
    +'<div class="weekly-lead"><b class="num">'+String(weekW.length).padStart(2,'0')+'</b><span>séance'+(weekW.length>1?'s':'')+'<br>réalisée'+(weekW.length>1?'s':'')+'</span></div>'
    +weekStripHTML(now)
    +'<div class="weekly-metrics"><div><b class="num">'+weekSets+'</b><span>séries validées</span></div><div><b class="num">'+fmtKg(weekVol)+'</b><span>kg soulevés</span></div></div>'
    +weeklyTrendHTML(now)+'</section></div>';
  h+='<section class="program-section"><div class="section-heading"><div><div class="eyebrow">Ton programme</div><h2>'+esc(ap?ap.name:'Mes séances')+'</h2></div><button class="text-link" data-act="programs">Gérer '+uiIcon('arrow-up-right')+'</button></div><div class="session-library">';
  PROGRAM.forEach((s,i)=>{
    const last=lastWorkoutOf(s.id),isReco=next&&next.id===s.id,sm=sessionMuscles(s);
    h+='<button class="session-tile'+(isReco?' recommended':'')+'" data-act="open" data-s="'+esc(s.id)+'">'
      +'<span class="session-index num">'+String(i+1).padStart(2,'0')+'</span><span class="session-tile-body"><span class="session-tile-meta">'+esc(s.tab)+' · '+s.ex.length+' exercices'+(isReco?' <b>À suivre</b>':'')+'</span>'
      +'<strong>'+esc(s.title)+'</strong><span class="session-last">'+(last?daysAgo(last.date):'Pas encore réalisée')+'</span></span>'
      +'<span class="session-tile-figure" aria-hidden="true">'+silhouette(dominantSide(s),m=>sm.p.has(m)?1:(sm.s.has(m)?.45:0))+'</span>'+uiIcon('chevron-right')+'</button>';
  });
  if(!PROGRAM.length)h+='<div class="empty">Aucune séance dans ce programme.</div>';
  h+='</div></section>';
  let age=null;try{const last=localStorage.getItem('dako_lastbackup');age=last?diffDays(last):null}catch(e){}
  if(DB.workouts.length&&(age===null||age>=7))h+='<button class="backupbanner" data-act="backup">'+uiIcon('database')+'<span class="bb-t"><b>Sauvegarde conseillée</b><small>'+(age===null?'Aucun fichier exporté':'Dernier export il y a '+age+' j')+'</small></span><span class="bb-x">Exporter</span></button>';
  return h;
}

/* ---------- séance ---------- */
function focusControlsHTML(exercises){
  if(!exercises.some(e=>e.id===FOCUS_EX))FOCUS_EX=(exercises.find(e=>(DB.active.ex[e.id]||[]).some(st=>!st.done))||exercises[0])?.id;
  const index=exercises.findIndex(e=>e.id===FOCUS_EX);
  return '<div class="workout-browser"><div class="workout-browser-head"><span>Exercice <b>'+String(index+1).padStart(2,'0')+'</b> / '+String(exercises.length).padStart(2,'0')+'</span>'
    +'<div class="workout-modes" role="group" aria-label="Affichage des exercices"><button data-act="workoutmode" data-mode="focus" aria-pressed="'+(WORKOUT_MODE==='focus')+'" aria-label="Un exercice à la fois" data-tooltip="Un exercice à la fois">'+uiIcon('dumbbell')+'</button><button data-act="workoutmode" data-mode="list" aria-pressed="'+(WORKOUT_MODE==='list')+'" aria-label="Liste complète" data-tooltip="Liste complète">'+uiIcon('layout-list')+'</button></div></div>'
    +'<div class="exercise-rail" aria-label="Exercices de la séance">'+exercises.map((e,i)=>'<button data-act="exfocus" data-ex="'+esc(e.id)+'" aria-label="Exercice '+(i+1)+' : '+esc(e.name)+'" aria-pressed="'+(e.id===FOCUS_EX)+'"><span class="num">'+String(i+1).padStart(2,'0')+'</span>'+uiIcon('check')+'</button>').join('')+'</div></div>';
}
function syncExerciseFocus(){
  if(route.view!=='seance'||DB.active?.seance!==route.seance)return;
  app.querySelectorAll('.card[data-ex]').forEach(card=>{
    card.hidden=WORKOUT_MODE==='focus'&&card.dataset.ex!==FOCUS_EX;
    const next=(DB.active.ex[card.dataset.ex]||[]).findIndex(st=>!st.done);
    card.querySelectorAll('.strow').forEach(row=>row.classList.toggle('next-set',+row.dataset.i===next));
  });
  app.querySelectorAll('.exercise-rail [data-act="exfocus"]').forEach(button=>{
    const sets=DB.active.ex[button.dataset.ex]||[],done=!!sets.length&&sets.every(st=>st.done);
    button.classList.toggle('exercise-done',done);
    button.setAttribute('aria-label',button.getAttribute('aria-label').replace(/ · terminé$/,'')+(done?' · terminé':''));
  });
}
function focusFooterHTML(exercises){
  const index=exercises.findIndex(e=>e.id===FOCUS_EX),previous=exercises[index-1],next=exercises[index+1];
  return '<div class="focus-footer"'+(WORKOUT_MODE==='list'?' hidden':'')+'><button class="focus-prev" data-act="exfocus" data-ex="'+esc(previous?.id||'')+'" aria-label="Exercice précédent"'+(previous?'':' disabled')+'>'+uiIcon('chevron-left')+'</button>'
    +'<button class="focus-next" data-act="'+(next?'exfocus':'finish')+'"'+(next?' data-ex="'+esc(next.id)+'"':'')+'><span><small>'+(next?'Exercice suivant':'Fin de séance')+'</small><strong>'+esc(next?.name||'Terminer la séance')+'</strong></span>'+uiIcon('arrow-right')+'</button></div>';
}
function seanceHTML(sid){
  const s=SEANCE[sid];
  if(!s)return homeHTML();
  const active=DB.active&&DB.active.seance===sid?DB.active:null;
  const exercises=activeExerciseList(s,active);
  let h='<button class="back" data-act="home">'+uiIcon('chevron-left')+'<span>Séances</span></button>'
   +'<div class="shead"><div><div class="stag">'+esc(s.tab)+'</div><h2>'+esc(s.title)+'</h2>'
   +'<div class="smeta">'+exercises.length+' exercices · repos '+fmtT(s.rest??SETTINGS.rest)
   +' · <span class="num">récup. '+seanceRecoveryScore(s)+' %</span></div></div>'
   +(active?'':'<button class="editbtn" data-act="edit">Modifier</button>')+'</div>';
  if(active){
    const p=sessionProgress(active);
    const paused=!!active.ps;
    h+='<div class="livebar"><div><div class="lt'+(paused?' paused':'')+'">'+(paused?'EN PAUSE':p.total&&p.done===p.total?'SÉRIES TERMINÉES':'SÉANCE EN COURS')+'</div>'
     +'<div class="num" id="elapsed">'+elapsedStr()+'</div></div>'
     +'<div class="lbtns"><button class="pausebtn" data-act="pause" aria-label="'+(paused?'Reprendre la séance':'Mettre en pause')+'" data-tooltip="'+(paused?'Reprendre':'Pause')+'">'+uiIcon(paused?'play':'pause')+'</button>'
     +'<button class="finish" data-act="finish">Terminer</button></div></div>'
     +'<div class="pmeta"><span>Progression</span><span class="num" id="pdone">'+p.done+' / '+p.total+' séries</span></div>'
     +'<div class="pbar"><i id="pfill" style="width:'+(p.total?Math.round(100*p.done/p.total):0)+'%"></i></div>';
  }else{
    h+='<button class="bigbtn" data-act="start">Démarrer la séance</button>';
  }
  if(active)h+=focusControlsHTML(exercises);
  exercises.forEach((e,i)=>{h+=exCardHTML(e,i,active)});
  if(active)h+=focusFooterHTML(exercises);
  if(s.warn)h+='<div class="pwarn">'+esc(s.warn)+'</div>';
  if(active)h+='<div class="session-end">'+(WORKOUT_MODE==='list'?'<button class="bigbtn" data-act="finish">Terminer la séance</button>':'')
    +'<button class="text-link" data-act="cancel">Abandonner la séance</button></div>';
  return h;
}

function exCardHTML(e,idx,active){
  let ref;
  if(e.refText)ref='<span class="refval txt">'+esc(e.refText)+'</span>';
  else if(e.ref==null)ref='<span class="refval txt">'+esc(e.unit||'—')+'</span>';
  else ref='<span class="refval num">'+fmtN(e.ref)+'</span><span class="refunit">'+esc(e.unit||'kg')+'</span>';
  const complete=active&&active.ex[e.id]&&active.ex[e.id].length&&active.ex[e.id].every(s=>s.done);
  let h='<div class="card'+(complete?' complete':'')+'" data-ex="'+esc(e.id)+'">'
   +'<div class="chead"><span class="cnum num">'+(idx+1)+'</span><span class="cname">'+esc(e.name)+'</span>'
   +(e.ceiling?'<span class="badge">'+esc(e.ceiling)+'</span>':'')
   +'<span class="cdone">FAIT</span></div>'
   +'<div class="cmeta">'+ref+'<span class="target num">'+e.sets+' × '+esc(e.reps)+'</span>'
   +(active?'<button class="rest-setting text-link" data-act="restset" data-ex="'+esc(e.id)+'" aria-label="Régler le repos pour cet exercice">'+uiIcon('clock-3')+'<span>Repos '+fmtT(restForExercise(e))+'</span></button>':'')+'</div>';
  if(!active)h+=lastSessionLine(e.id);
  if(active){
    const sets=active.ex[e.id]||[];
    const targets=suggestTargets(e);
    const previous=previousExercise(e);
    h+=workoutCoachHTML(e,sets);
    if(previous)h+='<div class="comparison-date">Dernière séance · '+esc(fmtDateShort(previous.date))+'</div>';
    h+='<div class="stable"><div class="sthead"><span>SÉR.</span><span>KG</span><span>REPS</span><span>✓</span></div>';
    sets.forEach((st,i)=>{h+=setRowHTML(e,i,st,targets,previous)});
    h+='</div><div class="setbtns" style="display:flex;gap:8px"><button class="addset" data-act="delset" style="flex:1">− série</button><button class="addset" data-act="addset" style="flex:1">+ série</button></div>';
    h+=workoutNoteField(active,e.id,false)+previousNoteHTML(e.id);
  }
  if(active)h+='<button class="replace-exercise" data-act="replaceex" data-ex="'+esc(e.id)+'">Remplacer pour cette séance '+uiIcon('arrow-right')+'</button>';
  h+='<button class="howbtn" data-act="exinfo" data-ex="'+esc(e.id)+'">Technique et muscles ciblés ›</button>';
  h+='<details class="dprog"><summary>Progression</summary><div class="hist">'+progHTML(e)+'</div></details></div>';
  return h;
}
function setRowHTML(e,i,st,targets,previous=previousExercise(e)){
  const t=targets&&targets[i]?targets[i]:null;
  const phW=t&&t.w!=null?fmtN(t.w):'kg';
  const phR=t&&t.r!=null?fmtN(t.r):'reps';
  return '<div class="strow'+(st.done?' done':'')+'" data-i="'+i+'">'
   +'<span class="sn num">'+(i+1)+'</span>'
   +'<div class="stp"><button class="stpb" data-act="stepw" data-d="-1" tabindex="-1" aria-label="moins">−</button>'
   +'<input class="w num" type="text" inputmode="decimal" aria-label="'+esc(e.name)+' · série '+(i+1)+' · charge en kg" placeholder="'+esc(phW)+'" value="'+(st.w==null?'':fmtN(st.w))+'">'
   +'<button class="stpb" data-act="stepw" data-d="1" tabindex="-1" aria-label="plus">+</button></div>'
   +'<div class="stp"><button class="stpb" data-act="stepr" data-d="-1" tabindex="-1" aria-label="moins">−</button>'
   +'<input class="r num" type="text" inputmode="decimal" aria-label="'+esc(e.name)+' · série '+(i+1)+' · répétitions" placeholder="'+esc(phR)+'" value="'+(st.r==null?'':fmtN(st.r))+'">'
   +'<button class="stpb" data-act="stepr" data-d="1" tabindex="-1" aria-label="plus">+</button></div>'
   +'<button class="chk" data-act="chk" aria-label="valider la série"><svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg></button>'
   +(previous?'<span class="previous-set">'+(previous.sets[i]?'Dernière : <b>'+esc((previous.sets[i].w==null?'—':fmtN(previous.sets[i].w)+' '+(e.unit||'kg'))+' × '+(previous.sets[i].r==null?'—':fmtN(previous.sets[i].r)))+'</b>':'Pas de série précédente')+'</span>':'')
   +'</div>';
}
function progHTML(e){
  const h=exHistory(e.id);
  if(!h.length)return '<div class="hempty">Aucune donnée. Les séries validées apparaîtront ici.</div>';
  const maxes=h.map(en=>maxW(en.sets)).filter(v=>v!=null).slice(-12);
  let out='';
  if(maxes.length>=2){
    const W=260,H=38,P=4,mn=Math.min(...maxes),mx=Math.max(...maxes),span=(mx-mn)||1;
    const pts=maxes.map((v,i)=>(P+i*(W-2*P)/(maxes.length-1)).toFixed(1)+','+(H-P-(v-mn)*(H-2*P)/span).toFixed(1));
    const last=pts[pts.length-1].split(',');
    out+='<div class="sparkcap">Charge max · '+fmtN(mn)+' → '+fmtN(mx)+' kg</div>'
     +'<svg class="spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none"><polyline points="'+pts.join(' ')+'"/>'
     +'<circle cx="'+last[0]+'" cy="'+last[1]+'" r="2.5"/></svg>';
  }
  const best=bestEver(e.id);
  if(best!=null)out+='<div class="sparkcap">Record : '+fmtN(best)+' kg</div>';
  for(const en of h.slice(-8).reverse()){
    out+='<div class="hrow"><span class="hdate num">'+(en.date===todayISO()?'Aujourd’hui':fmtDateShort(en.date))+'</span>'
     +'<span class="hsets num">'+en.sets.map(s=>(s.w!=null?fmtN(s.w):'—')+'×'+(s.r!=null?fmtN(s.r):'—')).join(' · ')+'</span></div>';
    out+=workoutNoteHTML(en.note);
  }
  return out;
}

function workoutMusclesHTML(w){
  /* puces des muscles principaux réellement travaillés dans la séance */
  const p=new Set();
  for(const exId in (w.ex||{})){const e=workoutExercise(w,exId);if(e)(e.musP||[]).forEach(m=>p.add(m));}
  if(!p.size)return '';
  return '<div class="hmus">'+[...p].slice(0,5).map(m=>'<span class="hmchip">'+esc((MUSCLE_BY_ID[m]||{}).label||m)+'</span>').join('')+'</div>';
}

/* ---------- historique ---------- */
function suiviHTML(){
  let h='<div class="top"><h1>Suivi</h1><div class="hbtns"><button class="hbtn" data-act="data">Données</button></div></div>'
   +(SUIVI==='stats'?'':suiviSummaryHTML())
   +'<div class="seg suiviseg">'
   +'<button class="segb'+(SUIVI==='stats'?'':' on')+'" data-act="suivitab" data-t="history">Historique</button>'
   +'<button class="segb'+(SUIVI==='stats'?' on':'')+'" data-act="suivitab" data-t="stats">Stats</button></div>';
  return h+(SUIVI==='stats'?statsHTML(true):historyHTML(true));
}
function historyHTML(embed){
  let h=embed?'':'<div class="top"><h1>Historique</h1><div class="hbtns"><button class="hbtn" data-act="data">Données</button></div></div>';
  const arr=DB.workouts.slice().reverse();
  if(!arr.length)return h+'<div class="empty">Aucune séance terminée.<br>Démarre une séance dans l’onglet Entraîner.</div>';
  const tot=arr.length;
  h+='<div class="subdate">'+tot+' séance'+(tot>1?'s':'')+' enregistrée'+(tot>1?'s':'')+'</div>';
  DB.workouts.slice().map((w,i)=>({w,i})).reverse().forEach(({w,i})=>{
    const s=w.session||SEANCE[w.seance];const st=workoutStats(w);const musHTML=workoutMusclesHTML(w);
    let det='';
    for(const exId of workoutExerciseIds(w)){
      const sets=(w.ex[exId]||[]).filter(x=>x.done&&(x.w!=null||x.r!=null));
      const note=workoutNote(w,exId);
      if(!sets.length&&!note)continue;
      det+='<div class="hxrow"><span class="hxname">'+esc(workoutExercise(w,exId)?.name||exId)+'</span>'
       +'<span class="hxsets num">'+sets.map(x=>(x.w!=null?fmtN(x.w):'—')+'×'+(x.r!=null?fmtN(x.r):'—')).join(' · ')+'</span></div>';
      det+=workoutNoteHTML(note);
    }
    det+='<div class="sbtns" style="margin-top:12px"><button class="sbtn" data-act="wedit" data-w="'+i+'">Modifier</button>'
      +'<button class="sbtn danger" data-act="wdel" data-w="'+i+'">Supprimer</button></div>';
    h+='<div class="hcard"><details><summary><div style="width:100%">'
     +'<div class="htop"><span class="htag">'+esc(s?s.tab:'')+'</span><span class="hwdate">'+fmtDateShort(w.date)+'</span></div>'
     +'<div class="hname">'+esc(s?s.title:w.seance)+'</div>'
     +musHTML
     +'<div class="hstats">'
     +(w.dur?'<div class="hstat"><div class="v num">'+fmtDur(w.dur)+'</div><div class="l">Durée</div></div>':'')
     +'<div class="hstat"><div class="v num">'+fmtKg(st.vol)+' kg</div><div class="l">Tonnage</div></div>'
     +'<div class="hstat"><div class="v num">'+st.sets+'</div><div class="l">Séries</div></div>'
     +'</div></div></summary><div class="hdetail">'+det+'</div></details></div>';
  });
  return h;
}
function showEditWorkout(i){
  const w=DB.workouts[i];if(!w)return;
  let body='';
  for(const exId of workoutExerciseIds(w)){
    body+='<div class="rectitle">'+esc(workoutExercise(w,exId)?.name||exId)+'</div>';
    (w.ex[exId]||[]).forEach((st,j)=>{
      body+='<div class="wrow" data-ex="'+esc(exId)+'">'
        +'<span class="sn num">'+(j+1)+'</span>'
        +'<input class="we num" data-k="w" inputmode="decimal" placeholder="kg" value="'+(st.w==null?'':fmtN(st.w))+'">'
        +'<input class="we num" data-k="r" inputmode="decimal" placeholder="reps" value="'+(st.r==null?'':fmtN(st.r))+'">'
        +'<button class="ebtn wsetdel">✕</button></div>';
    });
    body+=workoutNoteField(w,exId,true);
  }
  sheet.innerHTML='<h2>Modifier la séance</h2><div class="sp">'+fmtDateShort(w.date)+' · '+esc((w.session||SEANCE[w.seance]||{}).tab||'')+' — corrige ou supprime des séries.</div>'
   +body+'<div class="sbtns"><button class="sbtn pri" id="wsave">Enregistrer</button></div>';
  openSheet();
  sheet.querySelectorAll('.wsetdel').forEach(b=>b.addEventListener('click',()=>{b.closest('.wrow').remove()}));
  document.getElementById('wsave').addEventListener('click',()=>{
    const invalid=[...sheet.querySelectorAll('.we')].find(input=>{
      if(!input.value.trim())return false;
      const n=numOrNull(input.value);
      return n==null||(input.dataset.k==='r'?n<=0:n<0)||n>100000;
    });
    if(invalid){toast('Vérifie les charges et les répétitions');invalid.focus();return;}
    const ex={};
    sheet.querySelectorAll('.wrow').forEach(row=>{
      const exId=row.dataset.ex;
      const wv=numOrNull(row.querySelector('[data-k="w"]').value);
      const rv=numOrNull(row.querySelector('[data-k="r"]').value);
      if(wv==null&&rv==null)return;
      (ex[exId]=ex[exId]||[]).push({w:wv,r:rv,done:true});
    });
    w.exNotes=cleanWorkoutNotes(Object.fromEntries([...sheet.querySelectorAll('.we-note')].map(input=>[input.dataset.ex,input.value])));
    w.ex=ex;persist();closeSheet();render();toast('Séance modifiée');
  });
}

/* ---------- carte corporelle ---------- */
/* Mappe les muscles Dko sur les tracés de la carte musculaire (slugs
   body-highlighter, cf. bodymap.js), par côté. Muscle non listé = reste gris. */
const SLUG_FRONT={pecs:['chest'],abdos:['abs'],delt_ant:['deltoids'],delt_lat:['deltoids'],
 biceps:['biceps'],triceps:['triceps'],avant_bras:['forearm'],quadriceps:['quadriceps'],
 adducteurs:['adductors'],mollets:['calves','tibialis']};
const SLUG_BACK={dos:['upper-back','trapezius'],lombaires:['lower-back'],delt_post:['deltoids'],
 delt_lat:['deltoids'],triceps:['triceps'],avant_bras:['forearm'],fessiers:['gluteal'],
 ischios:['hamstring'],mollets:['calves'],adducteurs:['adductors']};
function slugValues(side,valFn){
  const map=side==='back'?SLUG_BACK:SLUG_FRONT,out={};
  for(const id in map){
    const v=Math.max(0,Math.min(1,valFn(id)||0));
    if(v<=0)continue;
    for(const sl of map[id])out[sl]=Math.max(out[sl]||0,v);
  }
  return out;
}
function silhouette(side,valFn){
  const back=side==='back';
  const fem=(typeof SETTINGS!=='undefined'&&SETTINGS&&SETTINGS.theme==='rose'&&typeof BODY_FRONT_F!=='undefined');
  let data,vb,outline;
  if(fem){
    data=(back?BODY_BACK_F:BODY_FRONT_F)||[];
    vb=back?BODY_VB_BACK_F:BODY_VB_FRONT_F;
    outline=back?BODY_OUTLINE_BACK_F:BODY_OUTLINE_FRONT_F;
  }else{
    data=(back?(typeof BODY_BACK!=='undefined'&&BODY_BACK):(typeof BODY_FRONT!=='undefined'&&BODY_FRONT))||[];
    vb=back?(typeof BODY_VB_BACK!=='undefined'?BODY_VB_BACK:'724 0 724 1448'):(typeof BODY_VB_FRONT!=='undefined'?BODY_VB_FRONT:'0 0 724 1448');
    outline=back?(typeof BODY_OUTLINE_BACK!=='undefined'&&BODY_OUTLINE_BACK):(typeof BODY_OUTLINE_FRONT!=='undefined'&&BODY_OUTLINE_FRONT);
  }
  const sv=slugValues(side,valFn);
  let s='<svg class="silh" viewBox="'+vb+'" preserveAspectRatio="xMidYMid meet">';
  for(const m of data){
    const p=[].concat((m.path&&m.path.common)||[],(m.path&&m.path.left)||[],(m.path&&m.path.right)||[]);
    const v=sv[m.slug]||0;
    const cls=v>0?'bzone':'bbody';
    const op=v>0?' fill-opacity="'+(0.5+0.5*v).toFixed(2)+'"':'';
    for(const d of p)s+='<path class="'+cls+'" d="'+d+'"'+op+'/>';
  }
  if(outline)s+='<path class="boutline" d="'+outline+'"/>';
  return s+'</svg>';
}
/* Côté affiché : dos si la séance est à dominante dos / postérieure, sinon face. */
const BACK_MUS={dos:1,delt_post:1,triceps:1,fessiers:1,ischios:1,lombaires:1};
function dominantSide(s){
  let b=0,f=0;
  for(const e of ((s&&s.ex)||[]))for(const m of (e.musP||[])){if(BACK_MUS[m])b++;else f++;}
  return b>f?'back':'front';
}
function exMuscleMapHTML(musP,musS){
  const val=mid=>(musP||[]).includes(mid)?1:((musS||[]).includes(mid)?0.45:0);
  return '<div class="bodymaps exmap">'
   +'<div class="bmap">'+silhouette('front',val)+'<div class="bcap">Face</div></div>'
   +'<div class="bmap">'+silhouette('back',val)+'<div class="bcap">Dos</div></div></div>';
}
function bodyMapHTML(){
  const front=silhouette('front',muscleFatigue);
  const back=silhouette('back',muscleFatigue);
  let bars='';
  const list=MUSCLES.map(m=>({m,rec:muscleRecovery(m.id)})).sort((a,b)=>a.rec-b.rec);
  for(const x of list){
    bars+='<div class="musrow"><span class="musl">'+esc(x.m.label)+'</span>'
     +'<div class="musbar"><i style="width:'+x.rec+'%"></i></div>'
     +'<span class="musv num">'+x.rec+' %</span></div>';
  }
  return '<div class="chartcard"><div class="charttitle">Récupération musculaire estimée</div>'
   +'<div class="bodymaps">'
   +'<div class="bmap">'+front+'<div class="bcap">Face</div></div>'
   +'<div class="bmap">'+back+'<div class="bcap">Dos</div></div>'
   +'</div>'
   +'<div class="maplegend">Estimation selon tes séries et le temps écoulé. Ton ressenti reste prioritaire.</div>'
   +bars+'</div>';
}
/* ---------- démonstrations animées (SVG/SMIL) ---------- */
function exPattern(e){
  const catalog=CATALOG_BY_NAME.get(searchKey(e?.name));if(catalog)return catalog.pattern;
  const n=String(e&&e.name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  /* du plus spécifique au plus générique — l'ordre compte */
  if(/cardio|tapis|velo|rameur|elliptique|skillmill|stair|climb|course/.test(n))return 'cardio';
  if(/abdo|crunch|oblique|rotary|gainage|chaise romaine|releve de jambe|sit.?up/.test(n))return 'abs';
  if(/mollet|calf|sural/.test(n))return 'calf';
  if(/leg extension|leg-extension|extension de jambe/.test(n))return 'legext';
  if(/leg curl|leg-curl|ischio|curl assis|curl allonge|curl jambe/.test(n))return 'legcurl';
  if(/fente|bulgare|lunge|split squat/.test(n))return 'lunge';
  if(/hip thrust|fessier|glute/.test(n))return 'hipthrust';
  if(/soulev|roumain|good morning|deadlift/.test(n))return 'hinge';
  if(/hack|squat/.test(n))return 'squat';
  if(/presse|leg press/.test(n))return 'legpress';
  if(/abducteur/.test(n))return 'abductor';
  if(/adducteur/.test(n))return 'adductor';
  if(/shrug|haussement|trapeze/.test(n))return 'shrug';
  if(/elevation laterale|laterale/.test(n))return 'lateral';
  if(/face pull|rear delt|oiseau|reverse|arriere/.test(n))return 'reardelt';
  if(/militaire|overhead press|shoulder|developpe epaules|press epaules|elevation frontale/.test(n))return 'shoulderpress';
  if(/curl/.test(n))return 'curl';
  if(/pushdown|dips|extension triceps|triceps|skull|barre au front/.test(n))return 'triceps';
  if(/pull-over|pull over|pullover|pulover/.test(n))return 'pullover';
  if(/tirage vertical|pulldown|traction|lat pull/.test(n))return 'pulldown';
  if(/pec fly|pec deck|ecarte|fly|crossover|cable croise|butterfly/.test(n))return 'fly';
  if(/row|tirage|rowing|t-bar/.test(n))return 'rowhoriz';
  if(/incline/.test(n))return 'inclinepress';
  if(/couche|bench/.test(n))return 'benchpress';
  if(/developpe|chest|press|pompe/.test(n))return 'chestpress';
  return 'chestpress';
}
const REDUCED=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches);
const DEMO_ALIAS={rowhoriz:'row',chestpress:'press',benchpress:'press',inclinepress:'press'};
function demoSVG(p){
  p=DEMO_ALIAS[p]||p;
  const an=(v,d)=>REDUCED?'':'<animateTransform attributeName="transform" attributeType="XML" type="rotate" values="'+v+'" keyTimes="0;0.5;1" dur="'+(d||2.2)+'s" calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" repeatCount="indefinite"/>';
  const tr=(v,d)=>REDUCED?'':'<animateTransform attributeName="transform" attributeType="XML" type="translate" values="'+v+'" keyTimes="0;0.5;1" dur="'+(d||2.2)+'s" calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" repeatCount="indefinite"/>';
  const av=(attr,v,d)=>REDUCED?'':'<animate attributeName="'+attr+'" values="'+v+'" keyTimes="0;0.5;1" dur="'+(d||2.2)+'s" calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" repeatCount="indefinite"/>';
  const floor='<line class="d-floor" x1="18" y1="162" x2="142" y2="162"/>';
  const legsF='<line class="d-bone" x1="80" y1="104" x2="70" y2="156"/><line class="d-bone" x1="80" y1="104" x2="90" y2="156"/>';
  const legsS='<line class="d-bone" x1="72" y1="102" x2="64" y2="156"/><line class="d-bone" x1="72" y1="102" x2="80" y2="156"/>';
  let g='';
  switch(p){
    case 'curl':
      g='<circle class="d-head" cx="72" cy="32" r="11"/><line class="d-bone" x1="72" y1="43" x2="72" y2="102"/>'+legsS
       +'<line class="d-bone" x1="74" y1="52" x2="74" y2="88"/><circle class="d-joint" cx="74" cy="88" r="3.5"/>'
       +'<g><line class="d-move" x1="74" y1="88" x2="74" y2="120"/><circle class="d-wt" cx="74" cy="122" r="8"/>'+an('0 74 88;-138 74 88;0 74 88',2.2)+'</g>';
      break;
    case 'triceps':
      g='<circle class="d-head" cx="72" cy="32" r="11"/><line class="d-bone" x1="72" y1="43" x2="72" y2="102"/>'+legsS
       +'<line class="d-bone" x1="74" y1="52" x2="74" y2="86"/><circle class="d-joint" cx="74" cy="86" r="3.5"/>'
       +'<g><line class="d-move" x1="74" y1="86" x2="74" y2="120"/><line class="d-gear" x1="64" y1="122" x2="84" y2="122"/>'+an('-80 74 86;0 74 86;-80 74 86',1.9)+'</g>';
      break;
    case 'lateral':
      g='<circle class="d-head" cx="80" cy="30" r="11"/><line class="d-bone" x1="80" y1="41" x2="80" y2="104"/>'+legsF
       +'<circle class="d-joint" cx="67" cy="52" r="3.5"/><circle class="d-joint" cx="93" cy="52" r="3.5"/>'
       +'<g><line class="d-move" x1="67" y1="52" x2="67" y2="98"/><circle class="d-wt" cx="67" cy="100" r="7"/>'+an('0 67 52;88 67 52;0 67 52',2.4)+'</g>'
       +'<g><line class="d-move" x1="93" y1="52" x2="93" y2="98"/><circle class="d-wt" cx="93" cy="100" r="7"/>'+an('0 93 52;-88 93 52;0 93 52',2.4)+'</g>';
      break;
    case 'press': /* développé couché — profil : corps allongé, barre verticale au-dessus de la poitrine */
      g='<rect class="d-bench" x="40" y="118" width="88" height="7" rx="2"/>'
       +'<line class="d-bench" x1="52" y1="125" x2="52" y2="160" stroke-width="4"/><line class="d-bench" x1="116" y1="125" x2="116" y2="160" stroke-width="4"/>'
       +'<circle class="d-head" cx="44" cy="108" r="10"/><line class="d-bone" x1="56" y1="110" x2="104" y2="110"/>'
       +'<line class="d-bone" x1="104" y1="110" x2="118" y2="138"/><line class="d-bone" x1="118" y1="138" x2="118" y2="160"/>'
       +'<line class="d-move" x1="62" y1="110" x2="62" y2="58">'+av('y2','58;100;58',2.2)+'</line>'
       +'<circle class="d-wt" cx="62" cy="58" r="8">'+av('cy','58;100;58',2.2)+'</circle>';
      break;
    case 'pulldown': /* tirage vertical — profil : assis, barre descend de la poulie haute vers la poitrine */
      g='<line class="d-cable" x1="70" y1="4" x2="70" y2="18">'+av('y2','18;58;18',2.3)+'</line>'
       +'<rect class="d-bench" x="48" y="120" width="46" height="7" rx="2"/><line class="d-bench" x1="70" y1="127" x2="70" y2="160" stroke-width="4"/>'
       +'<circle class="d-head" cx="70" cy="30" r="10"/><line class="d-bone" x1="70" y1="40" x2="70" y2="108"/>'
       +'<line class="d-bone" x1="70" y1="108" x2="106" y2="108"/><line class="d-bone" x1="106" y1="108" x2="106" y2="150"/>'
       +'<line class="d-move" x1="70" y1="52" x2="70" y2="18">'+av('y2','18;58;18',2.3)+'</line>'
       +'<line class="d-move" x1="56" y1="18" x2="84" y2="18" stroke-width="6">'+av('y1','18;58;18',2.3)+av('y2','18;58;18',2.3)+'</line>';
      break;
    case 'row': /* tirage horizontal — profil : assis, poignée tirée vers le torse */
      g='<rect class="d-bench" x="28" y="120" width="42" height="7" rx="2"/><line class="d-bench" x1="50" y1="127" x2="50" y2="160" stroke-width="4"/>'
       +'<circle class="d-head" cx="52" cy="32" r="10"/><line class="d-bone" x1="52" y1="42" x2="52" y2="110"/>'
       +'<line class="d-bone" x1="52" y1="110" x2="88" y2="110"/><line class="d-bone" x1="88" y1="110" x2="88" y2="150"/>'
       +'<line class="d-cable" x1="116" y1="64" x2="150" y2="64">'+av('x1','116;72;116',2)+'</line>'
       +'<line class="d-move" x1="52" y1="54" x2="116" y2="64">'+av('x2','116;72;116',2)+'</line>'
       +'<circle class="d-wt" cx="116" cy="64" r="6">'+av('cx','116;72;116',2)+'</circle>';
      break;
    case 'legext':
      g='<rect class="d-bench" x="54" y="92" width="50" height="8" rx="3"/>'
       +'<circle class="d-head" cx="70" cy="34" r="11"/><line class="d-bone" x1="70" y1="45" x2="70" y2="92"/>'
       +'<line class="d-bone" x1="70" y1="92" x2="104" y2="92"/><circle class="d-joint" cx="104" cy="92" r="3.5"/>'
       +'<line class="d-bone" x1="70" y1="100" x2="70" y2="150"/>'
       +'<g><line class="d-move" x1="104" y1="92" x2="104" y2="128"/><circle class="d-wt" cx="104" cy="130" r="6"/>'+an('0 104 92;-78 104 92;0 104 92',2.3)+'</g>';
      break;
    case 'legcurl':
      g='<rect class="d-bench" x="54" y="92" width="50" height="8" rx="3"/>'
       +'<circle class="d-head" cx="70" cy="34" r="11"/><line class="d-bone" x1="70" y1="45" x2="70" y2="92"/>'
       +'<line class="d-bone" x1="70" y1="92" x2="104" y2="92"/><circle class="d-joint" cx="104" cy="92" r="3.5"/>'
       +'<line class="d-bone" x1="70" y1="100" x2="70" y2="150"/>'
       +'<g><line class="d-move" x1="104" y1="92" x2="104" y2="128"/><circle class="d-wt" cx="104" cy="130" r="6"/>'+an('-78 104 92;0 104 92;-78 104 92',2.3)+'</g>';
      break;
    case 'calf':
      g='<g>'+tr('0 0;0 -13;0 0',1.7)+'<circle class="d-head" cx="74" cy="30" r="11"/><line class="d-bone" x1="74" y1="41" x2="74" y2="100"/>'
       +'<line class="d-move" x1="74" y1="100" x2="66" y2="150"/><line class="d-move" x1="74" y1="100" x2="82" y2="150"/></g>'
       +'<rect class="d-bench" x="56" y="150" width="44" height="10" rx="3"/>';
      break;
    case 'shoulderpress':
      g='<circle class="d-head" cx="80" cy="28" r="11"/><line class="d-bone" x1="80" y1="39" x2="80" y2="104"/>'+legsF
       +'<g>'+tr('0 34;0 0;0 34',2.1)+'<line class="d-move" x1="62" y1="30" x2="62" y2="70"/><line class="d-move" x1="98" y1="30" x2="98" y2="70"/><line class="d-gear" x1="54" y1="30" x2="106" y2="30"/></g>';
      break;
    case 'fly':
      g='<rect class="d-bench" x="38" y="118" width="88" height="7" rx="2"/>'
       +'<circle class="d-head" cx="44" cy="108" r="10"/><line class="d-bone" x1="56" y1="110" x2="104" y2="110"/>'
       +'<circle class="d-joint" cx="72" cy="98" r="3.5"/><circle class="d-joint" cx="96" cy="98" r="3.5"/>'
       +'<g><line class="d-move" x1="72" y1="98" x2="42" y2="74"/><circle class="d-wt" cx="40" cy="72" r="6"/>'+an('0 72 98;52 72 98;0 72 98',2.4)+'</g>'
       +'<g><line class="d-move" x1="96" y1="98" x2="126" y2="74"/><circle class="d-wt" cx="128" cy="72" r="6"/>'+an('0 96 98;-52 96 98;0 96 98',2.4)+'</g>';
      break;
    case 'reardelt':
      g='<circle class="d-head" cx="72" cy="38" r="10"/><g>'+an('0 74 90;-18 74 90;0 74 90',2.2)+'<line class="d-bone" x1="72" y1="48" x2="74" y2="104"/>'+legsS+'</g>'
       +'<circle class="d-joint" cx="74" cy="62" r="3.5"/>'
       +'<g><line class="d-move" x1="74" y1="62" x2="116" y2="82"/><circle class="d-wt" cx="118" cy="83" r="6"/>'+an('-18 74 62;28 74 62;-18 74 62',2.2)+'</g>';
      break;
    case 'pullover':
      g='<rect class="d-bench" x="38" y="118" width="88" height="7" rx="2"/>'
       +'<circle class="d-head" cx="44" cy="108" r="10"/><line class="d-bone" x1="56" y1="110" x2="104" y2="110"/>'
       +'<g><line class="d-move" x1="74" y1="100" x2="70" y2="46"/><circle class="d-wt" cx="70" cy="42" r="8"/>'+an('-58 74 100;8 74 100;-58 74 100',2.5)+'</g>';
      break;
    case 'squat':
      g='<g>'+tr('0 0;0 18;0 0',2.3)+'<circle class="d-head" cx="80" cy="28" r="11"/><line class="d-bone" x1="80" y1="39" x2="80" y2="96"/>'
       +'<line class="d-move" x1="80" y1="96" x2="58" y2="150"/><line class="d-move" x1="80" y1="96" x2="104" y2="150"/>'
       +'<line class="d-gear" x1="54" y1="54" x2="106" y2="54"/></g>';
      break;
    case 'legpress':
      g='<rect class="d-bench" x="32" y="112" width="58" height="9" rx="3"/><line class="d-bench" x1="48" y1="120" x2="48" y2="160" stroke-width="4"/>'
       +'<circle class="d-head" cx="48" cy="96" r="10"/><line class="d-bone" x1="58" y1="100" x2="86" y2="116"/>'
       +'<g>'+tr('0 0;24 -18;0 0',2.4)+'<rect class="d-pad" x="104" y="54" width="16" height="66" rx="4"/><line class="d-move" x1="86" y1="116" x2="108" y2="94"/><line class="d-move" x1="86" y1="116" x2="108" y2="78"/></g>';
      break;
    case 'hipthrust':
      g='<rect class="d-bench" x="28" y="92" width="40" height="9" rx="3"/><circle class="d-head" cx="42" cy="82" r="9"/>'
       +'<g>'+tr('0 14;0 -4;0 14',2.2)+'<line class="d-bone" x1="52" y1="92" x2="104" y2="110"/><circle class="d-joint" cx="104" cy="110" r="3.5"/><line class="d-move" x1="104" y1="110" x2="132" y2="150"/><line class="d-move" x1="104" y1="110" x2="82" y2="150"/></g>'
       +'<line class="d-gear" x1="82" y1="104" x2="122" y2="104"/>';
      break;
    case 'hinge':
      g='<circle class="d-head" cx="78" cy="34" r="10"/><g>'+an('0 76 96;34 76 96;0 76 96',2.4)+'<line class="d-bone" x1="76" y1="44" x2="76" y2="96"/><line class="d-move" x1="76" y1="60" x2="58" y2="118"/><line class="d-move" x1="76" y1="60" x2="94" y2="118"/></g>'
       +'<line class="d-bone" x1="76" y1="96" x2="64" y2="156"/><line class="d-bone" x1="76" y1="96" x2="90" y2="156"/>';
      break;
    case 'lunge':
      g='<g>'+tr('0 0;0 13;0 0',2.2)+'<circle class="d-head" cx="76" cy="30" r="10"/><line class="d-bone" x1="76" y1="40" x2="76" y2="96"/>'
       +'<line class="d-move" x1="76" y1="96" x2="48" y2="150"/><line class="d-move" x1="76" y1="96" x2="116" y2="150"/><line class="d-bone" x1="48" y1="150" x2="32" y2="150"/><line class="d-bone" x1="116" y1="150" x2="136" y2="150"/></g>';
      break;
    case 'abductor':
      g='<rect class="d-bench" x="52" y="100" width="56" height="8" rx="3"/><circle class="d-head" cx="80" cy="36" r="11"/><line class="d-bone" x1="80" y1="47" x2="80" y2="100"/>'
       +'<g><line class="d-move" x1="80" y1="106" x2="58" y2="150"/>'+an('0 80 106;-24 80 106;0 80 106',2.1)+'</g>'
       +'<g><line class="d-move" x1="80" y1="106" x2="102" y2="150"/>'+an('0 80 106;24 80 106;0 80 106',2.1)+'</g>';
      break;
    case 'adductor':
      g='<rect class="d-bench" x="52" y="100" width="56" height="8" rx="3"/><circle class="d-head" cx="80" cy="36" r="11"/><line class="d-bone" x1="80" y1="47" x2="80" y2="100"/>'
       +'<g><line class="d-move" x1="80" y1="106" x2="50" y2="150"/>'+an('-24 80 106;0 80 106;-24 80 106',2.1)+'</g>'
       +'<g><line class="d-move" x1="80" y1="106" x2="110" y2="150"/>'+an('24 80 106;0 80 106;24 80 106',2.1)+'</g>';
      break;
    case 'abs':
      g='<line class="d-bone" x1="34" y1="148" x2="128" y2="148"/><circle class="d-head" cx="48" cy="126" r="10"/>'
       +'<g>'+an('0 84 142;-24 84 142;0 84 142',2.1)+'<line class="d-move" x1="56" y1="132" x2="104" y2="142"/><line class="d-bone" x1="104" y1="142" x2="132" y2="122"/></g>';
      break;
    case 'shrug':
      g='<circle class="d-head" cx="80" cy="30" r="11"/><line class="d-bone" x1="80" y1="41" x2="80" y2="104"/>'+legsF
       +'<g>'+tr('0 0;0 -12;0 0',1.8)+'<line class="d-move" x1="58" y1="78" x2="58" y2="118"/><circle class="d-wt" cx="58" cy="122" r="7"/><line class="d-move" x1="102" y1="78" x2="102" y2="118"/><circle class="d-wt" cx="102" cy="122" r="7"/></g>';
      break;
    case 'cardio':
      g='<rect class="d-bench" x="36" y="142" width="88" height="9" rx="4"/><line class="d-cable" x1="110" y1="142" x2="130" y2="96"/>'
       +'<circle class="d-head" cx="76" cy="42" r="10"/><line class="d-bone" x1="76" y1="52" x2="76" y2="104"/>'
       +'<g>'+an('-12 76 104;16 76 104;-12 76 104',1.5)+'<line class="d-move" x1="76" y1="104" x2="58" y2="142"/><line class="d-move" x1="76" y1="104" x2="96" y2="142"/></g>';
      break;
    default:
      g='<circle class="d-head" cx="80" cy="32" r="11"/><line class="d-bone" x1="80" y1="43" x2="80" y2="104"/>'+legsF;
  }
  return '<svg class="exdemo-svg" viewBox="0 0 160 172">'+floor+g+'</svg>';
}
const PATTERN_LABEL={
 frontraise:'Élévation frontale',forearm:'Poignets',stepup:'Montée sur support',kickback:'Extension de hanche',core:'Contrôle du tronc',backext:'Extension lombaire',
 cardio:'Cardio maîtrisé',chestpress:'Poussée poitrine',benchpress:'Développé couché',inclinepress:'Développé incliné',shoulderpress:'Poussée épaules',
 fly:'Ouverture contrôlée',pullover:'Pull-over',pulldown:'Tirage vertical',rowhoriz:'Tirage horizontal',reardelt:'Arrière épaules',
 lateral:'Élévation latérale',shrug:'Trapèzes',curl:'Curl biceps',triceps:'Extension triceps',
 legpress:'Presse à cuisses',squat:'Squat',hipthrust:'Hip thrust',hinge:'Charnière hanche',lunge:'Fente',
 legext:'Extension jambes',legcurl:'Curl ischios',adductor:'Adducteurs',abductor:'Abducteurs',calf:'Mollets',abs:'Gainage abdos'
};
const COACH_LABELS=['Position','Trajectoire','Respiration','À éviter'];
const COACH_GUIDE={
 cardio:['Monte progressivement en intensité, buste grand et regard loin.','Garde un rythme régulier avant de chercher la vitesse.','Respire en continu, sans bloquer la cage.','Ne pars pas trop fort si tu veux tenir la zone ciblée.'],
 chestpress:['Poignées à hauteur de poitrine, omoplates posées, pieds stables.','Pousse en diagonale légère, coudes vers 45°, retour contrôlé.','Souffle en poussant, inspire sur la descente.','Évite de verrouiller brutalement ou de décoller les épaules.'],
 benchpress:['Omoplates serrées, pieds ancrés, poignets alignés au-dessus des coudes.','Descends vers le bas des pectoraux, pousse sans rebond.','Grosse inspiration avant la descente, souffle après le passage dur.','Ne casse pas les poignets et ne rebondis pas sur la poitrine.'],
 inclinepress:['Banc autour de 30°, poitrine haute, bas du dos neutre.','Descends vers le haut des pectoraux, coudes sous les poignets.','Inspire en bas, souffle sur la poussée.','Évite de transformer le mouvement en développé épaules.'],
 shoulderpress:['Bassin gainé, côtes rentrées, poignées au niveau des oreilles.','Pousse au-dessus de la tête puis redescends sans perdre le contrôle.','Souffle en montant, inspire en revenant.','Ne cambre pas pour finir la répétition.'],
 fly:['Coudes légèrement fléchis et angle constant tout du long.','Ouvre jusqu’à sentir les pectoraux, referme sans claquer les poignées.','Inspire à l’ouverture, souffle en resserrant.','Ne plie pas les bras comme sur un développé.'],
 pullover:['Buste stable, cage ouverte, bras presque tendus.','Va chercher l’étirement puis ramène avec les dorsaux.','Inspire en arrière, souffle en revenant au-dessus du torse.','Évite de tirer uniquement avec les triceps.'],
 pulldown:['Poitrine haute, épaules basses, prise solide.','Tire les coudes vers les hanches puis laisse remonter en grand.','Souffle en tirant, inspire sur l’étirement.','Ne tire pas derrière la nuque et ne balance pas le buste.'],
 rowhoriz:['Buste fixe, poitrine ouverte, épaules basses.','Tire les coudes en arrière et serre les omoplates une seconde.','Souffle en tirant, inspire en tendant les bras.','Ne compense pas avec un balancier du dos.'],
 reardelt:['Nuque longue, épaules basses, charge légère.','Ouvre vers l’arrière en pensant aux coudes, pas aux mains.','Souffle à l’ouverture, inspire au retour.','Ne hausse pas les trapèzes à chaque rep.'],
 lateral:['Charge légère, épaules basses, coudes souples.','Monte par les coudes jusqu’à l’horizontale, retour lent.','Souffle en montant, inspire en descendant.','Ne donne pas d’élan avec le bas du dos.'],
 shrug:['Bras longs, nuque neutre, charge tenue près du corps.','Monte les épaules droit vers les oreilles, pause courte en haut.','Souffle en haut, inspire en bas.','Ne roule pas les épaules en cercle.'],
 curl:['Coudes fixes, buste droit, poignets solides.','Monte sans avancer les coudes, retiens la descente.','Souffle en montant, inspire en descendant.','Ne balance pas le buste pour finir la série.'],
 triceps:['Coudes verrouillés près du corps ou au-dessus selon la variante.','Étends complètement puis reviens sans perdre la tension.','Souffle sur l’extension, inspire au retour.','Ne laisse pas les coudes partir dans tous les sens.'],
 legpress:['Pieds largeur épaules, genoux dans l’axe des pointes.','Descends profond sans décoller le bassin, pousse par le milieu du pied.','Inspire en descente, souffle en poussant.','Ne verrouille pas les genoux en haut.'],
 squat:['Pieds ancrés, cage tenue, regard devant.','Descends genoux dans l’axe, remonte en poussant le sol.','Inspire et gaine avant de descendre, souffle en remontant.','Ne laisse pas les talons ou les genoux partir.'],
 hipthrust:['Omoplates sur le banc, menton rentré, pieds sous les genoux.','Monte le bassin jusqu’à l’alignement et serre les fessiers.','Souffle en haut, inspire en redescendant.','Ne cambre pas le bas du dos pour gagner de la hauteur.'],
 hinge:['Hanches vers l’arrière, dos plat, genoux souples.','Descends jusqu’à l’étirement des ischios, remonte par les fessiers.','Inspire en descendant, souffle en remontant.','Ne transforme pas le mouvement en squat.'],
 lunge:['Grand pas, buste haut, poids surtout dans le pied avant.','Descends verticalement puis pousse dans le talon avant.','Inspire en bas, souffle en remontant.','Ne laisse pas le genou avant rentrer vers l’intérieur.'],
 legext:['Dos contre le dossier, genoux alignés avec l’axe de la machine.','Tends fort en haut, pause courte, descente lente.','Souffle en tendant, inspire au retour.','Ne lance pas la charge avec un à-coup.'],
 legcurl:['Genoux alignés avec l’axe, bassin plaqué au support.','Ramène les talons vers toi, contrôle tout le retour.','Souffle en fermant, inspire en ouvrant.','Ne laisse pas les hanches se soulever.'],
 adductor:['Dos posé, amplitude confortable, bassin stable.','Resserre les cuisses avec contrôle, pause courte au centre.','Souffle en fermant, inspire en ouvrant.','Ne claque pas les coussins en fin de course.'],
 abductor:['Dos posé, pieds stables, genoux contre les coussins.','Écarte en contractant les fessiers, reviens lentement.','Souffle à l’ouverture, inspire au retour.','Ne cherche pas une amplitude qui fait basculer le bassin.'],
 calf:['Avant-pied stable, amplitude complète, genoux solides.','Descends en étirement puis monte haut sur la pointe.','Souffle en haut, inspire en bas.','Ne rebondis pas en bas du mouvement.'],
 abs:['Nuque longue, bassin contrôlé, mouvement court et propre.','Enroule la colonne ou maintiens le gainage selon la variante.','Souffle fort sur la contraction.','Ne tire pas sur la nuque et ne creuse pas le bas du dos.']
};
const LOAD_SETUP={
 broche:'Choisis la broche avant de t’installer, puis teste une rep légère.',
 disques:'Charge les deux côtés de façon symétrique et verrouille les disques.',
 libre:'Prépare la zone, garde la charge proche et sécurise tes appuis.',
 poulie:'Règle la hauteur de poulie et garde le câble dans l’axe du mouvement.',
 corps:'Règle l’assistance ou le lest avant la série de travail.',
 cardio:'Règle vitesse, inclinaison ou résistance avant de monter en intensité.'
};
function patternLabel(p){return PATTERN_LABEL[p]||'Mouvement guidé';}
function guideForPattern(p){return COACH_GUIDE[p]||COACH_GUIDE.chestpress;}
function coachCardsHTML(lines){
  let h='<div class="coachgrid">';
  for(let i=0;i<COACH_LABELS.length;i++){
    h+='<div class="coachcard"><div class="coachk">'+esc(COACH_LABELS[i])+'</div><div class="coachv">'+esc(lines[i]||lines[0]||'Mouvement contrôlé, amplitude propre.')+'</div></div>';
  }
  return h+'</div>';
}
function exerciseGuideHTML(p,steps,specific=false){
  if(specific)return '<div class="rectitle">Conseils d’exécution</div><ol class="steps compact">'+steps.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol>';
  const notes=steps.length?('<div class="rectitle softtitle">Notes du programme</div><ol class="steps compact">'+steps.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol>'):'';
  return '<div class="rectitle">Comment réaliser</div>'+coachCardsHTML(guideForPattern(p))+notes;
}
function machineVisualHTML(m,p,load){
  const mus=(m.p||[]).concat(m.s||[]).map(mLabel).slice(0,3).join(' · ');
  return '<div class="machineviz"><div class="machineviz-info"><div class="machineviz-k">Mouvement</div><div class="machineviz-v">'+esc(patternLabel(p))+'</div>'
   +'<div class="machineviz-sub">'+esc(LOAD_SHORT[load])+(mus?' · '+esc(mus):'')+'</div></div></div>';
}
function machineCoachHTML(p,load){
  const g=guideForPattern(p);
  return '<div class="rectitle">Mode d’emploi rapide</div><p class="sp">'+esc(LOAD_SETUP[load]||'Règle la machine avant la série de travail.')+'</p>'+coachCardsHTML(g);
}

/* fiche exercice : démo animée + visuel muscles + comment réaliser */
function showExercise(exId){
  const e=activeExercise(exId);if(!e)return;
  const musP=e.musP||[],musS=e.musS||[];
  const p=exPattern(e);
  const steps=String(e.notes||'').split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ0-9])/).map(t=>t.trim()).filter(t=>t.length>1);
  let chips='';
  musP.forEach(m=>{chips+='<span class="mchip pri">'+esc((MUSCLE_BY_ID[m]||{}).label||m)+'</span>'});
  musS.forEach(m=>{chips+='<span class="mchip">'+esc((MUSCLE_BY_ID[m]||{}).label||m)+'</span>'});
  let ref;
  if(e.refText)ref=esc(e.refText);
  else if(e.ref==null)ref=esc(e.unit||'—');
  else ref=fmtN(e.ref)+' '+esc(e.unit||'kg');
  sheet.innerHTML='<h2>'+esc(e.name)+'</h2>'
   +'<div class="sp">'+esc(patternLabel(p))+(e.ceiling?' · <span class="badge">'+esc(e.ceiling)+'</span>':'')+'</div>'
   +exPhotoHTML(e.name)
   +'<div class="sbtns" style="margin-bottom:16px"><a class="sbtn pri" href="'+ytURL(e)+'" target="_blank" rel="noopener">Voir la démonstration vidéo ›</a></div>'
   +exMuscleMapHTML(musP,musS)
   +(chips?'<div class="mchips">'+chips+'</div>':'')
   +'<div class="sumgrid"><div class="sumbox"><div class="v num">'+ref+'</div><div class="l">Charge réf.</div></div>'
   +'<div class="sumbox"><div class="v num">'+e.sets+' × '+esc(e.reps)+'</div><div class="l">Objectif</div></div></div>'
   +exerciseGuideHTML(p,steps,CATALOG_BY_NAME.has(searchKey(e.name)));
  openSheet();bindExPhoto();
}

/* ---------- bilan forme ---------- */
function fmtDelta(cur,ref,unit){
  if(ref==null||cur==null)return '';
  const d=Math.round((cur-ref)*10)/10;
  if(d===0)return '±0';
  return (d>0?'+':'')+fmtN(d)+(unit?' '+unit:'');
}
function bodyChartSVG(series){
  const pts=series.slice(-16);
  if(pts.length<2)return '';
  const W=300,H=92,P=10,Pb=14;
  const vs=pts.map(p=>p.v),mn=Math.min(...vs),mx=Math.max(...vs),span=(mx-mn)||1;
  const x=i=>P+i*(W-2*P)/(pts.length-1);
  const y=v=>P+(1-(v-mn)/span)*(H-P-Pb);
  const line=pts.map((p,i)=>x(i).toFixed(1)+','+y(p.v).toFixed(1));
  const area='M'+x(0).toFixed(1)+','+(H-Pb)+' L '+line.join(' L ')+' L'+x(pts.length-1).toFixed(1)+','+(H-Pb)+' Z';
  const last=pts[pts.length-1];
  return '<div class="bchartwrap"><span class="bcmax num">'+fmtN(mx)+'</span><span class="bcmin num">'+fmtN(mn)+'</span>'
   +'<svg class="bchart" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'
   +'<path class="bfill" d="'+area+'"/>'
   +'<polyline class="bline" points="'+line.join(' ')+'"/>'
   +'<circle class="bdot" cx="'+x(pts.length-1).toFixed(1)+'" cy="'+y(last.v).toFixed(1)+'" r="3.2"/>'
   +'</svg></div>';
}
function bilanHTML(){
  let h='<div class="reccard"><div class="bilanhead"><div class="charttitle">Bilan forme</div>'
   +'<button class="addbilan" data-act="bilan">+ Nouveau bilan</button></div>';
  if(!BODY.length){
    return h+'<div class="hempty">Aucune mesure. Ajoute ton poids et tes mensurations pour suivre ta progression dans le temps.</div></div>';
  }
  const pw=lastVal('poids'),prevw=prevVal('poids'),firstw=firstVal('poids');
  if(pw!=null){
    const mu=MEASURE_BY_ID.poids.unit;
    const parts=[];
    if(prevw!=null)parts.push('dernier '+fmtDelta(pw,prevw,mu));
    if(firstw!=null&&firstw!==pw)parts.push('total '+fmtDelta(pw,firstw,mu));
    h+='<div class="bilanmain"><div class="bilanbig num">'+fmtN(pw)+'<span class="bilanunit"> '+mu+'</span></div>'
     +'<div class="bilansub">'+(parts.join(' · ')||'première mesure')+'</div></div>'
     +bodyChartSVG(bodySeries('poids'));
  }
  let boxes='';
  MEASURES.forEach(m=>{
    if(m.id==='poids')return;
    const v=lastVal(m.id);if(v==null)return;
    const pv=prevVal(m.id);
    boxes+='<div class="bbox"><div class="bbox-l">'+esc(m.label)+'</div>'
     +'<div class="bbox-v num">'+fmtN(v)+'<span class="bbox-u"> '+m.unit+'</span></div>'
     +(pv!=null?'<div class="bbox-d num">'+fmtDelta(v,pv,m.unit)+'</div>':'')+'</div>';
  });
  if(boxes)h+='<div class="bilangrid">'+boxes+'</div>';
  return h+'</div>';
}
function showBodyEntry(){
  const fields=MEASURES.map(m=>{
    const v=lastVal(m.id);
    return '<div class="efield"><label>'+esc(m.label)+' ('+m.unit+')</label>'
     +'<input class="bm" data-id="'+m.id+'" inputmode="decimal" placeholder="'+(v!=null?fmtN(v):'—')+'"></div>';
  }).join('');
  sheet.innerHTML='<h2>Nouveau bilan</h2>'
   +'<div class="sp">Renseigne au moins une valeur. Les champs vides ne sont pas modifiés. Le repère gris indique ta dernière mesure.</div>'
   +'<div class="efield"><label>Date</label><input id="bdate" type="date" value="'+todayISO()+'"></div>'
   +'<div class="egrid">'+fields+'</div>'
   +'<div class="sbtns"><button class="sbtn pri" id="bsave">Enregistrer</button></div>';
  openSheet();
  document.getElementById('bsave').addEventListener('click',()=>{
    const date=document.getElementById('bdate').value||todayISO();
    const vals={};
    document.querySelectorAll('#sheet .bm').forEach(inp=>{const v=numOrNull(inp.value);if(v!=null)vals[inp.dataset.id]=v;});
    if(!Object.keys(vals).length){toast('Renseigne au moins une valeur');return;}
    addBody({date,vals});closeSheet();render();toast('Bilan enregistré');
  });
}

/* ---------- calculateurs (1RM + plaques) ---------- */
function plateBreakdown(total,bar){
  const plates=[25,20,15,10,5,2.5,1.25];
  let perSide=(total-bar)/2;
  if(perSide<0)return null;
  const out=[];
  for(const p of plates){let c=0;while(perSide>=p-1e-6){perSide-=p;c++}if(c)out.push(c+'×'+fmtN(p));}
  return{list:out,rest:Math.round(perSide*100)/100};
}
function showCalculators(){
  sheet.innerHTML='<h2>Calculateurs</h2>'
   +'<div class="rectitle">1RM estimé (Epley)</div>'
   +'<div class="egrid"><div class="efield"><label>Charge (kg)</label><input id="c1w" inputmode="decimal" value="100"></div>'
   +'<div class="efield"><label>Répétitions</label><input id="c1r" inputmode="decimal" value="5"></div></div>'
   +'<div id="c1out" class="calcout"></div>'
   +'<div class="rectitle" style="margin-top:14px">Calcul des plaques</div>'
   +'<div class="egrid"><div class="efield"><label>Charge totale (kg)</label><input id="cpw" inputmode="decimal" value="100"></div>'
   +'<div class="efield"><label>Barre (kg)</label><input id="cpb" inputmode="decimal" value="20"></div></div>'
   +'<div id="cpout" class="calcout"></div>'
   +'<div class="sbtns"><button class="sbtn pri" id="calcClose">Fermer</button></div>';
  openSheet();
  const calc1=()=>{
    const w=numOrNull(document.getElementById('c1w').value),r=numOrNull(document.getElementById('c1r').value);
    const o=document.getElementById('c1out');
    if(w==null||r==null||r<=0){o.innerHTML='—';return}
    const orm=w*(1+r/30);
    const pct=[100,95,90,85,80,75,70].map(p=>'<div class="pctrow"><span>'+p+' %</span><span class="num">'+fmtN(Math.round(orm*p/100*2)/2)+' kg</span></div>').join('');
    o.innerHTML='<div class="calcbig num">'+fmtN(Math.round(orm*2)/2)+' kg</div><div class="calcsub">1RM estimé · '+fmtN(w)+' kg × '+r+'</div><div class="pcttable">'+pct+'</div>';
  };
  const calcP=()=>{
    const t=numOrNull(document.getElementById('cpw').value),b=numOrNull(document.getElementById('cpb').value);
    const o=document.getElementById('cpout');
    if(t==null||b==null){o.innerHTML='—';return}
    const r=plateBreakdown(t,b);
    if(!r){o.innerHTML='<div class="calcsub">Charge inférieure à la barre.</div>';return}
    o.innerHTML='<div class="calcsub">Par côté :</div><div class="platelist">'+(r.list.length?r.list.map(x=>'<span class="plate">'+x+'</span>').join(''):'<span class="calcsub">barre seule</span>')+'</div>'+(r.rest?'<div class="calcsub">reste non chargeable : '+fmtN(r.rest)+' kg</div>':'');
  };
  ['c1w','c1r'].forEach(id=>document.getElementById(id).addEventListener('input',calc1));
  ['cpw','cpb'].forEach(id=>document.getElementById(id).addEventListener('input',calcP));
  calc1();calcP();
  document.getElementById('calcClose').addEventListener('click',closeSheet);
}

/* ---------- sauvegarde fichier (anti-perte) ---------- */
function downloadBackup(){
  try{
    const txt=JSON.stringify(exportPayload(),null,1);
    const blob=new Blob([txt],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download='dako-sauvegarde-'+todayISO()+'.json';
    document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},1500);
    try{localStorage.setItem('dako_lastbackup',todayISO())}catch(e){}
    mirrorSoon();
    toast('Sauvegarde téléchargée');
  }catch(e){toast('Échec de la sauvegarde')}
}
function backupReminder(){
  let last=null;try{last=localStorage.getItem('dako_lastbackup')}catch(e){}
  if(!DB.workouts.length)return;
  const days=last?diffDays(last):999;
  if(days>=7)setTimeout(()=>toast('Pense à sauvegarder tes données (Réglages › Sauvegarde)'),1800);
}
function backupState(){
  let last=null;try{last=localStorage.getItem('dako_lastbackup')}catch(e){}
  const days=last?diffDays(last):null;
  if(days==null)return{tone:'warn',label:'Aucune sauvegarde fichier',detail:'Télécharge un export JSON dès que possible.'};
  if(days>=7)return{tone:'warn',label:'Sauvegarde à refaire',detail:'Dernier export il y a '+days+' j.'};
  return{tone:'ok',label:'Sauvegarde récente',detail:days===0?'Export fait aujourd’hui.':'Dernier export il y a '+days+' j.'};
}
function storageSizeKB(){
  let n=0;
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i),v=localStorage.getItem(k)||'';n+=((k||'').length+v.length)*2}}catch(e){}
  return Math.max(1,Math.round(n/1024));
}
function totalsOfWorkouts(list){
  let vol=0,sets=0;
  list.forEach(w=>{const st=workoutStats(w);vol+=st.vol;sets+=st.sets});
  return{vol,sets,sessions:list.length};
}
function periodStartIso(isMonth,shift){
  const now=new Date(),d=isMonth?new Date(now.getFullYear(),now.getMonth()+shift,1):weekStart(now);
  if(!isMonth)d.setDate(d.getDate()+shift*7);
  return isoOf(d);
}
function periodEndIso(isMonth,shift){
  const now=new Date(),d=isMonth?new Date(now.getFullYear(),now.getMonth()+shift+1,1):weekStart(now);
  if(!isMonth)d.setDate(d.getDate()+(shift+1)*7);
  return isoOf(d);
}
function workoutsInRange(a,b){return DB.workouts.filter(w=>w.date>=a&&w.date<b)}
function signed(n){return (n>0?'+':'')+n}
function signedKg(n){return (n>0?'+':'')+fmtKg(Math.round(n))+' kg'}
function muscleGroupScores(mvol){
  return STAT_MUSCLE_GROUPS.map(g=>{let v=0;g[1].forEach(m=>v+=mvol[m]||0);return{label:g[0],v:Math.round(v)}}).sort((a,b)=>b.v-a.v);
}
function bestRecentProgress(){
  const out=[],seen={};
  for(const s of PROGRAM)for(const e of s.ex){
    if(seen[e.id])continue;seen[e.id]=1;
    const h=exHistory(e.id).map(en=>({date:en.date,m:maxW(en.sets)})).filter(x=>x.m!=null);
    if(h.length<2)continue;
    const last=h[h.length-1];
    if(diffDays(last.date)>21)continue;
    let prev=null;for(let i=0;i<h.length-1;i++)if(prev==null||h[i].m>prev)prev=h[i].m;
    if(prev!=null&&last.m>prev)out.push({tab:s.tab,name:e.name,w:last.m,delta:last.m-prev,date:last.date});
  }
  out.sort((a,b)=>b.delta-a.delta);
  return out[0]||null;
}
function dataHealthHTML(snap){
  const bs=backupState();
  const mirror=snap&&snap.t?{tone:'ok',label:'Miroir IndexedDB actif',detail:'Instantané local : '+fmtDateShort(isoOf(new Date(snap.t)))}:{tone:'warn',label:'Miroir à vérifier',detail:'Force une synchronisation si tu viens d’importer.'};
  return '<div class="datahealth">'
   +'<div class="healthrow '+bs.tone+'"><span><b>'+esc(bs.label)+'</b><small>'+esc(bs.detail)+'</small></span><i></i></div>'
   +'<div class="healthrow '+mirror.tone+'"><span><b>'+esc(mirror.label)+'</b><small>'+esc(mirror.detail)+'</small></span><i></i></div>'
   +'<div class="healthrow ok"><span><b>'+DB.workouts.length+' séance'+(DB.workouts.length>1?'s':'')+' suivie'+(DB.workouts.length>1?'s':'')+'</b><small>'+PROGRAMS.length+' programme'+(PROGRAMS.length>1?'s':'')+' · '+storageSizeKB()+' Ko local</small></span><i></i></div>'
   +'</div><div class="sbtns dataactions"><button class="sbtn pri" id="fileBackup">Télécharger une sauvegarde</button><button class="sbtn" id="forceMirror">Synchroniser miroir</button></div>';
}
function renderDataHealth(snap){
  const el=document.getElementById('dataHealth');if(!el)return;
  el.innerHTML=dataHealthHTML(snap);
  const fb=document.getElementById('fileBackup');if(fb)fb.addEventListener('click',downloadBackup);
  const fm=document.getElementById('forceMirror');if(fm)fm.addEventListener('click',()=>{mirrorSnapshot();toast('Miroir local synchronisé');setTimeout(refreshDataHealth,500)});
}
function refreshDataHealth(){const el=document.getElementById('dataHealth');if(!el)return;idbGet('snapshot').then(renderDataHealth)}
function suiviSummaryHTML(){
  const now=new Date(),weekIso=isoOf(weekStart(now));
  const week=DB.workouts.filter(w=>w.date>=weekIso),wt=totalsOfWorkouts(week);
  const last=DB.workouts.length?DB.workouts[DB.workouts.length-1]:null;
  const bs=backupState();
  const title=last?'Dernière séance '+fmtDateShort(last.date):'Pas encore de séance validée';
  const sub=last?(SEANCE[last.seance]?SEANCE[last.seance].tab+' · '+SEANCE[last.seance].title:last.seance):'Démarre une séance pour alimenter ton suivi.';
  return '<div class="suivihero"><div class="suivi-k">Tableau de bord</div><div class="suivi-title">'+esc(title)+'</div><div class="suivi-sub">'+esc(sub)+'</div>'
   +'<div class="suivigrid"><div><b class="num">'+wt.sessions+'</b><span>Séances cette sem.</span></div><div><b class="num">'+wt.sets+'</b><span>Séries cette sem.</span></div><div><b class="num">'+fmtKg(wt.vol)+'</b><span>Kg cette sem.</span></div></div>'
   +'<div class="suivi-safe '+bs.tone+'"><span>'+esc(bs.label)+'</span><small>'+esc(bs.detail)+'</small></div></div>';
}
function statsInsightHTML(isMonth,winW,winVol,prevW,prevVol,grp,rng){
  const unit=isMonth?'mois':'semaine';
  const sessDelta=winW.length-prevW.length,volDelta=winVol-prevVol;
  const low=grp.filter(g=>g.v>0&&g.v<rng.low),miss=grp.filter(g=>g.v===0);
  const focus=low[0]||miss[0]||grp[0];
  const pr=bestRecentProgress();
  const volTxt=prevVol?signedKg(volDelta)+' vs période précédente':(winVol?'Première période chargée':'Aucune donnée cette période');
  const focusTxt=focus?(focus.v>=rng.low?'Volume solide sur '+focus.label+'.':'À remonter : '+focus.label+' ('+focus.v+'/'+rng.low+' séries).'):'Valide des séries pour voir les priorités.';
  const prTxt=pr?esc(pr.tab+' · '+pr.name)+' · +'+fmtN(pr.delta)+' kg':'Aucun nouveau record récent détecté.';
  return '<div class="coachpulse"><div class="pulsehead"><span>Résumé coach</span><b>'+esc(unit)+'</b></div><div class="pulsegrid">'
   +'<div class="pulsecard"><div class="pulsek">Rythme</div><div class="pulsev num">'+signed(sessDelta)+'</div><div class="pulses">séance'+(Math.abs(sessDelta)>1?'s':'')+' vs période précédente</div></div>'
   +'<div class="pulsecard"><div class="pulsek">Tonnage</div><div class="pulsev">'+esc(volTxt)+'</div><div class="pulses">sur les séries avec kg + reps</div></div>'
   +'<div class="pulsecard"><div class="pulsek">Priorité</div><div class="pulsev">'+esc(focusTxt)+'</div><div class="pulses">équilibre volume / muscle</div></div>'
   +'<div class="pulsecard"><div class="pulsek">Progression</div><div class="pulsev">'+prTxt+'</div><div class="pulses">record récent</div></div>'
   +'</div></div>';
}

/* ---------- volume par muscle + progression par exercice ---------- */
const STAT_MUSCLE_GROUPS=[['Dos',['dos']],['Pectoraux',['pecs']],['Épaules',['delt_ant','delt_lat','delt_post']],['Biceps',['biceps']],['Triceps',['triceps']],['Quadriceps',['quadriceps']],['Ischios',['ischios']],['Fessiers',['fessiers']],['Mollets',['mollets']]];
function volumeByMuscle(sinceIso){
  /* séries par muscle sur la fenêtre : 1 série = 1 pt muscle principal, 0,5 pt secondaire */
  const vol={};
  for(const w of DB.workouts){
    if(w.date<sinceIso)continue;
    for(const exId in (w.ex||{})){
      const e=workoutExercise(w,exId);if(!e)continue;
      const sets=w.ex[exId].filter(s=>s.done).length;
      if(!sets)continue;
      (e.musP||[]).forEach(m=>{vol[m]=(vol[m]||0)+sets});
      (e.musS||[]).forEach(m=>{vol[m]=(vol[m]||0)+sets*0.5});
    }
  }
  return vol;
}
function exProgressCard(){
  const list=[],archive=historicalExercises();
  for(const exId in archive){const hh=exHistory(exId);if(hh.length)list.push({id:exId,n:hh.length});}
  if(!list.length)return '<div class="chartcard"><div class="charttitle">Progression par exercice</div><div class="hempty">Valide des séries pour voir tes courbes de charge.</div></div>';
  list.sort((a,b)=>b.n-a.n);
  if(!STATEX||!list.some(x=>x.id===STATEX))STATEX=list[0].id;
  const e=archive[STATEX],best=bestEver(STATEX);
  let h='<div class="chartcard"><div class="charttitle">Progression par exercice</div>'
   +'<div class="exprow"><button class="exchip" data-act="expick"><span>'+esc(e.name)+'</span>'
   +'<svg class="exchev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>'
   +(best!=null?'<span class="exrec">RECORD '+fmtN(best)+' KG</span>':'')+'</div>';
  const hh=exHistory(STATEX);
  const maxes=hh.map(en=>maxW(en.sets)).filter(v=>v!=null);
  if(maxes.length>=2){
    const W=290,Hh=104,P=10,top=16,bot=92,mn=Math.min(...maxes),mx=Math.max(...maxes),span=(mx-mn)||1;
    const X=i=>P+i*(W-2*P)/(maxes.length-1);
    const Y=v=>top+(1-(v-mn)/span)*(bot-top);
    const pts=maxes.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1));
    const last=pts[pts.length-1].split(',');
    h+='<svg class="excurve" viewBox="0 0 '+W+' '+Hh+'" preserveAspectRatio="xMidYMid meet">'
     +'<path class="exfill" d="M'+X(0).toFixed(1)+','+bot+' L'+pts.join(' L')+' L'+X(maxes.length-1).toFixed(1)+','+bot+' Z"/>'
     +'<polyline class="exline" points="'+pts.join(' ')+'"/>'
     +'<circle class="exdot" cx="'+last[0]+'" cy="'+last[1]+'" r="4"/></svg>'
     +'<div class="maplegend" style="text-align:left;padding:6px 2px 0">'+maxes.length+' séances · charge max '+fmtN(mn)+' → '+fmtN(mx)+' kg</div>';
  }else{
    h+='<div class="hempty">Pas encore assez de séances pour tracer une courbe (il en faut 2).</div>';
  }
  return h+'</div>';
}
function showExPicker(){
  const list=[],archive=historicalExercises();
  for(const exId in archive){const hh=exHistory(exId);if(hh.length)list.push({id:exId,name:archive[exId].name,n:hh.length});}
  list.sort((a,b)=>b.n-a.n);
  sheet.innerHTML='<h2>Choisir un exercice</h2><div class="sp">Exercices avec un historique de séries validées.</div>'
   +'<div class="expicklist">'+list.map(x=>'<button class="sbtn'+(x.id===STATEX?' pri':'')+'" data-act="exsel" data-ex="'+esc(x.id)+'" style="justify-content:space-between">'+esc(x.name)+'<span class="num" style="opacity:.65;margin-left:10px">'+x.n+'</span></button>').join('')+'</div>';
  openSheet();
  sheet.querySelectorAll('[data-act="exsel"]').forEach(b=>b.addEventListener('click',()=>{STATEX=b.dataset.ex;closeSheet();render();}));
}
/* ---------- plateaux (coach local : charge max stagnante, sans IA) ---------- */
function plateauCard(){
  const flagged=[],seen={};
  for(const s of PROGRAM)for(const e of s.ex){
    if(seen[e.id])continue;seen[e.id]=1;
    if(e.ceiling)continue; /* exercice plafonné : stagnation de charge voulue */
    const pts=exHistory(e.id).map(en=>({date:en.date,m:maxW(en.sets)})).filter(x=>x.m!=null);
    if(pts.length<3)continue;
    if(diffDays(pts[pts.length-1].date)>21)continue; /* plus entraîné récemment → on ignore */
    let best=-1,bestIdx=0;
    pts.forEach((p,i)=>{if(p.m>best){best=p.m;bestIdx=i}});
    const since=diffDays(pts[bestIdx].date),sessionsSince=pts.length-1-bestIdx;
    if(since>=28&&sessionsSince>=2)flagged.push({name:e.name,tab:s.tab,w:best,wk:Math.round(since/7)});
  }
  if(!flagged.length)return '';
  flagged.sort((a,b)=>b.wk-a.wk);
  let h='<div class="reccard"><div class="charttitle">Plateaux · à débloquer</div>';
  for(const f of flagged)
    h+='<div class="recrow"><span class="rn">'+esc(f.tab)+' · '+esc(f.name)+'</span><span class="rv num">'+fmtN(f.w)+' kg · '+f.wk+' sem</span></div>';
  return h+'<div class="maplegend" style="text-align:left;padding:8px 2px 0">Charge max stable depuis ≥ 4 semaines. Pistes : varier l’angle ou la machine, rest-pause, tempo plus lent, ou une semaine de décharge. (Progresser en répétitions compte aussi.)</div></div>';
}

/* ---------- stats ---------- */
function statsHTML(embed){
  let h=embed?'':'<div class="top"><h1>Stats</h1><div class="hbtns"><button class="hbtn" data-act="data">Données</button></div></div>';
  if(!DB.workouts.length)return h+bilanHTML()+'<div class="empty">Pas encore de séance.<br>Les statistiques d’entraînement apparaîtront après ta première séance.</div>';
  const now=new Date();
  const isMonth=STATSRANGE==='month';
  const sinceIso=isMonth?(now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-01'):isoOf(weekStart(now));
  const rng=isMonth?{low:40,high:80}:{low:10,high:20};
  const unit=isMonth?'mois':'sem.';
  const winW=DB.workouts.filter(w=>w.date>=sinceIso);
  let winVol=0,winSets=0;winW.forEach(w=>{const st=workoutStats(w);winVol+=st.vol;winSets+=st.sets;});
  const prevW=workoutsInRange(periodStartIso(isMonth,-1),periodEndIso(isMonth,-1));
  const prevT=totalsOfWorkouts(prevW);
  const mvol=volumeByMuscle(sinceIso);
  const grp=muscleGroupScores(mvol);
  h+='<div class="subdate">Depuis le '+fmtDateShort(DB.workouts[0].date)+'</div>'
   +'<div class="seg"><button class="segb'+(!isMonth?' on':'')+'" data-act="srange" data-r="week">Semaine</button>'
   +'<button class="segb'+(isMonth?' on':'')+'" data-act="srange" data-r="month">Mois</button></div>'
   +'<div class="statgrid">'
   +'<div class="statbox"><div class="v num">'+winSets+'</div><div class="l">Séries · '+unit+'</div></div>'
   +'<div class="statbox"><div class="v num">'+winW.length+'</div><div class="l">Séances · '+unit+'</div></div>'
   +'<div class="statbox"><div class="v num">'+fmtKg(winVol)+'</div><div class="l">kg · '+unit+'</div></div>'
   +'</div>'
   +statsInsightHTML(isMonth,winW,winVol,prevW,prevT.vol,grp,rng);
  /* volume par muscle (séries / muscle sur la fenêtre) */
  h+='<div class="chartcard"><div class="charttitle">Volume par muscle · séries / '+unit+'</div>';
  if(grp.some(g=>g.v>0)){
    grp.forEach(g=>{
      const wd=Math.min(100,Math.round(100*g.v/rng.high)),on=g.v>=rng.low;
      h+='<div class="vrow"><span class="vlabel">'+esc(g.label)+'</span>'
       +'<div class="vtrack"><i class="'+(on?'on':'')+'" style="width:'+wd+'%"></i></div>'
       +'<span class="vval num'+(on?'':' off')+'">'+g.v+'</span></div>';
    });
    h+='<div class="maplegend" style="text-align:left;padding:8px 2px 0">Plein = objectif atteint ('+rng.low+'–'+rng.high+') · estompé = sous l’objectif</div>';
  }else h+='<div class="hempty">Aucune série validée sur la période.</div>';
  h+='</div>';
  /* progression par exercice (courbe de charge max + record) */
  h+=exProgressCard();
  /* plateaux : charge max stagnante ≥ 4 sem (coach local, sans IA) */
  h+=plateauCard();
  /* tonnage hebdomadaire — 8 dernières semaines */
  const weeks=[];
  for(let i=7;i>=0;i--){
    const st=weekStart(now);st.setDate(st.getDate()-7*i);
    const en=new Date(st);en.setDate(en.getDate()+7);
    const a=isoOf(st),b=isoOf(en);
    let vol=0;DB.workouts.filter(w=>w.date>=a&&w.date<b).forEach(w=>{vol+=workoutStats(w).vol});
    weeks.push({label:String(st.getDate()).padStart(2,'0')+'/'+String(st.getMonth()+1).padStart(2,'0'),vol,cur:i===0});
  }
  const mx=Math.max(1,...weeks.map(w=>w.vol));
  const W=300,H=100,bw=26,gap=(W-8*bw)/8;
  let bars='';
  weeks.forEach((wk,i)=>{
    const bh=Math.max(wk.vol?3:0,Math.round(78*wk.vol/mx));
    const x=(gap/2+i*(bw+gap)).toFixed(1);
    bars+='<rect class="'+(wk.cur?'cur':'')+'" x="'+x+'" y="'+(86-bh)+'" width="'+bw+'" height="'+bh+'" rx="3"/>'
     +'<text x="'+(+x+bw/2)+'" y="97" text-anchor="middle">'+wk.label+'</text>';
  });
  h+='<div class="chartcard"><div class="charttitle">Tonnage hebdomadaire</div>'
   +'<svg class="wchart" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+bars+'</svg></div>';
  /* records */
  const recs=[];
  for(const s of PROGRAM)for(const e of s.ex){
    const b=bestEver(e.id);
    if(b!=null)recs.push({name:e.name,tab:s.tab,w:b});
  }
  recs.sort((a,b)=>b.w-a.w);
  if(recs.length){
    h+='<div class="reccard"><div class="charttitle">Records · charge max</div>';
    for(const r of recs)h+='<div class="recrow"><span class="rn">'+esc(r.tab)+' · '+esc(r.name)+'</span><span class="rv num">'+fmtN(r.w)+' kg</span></div>';
    h+='</div>';
  }
  /* récupération musculaire + bilan forme */
  h+=bodyMapHTML();
  h+=bilanHTML();
  return h;
}

/* ---------- éditeur de programme ---------- */
function editorRestValue(){
  const input=document.getElementById('es-rest');
  return (input?intOrNull(input.value):null)??SETTINGS.rest;
}
function updateEditorRest(){
  const input=document.getElementById('es-rest');if(!input)return;
  const value=input.value.trim(),rest=editorRestValue();
  input.setAttribute('aria-invalid',String(!!value&&(intOrNull(value)==null||rest<1||rest>86400)));
  app.querySelectorAll('[data-act="sessionrest"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rest===value)));
  app.querySelectorAll('.e-rest').forEach(el=>{el.placeholder=rest+' (séance)';});
}
function editExHTML(e,i,defaultRest=editorRestValue()){
  const refStr=e.refText?e.refText:(e.ref!=null?fmtN(e.ref):'');
  return '<div class="ecard" data-dragitem data-exid="'+esc(e.id||'')+'">'
   +'<div class="ehead"><div class="ehl"><span class="grip" title="Glisser pour réordonner">⠿</span><span class="en num">EXERCICE '+(i+1)+'</span></div>'
   +'<div class="ebtns"><button class="ebtn" data-act="eup" title="Monter">↑</button>'
   +'<button class="ebtn" data-act="edown" title="Descendre">↓</button>'
   +'<button class="ebtn" data-act="edel" title="Supprimer">✕</button></div></div>'
   +'<div class="efield"><label>Nom</label><input class="e-name" value="'+esc(e.name||'')+'"></div>'
   +'<div class="egrid3">'
   +'<div class="efield"><label>Charge réf.</label><input class="e-ref num" inputmode="decimal" value="'+esc(refStr)+'"></div>'
   +'<div class="efield"><label>Unité</label><input class="e-unit" value="'+esc(e.unit||'kg')+'"></div>'
   +'<div class="efield"><label>Séries</label><input class="e-sets num" inputmode="numeric" value="'+(e.sets||3)+'"></div>'
   +'</div>'
   +'<div class="egrid3">'
   +'<div class="efield"><label>Reps cible</label><input class="e-reps" value="'+esc(e.reps||'8–10')+'"></div>'
   +'<div class="efield"><label>Repos spécifique (s)</label><input class="e-rest num" type="number" min="1" max="86400" step="1" inputmode="numeric" placeholder="'+defaultRest+' (séance)" value="'+(e.rest?e.rest:'')+'"></div>'
   +'<div class="efield"><label>Badge</label><input class="e-ceiling" value="'+esc(e.ceiling||'')+'"></div>'
   +'</div>'
   +'<div class="egrid">'
   +'<div class="efield"><label>Muscles principaux</label><input class="e-musp" placeholder="ex : dos, biceps" value="'+esc((e.musP||[]).join(', '))+'"></div>'
   +'<div class="efield"><label>Muscles secondaires</label><input class="e-muss" placeholder="ex : triceps" value="'+esc((e.musS||[]).join(', '))+'"></div>'
   +'</div>'
   +'<div class="efield"><label>Recherche vidéo YouTube</label><input class="e-yt" value="'+esc(e.yt||'')+'"></div>'
   +'<div class="efield"><label>Incrément de charge (unité de cet exercice)</label><input class="e-increment" type="text" inputmode="decimal" placeholder="Automatique" value="'+esc(e.increment??'')+'"></div>'
   +'<div class="efield"><label>Notes techniques</label><textarea class="e-notes">'+esc(e.notes||'')+'</textarea></div>'
   +'</div>';
}
function editHTML(sid){
  const s=SEANCE[sid];
  if(!s)return homeHTML();
  let h='<button class="back" data-act="openback" data-s="'+esc(sid)+'">‹ Annuler</button>'
   +'<div class="shead"><div><div class="stag">'+esc(s.tab)+'</div><h2>Modifier la séance</h2></div></div>'
   +'<div class="ecard">'
   +'<div class="efield"><label>Titre</label><input id="es-title" value="'+esc(s.title)+'"></div>'
   +'<div class="egrid">'
   +'<div class="efield"><label>Étiquette</label><input id="es-tab" value="'+esc(s.tab)+'"></div>'
   +'<div class="efield"><label>Sous-titre</label><input id="es-sub" value="'+esc(s.sub||'')+'"></div>'
   +'</div>'
   +'<div class="efield"><label>Points de vigilance</label><textarea id="es-warn">'+esc(s.warn||'')+'</textarea></div>'
   +'<div class="session-rest-editor"><div class="efield"><label for="es-rest">Repos par défaut de la séance (secondes)</label><input id="es-rest" class="num" type="number" inputmode="numeric" min="1" max="86400" step="1" placeholder="'+SETTINGS.rest+'" value="'+(s.rest??'')+'"></div>'
   +'<div class="session-rest-presets" role="group" aria-label="Durée de repos de la séance">'+[60,90,120,180,240,300].map(n=>'<button class="chip" data-act="sessionrest" data-rest="'+n+'" aria-pressed="'+(s.rest===n)+'">'+fmtT(n)+'</button>').join('')+'</div>'
   +'<button class="text-link rest-inherit" data-act="sessionrest" data-rest="" aria-pressed="'+(s.rest==null)+'">Mes réglages personnels · '+fmtT(SETTINGS.rest)+'</button></div>'
   +'</div>'
   +'<div class="maplegend" style="margin:0 4px 12px">Muscles reconnus : '+MUSCLES.map(m=>m.id).join(', ')+'</div>'
   +'<div id="exlist" data-dragsort="ex">';
  s.ex.forEach((e,i)=>{h+=editExHTML(e,i,s.rest??SETTINGS.rest)});
  h+='</div><button class="bigbtn" data-act="elib">+ Depuis la bibliothèque</button>'+'<button class="bigbtn ghost" data-act="eadd">+ Exercice vierge</button>'
   +'<div class="editor-save"><button class="bigbtn" data-act="esave">Enregistrer les modifications</button></div>';
  return h;
}
function collectEdit(sid){
  const s=SEANCE[sid];
  for(const input of app.querySelectorAll('.e-increment')){
    const value=numOrNull(input.value),invalid=!!input.value.trim()&&(value==null||value<0.0001||value>100);
    input.setAttribute('aria-invalid',String(invalid));
    if(invalid){toast('Incrément attendu : de 0,0001 à 100');input.focus();return false;}
  }
  for(const input of app.querySelectorAll('#es-rest,.e-rest')){
    const n=intOrNull(input.value),invalid=!!input.value.trim()&&(n==null||n<1||n>86400);
    input.setAttribute('aria-invalid',String(invalid));
    if(invalid){toast('Repos invalide : entier de 1 à 86400 s');input.focus();return false;}
  }
  const sessionRest=intOrNull(document.getElementById('es-rest').value);
  const title=document.getElementById('es-title').value.trim();
  const tab=document.getElementById('es-tab').value.trim();
  const sub=document.getElementById('es-sub').value.trim();
  const warn=document.getElementById('es-warn').value.trim();
  const ex=[];
  document.querySelectorAll('#exlist .ecard').forEach(card=>{
    const nameEl=card.querySelector('.e-name');
    if(!nameEl)return;
    const name=nameEl.value.trim();
    if(!name)return;
    const refRaw=card.querySelector('.e-ref').value.trim();
    const refNum=numOrNull(refRaw);
    let sets=intOrNull(card.querySelector('.e-sets').value);
    if(!sets||sets<1)sets=3;if(sets>10)sets=10;
    const e={
      id:card.dataset.exid||(sid+'x'+Math.random().toString(36).slice(2,8)),
      name,sets,
      reps:card.querySelector('.e-reps').value.trim()||'8–10',
      unit:card.querySelector('.e-unit').value.trim()||'kg',
      notes:card.querySelector('.e-notes').value.trim(),
      yt:card.querySelector('.e-yt').value.trim(),
      musP:parseMuscles(card.querySelector('.e-musp').value),
      musS:parseMuscles(card.querySelector('.e-muss').value)
    };
    if(refNum!=null)e.ref=refNum;
    else if(refRaw){e.ref=null;e.refText=refRaw}
    else e.ref=null;
    const ceil=card.querySelector('.e-ceiling').value.trim();
    const increment=numOrNull(card.querySelector('.e-increment')?.value);
    if(increment!=null)e.increment=increment;
    if(ceil)e.ceiling=ceil;
    const restEl=card.querySelector('.e-rest');
    const rest=restEl?intOrNull(restEl.value):null;
    if(rest&&rest>0)e.rest=rest;
    ex.push(e);
  });
  if(!ex.length){toast('Au moins un exercice requis');return false}
  s.title=title||s.title;s.tab=tab||s.tab;s.sub=sub;s.warn=warn;s.rest=sessionRest;s.ex=ex;
  saveProgram();
  editBaseline=editorState();
  return true;
}

/* ---------- bibliothèque de machines (vue) ---------- */
function searchKey(text){return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function matchesSearch(text,query){return searchKey(query).split(/\s+/).every(word=>text.includes(word));}
function machineSearch(m){return searchKey([m.n,m.b,m.t,m.aliases,(m.p||[]).concat(m.s||[]).map(mLabel).join(' '),m.personal?'':LOAD_SHORT[machineLoad(m)]].filter(Boolean).join(' '));}
function filterMachineRows(){
  const q=searchKey(MFILTER.q);let count=0;
  document.querySelectorAll('#mlist .mrow').forEach(row=>{const visible=matchesSearch(row.dataset.search,q);row.hidden=!visible;if(visible)count++;});
  const total=document.getElementById('machineCount');if(total)total.textContent=count+' exercice'+(count>1?'s':'');
  const empty=document.getElementById('machineEmpty');if(empty)empty.hidden=count>0;
}
function machinesHTML(){
  const brands=[];MACHINES.forEach(m=>{if(brands.indexOf(m.b)<0)brands.push(m.b)});
  let h='<button class="back" data-act="programs">‹ Programmes</button>'
   +'<div class="shead"><div><div class="stag">Bibliothèque</div><h2>Exercices</h2></div></div>'
   +'<div class="search-field">'+uiIcon('search')+'<input id="mq" class="msearch" type="search" aria-label="Rechercher un exercice" placeholder="Rechercher un exercice…" value="'+esc(MFILTER.q||'')+'"></div>';
  const activeFilters=[MFILTER.g,MFILTER.b,MFILTER.c,MFILTER.l].filter(Boolean).length;
  h+='<details id="machineFilters" class="machine-filters"'+(MFILTER.open?' open':'')+'><summary>'+uiIcon('sliders-horizontal')+'Filtres'+(activeFilters?' · '+activeFilters+' actifs':'')+'</summary><div class="mfilters">'
   +'<button class="mfchip'+(!MFILTER.g?' on':'')+'" data-act="mfg" data-g="">Tous muscles</button>';
  MACHINE_GROUPS.forEach(g=>{h+='<button class="mfchip'+(MFILTER.g===g[0]?' on':'')+'" data-act="mfg" data-g="'+g[0]+'">'+esc(g[1])+'</button>'});
  h+='</div><div class="mfilters">'
   +'<button class="mfchip alt'+(!MFILTER.b?' on':'')+'" data-act="mfb" data-b="">Toutes marques</button>';
  brands.forEach(b=>{h+='<button class="mfchip alt'+(MFILTER.b===b?' on':'')+'" data-act="mfb" data-b="'+esc(b)+'">'+esc(b)+'</button>'});
  h+='</div>';
  h+='<div class="mfilters"><button class="mfchip'+(!MFILTER.c?' on':'')+'" data-act="mfc" data-c="">Toutes salles</button>';
  CHAINS.forEach(c=>{h+='<button class="mfchip'+(MFILTER.c===c?' on':'')+'" data-act="mfc" data-c="'+esc(c)+'">'+esc(c)+'</button>'});
  h+='</div>';
  h+='<div class="mfilters"><button class="mfchip'+(!MFILTER.l?' on':'')+'" data-act="mfl" data-l="">Tout chargement</button>';
  LOAD_FILTER.forEach(x=>{h+='<button class="mfchip'+(MFILTER.l===x[0]?' on':'')+'" data-act="mfl" data-l="'+x[0]+'">'+esc(x[1])+'</button>'});
  h+='</div><button class="sbtn" data-act="mfreset">Réinitialiser les filtres</button></details>';
  if(MFILTER.c)h+='<p class="sp">Marques associées à '+esc(MFILTER.c)+' · modèles à vérifier dans ton club.</p>';
  const personal=libraryCatalog().filter(m=>m.personal);
  if(personal.length)h+='<details class="personal-library"><summary>Mes exercices · '+personal.length+'</summary>'+personal.map(m=>'<button class="mrow" data-act="personalexercise" data-key="'+esc(m.key)+'"><span class="mrow-main"><span class="mrow-n">'+esc(m.n)+'</span><span class="mrow-mu">'+esc(m.p.map(mLabel).join(', '))+'</span></span>'+uiIcon('chevron-right')+'</button>').join('')+'</details>';
  const grp=MACHINE_GROUPS.find(g=>g[0]===MFILTER.g);
  const ids=grp?grp[2]:null;
  const q=searchKey(MFILTER.q);
  let n=0;
  h+='<div id="mlist">';
  MACHINES.forEach((m,i)=>{
    if(MFILTER.b&&m.b!==MFILTER.b)return;
    if(MFILTER.c&&machineChains(m).indexOf(MFILTER.c)<0)return;
    if(MFILTER.l&&machineLoad(m)!==MFILTER.l)return;
    const all=(m.p||[]).concat(m.s||[]);
    if(ids&&!all.some(x=>ids.indexOf(x)>=0))return;
    const mus=(m.p||[]).map(mLabel).join(', ');
    const searchStr=machineSearch(m);
    const visible=matchesSearch(searchStr,q);if(visible)n++;
    h+='<button class="mrow"'+(visible?'':' hidden')+' data-act="machine" data-m="'+i+'" data-search="'+esc(searchStr)+'">'
     +'<div class="mrow-main"><div class="mrow-n">'+esc(m.n)+'</div><div class="mrow-mu">'+esc(mus)+' · '+esc(LOAD_SHORT[machineLoad(m)])+'</div></div>'
     +'<span class="mrow-b">'+esc(m.b)+'</span></button>';
  });
  h+='</div><div class="hempty" id="machineEmpty"'+(n?' hidden':'')+'>Aucun exercice ne correspond à ta recherche.</div>';
  h=h.replace('<div id="mlist">','<div id="machineCount" class="subdate" role="status">'+n+' exercice'+(n>1?'s':'')+'</div><div id="mlist">');
  return h;
}
function showMachine(i){
  const m=MACHINES[i];if(!m)return;
  const chips=(m.p||[]).map(x=>'<span class="mchip pri">'+esc(mLabel(x))+'</span>').join('')
    +(m.s||[]).map(x=>'<span class="mchip">'+esc(mLabel(x))+'</span>').join('');
  const ap=activeProgram();
  const seances=ap?ap.seances:[];
  const opts=seances.map(s=>'<button class="sbtn" data-act="machadd" data-m="'+i+'" data-s="'+esc(s.id)+'">'+esc(s.tab)+' · '+esc(s.title)+'</button>').join('');
  const chains=machineChains(m);
  const imgURL='https://www.google.com/search?tbm=isch&q='+encodeURIComponent(m.n+(m.generic?' exercice musculation':' '+m.b+' machine musculation'));
  const load=machineLoad(m);
  const p=exPattern({name:m.n});
  sheet.innerHTML='<h2>'+esc(m.n)+'</h2>'
   +'<div class="sp">'+esc(m.generic?m.t:m.b)+(m.model?' · '+esc(m.model):'')+' · '+esc(LOAD_SHORT[load])+(chains.length?' · Enseignes indicatives : '+chains.map(esc).join(', ')+'. Modèle à vérifier dans ton club.':'')+'</div>'
   +exPhotoHTML(m.n)
   +'<div class="sbtns" style="margin:4px 0 14px"><a class="sbtn pri" href="'+imgURL+'" target="_blank" rel="noopener">Voir en photos ›</a></div>'
   +machineVisualHTML(m,p,load)
   +'<div class="mchips">'+chips+'</div>'
   +'<div class="rectitle">Chargement</div><div class="notes" style="margin-bottom:14px">'+esc(LOAD_DESC[load])+'</div>'
   +'<div class="rectitle">Conseil d’exécution</div><div class="notes" style="margin-bottom:14px">'+esc(machineTip(m))+'</div>'
   +(m.tip?'':machineCoachHTML(p,load))
   +'<div class="rectitle">Ajouter à une séance'+(ap?' · '+esc(ap.name):'')+'</div>'
   +'<div class="machadd">'+(opts||'<div class="hempty">Crée d’abord une séance dans ce programme.</div>')+'</div>';
  openSheet();bindExPhoto();
  sheet.querySelectorAll('[data-act="machadd"]').forEach(button=>button.addEventListener('click',()=>addMachineToSeance(+button.dataset.m,button.dataset.s)));
}
function addMachineToSeance(i,sid){
  const m=MACHINES[i],s=SEANCE[sid];if(!m||!s)return;
  if(DB.active?.seance===sid){toast('Termine la séance en cours avant de la modifier');return;}
  s.ex.push({...machineAsExercise(m),id:uid('e_'),sets:3,reps:'8–10'});
  savePrograms();closeSheet();toast('Ajouté à '+s.tab);
}
function showPersonalExercise(key){
  const entry=libraryCatalog().find(m=>m.personal&&m.key===key);if(!entry)return;
  const e=entry.exercise;
  sheet.innerHTML='<h2>'+esc(e.name)+'</h2><p class="sp">'+esc((e.musP||[]).map(mLabel).join(', '))+'</p><div class="notes">'+esc(e.notes||'')+'</div>'
    +'<div class="rectitle">Ajouter à une séance</div><div class="machadd">'+(activeProgram()?.seances||[]).map(s=>'<button class="sbtn" data-personalsession="'+esc(s.id)+'">'+esc(s.title)+'</button>').join('')+'</div>'
    +((SETTINGS.exerciseLibrary||[]).some(x=>libraryKey(x)===key)?'<button class="sbtn danger" id="removePersonal">Retirer de ma bibliothèque</button>':'');
  openSheet();
  sheet.querySelectorAll('[data-personalsession]').forEach(button=>button.addEventListener('click',()=>{
    const s=SEANCE[button.dataset.personalsession];if(!s)return;
    if(DB.active?.seance===s.id){toast('Termine la séance en cours avant de la modifier');return;}
    s.ex.push({...structuredClone(e),id:uid('e_')});savePrograms();rememberLibraryExercises([e]);closeSheet();toast('Exercice ajouté');
  }));
  document.getElementById('removePersonal')?.addEventListener('click',()=>{
    if(!window.confirm('Retirer cet exercice de la bibliothèque personnelle ? Les copies dans tes programmes sont conservées.'))return;
    SETTINGS.exerciseLibrary=SETTINGS.exerciseLibrary.filter(x=>libraryKey(x)!==key);saveSettings();closeSheet();render();
  });
}

/* Remplacement ponctuel : l'exercice choisi vit uniquement dans DB.active.
   Le programme ne change jamais, et l'historique conserve le vrai mouvement fait. */
function muscleOverlap(a,b){
  const wanted=new Set(a.musP||[]);
  return (b.musP||[]).reduce((n,m)=>n+(wanted.has(m)?2:0),0)
    +(b.musS||[]).reduce((n,m)=>n+(wanted.has(m)?1:0),0);
}
function machineAsExercise(m){
  return {name:m.generic?m.n:m.n+' ('+m.b+')',unit:'kg',ref:null,notes:machineTip(m),yt:m.n+' technique',musP:(m.p||[]).filter(x=>MUSCLE_BY_ID[x]),musS:(m.s||[]).filter(x=>MUSCLE_BY_ID[x]),load:LOAD_SHORT[machineLoad(m)]};
}
function replacementCandidates(source){
  const pattern=exPattern(source),family=p=>['chestpress','benchpress'].includes(p)?'horizontal-press':p;
  const compatible=e=>family(exPattern(e))===family(pattern)&&(source.musP||[]).some(m=>(e.musP||[]).includes(m));
  const seen=new Set([searchKey(source.name)]),out=[];
  for(const e of [...Object.values(EXO),...(SETTINGS.exerciseLibrary||[])]){
    const key=searchKey(e.name);
    const score=muscleOverlap(source,e);
    if(!score||!compatible(e)||seen.has(key))continue;
    seen.add(key);out.push({kind:'program',value:e,score,label:'Programme'});
  }
  MACHINES.forEach((m,index)=>{
    const e=machineAsExercise(m),key=searchKey(e.name),score=muscleOverlap(source,e);
    if(!score||!compatible(e)||seen.has(key))return;
    seen.add(key);out.push({kind:'machine',value:e,index,score,label:e.load});
  });
  return out.sort((a,b)=>b.score-a.score||a.value.name.localeCompare(b.value.name,'fr')).slice(0,24);
}
function replacementExercise(source,candidate){
  const base=candidate.value;
  return {id:uid('e_'),name:base.name,sets:Math.max(1,Number(source.sets)||3),reps:source.reps||base.reps||'8–10',unit:base.unit||source.unit||'kg',ref:null,notes:base.notes||'',yt:base.yt||'',musP:(base.musP||[]).slice(),musS:(base.musS||[]).slice(),ceiling:base.ceiling,rest:base.rest??source.rest,...(base.increment!=null?{increment:base.increment}:{})};
}
function replaceActiveExercise(sourceId,candidate){
  const active=DB.active,source=activeExercise(sourceId);
  if(!active||!source||!active.ex[sourceId])return;
  if(active.ex[sourceId].some(set=>set.done)){toast('Remplacement possible avant la première série validée');return;}
  const replacement=replacementExercise(source,candidate);
  if(active.ex[sourceId].some(set=>set.w!=null||set.r!=null)&&!window.confirm('Remplacer cet exercice ? Les valeurs non validées seront effacées ; la note sera conservée.'))return;
  replacement.sets=active.ex[sourceId].length;
  const order=(active.exerciseOrder||SEANCE[active.seance]?.ex.map(e=>e.id)||[]).slice();
  const at=order.indexOf(sourceId);if(at<0)return;
  active.ex[replacement.id]=Array.from({length:replacement.sets},()=>({w:null,r:null,done:false}));
  active.exMeta={...(active.exMeta||{}),[replacement.id]:replacement};
  delete active.ex[sourceId];delete active.exMeta[sourceId];
  if(active.exNotes?.[sourceId]){active.exNotes[replacement.id]=active.exNotes[sourceId];delete active.exNotes[sourceId];}
  if(active.restByEx?.[sourceId]!=null){active.restByEx[replacement.id]=active.restByEx[sourceId];delete active.restByEx[sourceId];}
  order[at]=replacement.id;active.exerciseOrder=order;
  FOCUS_EX=replacement.id;persist();closeSheet();render();
  toast('Exercice remplacé pour cette séance');
}
function showReplaceExercise(sourceId){
  const active=DB.active,source=activeExercise(sourceId);
  if(!active||!source||!active.ex[sourceId])return;
  if(active.ex[sourceId].some(set=>set.done)){toast('Remplacement possible avant la première série validée');return;}
  const candidates=replacementCandidates(source);
  const target=(source.musP||[]).map(mLabel).join(' · ')||'même zone musculaire';
  sheet.innerHTML='<h2>Remplacer l’exercice</h2><div class="sp">'+esc(source.name)+' · alternatives ciblant '+esc(target)+'. Le programme ne sera pas modifié.</div>'
    +'<div class="efield"><label for="replaceEquipment">Matériel</label><select id="replaceEquipment"><option value="">Tout matériel</option>'+[...new Set(candidates.map(c=>c.label))].map(label=>'<option>'+esc(label)+'</option>').join('')+'</select></div>'
    +'<div class="replace-list">'+(candidates.length?candidates.map((candidate,i)=>'<button class="replace-option" data-replace="'+i+'"><span>'+esc(candidate.value.name)+'</span><small>'+esc(candidate.label)+' · '+esc((candidate.value.musP||[]).map(mLabel).join(', '))+'</small>'+uiIcon('arrow-right')+'</button>').join(''):'<div class="hempty">Aucune alternative du même mouvement dans la bibliothèque.</div>')+'</div>';
  openSheet();
  document.getElementById('replaceEquipment').addEventListener('change',event=>sheet.querySelectorAll('[data-replace]').forEach(button=>{button.hidden=!!event.target.value&&candidates[+button.dataset.replace].label!==event.target.value;}));
  sheet.querySelectorAll('[data-replace]').forEach(button=>button.addEventListener('click',()=>replaceActiveExercise(sourceId,candidates[+button.dataset.replace])));
}

/* ---------- gestion des programmes (vue) ---------- */
function programsHTML(){
  const ap=activeProgram();
  let h='<div class="top"><h1>Programmes</h1><button class="hbtn" data-act="coach">'+uiIcon('users')+'Coaching</button></div>'
   +'<div class="subdate">'+PROGRAMS.length+' programme'+(PROGRAMS.length>1?'s personnels':' personnel')+'</div>'
   +'<button class="progpill" data-act="machines"><span class="ppl">Bibliothèque</span><span class="ppn">Explorer les exercices</span><span class="ppx">Ouvrir ›</span></button>';
  for(const p of PROGRAMS){
    const on=p.id===ACTIVE_PID;
    const nS=p.seances.length,nE=p.seances.reduce((a,s)=>a+(s.ex?s.ex.length:0),0);
    h+='<div class="pcard'+(on?' on':'')+'">'
     +'<div class="prow"><div class="pinfo">'
     +'<div class="pname">'+esc(p.name)+(on?'<span class="recobadge">ACTIF</span>':'')+'</div>'
     +'<div class="smeta">'+nS+' séance'+(nS>1?'s':'')+' · '+nE+' exercice'+(nE>1?'s':'')+'</div></div></div>'
     +'<div class="pactions">'
     +(on?'<span class="pa ghosted">Programme actif</span>':'<button class="pa pri" data-act="pactivate" data-p="'+esc(p.id)+'">Activer</button>')
     +'<button class="pa" data-act="prename" data-p="'+esc(p.id)+'">Renommer</button>'
     +'<button class="pa" data-act="pdup" data-p="'+esc(p.id)+'">Dupliquer</button>'
     +(PROGRAMS.length>1?'<button class="pa danger" data-act="pdel" data-p="'+esc(p.id)+'">Supprimer</button>':'')
     +'</div></div>';
  }
  h+='<button class="bigbtn" data-act="pnew">+ Nouveau programme</button>';
  h+='<div class="sectitle">Séances · '+esc(ap?ap.name:'')+'</div>';
  if(ap&&ap.seances.length){
    h+='<div class="seancelist" data-dragsort="seance">';
    ap.seances.forEach(s=>{
      const sm=sessionMuscles(s);
      const val=mid=>sm.p.has(mid)?1:(sm.s.has(mid)?0.45:0);
      h+='<div class="scard mgmt withfig" data-dragitem data-sid="'+esc(s.id)+'">'
       +'<div class="scard-fig">'+silhouette(dominantSide(s),val)+'</div>'
       +'<div class="scard-body">'
       +'<div class="srow"><div class="ehl"><span class="grip" title="Glisser pour réordonner">⠿</span><span class="stag">'+esc(s.tab)+'</span></div>'
       +'<div class="ebtns">'
       +'<button class="ebtn" data-act="seup" data-s="'+esc(s.id)+'" title="Monter">↑</button>'
       +'<button class="ebtn" data-act="sedown" data-s="'+esc(s.id)+'" title="Descendre">↓</button>'
       +'<button class="ebtn" data-act="editseance" data-s="'+esc(s.id)+'" title="Modifier">✎</button>'
       +'<button class="ebtn" data-act="sdelseance" data-s="'+esc(s.id)+'" title="Supprimer">✕</button>'
       +'</div></div>'
       +'<div class="sname">'+esc(s.title)+'</div>'
       +'<div class="smeta">'+(s.ex?s.ex.length:0)+' exercice'+((s.ex&&s.ex.length>1)?'s':'')+(s.sub?' · '+esc(s.sub):'')+'</div>'
       +'</div></div>';
    });
    h+='</div>';
  }else{
    h+='<div class="hempty">Aucune séance dans ce programme.</div>';
  }
  h+='<button class="bigbtn ghost" data-act="saddseance">+ Nouvelle séance</button>';
  return h;
}
function showNewProgram(){
  sheet.innerHTML='<h2>Nouveau programme</h2>'
   +'<div class="sp">Nomme ton programme et choisis un point de départ.</div>'
   +'<div class="efield"><label>Nom</label><input id="npName" placeholder="ex : Prise de masse" value="Nouveau programme"></div>'
   +'<div class="sbtns"><button class="sbtn pri" id="npBlank">Vierge</button><button class="sbtn" id="npDefault">Depuis le modèle</button></div>';
  openSheet();
  const mk=(fromDefault)=>{const name=(document.getElementById('npName').value||'').trim()||'Nouveau programme';createProgram(name,fromDefault);closeSheet();go('programs');toast('Programme créé');};
  document.getElementById('npBlank').addEventListener('click',()=>mk(false));
  document.getElementById('npDefault').addEventListener('click',()=>mk(true));
}
function showRenameProgram(pid){
  const p=PROGRAMS.find(x=>x.id===pid);if(!p)return;
  sheet.innerHTML='<h2>Renommer</h2>'
   +'<div class="efield"><label>Nom du programme</label><input id="rnName" value="'+esc(p.name)+'"></div>'
   +'<div class="sbtns"><button class="sbtn pri" id="rnOk">Enregistrer</button></div>';
  openSheet();
  document.getElementById('rnOk').addEventListener('click',()=>{const v=(document.getElementById('rnName').value||'').trim();if(v)renameProgram(pid,v);closeSheet();render();});
}

/* ================== SÉANCE ACTIVE ================== */
function startWorkout(sid){
  if(DB.active&&DB.active.seance!==sid){
    if(!window.confirm('Une séance '+(SEANCE[DB.active.seance]?SEANCE[DB.active.seance].tab:'')+' est en cours. L’abandonner ?'))return;
  }
  const ex={};
  for(const e of SEANCE[sid].ex){
    ex[e.id]=[];
    const prev=prevSets(e.id);
    for(let i=0;i<e.sets;i++){
      const p=prev&&prev[i]?prev[i]:null;
      ex[e.id].push({w:p&&p.w!=null?p.w:null,r:p&&p.r!=null?p.r:null,done:false});
    }
  }
  stopTimer();
  FOCUS_EX=null;
  DB.active=snapshotWorkout({seance:sid,date:todayISO(),start:Date.now(),pt:0,ps:null,ex,exNotes:{},exerciseOrder:SEANCE[sid].ex.map(e=>e.id)});
  persist();render();
}
function elapsedStr(){
  const a=DB.active;if(!a)return '';
  const p=sessionProgress(a),last=lastValidatedElapsed(a);
  const elapsed=p.total&&p.done===p.total&&last!=null?last:workoutElapsedMs(a);
  const s=Math.floor(elapsed/1000);
  return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
}
function workoutElapsedMs(a){
  return Math.max(0,((a.ps||Date.now())-a.start-(a.pt||0)));
}
function lastValidatedElapsed(a){
  let last=null;
  for(const sets of Object.values(a.ex||{}))for(const st of sets){
    if(st.done&&Number.isFinite(st.doneElapsedMs)&&st.doneElapsedMs>=0)last=Math.max(last??0,st.doneElapsedMs);
  }
  return last;
}
function togglePause(){
  const a=DB.active;if(!a)return;
  if(a.ps){a.pt=(a.pt||0)+(Date.now()-a.ps);a.ps=null}
  else a.ps=Date.now();
  persist();render();
}
setInterval(()=>{checkWorkoutTimeout();const el=document.getElementById('elapsed');if(el&&DB.active)el.textContent=elapsedStr()},1000);
function checkWorkoutTimeout(){
  const a=DB.active;
  if(!STORAGE_READY||!STORAGE_WRITABLE||sheet.dataset.importing||!a||Date.now()<a.start+AUTO_FINISH_MS)return false;
  if(!workoutStats(a).sets){
    const deadline=a.start+AUTO_FINISH_MS;
    if(a.ps&&a.ps<=deadline)return false;
    a.ps=deadline;persist();stopTimer();
    if(route.view!=='edit')render();
    toast('Séance mise en pause après 3 h · aucune série validée');
    return true;
  }
  return finishWorkout({automatic:true})===true;
}
function updateProgress(){
  if(!DB.active)return;
  const p=sessionProgress(DB.active);
  const pd=document.getElementById('pdone'),pf=document.getElementById('pfill');
  if(pd)pd.textContent=p.done+' / '+p.total+' séries';
  if(pf)pf.style.width=(p.total?Math.round(100*p.done/p.total):0)+'%';
  const elapsed=document.getElementById('elapsed'),status=app.querySelector('.livebar .lt');
  if(elapsed)elapsed.textContent=elapsedStr();
  if(status)status.textContent=DB.active.ps?'EN PAUSE':p.total&&p.done===p.total?'SÉRIES TERMINÉES':'SÉANCE EN COURS';
  syncExerciseFocus();
}
function refreshWorkoutCoach(card,exId){
  const old=card&&card.querySelector('.wcoach');
  const e=activeExercise(exId);
  if(old&&DB.active&&e&&DB.active.ex[exId])old.outerHTML=workoutCoachHTML(e,DB.active.ex[exId]);
}
function finishWorkout({automatic=false}={}){
  const a=DB.active;if(!a)return;
  const stats=workoutStats(a);
  if(!stats.sets){toast('Aucune série validée');return}
  const recs=[];
  const comparison=comparisonSummary(a);
  for(const exId in a.ex){
    const m=maxW(a.ex[exId].filter(s=>s.done));
    if(m==null)continue;
    const prev=comparableBest(exId,workoutExercise(a,exId),a.date);
    if(prev==null||m>prev)recs.push({name:workoutExercise(a,exId)?.name||exId,w:m,prev});
  }
  const lastElapsed=lastValidatedElapsed(a);
  const dur=lastElapsed==null&&automatic?null:Math.round((lastElapsed??workoutElapsedMs(a))/1000);
  const ex={};
  for(const exId in a.ex){
    const sets=a.ex[exId].filter(s=>s.done&&(s.w!=null||s.r!=null)).map(s=>({w:s.w,r:s.r,done:true}));
    if(sets.length)ex[exId]=sets;
  }
  const previousWorkouts=DB.workouts;
  DB.workouts=[...DB.workouts,snapshotWorkout({id:a.id,session:a.session,exMeta:a.exMeta,date:a.date,seance:a.seance,dur,ex,exNotes:cleanWorkoutNotes(a.exNotes)})];
  DB.workouts.sort((x,y)=>x.date<y.date?-1:1);
  DB.active=null;persist();
  if(!STORAGE_WRITABLE){DB.workouts=previousWorkouts;DB.active=a;return false;}
  stopTimer();
  if(automatic){
    if(document.getElementById('exerciseRest'))closeSheet();
    if(route.view!=='edit')render();
    toast('Séance clôturée automatiquement après 3 h');
    return true;
  }
  showSummary({seance:a.seance,dur,stats,recs,comparison});
  go('home');
  return true;
}
function cancelWorkout(){
  const saved=DB.active;
  if(!saved)return;
  DB.active=null;persist();stopTimer();go('home');
  /* toast avec bouton Annuler pendant 5 s */
  const t=document.getElementById('toast');
  t.innerHTML='Séance annulée — <button id="_undo" style="background:none;border:none;color:var(--ac);font-weight:700;font-size:inherit;cursor:pointer;padding:0">Annuler</button>';
  t.classList.add('on');
  clearTimeout(t._h);
  const undo=()=>{DB.active=saved;persist();go('seance',saved.seance);t.classList.remove('on')};
  const btn=document.getElementById('_undo');if(btn)btn.addEventListener('click',undo,{once:true});
  t._h=setTimeout(()=>{t.classList.remove('on');t.textContent='';},5000);
}

/* ================== ÉVÉNEMENTS ================== */
document.getElementById('tabbar').addEventListener('click',ev=>{
  const b=ev.target.closest('.tabbtn');if(!b)return;
  go(b.dataset.v);
});
app.addEventListener('click',ev=>{
  if(checkWorkoutTimeout())return;
  const actEl=ev.target.closest('[data-act]');
  if(!actEl)return;
  const act=actEl.dataset.act;
  if(act==='home')go('home');
  else if(act==='bodyside'){DASH_SIDE={sid:actEl.dataset.s,side:actEl.dataset.side};render();}
  else if(act==='weeklystats'){SUIVI='stats';go('suivi');}
  else if(act==='workoutmode'){WORKOUT_MODE=actEl.dataset.mode==='list'?'list':'focus';render();}
  else if(act==='exfocus'){
    const current=activeExerciseList(SEANCE[route.seance]||{ex:[]},DB.active);
    if(!current.some(e=>e.id===actEl.dataset.ex))return;
    FOCUS_EX=actEl.dataset.ex;WORKOUT_MODE='focus';render();
    const selected=app.querySelector('.exercise-rail [aria-pressed="true"]');
    selected?.focus({preventScroll:true});selected?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    const heading=app.querySelector('.workout-browser');heading?.scrollIntoView({block:'start',behavior:'instant'});
  }
  else if(act==='open')go('seance',actEl.dataset.s);
  else if(act==='openback')go('seance',actEl.dataset.s);
  else if(act==='start')startWorkout(route.seance);
  else if(act==='quickstart'){const sid=actEl.dataset.s;startWorkout(sid);if(DB.active&&DB.active.seance===sid)go('seance',sid);}
  else if(act==='finish')finishWorkout();
  else if(act==='cancel')cancelWorkout();
  else if(act==='pause')togglePause();
  else if(act==='restset')showExerciseRest(actEl.dataset.ex);
  else if(act==='sessionrest'){
    const input=document.getElementById('es-rest');if(!input)return;
    input.value=actEl.dataset.rest;input.setAttribute('aria-invalid','false');updateEditorRest();
  }
  else if(act==='data')showData();
  else if(act==='cloud')window.DKOCloudUI?.show();
  else if(act==='coach')window.DKOCoachUI?.open();
  else if(act==='backup')downloadBackup();
  else if(act==='srange'){STATSRANGE=actEl.dataset.r;render();}
  else if(act==='suivitab'){SUIVI=actEl.dataset.t;render();}
  else if(act==='expick')showExPicker();
  else if(act==='settings')showSettings();
  else if(act==='exinfo')showExercise(actEl.dataset.ex);
  else if(act==='replaceex')showReplaceExercise(actEl.dataset.ex);
  else if(act==='bilan')showBodyEntry();
  else if(act==='wedit')showEditWorkout(+actEl.dataset.w);
  else if(act==='wdel'){if(window.confirm('Supprimer définitivement cette séance de l’historique ?')){DB.workouts.splice(+actEl.dataset.w,1);persist();render();toast('Séance supprimée');}}
  else if(act==='machines')go('machines');
  else if(act==='machine')showMachine(+actEl.dataset.m);
  else if(act==='personalexercise')showPersonalExercise(actEl.dataset.key);
  else if(act==='mfg'){MFILTER.g=actEl.dataset.g||null;render();}
  else if(act==='mfb'){MFILTER.b=actEl.dataset.b||null;render();}
  else if(act==='mfc'){MFILTER.c=actEl.dataset.c||null;render();}
  else if(act==='mfl'){MFILTER.l=actEl.dataset.l||null;render();}
  else if(act==='mfreset'){MFILTER={g:null,b:null,c:null,l:null,q:'',open:true};render();}
  else if(act==='machadd')addMachineToSeance(+actEl.dataset.m,actEl.dataset.s);
  else if(act==='programs')go('programs');
  else if(act==='pactivate'){setActiveProgram(actEl.dataset.p);toast('Programme activé');go('home');}
  else if(act==='pnew')showNewProgram();
  else if(act==='prename')showRenameProgram(actEl.dataset.p);
  else if(act==='pdup'){duplicateProgram(actEl.dataset.p);toast('Programme dupliqué');render();}
  else if(act==='pdel'){if(window.confirm('Supprimer ce programme ? (l’historique de séances déjà réalisées est conservé)')){if(deleteProgram(actEl.dataset.p))render();}}
  else if(act==='editseance')go('edit',actEl.dataset.s);
  else if(act==='saddseance'){const sid=addSeance();if(sid)go('edit',sid);}
  else if(act==='sdelseance'){if(window.confirm('Supprimer cette séance du programme ?')){deleteSeance(actEl.dataset.s);render();}}
  else if(act==='seup'){moveSeance(actEl.dataset.s,-1);render();}
  else if(act==='sedown'){moveSeance(actEl.dataset.s,1);render();}
  else if(act==='edit')go('edit',route.seance);
  else if(act==='esave'){if(collectEdit(route.seance)){toast('Séance enregistrée');go('seance',route.seance)}}
  else if(act==='elib'){LIBFILTER.mode='browse';showLibPicker();}
  else if(act==='eadd'){
    const list=document.getElementById('exlist');
    const n=list.querySelectorAll('.ecard').length;
    list.insertAdjacentHTML('beforeend',editExHTML({name:'',sets:3,reps:'8–10',unit:'kg',ref:null,notes:'',yt:'',musP:[],musS:[]},n));
    labelFields(list);
    list.lastElementChild.querySelector('.e-name').focus();
  }
  else if(act==='edel'){
    const card=actEl.closest('.ecard');
    if(window.confirm('Supprimer cet exercice ?'))card.remove();
  }
  else if(act==='eup'||act==='edown'){
    const card=actEl.closest('.ecard');
    if(act==='eup'&&card.previousElementSibling)card.previousElementSibling.before(card);
    if(act==='edown'&&card.nextElementSibling)card.nextElementSibling.after(card);
  }
  else if(act==='addset'){
    const card=actEl.closest('.card');const exId=card.dataset.ex;
    if(!DB.active||!DB.active.ex[exId])return;
    DB.active.ex[exId].push({w:null,r:null,done:false});persist();
    const i=DB.active.ex[exId].length-1;
    const e=activeExercise(exId);
    card.querySelector('.stable').insertAdjacentHTML('beforeend',
      setRowHTML(e,i,{w:null,r:null,done:false},e?suggestTargets(e):null));
    card.classList.remove('complete');
    updateProgress();
    refreshWorkoutCoach(card,exId);
  }
  else if(act==='delset'){
    const card=actEl.closest('.card');const exId=card.dataset.ex;
    if(!DB.active||!DB.active.ex[exId])return;
    const arr=DB.active.ex[exId];
    if(arr.length<=1){toast('Au moins une série');return}
    const last=arr[arr.length-1];
    if((last.w!=null||last.r!=null||last.done)&&!window.confirm('Retirer la dernière série (saisie perdue) ?'))return;
    arr.pop();persist();
    const rows=card.querySelectorAll('.strow');if(rows.length)rows[rows.length-1].remove();
    card.classList.toggle('complete',arr.length>0&&arr.every(s=>s.done));
    updateProgress();
    refreshWorkoutCoach(card,exId);
  }
  else if(act==='stepw'||act==='stepr'){
    const row=actEl.closest('.strow'),card=actEl.closest('.card');
    if(!DB.active||!card||!row)return;
    const exId=card.dataset.ex,i=+row.dataset.i;
    const st=DB.active.ex[exId]&&DB.active.ex[exId][i];
    if(!st)return;
    const isKg=act==='stepw',d=+actEl.dataset.d,e=activeExercise(exId);
    const t=e?suggestTargets(e)[i]:null;
    const inp=row.querySelector(isKg?'.w':'.r');
    const cur=numOrNull(inp.value);
    const tv=isKg?(t?t.w:null):(t?t.r:null);
    let nv;
    if(cur==null&&tv!=null)nv=tv;                       /* 1er appui : cale sur la cible */
    else{const base=cur!=null?cur:0;nv=base+d*(isKg?exerciseIncrement(e,base):1);}
    if(isKg){nv=Math.min(10000,Math.max(0,Number(nv.toFixed(4))));st.w=nv;inp.value=fmtN(nv);}
    else{nv=Math.min(100000,Math.max(0,Number(nv.toFixed(6))));st.r=nv;inp.value=fmtN(nv);}
    inp.dispatchEvent(new Event('input',{bubbles:true}));
  }
  else if(act==='chk'){
    const row=actEl.closest('.strow');const card=actEl.closest('.card');
    const exId=card.dataset.ex,i=+row.dataset.i;
    if(!DB.active||!DB.active.ex[exId])return;
    const st=DB.active.ex[exId][i];
    if(!st.done){
      const weight=row.querySelector('.w'),reps=row.querySelector('.r');
      let w=numOrNull(weight.value);
      let r=numOrNull(reps.value);
      if(weight.value.trim()&&(w==null||w<0||w>10000)){toast('Saisis une charge positive ou nulle');weight.focus();return;}
      if(reps.value.trim()&&(r==null||r<=0||r>100000)){toast('Saisis des répétitions supérieures à zéro, par exemple 7,5');reps.focus();return;}
      const e=activeExercise(exId);
      const t=e?suggestTargets(e)[i]:null;
      if(w==null&&t&&t.w!=null){w=t.w;row.querySelector('.w').value=fmtN(w)}
      if(r==null&&t&&t.r!=null){r=t.r;row.querySelector('.r').value=fmtN(r)}
      if(r==null||r<=0){toast('Ajoute les répétitions avant de valider');reps.focus();return;}
      st.w=w;st.r=r;st.done=true;
      st.doneElapsedMs=workoutElapsedMs(DB.active);
      row.classList.add('done');
      const _pb=comparableBest(exId,workoutExercise(DB.active,exId),DB.active.date),_isPR=st.w!=null&&_pb!=null&&st.w>_pb;
      if(_isPR){
        row.classList.add('pr');
        if(!row.querySelector('.prtag')){const tg=document.createElement('span');tg.className='prtag';tg.textContent='RECORD';row.appendChild(tg);}
        toast('Record ! '+fmtN(st.w)+' kg');
      }
      if(navigator.vibrate)navigator.vibrate(_isPR?[20,40,20]:10);
      startTimer(e?e.name:'Repos',e?restForExercise(e):null);
    }else{
      st.done=false;delete st.doneElapsedMs;row.classList.remove('done','pr');
      const _t=row.querySelector('.prtag');if(_t)_t.remove();
    }
    persist();
    card.classList.toggle('complete',DB.active.ex[exId].every(s=>s.done));
    updateProgress();
    refreshWorkoutCoach(card,exId);
    const prog=card.querySelector('.dprog .hist'),current=activeExercise(exId);if(prog&&current)prog.innerHTML=progHTML(current);
  }
});
app.addEventListener('input',ev=>{
  if(ev.target.id==='es-rest'){updateEditorRest();return;}
  if(ev.target.matches('.session-note')){
    const exId=ev.target.dataset.ex;
    if(!DB.active||!Object.hasOwn(DB.active.ex,exId))return;
    DB.active.exNotes={...cleanWorkoutNotes(DB.active.exNotes),[exId]:ev.target.value.slice(0,2000)};
    persist();return;
  }
  if(ev.target.id==='mq'){
    MFILTER.q=ev.target.value;
    filterMachineRows();
    return;
  }
  const row=ev.target.closest('.strow');if(!row||!ev.target.matches('input'))return;
  const card=row.closest('.card');const exId=card.dataset.ex,i=+row.dataset.i;
  if(!DB.active||!DB.active.ex[exId]||!DB.active.ex[exId][i])return;
  const st=DB.active.ex[exId][i];
  const weight=row.querySelector('.w'),reps=row.querySelector('.r');
  st.w=numOrNull(weight.value);st.r=numOrNull(reps.value);
  const invalidW=!!weight.value.trim()&&(st.w==null||st.w<0||st.w>10000);
  const invalidR=!!reps.value.trim()&&(st.r==null||st.r<=0||st.r>100000);
  weight.setAttribute('aria-invalid',String(invalidW));reps.setAttribute('aria-invalid',String(invalidR));
  if(st.done&&(invalidW||invalidR||st.r==null)){
    st.done=false;delete st.doneElapsedMs;row.classList.remove('done','pr');row.querySelector('.prtag')?.remove();
    card.classList.remove('complete');updateProgress();refreshWorkoutCoach(card,exId);
  }
  persist();
});

/* ================== MINUTEUR DE REPOS ================== */
function restForExercise(e){
  return DB.active?.restByEx?.[e.id]??e.rest??SEANCE[e.seance||DB.active?.seance]?.rest??SETTINGS.rest;
}
function showExerciseRest(exId){
  const e=activeExercise(exId),active=DB.active;
  if(!e||!active||!Object.hasOwn(active.ex,exId))return;
  sheet.innerHTML='<h2>Repos pour cette séance</h2><div class="sp">'+esc(e.name)+'</div>'
    +'<div class="efield"><label for="exerciseRest">Durée en secondes</label><input id="exerciseRest" type="number" inputmode="numeric" min="1" max="86400" step="1" value="'+restForExercise(e)+'"></div>'
    +'<div class="rest-presets">'+[60,90,120,180].map(n=>'<button class="sbtn" data-rest="'+n+'">'+fmtT(n)+'</button>').join('')+'</div>'
    +'<p class="rest-scope">Prochains repos de cet exercice, pour cette séance uniquement. Le repos déjà lancé reste inchangé.</p>'
    +'<div class="sbtns"><button class="sbtn" id="restReset">Valeur du programme</button><button class="sbtn pri" id="restSave">Appliquer</button></div>';
  openSheet();
  const input=document.getElementById('exerciseRest');
  sheet.querySelectorAll('[data-rest]').forEach(b=>b.addEventListener('click',()=>{input.value=b.dataset.rest;input.setAttribute('aria-invalid','false');}));
  const apply=value=>{
    if(DB.active!==active)return;
    active.restByEx={...(active.restByEx||{})};
    if(value==null)delete active.restByEx[exId];else active.restByEx[exId]=value;
    persist();closeSheet();
    app.querySelectorAll('.rest-setting').forEach(b=>{if(b.dataset.ex===exId)b.querySelector('span').textContent='Repos '+fmtT(restForExercise(e));});
  };
  document.getElementById('restReset').addEventListener('click',()=>apply(null));
  document.getElementById('restSave').addEventListener('click',()=>{
    const n=intOrNull(input.value);
    if(n==null||n<1||n>86400){input.setAttribute('aria-invalid','true');input.focus();toast('Saisis une durée entière entre 1 et 86400 secondes');return;}
    apply(n);
  });
}
const tbar=document.getElementById('timerbar'),tleftEl=document.getElementById('tleft'),tlabel=document.getElementById('tlabel');
let tInt=null,tEndAt=0,audioCtx=null,wakeLock=null;
/* Wake Lock : garde l'écran allumé pendant le repos (sinon le minuteur
   s'interrompt à la mise en veille). Auto-relâché en arrière-plan → repris
   au retour si le minuteur tourne encore. */
async function acquireWake(){
  if(!('wakeLock'in navigator))return;
  try{wakeLock=await navigator.wakeLock.request('screen')}catch(e){wakeLock=null}
}
function releaseWake(){if(wakeLock){try{wakeLock.release()}catch(e){}wakeLock=null}}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){checkWorkoutTimeout();if(tInt)acquireWake();}
});
window.addEventListener('pageshow',()=>checkWorkoutTimeout());
function startTimer(label,rest){
  const sec=(rest!=null&&rest>0)?rest:SETTINGS.rest;
  tlabel.textContent=label||'Repos';
  tbar.querySelectorAll('#tminus,#tplus').forEach(button=>{button.disabled=false;});
  tbar.classList.add('on');tbar.classList.remove('fin');acquireWake();
  tEndAt=Date.now()+sec*1000;
  if(DB.active){DB.active.restTimer={end:tEndAt,label:label||'Repos'};persist();}
  tleftEl.textContent=fmtT(sec);
  if(!audioCtx){try{audioCtx=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}
  if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume();
  clearInterval(tInt);
  tInt=setInterval(()=>{
    const left=(tEndAt-Date.now())/1000;
    tleftEl.textContent=fmtT(left);
    if(left<=0){clearInterval(tInt);tInt=null;timerDone()}
  },250);
}
function timerDone(){
  tbar.querySelectorAll('#tminus,#tplus').forEach(button=>{button.disabled=true;});
  tleftEl.textContent='0:00';tbar.classList.add('fin');tlabel.textContent='Repos terminé';
  if(navigator.vibrate)navigator.vibrate([300,120,300,120,300]);
  if(audioCtx)try{
    const now=audioCtx.currentTime;
    for(let i=0;i<3;i++){
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(audioCtx.destination);o.frequency.value=880;
      g.gain.setValueAtTime(.0001,now+i*.35);
      g.gain.exponentialRampToValueAtTime(.3,now+i*.35+.02);
      g.gain.exponentialRampToValueAtTime(.0001,now+i*.35+.28);
      o.start(now+i*.35);o.stop(now+i*.35+.3);
    }
  }catch(e){}
  setTimeout(()=>{if(!tInt)stopTimer()},4000);
}
function stopTimer(){
  clearInterval(tInt);tInt=null;tbar.classList.remove('on','fin');releaseWake();
  if(DB.active?.restTimer){delete DB.active.restTimer;persist();}
}
function adjustTimer(seconds){
  if(!tInt)return;tEndAt+=seconds*1000;tleftEl.textContent=fmtT((tEndAt-Date.now())/1000);
  if(DB.active?.restTimer){DB.active.restTimer.end=tEndAt;persist();}
  if(tEndAt<=Date.now()){clearInterval(tInt);tInt=null;timerDone();}
}
document.getElementById('tplus').addEventListener('click',()=>adjustTimer(30));
document.getElementById('tminus')?.addEventListener('click',()=>adjustTimer(-30));
document.getElementById('tskip').addEventListener('click',stopTimer);

/* ================== SHEETS ================== */
const overlay=document.getElementById('overlay'),sheet=document.getElementById('sheet');
let sheetReturnFocus=null;
let labelSequence=0;
function labelFields(root){
  root.querySelectorAll('.efield').forEach(field=>{
    const label=field.querySelector('label'),input=field.querySelector('input,textarea,select');
    if(label&&input){if(!input.id)input.id='field-'+(++labelSequence);label.htmlFor=input.id;}
  });
}
function openSheet(){
  if(!sheet.classList.contains('on'))sheetReturnFocus=document.activeElement;
  sheet.inert=false;sheet.setAttribute('aria-hidden','false');sheet.scrollTop=0;
  const title=sheet.querySelector('h2');
  if(title){title.id='sheetTitle';sheet.setAttribute('aria-labelledby',title.id);}
  if(!sheet.querySelector('.sheet-close')){
    const close=document.createElement('button');close.className='sheet-close';close.type='button';
    close.textContent='×';close.setAttribute('aria-label','Fermer');close.addEventListener('click',closeSheet);sheet.prepend(close);
  }
  labelFields(sheet);
  overlay.classList.add('on');sheet.classList.add('on');
  document.querySelectorAll('#app,#tabbar,#timerbar').forEach(el=>{el.inert=true});
  sheet.querySelector('.sheet-close')?.focus({preventScroll:true});
  sheet.scrollTop=0;
}
function closeSheet(){
  overlay.classList.remove('on');sheet.classList.remove('on');
  document.querySelectorAll('#app,#tabbar,#timerbar').forEach(el=>{el.inert=false});
  sheet.inert=true;sheet.setAttribute('aria-hidden','true');
  if(sheetReturnFocus?.isConnected)sheetReturnFocus.focus({preventScroll:true});
  sheetReturnFocus=null;
  document.dispatchEvent(new Event('app:sheet-closed'));
}
document.addEventListener('keydown',ev=>{
  if(!sheet.classList.contains('on'))return;
  if(ev.key==='Escape'){ev.preventDefault();closeSheet();return;}
  if(ev.key!=='Tab')return;
  const items=[...sheet.querySelectorAll('button,input,textarea,select,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
  const first=items[0],last=items[items.length-1];
  if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last?.focus();}
  else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first?.focus();}
});
overlay.addEventListener('click',closeSheet);
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('on');
  clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),2400);
}
function showSummary(o){
  const s=SEANCE[o.seance];
  let recs='';
  for(const first of [false,true]){
    const entries=o.recs.filter(r=>(r.prev==null)===first);
    if(entries.length)recs+='<div class="recwrap"><div class="rectitle">'+(first?'Premières références':'Records de charge')+'</div>'
      +entries.map(r=>'<div class="recline"><b>'+fmtN(r.w)+' kg</b> · '+esc(r.name)+(r.prev!=null?' (préc. '+fmtN(r.prev)+')':'')+'</div>').join('')+'</div>';
  }
  const metric=value=>value.sets+' série'+(value.sets>1?'s':'')+(value.vol!=null?' · '+fmtKg(value.vol)+' kg':'');
  const comparison=o.comparison?'<section class="summary-comparison"><h3>Par rapport au '+esc(fmtDateShort(o.comparison.date))+'</h3><p>Exercices communs · séries validées</p>'
    +'<table><thead><tr><th scope="col">Exercice</th><th scope="col">Avant</th><th scope="col">Aujourd’hui</th></tr></thead><tbody>'
    +o.comparison.rows.map(r=>'<tr><th scope="row">'+esc(r.name)+'</th><td>'+esc(metric(r.before))+'</td><td>'+esc(metric(r.now))+'</td></tr>').join('')+'</tbody></table></section>':'';
  sheet.innerHTML='<h2>Séance terminée'+(s?' · '+esc(s.tab):'')+'</h2><div class="sp">'+esc(s?s.title:'')+'</div>'
   +'<div class="sumgrid">'
   +'<div class="sumbox"><div class="v num">'+fmtDur(o.dur)+'</div><div class="l">Durée</div></div>'
   +'<div class="sumbox"><div class="v num">'+fmtKg(o.stats.vol)+'</div><div class="l">kg soulevés</div></div>'
   +'<div class="sumbox"><div class="v num">'+o.stats.sets+'</div><div class="l">Séries</div></div>'
   +'</div>'+comparison+recs
   +'<div class="sbtns"><button class="sbtn pri" id="shOk">OK</button></div>';
  openSheet();
  document.getElementById('shOk').addEventListener('click',closeSheet);
}
function libraryKey(e){return searchKey(e.name)+'|'+searchKey(e.unit||'kg');}
function libraryCatalog(){
  const entries=MACHINES.map(m=>({...m,exercise:{...machineAsExercise(m),sets:3,reps:'8–10'}}));
  const seen=new Set(entries.map(m=>libraryKey(m.exercise)));
  for(const e of [...(SETTINGS.exerciseLibrary||[]),...Object.values(EXO)]){
    const key=libraryKey(e);if(seen.has(key))continue;seen.add(key);
    entries.push({n:e.name,b:'Personnel',p:e.musP||[],s:e.musS||[],t:'Personnel',exercise:e,personal:true});
  }
  return entries.map(m=>({...m,key:libraryKey(m.exercise)}));
}
function libraryBrands(){return [...new Set(libraryCatalog().map(m=>m.b))];}
function rememberLibraryExercises(exercises){
  const recent=exercises.map(libraryKey);
  SETTINGS.exerciseRecent=[...new Set([...recent,...(SETTINGS.exerciseRecent||[])])].slice(0,30);
  saveSettings();
}
function addSelectedLibraryExercises(){
  const list=document.getElementById('exlist');if(!list||!LIBSELECT.size)return;
  const exercises=[...LIBSELECT.values()],n=list.querySelectorAll('.ecard').length;
  list.insertAdjacentHTML('beforeend',exercises.map((e,i)=>editExHTML({...e,id:undefined},n+i)).join(''));
  rememberLibraryExercises(exercises);LIBSELECT.clear();labelFields(list);closeSheet();
  list.lastElementChild?.querySelector('.e-name')?.focus();
  toast(exercises.length+' exercice(s) ajouté(s)');
}
function refreshLibrarySelection(){
  const button=document.getElementById('libAddSelected');
  if(button){button.disabled=!LIBSELECT.size;button.textContent='Ajouter la sélection ('+LIBSELECT.size+')';}
}
function libraryMatch(m){
  if(LIBSCOPE==='personal'&&!m.personal)return false;
  if(LIBSCOPE==='favorites'&&!(SETTINGS.exerciseFavorites||[]).includes(m.key))return false;
  if(LIBSCOPE==='recent'&&!(SETTINGS.exerciseRecent||[]).includes(m.key))return false;
  if(LIBFILTER.b&&m.b!==LIBFILTER.b)return false;
  if(LIBFILTER.c&&!machineChains(m).includes(LIBFILTER.c))return false;
  if(LIBFILTER.l&&(m.personal||machineLoad(m)!==LIBFILTER.l))return false;
  const group=MACHINE_GROUPS.find(g=>g[0]===LIBFILTER.g);
  return !group||(m.p||[]).concat(m.s||[]).some(muscle=>group[2].includes(muscle));
}
function filterLibraryRows(){
  const q=searchKey(LIBFILTER.q);let count=0;
  sheet.querySelectorAll('#liblist .mrow').forEach(row=>{
    const visible=matchesSearch(row.dataset.search,q);row.hidden=!visible;if(visible)count++;
  });
  const countEl=document.getElementById('libCount');if(countEl)countEl.textContent=count+' exercice'+(count>1?'s':'');
  const empty=document.getElementById('libEmpty');if(empty)empty.hidden=count>0;
}
function addLibraryExercise(m){
  const list=document.getElementById('exlist');if(!m||!list)return;
  const n=list.querySelectorAll('.ecard').length;
  list.insertAdjacentHTML('beforeend',editExHTML({...machineAsExercise(m),sets:3,reps:'8–10'},n));
  labelFields(list);closeSheet();toast('Exercice ajouté — pense à enregistrer');
}
function showCustomExerciseForm(){
  const options='<option value="">Non renseigné</option>'+MUSCLES.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.label)+'</option>').join('');
  if(!LIBDRAFT)LIBDRAFT={libCustomName:LIBFILTER.q.slice(0,120),libCustomSets:'3',libCustomReps:'8–10',libCustomUnit:'kg',libCustomPrimary:'',libCustomSecondary:'',libCustomNotes:''};
  sheet.innerHTML='<h2>Exercice non répertorié</h2>'
    +'<div class="seg lib-modes"><button class="segb" data-libmode="browse">Bibliothèque</button><button class="segb on" data-libmode="custom">Créer</button></div>'
    +'<div class="efield"><label for="libCustomName">Nom de l’exercice</label><input id="libCustomName" maxlength="120" placeholder="Ex : Presse à jambes XFit"></div>'
    +'<div class="egrid3"><div class="efield"><label for="libCustomSets">Séries</label><input id="libCustomSets" class="num" type="number" min="1" max="100" inputmode="numeric" value="3"></div>'
    +'<div class="efield"><label for="libCustomReps">Répétitions</label><input id="libCustomReps" maxlength="80" value="8–10"></div>'
    +'<div class="efield"><label for="libCustomUnit">Unité</label><input id="libCustomUnit" maxlength="80" value="kg"></div></div>'
    +'<div class="egrid"><div class="efield"><label for="libCustomPrimary">Muscle principal</label><select id="libCustomPrimary">'+options+'</select></div>'
    +'<div class="efield"><label for="libCustomSecondary">Muscle secondaire</label><select id="libCustomSecondary">'+options+'</select></div></div>'
    +'<div class="efield"><label for="libCustomNotes">Notes techniques</label><textarea id="libCustomNotes" maxlength="2000"></textarea></div>'
    +'<label class="library-remember"><input type="checkbox" id="libRemember" checked> Conserver dans ma bibliothèque personnelle</label>'
    +'<div class="sbtns"><button class="sbtn pri" id="libCustomAdd">Ajouter à la séance</button></div>';
  openSheet();
  for(const [id,value] of Object.entries(LIBDRAFT)){
    const field=document.getElementById(id);if(!field)continue;
    if(field.type==='checkbox')field.checked=value;else field.value=value;
  }
  sheet.querySelectorAll('input,select,textarea').forEach(field=>field.addEventListener('input',()=>{
    LIBDRAFT[field.id]=field.type==='checkbox'?field.checked:field.value;field.removeAttribute('aria-invalid');
  }));
  sheet.querySelector('[data-libmode="browse"]').addEventListener('click',()=>{LIBFILTER.mode='browse';showLibPicker();});
  document.getElementById('libCustomAdd').addEventListener('click',()=>{
    const name=document.getElementById('libCustomName'),sets=intOrNull(document.getElementById('libCustomSets').value);
    if(!name.value.trim()){name.setAttribute('aria-invalid','true');name.focus();return;}
    if(sets==null||sets<1||sets>100){document.getElementById('libCustomSets').setAttribute('aria-invalid','true');document.getElementById('libCustomSets').focus();return;}
    const list=document.getElementById('exlist');if(!list)return;
    const primary=document.getElementById('libCustomPrimary').value,secondary=document.getElementById('libCustomSecondary').value;
    const n=list.querySelectorAll('.ecard').length;
    const exercise={name:name.value.trim(),sets,reps:document.getElementById('libCustomReps').value.trim()||'8–10',unit:document.getElementById('libCustomUnit').value.trim()||'kg',ref:null,notes:document.getElementById('libCustomNotes').value.trim(),yt:name.value.trim()+' technique',musP:primary?[primary]:[],musS:secondary&&secondary!==primary?[secondary]:[]};
    list.insertAdjacentHTML('beforeend',editExHTML(exercise,n));
    if(document.getElementById('libRemember').checked){
      SETTINGS.exerciseLibrary=[...(SETTINGS.exerciseLibrary||[]).filter(e=>libraryKey(e)!==libraryKey(exercise)),exercise];
    }
    rememberLibraryExercises([exercise]);LIBDRAFT=null;LIBFILTER.mode='browse';
    labelFields(list);closeSheet();toast('Exercice personnalisé ajouté — pense à enregistrer');
  });
}
function showLibPicker(){
  if(LIBFILTER.mode==='custom'){showCustomExerciseForm();return;}
  const catalog=libraryCatalog(),brands=libraryBrands(),matches=catalog.map((m,i)=>({m,i})).filter(({m})=>libraryMatch(m));
  if(LIBSCOPE==='recent')matches.sort((a,b)=>(SETTINGS.exerciseRecent||[]).indexOf(a.m.key)-(SETTINGS.exerciseRecent||[]).indexOf(b.m.key));
  const filters=[LIBFILTER.g,LIBFILTER.b,LIBFILTER.c,LIBFILTER.l].filter(Boolean).length;
  let h='<h2>Ajouter des exercices</h2>'
   +'<div class="seg lib-modes"><button class="segb on" data-libmode="browse">Bibliothèque</button><button class="segb" data-libmode="custom">Créer</button></div>'
   +'<input id="libq" type="search" aria-label="Rechercher dans la bibliothèque" class="msearch" placeholder="Rechercher un exercice…" value="'+esc(LIBFILTER.q)+'" style="margin:0 0 10px">'
   +'<div class="mfilters library-scopes" role="group" aria-label="Origine des exercices">'+[['all','Tous'],['personal','Mes exercices'],['favorites','Favoris'],['recent','Récents']].map(([key,label])=>'<button class="mfchip'+(LIBSCOPE===key?' on':'')+'" data-libscope="'+key+'" aria-pressed="'+(LIBSCOPE===key)+'">'+label+'</button>').join('')+'</div>'
   +'<details class="library-filters"><summary>'+uiIcon('sliders-horizontal')+'Filtres'+(filters?' · '+filters+' actifs':'')+'</summary>'
   +'<div class="mfilters"><button class="mfchip'+(!LIBFILTER.g?' on':'')+'" data-libfilter="g" data-value="">Tous muscles</button>'
   +MACHINE_GROUPS.map(g=>'<button class="mfchip'+(LIBFILTER.g===g[0]?' on':'')+'" data-libfilter="g" data-value="'+g[0]+'">'+esc(g[1])+'</button>').join('')+'</div>'
   +'<div class="mfilters"><button class="mfchip alt'+(!LIBFILTER.b?' on':'')+'" data-libfilter="b" data-value="">Toutes marques</button>'
   +brands.map(b=>'<button class="mfchip alt'+(LIBFILTER.b===b?' on':'')+'" data-libfilter="b" data-value="'+esc(b)+'">'+esc(b)+'</button>').join('')+'</div>'
   +'<div class="mfilters"><button class="mfchip'+(!LIBFILTER.c?' on':'')+'" data-libfilter="c" data-value="">Toutes salles</button>'
   +CHAINS.map(c=>'<button class="mfchip'+(LIBFILTER.c===c?' on':'')+'" data-libfilter="c" data-value="'+esc(c)+'">'+esc(c)+'</button>').join('')+'</div>'
   +'<div class="mfilters"><button class="mfchip'+(!LIBFILTER.l?' on':'')+'" data-libfilter="l" data-value="">Tout chargement</button>'
   +LOAD_FILTER.map(x=>'<button class="mfchip'+(LIBFILTER.l===x[0]?' on':'')+'" data-libfilter="l" data-value="'+x[0]+'">'+esc(x[1])+'</button>').join('')+'</div>'
   +'<button class="text-link" id="libReset">Réinitialiser les filtres</button></details>'
   +(LIBFILTER.c?'<p class="sp">Marques associées à '+esc(LIBFILTER.c)+' · modèles à vérifier dans ton club.</p>':'')
   +'<div id="libCount" class="subdate" role="status">'+matches.length+' exercice'+(matches.length>1?'s':'')+'</div><div id="liblist">';
  matches.forEach(({m,i})=>{
    const muscles=(m.p||[]).map(mLabel).join(', '),load=m.personal?'':LOAD_SHORT[machineLoad(m)],search=machineSearch(m);
    const detail=[m.b,muscles,load].filter(Boolean).join(' · ');
    const favorite=(SETTINGS.exerciseFavorites||[]).includes(m.key);
    h+='<div class="mrow library-choice" data-search="'+esc(search)+'"><label><input type="checkbox" data-libmachine="'+i+'"'+(LIBSELECT.has(m.key)?' checked':'')+'><span class="mrow-main"><span class="mrow-n">'+esc(m.n)+'</span><span class="mrow-mu">'+esc(detail)+'</span></span></label><button class="icon-button" data-libfavorite="'+i+'" aria-pressed="'+favorite+'" aria-label="Favori : '+esc(m.n)+'" data-tooltip="Favori">'+uiIcon('star')+'</button></div>';
  });
  h+='</div><div id="libEmpty" class="library-empty"'+(matches.length?' hidden':'')+'><div class="hempty">Aucun exercice ne correspond à cette recherche.</div><button class="sbtn pri" data-libmode="custom">Créer un exercice non répertorié</button></div>';
  h+='<div class="library-add"><button class="sbtn pri" id="libAddSelected"></button></div>';
  sheet.innerHTML=h;openSheet();refreshLibrarySelection();
  document.getElementById('libq').addEventListener('input',event=>{LIBFILTER.q=event.target.value;filterLibraryRows();});
  sheet.querySelectorAll('[data-libfilter]').forEach(button=>button.addEventListener('click',()=>{LIBFILTER[button.dataset.libfilter]=button.dataset.value||null;showLibPicker();sheet.querySelector('.library-filters').open=true;sheet.querySelector('[data-libfilter="'+button.dataset.libfilter+'"][data-value="'+CSS.escape(button.dataset.value)+'"]')?.focus();}));
  sheet.querySelectorAll('[data-libmode="custom"]').forEach(button=>button.addEventListener('click',()=>{LIBFILTER.mode='custom';showLibPicker();}));
  document.getElementById('libReset').addEventListener('click',()=>{LIBFILTER={mode:'browse',g:null,b:null,c:null,l:null,q:''};showLibPicker();});
  sheet.querySelectorAll('[data-libscope]').forEach(button=>button.addEventListener('click',()=>{LIBSCOPE=button.dataset.libscope;showLibPicker();}));
  sheet.querySelectorAll('[data-libmachine]').forEach(input=>input.addEventListener('change',()=>{
    const m=catalog[+input.dataset.libmachine];
    if(input.checked)LIBSELECT.set(m.key,m.exercise);else LIBSELECT.delete(m.key);
    refreshLibrarySelection();
  }));
  sheet.querySelectorAll('[data-libfavorite]').forEach(button=>button.addEventListener('click',()=>{
    const key=catalog[+button.dataset.libfavorite].key,favorites=new Set(SETTINGS.exerciseFavorites||[]);
    if(favorites.has(key))favorites.delete(key);else favorites.add(key);
    SETTINGS.exerciseFavorites=[...favorites];saveSettings();button.setAttribute('aria-pressed',String(favorites.has(key)));
    if(LIBSCOPE==='favorites')showLibPicker();
  }));
  document.getElementById('libAddSelected').addEventListener('click',addSelectedLibraryExercises);
  filterLibraryRows();
}
function showOnboarding(){
  const salles=['On Air','Basic-Fit','Fitness Park','Autre'],objs=['Prise de masse','Recomposition','Force','Forme'],nivs=['Débutant','Intermédiaire','Avancé'];
  const row=(g,arr,sel)=>arr.map(v=>'<button class="chip'+(sel===v?' on':'')+'" data-ob="'+g+'" data-v="'+esc(v)+'" style="flex:0 1 auto;padding:10px 16px">'+v+'</button>').join('');
  sheet.innerHTML='<h2>Bienvenue sur Dko</h2>'
   +'<div class="sp">Trois infos pour personnaliser ton suivi — modifiable à tout moment dans Réglages.</div>'
   +'<div class="efield"><label>Ta salle</label><div class="chips" style="flex-wrap:wrap">'+row('salle',salles,SETTINGS.salle)+'</div></div>'
   +'<div class="efield"><label>Ton objectif</label><div class="chips" style="flex-wrap:wrap">'+row('obj',objs,SETTINGS.objectif)+'</div></div>'
   +'<div class="efield"><label>Ton niveau</label><div class="chips" style="flex-wrap:wrap">'+row('niv',nivs,SETTINGS.niveau)+'</div></div>'
   +'<div class="sbtns"><button class="sbtn pri" id="obGo">C’est parti ›</button></div>';
  openSheet();
  sheet.querySelectorAll('[data-ob]').forEach(b=>b.addEventListener('click',()=>{
    const g=b.dataset.ob;
    sheet.querySelectorAll('[data-ob="'+g+'"]').forEach(x=>x.classList.toggle('on',x===b));
    if(g==='salle')SETTINGS.salle=b.dataset.v;else if(g==='obj')SETTINGS.objectif=b.dataset.v;else if(g==='niv')SETTINGS.niveau=b.dataset.v;
  }));
  const go=document.getElementById('obGo');
  if(go)go.addEventListener('click',()=>{try{localStorage.setItem('dako_onboarded','1')}catch(e){}saveSettings();closeSheet();render();toast('Profil enregistré · bienvenue 💪');});
}
function showSettings(){
  const inp='width:100%;background:var(--input);border:1px solid var(--line);border-radius:10px;padding:10px 12px;outline:none';
  sheet.innerHTML='<h2>Réglages</h2><div class="sp">Appliqués immédiatement.</div>'
   +'<div class="rectitle">Apparence</div>'
   +'<div class="efield"><label>Thème</label><div class="chips" id="themeChips" style="flex-wrap:wrap">'
   +[['dark','Sombre'],['rose','Rosé']].map(t=>'<button class="chip'+(((SETTINGS.theme||'dark')===t[0])?' on':'')+'" data-th="'+t[0]+'" style="flex:0 1 auto;padding:10px 16px">'+t[1]+'</button>').join('')
   +'</div></div>'
   +'<div class="efield"><label>Repos par défaut</label><div class="chips" id="restChips">'
   +[90,120,180,240].map(v=>'<button class="chip num'+(SETTINGS.rest===v?' on':'')+'" data-rest="'+v+'">'+fmtT(v)+'</button>').join('')
   +'</div></div>'
   +'<div class="rectitle">Profil</div>'
   +'<div class="egrid3">'
   +'<div class="efield"><label>Poids (kg)</label><input id="setPoids" inputmode="decimal" value="'+(SETTINGS.poids??'')+'" style="'+inp+'"></div>'
   +'<div class="efield"><label>Taille (cm)</label><input id="setTaille" inputmode="numeric" value="'+(SETTINGS.taille??'')+'" style="'+inp+'"></div>'
   +'<div class="efield"><label>Âge</label><input id="setAge" inputmode="numeric" value="'+(SETTINGS.age??'')+'" style="'+inp+'"></div>'
   +'</div>'
   +'<div class="efield"><label>Objectif</label><input id="setObj" placeholder="ex : prise de masse" value="'+esc(SETTINGS.objectif||'')+'" style="'+inp+'"></div>'
   +'<div class="efield"><label>Salle (le coach adapte les exos au matériel)</label><div class="chips" id="salleChips" style="flex-wrap:wrap">'
   +['On Air','Basic-Fit','Fitness Park','Autre'].map(v=>'<button class="chip'+(SETTINGS.salle===v?' on':'')+'" data-salle="'+esc(v)+'" style="flex:0 1 auto;padding:10px 16px">'+v+'</button>').join('')
   +'</div></div>'
   +'<div class="efield"><label>Niveau</label><div class="chips" id="nivChips" style="flex-wrap:wrap">'
   +['Débutant','Intermédiaire','Avancé'].map(v=>'<button class="chip'+(SETTINGS.niveau===v?' on':'')+'" data-niv="'+esc(v)+'" style="flex:0 1 auto;padding:10px 16px">'+v+'</button>').join('')
   +'</div></div>'
   +'<div class="rectitle">Compte</div><div class="sbtns"><button class="sbtn" id="setCloud">Compte et sauvegarde</button><button class="sbtn" id="setCoach">'+uiIcon('users')+'Coaching</button></div>'
   +'<div class="rectitle">Outils</div>'
   +'<div class="sbtns"><button class="sbtn" id="setCalc">Calculateurs (1RM · plaques)</button><button class="sbtn" id="setBackup">Sauvegarde</button></div>'
   +'<div class="sbtns"><button class="sbtn danger" id="setReset">Réinitialiser le programme</button></div>'
   +'<div class="sbtns"><button class="sbtn pri" id="setOk">Fermer</button></div>'
   +'<div class="about">Dko v'+APP_VERSION+' · '+esc((activeProgram()||{}).name||'')+'</div>';
  openSheet();
  document.getElementById('restChips').addEventListener('click',ev=>{
    const c=ev.target.closest('.chip');if(!c)return;
    SETTINGS.rest=+c.dataset.rest;saveSettings();
    document.querySelectorAll('#restChips .chip').forEach(x=>x.classList.toggle('on',x===c));
  });
  document.getElementById('themeChips').addEventListener('click',ev=>{
    const c=ev.target.closest('.chip');if(!c)return;
    SETTINGS.theme=c.dataset.th;saveSettings();applyTheme();render();
    document.querySelectorAll('#themeChips .chip').forEach(x=>x.classList.toggle('on',x===c));
  });
  document.getElementById('setPoids').addEventListener('input',ev=>{const v=numOrNull(ev.target.value);if(v!=null){SETTINGS.poids=v;saveSettings()}});
  document.getElementById('setTaille').addEventListener('input',ev=>{const v=intOrNull(ev.target.value);SETTINGS.taille=v;saveSettings()});
  document.getElementById('setAge').addEventListener('input',ev=>{const v=intOrNull(ev.target.value);SETTINGS.age=v;saveSettings()});
  document.getElementById('setObj').addEventListener('input',ev=>{SETTINGS.objectif=ev.target.value.trim();saveSettings()});
  document.getElementById('salleChips').addEventListener('click',ev=>{
    const c=ev.target.closest('.chip');if(!c)return;
    SETTINGS.salle=c.dataset.salle;saveSettings();
    document.querySelectorAll('#salleChips .chip').forEach(x=>x.classList.toggle('on',x===c));
  });
  document.getElementById('nivChips').addEventListener('click',ev=>{
    const c=ev.target.closest('.chip');if(!c)return;
    SETTINGS.niveau=c.dataset.niv;saveSettings();
    document.querySelectorAll('#nivChips .chip').forEach(x=>x.classList.toggle('on',x===c));
  });
  document.getElementById('setCalc').addEventListener('click',showCalculators);
  document.getElementById('setCloud').addEventListener('click',()=>window.DKOCloudUI?.show());
  document.getElementById('setCoach').addEventListener('click',()=>window.DKOCoachUI?.open());
  document.getElementById('setBackup').addEventListener('click',downloadBackup);
  document.getElementById('setReset').addEventListener('click',()=>{
    if(!window.confirm('Revenir au programme par défaut ? Tes modifications de programme seront perdues (l’historique est conservé).'))return;
    if(resetProgram()){closeSheet();go('home');toast('Programme réinitialisé');}
  });
  document.getElementById('setOk').addEventListener('click',()=>{closeSheet();render()});
}
function exportPayload(){
  const exos={};
  for(const s of PROGRAM)for(const e of s.ex)
    exos[e.id]={seance:s.tab,nom:e.name,cible:e.sets+'×'+e.reps,
      reference:e.refText||(e.ref!=null?e.ref+' '+(e.unit||'kg'):e.unit||null),
      plafond:e.ceiling||null,
      muscles_principaux:e.musP||[],muscles_secondaires:e.musS||[]};
  const recup={};
  for(const m of MUSCLES)recup[m.id]=muscleRecovery(m.id);
  return{app:'dako',version:7,exporte_le:new Date().toISOString(),
    profil:Object.assign({},PROFILE,{poids_kg:SETTINGS.poids,taille_cm:SETTINGS.taille,age:SETTINGS.age,objectif:SETTINGS.objectif||PROFILE.methode,salle:SETTINGS.salle,niveau:SETTINGS.niveau}),
    reglages:SETTINGS,recuperation_musculaire:recup,
    programmes:PROGRAMS,programme_actif:ACTIVE_PID,
    programme:PROGRAM,exercices:exos,seances:DB.workouts,active:DB.active,bilan_forme:BODY};
}
function showData(){
  sheet.innerHTML='<h2>Données</h2>'
   +'<div class="sp">Lance ton coach IA gratuit (app Claude / claude.ai), ou sauvegarde / restaure ton suivi.</div>'
   +'<div class="rectitle">État de protection</div><div id="dataHealth"></div>'
   +'<div class="sbtns"><button class="sbtn" id="dataCloud">Compte et sauvegarde</button></div>'
   +'<div class="rectitle">Coach IA · gratuit</div>'
   +'<div class="sp" style="margin-bottom:10px"><b>1.</b> Copie le prompt coach et colle-le dans Claude. <b>2.</b> Colle ensuite ton programme et/ou ton historique quand il les demande.</div>'
   +'<div class="sbtns"><button class="sbtn pri" id="cPrompt">1 · Prompt coach</button></div>'
   +'<div class="sbtns" style="margin-top:8px"><button class="sbtn" id="cProg">2 · Mon programme</button><button class="sbtn" id="cHist">2 · Mon historique</button></div>'
   +'<div class="rectitle" style="margin-top:20px">Sauvegarde / restauration</div>'
   +'<div class="sbtns"><button class="sbtn pri" id="saveFile">Télécharger la sauvegarde</button><button class="sbtn" id="openFile">Ouvrir un fichier</button></div>'
   +'<input id="backupFile" type="file" accept=".json,application/json" hidden>'
   +'<textarea class="io" id="shArea" aria-label="Sauvegarde JSON à importer" spellcheck="false" placeholder="Ou coller ici une sauvegarde JSON…"></textarea>'
   +'<div class="sbtns"><button class="sbtn" id="doExport">Exporter (copier)</button><button class="sbtn" id="doImport">Importer</button></div>';
  openSheet();
  refreshDataHealth();
  document.getElementById('dataCloud').addEventListener('click',()=>window.DKOCloudUI?.show());
  document.getElementById('cPrompt').addEventListener('click',()=>clipCopy(COACH_PROMPT,'Prompt coach copié — colle-le dans Claude'));
  document.getElementById('cProg').addEventListener('click',()=>clipCopy(coachProgramText(),'Programme copié — colle-le après le prompt'));
  document.getElementById('cHist').addEventListener('click',()=>clipCopy(coachHistoryText(),'Historique copié — colle-le après le prompt'));
  document.getElementById('doExport').addEventListener('click',doExport);
  document.getElementById('doImport').addEventListener('click',doImport);
  document.getElementById('saveFile').addEventListener('click',downloadBackup);
  document.getElementById('openFile').addEventListener('click',()=>document.getElementById('backupFile').click());
  document.getElementById('backupFile').addEventListener('change',async ev=>{
    const file=ev.target.files[0];if(!file)return;
    if(file.size>10*1024*1024){toast('Fichier trop volumineux (10 Mo maximum)');return;}
    try{const text=await file.text();const area=document.getElementById('shArea');if(area){area.value=text;doImport();}}
    catch(e){toast('Impossible de lire ce fichier');}
  });
}
async function doExport(){
  const txt=JSON.stringify(exportPayload(),null,1);
  let ok=false;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    try{await navigator.clipboard.writeText(txt);ok=true}catch(e){}
  }
  if(!ok){
    const a=document.getElementById('shArea');
    a.value=txt;a.focus();a.select();a.setSelectionRange(0,txt.length);
    try{ok=document.execCommand('copy')}catch(e){}
  }
  toast(ok?'Données copiées dans le presse-papier':'Copie auto impossible — copie le texte sélectionné');
  if(ok)closeSheet();
}
const COACH_PROMPT=
 'Tu es mon coach personnel de musculation, du niveau des meilleurs préparateurs « science-based » en hypertrophie (rigueur façon Renaissance Periodization / Mike Israetel, Jeff Nippard, Eric Helms). Tu es exigeant, précis, pédagogue et bienveillant. Tu fondes TOUJOURS tes conseils sur les principes établis de la science de l’entraînement et de la nutrition ; tu distingues ce qui est solidement établi de ce qui est débattu, tu n’inventes jamais d’études et tu évites la bro-science. Je suis un pratiquant NATUREL (sans dopage).\n\n'
 +'OBJECTIF — INVARIABLE : prendre le PLUS de muscle possible, quoi qu’il arrive et quelle que soit la situation. Tu optimises en permanence l’hypertrophie ET la rétention de muscle, en adaptant la stratégie à ma phase du moment :\n'
 +'- Prise de masse : maximiser la construction musculaire en limitant la prise de gras.\n'
 +'- Sèche : préserver au maximum le muscle (voire en gagner si possible) tout en perdant du gras.\n'
 +'- Maintien / recomposition : viser gain de muscle et perte de gras simultanés quand c’est réaliste.\n\n'
 +'PRINCIPES D’ENTRAÎNEMENT que tu appliques :\n'
 +'- Tension mécanique = moteur n°1 : des séries dures menées proche de l’échec (la plupart des séries de travail à RIR 0–3 ; quelques séries à l’échec sur les mouvements sûrs).\n'
 +'- Volume = levier central, raisonné en SÉRIES DURES PAR MUSCLE PAR SEMAINE. Repères indicatifs et individuels : maintien ~6–8, minimum efficace (MEV) ~8–10, zone productive (MAV) ~10–20, max récupérable (MRV) ~20+. Démarrer modéré (~10–15), augmenter progressivement sur le mésocycle, puis décharger.\n'
 +'- Fréquence : viser ~2 passages par muscle et par semaine (volume mieux réparti = mieux récupéré et stimulé qu’une seule grosse séance).\n'
 +'- Surcharge progressive : double progression (ajouter des reps dans la fourchette, puis de la charge), battre les performances précédentes, petits incréments, suivre les chiffres.\n'
 +'- Fourchettes de reps : l’hypertrophie fonctionne sur une large plage (~5–30 reps) tant qu’on s’approche de l’échec ; en pratique ~6–12 sur les composés, ~10–20 sur l’isolation.\n'
 +'- Sélection d’exercices : amplitude COMPLÈTE avec emphase sur la position étirée (long muscle length, fort levier hypertrophique) ; exercices stables qu’on peut charger et progresser ; mélange composés (efficacité, surcharge) + isolation (muscles en retard) ; toujours une variante SANS douleur.\n'
 +'- Exécution : excentrique contrôlée (~2–3 s), amplitude complète, pas de triche, focus sur le muscle cible.\n'
 +'- Repos entre séries : ~2–3 min sur les composés (préserver charge et volume), 1–2 min sur l’isolation.\n'
 +'- Périodisation : accumuler le volume sur ~4–6 semaines, puis une semaine de DÉCHARGE (volume ~moitié, intensité réduite). Autoréguler via le RIR, la performance et l’état articulaire.\n'
 +'- Récupération : sommeil 7–9 h, gestion du stress ; la capacité de récupération limite le volume réellement utile.\n\n'
 +'NUTRITION (puisque l’objectif est le muscle dans toutes les phases) :\n'
 +'- Protéines : ~1,6–2,2 g/kg de poids de corps par jour (vers le haut, ~2,2–2,4 en sèche pour protéger le muscle), réparties sur la journée.\n'
 +'- Prise de masse : léger surplus (~+200–400 kcal/j) pour une prise lente qui limite le gras.\n'
 +'- Sèche : déficit modéré (~-300–500 kcal/j, ~0,5–1 % du poids de corps/semaine), en gardant l’intensité et les charges hautes + un volume suffisant pour retenir le muscle.\n'
 +'- Maintien / recomp : autour de la maintenance, prioriser protéines et surcharge progressive.\n'
 +'- Reste général et prudent sur la nutrition ; pas de plan médical.\n\n'
 +'MATÉRIEL / SALLES : je m’entraîne en salle commerciale et j’ALTERNE entre On Air Fitness et Basic-Fit (le matériel diffère). Propose TOUJOURS des exercices réalisables avec le matériel réellement disponible dans ma salle du jour, et donne des SUBSTITUTIONS (machine ⇄ haltères ⇄ poulie ⇄ charge libre) si une machine manque. Demande-moi dans quelle salle je suis si je ne l’ai pas précisé.\n\n'
 +'CE QUE TU FAIS :\n'
 +'1) D’abord, pose-moi des questions AVANT de prescrire : ma phase actuelle (prise de masse / sèche / maintien) et ma tendance de poids ; mon niveau et mon ancienneté ; ma fréquence, mes jours et le temps par séance ; mes BLESSURES, douleurs et limitations (j’en ai — demande-les et adapte) ; ma salle du jour et le matériel ; mes préférences alimentaires et d’exercices.\n'
 +'2) Juste après ce message, je peux te coller la STRUCTURE DE MON PROGRAMME et/ou mon HISTORIQUE de séances (export de mon app Dko). Analyse-les : volume par muscle, équilibre, progression, plateaux — et propose des ajustements concrets et chiffrés.\n'
 +'3) Dans la durée, suis-moi comme un vrai coach : programmation, surcharge, détection de plateau, décharges, en expliquant brièvement le POURQUOI de chaque choix.\n\n'
 +'SÉCURITÉ : pas de conseil médical ; en cas de douleur articulaire ou tendineuse, propose une adaptation ou oriente vers un professionnel.\n\n'
 +'Réponds en français, de façon structurée et actionnable. Commence par te présenter en UNE phrase, puis pose-moi tes premières questions (ou, si je t’ai déjà donné mes infos et mes données, lance directement l’analyse).';
async function clipCopy(txt,okMsg){
  let ok=false;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    try{await navigator.clipboard.writeText(txt);ok=true}catch(e){}
  }
  if(!ok){
    const a=document.getElementById('shArea');
    if(a){a.value=txt;a.focus();a.select();a.setSelectionRange(0,txt.length);try{ok=document.execCommand('copy')}catch(e){}}
  }
  toast(ok?(okMsg||'Copié'):'Copie impossible — copie le texte sélectionné');
}
function coachProgramText(){
  const ap=activeProgram();
  let t='=== STRUCTURE DE MON PROGRAMME ===\n';
  t+='Salle actuelle : '+(SETTINGS.salle||'?')+'\n';
  t+='Profil : '+(SETTINGS.poids||'?')+' kg, '+(SETTINGS.taille||'?')+' cm, '+(SETTINGS.age||'?')+' ans'+(SETTINGS.objectif?' · objectif : '+SETTINGS.objectif:'')+(SETTINGS.niveau?' · niveau : '+SETTINGS.niveau:'')+'\n';
  t+='Programme : '+(ap?ap.name:'—')+'\n';
  for(const s of PROGRAM){
    t+='\n['+s.tab+'] '+s.title+(s.sub?' ('+s.sub+')':'')+'\n';
    s.ex.forEach((e,i)=>{
      const ref=e.refText||(e.ref!=null?fmtN(e.ref)+' '+(e.unit||'kg'):(e.unit||''));
      const mus=(e.musP||[]).map(m=>(MUSCLE_BY_ID[m]||{}).label||m).join(', ');
      t+=' '+(i+1)+'. '+e.name+' — '+e.sets+'×'+e.reps+(ref?' — réf '+ref:'')+(mus?' — '+mus:'')+(e.ceiling?' — '+e.ceiling:'')+'\n';
      if(e.notes)t+='     '+e.notes+'\n';
    });
    if(s.warn)t+='     ⚠ '+s.warn+'\n';
  }
  return t;
}
function coachHistoryText(){
  let t='=== MON HISTORIQUE (séances récentes) ===\n';
  t+='Salle actuelle : '+(SETTINGS.salle||'?')+'\n';
  const arr=DB.workouts.slice(-15).reverse();
  if(!arr.length)return t+'(aucune séance enregistrée pour l’instant)\n';
  for(const w of arr){
    const s=w.session||SEANCE[w.seance];
    t+='\n'+fmtDateShort(w.date)+' · '+(s?s.tab+' '+s.title:w.seance)+(w.dur?' · '+fmtDur(w.dur):'')+'\n';
    for(const exId of workoutExerciseIds(w)){
      const sets=(w.ex[exId]||[]).filter(x=>x.done&&(x.w!=null||x.r!=null));
      const note=workoutNote(w,exId);
      if(!sets.length&&!note)continue;
      t+='  '+(workoutExercise(w,exId)?.name||exId)+' : '+sets.map(x=>(x.w!=null?fmtN(x.w):'—')+'×'+(x.r!=null?fmtN(x.r):'—')).join(' · ')+'\n';
      if(note)t+='    Ressenti : '+note+'\n';
    }
  }
  return t;
}
function doImport(){
  let incoming;
  try{
    const data=JSON.parse(document.getElementById('shArea').value);
    if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Format non reconnu');
    incoming={};
    if(data.programmes!=null)incoming.programs=DKO_DATA.programs(data.programmes);
    else if(data.programme!=null)incoming.programs=DKO_DATA.programs([{id:ACTIVE_PID,name:activeProgram()?.name||'Programme importé',seances:data.programme}]);
    if(incoming.programs&&!incoming.programs.length)throw new Error('Aucun programme dans la sauvegarde');
    let workouts=data.seances??data.workouts;
    if(workouts==null){
      const src=data.historique||data.logs||data,byKey=new Map();
      for(const [exId,entries] of Object.entries(src)){
        if(!EXO[exId]||!Array.isArray(entries))continue;
        for(const en of entries){
          if(!en||!en.d||!Array.isArray(en.s))throw new Error('Historique incomplet');
          const key=en.d+'|'+EXO[exId].seance;
          if(!byKey.has(key))byKey.set(key,{date:en.d,seance:EXO[exId].seance,dur:null,ex:{}});
          byKey.get(key).ex[exId]=en.s.map(x=>({w:x.w,r:x.r,done:true}));
        }
      }
      if(byKey.size)workouts=[...byKey.values()];
    }
    if(workouts!=null){
      if(!Array.isArray(workouts))throw new Error('Liste de séances invalide');
      incoming.workouts=workouts.map(w=>DKO_DATA.workout(w));
    }
    if(data.reglages!=null)incoming.settings=DKO_DATA.settings(data.reglages);
    if(data.bilan_forme!=null)incoming.body=DKO_DATA.body(data.bilan_forme);
    if(data.active!=null)incoming.active=DKO_DATA.workout(data.active,true);
    const sessions={...SEANCE},exercises={...EXO};
    for(const p of incoming.programs||[])for(const s of p.seances){sessions[s.id]=s;for(const e of s.ex)exercises[e.id]=e;}
    for(const w of incoming.workouts||[])snapshotMetadata(w,exercises,sessions);
    if(incoming.active)snapshotMetadata(incoming.active,exercises,sessions);
    incoming.activeId=incoming.programs?.some(p=>p.id===data.programme_actif)?data.programme_actif:incoming.programs?.[0]?.id;
    if(!incoming.programs&&!incoming.workouts&&!incoming.body&&!incoming.settings&&!incoming.active)throw new Error('Format non reconnu');
  }catch(e){toast('Import refusé : '+e.message);return;}
  const added=DKO_DATA.mergeWorkouts(DB.workouts,incoming.workouts||[]).length-DB.workouts.length;
  sheet.innerHTML='<h2>Vérifier la sauvegarde</h2>'
    +'<div class="sp">'+(incoming.workouts?.length||0)+' séances · '+(incoming.programs?.length||0)+' programmes · '+(incoming.body?.length||0)+' relevés corporels</div>'
    +'<p>Ajouter conserve tes données actuelles et ajoute '+added+' nouvelle'+(added>1?'s séances':' séance')+'. Les programmes déjà présents et tes réglages restent inchangés.</p>'
    +'<div class="sbtns"><button class="sbtn pri" id="importMerge">Ajouter à mes données</button></div>'
    +'<div class="sbtns"><button class="sbtn danger" id="importReplace">Remplacer mes données</button><button class="sbtn" id="importCancel">Annuler</button></div>';
  openSheet();
  document.getElementById('importCancel').addEventListener('click',closeSheet);
  document.getElementById('importMerge').addEventListener('click',()=>applyImport(incoming,false));
  document.getElementById('importReplace').addEventListener('click',()=>{
    if(window.confirm('Remplacer les données présentes dans ce fichier ? Les séances, programmes et mesures correspondants sur cet appareil seront remplacés.'))applyImport(incoming,true);
  });
}
async function applyImport(incoming,replace){
  if(sheet.dataset.importing==='1')return;
  sheet.dataset.importing='1';
  const buttons=[...sheet.querySelectorAll('button')];buttons.forEach(b=>{b.disabled=true});
  let before;
  try{
    const programs=replace&&incoming.programs?incoming.programs:PROGRAMS.concat((incoming.programs||[]).filter(p=>!PROGRAMS.some(current=>current.id===p.id)));
    // Reject collisions from different programs instead of silently overwriting exercise maps.
    const ids=new Set();
    for(const p of programs)for(const item of [p,...p.seances,...p.seances.flatMap(s=>s.ex)]){
      if(ids.has(item.id))throw new Error('Deux programmes utilisent le même identifiant');ids.add(item.id);
    }
    const workouts=(incoming.workouts?(replace?incoming.workouts:DKO_DATA.mergeWorkouts(DB.workouts,incoming.workouts)):DB.workouts).map(w=>snapshotWorkout(structuredClone(w)));
    const importedActive=incoming.active&&!workouts.some(w=>w.id&&w.id===incoming.active.id)?incoming.active:null;
    const candidate=replace&&incoming.workouts?importedActive||null:DB.active||importedActive||null;
    const active=candidate?snapshotWorkout(structuredClone(candidate)):null;
    if(active&&!programs.some(p=>p.seances.some(s=>s.id===active.seance)))throw new Error('Le programme de la séance en cours manque dans la sauvegarde');
    const activeSession=active&&programs.flatMap(p=>p.seances).find(s=>s.id===active.seance);
    if(activeSession&&Object.keys(active.ex).some(id=>!activeSession.ex.some(e=>e.id===id)&&!(active.exerciseOrder?.includes(id)&&active.exMeta?.[id])))throw new Error('La séance en cours ne correspond plus au programme. Restaure sa sauvegarde complète.');
    const body=incoming.body?(replace?incoming.body:BODY.concat(incoming.body.filter(b=>!BODY.some(current=>current.date===b.date)))):BODY;
    const settings=replace&&incoming.settings?{...SETTINGS,...incoming.settings}:SETTINGS;
    const activeId=replace&&incoming.programs?incoming.activeId:ACTIVE_PID;
    before=storageSnapshot();
    if(!await idbSet('before-import',before))throw new Error('Impossible de créer une sauvegarde de sécurité');
    const updates={
      [KEY_PROGRAMS]:JSON.stringify({programs,activeId}),
      [KEY]:JSON.stringify({workouts,active,migrated:true}),
      [KEY_BODY]:JSON.stringify(body.slice().sort((a,b)=>a.date.localeCompare(b.date))),
      [KEY_SETTINGS]:JSON.stringify(settings)
    };
    try{for(const [key,value] of Object.entries(updates))localStorage.setItem(key,value);}
    catch(error){
      for(const key of Object.keys(updates)){if(before.data[key]==null)localStorage.removeItem(key);else localStorage.setItem(key,before.data[key]);}
      throw error;
    }
    if(incoming.programs)window.DKOCoachUI?.restored();
    clearInterval(tInt);tInt=null;tbar.classList.remove('on','fin');releaseWake();
    loadProgram();DB=loadDB();SETTINGS=loadSettings();BODY=loadBody();
    applyTheme();closeSheet();go('home');
    const timer=DB.active?.restTimer;
    if(timer&&timer.end>Date.now())startTimer(timer.label,(timer.end-Date.now())/1000);
    await mirrorSnapshot();window.DKOCloudUI?.changed();toast(replace?'Sauvegarde restaurée':'Données ajoutées, historique conservé');
  }catch(e){toast('Import non effectué : '+e.message);}
  finally{delete sheet.dataset.importing;buttons.forEach(b=>{b.disabled=false});}
}

/* ================== SERVICE WORKER ================== */
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js?v='+APP_VERSION).then(reg=>{
      reg.addEventListener('updatefound',()=>{
        const nw=reg.installing;
        if(!nw)return;
        nw.addEventListener('statechange',()=>{
          if(nw.state==='installed'&&navigator.serviceWorker.controller)
            toast('Mise à jour disponible — rouvre l’app');
        });
      });
    }).catch(()=>{});
  });
}
window.addEventListener('online',()=>toast('Connexion revenue · mises à jour actives'));
window.addEventListener('offline',()=>toast('Hors ligne · suivi conservé sur cet appareil'));

function initDragSort(){
  let drag=null,pid=null,kind=null,cont=null;
  const onDown=e=>{
    const handle=e.target.closest('.grip');if(!handle)return;
    const item=handle.closest('[data-dragitem]');if(!item)return;
    cont=item.closest('[data-dragsort]');if(!cont)return;
    e.preventDefault();drag=item;pid=e.pointerId;kind=cont.dataset.dragsort;
    item.classList.add('dragging');try{item.setPointerCapture(pid)}catch(_){}
  };
  const onMove=e=>{
    if(!drag)return;e.preventDefault();
    drag.style.pointerEvents='none';
    const u=document.elementFromPoint(e.clientX,e.clientY);
    drag.style.pointerEvents='';
    if(!u)return;const over=u.closest('[data-dragitem]');
    if(!over||over===drag||over.parentNode!==cont)return;
    const r=over.getBoundingClientRect();
    cont.insertBefore(drag,((e.clientY-r.top)>r.height/2)?over.nextSibling:over);
  };
  const onUp=()=>{
    if(!drag)return;const d=drag,k=kind,c=cont;
    d.classList.remove('dragging');try{d.releasePointerCapture(pid)}catch(_){}
    d.style.pointerEvents='';drag=null;pid=null;kind=null;cont=null;
    if(k==='ex'){c.querySelectorAll('.ecard .en').forEach((el,i)=>{el.textContent='EXERCICE '+(i+1)});if(navigator.vibrate)navigator.vibrate(8);}
    else if(k==='seance'){const ids=[...c.querySelectorAll('[data-dragitem]')].map(el=>el.dataset.sid);const ap=activeProgram();if(ap){ap.seances.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));savePrograms();}if(navigator.vibrate)navigator.vibrate(8);render();}
  };
  app.addEventListener('pointerdown',onDown,{passive:false});
  app.addEventListener('pointermove',onMove,{passive:false});
  app.addEventListener('pointerup',onUp);
  app.addEventListener('pointercancel',onUp);
}
initDragSort();
maybeRestoreFromIDB().then(restored=>{
  if(restored){
    loadProgram();DB=loadDB();SETTINGS=loadSettings();BODY=loadBody();applyTheme();
  }
  DB.workouts.forEach(snapshotWorkout);
  if(DB.active)snapshotWorkout(DB.active);
  STORAGE_READY=true;savePrograms();persist();render();
  checkWorkoutTimeout();
  document.dispatchEvent(new Event('app:ready'));
  if(restored)toast('Données restaurées depuis la sauvegarde de secours');
  const timer=DB.active?.restTimer;
  if(timer&&timer.end>Date.now())startTimer(timer.label,(timer.end-Date.now())/1000);
  else if(timer){delete DB.active.restTimer;persist();}
  backupReminder();
  try{if(!localStorage.getItem('dako_onboarded'))showOnboarding()}catch(e){}
});

/* ================== SPLASH ================== */
(function(){
  const sp=document.getElementById('splash');
  if(!sp)return;
  const hide=()=>{sp.classList.add('hide');setTimeout(()=>{if(sp&&sp.parentNode)sp.parentNode.removeChild(sp)},600)};
  document.addEventListener('app:ready',hide,{once:true});
  setTimeout(hide,2000); /* filet de sécurité */
})();
