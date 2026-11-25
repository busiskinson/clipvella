# ClipForge AI — Supabase backend + free-tier AI processing

**Date:** 2026-11-25 · **Status:** draft for approval · **Branch:** `feat/frontend-foundation`

## Intent

ClipForge today is a Next.js 16 front end whose data lives in `localStorage` and whose AI features are simulated
(see `stores/clipper-store.ts`, `components/captions/caption-list.tsx` "Auto-generate", editor export dialog).
The owner wants a production-oriented app: real accounts, per-user data in Supabase, real media in Supabase
Storage, and real AI — Groq Whisper for transcripts/captions, Gemini for highlight detection and titles,
FFmpeg / PySceneDetect / Silero VAD for processing — without redesigning the existing glassmorphism UI.

## Goals

1. Supabase Auth (email + password) gates the app; every row and file belongs to a user and is protected by RLS.
2. Postgres schema for profiles, media assets, projects, transcripts, clips, downloads and jobs, created by migrations.
3. Private Storage buckets for uploads, generated media, thumbnails and captions.
4. Edge Functions for short secure operations (link check, job creation, signed upload/download URLs).
5. A Python worker, running on the owner's Windows PC, that claims jobs from a `jobs` table and does the long work
   (FFmpeg, VAD, scene detection, Whisper, Gemini), reporting progress the UI shows live via Realtime.
6. Features wired to the backend: Video Downloader, AI Video Clipper, Caption Studio, Video Editor, My Projects, Settings.
7. AI providers behind small adapters so Gemini / Groq can be swapped by configuration.

## Non-goals

- Downloading other people's YouTube/TikTok videos. No authorized API exists for that; links stay "metadata + embed
  preview + import as linked project". Media import into Storage happens through the user's own file upload.
  (A provider interface is left in place so an authorized source — e.g. Facebook Graph for Pages the user manages —
  can be added later.)
- Cloud hosting of the worker (it moves later; the code must not assume Windows-only paths).
- Teams/sharing, billing, GPU acceleration.
- Speaker face-tracking in v1: the clipper reframes with a centre crop; the "speaker tracking" setting is stored and
  shown as "centre crop (face tracking coming later)". See "Left to the builder" for an optional OpenCV upgrade.

## Anti-goals (failure even if it "works")

- Any result that is invented, placeholder or simulated while presented as real (the current demo badges must be
  removed only where the feature is now real; anything still not real keeps an honest label).
- Service-role key or AI keys reachable from the browser or committed to git.
- Long processing inside Edge Functions.
- Breaking existing UI features or the visual design.

## Constraints (verified 2026-11-25)

- **Supabase account:** one org, one unrelated project ("banana-plantation-mapping"). ClipForge gets a **new free
  project** `clipforge-ai` in the same org/region (ap-southeast-1); creation is confirmed with the owner first.
- **Supabase free plan:** 50 MB max file size, 1 GB storage. Upload limit is a config value
  (`NEXT_PUBLIC_MAX_UPLOAD_MB`, default 50, mirrored by bucket `file_size_limit`), with a clear error when exceeded.
- **Groq Whisper (`whisper-large-v3-turbo`):** 25 MB per request on the free tier; word timestamps via
  `response_format=verbose_json` + `timestamp_granularities[]=word,segment`. The worker sends 16 kHz mono
  compressed audio and splits long audio into overlapping chunks, offsetting timestamps.
- **Gemini:** Google no longer publishes fixed free-tier limits; model is configurable (`GEMINI_MODEL`, default the
  current Flash alias). Calls use structured JSON output and retry with backoff on 429.
- **This PC:** Windows 11, Node 26, Python 3.15. FFmpeg, PySceneDetect, Supabase CLI, Docker are not installed.
  Python 3.15 lacks wheels for OpenCV/PyTorch, so the worker runs on **Python 3.12 via `uv`**. FFmpeg is installed
  with winget. Edge Functions are deployed through the Supabase MCP (no CLI needed).
