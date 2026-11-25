"use client";

import { create } from "zustand";
import type { AspectRatio, ClipProps, MediaItem, TimelineClip, Track } from "@/lib/types";
import { clamp, uid } from "@/lib/format";

export const DEFAULT_PROPS: ClipProps = {
  opacity: 100,
  scale: 100,
  rotation: 0,
  positionX: 0,
  positionY: 0,
  volume: 100,
  speed: 1,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  effect: "none",
};

const INITIAL_TRACKS: Track[] = [
  { id: "t-overlay", kind: "overlay", name: "Text & overlays", muted: false, locked: false, hidden: false },
  { id: "t-video", kind: "video", name: "Main video", muted: false, locked: false, hidden: false },
  { id: "t-caption", kind: "caption", name: "Captions", muted: false, locked: true, hidden: false },
  { id: "t-audio", kind: "audio", name: "Music", muted: false, locked: false, hidden: false },
];

const SAMPLE_MEDIA: MediaItem[] = [
  { id: "m-intro", name: "intro_hook.mp4", kind: "video", duration: 8, hue: 0 },
  { id: "m-interview", name: "interview_a-cam.mp4", kind: "video", duration: 42, hue: 3 },
  { id: "m-broll", name: "broll_city.mp4", kind: "video", duration: 15, hue: 1 },
  { id: "m-music", name: "midnight_notebook.wav", kind: "audio", duration: 150, hue: 2 },
];

const INITIAL_CLIPS: TimelineClip[] = [
  { id: "k1", trackId: "t-video", name: "intro_hook.mp4", start: 0, duration: 6, sourceIn: 0, mediaId: "m-intro", hue: 0, props: { ...DEFAULT_PROPS } },
  { id: "k2", trackId: "t-video", name: "interview_a-cam.mp4", start: 6, duration: 12, sourceIn: 4, mediaId: "m-interview", hue: 3, props: { ...DEFAULT_PROPS } },
  { id: "k3", trackId: "t-video", name: "broll_city.mp4", start: 18, duration: 8, sourceIn: 2, mediaId: "m-broll", hue: 1, props: { ...DEFAULT_PROPS, saturation: 12 } },
  { id: "k4", trackId: "t-overlay", name: "Title: The one habit", start: 1, duration: 4, sourceIn: 0, hue: 5, props: { ...DEFAULT_PROPS, positionY: -30 } },
  { id: "k5", trackId: "t-audio", name: "midnight_notebook.wav", start: 0, duration: 26, sourceIn: 0, mediaId: "m-music", hue: 2, props: { ...DEFAULT_PROPS, volume: 60 } },
];

interface Snapshot {
  clips: TimelineClip[];
  tracks: Track[];
}

interface EditorState extends Snapshot {
  media: MediaItem[];
  playhead: number;
  playing: boolean;
  /** pixels per second */
  zoom: number;
  selectedClipId: string | null;
  past: Snapshot[];
  future: Snapshot[];
  projectName: string;
  aspect: AspectRatio;
  setAspect: (a: AspectRatio) => void;

  // history
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;

  // transport
  setPlayhead: (t: number) => void;
  setPlaying: (p: boolean) => void;
  togglePlay: () => void;
  setZoom: (z: number) => void;

  // media + clips
  addMedia: (m: MediaItem) => void;
  removeMedia: (id: string) => void;
  addClipFromMedia: (mediaId: string) => void;
  addTextOverlay: (text: string) => void;
  select: (id: string | null) => void;
  /** live update without a history entry — call checkpoint() before a drag */
  moveClipLive: (id: string, start: number) => void;
  trimClipLive: (id: string, edge: "start" | "end", time: number) => void;
  updateProps: (id: string, patch: Partial<ClipProps>, record?: boolean) => void;
  renameClip: (id: string, name: string) => void;
  splitAtPlayhead: () => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  toggleTrack: (id: string, key: "muted" | "locked" | "hidden") => void;
  setProjectName: (name: string) => void;
}

export const MIN_ZOOM = 12;
export const MAX_ZOOM = 160;
const HISTORY_LIMIT = 80;

