"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AspectRatio } from "@/lib/types";

export interface Settings {
  displayName: string;
  workspace: string;
  defaultAspect: AspectRatio;
  defaultClipLength: "15-30" | "30-60" | "60-90" | "auto";
  exportQuality: "720p" | "1080p" | "4k";
  exportFps: "24" | "30" | "60";
  autoCaptions: boolean;
  captionLanguage: string;
  reduceMotion: boolean;
  notifyOnComplete: boolean;
  weeklyDigest: boolean;
  timelineSnapping: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  displayName: "Creator",
  workspace: "My Studio",
  defaultAspect: "9:16",
  defaultClipLength: "30-60",
  exportQuality: "1080p",
  exportFps: "30",
  autoCaptions: true,
  captionLanguage: "en",
  reduceMotion: false,
  notifyOnComplete: true,
  weeklyDigest: false,
  timelineSnapping: true,
};

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: "clipforge-settings",
      // window access throws on the server, so persistence is simply skipped there
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
      partialize: (s) => {
        const { update, reset, ...rest } = s;
        void update;
        void reset;
        return rest;
      },
    },
  ),
);
