"use client";

import type { AspectRatio, SupportedPlatform } from "@/lib/types";
import { PLATFORM_LABEL } from "@/lib/platforms";
import type { HistoryStatus } from "@/stores/downloader-store";
import { cn } from "@/lib/utils";

export const PLATFORM_DOT: Record<SupportedPlatform, string> = {
  tiktok: "bg-[#25F4EE]",
  youtube: "bg-[#FF3D3D]",
  facebook: "bg-[#4C8DFF]",
};

export function PlatformChip({ platform, active, className }: { platform: SupportedPlatform; active?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors duration-200",
        active ? "border-violet/50 bg-violet/[0.16] text-foreground" : "border-white/10 bg-white/[0.03] text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", PLATFORM_DOT[platform])} />
      {PLATFORM_LABEL[platform]}
    </span>
  );
}

export const STATUS_STYLE: Record<HistoryStatus, { label: string; className: string }> = {
  analyzed: { label: "Analyzed", className: "border-white/15 bg-white/[0.06] text-muted-foreground" },
  imported: { label: "Imported", className: "border-success/30 bg-success/10 text-success" },
  downloaded: { label: "Downloaded", className: "border-ice/30 bg-ice/10 text-ice" },
  "download-unavailable": { label: "Needs media service", className: "border-warning/30 bg-warning/10 text-warning" },
  failed: { label: "Failed", className: "border-destructive/30 bg-destructive/10 text-destructive" },
};

export function StatusBadge({ status }: { status: HistoryStatus }) {
  const s = STATUS_STYLE[status];
  return <span className={cn("inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium whitespace-nowrap", s.className)}>{s.label}</span>;
}

/** Closest supported canvas for real pixel dimensions. */
export function aspectFromSize(width: number, height: number): AspectRatio {
  if (!width || !height) return "16:9";
  const r = width / height;
  const options: [AspectRatio, number][] = [["9:16", 9 / 16], ["4:5", 4 / 5], ["1:1", 1], ["16:9", 16 / 9]];
  return options.reduce((best, cur) => (Math.abs(cur[1] - r) < Math.abs(best[1] - r) ? cur : best))[0];
}

export interface LocalFileInfo {
  file: File;
  url: string;
  duration: number;
  width: number;
  height: number;
  /** JPEG data URL of a frame, or null if the browser can't decode the codec */
  thumbnail: string | null;
}

/** Reads real metadata and a poster frame from a local video file — nothing leaves the device. */
export function readLocalVideo(file: File): Promise<LocalFileInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    let settled = false;
    const done = (thumbnail: string | null) => {
      if (settled) return;
      settled = true;
      resolve({ file, url, duration: Number.isFinite(video.duration) ? video.duration : 0, width: video.videoWidth, height: video.videoHeight, thumbnail });
    };
    let probing = false;
    const seekToPoster = () => {
      video.currentTime = Math.min(1, (Number.isFinite(video.duration) ? video.duration : 2) / 2);
    };
    video.onloadedmetadata = () => {
      // Some WebM files (e.g. browser recordings) report Infinity until the end is reached.
      if (!Number.isFinite(video.duration)) {
        probing = true;
        video.currentTime = 1e101;
      } else seekToPoster();
    };
    video.ondurationchange = () => {
      if (probing && Number.isFinite(video.duration)) {
        probing = false;
        seekToPoster();
      }
    };
    video.onseeked = () => {
      if (probing) return;
      try {
        const w = 360;
        const h = Math.round((video.videoHeight / video.videoWidth) * w) || 202;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
        done(canvas.toDataURL("image/jpeg", 0.72));
      } catch {
        done(null);
      }
    };
    video.onerror = () => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      reject(new Error("This browser can't read that video. Try an MP4 (H.264) or WebM file."));
    };
    // Some codecs load metadata but never seek; fall back without a thumbnail.
    setTimeout(() => video.readyState >= 1 && done(null), 6000);
    video.src = url;
  });
}
