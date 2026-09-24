'use strict';
/* Backup validation is pure: reject the whole payload before changing storage. */
const DKO_DATA=(()=>{
  const fail=message=>{throw new Error(message)};
  const object=(v,label)=>v&&typeof v==='object'&&!Array.isArray(v)?v:fail(label+' : objet attendu');
  const list=(v,label)=>Array.isArray(v)?v:fail(label+' : liste attendue');
  const str=(v,fallback='',max=5000)=>v==null?fallback:(typeof v==='string'&&v.length<=max?v:fail('Texte invalide dans la sauvegarde'));
  const id=v=>{
    const s=str(v,'',200);
    if(!s||['__proto__','constructor','prototype'].includes(s)||!(/^[A-Za-z0-9_.:-]+$/).test(s))fail('Identifiant invalide');
    return s;
  };
  const number=(v,min,max,fallback=null,integer=false)=>{
    if(v==null||v==='')return fallback;
    if(typeof v!=='number'&&typeof v!=='string')fail('Valeur numérique invalide');
    const n=Number(String(v).trim().replace(',','.'));
    if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))fail('Valeur numérique hors limites');
    return n;
  };
  const date=v=>{
    if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))fail('Date invalide');
    const d=new Date(v+'T00:00:00Z');
    if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)fail('Date invalide');
    return v;
  };
  const muscles=v=>v==null?[]:list(v,'Muscles').map(x=>str(x,'',80));
  const meta=e=>({name:str(e.name),unit:str(e.unit,'kg',80),musP:muscles(e.musP),musS:muscles(e.musS),
    sets:number(e.sets,1,100,3,true),reps:str(e.reps,'8–10',80),ref:number(e.ref,0,10000),refText:str(e.refText),
    rest:number(e.rest,1,86400),ceiling:str(e.ceiling),notes:str(e.notes),yt:str(e.yt),
    ...(e.increment!=null?{increment:number(e.increment,0.0001,100)}:{})});
  function programs(values){
    const seen=new Set();
    const unique=v=>{const key=id(v);if(seen.has(key))fail('Identifiant dupliqué dans les programmes');seen.add(key);return key;};
    return list(values,'Programmes').map(p=>{
      object(p,'Programme');
      return {id:unique(p.id),name:str(p.name,'Programme'),seances:list(p.seances,'Séances').map(s=>{
        object(s,'Séance');
        return {id:unique(s.id),tab:str(s.tab,'Séance'),title:str(s.title,'Séance'),sub:str(s.sub),warn:str(s.warn),rest:number(s.rest,1,86400,null,true),ex:list(s.ex,'Exercices').map(e=>{
          object(e,'Exercice');
          return {id:unique(e.id),...meta(e),sets:number(e.sets,1,100,3,true),reps:str(e.reps,'8–10',80),ref:number(e.ref,0,10000),
            refText:str(e.refText),rest:number(e.rest,1,86400),ceiling:str(e.ceiling),notes:str(e.notes),yt:str(e.yt)};
        })};
      })};
    });
  }
  function workout(w,active=false){
    object(w,'Séance enregistrée');object(w.ex,'Séries');
    const ex=Object.fromEntries(Object.entries(w.ex).map(([key,sets])=>[id(key),list(sets,'Séries').map(s=>{
      object(s,'Série');
      if(s.done!=null&&typeof s.done!=='boolean')fail('Validation de série invalide');
      const clean={w:number(s.w,0,10000),r:number(s.r,0,100000),done:s.done!==false};
      if(active&&s.doneElapsedMs!=null)clean.doneElapsedMs=number(s.doneElapsedMs,0,31536000000);
      if(active&&clean.done&&s.doneAt!=null)clean.doneAt=number(s.doneAt,0,8640000000000000,null,true);
      return clean;
    }).filter(s=>active||s.w!=null||s.r!=null)]));
    const clean={date:date(w.date),seance:id(w.seance),dur:number(w.dur,0,31536000),ex};
    if(!active&&w.endedAt!=null)clean.endedAt=number(w.endedAt,0,8640000000000000,null,true);
    if(w.bodyWeightKg!=null)clean.bodyWeightKg=number(w.bodyWeightKg,1,1000);
    if(w.id!=null)clean.id=id(w.id);
    if(w.session){object(w.session,'Nom de séance');clean.session={title:str(w.session.title),tab:str(w.session.tab)};}
    if(w.exMeta){object(w.exMeta,'Exercices enregistrés');clean.exMeta=Object.fromEntries(Object.entries(w.exMeta).map(([key,e])=>[id(key),meta(object(e,'Exercice enregistré'))]));}
    clean.exNotes=Object.fromEntries(Object.entries(w.exNotes==null?{}:object(w.exNotes,'Ressentis')).map(([key,n])=>[id(key),str(n,'',2000)]).filter(([,n])=>n.trim()));
    if(active){
      if(w.restByEx!=null)clean.restByEx=Object.fromEntries(Object.entries(object(w.restByEx,'Repos par exercice')).map(([key,value])=>{
        const exId=id(key);if(!Object.hasOwn(ex,exId))fail('Repos associé à un exercice inconnu');
        return [exId,number(value,1,86400,null,true)];
      }).filter(([,value])=>value!=null));
      clean.start=number(w.start,0,8640000000000000,Date.now());
      clean.pt=number(w.pt,0,8640000000000000,0);clean.ps=number(w.ps,0,8640000000000000);
      if(w.restTimer){object(w.restTimer,'Minuteur');clean.restTimer={end:number(w.restTimer.end,0,8640000000000000),label:str(w.restTimer.label)};}
      if(w.exerciseOrder!=null){
        const order=list(w.exerciseOrder,'Ordre des exercices').map(id),unique=new Set(order);
        if(unique.size!==order.length||order.length!==Object.keys(ex).length||order.some(exId=>!Object.hasOwn(ex,exId)))fail('Ordre des exercices invalide');
        clean.exerciseOrder=order;
      }
    }
    return clean;
  }
  function settings(s){
    object(s,'Réglages');const out={};
    for(const [k,min,max] of [['poids',1,1000],['taille',1,300],['age',1,130],['rest',1,86400]])if(k in s)out[k]=s[k]===null&&k!=='rest'?null:number(s[k],min,max);
    for(const k of ['objectif','salle','niveau'])if(k in s)out[k]=str(s[k]);
    if('programOrigin' in s){if(!['legacy','neutral'].includes(s.programOrigin))fail('Origine du programme non reconnue');out.programOrigin=s.programOrigin;}
    if('theme' in s){if(!['dark','rose','emerald','gold','glacier'].includes(s.theme))fail('Thème non reconnu');out.theme=s.theme;}
    if('silhouette' in s){if(!['male','female'].includes(s.silhouette))fail('Silhouette non reconnue');out.silhouette=s.silhouette;}
    if('exerciseLibrary' in s)out.exerciseLibrary=list(s.exerciseLibrary,'Bibliothèque personnelle').map(e=>meta(object(e,'Exercice personnel')));
    for(const key of ['exerciseFavorites','exerciseRecent'])if(key in s)out[key]=[...new Set(list(s[key],'Exercices').map(x=>str(x,'',6000)))];
    return out;
  }
  function body(values){
    const keys=['poids','mg','taille','poitrine','bras','cuisse','hanches','mollet'];
    return list(values,'Mensurations').map(b=>({date:date(b.date),vals:Object.fromEntries(Object.entries(object(b.vals,'Mesures')).filter(([k])=>keys.includes(k)).map(([k,v])=>[k,number(v,0,10000)]))}));
  }
  function fingerprint(w){
    const ex=Object.keys(w.ex||{}).sort().map(k=>[k,w.ex[k].map(s=>[s.w??null,s.r??null,s.done!==false])]);
    return JSON.stringify([w.date,w.seance,w.dur??null,ex,Object.entries(w.exNotes||{}).sort(([a],[b])=>a.localeCompare(b))]);
  }
  function mergeWorkouts(existing,incoming){
    const result=existing.slice(),ids=new Set(existing.filter(w=>w.id).map(w=>w.id));
    const legacy=new Map();existing.forEach(w=>{const k=fingerprint(w);legacy.set(k,(legacy.get(k)||0)+1)});
    for(const w of incoming){
      if(w.id){if(ids.has(w.id))continue;ids.add(w.id);}
      else{const k=fingerprint(w),n=legacy.get(k)||0;if(n){legacy.set(k,n-1);continue;}}
      result.push(w);
    }
    return result.sort((a,b)=>a.date.localeCompare(b.date));
  }
  function cloud(value){
    object(value,'Sauvegarde cloud');
    if(value.schema!==1)fail('Version de sauvegarde cloud non reconnue');
    const ps=programs(value.programs);
    if(!ps.length||!ps.some(p=>p.id===value.activeId))fail('Programme actif manquant');
    const ws=list(value.workouts,'Historique').map(w=>workout(w));
    const active=value.active==null?null:workout(value.active,true);
    if(active){
      const session=ps.flatMap(p=>p.seances).find(s=>s.id===active.seance);
      const programIds=new Set(session?.ex.map(e=>e.id)||[]),temporaryIds=new Set(Object.keys(active.exMeta||{}));
      if(!session||Object.keys(active.ex).some(k=>!programIds.has(k)&&!temporaryIds.has(k)))fail('Programme de la séance en cours incomplet');
      if(ws.some(w=>w.id&&w.id===active.id))fail('Séance déjà terminée dans la sauvegarde');
    }
    return {schema:1,programs:ps,activeId:value.activeId,workouts:ws,active,settings:settings(value.settings),body:body(value.body)};
  }
  return {programs,workout,settings,body,mergeWorkouts,cloud};
})();
