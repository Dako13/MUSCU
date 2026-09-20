// Run with PGLITE_PATH pointing to an extracted @electric-sql/pglite package.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_PATH||'@electric-sql/pglite');
(async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,anon;
      insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`);
    await db.exec(await fs.readFile(path.join(__dirname,'../supabase/migrations/202609200001_private_backups.sql'),'utf8'));
    const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
    const payload={schema:1,programs:[],workouts:[],settings:{},body:[]};
    const auth=async id=>{await db.exec('reset role;set role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
    let caller=a;
    const save=rev=>db.query('select public.dko_save_backup($1::jsonb,$2::bigint,$3::uuid) as saved',[JSON.stringify(payload),rev,caller]);
    await db.exec('set role anon;');
    await assert.rejects(()=>db.query('select * from public.dko_backups'),/permission denied/);
    await assert.rejects(()=>save(0),/permission denied/);
    await auth(a);assert.equal((await save(0)).rows[0].saved.revision,1);
    await assert.rejects(()=>save(0),/changed on another device/);
    assert.equal((await save(1)).rows[0].saved.revision,2);
    await assert.rejects(()=>save(1),/changed on another device/);
    await assert.rejects(()=>db.exec('update public.dko_backups set revision=99'),/permission denied/);
    await assert.rejects(()=>db.exec('delete from public.dko_backups'),/permission denied/);
    await assert.rejects(()=>db.query("select public.dko_save_backup('{}'::jsonb,2,$1::uuid)",[a]),/Invalid backup/);
    await auth(b);assert.equal((await db.query('select * from public.dko_backups')).rows.length,0);
    await assert.rejects(()=>save(0),/Account changed/);caller=b;
    assert.equal((await save(0)).rows[0].saved.revision,1);
    const rows=(await db.query('select * from public.dko_backups')).rows;assert.equal(rows.length,1);assert.equal(rows[0].user_id,b);
    await auth(a);assert.equal((await db.query('select revision from public.dko_backups')).rows[0].revision,2);
    await auth('');await assert.rejects(()=>save(0),/Authentication required/);
    await db.exec('reset role;');
    await db.query('delete from auth.users where id=$1',[a]);
    assert.equal((await db.query('select * from public.dko_backups')).rows.length,1);
    console.log('PASS SQL: anonymous denied, RLS isolates users, JWT owner, CAS enforced, direct writes denied, payload validation, account deletion cascade.');
  }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
