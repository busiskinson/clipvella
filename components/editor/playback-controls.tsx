"use client";

import { Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { contentEnd, useEditorStore } from "@/stores/editor-store";
import { formatTime } from "@/lib/format";
import { Segmented } from "@/components/common/fields";
import type { AspectRatio } from "@/lib/types";

function IconButton({ label, shortcut, onClick, children }: { label: string; shortcut?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={onClick} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-2 text-muted-foreground">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

export function PlaybackControls() {
  const playing = useEditorStore((s) => s.playing);
  const playhead = useEditorStore((s) => s.playhead);
  const clips = useEditorStore((s) => s.clips);
  const togglePlay = useEditorStore((s) => s.togglePlay);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const aspect = useEditorStore((s) => s.aspect);
  const setAspect = useEditorStore((s) => s.setAspect);
  const end = contentEnd(clips);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-2">
      <div className="min-w-[132px] font-mono text-sm tabular-nums">
        <span className="text-foreground">{formatTime(playhead, true)}</span>
        <span className="text-muted-foreground"> / {formatTime(end)}</span>
      </div>

      <div className="flex items-center gap-1">
        <IconButton label="Go to start" shortcut="Home" onClick={() => setPlayhead(0)}>
          <SkipBack aria-hidden />
        </IconButton>
        <IconButton label="Previous frame" shortcut="←" onClick={() => setPlayhead(playhead - 1 / 30)}>
          <StepBack aria-hidden />
        </IconButton>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-lg" className="rounded-full" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause aria-hidden className="fill-current" /> : <Play aria-hidden className="translate-x-px fill-current" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {playing ? "Pause" : "Play"} <span className="ml-2 text-muted-foreground">Space</span>
          </TooltipContent>
        </Tooltip>
        <IconButton label="Next frame" shortcut="→" onClick={() => setPlayhead(playhead + 1 / 30)}>
          <StepForward aria-hidden />
        </IconButton>
        <IconButton label="Go to end" onClick={() => setPlayhead(end)}>
          <SkipForward aria-hidden />
        </IconButton>
      </div>

      <Segmented<AspectRatio>
        label="Canvas aspect ratio"
        value={aspect}
        onChange={setAspect}
        size="sm"
        className="w-auto"
        options={(["9:16", "1:1", "4:5", "16:9"] as AspectRatio[]).map((a) => ({ value: a, label: a }))}
      />
    </div>
  );
}
