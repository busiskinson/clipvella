"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SAMPLE_PROJECTS } from "@/lib/sample-data";
import type { AspectRatio, Project, ProjectKind } from "@/lib/types";
import { uid } from "@/lib/format";

interface ProjectState {
  projects: Project[];
  createProject: (input: { name: string; kind: ProjectKind; aspect: AspectRatio }) => Project;
  renameProject: (id: string, name: string) => void;
  duplicateProject: (id: string) => void;
  deleteProject: (id: string) => void;
  resetSamples: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: SAMPLE_PROJECTS,
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
      resetSamples: () => set({ projects: SAMPLE_PROJECTS }),
    }),
    {
      name: "clipforge-projects",
      // window access throws on the server, so persistence is simply skipped there
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
    },
  ),
);
