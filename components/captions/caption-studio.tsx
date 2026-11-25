"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Clapperboard, FileText, FolderOpen, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlassCard } from "@/components/common/page";
import { JobProgress } from "@/components/common/job-progress";
import { useOpenProject } from "@/components/common/use-open-project";
import { captionFontVariables } from "@/lib/caption-fonts";
import { createClient } from "@/lib/supabase/client";
import { createProject, getProjectRow, getSignedUrl, updateProject, type ProjectRow } from "@/lib/data/projects";
import { createJob, latestJob, useJob } from "@/lib/data/jobs";
import { useProjects } from "@/lib/data/hooks";
import { uploadVideo, validateVideo } from "@/lib/upload";
import { downloadText, toSrt, toVtt } from "@/lib/captions-export";
import type { Json } from "@/lib/database.types";
import type { Caption, CaptionStyle } from "@/lib/types";
import { useCaptionStore } from "@/stores/caption-store";
import { useSettingsStore } from "@/stores/settings-store";
import { aspectFromSize } from "@/components/downloader/shared";
import { CaptionPreview } from "./caption-preview";
import { CaptionList } from "./caption-list";
import { StylePanel } from "./style-panel";

type SaveState = "idle" | "saving" | "saved" | "error";

export function CaptionStudio() {
  const router = useRouter();
  const projectId = useSearchParams().get("project");
  const { openInEditor } = useOpenProject();
  const { data: projects } = useProjects();
  const language = useSettingsStore((s) => s.captionLanguage);
  const captions = useCaptionStore((s) => s.captions);
  const style = useCaptionStore((s) => s.style);
  const loadProject = useCaptionStore((s) => s.loadProject);

  const [time, setTime] = useState(0);
  const [loaded, setLoaded] = useState<{ id: string; project: ProjectRow; videoUrl: string | null; aspect: string } | null>(null);
  const [jobFor, setJobFor] = useState<{ id: string; jobId: string | null }>({ id: "", jobId: null });
  const [save, setSave] = useState<SaveState>("idle");
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const hydrated = useRef<string | null>(null);

  const current = projectId && loaded?.id === projectId ? loaded : null;
  const jobId = projectId && jobFor.id === projectId ? jobFor.jobId : null;
  const job = useJob(jobId);

  const candidates = useMemo(() => (projects ?? []).filter((p) => p.sourceAssetId), [projects]);

  // Load project, its video and saved captions/style.
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    (async () => {
      try {
        const p = await getProjectRow(projectId);
        let videoUrl: string | null = null;
        if (p.source_asset_id) {
          const { data: a } = await createClient().from("media_assets").select("bucket, path").eq("id", p.source_asset_id).single();
          if (a) videoUrl = await getSignedUrl(a.bucket, a.path);
        }
        const last = await latestJob(projectId, "transcribe");
        if (!alive) return;
        hydrated.current = null;
        loadProject((p.captions as unknown as Caption[]) ?? [], (p.caption_style as unknown as Partial<CaptionStyle>) ?? null);
        hydrated.current = projectId;
        setLoaded({ id: projectId, project: p, videoUrl, aspect: p.aspect });
        setJobFor({ id: projectId, jobId: last?.id ?? null });
        setTime(0);
      } catch (e) {
        toast.error("Couldn't open that project", { description: e instanceof Error ? e.message : undefined });
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId, loadProject]);

  // When transcription finishes, pull the new lines into the editor.
  const jobStatus = job?.status;
  useEffect(() => {
    if (jobStatus !== "succeeded" || !projectId) return;
    getProjectRow(projectId)
      .then((p) => loadProject((p.captions as unknown as Caption[]) ?? [], (p.caption_style as unknown as Partial<CaptionStyle>) ?? null))
      .catch(() => undefined);
  }, [jobStatus, projectId, loadProject]);

  // Autosave edits (debounced) once the project's own captions are loaded.
  useEffect(() => {
    if (!current || hydrated.current !== current.id) return;
    const handle = setTimeout(async () => {
      setSave("saving");
      try {
        await updateProject(current.id, { captions: captions as unknown as Json, caption_style: style as unknown as Json });
        setSave("saved");
      } catch {
        setSave("error");
      }
    }, 800);
    return () => clearTimeout(handle);
  }, [captions, style, current]);

  const generate = async () => {
    if (!current?.project.source_asset_id) return;
    const res = await createJob("transcribe", { project_id: current.id, asset_id: current.project.source_asset_id, language });
    if (!res.ok) return toast.error("Couldn't start transcription", { description: res.message });
    setJobFor({ id: current.id, jobId: res.job.id });
  };

  const onFile = async (file: File) => {
    const check = validateVideo(file);
    if (!check.ok) return toast.error(check.message);
    setUploadPct(0);
    try {
      const up = await uploadVideo(file, { onProgress: setUploadPct });
      const p = await createProject({
        name: file.name.replace(/\.[^.]+$/, "").slice(0, 200) || "Captions",
        kind: "captions",
        aspect: aspectFromSize(up.info.width, up.info.height),
        sourceAssetId: up.asset.id,
        thumbnailAssetId: up.thumbnail?.id ?? null,
        status: "ready",
      });
      router.replace(`/captions?project=${p.id}`);
    } catch (e) {
      toast.error("Upload failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploadPct(null);
    }
  };

  const base = (current?.project.name ?? "captions").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "captions";
  const busy = !!job && (job.status === "queued" || job.status === "running");
  const frame = current?.aspect === "16:9" ? "16:9" : current?.aspect === "1:1" ? "1:1" : "9:16";

  const generator = current ? (
    current.project.source_asset_id ? (
      <div className="grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles aria-hidden className="size-4 text-lavender" />
          <span className="text-sm">Generate subtitles from speech (Groq Whisper)</span>
          <Button size="sm" variant="glass" className="ml-auto" onClick={() => void generate()} disabled={busy}>
            {busy ? "Transcribing…" : captions.length ? "Regenerate" : "Generate"}
          </Button>
        </div>
        {job && <JobProgress job={job} onRetry={() => void generate()} className="border-0 bg-transparent p-0" />}
        {captions.length > 0 && !busy && <p className="text-xs text-muted-foreground">Regenerating replaces the current lines.</p>}
      </div>
    ) : (
      <p className="rounded-xl border border-warning/25 bg-warning/[0.07] p-3 text-sm text-muted-foreground">
        This project has no video file, so subtitles can&apos;t be generated. You can still type them by hand.
      </p>
    )
  ) : null;

  return (
    <div className="grid gap-6">
      <GlassCard className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FolderOpen aria-hidden className="size-4 shrink-0 text-lavender" />
          <Select value={projectId ?? undefined} onValueChange={(id) => router.replace(`/captions?project=${id}`)}>
            <SelectTrigger aria-label="Project" className="w-full sm:max-w-sm">
              <SelectValue placeholder={candidates.length ? "Choose a project with a video" : "No videos yet — upload one"} />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {current && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
              {save === "saving" ? <Loader2 aria-hidden className="size-3 animate-spin" /> : save === "saved" ? <Check aria-hidden className="size-3 text-success" /> : null}
              {save === "saving" ? "Saving…" : save === "saved" ? "Saved" : save === "error" ? <span className="text-destructive">Not saved</span> : ""}
            </span>
          )}
          <Button variant="glass" size="sm" onClick={() => fileInput.current?.click()} disabled={uploadPct !== null}>
            {uploadPct !== null ? <Loader2 aria-hidden className="animate-spin" /> : <UploadCloud aria-hidden />}
            {uploadPct !== null ? `Uploading ${uploadPct}%` : "Upload video"}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="video/*"
            className="sr-only"
            aria-label="Upload a video for captions"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onFile(f);
            }}
          />
          <Button variant="ghost" size="sm" disabled={!captions.length || !current} onClick={() => downloadText(`${base}.srt`, toSrt(captions), "application/x-subrip")}>
            <FileText aria-hidden /> SRT
          </Button>
          <Button variant="ghost" size="sm" disabled={!captions.length || !current} onClick={() => downloadText(`${base}.vtt`, toVtt(captions), "text/vtt")}>
            <FileText aria-hidden /> VTT
          </Button>
        </div>
      </GlassCard>

      {!current && (
        <p className="text-sm text-muted-foreground">
          {projectId ? "Loading project…" : "Choose a project or upload a video. Until then the preview shows example text so you can try styles."}
        </p>
      )}

      <div
        className={`grid gap-6 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] 2xl:grid-cols-[400px_minmax(0,1fr)_minmax(0,1fr)] ${captionFontVariables}`}
      >
        <GlassCard className="flex flex-col items-center gap-4 p-5 lg:sticky lg:top-22 lg:self-start">
          <CaptionPreview key={current?.id ?? "example"} time={time} setTime={setTime} videoUrl={current?.videoUrl ?? null} defaultFrame={frame} />
          {current && (
            <Button variant="glass" size="sm" onClick={() => openInEditor({ id: current.id })}>
              <Clapperboard aria-hidden /> Open this project in the editor
            </Button>
          )}
        </GlassCard>
        <div className="grid min-w-0 content-start gap-6 2xl:contents">
          <div className="min-w-0 2xl:order-3 2xl:sticky 2xl:top-22 2xl:self-start">
            <StylePanel />
          </div>
          <div className="min-w-0 2xl:order-2">
            <CaptionList time={time} setTime={setTime} generator={generator} />
          </div>
        </div>
      </div>
    </div>
  );
}
