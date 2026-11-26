/**
 * Edge Function create-job — POST { type, input }
 *
 * The only way jobs enter the queue. Verifies the caller, validates the input shape, checks that every
 * referenced project / asset / clip belongs to the caller, refuses when storage is nearly full, reuses an
 * identical job that is already queued/running, then inserts the row the local worker will claim.
 * No processing happens here.
 */
import { adminClient, callerId, corsHeaders, json } from "../_shared/http.ts";
import { parseVideoLink } from "../_shared/platforms.ts";

type JobType = "analyze_and_clip" | "render_clip" | "transcribe" | "render_export" | "import_url";
type Fail = { ok: false; code: "forbidden" | "invalid" | "storage_full" | "unauthorized" | "server"; message: string };

const ASPECTS = ["9:16", "1:1", "4:5", "16:9"];
const LENGTHS = ["auto", "15-30", "30-60", "60-90"];
const STORAGE_LIMIT = Number(Deno.env.get("STORAGE_LIMIT_BYTES") ?? 1024 * 1024 * 1024);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bad = (message: string): Fail => ({ ok: false, code: "invalid", message });
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const lang = (v: unknown) => v === null || v === undefined || (typeof v === "string" && /^[a-z]{2}(-[A-Z]{2})?$|^auto$/.test(v));

/** Returns a normalised input or a validation failure. */
function validate(type: JobType, input: Record<string, unknown>): { ok: true; input: Record<string, unknown> } | Fail {
  switch (type) {
    case "analyze_and_clip": {
      const count = Number(input.count);
      if (!isUuid(input.project_id) || !isUuid(input.asset_id)) return bad("project_id and asset_id are required.");
      if (!Number.isInteger(count) || count < 1 || count > 12) return bad("count must be between 1 and 12.");
      if (!LENGTHS.includes(String(input.length))) return bad("length must be auto, 15-30, 30-60 or 60-90.");
      if (!ASPECTS.includes(String(input.aspect))) return bad("aspect must be 9:16, 1:1, 4:5 or 16:9.");
      if (!lang(input.language)) return bad("language must be a language code or auto.");
      return {
        ok: true,
        input: {
          project_id: input.project_id,
          asset_id: input.asset_id,
          count,
          length: input.length,
          aspect: input.aspect,
          subtitles: Boolean(input.subtitles),
          language: input.language === "auto" ? null : (input.language ?? null),
          caption_style: typeof input.caption_style === "object" ? input.caption_style : null,
        },
      };
    }
    case "render_clip": {
      if (!isUuid(input.clip_id)) return bad("clip_id is required.");
      const out: Record<string, unknown> = { clip_id: input.clip_id, subtitles: Boolean(input.subtitles), caption_style: input.caption_style ?? null };
      if (input.start_s !== undefined || input.end_s !== undefined) {
        const s = Number(input.start_s);
        const e = Number(input.end_s);
        if (!Number.isFinite(s) || !Number.isFinite(e) || s < 0 || e - s < 1) return bad("start_s and end_s must be valid times at least 1 second apart.");
        out.start_s = s;
        out.end_s = e;
      }
      return { ok: true, input: out };
    }
    case "transcribe":
      if (!isUuid(input.project_id) || !isUuid(input.asset_id)) return bad("project_id and asset_id are required.");
      if (!lang(input.language)) return bad("language must be a language code or auto.");
      return { ok: true, input: { project_id: input.project_id, asset_id: input.asset_id, language: input.language === "auto" ? null : (input.language ?? null) } };
    case "render_export": {
      if (!isUuid(input.project_id)) return bad("project_id is required.");
      if (!["mp4", "webm"].includes(String(input.format))) return bad("format must be mp4 or webm.");
      if (!["720p", "1080p"].includes(String(input.resolution))) return bad("resolution must be 720p or 1080p.");
      if (![24, 30, 60].includes(Number(input.fps))) return bad("fps must be 24, 30 or 60.");
      return { ok: true, input: { project_id: input.project_id, format: input.format, resolution: input.resolution, fps: Number(input.fps) } };
    }
    case "import_url": {
      if (!isUuid(input.project_id)) return bad("project_id is required.");
      if (input.rights_confirmed !== true) return bad("Confirm that you own this video or have permission to use it.");
      const link = parseVideoLink(String(input.url ?? ""));
      if (!link.ok) return bad(link.message);
      return { ok: true, input: { project_id: input.project_id, url: link.url, platform: link.platform, rights_confirmed: true } };
    }
    default:
      return bad("Unknown job type.");
  }
}

