const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'../MuscuApp');
const source=fs.readFileSync(path.join(root,'exercise-catalog.js'),'utf8');
const catalog=vm.runInNewContext(source+';EXERCISE_CATALOG');
const matrix=vm.runInNewContext(source+';MATRIX_CATALOG');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const muscles=new Set([...app.matchAll(/\{id:'([^']+)',label:/g)].map(m=>m[1]));
const names=new Set(),tips=new Set();
assert(catalog.length>=140);
for(const entry of catalog){
  assert(!names.has(entry.n),'Duplicate name: '+entry.n);names.add(entry.n);
  assert(!tips.has(entry.tip),'Repeated tip: '+entry.n);tips.add(entry.tip);
  assert(entry.tip.length>=80&&entry.tip.length<600,entry.n);
  assert(entry.generic&&entry.b==='Générique');
  assert(['broche','disques','libre','poulie','corps'].includes(entry.load));
  assert(entry.p.length>0&&entry.p.concat(entry.s).every(m=>muscles.has(m)),entry.n);
  assert(entry.aliases&&entry.pattern&&entry.t,entry.n);
}
for(const name of ['Tractions pronation','Curl bayésien unilatéral (poulie)','Belt squat (machine à disques)','Dead bug','Soulevé de terre roumain B-stance (haltères)'])assert(names.has(name));
assert.equal(matrix.length,41);
for(const model of ['VS-S13','VS-S23','VS-S33','VS-S34','VS-S71','VS-S331','VS-S401','VS-S531','VS-S601','VS-S711']){
  assert(matrix.some(entry=>entry.model===model),'Missing Matrix model: '+model);
}
for(const entry of matrix){
  assert(entry.b==='Matrix'&&entry.model&&entry.aliases.includes(entry.model));
  assert(!tips.has(entry.tip),'Repeated Matrix tip');tips.add(entry.tip);
  assert(entry.p.concat(entry.s).every(m=>muscles.has(m)));
  assert.equal(entry.load,entry.model.startsWith('MG-PL')?'disques':'broche');
}
assert(fs.readFileSync(path.join(root,'index.html'),'utf8').indexOf('exercise-catalog.js')<fs.readFileSync(path.join(root,'index.html'),'utf8').indexOf('./app.js'));
assert(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes("'./exercise-catalog.js'"));
console.log('PASS: '+catalog.length+' generic exercises and '+matrix.length+' Matrix entries, unique tips, muscle IDs, explicit loads and offline asset wiring.');