export const useEditorStore = create<EditorState>()((set, get) => {
  /** run a mutation and record the previous state for undo */
  const commit = (fn: (s: EditorState) => Partial<EditorState>) => {
    const s = get();
    const snap: Snapshot = { clips: s.clips, tracks: s.tracks };
    set({ ...fn(s), past: [...s.past, snap].slice(-HISTORY_LIMIT), future: [] });
  };

  const isLocked = (trackId: string) => get().tracks.find((t) => t.id === trackId)?.locked ?? false;

  return {
    clips: INITIAL_CLIPS,
    tracks: INITIAL_TRACKS,
    media: SAMPLE_MEDIA,
    playhead: 3.2,
    playing: false,
    zoom: 48,
    selectedClipId: "k2",
    past: [],
    future: [],
    projectName: "Product launch teaser",
    aspect: "9:16",
    setAspect: (aspect) => set({ aspect }),

    checkpoint: () => {
      const s = get();
      set({ past: [...s.past, { clips: s.clips, tracks: s.tracks }].slice(-HISTORY_LIMIT), future: [] });
    },
    undo: () => {
      const s = get();
      const prev = s.past[s.past.length - 1];
      if (!prev) return;
      set({
        clips: prev.clips,
        tracks: prev.tracks,
        past: s.past.slice(0, -1),
        future: [{ clips: s.clips, tracks: s.tracks }, ...s.future],
      });
    },
    redo: () => {
      const s = get();
      const next = s.future[0];
      if (!next) return;
      set({
        clips: next.clips,
        tracks: next.tracks,
        future: s.future.slice(1),
        past: [...s.past, { clips: s.clips, tracks: s.tracks }],
      });
    },

    setPlayhead: (t) => set({ playhead: clamp(t, 0, timelineDuration(get().clips)) }),
    setPlaying: (playing) => set({ playing }),
    togglePlay: () => {
      const s = get();
      // restart from zero when play is pressed at the end
      if (!s.playing && s.playhead >= contentEnd(s.clips) - 0.05) set({ playhead: 0 });
      set({ playing: !s.playing });
    },
    setZoom: (z) => set({ zoom: clamp(z, MIN_ZOOM, MAX_ZOOM) }),

    addMedia: (m) => set((s) => ({ media: [m, ...s.media] })),
    removeMedia: (id) =>
      commit((s) => ({
        media: s.media.filter((m) => m.id !== id),
        clips: s.clips.filter((c) => c.mediaId !== id),
      })),
    addClipFromMedia: (mediaId) => {
      const m = get().media.find((x) => x.id === mediaId);
      if (!m) return;
      const trackId = m.kind === "audio" ? "t-audio" : "t-video";
      if (isLocked(trackId)) return;
      commit((s) => {
        const end = s.clips.filter((c) => c.trackId === trackId).reduce((n, c) => Math.max(n, c.start + c.duration), 0);
        const clip: TimelineClip = {
          id: uid("k"),
          trackId,
          name: m.name,
          start: end,
          duration: Math.min(m.duration, m.kind === "audio" ? 60 : 20),
          sourceIn: 0,
          mediaId: m.id,
          hue: m.hue,
          props: { ...DEFAULT_PROPS },
        };
        return { clips: [...s.clips, clip], selectedClipId: clip.id };
      });
    },
    addTextOverlay: (text) => {
      if (isLocked("t-overlay")) return;
      commit((s) => {
        const clip: TimelineClip = {
          id: uid("k"),
          trackId: "t-overlay",
          name: text,
          start: s.playhead,
          duration: 3,
          sourceIn: 0,
          hue: 5,
          props: { ...DEFAULT_PROPS },
        };
        return { clips: [...s.clips, clip], selectedClipId: clip.id };
      });
    },
    select: (id) => set({ selectedClipId: id }),
    moveClipLive: (id, start) =>
      set((s) => ({
        clips: s.clips.map((c) => (c.id === id && !isLocked(c.trackId) ? { ...c, start: Math.max(0, start) } : c)),
      })),
    trimClipLive: (id, edge, time) =>
      set((s) => ({
        clips: s.clips.map((c) => {
          if (c.id !== id || isLocked(c.trackId)) return c;
          const end = c.start + c.duration;
          if (edge === "end") return { ...c, duration: Math.max(0.5, time - c.start) };
          const start = clamp(time, Math.max(0, c.start - c.sourceIn), end - 0.5);
          return { ...c, start, duration: end - start, sourceIn: c.sourceIn + (start - c.start) };
        }),
      })),
    updateProps: (id, patch, record = false) => {
      const apply = (s: EditorState) => ({
        clips: s.clips.map((c) => (c.id === id ? { ...c, props: { ...c.props, ...patch } } : c)),
      });
      if (record) commit(apply);
      else set(apply);
    },
    renameClip: (id, name) => commit((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, name } : c)) })),
    splitAtPlayhead: () => {
      const s = get();
      const target =
        s.clips.find((c) => c.id === s.selectedClipId && s.playhead > c.start && s.playhead < c.start + c.duration) ??
        s.clips.find((c) => c.trackId === "t-video" && s.playhead > c.start && s.playhead < c.start + c.duration);
      if (!target || isLocked(target.trackId)) return;
      commit((st) => {
        const cut = st.playhead - target.start;
        const a: TimelineClip = { ...target, duration: cut };
        const b: TimelineClip = { ...target, id: uid("k"), start: st.playhead, duration: target.duration - cut, sourceIn: target.sourceIn + cut };
        return { clips: st.clips.flatMap((c) => (c.id === target.id ? [a, b] : [c])), selectedClipId: b.id };
      });
    },
    deleteSelected: () => {
      const s = get();
      const clip = s.clips.find((c) => c.id === s.selectedClipId);
      if (!clip || isLocked(clip.trackId)) return;
      commit((st) => ({ clips: st.clips.filter((c) => c.id !== clip.id), selectedClipId: null }));
    },
    duplicateSelected: () => {
      const s = get();
      const clip = s.clips.find((c) => c.id === s.selectedClipId);
      if (!clip || isLocked(clip.trackId)) return;
      commit((st) => {
        const end = st.clips.filter((c) => c.trackId === clip.trackId).reduce((n, c) => Math.max(n, c.start + c.duration), 0);
        const copy: TimelineClip = { ...clip, id: uid("k"), start: end, props: { ...clip.props } };
        return { clips: [...st.clips, copy], selectedClipId: copy.id };
      });
    },
    toggleTrack: (id, key) =>
      commit((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, [key]: !t[key] } : t)) })),
    setProjectName: (projectName) => set({ projectName }),
  };
});

export function contentEnd(clips: TimelineClip[]) {
  return clips.reduce((n, c) => Math.max(n, c.start + c.duration), 0);
}

/** Visible timeline length: content plus breathing room, at least 30s. */
export function timelineDuration(clips: TimelineClip[]) {
  return Math.max(30, Math.ceil(contentEnd(clips) + 10));
}
