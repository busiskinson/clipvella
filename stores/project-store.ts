"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AspectRatio, Project, ProjectKind, ProjectSource } from "@/lib/types";
import { uid } from "@/lib/format";

interface ProjectState {
  projects: Project[];
  createProject: (input: { name: string; kind: ProjectKind; aspect: AspectRatio }) => Project;
  addImportedProject: (input: { name: string; aspect: AspectRatio; duration: number; source: ProjectSource }) => Project;
  renameProject: (id: string, name: string) => void;
  duplicateProject: (id: string) => void;
  deleteProject: (id: string) => void;
  resetSamples: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [] as Project[],
      createProject: ({ name, kind, aspect }) => {
        const project: Project = {
          id: uid("p"),
          name,
          kind,
          aspect,
          status: "draft",
          duration: 0,
          updatedAt: new Date().toISOString(),
          hue: get().projects.length,
        };
        set((s) => ({ projects: [project, ...s.projects] }));
        return project;
      },
      addImportedProject: ({ name, aspect, duration, source }) => {
        const project: Project = {
          id: uid("p"),
          name,
          kind: "import",
          aspect,
          // a link import only has metadata until the media service fetches the file
          status: source.type === "file" ? "ready" : "draft",
          duration,
          updatedAt: new Date().toISOString(),
          hue: get().projects.length,
          source,
        };
        set((s) => ({ projects: [project, ...s.projects] }));
        return project;
      },
      renameProject: (id, name) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p)),
        })),
      duplicateProject: (id) =>
        set((s) => {
          const src = s.projects.find((p) => p.id === id);
          if (!src) return s;
          const copy: Project = { ...src, id: uid("p"), name: `${src.name} (copy)`, status: "draft", updatedAt: new Date().toISOString() };
          return { projects: [copy, ...s.projects] };
        }),
      deleteProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
      resetSamples: () => set({ projects: [] }),
    }),
    {
      name: "clipforge-projects",
      // window access throws on the server, so persistence is simply skipped there
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
      version: 1,
      // v0 → v1: the AI Music Studio was removed; drop its project type.
      migrate: (persisted, version) => {
        const state = persisted as { projects?: Array<Project | { kind: string }> };
        if (version < 1 && Array.isArray(state.projects)) {
          state.projects = state.projects.filter((p) => p.kind !== "music");
        }
        return state as unknown as ProjectState;
      },
    },
  ),
);
