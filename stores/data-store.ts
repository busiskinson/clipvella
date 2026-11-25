"use client";

import { create } from "zustand";

/** Bumped after any mutation so every data hook refetches (one tiny cache-invalidation signal). */
export const useDataVersion = create<{ version: number; bump: () => void }>()((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

export const invalidateData = () => useDataVersion.getState().bump();
