"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Clapperboard, Copy, Download, Flame, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobProgress } from "@/components/common/job-progress";
import { useOpenProject } from "@/components/common/use-open-project";
import { updateClip, type ClipView } from "@/lib/data/clips";
import { createJob, useJob } from "@/lib/data/jobs";
import { createProject, getSignedUrl } from "@/lib/data/projects";
import type { AspectRatio } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const ASPECT_CLASS: Record<AspectRatio, string> = { "9:16": "aspect-[9/16]", "1:1": "aspect-square", "4:5": "aspect-[4/5]", "16:9": "aspect-video" };

function scoreTone(score: number | null) {
  if ((score ?? 0) >= 85) return "text-success border-success/30 bg-success/10";
  if ((score ?? 0) >= 70) return "text-lavender border-violet/30 bg-violet/10";
  return "text-muted-foreground border-white/15 bg-white/[0.06]";
}

export function ClipResults({
  clips,
  aspect,
  subtitles,
  captionStyle,
  loading,
}: {
  clips: ClipView[];
  aspect: AspectRatio;
  subtitles: boolean;
  captionStyle: Record<string, unknown> | null;
  loading: boolean;
}) {
  if (loading && clips.length === 0) return null;
  if (clips.length === 0) return null;
  const wide = aspect === "16:9";
  return (
    <section aria-labelledby="clips-heading" className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 id="clips-heading" className="text-lg font-semibold">
          Generated clips
        </h2>
        <span className="text-xs text-muted-foreground">Best score first</span>
      </div>
      <ul className={cn("grid gap-4", wide ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3")}>
        {clips.map((clip, i) => (
          <motion.li key={clip.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.04 }}>
            <ClipCard clip={clip} aspect={aspect} subtitles={subtitles} captionStyle={captionStyle} />
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

function ClipCard({ clip, aspect, subtitles, captionStyle }: { clip: ClipView; aspect: AspectRatio; subtitles: boolean; captionStyle: Record<string, unknown> | null }) {
  const { openInEditor } = useOpenProject();
  const [title, setTitle] = useState(clip.title);
  const [start, setStart] = useState(String(clip.start_s));
  const [end, setEnd] = useState(String(clip.end_s));
  const [jobId, setJobId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const job = useJob(jobId);
  const rendering = clip.status === "pending" || clip.status === "rendering" || (job && (job.status === "queued" || job.status === "running"));

  const s = Number(start);
  const e = Number(end);
  const timeError = !Number.isFinite(s) || !Number.isFinite(e) || s < 0 ? "Enter valid times." : e - s < 1 ? "A clip must be at least 1 second long." : null;
  const dirty = title !== clip.title || s !== clip.start_s || e !== clip.end_s;

  const saveAndRender = async () => {
    if (timeError) return;
    setSaving(true);
    try {
      const timesChanged = s !== clip.start_s || e !== clip.end_s;
      if (title !== clip.title) await updateClip(clip.id, { title: title.trim() || clip.title });
      if (timesChanged) {
        // new times are applied by the worker only if the re-render succeeds
        const res = await createJob("render_clip", { clip_id: clip.id, start_s: s, end_s: e, subtitles, caption_style: captionStyle });
        if (!res.ok) throw new Error(res.message);
        setJobId(res.job.id);
      } else toast.success("Clip saved");
    } catch (err) {
      toast.error("Couldn't save the clip", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    if (!clip.video) return;
    try {
      const safe = (clip.title || "clip").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "clip";
      window.location.href = await getSignedUrl("media", clip.video.path, 300, `${safe}.mp4`);
    } catch (err) {
      toast.error("Couldn't start the download", { description: err instanceof Error ? err.message : undefined });
    }
  };

  const toEditor = async () => {
    if (!clip.output_asset_id) return;
    try {
      const p = await createProject({ name: clip.title || "Clip edit", kind: "edit", aspect, sourceAssetId: clip.output_asset_id, thumbnailAssetId: clip.thumbnail_asset_id, status: "ready" });
      openInEditor(p);
    } catch (err) {
      toast.error("Couldn't open the editor", { description: err instanceof Error ? err.message : undefined });
    }
  };

  const copyMeta = async () => {
    const text = [clip.title, clip.description, clip.hashtags.map((h) => `#${h}`).join(" ")].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Title, description and hashtags copied");
    } catch {
      toast.error("Clipboard access was blocked");
    }
  };

  return (
    <article className="glass flex h-full flex-col overflow-hidden rounded-2xl">
      <div className={cn("relative mx-auto w-full bg-black", ASPECT_CLASS[aspect], aspect === "9:16" && "max-h-[420px] w-auto")}>
        {clip.videoUrl && !rendering ? (
          <video src={clip.videoUrl} poster={clip.thumbUrl ?? undefined} controls preload="none" className="absolute inset-0 size-full object-contain">
            <track kind="captions" />
          </video>
        ) : clip.status === "failed" ? (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-destructive">
            <span>
              <AlertTriangle aria-hidden className="mx-auto mb-2 size-5" />
              {clip.error ?? "Rendering failed"}
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Loader2 aria-hidden className="size-4 animate-spin" /> Rendering…
            </span>
          </div>
        )}
        <span className={cn("absolute top-2 left-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md", scoreTone(clip.score))}>
          <Flame aria-hidden className="size-3" />
          {clip.score ?? "–"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <Input aria-label="Clip title" value={title} onChange={(ev) => setTitle(ev.target.value)} className="h-9 font-medium" maxLength={120} />
        {clip.description && <p className="text-xs text-muted-foreground">{clip.description}</p>}
        {clip.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {clip.hashtags.map((h) => (
              <span key={h} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-lavender">
                #{h}
              </span>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Start (s)
            <Input type="number" step={0.1} min={0} value={start} onChange={(ev) => setStart(ev.target.value)} className="h-9 tabular-nums" />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            End (s)
            <Input type="number" step={0.1} min={0} value={end} onChange={(ev) => setEnd(ev.target.value)} className="h-9 tabular-nums" />
          </label>
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          {formatTime(clip.start_s)} – {formatTime(clip.end_s)} · {Math.round(clip.end_s - clip.start_s)}s
          {clip.reason ? ` · ${clip.reason}` : ""}
        </p>
        {timeError && dirty && (
          <p role="alert" className="text-xs text-destructive">
            {timeError}
          </p>
        )}
        {job && <JobProgress job={job} className="p-3" />}

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {dirty && (
            <Button size="sm" onClick={() => void saveAndRender()} disabled={saving || !!timeError}>
              <RefreshCw aria-hidden /> {s !== clip.start_s || e !== clip.end_s ? "Save & re-render" : "Save"}
            </Button>
          )}
          <Button size="sm" variant="glass" onClick={() => void download()} disabled={!clip.video || !!rendering}>
            <Download aria-hidden /> Download
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void toEditor()} disabled={!clip.output_asset_id || !!rendering}>
            <Clapperboard aria-hidden /> Edit
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Copy title, description and hashtags" onClick={() => void copyMeta()}>
            <Copy aria-hidden />
          </Button>
        </div>
      </div>
    </article>
  );
}
