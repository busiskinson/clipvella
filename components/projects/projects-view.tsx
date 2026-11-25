"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FolderOpen, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segmented } from "@/components/common/fields";
import { useProjectStore } from "@/stores/project-store";
import { useUIStore } from "@/stores/ui-store";
import type { Project, ProjectKind } from "@/lib/types";
import { ProjectCard } from "./project-card";

type KindFilter = "all" | ProjectKind;
type SortKey = "recent" | "name" | "duration";

export function ProjectsView() {
  const projects = useProjectStore((s) => s.projects);
  const rename = useProjectStore((s) => s.renameProject);
  const duplicate = useProjectStore((s) => s.duplicateProject);
  const remove = useProjectStore((s) => s.deleteProject);
  const setNewProject = useUIStore((s) => s.setNewProject);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [renaming, setRenaming] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<Project | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => (kind === "all" || p.kind === kind) && (!q || p.name.toLowerCase().includes(q)))
      .sort((a, b) =>
        sort === "name" ? a.name.localeCompare(b.name) : sort === "duration" ? b.duration - a.duration : b.updatedAt.localeCompare(a.updatedAt),
      );
  }, [projects, query, kind, sort]);

  return (
    <>
      <div className="glass mb-6 flex flex-col gap-3 rounded-2xl p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects"
            aria-label="Search projects"
            className="h-10 border-white/[0.08] bg-black/20 pl-9"
          />
        </div>
        <Segmented<KindFilter>
          label="Filter by type"
          value={kind}
          onChange={setKind}
          size="sm"
          className="lg:w-auto"
          options={[
            { value: "all", label: "All" },
            { value: "clip", label: "Clips" },
            { value: "edit", label: "Edits" },
            { value: "captions", label: "Captions" },
            { value: "music", label: "Music" },
          ]}
        />
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger aria-label="Sort projects" className="h-10 w-full lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recently edited</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="duration">Longest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {list.length} {list.length === 1 ? "project" : "projects"}
      </p>

      {list.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-violet/15 text-lavender ring-1 ring-violet/25">
            <FolderOpen aria-hidden className="size-6" />
          </span>
          <p className="font-medium">No projects match</p>
          <p className="text-sm text-muted-foreground">Try another search or filter, or start something new.</p>
          <Button onClick={() => setNewProject(true)} className="mt-2">
            <Plus aria-hidden /> New project
          </Button>
        </div>
      ) : (
        <motion.ul layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <AnimatePresence initial={false}>
            {list.map((p) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ duration: 0.25 }}
              >
                <ProjectCard
                  project={p}
                  onRename={() => {
                    setRenaming(p);
                    setRenameValue(p.name);
                  }}
                  onDuplicate={() => {
                    duplicate(p.id);
                    toast.success(`Duplicated “${p.name}”`);
                  }}
                  onDelete={() => setDeleting(p)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="glass-strong sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!renaming || renameValue.trim().length < 2) return;
              rename(renaming.id, renameValue.trim());
              toast.success("Project renamed");
              setRenaming(null);
            }}
            className="grid gap-4"
          >
            <DialogHeader>
              <DialogTitle className="font-heading">Rename project</DialogTitle>
              <DialogDescription>Names must be at least 2 characters.</DialogDescription>
            </DialogHeader>
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} aria-label="Project name" className="h-10" autoFocus />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={renameValue.trim().length < 2}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="glass-strong sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Delete project?</DialogTitle>
            <DialogDescription>
              “{deleting?.name}” will be removed from this browser. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  remove(deleting.id);
                  toast.success(`Deleted “${deleting.name}”`);
                }
                setDeleting(null);
              }}
            >
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
