# Supabase Backend + Free-Tier AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ClipForge's localStorage/demo backend with Supabase (auth, Postgres, Storage, Edge Functions, RLS) and a local Python worker that does real transcription, highlight detection and FFmpeg rendering.

**Architecture:** Browser talks to Supabase directly under RLS (publishable key). Edge Functions do short trusted work (link check, job creation). A Python 3.12 worker on the owner's PC claims rows from `jobs` via `claim_job()`, runs FFmpeg/VAD/PySceneDetect/Groq Whisper/Gemini, writes results and progress; the UI follows progress with Realtime.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`, cacheComponents), `@supabase/supabase-js` + `@supabase/ssr`, Supabase Postgres 17 / Storage / Realtime / Edge Functions (Deno), Python 3.12 via `uv`, `supabase` (py), `httpx`, `scenedetect[opencv]`, `silero-vad` (onnx), FFmpeg (winget), pytest.

**Spec:** `docs/superpowers/specs/2026-11-25-supabase-ai-backend-design.md`

## Global Constraints

- New Supabase project `clipforge-ai`, org `gxkcgqzirqzmojpofccl`, region `ap-southeast-1`; never touch project `fvxrteowgausifbideif`. Create only after the owner confirms the (free) cost.
- Browser env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_MAX_UPLOAD_MB` (default `50`).
- Worker env (`worker/.env`, gitignored): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `WHISPER_MODEL` (default `whisper-large-v3-turbo`), `GEMINI_MODEL` (default `gemini-flash-latest`), `WORKER_ID`.
- Service-role key and AI keys never appear in browser code, `NEXT_PUBLIC_*`, or git.
- No simulated results presented as real. A missing key fails the job with the exact message pattern `"<VAR> isn't set on the worker"`.
- No long processing in Edge Functions.
- Storage buckets private: `uploads`, `media`, `thumbnails`, `captions`; object paths begin with `{auth.uid()}/`.
- Groq request audio ≤ 24 MB; 16 kHz mono; long audio chunked with 2 s overlap and offset timestamps.
- Storage guard: `create-job` refuses when used storage > 95 % of `STORAGE_LIMIT_BYTES` (1 GiB default).
- Single owner: email confirmation off; sign-up disabled after the owner's account exists.
- Keep the existing glassmorphism components/tokens; no redesign. Every user-facing page keeps working.

## Review Focus

- **Oversized or non-video upload** → rejected in the browser before any upload, with the limit in the message (Task 6 test).
- **Silent / speech-free video** → transcription returns no words → `analyze_and_clip` fails with "No speech found in this video" instead of producing empty clips (Task 9 test).
- **Video shorter than the minimum clip length** → one clip spanning the whole video, not an error or a clip past the end (Task 8 test).
- **Gemini returns bad JSON, out-of-range, overlapping or too-short moments** → validator repairs/drops; if none survive the job fails with "The AI didn't return any usable moments" (Task 8 test).
- **Worker offline** → job stays `queued`; UI shows "Waiting for the worker — last seen …" from `worker_status.last_seen`; nothing pretends to progress (Task 10 test).

---

## File Structure

```
supabase/migrations/20261125000001_core_schema.sql      tables, enums, triggers, RLS
supabase/migrations/20261125000002_storage.sql          buckets + storage RLS
supabase/migrations/20261125000003_jobs_rpc.sql         claim_job, heartbeat, requeue, usage_summary, worker_status
supabase/tests/rls.sql                                  two-user RLS assertions (run via execute_sql)
supabase/functions/resolve-link/index.ts                oEmbed lookup (port of app/api/media/resolve)
supabase/functions/create-job/index.ts                  ownership + storage checks, insert job
supabase/functions/_shared/platforms.ts                 copy of lib/platforms.ts parsing (Deno)
lib/supabase/client.ts | server.ts | proxy.ts           @supabase/ssr factories
proxy.ts                                                session refresh + auth redirect
lib/database.types.ts                                   generated types
lib/data/{projects,assets,downloads,jobs,usage,profile}.ts   typed queries used by components
lib/upload.ts                                           validated Storage upload
app/(auth)/login/page.tsx, app/(auth)/signup/page.tsx   auth pages (glass style)
worker/pyproject.toml, worker/.env.example
worker/clipforge_worker/{config,db,storage,loop}.py
worker/clipforge_worker/media/{probe,ffmpeg,vad,scenes}.py
worker/clipforge_worker/ai/{base,groq_whisper,gemini}.py
worker/clipforge_worker/pipelines/{analyze_and_clip,render_clip,transcribe,render_export}.py
worker/clipforge_worker/highlights.py                   validate/snap Gemini moments
worker/tests/...
```

Removed: `stores/project-store.ts`, `stores/downloader-store.ts`, `stores/settings-store.ts` persistence, `app/api/media/*`, sample projects/usage in `lib/sample-data.ts`.

---

### Task 1: Supabase project, schema, storage, RLS

**Files:** Create the three migrations, `supabase/tests/rls.sql`, `lib/database.types.ts`, `.env.local` (gitignored), update `.env.example`.

**Interfaces — Produces:**
- Tables per spec "Data model", plus `worker_status(worker_id text pk, last_seen timestamptz, capabilities jsonb)`.
- Enums: `asset_kind`, `project_kind`, `job_type` (`analyze_and_clip|render_clip|transcribe|render_export`), `job_status`, `clip_status`.
- `claim_job(p_worker_id text) returns jobs` (service_role only; `FOR UPDATE SKIP LOCKED`, oldest `queued`, sets `running`, `attempts+1`).
- `job_heartbeat(p_job_id uuid, p_progress int, p_stage text)`; `requeue_stale_jobs(p_timeout interval default '10 minutes', p_max_attempts int default 3)`.
- `usage_summary() returns json` (security invoker): `{clips, minutes_processed, captions, imports, storage_bytes, activity: [{day, minutes}] x14}`.
- Realtime publication includes `jobs`, `clips`, `worker_status`.

- [ ] **Step 1:** Ask owner to confirm free cost (`get_cost` → `confirm_cost`), then `create_project` and wait for `ACTIVE_HEALTHY`.
- [ ] **Step 2:** Write `supabase/tests/rls.sql`: creates users A and B via `auth.users` inserts, as A inserts a project/asset/job-read, then `set local role authenticated; set local request.jwt.claims = '{"sub":"<B>"}'` and asserts `select count(*) from projects` = 0, B cannot insert a row with `owner_id = A`, B cannot `insert into jobs`, B cannot read `storage.objects` under `A/`.
- [ ] **Step 3:** Run it against the empty project → fails (tables missing).
- [ ] **Step 4:** Apply the three migrations with `apply_migration`. Profiles trigger on `auth.users` insert. Owner-scoped policies: `owner_id = (select auth.uid())` for select/insert/update/delete on user tables; `jobs` select + update(status→`canceled` only) for owner, no insert; storage policies on `(storage.foldername(name))[1] = (select auth.uid())::text`; bucket `file_size_limit` = 50 MB.
- [ ] **Step 5:** Re-run `rls.sql` → all assertions pass; run `get_advisors` (security + performance) → no errors.
- [ ] **Step 6:** `generate_typescript_types` → `lib/database.types.ts`; write URL + publishable key into `.env.local`; disable email confirmation in Auth settings (owner does it in dashboard if MCP can't — record exact steps).
- [ ] **Step 7:** Commit migrations, tests, types, `.env.example`.

### Task 2: Auth (clients, proxy, login/signup, sign-out, profile)

**Files:** Create `lib/supabase/{client,server,proxy}.ts`, `proxy.ts`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `components/auth/auth-form.tsx`, `lib/data/profile.ts`. Modify `app/layout.tsx` (shell only for signed-in routes), `components/shell/topbar.tsx`, `components/settings/settings-view.tsx`, `stores/settings-store.ts` → `lib/data/profile.ts`.

**Interfaces — Produces:** `createClient()` (browser), `createServerSupabase()` (server), `getProfile(): Promise<Profile>`, `updateProfile(patch)`, `useProfile()` hook.

- [ ] **Step 1:** Install `@supabase/supabase-js @supabase/ssr`.
- [ ] **Step 2:** `proxy.ts`: refresh with `getClaims()`; unauthenticated request to any app route → redirect `/login?next=<path>`; `/login`,`/signup`, static assets excluded by matcher.
- [ ] **Step 3:** Auth form: email + password (min 8), visible labels, `role="alert"` errors; signup error "Signups not allowed" → "Sign-ups are closed for this workspace."
- [ ] **Step 4:** Move the app shell into an `(app)` route group so auth pages render without sidebar.
- [ ] **Step 5:** Topbar shows profile name/email; Sign out calls `auth.signOut()` → `/login`. Settings reads/writes `profiles` (display_name, workspace, settings jsonb for defaults).
- [ ] **Step 6:** Verify in browser: `/` redirects to `/login`; sign up owner; lands on dashboard; sign out returns to `/login`. Then disable sign-ups (dashboard) and confirm signup shows the closed message.
- [ ] **Step 7:** `tsc`, lint, commit.

### Task 3: Data layer + My Projects + Dashboard on real data

**Files:** Create `lib/data/{projects,assets,downloads,jobs,usage}.ts`, `lib/signed-url.ts`. Modify `components/projects/*`, `components/dashboard/*`, `components/shell/sidebar-nav.tsx`, `components/common/new-project-dialog.tsx`, `components/shell/quick-search.tsx`, `components/common/use-open-project.ts`, `lib/sample-data.ts`. Delete `stores/project-store.ts`, `stores/media-registry.ts`.

**Interfaces — Produces:**
- `listProjects(filter?: { kind?: ProjectKind }): Promise<ProjectRow[]>`, `createProject(input)`, `renameProject(id, name)`, `duplicateProject(id)`, `deleteProject(id)` (deletes clip/render/thumbnail/caption objects then the row).
- `listAssets(kind?)`, `getSignedUrl(bucket, path, expiresIn = 3600): Promise<string>`.
- `getUsage(): Promise<UsageSummary>` (calls `usage_summary`).
- `useProjects()` / `useUsage()` client hooks (fetch + refetch on mutation).

- [ ] **Step 1:** Map `ProjectRow` → existing `Project` UI type in one adapter (`toUiProject`) so cards stay unchanged.
- [ ] **Step 2:** Replace store usage in projects view, dashboard, quick search, new-project dialog with the data layer; empty states for a new account.
- [ ] **Step 3:** Dashboard stats, activity chart, credits card and sidebar meter read `getUsage()`; labels: "Storage used" + `formatBytes(storage_bytes)` of 1 GB. Remove all "Sample data" notes on now-real data.
- [ ] **Step 4:** Strip sample projects/usage from `lib/sample-data.ts`; remove "Restore sample projects".
- [ ] **Step 5:** Browser check as owner: empty dashboard shows zeros; create a project via dialog → appears in My Projects after reload; rename/duplicate/delete persist.
- [ ] **Step 6:** `tsc`, lint, commit.

### Task 4: Edge Functions + Video Downloader on Supabase

**Files:** Create `supabase/functions/_shared/platforms.ts`, `supabase/functions/resolve-link/index.ts`, `supabase/functions/create-job/index.ts`. Modify `components/downloader/*`. Delete `app/api/media/*`, `stores/downloader-store.ts`.

**Interfaces:**
- `resolve-link` POST `{ url }` → same `ResolveResponse` as `lib/platforms.ts` (JWT required).
- `create-job` POST `{ type: JobType, input: object }` → `{ ok: true, job: JobRow } | { ok: false, code: 'forbidden'|'invalid'|'storage_full', message }`. Checks every referenced `asset_id`/`project_id`/`clip_id` belongs to the caller; computes storage from `media_assets`.
- Client: `resolveLink(url)`, `createJob(type, input)` in `lib/data/jobs.ts` via `supabase.functions.invoke`.
- Deviation from spec: no `sign-download` function — the owner's own session creates signed URLs under storage RLS (`getSignedUrl`, Task 3), which is equally secure and one less deployment.

- [ ] **Step 1:** Deploy both functions with `deploy_edge_function` (verify_jwt true).
- [ ] **Step 2:** Test with curl/`functions.invoke` as owner: YouTube link returns "Me at the zoo"; unsupported link → 400; `create-job` with another user's asset id → 403; with storage over limit (temporarily set env `STORAGE_LIMIT_BYTES=1`) → `storage_full`.
- [ ] **Step 3:** Downloader: history from `downloads` table; link import creates `projects` row (kind `import`, link jsonb); file import uses Task 6 `uploadVideo` → `media_assets` + project (thumbnail uploaded to `thumbnails`). Download button keeps the honest "no authorized source" message (no function call needed).
- [ ] **Step 4:** Browser check: analyze → history row persists across reload; file import appears in My Projects after reload.
- [ ] **Step 5:** Commit.

### Task 5: Worker foundation (env, job loop, providers, media tools)

**Files:** `worker/pyproject.toml`, `worker/.env.example`, `worker/README.md`, `worker/clipforge_worker/{config,db,storage,loop}.py`, `media/{probe,ffmpeg,vad,scenes}.py`, `ai/{base,groq_whisper,gemini}.py`, `worker/tests/test_{ffmpeg,chunking,providers,loop}.py`.

**Interfaces — Produces:**
- `Config.load() -> Config`; `require(name) -> str` raises `MissingConfig("<VAR> isn't set on the worker")`.
- `Db.claim(worker_id) -> Job | None`, `Db.progress(job_id, pct, stage)`, `Db.succeed(job_id, output)`, `Db.fail(job_id, message)`, `Db.beat(worker_id, capabilities)`.
- `probe(path) -> MediaInfo(duration, width, height, has_audio)`.
- `extract_audio(src, dst, sample_rate=16000) -> Path` (mono, opus 24 kbps).
- `cut_clip(src, dst, start, end, aspect, subtitles: Path|None) -> Path`; `thumbnail(src, dst, at) -> Path`.
- `speech_segments(wav) -> list[(start, end)]` (Silero VAD onnx).
- `scene_cuts(video) -> list[float]` (ContentDetector).
- `Transcriber.transcribe(audio: Path, language: str|None) -> Transcript(words: [Word(text,start,end)], segments, language)`; `GroqWhisper` implements it with chunking.
- `HighlightModel.find_moments(transcript, scenes, duration, count, min_len, max_len) -> list[RawMoment]`; `GeminiHighlights` implements it with JSON schema output and 429 backoff (3 retries, 2/4/8 s).
- `run_forever(handlers: dict[JobType, Callable])`: poll every 3 s, heartbeat every 15 s, `requeue_stale_jobs` every 60 s, catches exceptions → `fail(message)`.

- [ ] **Step 1:** Install tooling: `winget install Gyan.FFmpeg`, `winget install astral-sh.uv`; `uv python install 3.12`; `uv sync` in `worker/`.
- [ ] **Step 2:** Write tests: `test_chunk_offsets` (two chunks of 600 s with 2 s overlap → second chunk words offset by 598 s, duplicates in overlap dropped); `test_cut_clip_args` (9:16 from 1920×1080 → `crop=ih*9/16:ih,scale=1080:1920`); `test_missing_key_message` (`require("GROQ_API_KEY")` with empty env raises exact message); `test_loop_marks_failure` (handler raising → `Db.fail` called with its message).
- [ ] **Step 3:** Run `uv run pytest` → failures.
- [ ] **Step 4:** Implement modules to the interfaces above.
- [ ] **Step 5:** `uv run pytest` → pass; `uv run python -m clipforge_worker --check` prints FFmpeg/VAD/scenedetect OK and which keys are set (names only).
- [ ] **Step 6:** Commit (never `worker/.env`).

### Task 6: Validated uploads

**Files:** Create `lib/upload.ts`, `lib/upload.test.ts` (vitest added as dev dependency, `npm test`).

**Interfaces — Produces:** `validateVideo(file: File, maxMb: number): { ok: true } | { ok: false, message: string }`; `uploadVideo(file, opts: { onProgress }) -> Promise<AssetRow>` (path `{uid}/{assetId}/{safeName}`, inserts `media_assets` with probe data read in the browser).

- [ ] **Step 1:** Tests: 60 MB file with limit 50 → `"This file is 60 MB. The upload limit is 50 MB."`; `text/plain` → `"That file isn't a video. Use MP4, MOV or WebM."`; 10 MB mp4 → ok.
- [ ] **Step 2:** Run → fail. **Step 3:** Implement. **Step 4:** Run → pass.
- [ ] **Step 5:** Commit.

### Task 7: Transcription pipeline + Caption Studio

**Files:** `worker/clipforge_worker/pipelines/transcribe.py`, `worker/tests/test_transcribe.py`; modify `components/captions/*`, `stores/caption-store.ts`; create `lib/captions-export.ts` (+ test).

**Interfaces:** job `transcribe` input `{ asset_id, project_id, language|null }` → writes `transcripts` row and `projects.captions` (lines built from segments, ≤ 42 chars / ≤ 3.5 s each); output `{ transcript_id, lines }`. `toSrt(lines)`, `toVtt(lines)`.

- [ ] **Step 1:** Tests: `test_lines_from_words` (words spanning 9 s → lines each ≤ 3.5 s and ≤ 42 chars, contiguous times); `toSrt` of two lines → exact SRT with `00:00:01,000 --> 00:00:02,500`.
- [ ] **Step 2:** Run → fail. **Step 3:** Implement pipeline + exporters. **Step 4:** Run → pass.
- [ ] **Step 5:** Caption Studio: project/asset picker (projects with a source asset); "Generate subtitles" → `createJob('transcribe')`, live progress from Realtime; preview uses the real video (signed URL) under the overlay; edits and style autosave (debounced 800 ms) to `projects.captions` / `caption_style`; SRT/VTT download buttons. Remove the demo badge.
- [ ] **Step 6:** Commit.

### Task 8: Highlight validation (pure logic)

**Files:** `worker/clipforge_worker/highlights.py`, `worker/tests/test_highlights.py`.

**Interfaces — Produces:** `validate_moments(raw: list[RawMoment], duration, speech, scenes, count, min_len, max_len) -> list[Moment]` raising `NoUsableMoments("The AI didn't return any usable moments")` when empty.

- [ ] **Step 1:** Tests: out-of-range end clamps to duration; overlapping pair keeps higher score; shorter than `min_len` is extended toward the nearest speech/scene boundary or dropped; start snaps to the nearest speech start within 1.5 s; `duration < min_len` → single moment `[0, duration]`; all invalid → `NoUsableMoments`; result sorted by score, at most `count`.
- [ ] **Step 2:** Run → fail. **Step 3:** Implement. **Step 4:** Run → pass. **Step 5:** Commit.

### Task 9: analyze_and_clip + render_clip pipelines

**Files:** `worker/clipforge_worker/pipelines/{analyze_and_clip,render_clip}.py`, `worker/tests/test_analyze.py`.

**Interfaces:** `analyze_and_clip` input `{ project_id, asset_id, count, length: 'auto'|'15-30'|'30-60'|'60-90', aspect, subtitles: bool, language, caption_style }`; stages and progress: probe 5 → audio 10 → vad 20 → transcribe 45 → scenes 55 → highlights 65 → render 65-95 → done 100. Writes `clips` rows (`pending` → `rendering` → `ready`), uploads `media/{uid}/{clip_id}.mp4` + `thumbnails/{uid}/{clip_id}.jpg` (overwrite on re-render), `media_assets` rows kind `clip`. `render_clip` input `{ clip_id }` re-renders after title/time edits.

- [ ] **Step 1:** Tests with fakes for Transcriber/HighlightModel and a 6 s generated FFmpeg test video (`testsrc` + `sine`): `test_no_speech_fails` (empty transcript → job error "No speech found in this video"); `test_creates_clips` (fake model returns 2 moments → 2 clip files exist with probe duration within ±0.2 s of requested).
- [ ] **Step 2:** Run → fail. **Step 3:** Implement (caption burn-in via ASS from transcript words; karaoke `\k` tags when template uses karaoke, plain otherwise). **Step 4:** Run → pass. **Step 5:** Commit.

### Task 10: AI Video Clipper UI on the backend

**Files:** Modify `components/clipper/*`, `stores/clipper-store.ts` (keep UI settings only; drop simulation, heatmap, `buildClips`); create `components/common/job-progress.tsx`, `lib/data/realtime.ts`.

**Interfaces:** `useJob(jobId) -> JobRow | null` (Realtime subscription + initial fetch); `useWorkerStatus() -> { online: boolean, lastSeen: string | null }` (online if `last_seen` < 45 s ago); `<JobProgress job worker />`.

- [ ] **Step 1:** Test (vitest) for `isWorkerOnline(lastSeen, now)` boundaries 44 s → true, 46 s → false.
- [ ] **Step 2:** Run → fail; implement; pass.
- [ ] **Step 3:** Source card: upload (Task 6) or pick an existing project asset; link imports show "Upload the video file to process it" (no fake processing).
- [ ] **Step 4:** Generate → `createJob('analyze_and_clip')`; `<JobProgress>` shows real stage/percent, "Waiting for the worker — last seen …" when offline, error text on failure with Retry.
- [ ] **Step 5:** Results from `clips` (Realtime): real `<video>` previews via signed URLs, editable title/start/end → save + `render_clip`; Download (signed URL with `download`), Open in Editor (adds clip asset to the project timeline). Remove "Simulated"/"Sample results" badges.
- [ ] **Step 6:** Settings "AI services" card reads `worker_status` (online/last seen, `capabilities.keys` names reported by the worker: groq/gemini configured true/false, ffmpeg/vad/scenedetect available) instead of static "Not connected" rows.
- [ ] **Step 7:** Commit.

### Task 11: Video Editor on the backend + export

**Files:** Modify `stores/editor-store.ts`, `components/editor/*`; create `lib/data/timeline.ts`, `worker/clipforge_worker/pipelines/render_export.py`, `worker/tests/test_export.py`.

**Interfaces:** `loadEditorProject(projectId)`, `saveTimeline(projectId, snapshot)` (debounced 1 s autosave, "Saved" indicator); editor URL `/editor?project=<id>` (wrapped in Suspense for `useSearchParams` under cacheComponents). `render_export` input `{ project_id, format: 'mp4'|'webm', resolution: '720p'|'1080p', fps }` renders video-track clips in order with trims/speed, music track volume, canvas aspect; output asset kind `render`; returns `{ asset_id, unsupported: string[] }` listing overlays/effects not rendered.

- [ ] **Step 1:** Test `test_export_concat` (two trims of the 6 s test video → output duration = sum ± 0.2 s, size matches 9:16 1080×1920).
- [ ] **Step 2:** Run → fail; implement; pass.
- [ ] **Step 3:** Media bin lists the user's uploads and clips (signed URLs, real durations); sample media removed; Open-in-editor from Projects/Clipper/Downloader loads the project.
- [ ] **Step 4:** Export dialog creates the job, shows `<JobProgress>`, then a Download button for the render; lists `unsupported` items before export.
- [ ] **Step 5:** Commit.

### Task 12: End-to-end verification and cleanup

- [ ] **Step 1:** `npx tsc --noEmit`, `npx eslint app components lib stores`, `npm test`, `npx next build` → all pass.
- [ ] **Step 2:** `get_advisors` security/performance → no errors; grep the repo and `.next/static` for the service-role key and AI key names' values → none.
- [ ] **Step 3:** Worker on this PC with owner keys present: upload a short spoken video → generate clips → clips play; transcribe in Caption Studio; export from editor → download plays. Without keys: job fails with the exact missing-key message.
- [ ] **Step 4:** Browser responsive pass at 375 px and 1440 px for changed pages; no console errors.
- [ ] **Step 5:** Update `design-system/clipforge-ai/MASTER.md` honesty rules, `worker/README.md` run instructions; commit.
