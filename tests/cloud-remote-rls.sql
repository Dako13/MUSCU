-- Synthetic users and snapshots exist only inside this rolled-back transaction.
-- Run as the project's SQL administrator; no emails or real user data are used.
begin;
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  payload jsonb := '{"schema":1,"programs":[],"workouts":[],"settings":{},"body":[]}';
  result jsonb;
  count_rows integer;
begin
  insert into auth.users(id,aud,role,email,email_confirmed_at)
    values(a,'authenticated','authenticated',a::text||'@dko-test.invalid',now()),
          (b,'authenticated','authenticated',b::text||'@dko-test.invalid',now());
  execute 'set local role anon';
  begin
    perform * from public.dko_backups;
    raise exception 'Anonymous read unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.dko_save_backup(payload,0,a);
    raise exception 'Anonymous write unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  result := public.dko_save_backup(payload,0,a);
  if result->>'revision' <> '1' then raise exception 'First save failed'; end if;
  begin
    perform public.dko_save_backup(payload,0,a);
    raise exception 'Stale revision unexpectedly accepted';
  exception when serialization_failure then null;
  end;
  begin
    update public.dko_backups set revision=999 where user_id=a;
    raise exception 'Direct write unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  select count(*) into count_rows from public.dko_backups where user_id=a;
  if count_rows <> 0 then raise exception 'Cross-account read allowed'; end if;
  begin
    perform public.dko_save_backup(payload,1,a);
    raise exception 'Cross-account write allowed';
  exception when insufficient_privilege then null;
  end;
  result := public.dko_save_backup(payload,0,b);
  if result->>'revision' <> '1' then raise exception 'Second account save failed'; end if;
  execute 'reset role';
end;
$$;
rollback;
select 'PASS: RLS, ownership, revision conflicts and write permissions; all test data rolled back' as result;