async function handle(req: Request): Promise<Response> {
  const uid = await callerId(req);
  if (!uid) return json({ ok: false, code: "unauthorized", message: "Sign in to start processing." } satisfies Fail, 401);

  let body: { type?: JobType; input?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json(bad("Send a JSON body with type and input."), 400);
  }
  const v = validate(body.type as JobType, body.input ?? {});
  if (!v.ok) return json(v, 400);
  const input = v.input;
  const db = adminClient();

  // ---- ownership ----
  let projectId = (input.project_id as string | undefined) ?? null;
  if (body.type === "render_clip") {
    const { data: clip } = await db.from("clips").select("id, project_id").eq("id", input.clip_id).eq("owner_id", uid).maybeSingle();
    if (!clip) return json({ ok: false, code: "forbidden", message: "That clip isn't yours or no longer exists." } satisfies Fail, 403);
    projectId = clip.project_id;
  }
  if (projectId) {
    const { data: p } = await db.from("projects").select("id").eq("id", projectId).eq("owner_id", uid).maybeSingle();
    if (!p) return json({ ok: false, code: "forbidden", message: "That project isn't yours or no longer exists." } satisfies Fail, 403);
  }
  if (input.asset_id) {
    const { data: a } = await db
      .from("media_assets")
      .select("id, kind, status")
      .eq("id", input.asset_id)
      .eq("owner_id", uid)
      .maybeSingle();
    if (!a) return json({ ok: false, code: "forbidden", message: "That video isn't yours or no longer exists." } satisfies Fail, 403);
    if (a.status !== "ready") return json(bad("That video hasn't finished uploading."), 400);
  }

  // ---- storage guard ----
  const { data: sizes, error: sErr } = await db.from("media_assets").select("size_bytes").eq("owner_id", uid);
  if (sErr) return json({ ok: false, code: "server", message: sErr.message } satisfies Fail, 500);
  const used = (sizes ?? []).reduce((n: number, r: { size_bytes: number }) => n + Number(r.size_bytes), 0);
  if (used > STORAGE_LIMIT * 0.95) {
    return json(
      { ok: false, code: "storage_full", message: "Storage is over 95% full. Delete some projects or media before processing more videos." } satisfies Fail,
      409,
    );
  }

  // ---- idempotency: reuse an identical active job ----
  const { data: active } = await db
    .from("jobs")
    .select("*")
    .eq("owner_id", uid)
    .eq("type", body.type)
    .in("status", ["queued", "running"])
    .eq("input", JSON.stringify(input))
    .limit(1);
  if (active && active.length) return json({ ok: true, job: active[0], reused: true });

  const { data: job, error } = await db
    .from("jobs")
    .insert({ owner_id: uid, project_id: projectId, type: body.type, input })
    .select()
    .single();
  if (error) return json({ ok: false, code: "server", message: error.message } satisfies Fail, 500);
  // only long analyses mark the project busy; the worker settles it back on success, failure or cancel
  if (projectId && (body.type === "analyze_and_clip" || body.type === "transcribe" || body.type === "import_url")) {
    await db.from("projects").update({ status: "processing" }).eq("id", projectId);
  }
  return json({ ok: true, job });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(bad("Use POST."), 405);
  try {
    return await handle(req);
  } catch (e) {
    return json({ ok: false, code: "server", message: e instanceof Error ? e.message : "Unexpected error" } satisfies Fail, 500);
  }
});
