'use strict';
/* =====================================================
   Muscu — suivi d'entraînement
   v1.1.0 : récupération musculaire, séance recommandée,
   cibles automatiques par série, carte corporelle.
   ===================================================== */
const APP_VERSION='1.1.0';

/* ================== UTILITAIRES ================== */
function esc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function numOrNull(v){if(v==null)return null;const n=parseFloat(String(v).trim().replace(',','.'));return isNaN(n)?null:n}
function intOrNull(v){if(v==null)return null;const n=parseInt(String(v).trim(),10);return isNaN(n)?null:n}
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
 {id:'mollets',label:'Mollets',rec:48}
];
const MUSCLE_BY_ID={};MUSCLES.forEach(m=>MUSCLE_BY_ID[m.id]=m);
function normMuscle(tok){
  const t=String(tok||'').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[\s-]+/g,'_');
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
 {id:'j1e1',name:'Row appui poitrine unilatéral (neutre)',sets:3,reps:'8–10/bras',ref:77.6,unit:'kg/bras',
  musP:['dos'],musS:['biceps','delt_post'],
  yt:'chest supported row unilatéral machine technique',
  notes:'Prise neutre (paumes face à face), coude vers l’arrière et le haut, rétraction complète, pause 1s. Commencer par le bras GAUCHE, aligner le droit dessus. RIR 1 · négative 3s.'},
 {id:'j1e2',name:'Tirage triangle serré',sets:3,reps:'8–10',ref:86,unit:'kg',
  musP:['dos'],musS:['biceps'],
  yt:'tirage horizontal prise serrée triangle technique',
  notes:'Prise neutre serrée (triangle/V). Tirer vers le nombril, serrer les omoplates en fin, hold 1s. Charge de travail : 86, pas 92.'},
 {id:'j1e3',name:'Diverging seated row unilatéral',sets:3,reps:'8–10/bras',ref:107,unit:'kg',
  musP:['dos'],musS:['biceps'],
  yt:'diverging seated row machine unilatéral technique',
  notes:'PRISE NEUTRE (pouces face à face). Rotation du buste pour dégager le pad (cage profonde, pad gênant). Coude vers l’arrière, serrer l’omoplate, hold 1s. Rest-pause au plateau.'},
 {id:'j1e4',name:'Face pull corde',sets:3,reps:'10–12',ref:40,unit:'kg',
  musP:['delt_post'],musS:['dos'],
  yt:'face pull corde technique épaule',
  notes:'Mains vers le BAS. Coudes abaissés qui partent vers l’arrière, rotation des poignets en fin. Sortir le trapèze du mouvement.'},
 {id:'j1e5',name:'Rear delt fly câble poulies croisées',sets:3,reps:'10–12',ref:null,unit:'léger',
  musP:['delt_post'],musS:[],
  yt:'rear delt fly câble poulies croisées technique',
  notes:'Penché 70°, bras croisés quasi-tendus, arc vers l’arrière-extérieur, contraction 1s, épaules basses. Pas encore de référence : caler la charge.'}]},

{id:'j2',tab:'J2',title:'Pectoraux',sub:'Pectoraux',
 warn:'Au plafond matériel sur haltères (50) et Matrix (~123) : progresser via rest-pause / tempo.',ex:[
 {id:'j2e1',name:'Développé couché haltères',sets:3,reps:'8–10',ref:50,unit:'kg/bras',ceiling:'PLAFOND HALTÈRES',
  musP:['pecs'],musS:['triceps','delt_ant'],
  yt:'développé couché haltères technique',
  notes:'Réf : 10/8/7. Coudes à 70°, descendre à l’étirement, pousser sans verrouiller. Plafond haltères : progression en reps, puis tempo / rest-pause à 3×10. RIR 1 · négative 3s.'},
 {id:'j2e2',name:'Press Matrix',sets:3,reps:'8–10',ref:113,unit:'kg',ceiling:'PLAFOND ~123',
  musP:['pecs'],musS:['triceps','delt_ant'],
  yt:'chest press machine technique',
  notes:'Position n°2, complément du développé haltères. Dégressive sur la dernière série. Marge restante avant plafond (~123).'},
 {id:'j2e3',name:'Press incliné machine',sets:3,reps:'8–10',ref:50,unit:'kg',
  musP:['pecs'],musS:['delt_ant','triceps'],
  yt:'développé incliné machine technique',
  notes:'Haut des pecs. Incliné 30° max, ne pas verrouiller, étirement en bas.'},
 {id:'j2e4',name:'Pec fly câble allongé sur banc',sets:3,reps:'9–10',ref:15.8,unit:'kg/côté',
  musP:['pecs'],musS:[],
  yt:'pec fly câble allongé banc technique',
  notes:'Allongé entre les poulies : tension constante + étirement max. Flexion de coude fixe, refermer sans croiser.'},
 {id:'j2e5',name:'Câble croisé poulie haute',sets:3,reps:'10–12',ref:13.5,unit:'kg/côté',
  musP:['pecs'],musS:[],
  yt:'cable crossover poulie haute pectoraux technique',
  notes:'Mouvement d’arc, coudes fixes. Croiser les mains en bas, pic de contraction 1s. Bas/externe des pecs.'}]},

