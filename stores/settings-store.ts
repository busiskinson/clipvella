"use client";

import { create } from "zustand";
import { toast } from "sonner";
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
  userId: string | null;
  email: string;
  loaded: boolean;
  /** Called by ProfileSync once the profile row has loaded. */
  hydrate: (userId: string, email: string, settings: Settings) => void;
  /** Updates locally and saves to the user's Supabase profile. */
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const pick = (s: SettingsState): Settings =>
  Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((k) => [k, s[k as keyof Settings]])) as unknown as Settings;

async function persist(userId: string | null, settings: Settings) {
  if (!userId) return;
  try {
    const { saveProfile } = await import("@/lib/data/profile");
    await saveProfile(userId, settings);
  } catch (e) {
    toast.error("Couldn't save your settings", { description: e instanceof Error ? e.message : undefined });
  }
}

/** In-memory cache of the profile; the source of truth is public.profiles. */
export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...DEFAULT_SETTINGS,
  userId: null,
  email: "",
  loaded: false,
  hydrate: (userId, email, settings) => set({ ...settings, userId, email, loaded: true }),
  update: (patch) => {
    set(patch);
    void persist(get().userId, pick(get()));
  },
  reset: () => {
    set(DEFAULT_SETTINGS);
    void persist(get().userId, pick(get()));
  },
}));
