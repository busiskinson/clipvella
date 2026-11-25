"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SupportedPlatform } from "@/lib/types";
import { uid } from "@/lib/format";

export type HistoryStatus = "analyzed" | "imported" | "download-unavailable" | "downloaded" | "failed";

/** One real action the user took in the Video Downloader. */
export interface HistoryEntry {
  id: string;
  createdAt: string;
  kind: "link" | "file";
  url?: string;
  platform?: SupportedPlatform;
  title: string;
  author?: string | null;
  thumbnail?: string | null;
  status: HistoryStatus;
  detail?: string;
  format?: "mp4" | "mp3";
  quality?: string | null;
  projectId?: string;
}

const LIMIT = 30;

interface DownloaderState {
  history: HistoryEntry[];
  record: (entry: Omit<HistoryEntry, "id" | "createdAt">) => HistoryEntry;
  update: (id: string, patch: Partial<HistoryEntry>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useDownloaderStore = create<DownloaderState>()(
  persist(
    (set, get) => ({
      history: [],
      record: (entry) => {
        // The same link analyzed again moves to the top instead of duplicating; keep its project link.
        const history = get().history;
        const previous = entry.url ? history.find((h) => h.url === entry.url) : undefined;
        const full: HistoryEntry = {
          ...entry,
          projectId: entry.projectId ?? previous?.projectId,
          id: uid("h"),
          createdAt: new Date().toISOString(),
        };
        const rest = previous ? history.filter((h) => h.id !== previous.id) : history;
        set({ history: [full, ...rest].slice(0, LIMIT) });
        return full;
      },
      update: (id, patch) => set((s) => ({ history: s.history.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),
      remove: (id) => set((s) => ({ history: s.history.filter((h) => h.id !== id) })),
      clear: () => set({ history: [] }),
    }),
    {
      name: "clipforge-downloads",
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
      partialize: (s) => ({ history: s.history }),
    },
  ),
);
