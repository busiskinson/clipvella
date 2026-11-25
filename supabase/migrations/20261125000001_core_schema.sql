-- ClipForge AI core schema: profiles, media, projects, transcripts, clips, downloads, jobs, worker status.
-- Every user table is owner-scoped with RLS. Jobs are inserted by Edge Functions and updated by the worker
-- (service role); users can only read their jobs and cancel them.

create type public.asset_kind as enum ('upload', 'clip', 'render', 'thumbnail', 'audio');
create type public.asset_status as enum ('uploading', 'ready', 'failed');
create type public.project_kind as enum ('clip', 'edit', 'captions', 'import');
create type public.project_status as enum ('draft', 'processing', 'ready');
create type public.job_type as enum ('analyze_and_clip', 'render_clip', 'transcribe', 'render_export');
create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'canceled');
create type public.clip_status as enum ('pending', 'rendering', 'ready', 'failed');

-- ---------- helpers ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Creator' check (char_length(display_name) between 1 and 80),
  workspace text not null default 'My Studio' check (char_length(workspace) between 1 and 80),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(split_part(new.email, '@', 1), ''), 'Creator'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- media assets ----------
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.asset_kind not null,
  bucket text not null check (bucket in ('uploads', 'media', 'thumbnails', 'captions')),
  path text not null,
  file_name text,
  mime text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  duration_s double precision check (duration_s is null or duration_s >= 0),
  width int,
  height int,
  status public.asset_status not null default 'ready',
  created_at timestamptz not null default now(),
  unique (bucket, path)
);
create index media_assets_owner_idx on public.media_assets (owner_id, created_at desc);

-- ---------- projects ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  kind public.project_kind not null,
  aspect text not null default '9:16' check (aspect in ('9:16', '1:1', '4:5', '16:9')),
  status public.project_status not null default 'draft',
  -- an upload cannot be deleted while a project uses it
  source_asset_id uuid references public.media_assets (id) on delete restrict,
  thumbnail_asset_id uuid references public.media_assets (id) on delete set null,
  link jsonb,
  timeline jsonb,
  captions jsonb not null default '[]'::jsonb,
  caption_style jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_idx on public.projects (owner_id, updated_at desc);
create index projects_source_asset_idx on public.projects (source_asset_id);
create index projects_thumbnail_asset_idx on public.projects (thumbnail_asset_id);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------- transcripts ----------
create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  provider text not null,
  model text not null,
  language text,
  text text not null default '',
  segments jsonb not null default '[]'::jsonb,
  words jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index transcripts_owner_idx on public.transcripts (owner_id);
create index transcripts_asset_idx on public.transcripts (asset_id);
create index transcripts_project_idx on public.transcripts (project_id);

-- ---------- clips ----------
create table public.clips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  source_asset_id uuid not null references public.media_assets (id) on delete restrict,
  start_s double precision not null check (start_s >= 0),
  end_s double precision not null,
  title text not null default '',
  description text not null default '',
  hashtags text[] not null default '{}',
  score int check (score is null or score between 0 and 100),
  reason text,
  output_asset_id uuid references public.media_assets (id) on delete set null,
  thumbnail_asset_id uuid references public.media_assets (id) on delete set null,
  status public.clip_status not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_s > start_s)
);
create index clips_owner_idx on public.clips (owner_id);
create index clips_project_idx on public.clips (project_id);
create index clips_source_asset_idx on public.clips (source_asset_id);
create index clips_output_asset_idx on public.clips (output_asset_id);
create index clips_thumbnail_asset_idx on public.clips (thumbnail_asset_id);
create trigger clips_updated_at before update on public.clips
  for each row execute function public.set_updated_at();

-- ---------- download history ----------
create table public.downloads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'link' check (kind in ('link', 'file')),
  url text,
  platform text check (platform is null or platform in ('youtube', 'tiktok', 'facebook')),
  title text not null,
  author text,
  thumbnail_url text,
  status text not null check (status in ('analyzed', 'imported', 'download-unavailable', 'downloaded', 'failed')),
  detail text,
  project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now()
);
create index downloads_owner_idx on public.downloads (owner_id, created_at desc);
create index downloads_project_idx on public.downloads (project_id);

-- ---------- jobs ----------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  type public.job_type not null,
  status public.job_status not null default 'queued',
  progress int not null default 0 check (progress between 0 and 100),
  stage text,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  attempts int not null default 0,
  worker_id text,
  locked_at timestamptz,
  heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index jobs_queue_idx on public.jobs (status, created_at);
create index jobs_owner_idx on public.jobs (owner_id, created_at desc);
create index jobs_project_idx on public.jobs (project_id);

-- ---------- worker status (not user-owned; readable by signed-in users) ----------
create table public.worker_status (
  worker_id text primary key,
  last_seen timestamptz not null default now(),
  capabilities jsonb not null default '{}'::jsonb
);

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.media_assets enable row level security;
alter table public.projects enable row level security;
alter table public.transcripts enable row level security;
alter table public.clips enable row level security;
alter table public.downloads enable row level security;
alter table public.jobs enable row level security;
alter table public.worker_status enable row level security;

create policy "profiles: read own" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['media_assets', 'projects', 'transcripts', 'clips', 'downloads'] loop
    execute format('create policy "%1$s: read own" on public.%1$I for select to authenticated using (owner_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: insert own" on public.%1$I for insert to authenticated with check (owner_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: update own" on public.%1$I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: delete own" on public.%1$I for delete to authenticated using (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

-- jobs: read own; cancel own (only the status column is writable, only to 'canceled')
create policy "jobs: read own" on public.jobs for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "jobs: cancel own" on public.jobs for update to authenticated
  using (owner_id = (select auth.uid()) and status in ('queued', 'running'))
  with check (owner_id = (select auth.uid()) and status = 'canceled');
revoke insert, update, delete on public.jobs from anon, authenticated;
grant update (status) on public.jobs to authenticated;

create policy "worker_status: read" on public.worker_status for select to authenticated using (true);
revoke insert, update, delete on public.worker_status from anon, authenticated;
