"use client";

import { useState } from "react";
import { Clapperboard, FileVideo, History, RotateCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CardHeader, GlassCard } from "@/components/common/page";
import { useDownloaderStore, type HistoryEntry } from "@/stores/downloader-store";
import { useProjectStore } from "@/stores/project-store";
import { useOpenProject } from "@/components/common/use-open-project";
import { PLATFORM_LABEL } from "@/lib/platforms";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "./shared";

function timeOf(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function HistoryPanel({ onReanalyze }: { onReanalyze: (url: string) => void }) {
  const history = useDownloaderStore((s) => s.history);
  const remove = useDownloaderStore((s) => s.remove);
  const clear = useDownloaderStore((s) => s.clear);
  const projects = useProjectStore((s) => s.projects);
  const { openInEditor } = useOpenProject();
  const [confirm, setConfirm] = useState(false);

  const projectFor = (h: HistoryEntry) => (h.projectId ? projects.find((p) => p.id === h.projectId) : undefined);

  return (
    <GlassCard className="p-4 sm:p-5">
      <CardHeader
        icon={History}
        title="Recent downloads"
        description={history.length ? `${history.length} ${history.length === 1 ? "item" : "items"} · stored in this browser` : "Links you analyze and files you import"}
        actions={
          history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
              Clear
            </Button>
          )
        }
      />

      {history.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center">
          <p className="text-sm font-medium">Nothing here yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Paste a link above or drop a file to start your history.</p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-1.5">
          {history.map((h) => {
            const project = projectFor(h);
            return (
              <li key={h.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-transparent p-2 transition-colors duration-200 hover:border-white/[0.06] hover:bg-white/[0.03]">
                <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-black/40">
                  {h.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element -- thumbnails come from platform CDNs or local data URLs
                    <img src={h.thumbnail} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <FileVideo aria-hidden className="size-5 text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={h.title}>
                    {h.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <StatusBadge status={h.status} />
                    <span>{h.platform ? PLATFORM_LABEL[h.platform] : "Local file"}</span>
                    <span aria-hidden>·</span>
                    <time dateTime={h.createdAt}>
                      {formatDate(h.createdAt)} {timeOf(h.createdAt)}
                    </time>
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  {project && (
                    <Button variant="ghost" size="icon-sm" aria-label={`Open ${h.title} in the editor`} onClick={() => openInEditor(project)}>
                      <Clapperboard aria-hidden />
                    </Button>
                  )}
                  {h.kind === "link" && h.url && (
                    <Button variant="ghost" size="icon-sm" aria-label={`Analyze ${h.title} again`} onClick={() => onReanalyze(h.url!)}>
                      <RotateCw aria-hidden />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" className="hover:text-destructive" aria-label={`Remove ${h.title} from history`} onClick={() => remove(h.id)}>
                    <X aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="glass-strong sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Clear download history?</DialogTitle>
            <DialogDescription>This removes the list only. Imported videos stay in My Projects.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clear();
                setConfirm(false);
              }}
            >
              <Trash2 aria-hidden /> Clear history
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GlassCard>
  );
}