{id:'j3',tab:'J3',title:'Épaules + triceps',sub:'Latéral prioritaire',
 warn:'Latéraux : léger et strict. Press épaules : surveiller le tendon GAUCHE, stop si douleur tendineuse.',ex:[
 {id:'j3e1',name:'Élévation latérale unilatérale câble (poulie bassin)',sets:3,reps:'10–12',ref:11.3,unit:'kg',
  musP:['delt_lat'],musS:[],
  yt:'élévation latérale câble unilatéral technique',
  notes:'EXERCICE CLÉ. Poulie au bassin, penché léger côté opposé. Buste stable, pas d’élan, iso 2s. Léger et strict. Commencer par le gauche.'},
 {id:'j3e2',name:'Élévation latérale haltère lean-away',sets:3,reps:'10–12',ref:null,unit:'très léger',
  musP:['delt_lat'],musS:[],
  yt:'lean away lateral raise haltère technique',
  notes:'Résistance max en haut. Anti-trapèze : épaule basse, initier au coude, stop à l’horizontale. Si le trapèze domine, repasser au câble.'},
 {id:'j3e3',name:'Press épaules machine',sets:3,reps:'8–10',ref:101,unit:'kg',ceiling:'REPS UNIQUEMENT',
  musP:['delt_ant','delt_lat'],musS:['triceps'],
  yt:'développé épaules machine technique',
  notes:'Tendon gauche surveillé : progresser en REPS uniquement (viser 8) avant toute montée de charge. Fait avant les triceps. RIR 2.'},
 {id:'j3e4',name:'Pushdown barre',sets:3,reps:'8–10',ref:41,unit:'kg',
  musP:['triceps'],musS:[],
  yt:'pushdown triceps barre technique',
  notes:'Coudes fixes au corps, verrouillage complet. Dégressive sur la DERNIÈRE série uniquement.'},
 {id:'j3e5',name:'Overhead triceps corde',sets:3,reps:'10–12',ref:22.6,unit:'kg',
  musP:['triceps'],musS:[],
  yt:'extension triceps overhead corde technique',
  notes:'Tête longue. Corde au-dessus de la tête, coudes au plafond et fixes, extension vers le haut, étirement en bas.'}]},

{id:'j4',tab:'J4',title:'Dos largeur + biceps',sub:'Dos · Biceps',
 warn:'Unilatéral : commencer par le bras gauche, aligner le droit dessus.',ex:[
 {id:'j4e1',name:'Tirage vertical barre pronation',sets:3,reps:'7–8',ref:127,unit:'kg',
  musP:['dos'],musS:['biceps'],
  yt:'tirage vertical poitrine prise large technique',
  notes:'Composé vertical lourd. Prise large, tirer vers la clavicule, coudes vers les hanches, étirement complet en haut. RIR 1 · négative 3s.'},
 {id:'j4e2',name:'Tirage vertical unilatéral câble (banc assis)',sets:3,reps:'8–10/côté',ref:50,unit:'kg',
  musP:['dos'],musS:['biceps'],
  yt:'tirage vertical unilatéral câble technique',
  notes:'Assis sur banc, penché léger côté opposé pour étirer le lat. Tirer le coude vers la hanche. Commencer par le gauche.'},
 {id:'j4e3',name:'Pull-over câble (finisher)',sets:2,reps:'10–12',ref:27,unit:'kg',
  musP:['dos'],musS:[],
  yt:'pull over câble debout dos technique',
  notes:'Finisher 2 séries. Bras quasi-tendus, étirement du lat en haut, tirer vers les hanches. Léger, sensation. Skip si dos en compote.'},
 {id:'j4e4',name:'Curl alterné haltère',sets:3,reps:'7–8',ref:24,unit:'kg/bras',
  musP:['biceps'],musS:['avant_bras'],
  yt:'curl alterné haltères technique',
  notes:'Supination complète en haut, coudes fixes, pas de balancement. Frais = 24, post-dos plutôt 22.'},
 {id:'j4e5',name:'Curl pupitre Matrix unilatéral',sets:3,reps:'8–10/bras',ref:45,unit:'kg/bras',
  musP:['biceps'],musS:[],
  yt:'curl pupitre machine technique',
  notes:'Bras sur le pad, négative 3s, pause 1s en bas.'}]},

{id:'j5',tab:'J5',title:'Postérieur + latéral + bras',sub:'Postérieur · Bras',
 warn:'Poignet gauche : stop curls si fourmillements (canal carpien). Dips : coudes à 90° max en bas.',ex:[
 {id:'j5e1',name:'Rear delt fly haltères penché',sets:4,reps:'10–12',ref:10,unit:'kg',
  musP:['delt_post'],musS:[],
  yt:'rear delt fly haltères penché technique',
  notes:'Buste quasi-parallèle au sol (se pencher FRANCHEMENT), bras quasi-tendus, arc sur les côtés, épaules basses. Léger-strict.'},
 {id:'j5e2',name:'Curl marteau haltères',sets:3,reps:'8–10',ref:24,unit:'kg/main',
  musP:['biceps'],musS:['avant_bras'],
  yt:'curl marteau haltères technique',
  notes:'En calibrage : montera vite. Prise neutre, coudes fixes, contrôle à la descente. Vigilance canal carpien gauche : fourmillements = stop, retour corde.'},
 {id:'j5e3',name:'Élévation latérale câble',sets:3,reps:'10–12',ref:11.3,unit:'kg',
  musP:['delt_lat'],musS:[],
  yt:'élévation latérale câble technique',
  notes:'Tempo 3s à la descente. Poulie bassin, penché léger, buste stable, pas d’élan. Tension > charge.'},
 {id:'j5e4',name:'Overhead triceps',sets:3,reps:'10–12',ref:22.6,unit:'kg',
  musP:['triceps'],musS:[],
  yt:'extension triceps overhead corde technique',
  notes:'2e passage tête longue. Coudes au plafond fixes, étirement max.'},
 {id:'j5e5',name:'Dips machine Matrix',sets:3,reps:'8',refText:'max + 20 + 2×2,3 + 1,2 + 2×2,3',ceiling:'PLAFOND ABSOLU',
  musP:['triceps'],musS:['pecs'],
  yt:'dips machine assistée technique triceps',
  notes:'Charge max machine + 20 kg + 2×2,3 + 1,2 + 2×2,3. Progression reps / rest-pause uniquement (viser 10–12). Coudes à 90° MAX en bas (épaule). Négative 3s.'}]},

