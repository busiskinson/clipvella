-- Worker RPCs (service_role only) and the per-user usage summary (security invoker, RLS applies).

create or replace function public.claim_job(p_worker_id text) returns public.jobs
language plpgsql security definer set search_path = '' as $$
declare j public.jobs;
begin
  select * into j from public.jobs
   where status = 'queued'
   order by created_at
   for update skip locked
   limit 1;
  if not found then
    return null;
  end if;
  update public.jobs
     set status = 'running', attempts = attempts + 1, worker_id = p_worker_id,
         locked_at = now(), heartbeat_at = now(), started_at = coalesce(started_at, now()),
         error = null
   where id = j.id
   returning * into j;
  return j;
end $$;

-- Returns the job's current status so the worker notices a user cancel.
create or replace function public.job_heartbeat(p_job_id uuid, p_progress int, p_stage text)
returns public.job_status
language plpgsql security definer set search_path = '' as $$
declare s public.job_status;
begin
  update public.jobs
     set progress = greatest(0, least(100, p_progress)), stage = p_stage, heartbeat_at = now()
   where id = p_job_id and status = 'running'
   returning status into s;
  if s is null then
    select status into s from public.jobs where id = p_job_id;
  end if;
  return s;
end $$;

create or replace function public.requeue_stale_jobs(p_timeout interval default '10 minutes', p_max_attempts int default 3)
returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.jobs
     set status = case when attempts >= p_max_attempts then 'failed'::public.job_status else 'queued'::public.job_status end,
         error = case when attempts >= p_max_attempts then 'The worker stopped responding while processing this job.' else error end,
         finished_at = case when attempts >= p_max_attempts then now() else null end,
         worker_id = null, locked_at = null
   where status = 'running' and heartbeat_at < now() - p_timeout;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.claim_job(text) from public, anon, authenticated;
revoke all on function public.job_heartbeat(uuid, int, text) from public, anon, authenticated;
revoke all on function public.requeue_stale_jobs(interval, int) from public, anon, authenticated;
grant execute on function public.claim_job(text) to service_role;
grant execute on function public.job_heartbeat(uuid, int, text) to service_role;
grant execute on function public.requeue_stale_jobs(interval, int) to service_role;

-- Real usage numbers for the dashboard; security invoker so RLS limits it to the caller's rows.
create or replace function public.usage_summary() returns json
language sql stable security invoker set search_path = '' as $$
  with processed as (
    select j.finished_at::date as day, a.duration_s
      from public.jobs j
      join public.media_assets a on a.id = nullif(j.input ->> 'asset_id', '')::uuid
     where j.status = 'succeeded' and j.type in ('analyze_and_clip', 'transcribe')
  )
  select json_build_object(
    'clips', (select count(*) from public.clips where status = 'ready'),
    'minutes_processed', coalesce((select round(sum(duration_s) / 60.0)::int from processed), 0),
    'captions', (select count(*) from public.transcripts),
    'imports', (select count(*) from public.projects where kind = 'import'),
    'storage_bytes', coalesce((select sum(size_bytes) from public.media_assets), 0),
    'activity', (
      select json_agg(json_build_object('day', d.day, 'minutes', coalesce(p.minutes, 0)) order by d.day)
        from (select generate_series(current_date - 13, current_date, interval '1 day')::date as day) d
        left join (select day, round(sum(duration_s) / 60.0)::int as minutes from processed group by day) p
          on p.day = d.day
    )
  );
$$;
revoke all on function public.usage_summary() from public, anon;
grant execute on function public.usage_summary() to authenticated;

alter publication supabase_realtime add table public.jobs, public.clips, public.worker_status;
