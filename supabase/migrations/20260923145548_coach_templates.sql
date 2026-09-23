begin;

create table dko_coach_private.templates (
  id uuid primary key default gen_random_uuid(),
  coach uuid not null references auth.users(id) on delete cascade,
  program jsonb not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (revision > 0)
);
create index templates_coach_idx on dko_coach_private.templates(coach, updated_at desc);
alter table dko_coach_private.templates enable row level security;
revoke all on dko_coach_private.templates from public, anon, authenticated;

create function dko_coach_private.template_call(action text, args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  template_id uuid;
  saved dko_coach_private.templates;
  document jsonb;
  expected bigint;
  result jsonb;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and not is_anonymous) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if args is null or jsonb_typeof(args)<>'object' or octet_length(args::text)>600000 then
    raise exception 'Invalid request';
  end if;
  if (args->>'account') is distinct from actor::text then
    raise exception 'Account changed' using errcode='42501';
  end if;
  if action='list' then
    select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.program->>'name',
      'sessions',jsonb_array_length(t.program->'seances'),'revision',t.revision,
      'updatedAt',t.updated_at) order by t.updated_at desc),'[]'::jsonb)
      into result from dko_coach_private.templates t where t.coach=actor;
    return result;
  end if;
  if action in ('read','delete') then
    template_id:=(args->>'id')::uuid;
    select * into saved from dko_coach_private.templates where id=template_id and coach=actor for update;
    if not found then raise exception 'Access denied' using errcode='42501'; end if;
    if action='read' then
      return jsonb_build_object('id',saved.id,'program',saved.program,
        'revision',saved.revision,'updatedAt',saved.updated_at);
    end if;
    expected:=(args->>'revision')::bigint;
    if expected is distinct from saved.revision then
      raise exception 'Template conflict' using errcode='40001';
    end if;
    delete from dko_coach_private.templates where id=template_id and coach=actor;
    return jsonb_build_object('ok',true);
  end if;
  if action='save' then
    document:=args->'program';
    if document is null or octet_length(document::text)>500000
      or not dko_coach_private.validate_programs(jsonb_build_array(document))
      or length(trim(document->>'name')) not between 1 and 120 then
      raise exception 'Invalid template';
    end if;
    if args->>'id' is not null then
      template_id:=(args->>'id')::uuid;
      expected:=(args->>'revision')::bigint;
      update dko_coach_private.templates t
        set program=document,revision=t.revision+1,updated_at=now()
        where t.id=template_id and t.coach=actor and t.revision=expected
        returning * into saved;
      if not found then
        if exists(select 1 from dko_coach_private.templates where id=template_id and coach=actor) then
          raise exception 'Template conflict' using errcode='40001';
        end if;
        raise exception 'Access denied' using errcode='42501';
      end if;
    else
      perform pg_advisory_xact_lock(hashtext(actor::text));
      if (select count(*) from dko_coach_private.templates where coach=actor)>=50 then
        raise exception 'Template limit reached';
      end if;
      insert into dko_coach_private.templates(coach,program) values(actor,document)
        returning * into saved;
    end if;
    return jsonb_build_object('id',saved.id,'revision',saved.revision);
  end if;
  raise exception 'Unknown action';
end $$;

revoke all on function dko_coach_private.template_call(text,jsonb) from public,anon,authenticated;
grant execute on function dko_coach_private.template_call(text,jsonb) to authenticated;
create function public.dko_coach_template(action text,args jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$
  select dko_coach_private.template_call(action,args)
$$;
revoke all on function public.dko_coach_template(text,jsonb) from public,anon,authenticated;
grant execute on function public.dko_coach_template(text,jsonb) to authenticated;

commit;
