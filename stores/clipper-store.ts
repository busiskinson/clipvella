"use client";

import { create } from "zustand";
import type { AspectRatio, GeneratedClip } from "@/lib/types";
import { seeded } from "@/lib/format";
import { useMediaRegistry } from "./media-registry";

export type ClipLength = "auto" | "15-30" | "30-60" | "60-90";
export type TrackingMode = "auto" | "active-speaker" | "multi";
export type Phase = "idle" | "analyzing" | "done";

export interface ClipSource {
  kind: "file" | "url";
  name: string;
  /** object URL (file) or the pasted link (url) */
  url: string;
  size?: number;
  /** seconds — read from the video element for files; 0 when unknown (links) */
  duration: number;
  platform?: string;
  thumbnail?: string | null;
}

/** Links have no known length until the media service imports them; the demo analysis uses a nominal 10 min. */
export const analysisDuration = (source: ClipSource | null) => (source?.duration ? source.duration : 600);

export const ANALYSIS_STEPS = [
  { id: "ingest", label: "Preparing video", detail: "Reading container, audio and frame rate" },
  { id: "transcribe", label: "Transcribing speech", detail: "Speech-to-text with word timings" },
  { id: "highlights", label: "Detecting highlights", detail: "Scoring hooks, emotion and pacing" },
  { id: "speakers", label: "Tracking speakers", detail: "Face detection and reframing" },
  { id: "render", label: "Building previews", detail: "Cutting clips and burning captions" },
] as const;

interface ClipperState {
  source: ClipSource | null;
  clipLength: ClipLength;
  aspect: AspectRatio;
  clipCount: number;
  tracking: boolean;
  trackingMode: TrackingMode;
  trackingSmoothness: number;
  autoSubtitles: boolean;
  subtitleLanguage: string;
  subtitleTemplate: string;
  phase: Phase;
  progress: number;
  stepIndex: number;
  clips: GeneratedClip[];
  /** engagement curve 0-1, 60 buckets across the source */
  heatmap: number[];

  setSource: (s: ClipSource | null) => void;
  setSourceDuration: (d: number) => void;
  set: (patch: Partial<Pick<ClipperState, "clipLength" | "aspect" | "clipCount" | "tracking" | "trackingMode" | "trackingSmoothness" | "autoSubtitles" | "subtitleLanguage" | "subtitleTemplate">>) => void;
  start: () => void;
  cancel: () => void;
  removeClip: (id: string) => void;
}

let timer: ReturnType<typeof setInterval> | null = null;

const HOOKS = [
  "The one mistake almost everyone makes",
  "Why this changed my whole approach",
  "Nobody talks about this part",
  "Here is the exact framework",
  "This surprised the entire room",
  "The 10-second version",
  "What I would do differently today",
  "The number that matters most",
  "A story you will not forget",
  "The honest answer",
  "Stop doing this immediately",
  "The turning point",
];
const TAGS = ["Hook", "Insight", "Story", "Humor", "Tutorial", "Quote", "Reaction", "Data"];

const LENGTH_RANGE: Record<ClipLength, [number, number]> = {
  auto: [18, 75],
  "15-30": [15, 30],
  "30-60": [30, 60],
  "60-90": [60, 90],
};

function buildHeatmap(seed: number) {
  const rnd = seeded(seed);
  const out: number[] = [];
  let v = 0.4;
  for (let i = 0; i < 60; i++) {
    v = Math.min(1, Math.max(0.08, v + (rnd() - 0.5) * 0.35));
    out.push(v);
  }
  return out;
}

function buildClips(source: ClipSource, count: number, length: ClipLength, heatmap: number[]): GeneratedClip[] {
  const seed = Array.from(source.name).reduce((n, c) => n + c.charCodeAt(0), 0) + count;
  const rnd = seeded(seed);
  const [minL, maxL] = LENGTH_RANGE[length];
  const dur = Math.max(analysisDuration(source), 20);
  // rank buckets by engagement, take the strongest as clip anchors
  const ranked = heatmap.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const clips: GeneratedClip[] = [];
  for (const { v, i } of ranked) {
    if (clips.length >= count) break;
    const len = Math.min(dur, Math.round(minL + rnd() * (maxL - minL)));
    const center = ((i + 0.5) / heatmap.length) * dur;
    const start = Math.max(0, Math.min(dur - len, center - len / 2));
    const end = start + len;
    if (clips.some((c) => start < c.end && end > c.start)) continue;
    clips.push({
      id: `g${i}`,
      title: HOOKS[clips.length % HOOKS.length],
      hook: `Starts on a strong line at ${Math.floor(start / 60)}:${String(Math.floor(start % 60)).padStart(2, "0")}`,
      start,
      end,
      score: Math.round(62 + v * 36 - rnd() * 4),
      hue: i,
      tags: [TAGS[i % TAGS.length], TAGS[(i + 3) % TAGS.length]],
    });
  }
  return clips.sort((a, b) => b.score - a.score);
}

export const useClipperStore = create<ClipperState>()((set, get) => ({
  source: null,
  clipLength: "30-60",
  aspect: "9:16",
  clipCount: 6,
  tracking: true,
  trackingMode: "auto",
  trackingSmoothness: 60,
  autoSubtitles: true,
  subtitleLanguage: "en",
  subtitleTemplate: "karaoke-violet",
  phase: "idle",
  progress: 0,
  stepIndex: 0,
  clips: [],
  heatmap: [],

  setSource: (source) => {
    const prev = get().source;
    // Files imported through the Video Downloader are shared with My Projects / the editor — keep them alive.
    const shared = Object.values(useMediaRegistry.getState().files).some((f) => f.url === prev?.url);
    if (prev?.kind === "file" && prev.url !== source?.url && !shared) URL.revokeObjectURL(prev.url);
    get().cancel();
    set({ source, phase: "idle", clips: [], heatmap: [], progress: 0, stepIndex: 0 });
  },
  setSourceDuration: (duration) => set((s) => (s.source ? { source: { ...s.source, duration } } : s)),
  set: (patch) => set(patch),

  start: () => {
    const { source } = get();
    if (!source) return;
    if (timer) clearInterval(timer);
    const seed = Array.from(source.name).reduce((n, c) => n + c.charCodeAt(0), 0);
    const heatmap = buildHeatmap(seed);
    set({ phase: "analyzing", progress: 0, stepIndex: 0, clips: [], heatmap });
    // Simulated pipeline: ~5s total. Replace with job status polling / websocket when the API exists.
    timer = setInterval(() => {
      const s = get();
      const progress = Math.min(100, s.progress + 2);
      const stepIndex = Math.min(ANALYSIS_STEPS.length - 1, Math.floor((progress / 100) * ANALYSIS_STEPS.length));
      if (progress >= 100) {
        if (timer) clearInterval(timer);
        timer = null;
        set({
          progress: 100,
          stepIndex: ANALYSIS_STEPS.length,
          phase: "done",
          clips: buildClips(source, s.clipCount, s.clipLength, heatmap),
        });
        return;
      }
      set({ progress, stepIndex });
    }, 100);
  },
  cancel: () => {
    if (timer) clearInterval(timer);
    timer = null;
    if (get().phase === "analyzing") set({ phase: "idle", progress: 0, stepIndex: 0, heatmap: [] });
  },
  removeClip: (id) => set((s) => ({ clips: s.clips.filter((c) => c.id !== id) })),
}));
