"use client";

import { create } from "zustand";
import { CAPTION_TEMPLATES, DEFAULT_CAPTION_STYLE, SAMPLE_CAPTIONS } from "@/lib/sample-data";
import type { Caption, CaptionStyle, CaptionWord } from "@/lib/types";
import { clamp, uid } from "@/lib/format";

interface CaptionState {
  captions: Caption[];
  style: CaptionStyle;
  templateId: string | null;
  selectedId: string | null;
  setStyle: (patch: Partial<CaptionStyle>) => void;
  applyTemplate: (id: string) => void;
  resetStyle: () => void;
  select: (id: string | null) => void;
  updateCaption: (id: string, patch: Partial<Omit<Caption, "id">>) => void;
  addCaption: (afterId?: string) => void;
  removeCaption: (id: string) => void;
  splitCaption: (id: string) => void;
  shiftAll: (delta: number) => void;
  replaceAll: (captions: Caption[]) => void;
}

const round = (n: number) => Math.round(n * 10) / 10;

export const useCaptionStore = create<CaptionState>()((set) => ({
  captions: SAMPLE_CAPTIONS,
  style: { ...DEFAULT_CAPTION_STYLE },
  templateId: "karaoke-violet",
  selectedId: SAMPLE_CAPTIONS[0].id,
  setStyle: (patch) => set((s) => ({ style: { ...s.style, ...patch }, templateId: null })),
  applyTemplate: (id) => {
    const tpl = CAPTION_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    set((s) => ({
      style: {
        ...DEFAULT_CAPTION_STYLE,
        position: s.style.position,
        offsetY: s.style.offsetY,
        fontSize: s.style.fontSize,
        ...tpl.style,
      },
      templateId: id,
    }));
  },
  resetStyle: () => set({ style: { ...DEFAULT_CAPTION_STYLE }, templateId: "karaoke-violet" }),
  select: (id) => set({ selectedId: id }),
  updateCaption: (id, patch) =>
    set((s) => ({
      captions: s.captions
        .map((c) => {
          if (c.id !== id) return c;
          const next = { ...c, ...patch };
          next.start = Math.max(0, round(next.start));
          next.end = Math.max(round(next.start + 0.3), round(next.end));
          return next;
        })
        .sort((a, b) => a.start - b.start),
    })),
  addCaption: (afterId) =>
    set((s) => {
      const idx = afterId ? s.captions.findIndex((c) => c.id === afterId) : s.captions.length - 1;
      const prev = s.captions[idx];
      const start = prev ? prev.end : 0;
      const c: Caption = { id: uid("c"), start, end: round(start + 2), text: "New caption" };
      const captions = [...s.captions];
      captions.splice(idx + 1, 0, c);
      return { captions, selectedId: c.id };
    }),
  removeCaption: (id) =>
    set((s) => {
      const captions = s.captions.filter((c) => c.id !== id);
      return { captions, selectedId: s.selectedId === id ? (captions[0]?.id ?? null) : s.selectedId };
    }),
  splitCaption: (id) =>
    set((s) => {
      const c = s.captions.find((x) => x.id === id);
      if (!c) return s;
      const words = c.text.split(/\s+/).filter(Boolean);
      if (words.length < 2) return s;
      const half = Math.ceil(words.length / 2);
      const mid = round(c.start + (c.end - c.start) * (half / words.length));
      const a: Caption = { ...c, end: mid, text: words.slice(0, half).join(" ") };
      const b: Caption = { id: uid("c"), start: mid, end: c.end, text: words.slice(half).join(" ") };
      return { captions: s.captions.flatMap((x) => (x.id === id ? [a, b] : [x])) };
    }),
  shiftAll: (delta) =>
    set((s) => ({
      captions: s.captions.map((c) => {
        const start = clamp(round(c.start + delta), 0, 9999);
        return { ...c, start, end: Math.max(round(start + 0.3), round(c.end + delta)) };
      }),
    })),
  replaceAll: (captions) => set({ captions, selectedId: captions[0]?.id ?? null }),
}));

/** Split a caption into timed words, weighted by character length. */
export function wordsFor(c: Caption): CaptionWord[] {
  const words = c.text.split(/\s+/).filter(Boolean);
  const total = words.reduce((n, w) => n + w.length + 1, 0) || 1;
  let t = c.start;
  return words.map((w) => {
    const d = ((w.length + 1) / total) * (c.end - c.start);
    const word = { text: w, start: t, end: t + d };
    t += d;
    return word;
  });
}