{id:'j6',tab:'J6',title:'Jambes — reprise adaptée',sub:'Jambes',
 warn:'Sciatique : pas de compression axiale, dos soutenu. Démarrage léger et progressif.',ex:[
 {id:'j6e1',name:'Presse à cuisses',sets:3,reps:'10–12',ref:null,unit:'léger',
  musP:['quadriceps','fessiers'],musS:['ischios'],
  yt:'presse à cuisses technique',
  notes:'Dos calé contre le dossier. Amplitude contrôlée, ne pas verrouiller les genoux. Démarrer léger, monter progressivement.'},
 {id:'j6e2',name:'Leg extension',sets:3,reps:'12–15',ref:null,unit:'léger',
  musP:['quadriceps'],musS:[],
  yt:'leg extension technique',
  notes:'Quadriceps isolé. Contraction 1s en haut, descente contrôlée.'},
 {id:'j6e3',name:'Leg curl',sets:3,reps:'12–15',ref:null,unit:'léger',
  musP:['ischios'],musS:[],
  yt:'leg curl assis technique',
  notes:'Ischios. Amplitude complète, contraction en fin de mouvement.'},
 {id:'j6e4',name:'Mollets machine squat guidé',sets:3,reps:'12–15',ref:null,unit:'progressif',
  musP:['mollets'],musS:[],
  yt:'mollets debout smith machine technique',
  notes:'Amplitude complète avec étirement en bas, pas de rebond. Charge progressive (antécédents mollets : entorse droite, accident gauche).'}]}
];
const DEFAULT_EX={};
for(const s of DEFAULT_PROGRAM)for(const e of s.ex)DEFAULT_EX[e.id]=e;

/* ================== PROGRAMME (custom ou défaut) ================== */
const KEY_PROGRAM='muscu_program';
let PROGRAM,SEANCE={},EXO={};
function loadProgram(){
  let p=null;
  try{p=JSON.parse(localStorage.getItem(KEY_PROGRAM))}catch(e){}
  PROGRAM=(Array.isArray(p)&&p.length)?p:JSON.parse(JSON.stringify(DEFAULT_PROGRAM));
  /* rétro-compatibilité : compléter les muscles depuis le programme par défaut */
  for(const s of PROGRAM)for(const e of (s.ex||[])){
    if(!Array.isArray(e.musP)&&DEFAULT_EX[e.id]){e.musP=DEFAULT_EX[e.id].musP.slice();e.musS=DEFAULT_EX[e.id].musS.slice()}
    if(!Array.isArray(e.musP))e.musP=[];
    if(!Array.isArray(e.musS))e.musS=[];
  }
  buildMaps();
}
function buildMaps(){
  SEANCE={};EXO={};
  for(const s of PROGRAM){SEANCE[s.id]=s;for(const e of (s.ex||[]))EXO[e.id]=Object.assign({seance:s.id},e);}
}
function saveProgram(){try{localStorage.setItem(KEY_PROGRAM,JSON.stringify(PROGRAM))}catch(e){};buildMaps()}
function resetProgram(){try{localStorage.removeItem(KEY_PROGRAM)}catch(e){};loadProgram()}
function isCustomProgram(){try{return !!localStorage.getItem(KEY_PROGRAM)}catch(e){return false}}

/* ================== RÉGLAGES ================== */
const KEY_SETTINGS='muscu_settings';
let SETTINGS=loadSettings();
function loadSettings(){
  let s=null;
  try{s=JSON.parse(localStorage.getItem(KEY_SETTINGS))}catch(e){}
  if(!s||typeof s!=='object')s={};
  return{rest:[90,120,180,240].includes(s.rest)?s.rest:180,poids:numOrNull(s.poids)||PROFILE.poids_kg};
}
function saveSettings(){try{localStorage.setItem(KEY_SETTINGS,JSON.stringify(SETTINGS))}catch(e){}}

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
            byKey[k].ex[exId]=en.s.map(x=>({w:numOrNull(x.w),r:intOrNull(x.r),done:true}));
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
function persist(){try{localStorage.setItem(KEY,JSON.stringify(DB))}catch(e){}}

/* requêtes */
function lastWorkoutOf(seanceId){const a=DB.workouts.filter(w=>w.seance===seanceId);return a.length?a[a.length-1]:null}
function exHistory(exId){
  const out=[];
  for(const w of DB.workouts){
    if(!w.ex||!w.ex[exId])continue;
    const sets=w.ex[exId].filter(s=>s.done&&(s.w!=null||s.r!=null));
    if(sets.length)out.push({date:w.date,sets});
  }
  return out;
}
function prevSets(exId){const h=exHistory(exId);return h.length?h[h.length-1].sets:null}
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
      const e=EXO[exId];if(!e)continue;
      const sets=w.ex[exId].filter(s=>s.done).length;
      if((e.musP||[]).includes(mid))load+=sets;
      else if((e.musS||[]).includes(mid))load+=sets*0.5;
    }
    if(load)f+=Math.min(1,load/6)*(1-ageH/rec);
  }
  if(DB.active){
    let load=0;
    for(const exId in DB.active.ex){
      const e=EXO[exId];if(!e)continue;
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
  const m=String(str||'').match(/\d+/g)||[];
  const lo=m.length?+m[0]:8;
  return[lo,m.length>1?+m[1]:lo];
}
function wInc(w){return w>=60?2.5:w>=20?2:w>=10?1:0.5}
function suggestTargets(e){
  const[lo,hi]=repsRange(e.reps);
  const prev=prevSets(e.id);
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
      out.push({w:Math.round((p.w+wInc(p.w))*10)/10,r:lo});
    }else{
      out.push({w:p.w,r:Math.min(p.r+1,hi)});
    }
  }
  return out;
}

/* ================== ROUTAGE / RENDU ================== */
const app=document.getElementById('app');
let route={view:'home',seance:null};
function go(view,seance){route={view,seance:seance||null};render();window.scrollTo({top:0});}

function render(){
  const tabFor={home:'home',seance:'home',edit:'home',history:'history',stats:'stats'};
  document.querySelectorAll('.tabbtn').forEach(b=>
    b.classList.toggle('on',b.dataset.v===tabFor[route.view]));
  if(route.view==='home')app.innerHTML=homeHTML();
  else if(route.view==='seance')app.innerHTML=seanceHTML(route.seance);
  else if(route.view==='edit')app.innerHTML=editHTML(route.seance);
  else if(route.view==='stats')app.innerHTML=statsHTML();
  else app.innerHTML=historyHTML();
}

