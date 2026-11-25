"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clapperboard, Download, ExternalLink, FileVideo, FolderPlus, Loader2, Play, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/common/page";
import { Segmented } from "@/components/common/fields";
import type { ResolvedMedia } from "@/lib/platforms";
import { PLATFORM_LABEL } from "@/lib/platforms";
import { formatBytes, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MAX_UPLOAD_MB } from "@/lib/upload";
import { PlatformChip, type LocalFileInfo } from "./shared";

export type Result =
  | { kind: "link"; media: ResolvedMedia; contentType: "video" | "short" | "reel"; projectId?: string }
  | { kind: "file"; info: LocalFileInfo; projectId?: string };

type Format = "mp4" | "mp3";
const VIDEO_QUALITIES = ["1080p", "720p", "480p", "360p"];
const AUDIO_QUALITIES = ["320 kbps", "128 kbps"];

export type DownloadState = { status: "idle" | "working" } | { status: "error" | "done"; message: string };

function Meta({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-sm font-medium", muted && "font-normal text-muted-foreground")}>{value}</dd>
    </div>
  );
}

export function ResultCard({
  result,
  onImport,
  onOpenEditor,
  onOpenClipper,
  onDownload,
  download,
  uploadPct = null,
}: {
  result: Result;
  uploadPct?: number | null;
  onImport: () => void;
  onOpenEditor: () => void;
  onOpenClipper: () => void;
  onDownload: (format: Format, quality: string) => void;
  download: DownloadState;
}) {
  const [format, setFormat] = useState<Format>("mp4");
  const [quality, setQuality] = useState("720p");
  const [previewing, setPreviewing] = useState(false);
  const imported = !!result.projectId;

  const isLink = result.kind === "link";
  const media = isLink ? result.media : null;
  const info = !isLink ? result.info : null;

  const title = media ? media.title ?? `${PLATFORM_LABEL[media.platform]} video` : info!.file.name;
  const thumb = media ? media.thumbnail : info!.thumbnail;
  const portrait = media
    ? result.kind === "link" &&
      (result.contentType !== "video" || (media.frameHeight ?? 0) > (media.frameWidth ?? Infinity) || (media.thumbnailHeight ?? 0) > (media.thumbnailWidth ?? Infinity))
    : info!.height > info!.width;

  // Restrict choices to what the media service reports, when it is connected.
  const serviceFormats = media?.formats ?? null;
  const qualities = (format === "mp4" ? VIDEO_QUALITIES : AUDIO_QUALITIES).filter(
    (q) => !serviceFormats || serviceFormats.some((f) => f.container === format && f.quality === q),
  );
  const effectiveQuality = qualities.includes(quality) ? quality : (qualities[0] ?? "");

  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="grid gap-5 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        {/* preview */}
        <div className={cn("relative mx-auto w-full overflow-hidden rounded-xl border border-white/10 bg-black", portrait ? "aspect-[9/16] max-w-[200px]" : "aspect-video")}>
          {previewing && media?.embedUrl ? (
            <iframe
              src={media.embedUrl}
              title={`${PLATFORM_LABEL[media.platform]} player: ${title}`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="absolute inset-0 size-full border-0"
            />
          ) : thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- platform thumbnails come from varying CDN hosts
            <img src={thumb} alt={`Thumbnail for ${title}`} referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
          ) : (
            <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-muted-foreground">
              <span>
                <FileVideo aria-hidden className="mx-auto mb-2 size-6" />
                No thumbnail available
              </span>
            </div>
          )}
          {media?.embedUrl && !previewing && (
            <button
              type="button"
              onClick={() => setPreviewing(true)}
              className="group absolute inset-0 grid place-items-center bg-black/10 transition-colors hover:bg-black/30"
              aria-label={`Play preview of ${title} with the official ${PLATFORM_LABEL[media.platform]} player`}
            >
              <span className="flex items-center gap-2 rounded-full bg-black/65 px-3.5 py-2 text-sm font-medium backdrop-blur-md transition-transform duration-200 group-hover:scale-105">
                <Play aria-hidden className="size-4 fill-current" /> Play preview
              </span>
            </button>
          )}
          <span className={cn("pointer-events-none absolute top-2 left-2", previewing && "hidden")}>
            {media ? <PlatformChip platform={media.platform} className="h-6 border-white/15 bg-black/60 text-white backdrop-blur-md" /> : (
              <span className="inline-flex h-6 items-center rounded-full border border-white/15 bg-black/60 px-2.5 text-xs font-medium backdrop-blur-md">Local file</span>
            )}
          </span>
        </div>

        {/* details */}
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <h2 className="line-clamp-2 text-lg font-semibold text-pretty">{title}</h2>
            {media?.author && (
              <p className="mt-1 text-sm text-muted-foreground">
                by{" "}
                {media.authorUrl ? (
                  <a href={media.authorUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:text-foreground hover:underline">
                    {media.author}
                  </a>
                ) : (
                  media.author
                )}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {media ? (
              <>
                <Meta label="Platform" value={PLATFORM_LABEL[media.platform]} />
                <Meta label="Duration" value={media.duration ? formatDuration(media.duration) : "Not shared by platform"} muted={!media.duration} />
                <Meta label="Details from" value={media.metadataSource === "oembed" ? "Official oEmbed" : media.metadataSource === "media-service" ? "Media service" : "Link only"} />
              </>
            ) : (
              <>
                <Meta label="Duration" value={formatDuration(info!.duration)} />
                <Meta label="Resolution" value={info!.width ? `${info!.width}×${info!.height}` : "Unknown"} />
                <Meta label="Size" value={formatBytes(info!.file.size)} />
              </>
            )}
          </dl>

          {media?.notice && (
            <p className="flex gap-2 rounded-lg border border-warning/25 bg-warning/[0.07] p-2.5 text-xs text-muted-foreground">
              <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0 text-warning" />
              {media.notice}
            </p>
          )}

          {media && (
            <fieldset className="grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <legend className="sr-only">Download options</legend>
              <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                <span className="text-sm font-medium">Format</span>
                <Segmented<Format>
                  label="Download format"
                  value={format}
                  onChange={(f) => {
                    setFormat(f);
                    setQuality(f === "mp4" ? "720p" : "320 kbps");
                  }}
                  size="sm"
                  options={[
                    { value: "mp4", label: "MP4 · Video" },
                    { value: "mp3", label: "MP3 · Audio" },
                  ]}
                />
                <span className="text-sm font-medium">Quality</span>
                {qualities.length ? (
                  <Segmented<string>
                    label="Download quality"
                    value={effectiveQuality}
                    onChange={setQuality}
                    size="sm"
                    options={qualities.map((q) => ({ value: q, label: q }))}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">Not offered for this video</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {serviceFormats
                  ? "Formats reported by the media service."
                  : "Requested format. Availability is confirmed by the media service when downloads are connected."}
              </p>
            </fieldset>
          )}

          {/* actions */}
          <div className="flex flex-wrap gap-2">
            {imported ? (
              <Button variant="glass" asChild>
                <Link href="/projects">
                  <CheckCircle2 aria-hidden className="text-success" /> In My Projects
                </Link>
              </Button>
            ) : (
              <Button onClick={onImport} disabled={uploadPct !== null}>
                {uploadPct !== null ? <Loader2 aria-hidden className="animate-spin" /> : <FolderPlus aria-hidden />}
                {uploadPct !== null ? `Uploading ${uploadPct}%` : info ? "Upload & import" : "Import to projects"}
              </Button>
            )}
            {media && (
              <Button variant="glass" onClick={() => onDownload(format, effectiveQuality)} disabled={download.status === "working" || !effectiveQuality}>
                {download.status === "working" ? <Loader2 aria-hidden className="animate-spin" /> : <Download aria-hidden />}
                Download {format.toUpperCase()}
              </Button>
            )}
            <Button variant="ghost" onClick={onOpenEditor}>
              <Clapperboard aria-hidden /> Open in Editor
            </Button>
            <Button variant="ghost" onClick={onOpenClipper}>
              <Scissors aria-hidden /> Open in Clipper
            </Button>
            {media && (
              <Button variant="ghost" asChild>
                <a href={media.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden /> View original
                </a>
              </Button>
            )}
          </div>

          {(download.status === "error" || download.status === "done") && (
            <p
              role={download.status === "error" ? "alert" : "status"}
              className={cn(
                "flex gap-2 rounded-lg border p-3 text-sm",
                download.status === "error" ? "border-warning/30 bg-warning/[0.08]" : "border-success/30 bg-success/[0.08]",
              )}
            >
              {download.status === "error" ? <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" /> : <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />}
              <span>
                {download.message}
                {download.status === "error" && (
                  <span className="mt-1 block text-xs text-muted-foreground">You can still import the link to My Projects and work with its details.</span>
                )}
              </span>
            </p>
          )}
          {info && !imported && (
            <p className="text-xs text-muted-foreground">Importing uploads the file to your private Supabase storage (up to {MAX_UPLOAD_MB} MB).</p>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
