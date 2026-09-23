-- Version matches the migration recorded by the Supabase deployment.
begin;
create schema dko_coach_private;
revoke all on schema dko_coach_private from public, anon, authenticated;
grant usage on schema dko_coach_private to authenticated;

create table dko_coach_private.members (
  id uuid primary key references auth.users(id) on delete cascade,
  label text not null check(length(label) between 1 and 80),
  code text unique,
  share_notes boolean not null default false,
  programs jsonb,
  revision bigint not null default 0,
  applied_revision bigint not null default 0,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  applied_at timestamptz
);
create table dko_coach_private.links (
  student uuid not null references dko_coach_private.members(id) on delete cascade,
  coach uuid not null references dko_coach_private.members(id) on delete cascade,
  mode text not null check(mode in ('full','read','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(student,coach), check(student<>coach)
);
create index links_coach_idx on dko_coach_private.links(coach);
create table dko_coach_private.versions (
  student uuid not null references dko_coach_private.members(id) on delete cascade,
  revision bigint not null,
  programs jsonb not null,
  actor uuid,
  summary text not null,
  created_at timestamptz not null default now(),
  primary key(student,revision)
);
create table dko_coach_private.attempts (
  actor uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  attempts integer not null default 0
);
alter table dko_coach_private.members enable row level security;
alter table dko_coach_private.links enable row level security;
alter table dko_coach_private.versions enable row level security;
alter table dko_coach_private.attempts enable row level security;
revoke all on all tables in schema dko_coach_private from public,anon,authenticated;

create function dko_coach_private.valid_text(v jsonb,maximum integer) returns boolean
language sql immutable set search_path='' as $$
  select v is null or v='null'::jsonb or (jsonb_typeof(v)='string' and length(v#>>'{}')<=maximum)
$$;
create function dko_coach_private.valid_number(v jsonb,minimum numeric,maximum numeric,whole boolean default false) returns boolean
language plpgsql immutable set search_path='' as $$
declare n numeric;
begin
  if v is null or v='null'::jsonb then return true; end if;
  if jsonb_typeof(v)<>'number' then return false; end if;
  n:=(v#>>'{}')::numeric;
  return n between minimum and maximum and (not whole or n=trunc(n));
end $$;

-- The shared document contains programs only; account settings never enter it.
create function dko_coach_private.validate_programs(doc jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare p jsonb; s jsonb; e jsonb; v jsonb; ids text[]:='{}'; k text;
begin
  if doc is null or jsonb_typeof(doc)<>'array' or octet_length(doc::text)>2097152 then return false; end if;
  if jsonb_array_length(doc)<1 or jsonb_array_length(doc)>100 then return false; end if;
  for p in select value from jsonb_array_elements(doc) loop
    if jsonb_typeof(p->'name') is distinct from 'string' or jsonb_typeof(p->'seances') is distinct from 'array' then return false; end if;
    if length(p->>'name')>5000 or jsonb_array_length(p->'seances')>100 then return false; end if;
    k:=p->>'id'; if k is null or k !~ '^[A-Za-z0-9_.:-]{1,200}$' or k=any(ids) or k in ('__proto__','constructor','prototype') then return false; end if; ids:=array_append(ids,k);
    for s in select value from jsonb_array_elements(p->'seances') loop
      if jsonb_typeof(s->'title') is distinct from 'string' or jsonb_typeof(s->'ex') is distinct from 'array' then return false; end if;
      if jsonb_array_length(s->'ex')>100 then return false; end if;
      foreach k in array array['title','tab','sub','warn'] loop
        if not dko_coach_private.valid_text(s->k,5000) then return false; end if;
      end loop;
      if not dko_coach_private.valid_number(s->'rest',1,86400,true) then return false; end if;
      k:=s->>'id'; if k is null or k !~ '^[A-Za-z0-9_.:-]{1,200}$' or k=any(ids) or k in ('__proto__','constructor','prototype') then return false; end if; ids:=array_append(ids,k);
      for e in select value from jsonb_array_elements(s->'ex') loop
        if jsonb_typeof(e->'name') is distinct from 'string' or jsonb_typeof(e->'sets') is distinct from 'number' or jsonb_typeof(e->'reps') is distinct from 'string' then return false; end if;
        if (e->>'sets')::numeric not between 1 and 100 or (e->>'sets')::numeric<>trunc((e->>'sets')::numeric) then return false; end if;
        foreach k in array array['name','refText','ceiling','notes','yt'] loop
          if not dko_coach_private.valid_text(e->k,5000) then return false; end if;
        end loop;
        if not dko_coach_private.valid_text(e->'reps',80) or not dko_coach_private.valid_text(e->'unit',80)
          or not dko_coach_private.valid_number(e->'ref',0,10000)
          or not dko_coach_private.valid_number(e->'rest',1,86400)
          or not dko_coach_private.valid_number(e->'increment',0.0001,100) then return false; end if;
        foreach k in array array['musP','musS'] loop
          if e->k is not null and e->k<>'null'::jsonb then
            if jsonb_typeof(e->k)<>'array' then return false; end if;
            for v in select value from jsonb_array_elements(e->k) loop
              if not dko_coach_private.valid_text(v,80) then return false; end if;
            end loop;
          end if;
        end loop;
        k:=e->>'id'; if k is null or k !~ '^[A-Za-z0-9_.:-]{1,200}$' or k=any(ids) or k in ('__proto__','constructor','prototype') then return false; end if; ids:=array_append(ids,k);
      end loop;
    end loop;
  end loop;
  return true;
end $$;

-- Completed sessions only. Never return the original backup, profile or active session.
create function dko_coach_private.progress(student uuid, notes boolean) returns jsonb
language sql stable set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',w->'id','date',w->'date','seance',w->'seance','session',w->'session',
    'dur',w->'dur','ex',w->'ex','exMeta',w->'exMeta',
    'exNotes',case when notes then coalesce(w->'exNotes','{}'::jsonb) else '{}'::jsonb end
  ) order by w->>'date' desc),'[]'::jsonb)
  from (select w from public.dko_backups b, lateral jsonb_array_elements(b.payload->'workouts') w
    where b.user_id=student order by w->>'date' desc limit 500) recent;
$$;

-- A single audited gateway owns cross-account operations. Private tables have no
-- direct API grants. Every branch derives the actor from the verified JWT.
create function dko_coach_private.call(action text,args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid(); target uuid; m dko_coach_private.members;
  permission text; result jsonb; n integer; doc jsonb; expected bigint; label_value text;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and not is_anonymous) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if args is null or jsonb_typeof(args)<>'object' or octet_length(args::text)>2200000 then raise exception 'Invalid request'; end if;
  if (args->>'account') is distinct from actor::text then raise exception 'Account changed' using errcode='42501'; end if;
  if action='register' then
    label_value:=trim(args->>'label');
    if label_value is null or length(label_value) not between 1 and 80 then raise exception 'Invalid name'; end if;
    insert into dko_coach_private.members(id,label) values(actor,label_value)
      on conflict(id) do update set label=excluded.label;
    return jsonb_build_object('ok',true);
  end if;
  if action='join' then
    if not exists(select 1 from dko_coach_private.members where id=actor) then raise exception 'Profile required'; end if;
    insert into dko_coach_private.attempts as a(actor,attempts) values(actor,1)
      on conflict on constraint attempts_pkey do update set
        attempts=case when a.window_start<now()-interval '1 hour' then 1 else a.attempts+1 end,
        window_start=case when a.window_start<now()-interval '1 hour' then now() else a.window_start end
      returning attempts into n;
    -- Return errors instead of raising: failed attempts must commit their counter.
    if n>20 then return jsonb_build_object('error','rate_limit'); end if;
    select * into m from dko_coach_private.members
      where code=upper(regexp_replace(coalesce(args->>'code',''),'[^a-zA-Z0-9]','','g')) for update;
    if not found or m.id=actor then return jsonb_build_object('error','invalid_code'); end if;
    select mode into permission from dko_coach_private.links where student=m.id and coach=actor;
    if permission='blocked' then return jsonb_build_object('error','invalid_code'); end if;
    if permission is null then
      insert into dko_coach_private.links(student,coach,mode) values(m.id,actor,'full');
    end if;
    return jsonb_build_object('student',m.id,'mode',coalesce(permission,'full'));
  end if;
  if action='students' then
    select coalesce(jsonb_agg(r order by r->>'label'),'[]'::jsonb) into result from (
      select jsonb_build_object('id',member.id,'label',member.label,'mode',l.mode,'revision',member.revision,
        'appliedRevision',member.applied_revision,'updatedAt',member.updated_at,'lastSync',b.updated_at,
        'sessions',coalesce(jsonb_array_length(b.payload->'workouts'),0)) r
      from dko_coach_private.links l join dko_coach_private.members member on member.id=l.student
      left join public.dko_backups b on b.user_id=member.id
      where l.coach=actor and l.mode<>'blocked' and member.code is not null limit 200
    ) rows;
    return result;
  end if;
  target:=case when action in ('read','publish','history') then coalesce((args->>'student')::uuid,actor) else actor end;
  select * into m from dko_coach_private.members where id=target for update;
  if not found then
    if action='self' then return 'null'::jsonb; end if;
    raise exception 'Access denied' using errcode='42501';
  end if;
  if target<>actor then
    select mode into permission from dko_coach_private.links where student=target and coach=actor;
    if m.code is null or permission is null or permission='blocked' then raise exception 'Access denied' using errcode='42501'; end if;
    if action='publish' and permission<>'full' then raise exception 'Read only' using errcode='42501'; end if;
  else permission:='owner'; end if;
  if action='enable' then
    doc:=args->'programs';
    if not dko_coach_private.validate_programs(doc) then raise exception 'Invalid programs'; end if;
    if m.revision=0 then
      update dko_coach_private.members set programs=doc,revision=1,updated_by=actor,updated_at=now() where id=actor;
      insert into dko_coach_private.versions values(actor,1,doc,actor,'Activation du suivi',now());
    end if;
    update dko_coach_private.members set code=coalesce(code,upper(replace(gen_random_uuid()::text,'-',''))),
      share_notes=coalesce((args->>'notes')::boolean,false) where id=actor;
    return jsonb_build_object('ok',true);
  elsif action='rotate' then
    if m.code is null then raise exception 'Sharing disabled'; end if;
    update dko_coach_private.members set code=upper(replace(gen_random_uuid()::text,'-','')) where id=actor;
    return jsonb_build_object('ok',true);
  elsif action='notes' then
    update dko_coach_private.members set share_notes=coalesce((args->>'enabled')::boolean,false) where id=actor;
    return jsonb_build_object('ok',true);
  elsif action='disable' then
    update dko_coach_private.members set code=null,share_notes=false where id=actor;
    update dko_coach_private.links set mode='blocked',updated_at=now() where student=actor;
    return jsonb_build_object('ok',true);
  elsif action='permission' then
    if args->>'mode' not in ('full','read','blocked') or args->>'mode' is null then raise exception 'Invalid permission'; end if;
    update dko_coach_private.links set mode=args->>'mode',updated_at=now() where student=actor and coach=(args->>'coach')::uuid;
    if not found then raise exception 'Unknown link'; end if;
    return jsonb_build_object('ok',true);
  elsif action='publish' then
    if m.code is null then raise exception 'Sharing disabled'; end if;
    expected:=(args->>'revision')::bigint;
    if expected is distinct from m.revision then raise exception 'Program conflict' using errcode='40001'; end if;
    doc:=args->'programs';
    if not dko_coach_private.validate_programs(doc) then raise exception 'Invalid programs'; end if;
    if doc=m.programs then return jsonb_build_object('revision',m.revision); end if;
    update dko_coach_private.members set programs=doc,revision=revision+1,updated_by=actor,updated_at=now() where id=target returning * into m;
    insert into dko_coach_private.versions values(target,m.revision,doc,actor,left(coalesce(nullif(trim(args->>'summary'),''),'Programme mis à jour'),500),now());
    delete from dko_coach_private.versions where student=target and revision<=m.revision-20;
    return jsonb_build_object('revision',m.revision);
  elsif action='ack' then
    expected:=(args->>'revision')::bigint;
    if expected is distinct from m.revision then raise exception 'Program conflict' using errcode='40001'; end if;
    update dko_coach_private.members set applied_revision=expected,applied_at=now() where id=actor;
    return jsonb_build_object('ok',true);
  elsif action='history' then
    select coalesce(jsonb_agg(jsonb_build_object('revision',v.revision,'programs',v.programs,'summary',v.summary,
      'date',v.created_at,'author',coalesce(a.label,'Compte supprimé')) order by v.revision desc),'[]'::jsonb) into result
      from dko_coach_private.versions v left join dko_coach_private.members a on a.id=v.actor where v.student=target;
    return result;
  elsif action in ('self','read') then
    select jsonb_build_object('id',m.id,'label',m.label,'mode',permission,'programs',m.programs,'revision',m.revision,
      'appliedRevision',m.applied_revision,'updatedAt',m.updated_at,'updatedBy',m.updated_by,'shareNotes',m.share_notes,
      'lastSync',b.updated_at) into result from (select 1) dummy left join public.dko_backups b on b.user_id=target;
    if action='read' then result:=result||jsonb_build_object('workouts',dko_coach_private.progress(target,m.share_notes)); end if;
    if target=actor then
      result:=result||jsonb_build_object('code',m.code,'coaches',coalesce((select jsonb_agg(jsonb_build_object(
        'id',l.coach,'label',c.label,'mode',l.mode,'since',l.created_at)) from dko_coach_private.links l
        join dko_coach_private.members c on c.id=l.coach where l.student=actor),'[]'::jsonb));
    end if;
    return result;
  end if;
  raise exception 'Unknown action';
end $$;

revoke all on all functions in schema dko_coach_private from public,anon,authenticated;
grant execute on function dko_coach_private.call(text,jsonb) to authenticated;
create function public.dko_coach(action text,args jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select dko_coach_private.call(action,args) $$;
revoke all on function public.dko_coach(text,jsonb) from public,anon,authenticated;
grant execute on function public.dko_coach(text,jsonb) to authenticated;
commit;