- **Next.js 16:** request hook is `proxy.ts`; `cacheComponents` is on. Supabase SSR guide: `@supabase/ssr`,
  `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `getClaims()` in the proxy to refresh sessions.

## Approaches considered (job hand-off — owner picked 1)

1. **Job table + polling worker (chosen).** Edge Function inserts a `jobs` row; worker claims with
   `FOR UPDATE SKIP LOCKED` via an RPC, writes progress; UI subscribes with Realtime. No extra infrastructure,
   jobs are visible and retryable.
2. Supabase Queues (pgmq): better at scale, more moving parts now; can replace the claim RPC later.
3. Tunnel to the PC so an Edge Function calls the worker: exposes the PC and loses jobs when it is off. Rejected.

Worker location (owner picked): **this PC first**, packaged so it can later run on a cloud host unchanged.

## Architecture

```
Browser (Next.js, publishable key, RLS)
  ├─ Supabase Auth (cookies via @supabase/ssr; proxy.ts refreshes session, redirects to /login)
  ├─ Storage upload (resumable, to uploads/{uid}/...)  ── bucket size limit
  ├─ Postgres reads/writes on own rows (RLS)
  ├─ Realtime: jobs, clips (own rows)
  └─ Edge Functions (JWT verified): resolve-link, create-job, sign-download
            │ inserts jobs (service role inside function, after ownership checks)
            ▼
        jobs table ◄── claim_job() RPC ── Python worker (this PC, service-role key)
                                            ├─ ffprobe / ffmpeg
                                            ├─ Silero VAD (speech segments)
                                            ├─ PySceneDetect (scene cuts)
                                            ├─ Groq Whisper (transcript, word timings)
                                            ├─ Gemini (highlights, titles, descriptions, hashtags)
                                            └─ writes rows + uploads outputs to Storage
