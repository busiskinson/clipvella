"use client";

import { useRef, useState } from "react";
import { FileVideo, FolderOpen, Loader2, Replace, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardHeader, GlassCard } from "@/components/common/page";
import { MAX_UPLOAD_MB, validateVideo } from "@/lib/upload";
import type { AssetRow, ProjectRow } from "@/lib/data/projects";
import type { Project } from "@/lib/types";
import { formatBytes, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SourcePanel({
  project,
  asset,
  videoUrl,
  candidates,
  uploadPct,
  onFile,
  onPick,
}: {
  project: ProjectRow | null;
  asset: AssetRow | null;
  videoUrl: string | null;
  candidates: Project[];
  uploadPct: number | null;
  onFile: (file: File) => void;
  onPick: (projectId: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const uploading = uploadPct !== null;

  const accept = (file: File | undefined) => {
    if (!file) return;
    const check = validateVideo(file);
    if (!check.ok) return setError(check.message);
    setError(null);
    setChanging(false);
    onFile(file);
  };

  const picker = (
    <div className="grid gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors duration-200",
          dragging ? "border-violet/70 bg-violet/[0.08]" : "border-white/15 bg-white/[0.015]",
        )}
      >
        {uploading ? (
          <>
            <Loader2 aria-hidden className="size-6 animate-spin text-lavender" />
            <p className="text-sm" aria-live="polite">
              Uploading… {uploadPct}%
            </p>
            <div className="h-1.5 w-56 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-gradient-to-r from-violet to-ice" style={{ width: `${uploadPct}%` }} />
            </div>
          </>
        ) : (
          <>
            <span className="grid size-12 place-items-center rounded-2xl bg-violet/15 text-lavender ring-1 ring-violet/25">
              <UploadCloud aria-hidden className="size-6" />
            </span>
            <div>
              <p className="font-medium">Drag and drop a video here</p>
              <p className="mt-1 text-sm text-muted-foreground">MP4, MOV or WebM up to {MAX_UPLOAD_MB} MB. Uploads to your private storage.</p>
            </div>
            <Button onClick={() => input.current?.click()}>Choose file</Button>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept="video/*"
          className="sr-only"
          aria-label="Choose a video file"
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      {candidates.length > 0 && !uploading && (
        <div className="grid gap-1.5">
          <label htmlFor="clip-from-project" className="flex items-center gap-2 text-sm font-medium">
            <FolderOpen aria-hidden className="size-4 text-lavender" /> Or use a video from your projects
          </label>
          <Select onValueChange={onPick}>
            <SelectTrigger id="clip-from-project" className="w-full">
              <SelectValue placeholder="Choose a project" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.duration ? ` · ${formatDuration(p.duration)}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  return (
    <GlassCard className="p-5 sm:p-6">
      <CardHeader icon={FileVideo} title="Source video" description="The video the AI will analyze. Use one you own or have permission to use." />
      <div className="mt-5">
        {asset && !changing ? (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] sm:items-center">
            <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black">
              {videoUrl ? (
                <video src={videoUrl} controls preload="metadata" className="aspect-video w-full">
                  <track kind="captions" />
                </video>
              ) : (
                <div className="grid aspect-video place-items-center text-sm text-muted-foreground">Loading preview…</div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" title={asset.file_name ?? ""}>
                {asset.file_name ?? project?.name}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <dt className="text-xs text-muted-foreground">Size</dt>
                  <dd className="mt-0.5 font-medium">{formatBytes(asset.size_bytes)}</dd>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <dt className="text-xs text-muted-foreground">Length</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">{asset.duration_s ? formatDuration(asset.duration_s) : "Unknown"}</dd>
                </div>
              </dl>
              <Button variant="glass" size="sm" className="mt-3" onClick={() => setChanging(true)}>
                <Replace aria-hidden /> Use a different video
              </Button>
            </div>
          </div>
        ) : project?.link && !asset ? (
          <div className="grid gap-4">
            <p className="rounded-xl border border-warning/25 bg-warning/[0.07] p-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{project.name}</span> is a linked video. There&apos;s no authorized way to fetch its
              file, so upload your own copy to clip it.
            </p>
            {picker}
          </div>
        ) : (
          picker
        )}
      </div>
    </GlassCard>
  );
}
