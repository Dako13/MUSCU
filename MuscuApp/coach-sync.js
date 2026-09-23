'use strict';
/* The program channel is independent from whole-account backups. A missing base
   never authorizes an upload: restores and new devices require explicit review. */
const DKO_COACH_SYNC=(()=>{
  function decide({local,remote,base,revision,blocked}){
    if(local===remote)return 'equal';
    if(!base)return 'conflict';
    if(local===base.hash)return blocked?'waiting':'download';
    if(revision===base.revision)return blocked?'waiting':'upload';
    return 'conflict';
  }
  function create({api,read,apply,blocked,hash,getBase,setBase,onChange=()=>{},onApplied=()=>{}}){
    let disposed=false,busy=false,generation=0,state={phase:'idle',profile:null},reviewed=null;
    const current=()=>{if(disposed)throw new Error('Account changed');};
    const emit=(phase,extra={})=>{state={...state,phase,...extra};if(!disposed)onChange(state);};
    const mark=async(doc,revision,guard)=>{const value=await hash(doc);guard();setBase({hash:value,revision});};
    async function sync(){
      if(disposed||busy)return;busy=true;
      const token=generation,guard=()=>{current();if(token!==generation)throw new Error('Programs restored');};
      try{
        const p=await api('self');guard();
        state.profile=p;
        if(!p?.code){emit('disabled');return;}
        const local=read(),localHash=await hash(local),remoteHash=await hash(p.programs);guard();
        const action=decide({local:localHash,remote:remoteHash,base:getBase(),revision:p.revision,blocked:blocked()});
        reviewed=p;
        if(action==='conflict'){emit('conflict');return;}
        if(action==='waiting'){emit('waiting');return;}
        if(action==='download'){
          if(blocked()||await hash(read())!==localHash){emit('waiting');return;}guard();
          await apply(p.programs,guard);guard();await mark(p.programs,p.revision,guard);onApplied(p);
        }else if(action==='upload'){
          if(blocked()){emit('waiting');return;}
          const result=await api('publish',{revision:p.revision,programs:local,summary:'Modifications de l’élève'});guard();
          await mark(local,result.revision,guard);p.revision=result.revision;p.programs=local;
        }else await mark(local,p.revision,guard);
        guard();await api('ack',{revision:p.revision});guard();emit('saved');
      }catch(e){if(!disposed)emit(e.code==='40001'?'conflict':'error',{error:e.message});}
      finally{busy=false;}
    }
    async function resolve(choice){
      if(busy||disposed||!reviewed||blocked())return false;busy=true;
      const token=generation,guard=()=>{current();if(token!==generation)throw new Error('Programs restored');};
      try{
        const latest=await api('self');guard();
        if(!latest?.code||latest.revision!==reviewed.revision){reviewed=latest;emit('conflict');return false;}
        if(choice==='remote'){
          if(blocked())return false;
          await apply(latest.programs,guard);guard();await mark(latest.programs,latest.revision,guard);onApplied(latest);
        }else{
          if(blocked())return false;
          const doc=read();const result=await api('publish',{revision:latest.revision,programs:doc,summary:'Version locale choisie après comparaison'});guard();
          await mark(doc,result.revision,guard);latest.revision=result.revision;latest.programs=doc;
        }
        await api('ack',{revision:latest.revision});guard();state.profile=latest;emit('saved');return true;
      }catch(e){if(!disposed)emit(e.code==='40001'?'conflict':'error',{error:e.message});return false;}
      finally{busy=false;}
    }
    return {sync,resolve,state:()=>state,dispose:()=>{disposed=true;},invalidate:()=>{generation++;setBase(null);reviewed=null;emit('idle');}};
  }
  return {decide,create};
})();
