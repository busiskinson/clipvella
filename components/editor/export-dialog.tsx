"use client";

import { useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segmented } from "@/components/common/fields";
import { JobProgress } from "@/components/common/job-progress";
import { contentEnd, useEditorStore } from "@/stores/editor-store";
import { useSettingsStore } from "@/stores/settings-store";
import { createJob, useJob } from "@/lib/data/jobs";
import { saveTimeline, toSnapshot } from "@/lib/data/timeline";
import { createClient } from "@/lib/supabase/client";
import { getSignedUrl } from "@/lib/data/projects";
import type { MediaItem, TimelineClip, Track } from "@/lib/types";
import { formatDuration } from "@/lib/format";

type Format = "mp4" | "webm";

/** Mirrors the worker's render_export rules so the user knows before exporting. */
export function unsupportedItems(clips: TimelineClip[], tracks: Track[], media: MediaItem[]): string[] {
  const out = new Set<string>();
  const trackOf = (id: string) => tracks.find((t) => t.id === id);
  for (const c of clips) {
    const t = trackOf(c.trackId);
    if (!t || (t.hidden && t.kind !== "audio")) continue;
    if (t.kind === "overlay") {
      out.add("Text overlays");
      continue;
    }
    const p = c.props;
    if (p.rotation || p.positionX || p.positionY || p.scale !== 100) out.add("Scale, position and rotation");
    if (p.effect !== "none") out.add("Looks (effect presets)");
    if (!media.find((m) => m.id === c.mediaId)?.assetId) out.add("Sample or local-only media (not in your storage)");
  }
  if (!(tracks.find((t) => t.kind === "caption")?.hidden ?? false)) out.add("Caption track (burn captions from the AI Clipper instead)");
  return [...out].sort();
}

export function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const projectId = useEditorStore((s) => s.projectId);
  const projectName = useEditorStore((s) => s.projectName);
  const aspect = useEditorStore((s) => s.aspect);
  const clips = useEditorStore((s) => s.clips);
  const tracks = useEditorStore((s) => s.tracks);
  const media = useEditorStore((s) => s.media);
  const defaults = useSettingsStore();
  const [format, setFormat] = useState<Format>("mp4");
  const [resolution, setResolution] = useState<string>(defaults.exportQuality === "720p" ? "720p" : "1080p");
  const [fps, setFps] = useState<string>(defaults.exportFps);
  const [jobId, setJobId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const job = useJob(jobId);
  const duration = contentEnd(clips);
  const unsupported = unsupportedItems(clips, tracks, media);
  const hasRenderable = clips.some((c) => tracks.find((t) => t.id === c.trackId)?.kind === "video" && media.find((m) => m.id === c.mediaId)?.assetId);

  const start = async () => {
    if (!projectId) return;
    setStarting(true);
    try {
      await saveTimeline(projectId, toSnapshot(useEditorStore.getState()));
      const res = await createJob("render_export", { project_id: projectId, format, resolution, fps: Number(fps) });
      if (!res.ok) throw new Error(res.message);
      setJobId(res.job.id);
    } catch (e) {
      toast.error("Couldn't start the export", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setStarting(false);
    }
  };

  const download = async () => {
    const assetId = (job?.output as { asset_id?: string } | null)?.asset_id;
    if (!assetId) return;
    try {
      const { data: a, error } = await createClient().from("media_assets").select("bucket, path").eq("id", assetId).single();
      if (error) throw error;
      const safe = projectName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "export";
      window.location.href = await getSignedUrl(a.bucket, a.path, 300, `${safe}.${format}`);
    } catch (e) {
      toast.error("Couldn't download the export", { description: e instanceof Error ? e.message : undefined });
    }
  };

  const close = (o: boolean) => {
    if (!o && !(job && (job.status === "queued" || job.status === "running"))) setJobId(null);
    onOpenChange(o);
  };

  const done = job?.status === "succeeded";
  const skipped = ((job?.output as { unsupported?: string[] } | null)?.unsupported ?? []) as string[];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="glass-strong sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Export video</DialogTitle>
          <DialogDescription>
            {projectName} · {aspect} · {formatDuration(duration)} · rendered by FFmpeg on your worker
          </DialogDescription>
        </DialogHeader>

        {!job ? (
          <div className="grid gap-5">
            <div className="grid gap-2">
              <span className="text-sm font-medium">Format</span>
              <Segmented<Format> label="Export format" value={format} onChange={setFormat} options={[{ value: "mp4", label: "MP4" }, { value: "webm", label: "WebM" }]} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="exp-res">Resolution</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger id="exp-res" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="720p">720p</SelectItem>
                    <SelectItem value="1080p">1080p</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="exp-fps">Frame rate</Label>
                <Select value={fps} onValueChange={setFps}>
                  <SelectTrigger id="exp-fps" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 fps</SelectItem>
                    <SelectItem value="30">30 fps</SelectItem>
                    <SelectItem value="60">60 fps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {unsupported.length > 0 && (
              <div className="flex gap-2 rounded-lg border border-warning/25 bg-warning/[0.07] p-3 text-xs text-muted-foreground">
                <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <div>
                  <p className="font-medium text-foreground">Not included in this export yet:</p>
                  <ul className="mt-1 list-disc pl-4">
                    {unsupported.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {!hasRenderable && (
              <p role="alert" className="text-sm text-destructive">
                Add a video from your storage to the main track before exporting.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            <JobProgress job={job} onRetry={() => void start()} />
            {done && skipped.length > 0 && <p className="text-xs text-muted-foreground">Skipped: {skipped.join(", ")}.</p>}
          </div>
        )}

        <DialogFooter>
          {done ? (
            <Button onClick={() => void download()}>
              <Download aria-hidden /> Download {format.toUpperCase()}
            </Button>
          ) : !job ? (
            <>
              <Button variant="ghost" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={() => void start()} disabled={starting || !hasRenderable}>
                <Download aria-hidden /> {starting ? "Starting…" : "Export"}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => close(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
