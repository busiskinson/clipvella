-- Two-user RLS assertions. Run as one statement (e.g. Supabase MCP execute_sql).
-- Everything happens inside a transaction that is rolled back, so no test data remains.
-- Prints 'ALL RLS TESTS PASSED' or raises an exception starting with 'FAIL'.
begin;

insert into auth.users (id, email, aud, role)
values ('11111111-1111-1111-1111-111111111111', 'a@rls.test', 'authenticated', 'authenticated'),
       ('22222222-2222-2222-2222-222222222222', 'b@rls.test', 'authenticated', 'authenticated');

-- ---------- as user A ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.media_assets (kind, bucket, path, size_bytes)
values ('upload', 'uploads', '11111111-1111-1111-1111-111111111111/a/video.mp4', 10);
insert into public.projects (name, kind, aspect) values ('A project', 'edit', '16:9');
insert into public.downloads (url, platform, title, status) values ('https://youtu.be/jNQXAC9IVRw', 'youtube', 'A link', 'analyzed');

do $$
begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL: A should see exactly its own profile'; end if;
  if (select count(*) from public.projects) <> 1 then raise exception 'FAIL: A should see its project'; end if;
  -- users may not create jobs directly (Edge Function only)
  begin
    insert into public.jobs (owner_id, type) values ('11111111-1111-1111-1111-111111111111', 'transcribe');
    raise exception 'FAIL: user inserted a job directly';
  exception when insufficient_privilege then null;
  end;
  -- users may not call the worker RPC
  begin
    perform public.claim_job('attacker');
    raise exception 'FAIL: user called claim_job';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------- as user B ----------
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

do $$
begin
  if (select count(*) from public.projects) <> 0 then raise exception 'FAIL: B can see A projects'; end if;
  if (select count(*) from public.media_assets) <> 0 then raise exception 'FAIL: B can see A assets'; end if;
  if (select count(*) from public.downloads) <> 0 then raise exception 'FAIL: B can see A downloads'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL: B should see only its own profile'; end if;
  begin
    insert into public.projects (owner_id, name, kind, aspect)
    values ('11111111-1111-1111-1111-111111111111', 'spoof', 'edit', '16:9');
    raise exception 'FAIL: B inserted a project owned by A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('uploads', '11111111-1111-1111-1111-111111111111/b-wrote-here.mp4');
    raise exception 'FAIL: B wrote into A storage folder';
  exception when insufficient_privilege then null;
  end;
  if (select (public.usage_summary() ->> 'storage_bytes')::bigint) <> 0 then
    raise exception 'FAIL: usage_summary leaks A storage to B';
  end if;
end $$;

rollback;

select 'ALL RLS TESTS PASSED' as result;