```

The existing Next.js routes `/api/media/*` are replaced by the `resolve-link` Edge Function (same parsing code from
`lib/platforms.ts`, ported to Deno) so all secure backend operations live in Supabase.

## Data model (public schema; all tables RLS-enabled, owner-scoped)

- `profiles` (id → auth.users, display_name, workspace, settings jsonb, created_at). Created by trigger on sign-up.
  Replaces the localStorage settings store.
- `media_assets` (id, owner_id, kind: `upload|clip|render|thumbnail|audio`, bucket, path, mime, size_bytes,
  duration_s, width, height, source: `file|link`, source_url, platform, status: `uploading|ready|failed`, created_at).
- `projects` (id, owner_id, name, kind: `clip|edit|captions|import`, aspect, status, source_asset_id → media_assets,
  thumbnail_asset_id, link jsonb (url/platform/author/thumbnail for link imports), timeline jsonb (editor state),
  captions jsonb (lines), caption_style jsonb, settings jsonb (clipper options), created_at, updated_at).
- `transcripts` (id, owner_id, asset_id, provider, model, language, text, segments jsonb, words jsonb, created_at).
- `clips` (id, owner_id, project_id, source_asset_id, start_s, end_s, title, description, hashtags text[], score,
  reason, output_asset_id, thumbnail_asset_id, status: `pending|rendering|ready|failed`, created_at, updated_at).
- `downloads` (id, owner_id, url, platform, title, author, thumbnail_url, status, detail, project_id, created_at).
  Replaces the localStorage download history.
- `jobs` (id, owner_id, type: `analyze_and_clip|render_clip|transcribe|render_export`, status:
  `queued|running|succeeded|failed|canceled`, progress 0-100, stage text, input jsonb, output jsonb, error text,
  attempts, worker_id, locked_at, heartbeat_at, created_at, finished_at).
  Users may select/cancel their own jobs; only Edge Functions (service role) insert; only the worker updates.
  `claim_job(worker_id)` is `security definer`, executable by `service_role` only. Stale running jobs
  (no heartbeat for N minutes) are re-queued up to a max attempt count.

Storage buckets (private): `uploads`, `media`, `thumbnails`, `captions`. Object paths start with the owner's uid;
storage RLS allows a user to read/write only `{auth.uid()}/…`. The worker uses the service role.

## Feature behaviour

- **Auth:** single owner account (see decisions below); `/login`, `/signup` pages in the existing glass style; all app routes require a session (proxy redirect);
  top-bar avatar shows the real user with working sign-out. Sample/demo data is not shown to signed-in users.
- **Video Downloader:** link check via `resolve-link`; history rows in `downloads`; link import creates a project
  with link metadata (no file); file import uploads to Storage → `media_assets` + `projects` row; worker probes it
  (duration, size, thumbnail) — a small `probe` stage inside the first job, or done client-side as today; builder's call.
  The Download button keeps its honest "no authorized source" response.
- **AI Video Clipper:** source = an uploaded asset (new upload or an existing project). "Generate clips" →
  `create-job(analyze_and_clip)` with the existing settings (length range, count, aspect, subtitles on/off, language,
  caption template). Worker pipeline: probe → extract audio → VAD → Whisper → scene detect → Gemini picks moments as
  JSON → validator snaps to speech/scene boundaries, enforces length/count/no overlap → `clips` rows → FFmpeg renders
  each clip (cut, scale/crop to aspect, optional burned captions) → uploads MP4 + thumbnail. UI shows real stage +
  progress, then real clips with playable previews (signed URLs), editable title/start/end (re-render =
  `render_clip` job), download, open in editor.
- **Caption Studio:** choose a project/asset; "Generate subtitles" → `transcribe` job → caption lines saved to
  `projects.captions`; manual editing, styles, animations unchanged and saved to the project; export SRT/VTT
  (generated in the browser or by the worker into `captions` bucket — builder's call).
- **Video Editor:** opens projects from the DB; media bin lists the user's assets (uploads + clips) via signed URLs;
  timeline + caption style autosave to `projects.timeline` (debounced). Export → `render_export` job that renders the
  main video track (order, trims, splits, speed), audio track volume, canvas aspect; overlays/effects that the
  renderer doesn't support are listed in the export dialog rather than silently dropped.
- **My Projects:** projects from the DB with tabs/filters for uploads, imports, AI clips, edits; reopen in the right tool.
- **Settings:** profile + defaults from `profiles`; "AI services" card shows real worker/provider status
  (last worker heartbeat, which keys the worker reported as configured — never the keys themselves).

## Decisions from the builder check (marked as builder calls unless noted)

- **Storage budget (builder call).** Original uploads are kept (the editor and re-renders need them). Extracted audio
  and other intermediates stay in the worker's temp folder and are never uploaded. Re-rendering a clip overwrites its
  file at the same path. Deleting a project deletes its clips, renders, thumbnails and caption files; deleting an
  upload is blocked while projects use it. The UI shows storage used vs the plan limit and `create-job` refuses work
  that would start when storage is over 95 %. Files above the upload limit are rejected with a clear message in v1
  (no browser-side compression); raising the limit is a plan + config change.
- **Dashboard and sidebar meter (builder call).** All `SAMPLE_USAGE` numbers are replaced by real ones computed from
  the user's own rows: clips generated, minutes processed (sum of source durations of succeeded jobs), captions
  created, videos imported, a 14-day activity chart from `jobs`, and "Storage used" (sum of `media_assets.size_bytes`
  vs the limit) in place of "Processing credits". No new usage table — a SQL view/RPC aggregates on demand.
- **Existing localStorage data (builder call).** It is demo data, so it is discarded: the persisted project, download
  and settings stores are removed, "Restore sample projects" is removed, and `lib/sample-data.ts` keeps only static
  catalogues (caption fonts, templates, default caption style, scene gradients) — no sample projects or usage.
- **Who can sign up (owner decided: only the owner).** Email + password, email confirmation **off** (avoids the
  rate-limited built-in mailer). The owner creates their account once; sign-up is then disabled in Supabase Auth
  settings and the `/signup` page shows "Sign-ups are closed" when the API rejects it. No per-user quotas, job rate
  limits or abuse handling are built — single-user scope. RLS stays fully owner-scoped so opening sign-up later
  only needs quotas added, not a data-model change.

## Configuration the owner must provide

| Where | Variable | Notes |
|---|---|---|
| `.env.local` (Next.js) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public by design; filled from the new project |
| `worker/.env` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secret key) | never in the browser or git |
| `worker/.env` | `GROQ_API_KEY`, `GEMINI_API_KEY` | owner creates free keys (console.groq.com, aistudio.google.com) |
| `worker/.env` | `WHISPER_MODEL`, `GEMINI_MODEL` | optional overrides |
| Edge secrets | `META_OEMBED_ACCESS_TOKEN` | optional, Facebook Reels details |

Without a key, the related job fails fast with a clear message ("GROQ_API_KEY isn't set on the worker") — never a
fake result.

## Testing

- Migrations applied via Supabase MCP; RLS verified with SQL as two different users (cannot read each other's rows
  or objects) plus security advisors clean.
- Worker unit tests (pytest): timestamp chunk offsetting, highlight validation/snapping, FFmpeg command building,
  provider error handling.
- Worker integration on this PC with a real short test video: FFmpeg + VAD + scene detection run locally; Whisper and
  Gemini steps run once the owner's keys are present (reported as pending otherwise).
- Front end: type-check, lint, production build, browser walk-through of sign-up → upload → generate → clips →
  captions → editor → projects.

## Left to the builder

- Exact file/module layout, adapter interfaces, prompt wording, retry/backoff values, chunk sizes.
- Whether caption burn-in uses ASS (libass) with karaoke tags or a simpler style in v1.
- Optional OpenCV face detection for speaker-centred crop if it stays cheap; otherwise centre crop.
- Polling interval and heartbeat timeout values.
- Whether thumbnails/probe run client-side or in the worker.
