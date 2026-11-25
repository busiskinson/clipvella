"use client";

import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  searchOpen: boolean;
  newProjectOpen: boolean;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
  setSearch: (open: boolean) => void;
  setNewProject: (open: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarCollapsed: false,
  mobileNavOpen: false,
  searchOpen: false,
  newProjectOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
  setSearch: (searchOpen) => set({ searchOpen }),
  setNewProject: (newProjectOpen) => set({ newProjectOpen }),
}));
