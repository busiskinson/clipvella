"use client";

import Link from "next/link";
import { Clapperboard, Copy, MoreHorizontal, Pencil, Scissors, Trash2 } from "lucide-react";
import type { Project } from "@/lib/types";
import { formatDate, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SceneThumb } from "@/components/common/scene-thumb";
import { PROJECT_KIND_META, STATUS_META } from "@/components/common/project-meta";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useOpenProject } from "@/components/common/use-open-project";
import { PLATFORM_LABEL } from "@/lib/platforms";

export function ProjectCard({
  project,
  onRename,
  onDuplicate,
  onDelete,
}: {
  project: Project;
  onRename?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const kind = PROJECT_KIND_META[project.kind];
  const status = STATUS_META[project.status];
  const KindIcon = kind.icon;
  const imported = !!project.source;
  const hasMenu = onRename || onDuplicate || onDelete || imported;
  const { openInEditor, openInClipper } = useOpenProject();
  const durationLabel = project.duration ? formatDuration(project.duration) : project.source?.type === "link" ? "Linked" : "Empty";

  return (
    <article className="glass glow-hover group relative flex flex-col overflow-hidden rounded-2xl">
      <SceneThumb hue={project.hue} className="aspect-video" subject={!project.source?.thumbnail}>
        {project.source?.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element -- platform CDN or local data URL
          <img src={project.source.thumbnail} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
        )}
        <span className={cn("absolute top-3 left-3 rounded-full border px-2 py-0.5 text-[11px] font-medium backdrop-blur-md", status.className)}>
          {status.label}
        </span>
        <span className="absolute right-3 bottom-3 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium tabular-nums backdrop-blur-md">
          {durationLabel}
        </span>
      </SceneThumb>
      <div className="flex flex-1 items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-sans text-sm font-semibold tracking-normal">
            {imported ? (
              <Link
                href="/editor"
                onClick={(e) => {
                  e.preventDefault();
                  openInEditor(project);
                }}
                className="after:absolute after:inset-0 focus-visible:outline-none"
              >
                {project.name}
              </Link>
            ) : (
              <Link href={kind.href} className="after:absolute after:inset-0 focus-visible:outline-none">
                {project.name}
              </Link>
            )}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <KindIcon aria-hidden className="size-3.5 text-lavender" />
            {project.source?.platform ? PLATFORM_LABEL[project.source.platform] : project.source?.type === "file" ? "Local file" : kind.label}
            <span aria-hidden>·</span>
            {project.aspect}
            <span aria-hidden>·</span>
            {formatDate(project.updatedAt)}
          </p>
        </div>
        {hasMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="relative z-10 -mr-1" aria-label={`Actions for ${project.name}`}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {imported && (
                <>
                  <DropdownMenuItem onSelect={() => openInEditor(project)}>
                    <Clapperboard aria-hidden /> Open in Editor
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openInClipper(project)}>
                    <Scissors aria-hidden /> Open in Clipper
                  </DropdownMenuItem>
                  {(onRename || onDuplicate || onDelete) && <DropdownMenuSeparator />}
                </>
              )}
              {onRename && (
                <DropdownMenuItem onSelect={onRename}>
                  <Pencil aria-hidden /> Rename
                </DropdownMenuItem>
              )}
              {onDuplicate && (
                <DropdownMenuItem onSelect={onDuplicate}>
                  <Copy aria-hidden /> Duplicate
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                    <Trash2 aria-hidden /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </article>
  );
}
