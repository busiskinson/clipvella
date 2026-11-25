"use client";

import { useRef, useState } from "react";
import { FileVideo, Link2, Replace, UploadCloud, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardHeader, GlassCard } from "@/components/common/page";
import { SceneThumb } from "@/components/common/scene-thumb";
import { useClipperStore } from "@/stores/clipper-store";
import { formatBytes, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

const PLATFORMS: { name: string; test: RegExp }[] = [
  { name: "YouTube", test: /(^|\.)(youtube\.com|youtu\.be)$/i },
  { name: "TikTok", test: /(^|\.)tiktok\.com$/i },
  { name: "Facebook", test: /(^|\.)(facebook\.com|fb\.watch)$/i },
  { name: "Instagram", test: /(^|\.)instagram\.com$/i },
  { name: "Vimeo", test: /(^|\.)vimeo\.com$/i },
  { name: "X", test: /(^|\.)(x\.com|twitter\.com)$/i },
];

export function detectPlatform(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return PLATFORMS.find((p) => p.test.test(url.hostname))?.name ?? null;
  } catch {
    return null;
  }
}

const MAX_BYTES = 4 * 1024 * 1024 * 1024;

export function SourceInput() {
  const source = useClipperStore((s) => s.source);
  const setSource = useClipperStore((s) => s.setSource);
  const setDuration = useClipperStore((s) => s.setSourceDuration);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  const acceptFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setFileError("That file is not a video. Try MP4, MOV or WebM.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError("Files up to 4 GB are supported.");
      return;
    }
    setFileError(null);
    setSource({ kind: "file", name: file.name, url: URL.createObjectURL(file), size: file.size, duration: 0 });
  };

  const submitUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const platform = detectPlatform(url);
    if (!platform) {
      setUrlError("Paste a full link from YouTube, TikTok, Facebook, Instagram, Vimeo or X.");
      return;
    }
    setUrlError(null);
    // Without the media service the length of a remote video is unknown.
    setSource({ kind: "url", name: url.trim(), url: url.trim(), duration: 0, platform });
  };

  return (
    <GlassCard className="p-5 sm:p-6">
      <CardHeader icon={FileVideo} title="Source video" description="Upload a file or paste a link to a video you have rights to use." />

      {source ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] sm:items-center">
          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black">
            {source.kind === "file" ? (
              <video
                src={source.url}
                controls
                className="aspect-video w-full"
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              >
                <track kind="captions" />
              </video>
            ) : (
              <div className="relative grid aspect-video place-items-center">
                {source.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote platform thumbnail, host varies
                  <img src={source.thumbnail} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <SceneThumb hue={2} className="absolute inset-0" subject={false} />
                )}
                <span className="relative rounded-full bg-black/60 px-3 py-1 text-xs backdrop-blur-md">
                  {source.platform} · playback needs the media service
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={source.name}>
              {source.name}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                <dt className="text-xs text-muted-foreground">{source.kind === "file" ? "Size" : "Platform"}</dt>
                <dd className="mt-0.5 font-medium">{source.kind === "file" ? formatBytes(source.size ?? 0) : source.platform}</dd>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                <dt className="text-xs text-muted-foreground">Length</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {source.duration ? formatDuration(source.duration) : source.kind === "url" ? "Unknown" : "Reading…"}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex gap-2">
              <Button variant="glass" size="sm" onClick={() => setSource(null)}>
                <Replace aria-hidden /> Replace
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSource(null)} aria-label="Remove source">
                <X aria-hidden /> Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Tabs defaultValue="upload" className="mt-5">
          <TabsList className="h-10 w-full bg-black/25 p-1 sm:w-auto">
            <TabsTrigger value="upload" className="px-4">
              <UploadCloud aria-hidden /> Upload
            </TabsTrigger>
            <TabsTrigger value="url" className="px-4">
              <Link2 aria-hidden /> Paste link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                acceptFile(e.dataTransfer.files[0]);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center transition-colors duration-200",
                dragging ? "border-violet/70 bg-violet/[0.08]" : "border-white/15 bg-white/[0.015]",
              )}
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-violet/15 text-lavender ring-1 ring-violet/25">
                <UploadCloud aria-hidden className="size-6" />
              </span>
              <div>
                <p className="font-medium">Drag and drop a video here</p>
                <p className="mt-1 text-sm text-muted-foreground">MP4, MOV or WebM, up to 4 GB. Stays on your device in this demo.</p>
              </div>
              <Button onClick={() => fileRef.current?.click()}>Choose file</Button>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="sr-only"
                aria-label="Choose a video file"
                onChange={(e) => {
                  acceptFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {fileError && (
                <p role="alert" className="text-sm text-destructive">
                  {fileError}
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="url" className="mt-4">
            <form onSubmit={submitUrl} className="grid gap-2" noValidate>
              <Label htmlFor="source-url">Video link</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="source-url"
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (urlError) setUrlError(null);
                  }}
                  placeholder="https://www.youtube.com/watch?v=…"
                  aria-invalid={!!urlError}
                  aria-describedby="source-url-help"
                  className="h-10 flex-1"
                />
                <Button type="submit" className="h-10">
                  Import link
                </Button>
              </div>
              <p id="source-url-help" className={cn("text-xs", urlError ? "text-destructive" : "text-muted-foreground")}>
                {urlError ?? "Supported: YouTube, TikTok, Facebook, Instagram, Vimeo, X. Only import videos you own or have permission to use."}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => (
                  <span key={p.name} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-muted-foreground">
                    {p.name}
                  </span>
                ))}
              </div>
            </form>
          </TabsContent>
        </Tabs>
      )}
    </GlassCard>
  );
}
