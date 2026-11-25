"use client";

import { useState } from "react";
import { Download, PanelLeft, Redo2, SlidersHorizontal, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DemoBadge } from "@/components/common/page";
import { useEditorStore } from "@/stores/editor-store";
import { AssetsPanel } from "./assets-panel";
import { PreviewStage } from "./preview-stage";
import { PlaybackControls } from "./playback-controls";
import { PropertiesPanel } from "./properties-panel";
import { Timeline } from "./timeline";
import { ExportDialog } from "./export-dialog";
import { useEditorShortcuts, usePlaybackClock } from "./use-playback";

function HistoryButton({ label, shortcut, onClick, disabled, children }: { label: string; shortcut: string; onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={onClick} disabled={disabled} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label} <span className="ml-2 text-muted-foreground">{shortcut}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export function EditorWorkspace() {
  usePlaybackClock();
  useEditorShortcuts();

  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const [exportOpen, setExportOpen] = useState(false);
  const [sheet, setSheet] = useState<"assets" | "props" | null>(null);

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[620px] flex-col gap-2 p-2 sm:gap-3 sm:p-3">
      {/* top bar */}
      <div className="glass-strong flex items-center gap-2 rounded-xl px-2 py-1.5">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open assets panel" onClick={() => setSheet("assets")}>
          <PanelLeft aria-hidden />
        </Button>
        <label htmlFor="project-name" className="sr-only">
          Project name
        </label>
        <input
          id="project-name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 font-heading text-[15px] font-medium transition-colors hover:bg-white/[0.04] focus:bg-white/[0.06] sm:max-w-xs"
        />
        <DemoBadge className="hidden md:inline-flex" title="Preview playback and timeline editing run in the browser. Rendering needs the video processing backend." label="Frontend preview" />
        <div className="ml-auto flex items-center gap-1">
          <HistoryButton label="Undo" shortcut="Ctrl Z" onClick={undo} disabled={!canUndo}>
            <Undo2 aria-hidden />
          </HistoryButton>
          <HistoryButton label="Redo" shortcut="Ctrl Shift Z" onClick={redo} disabled={!canRedo}>
            <Redo2 aria-hidden />
          </HistoryButton>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open properties panel" onClick={() => setSheet("props")}>
            <SlidersHorizontal aria-hidden />
          </Button>
          <Button onClick={() => setExportOpen(true)} className="ml-1">
            <Download aria-hidden /> Export
          </Button>
        </div>
      </div>

      {/* main area */}
      <div className="flex min-h-0 flex-[1.35] gap-2 sm:gap-3">
        <aside aria-label="Assets" className="glass-strong hidden w-72 shrink-0 overflow-hidden rounded-xl lg:block">
          <AssetsPanel />
        </aside>
        <section aria-label="Preview" className="glass-strong flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl">
          <div className="min-h-0 flex-1 p-3 sm:p-5">
            <PreviewStage />
          </div>
          <PlaybackControls />
        </section>
        <aside aria-label="Properties" className="glass-strong hidden w-72 shrink-0 overflow-hidden rounded-xl lg:block">
          <PropertiesPanel />
        </aside>
      </div>

      {/* timeline */}
      <section aria-label="Timeline" className="glass-strong min-h-[240px] flex-1 overflow-hidden rounded-xl">
        <Timeline />
      </section>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />

      {/* side panels as sheets on small screens */}
      <Dialog open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
        <DialogContent className="glass-strong h-[80dvh] max-w-sm overflow-hidden p-0 pt-10">
          <DialogTitle className="sr-only">{sheet === "assets" ? "Assets" : "Properties"}</DialogTitle>
          {sheet === "assets" ? <AssetsPanel /> : <PropertiesPanel />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
