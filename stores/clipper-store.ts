"use client";

import { create } from "zustand";
import type { AspectRatio } from "@/lib/types";

export type ClipLength = "auto" | "15-30" | "30-60" | "60-90";
export type TrackingMode = "auto" | "active-speaker" | "multi";

/** Clipper settings only — all processing state lives in the jobs/clips tables. */
interface ClipperState {
  clipLength: ClipLength;
  aspect: AspectRatio;
  clipCount: number;
  tracking: boolean;
  trackingMode: TrackingMode;
  trackingSmoothness: number;
  autoSubtitles: boolean;
  subtitleLanguage: string;
  subtitleTemplate: string;
  set: (
    patch: Partial<
      Pick<ClipperState, "clipLength" | "aspect" | "clipCount" | "tracking" | "trackingMode" | "trackingSmoothness" | "autoSubtitles" | "subtitleLanguage" | "subtitleTemplate">
    >,
  ) => void;
}

export const useClipperStore = create<ClipperState>()((set) => ({
  clipLength: "30-60",
  aspect: "9:16",
  clipCount: 6,
  tracking: true,
  trackingMode: "auto",
  trackingSmoothness: 60,
  autoSubtitles: true,
  subtitleLanguage: "auto",
  subtitleTemplate: "karaoke-violet",
  set: (patch) => set(patch),
}));