/* ---------- accueil ---------- */
function homeHTML(){
  const ws=weekStart(new Date());
  const wIso=isoOf(ws);
  const weekW=DB.workouts.filter(w=>w.date>=wIso);
  let weekVol=0;weekW.forEach(w=>{weekVol+=workoutStats(w).vol});
  const reco=recommendSeance();
  let h='<div class="top"><h1>Muscu</h1><div class="hbtns">'
   +'<button class="hbtn" data-act="settings">Réglages</button>'
   +'<button class="hbtn" data-act="data">Données</button></div></div>'
   +'<div class="subdate">'+new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+'</div>'
   +'<div class="weekline num">Cette semaine : '+weekW.length+' séance'+(weekW.length>1?'s':'')
   +(weekVol?' · '+fmtKg(weekVol)+' kg':'')+'</div>';
  if(DB.active){
    const s=SEANCE[DB.active.seance];
    if(s)h+='<button class="resume" data-act="open" data-s="'+esc(s.id)+'"><span>'+(DB.active.ps?'Séance en pause':'Séance en cours')+' · '+esc(s.tab)
      +'<small>'+esc(s.title)+'</small></span><span class="num" id="elapsed">'+elapsedStr()+'</span></button>';
  }
  for(const s of PROGRAM){
    const last=lastWorkoutOf(s.id);
    const isReco=reco&&reco.id===s.id;
    h+='<button class="scard'+(isReco?' reco':'')+'" data-act="open" data-s="'+esc(s.id)+'">'
     +'<div class="srow"><span class="stag">'+esc(s.tab)
     +(isReco?'<span class="recobadge">RECOMMANDÉE</span>':'')
     +'</span><span class="slast">'+(last?daysAgo(last.date):'jamais réalisée')+'</span></div>'
     +'<div class="sname">'+esc(s.title)+'</div>'
     +'<div class="smeta">'+s.ex.length+' exercices · '+esc(s.sub||'')
     +(isReco?' · <span class="num">récup. '+reco.score+' %</span>':'')
     +'</div></button>';
  }
  return h;
}

/* ---------- séance ---------- */
function seanceHTML(sid){
  const s=SEANCE[sid];
  if(!s)return homeHTML();
  const active=DB.active&&DB.active.seance===sid?DB.active:null;
  let h='<button class="back" data-act="home">‹ Séances</button>'
   +'<div class="shead"><div><div class="stag">'+esc(s.tab)+'</div><h2>'+esc(s.title)+'</h2>'
   +'<div class="smeta">'+s.ex.length+' exercices · repos '+fmtT(SETTINGS.rest)
   +' · <span class="num">récup. '+seanceRecoveryScore(s)+' %</span></div></div>'
   +(active?'':'<button class="editbtn" data-act="edit">Modifier</button>')+'</div>';
  if(active){
    const p=sessionProgress(active);
    const paused=!!active.ps;
    h+='<div class="livebar"><div><div class="lt'+(paused?' paused':'')+'">'+(paused?'EN PAUSE':'SÉANCE EN COURS')+'</div>'
     +'<div class="num" id="elapsed">'+elapsedStr()+'</div></div>'
     +'<div class="lbtns"><button class="pausebtn" data-act="pause">'+(paused?'Reprendre':'Pause')+'</button>'
     +'<button class="finish" data-act="finish">Terminer</button></div></div>'
     +'<div class="pmeta"><span>Progression</span><span class="num" id="pdone">'+p.done+' / '+p.total+' séries</span></div>'
     +'<div class="pbar"><i id="pfill" style="width:'+(p.total?Math.round(100*p.done/p.total):0)+'%"></i></div>';
  }else{
    h+='<button class="bigbtn" data-act="start">Démarrer la séance</button>';
  }
  s.ex.forEach((e,i)=>{h+=exCardHTML(e,i,active)});
  if(s.warn)h+='<div class="pwarn">'+esc(s.warn)+'</div>';
  if(active)h+='<button class="bigbtn" data-act="finish" style="margin-top:16px">Terminer la séance</button>'
    +'<button class="bigbtn ghost" data-act="cancel">Annuler la séance</button>';
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
   +'<div class="cmeta">'+ref+'<span class="target num">'+e.sets+' × '+esc(e.reps)+'</span></div>'
   +(e.notes?'<details><summary>Notes</summary><div class="notes">'+esc(e.notes)+'</div></details>':'')
   +'<a class="vlink" href="'+ytURL(e)+'" target="_blank" rel="noopener">Vidéo technique</a>';
  if(active){
    const sets=active.ex[e.id]||[];
    const targets=suggestTargets(e);
    h+='<div class="stable"><div class="sthead"><span>SÉRIE</span><span>CIBLE</span><span>KG</span><span>REPS</span><span>✓</span></div>';
    sets.forEach((st,i)=>{h+=setRowHTML(e,i,st,targets)});
    h+='</div><button class="addset" data-act="addset">+ série</button>';
  }
  h+='<details class="dprog"><summary>Progression</summary><div class="hist">'+progHTML(e)+'</div></details></div>';
  return h;
}
function setRowHTML(e,i,st,targets){
  const t=targets&&targets[i]?targets[i]:null;
  const ttxt=t?((t.w!=null?fmtN(t.w):'—')+' × '+(t.r!=null?t.r:'—')):'—';
  const phW=t&&t.w!=null?fmtN(t.w):'kg';
  const phR=t&&t.r!=null?String(t.r):'reps';
  return '<div class="strow'+(st.done?' done':'')+'" data-i="'+i+'">'
   +'<span class="sn num">'+(i+1)+'</span>'
   +'<span class="prev num">'+ttxt+'</span>'
   +'<input class="w num" type="text" inputmode="decimal" placeholder="'+esc(phW)+'" value="'+(st.w==null?'':fmtN(st.w))+'">'
   +'<input class="r num" type="text" inputmode="numeric" placeholder="'+esc(phR)+'" value="'+(st.r==null?'':st.r)+'">'
   +'<button class="chk" data-act="chk"><svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg></button>'
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
     +'<span class="hsets num">'+en.sets.map(s=>(s.w!=null?fmtN(s.w):'—')+'×'+(s.r!=null?s.r:'—')).join(' · ')+'</span></div>';
  }
  return out;
}

