"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SAMPLE_MUSIC } from "@/lib/sample-data";
import type { MusicTrack } from "@/lib/types";

interface MusicState {
  tracks: MusicTrack[];
  activeId: string | null;
  playing: boolean;
  addTrack: (t: MusicTrack) => void;
  removeTrack: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setActive: (id: string | null) => void;
  setPlaying: (playing: boolean) => void;
}

export const useMusicStore = create<MusicState>()(
  persist(
    (set) => ({
      tracks: SAMPLE_MUSIC,
      activeId: SAMPLE_MUSIC[0]?.id ?? null,
      playing: false,
      addTrack: (t) => set((s) => ({ tracks: [t, ...s.tracks], activeId: t.id })),
      removeTrack: (id) =>
        set((s) => ({
          tracks: s.tracks.filter((t) => t.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
          playing: s.activeId === id ? false : s.playing,
        })),
      toggleFavorite: (id) =>
        set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)) })),
      setActive: (id) => set({ activeId: id }),
      setPlaying: (playing) => set({ playing }),
    }),
    {
      name: "clipforge-music",
      // window access throws on the server, so persistence is simply skipped there
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
      partialize: (s) => ({ tracks: s.tracks, activeId: s.activeId }),
    },
  ),
);
