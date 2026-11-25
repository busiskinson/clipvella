"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUIStore } from "@/stores/ui-store";
import { createProject } from "@/lib/data/projects";
import { useSettingsStore } from "@/stores/settings-store";
import type { AspectRatio, ProjectKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PROJECT_KIND_META } from "./project-meta";
import { AspectPicker } from "./aspect-picker";

const KINDS: { id: ProjectKind; blurb: string }[] = [
  { id: "clip", blurb: "Find highlights in a long video" },
  { id: "edit", blurb: "Edit on a multitrack timeline" },
  { id: "captions", blurb: "Style animated subtitles" },
  { id: "import", blurb: "Bring in a video from a link or file" },
];

export function NewProjectDialog() {
  const open = useUIStore((s) => s.newProjectOpen);
  const setOpen = useUIStore((s) => s.setNewProject);
  const defaultAspect = useSettingsStore((s) => s.defaultAspect);
  const router = useRouter();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<ProjectKind>("clip");
  const [aspect, setAspect] = useState<AspectRatio | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setKind("clip");
    setAspect(null);
    setError(null);
  };

  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Give your project a name of at least 2 characters.");
      return;
    }
    setSaving(true);
    try {
      const project = await createProject({ name: trimmed, kind, aspect: aspect ?? defaultAspect });
      toast.success(`Created “${project.name}”`);
      setOpen(false);
      reset();
      router.push(`${PROJECT_KIND_META[kind].href}?project=${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? `Couldn't create the project: ${err.message}` : "Couldn't create the project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="glass-strong sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-5" noValidate>
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">New project</DialogTitle>
            <DialogDescription>Choose what you want to make. You can switch tools at any time.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="np-name">Project name</Label>
            <Input
              id="np-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Podcast highlights — Ep. 43"
              aria-invalid={!!error}
              aria-describedby={error ? "np-name-error" : undefined}
              className="h-10"
              autoFocus
            />
            {error && (
              <p id="np-name-error" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Project type</legend>
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => {
                const meta = PROJECT_KIND_META[k.id];
                const Icon = meta.icon;
                const selected = kind === k.id;
                return (
                  <button
                    type="button"
                    key={k.id}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setKind(k.id)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors duration-200",
                      selected ? "border-violet/50 bg-violet/[0.12]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20",
                    )}
                  >
                    <Icon aria-hidden className={cn("size-4", selected ? "text-lavender" : "text-muted-foreground")} />
                    <span className="text-sm font-medium">{meta.label}</span>
                    <span className="text-xs text-muted-foreground">{k.blurb}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Aspect ratio</span>
            <AspectPicker value={aspect ?? defaultAspect} onChange={setAspect} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