/* ---------- historique ---------- */
function historyHTML(){
  let h='<div class="top"><h1>Historique</h1><div class="hbtns"><button class="hbtn" data-act="data">Données</button></div></div>';
  const arr=DB.workouts.slice().reverse();
  if(!arr.length)return h+'<div class="empty">Aucune séance terminée.<br>Démarre une séance dans l’onglet Entraîner.</div>';
  const tot=arr.length;
  h+='<div class="subdate">'+tot+' séance'+(tot>1?'s':'')+' enregistrée'+(tot>1?'s':'')+'</div>';
  arr.forEach(w=>{
    const s=SEANCE[w.seance];const st=workoutStats(w);
    let det='';
    for(const exId in (w.ex||{})){
      const sets=w.ex[exId].filter(x=>x.done&&(x.w!=null||x.r!=null));
      if(!sets.length)continue;
      det+='<div class="hxrow"><span class="hxname">'+esc(EXO[exId]?EXO[exId].name:exId)+'</span>'
       +'<span class="hxsets num">'+sets.map(x=>(x.w!=null?fmtN(x.w):'—')+'×'+(x.r!=null?x.r:'—')).join(' · ')+'</span></div>';
    }
    h+='<div class="hcard"><details><summary><div style="width:100%">'
     +'<div class="htop"><span class="htag">'+esc(s?s.tab:'')+'</span><span class="hwdate">'+fmtDateShort(w.date)+'</span></div>'
     +'<div class="hname">'+esc(s?s.title:w.seance)+'</div>'
     +'<div class="hstats">'
     +(w.dur?'<div class="hstat"><div class="v num">'+fmtDur(w.dur)+'</div><div class="l">Durée</div></div>':'')
     +'<div class="hstat"><div class="v num">'+fmtKg(st.vol)+' kg</div><div class="l">Tonnage</div></div>'
     +'<div class="hstat"><div class="v num">'+st.sets+'</div><div class="l">Séries</div></div>'
     +'</div></div></summary><div class="hdetail">'+det+'</div></details></div>';
  });
  return h;
}

/* ---------- carte corporelle ---------- */
function bodySkeleton(){
  /* silhouette stylisée commune (face / dos) */
  return '<circle class="skel" cx="60" cy="15" r="10"/>'
   +'<rect class="skel" x="38" y="28" width="44" height="64" rx="11"/>'
   +'<rect class="skel" x="42" y="90" width="36" height="32" rx="9"/>'
   +'<rect class="skel" x="24" y="32" width="11" height="62" rx="5.5"/>'
   +'<rect class="skel" x="85" y="32" width="11" height="62" rx="5.5"/>'
   +'<rect class="skel" x="43" y="118" width="15" height="86" rx="7"/>'
   +'<rect class="skel" x="62" y="118" width="15" height="86" rx="7"/>';
}
function zone(shape,mid){
  const f=muscleFatigue(mid);
  const op=(0.08+0.84*f).toFixed(2);
  return shape.replace('/>',' fill-opacity="'+op+'"/>');
}
function bodyMapHTML(){
  const front=bodySkeleton()
   +zone('<ellipse class="zone" cx="33" cy="38" rx="7" ry="7"/>','delt_lat')
   +zone('<ellipse class="zone" cx="87" cy="38" rx="7" ry="7"/>','delt_lat')
   +zone('<ellipse class="zone" cx="42" cy="44" rx="4" ry="5"/>','delt_ant')
   +zone('<ellipse class="zone" cx="78" cy="44" rx="4" ry="5"/>','delt_ant')
   +zone('<ellipse class="zone" cx="50" cy="52" rx="10.5" ry="9"/>','pecs')
   +zone('<ellipse class="zone" cx="70" cy="52" rx="10.5" ry="9"/>','pecs')
   +zone('<rect class="zone" x="25" y="48" width="9" height="20" rx="4.5"/>','biceps')
   +zone('<rect class="zone" x="86" y="48" width="9" height="20" rx="4.5"/>','biceps')
   +zone('<rect class="zone" x="24" y="72" width="8" height="20" rx="4"/>','avant_bras')
   +zone('<rect class="zone" x="88" y="72" width="8" height="20" rx="4"/>','avant_bras')
   +zone('<rect class="zone" x="44" y="122" width="13" height="44" rx="6"/>','quadriceps')
   +zone('<rect class="zone" x="63" y="122" width="13" height="44" rx="6"/>','quadriceps');
  const back=bodySkeleton()
   +zone('<ellipse class="zone" cx="33" cy="38" rx="7" ry="7"/>','delt_post')
   +zone('<ellipse class="zone" cx="87" cy="38" rx="7" ry="7"/>','delt_post')
   +zone('<path class="zone" d="M44 40 L76 40 L72 78 Q60 84 48 78 Z"/>','dos')
   +zone('<rect class="zone" x="25" y="48" width="9" height="20" rx="4.5"/>','triceps')
   +zone('<rect class="zone" x="86" y="48" width="9" height="20" rx="4.5"/>','triceps')
   +zone('<ellipse class="zone" cx="51" cy="108" rx="9" ry="9"/>','fessiers')
   +zone('<ellipse class="zone" cx="69" cy="108" rx="9" ry="9"/>','fessiers')
   +zone('<rect class="zone" x="44" y="124" width="13" height="36" rx="6"/>','ischios')
   +zone('<rect class="zone" x="63" y="124" width="13" height="36" rx="6"/>','ischios')
   +zone('<rect class="zone" x="45" y="168" width="11" height="28" rx="5.5"/>','mollets')
   +zone('<rect class="zone" x="64" y="168" width="11" height="28" rx="5.5"/>','mollets');
  let bars='';
  const list=MUSCLES.map(m=>({m,rec:muscleRecovery(m.id)})).sort((a,b)=>a.rec-b.rec);
  for(const x of list){
    bars+='<div class="musrow"><span class="musl">'+esc(x.m.label)+'</span>'
     +'<div class="musbar"><i style="width:'+x.rec+'%"></i></div>'
     +'<span class="musv num">'+x.rec+' %</span></div>';
  }
  return '<div class="chartcard"><div class="charttitle">Récupération musculaire</div>'
   +'<div class="bodymaps">'
   +'<div class="bmap"><svg viewBox="0 0 120 210">'+front+'</svg><div class="bcap">Face</div></div>'
   +'<div class="bmap"><svg viewBox="0 0 120 210">'+back+'</svg><div class="bcap">Dos</div></div>'
   +'</div>'
   +'<div class="maplegend">Zone claire = muscle en récupération · % = niveau de fraîcheur</div>'
   +bars+'</div>';
}

