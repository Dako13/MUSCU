-- Synthetic accounts only. This transaction rolls back every fixture and change.
begin;
do $$
declare
  student uuid:=gen_random_uuid(); coach uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid();
  doc jsonb:='[{"id":"p_test","name":"Test","seances":[{"id":"s_test","title":"Session","ex":[{"id":"e_test","name":"Squat","sets":3,"reps":"8"}]}]}]';
  result jsonb; code text; template_id uuid;
begin
  insert into auth.users(id,aud,role,email,is_anonymous)
    values(student,'authenticated','authenticated',student::text||'@dko-test.invalid',false),
          (coach,'authenticated','authenticated',coach::text||'@dko-test.invalid',false),
          (stranger,'authenticated','authenticated',stranger::text||'@dko-test.invalid',false);
  execute 'set local role anon';
  begin
    perform public.dko_coach('self','{}');
    raise exception 'Anonymous access unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',student::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',student,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  perform public.dko_coach('register',jsonb_build_object('account',student,'label','Synthetic student'));
  perform public.dko_coach('enable',jsonb_build_object('account',student,'programs',doc));
  result:=public.dko_coach('self',jsonb_build_object('account',student));code:=result->>'code';
  if length(code)<>32 then raise exception 'Code missing'; end if;
  begin
    perform * from dko_coach_private.members;
    raise exception 'Direct table read unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',coach::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',coach,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  perform public.dko_coach('register',jsonb_build_object('account',coach,'label','Synthetic coach'));
  result:=public.dko_coach_template('save',jsonb_build_object('account',coach,'program',doc->0));
  template_id:=(result->>'id')::uuid;
  if (public.dko_coach_template('read',jsonb_build_object('account',coach,'id',template_id))->>'revision')<>'1' then
    raise exception 'Template save failed';
  end if;
  begin
    perform * from dko_coach_private.templates;
    raise exception 'Direct template read unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  result:=public.dko_coach('join',jsonb_build_object('account',coach,'code',code));
  if result->>'mode'<>'full' then raise exception 'Full link missing'; end if;
  result:=public.dko_coach('read',jsonb_build_object('account',coach,'student',student));
  if result ? 'code' or result ? 'settings' or result ? 'body' then raise exception 'Private data leaked'; end if;
  doc:=jsonb_set(doc,'{0,seances,0,ex,0,sets}','4');
  result:=public.dko_coach('publish',jsonb_build_object('account',coach,'student',student,'revision',1,'programs',doc));
  if result->>'revision'<>'2' then raise exception 'Publication failed'; end if;
  begin
    perform public.dko_coach('publish',jsonb_build_object('account',coach,'student',student,'revision',1,'programs',doc));
    raise exception 'Stale revision accepted';
  exception when serialization_failure then null;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',student::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',student,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  begin
    perform public.dko_coach_template('read',jsonb_build_object('account',student,'id',template_id));
    raise exception 'Student read coach template';
  exception when insufficient_privilege then null;
  end;
  perform public.dko_coach('permission',jsonb_build_object('account',student,'coach',coach,'mode','read'));
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',coach::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',coach,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  begin
    perform public.dko_coach_template('read',jsonb_build_object('account',stranger,'id',template_id));
    raise exception 'Stranger read coach template';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.dko_coach('publish',jsonb_build_object('account',coach,'student',student,'revision',2,'programs',doc));
    raise exception 'Read-only publication accepted';
  exception when insufficient_privilege then null;
  end;
  result:=public.dko_coach('join',jsonb_build_object('account',coach,'code',code));
  if result->>'mode'<>'read' then raise exception 'Read-only link elevated'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',stranger::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',stranger,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  begin
    perform public.dko_coach('read',jsonb_build_object('account',stranger,'student',student));
    raise exception 'Unlinked account read allowed';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end $$;
rollback;
select 'PASS: coach access, private templates, JWT ownership, program CAS, read-only rights and unlinked account isolation; all fixtures rolled back' as result;
