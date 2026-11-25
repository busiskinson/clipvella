"use client";

import { create } from "zustand";

/**
 * Local files imported through the Video Downloader, keyed by project id.
 * Object URLs only live for the current browser session, so this store is
 * intentionally NOT persisted — after a reload the user re-imports the file.
 */
export interface LocalMedia {
  url: string;
  name: string;
  size: number;
  duration: number;
}

interface MediaRegistryState {
  files: Record<string, LocalMedia>;
  register: (projectId: string, media: LocalMedia) => void;
}

export const useMediaRegistry = create<MediaRegistryState>()((set) => ({
  files: {},
  register: (projectId, media) => set((s) => ({ files: { ...s.files, [projectId]: media } })),
}));