/* ---------- stats ---------- */
function statsHTML(){
  let h='<div class="top"><h1>Stats</h1><div class="hbtns"><button class="hbtn" data-act="data">Données</button></div></div>';
  if(!DB.workouts.length)return h+'<div class="empty">Pas encore de données.<br>Les statistiques apparaîtront après ta première séance.</div>';
  const now=new Date();
  const mIso=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-01';
  const month=DB.workouts.filter(w=>w.date>=mIso).length;
  const wIso=isoOf(weekStart(now));
  let weekVol=0;DB.workouts.filter(w=>w.date>=wIso).forEach(w=>{weekVol+=workoutStats(w).vol});
  h+='<div class="subdate">Depuis le '+fmtDateShort(DB.workouts[0].date)+'</div>'
   +'<div class="statgrid">'
   +'<div class="statbox"><div class="v num">'+DB.workouts.length+'</div><div class="l">Séances</div></div>'
   +'<div class="statbox"><div class="v num">'+month+'</div><div class="l">Ce mois</div></div>'
   +'<div class="statbox"><div class="v num">'+fmtKg(weekVol)+'</div><div class="l">kg · semaine</div></div>'
   +'</div>';
  h+=bodyMapHTML();
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
  return h;
}

/* ---------- éditeur de programme ---------- */
function editExHTML(e,i){
  const refStr=e.refText?e.refText:(e.ref!=null?fmtN(e.ref):'');
  return '<div class="ecard" data-exid="'+esc(e.id||'')+'">'
   +'<div class="ehead"><span class="en num">EXERCICE '+(i+1)+'</span>'
   +'<div class="ebtns"><button class="ebtn" data-act="eup" title="Monter">↑</button>'
   +'<button class="ebtn" data-act="edown" title="Descendre">↓</button>'
   +'<button class="ebtn" data-act="edel" title="Supprimer">✕</button></div></div>'
   +'<div class="efield"><label>Nom</label><input class="e-name" value="'+esc(e.name||'')+'"></div>'
   +'<div class="egrid3">'
   +'<div class="efield"><label>Charge réf.</label><input class="e-ref num" inputmode="decimal" value="'+esc(refStr)+'"></div>'
   +'<div class="efield"><label>Unité</label><input class="e-unit" value="'+esc(e.unit||'kg')+'"></div>'
   +'<div class="efield"><label>Séries</label><input class="e-sets num" inputmode="numeric" value="'+(e.sets||3)+'"></div>'
   +'</div>'
   +'<div class="egrid">'
   +'<div class="efield"><label>Reps cible</label><input class="e-reps" value="'+esc(e.reps||'8–10')+'"></div>'
   +'<div class="efield"><label>Badge (plafond…)</label><input class="e-ceiling" value="'+esc(e.ceiling||'')+'"></div>'
   +'</div>'
   +'<div class="egrid">'
   +'<div class="efield"><label>Muscles principaux</label><input class="e-musp" placeholder="ex : dos, biceps" value="'+esc((e.musP||[]).join(', '))+'"></div>'
   +'<div class="efield"><label>Muscles secondaires</label><input class="e-muss" placeholder="ex : triceps" value="'+esc((e.musS||[]).join(', '))+'"></div>'
   +'</div>'
   +'<div class="efield"><label>Recherche vidéo YouTube</label><input class="e-yt" value="'+esc(e.yt||'')+'"></div>'
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
   +'</div>'
   +'<div class="maplegend" style="margin:0 4px 12px">Muscles reconnus : '+MUSCLES.map(m=>m.id).join(', ')+'</div>'
   +'<div id="exlist">';
  s.ex.forEach((e,i)=>{h+=editExHTML(e,i)});
  h+='</div><button class="bigbtn ghost" data-act="eadd">+ Ajouter un exercice</button>'
   +'<button class="bigbtn" data-act="esave">Enregistrer</button>';
  return h;
}
function collectEdit(sid){
  const s=SEANCE[sid];
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
    if(ceil)e.ceiling=ceil;
    ex.push(e);
  });
  if(!ex.length){toast('Au moins un exercice requis');return false}
  s.title=title||s.title;s.tab=tab||s.tab;s.sub=sub;s.warn=warn;s.ex=ex;
  saveProgram();
  return true;
}

/* ================== SÉANCE ACTIVE ================== */
function startWorkout(sid){
  if(DB.active&&DB.active.seance!==sid){
    if(!window.confirm('Une séance '+(SEANCE[DB.active.seance]?SEANCE[DB.active.seance].tab:'')+' est en cours. L’abandonner ?'))return;
  }
  const ex={};
  for(const e of SEANCE[sid].ex){
    ex[e.id]=[];
    for(let i=0;i<e.sets;i++)ex[e.id].push({w:null,r:null,done:false});
  }
  DB.active={seance:sid,date:todayISO(),start:Date.now(),pt:0,ps:null,ex};
  persist();render();
}
function elapsedStr(){
  const a=DB.active;if(!a)return '';
  const end=a.ps||Date.now();
  const s=Math.max(0,Math.floor((end-a.start-(a.pt||0))/1000));
  return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
}
function togglePause(){
  const a=DB.active;if(!a)return;
  if(a.ps){a.pt=(a.pt||0)+(Date.now()-a.ps);a.ps=null}
  else a.ps=Date.now();
  persist();render();
}
setInterval(()=>{const el=document.getElementById('elapsed');if(el&&DB.active)el.textContent=elapsedStr()},1000);
function updateProgress(){
  if(!DB.active)return;
  const p=sessionProgress(DB.active);
  const pd=document.getElementById('pdone'),pf=document.getElementById('pfill');
  if(pd)pd.textContent=p.done+' / '+p.total+' séries';
  if(pf)pf.style.width=(p.total?Math.round(100*p.done/p.total):0)+'%';
}
function finishWorkout(){
  const a=DB.active;if(!a)return;
  const stats=workoutStats(a);
  if(!stats.sets){toast('Aucune série validée');return}
  const recs=[];
  for(const exId in a.ex){
    const m=maxW(a.ex[exId].filter(s=>s.done));
    if(m==null)continue;
    const prev=bestEver(exId);
    if(prev==null||m>prev)recs.push({name:EXO[exId]?EXO[exId].name:exId,w:m,prev});
  }
  const endRef=a.ps||Date.now();
  const dur=Math.max(0,Math.round((endRef-a.start-(a.pt||0))/1000));
  const ex={};
  for(const exId in a.ex){
    const sets=a.ex[exId].filter(s=>s.done&&(s.w!=null||s.r!=null)).map(s=>({w:s.w,r:s.r,done:true}));
    if(sets.length)ex[exId]=sets;
  }
  DB.workouts.push({date:a.date,seance:a.seance,dur,ex});
  DB.workouts.sort((x,y)=>x.date<y.date?-1:1);
  DB.active=null;persist();
  stopTimer();
  showSummary({seance:a.seance,dur,stats,recs});
  go('home');
}
function cancelWorkout(){
  if(!window.confirm('Annuler la séance en cours ? Les saisies seront perdues.'))return;
  DB.active=null;persist();stopTimer();go('home');
}

