begin;

create table public.dko_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.dko_backups enable row level security;
revoke all on public.dko_backups from public, anon, authenticated;
grant select on public.dko_backups to authenticated;
create policy own_backup_read on public.dko_backups for select to authenticated
  using ((select auth.uid()) = user_id);

-- Writes are only available through CAS; clients cannot bypass revision checks.
-- The owner is derived from the verified JWT, never supplied by the browser.
create function public.dko_save_backup(p_payload jsonb, p_expected_revision bigint, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  saved public.dko_backups;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  -- Also reject a browser auth-session change while a request is being prepared.
  if p_user_id is distinct from owner_id then
    raise exception 'Account changed' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid revision' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or p_payload->>'schema' is distinct from '1'
    or jsonb_typeof(p_payload->'programs') is distinct from 'array'
    or jsonb_typeof(p_payload->'workouts') is distinct from 'array'
    or jsonb_typeof(p_payload->'settings') is distinct from 'object'
    or jsonb_typeof(p_payload->'body') is distinct from 'array'
    or octet_length(p_payload::text) > 10485760 then
    raise exception 'Invalid backup (10 MB maximum)' using errcode = '22023';
  end if;
  if p_expected_revision = 0 then
    insert into public.dko_backups(user_id,revision,payload)
      values(owner_id,1,p_payload) on conflict(user_id) do nothing returning * into saved;
  else
    update public.dko_backups set payload=p_payload, revision=revision+1, updated_at=clock_timestamp()
      where user_id=owner_id and revision=p_expected_revision returning * into saved;
  end if;
  if saved.user_id is null then
    raise exception 'Backup changed on another device' using errcode = '40001';
  end if;
  return jsonb_build_object('revision',saved.revision,'updated_at',saved.updated_at);
end;
$$;
revoke all on function public.dko_save_backup(jsonb,bigint,uuid) from public, anon, authenticated;
grant execute on function public.dko_save_backup(jsonb,bigint,uuid) to authenticated;

commit;