/* ================== ÉVÉNEMENTS ================== */
document.getElementById('tabbar').addEventListener('click',ev=>{
  const b=ev.target.closest('.tabbtn');if(!b)return;
  go(b.dataset.v);
});
app.addEventListener('click',ev=>{
  const actEl=ev.target.closest('[data-act]');
  if(!actEl)return;
  const act=actEl.dataset.act;
  if(act==='home')go('home');
  else if(act==='open')go('seance',actEl.dataset.s);
  else if(act==='openback')go('seance',actEl.dataset.s);
  else if(act==='start')startWorkout(route.seance);
  else if(act==='finish')finishWorkout();
  else if(act==='cancel')cancelWorkout();
  else if(act==='pause')togglePause();
  else if(act==='data')showData();
  else if(act==='settings')showSettings();
  else if(act==='edit')go('edit',route.seance);
  else if(act==='esave'){if(collectEdit(route.seance)){toast('Séance enregistrée');go('seance',route.seance)}}
  else if(act==='eadd'){
    const list=document.getElementById('exlist');
    const n=list.querySelectorAll('.ecard').length;
    list.insertAdjacentHTML('beforeend',editExHTML({name:'',sets:3,reps:'8–10',unit:'kg',ref:null,notes:'',yt:'',musP:[],musS:[]},n));
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
    const e=EXO[exId];
    card.querySelector('.stable').insertAdjacentHTML('beforeend',
      setRowHTML(e,i,{w:null,r:null,done:false},e?suggestTargets(e):null));
    card.classList.remove('complete');
    updateProgress();
  }
  else if(act==='chk'){
    const row=actEl.closest('.strow');const card=actEl.closest('.card');
    const exId=card.dataset.ex,i=+row.dataset.i;
    if(!DB.active||!DB.active.ex[exId])return;
    const st=DB.active.ex[exId][i];
    if(!st.done){
      let w=numOrNull(row.querySelector('.w').value);
      let r=intOrNull(row.querySelector('.r').value);
      const e=EXO[exId];
      const t=e?suggestTargets(e)[i]:null;
      if(w==null&&t&&t.w!=null){w=t.w;row.querySelector('.w').value=fmtN(w)}
      if(r==null&&t&&t.r!=null){r=t.r;row.querySelector('.r').value=r}
      st.w=w;st.r=r;st.done=true;
      row.classList.add('done');
      if(navigator.vibrate)navigator.vibrate(10);
      startTimer(e?e.name:'Repos');
    }else{
      st.done=false;row.classList.remove('done');
    }
    persist();
    card.classList.toggle('complete',DB.active.ex[exId].every(s=>s.done));
    updateProgress();
    const prog=card.querySelector('.dprog .hist');if(prog&&EXO[exId])prog.innerHTML=progHTML(EXO[exId]);
  }
});
app.addEventListener('input',ev=>{
  const row=ev.target.closest('.strow');if(!row||!ev.target.matches('input'))return;
  const card=row.closest('.card');const exId=card.dataset.ex,i=+row.dataset.i;
  if(!DB.active||!DB.active.ex[exId]||!DB.active.ex[exId][i])return;
  const st=DB.active.ex[exId][i];
  st.w=numOrNull(row.querySelector('.w').value);
  st.r=intOrNull(row.querySelector('.r').value);
  persist();
});

/* ================== MINUTEUR DE REPOS ================== */
const tbar=document.getElementById('timerbar'),tleftEl=document.getElementById('tleft'),tlabel=document.getElementById('tlabel');
let tInt=null,tEndAt=0,audioCtx=null;
function startTimer(label){
  tlabel.textContent=label||'Repos';
  tbar.classList.add('on');tbar.classList.remove('fin');
  tEndAt=Date.now()+SETTINGS.rest*1000;
  tleftEl.textContent=fmtT(SETTINGS.rest);
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
function stopTimer(){clearInterval(tInt);tInt=null;tbar.classList.remove('on','fin')}
document.getElementById('tplus').addEventListener('click',()=>{
  if(!tInt)return;tEndAt+=30000;tleftEl.textContent=fmtT((tEndAt-Date.now())/1000);
});
document.getElementById('tskip').addEventListener('click',stopTimer);

/* ================== SHEETS ================== */
const overlay=document.getElementById('overlay'),sheet=document.getElementById('sheet');
function openSheet(){overlay.classList.add('on');sheet.classList.add('on')}
function closeSheet(){overlay.classList.remove('on');sheet.classList.remove('on')}
overlay.addEventListener('click',closeSheet);
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('on');
  clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),2400);
}
function showSummary(o){
  const s=SEANCE[o.seance];
  let recs='';
  if(o.recs.length){
    recs='<div class="recwrap"><div class="rectitle">Records</div>'
     +o.recs.map(r=>'<div class="recline"><b>'+fmtN(r.w)+' kg</b> — '+esc(r.name)+(r.prev!=null?' (préc. '+fmtN(r.prev)+')':'')+'</div>').join('')
     +'</div>';
  }
  sheet.innerHTML='<h2>Séance terminée'+(s?' · '+esc(s.tab):'')+'</h2><div class="sp">'+esc(s?s.title:'')+'</div>'
   +'<div class="sumgrid">'
   +'<div class="sumbox"><div class="v num">'+fmtDur(o.dur)+'</div><div class="l">Durée</div></div>'
   +'<div class="sumbox"><div class="v num">'+fmtKg(o.stats.vol)+'</div><div class="l">kg soulevés</div></div>'
   +'<div class="sumbox"><div class="v num">'+o.stats.sets+'</div><div class="l">Séries</div></div>'
   +'</div>'+recs
   +'<div class="sbtns"><button class="sbtn pri" id="shOk">OK</button></div>';
  openSheet();
  document.getElementById('shOk').addEventListener('click',closeSheet);
}
function showSettings(){
  sheet.innerHTML='<h2>Réglages</h2><div class="sp">Appliqués immédiatement.</div>'
   +'<div class="efield"><label>Repos par défaut</label><div class="chips" id="restChips">'
   +[90,120,180,240].map(v=>'<button class="chip num'+(SETTINGS.rest===v?' on':'')+'" data-rest="'+v+'">'+fmtT(v)+'</button>').join('')
   +'</div></div>'
   +'<div class="efield"><label>Poids corporel (kg)</label><input id="setPoids" inputmode="decimal" value="'+(SETTINGS.poids??'')+'" style="width:100%;background:var(--input);border:1px solid var(--line);border-radius:10px;padding:10px 12px;outline:none"></div>'
   +'<div class="sbtns"><button class="sbtn danger" id="setReset">Réinitialiser le programme</button></div>'
   +'<div class="sbtns"><button class="sbtn pri" id="setOk">Fermer</button></div>'
   +'<div class="about">Muscu v'+APP_VERSION+(isCustomProgram()?' · programme personnalisé':' · programme par défaut')+'</div>';
  openSheet();
  document.getElementById('restChips').addEventListener('click',ev=>{
    const c=ev.target.closest('.chip');if(!c)return;
    SETTINGS.rest=+c.dataset.rest;saveSettings();
    document.querySelectorAll('#restChips .chip').forEach(x=>x.classList.toggle('on',x===c));
  });
  document.getElementById('setPoids').addEventListener('input',ev=>{
    const v=numOrNull(ev.target.value);if(v!=null){SETTINGS.poids=v;saveSettings()}
  });
  document.getElementById('setReset').addEventListener('click',()=>{
    if(!window.confirm('Revenir au programme par défaut ? Tes modifications de programme seront perdues (l’historique est conservé).'))return;
    resetProgram();closeSheet();go('home');toast('Programme réinitialisé');
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
  return{app:'muscu',version:4,exporte_le:new Date().toISOString(),
    profil:Object.assign({},PROFILE,{poids_kg:SETTINGS.poids}),
    reglages:SETTINGS,recuperation_musculaire:recup,
    programme:PROGRAM,exercices:exos,seances:DB.workouts};
}
function showData(){
  sheet.innerHTML='<h2>Données</h2>'
   +'<div class="sp">Exporter copie tout (profil, programme, historique, récupération) en JSON — utilisable par un coach IA. Importer restaure depuis un JSON collé ci-dessous.</div>'
   +'<textarea class="io" id="shArea" spellcheck="false" placeholder="Coller ici le JSON à importer…"></textarea>'
   +'<div class="sbtns"><button class="sbtn pri" id="doExport">Exporter (copier)</button><button class="sbtn" id="doImport">Importer</button></div>';
  openSheet();
  document.getElementById('doExport').addEventListener('click',doExport);
  document.getElementById('doImport').addEventListener('click',doImport);
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
function doImport(){
  let data;
  try{data=JSON.parse(document.getElementById('shArea').value)}catch(e){toast('JSON invalide');return}
  if(Array.isArray(data.programme)&&data.programme.length&&data.programme.every(s=>s&&s.id&&Array.isArray(s.ex))){
    PROGRAM=data.programme;
    for(const s of PROGRAM)for(const e of s.ex){
      if(!Array.isArray(e.musP))e.musP=DEFAULT_EX[e.id]?DEFAULT_EX[e.id].musP.slice():[];
      if(!Array.isArray(e.musS))e.musS=DEFAULT_EX[e.id]?DEFAULT_EX[e.id].musS.slice():[];
    }
    saveProgram();
  }
  let workouts=null;
  if(Array.isArray(data.seances))workouts=data.seances;
  else if(Array.isArray(data.workouts))workouts=data.workouts;
  else{
    const src=data.historique||data.logs||data;
    if(src&&typeof src==='object'&&!Array.isArray(src)){
      const byKey={};
      for(const exId in src){
        if(!EXO[exId]||!Array.isArray(src[exId]))continue;
        for(const en of src[exId]){
          if(!en||!en.d||!Array.isArray(en.s))continue;
          const k=en.d+'|'+EXO[exId].seance;
          if(!byKey[k])byKey[k]={date:en.d,seance:EXO[exId].seance,dur:null,ex:{}};
          byKey[k].ex[exId]=en.s.map(x=>({w:numOrNull(x.w),r:intOrNull(x.r),done:true}));
        }
      }
      workouts=Object.values(byKey);
    }
  }
  if(!workouts){toast('Format non reconnu');return}
  const clean=[];
  for(const w of workouts){
    if(!w||typeof w.date!=='string'||!w.ex||typeof w.ex!=='object')continue;
    const ex={};
    for(const exId in w.ex){
      if(!Array.isArray(w.ex[exId]))continue;
      const sets=w.ex[exId].map(x=>({w:numOrNull(x.w),r:intOrNull(x.r),done:x.done!==false}))
        .filter(x=>x.w!=null||x.r!=null);
      if(sets.length)ex[exId]=sets;
    }
    if(Object.keys(ex).length)clean.push({date:w.date,seance:w.seance||(EXO[Object.keys(ex)[0]]||{}).seance,dur:w.dur??null,ex});
  }
  if(!clean.length){toast('Aucune séance trouvée dans le JSON');return}
  clean.sort((a,b)=>a.date<b.date?-1:1);
  DB.workouts=clean;persist();closeSheet();render();
  toast(clean.length+' séance'+(clean.length>1?'s':'')+' importée'+(clean.length>1?'s':''));
}

/* ================== SERVICE WORKER ================== */
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js').then(reg=>{
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

render();
