"use client";

import { ChevronsLeft, ChevronsRight, Plus, Scissors, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CardHeader, GlassCard } from "@/components/common/page";
import { useCaptionStore } from "@/stores/caption-store";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function TimeInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <input
        type="number"
        step={0.1}
        min={0}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="h-8 w-[70px] rounded-md border border-white/10 bg-black/20 px-2 font-mono text-xs tabular-nums text-foreground"
      />
    </label>
  );
}

export function CaptionList({ time, setTime, generator }: { time: number; setTime: (t: number) => void; generator?: React.ReactNode }) {
  const captions = useCaptionStore((s) => s.captions);
  const selectedId = useCaptionStore((s) => s.selectedId);
  const select = useCaptionStore((s) => s.select);
  const update = useCaptionStore((s) => s.updateCaption);
  const add = useCaptionStore((s) => s.addCaption);
  const remove = useCaptionStore((s) => s.removeCaption);
  const split = useCaptionStore((s) => s.splitCaption);
  const shiftAll = useCaptionStore((s) => s.shiftAll);
  return (
    <GlassCard className="p-5">
      <CardHeader
        icon={Wand2}
        title="Subtitles"
        description={`${captions.length} lines · click a line to jump to it`}
        actions={
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Shift all captions 0.1 seconds earlier" onClick={() => shiftAll(-0.1)}>
                  <ChevronsLeft aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Shift all −0.1s</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Shift all captions 0.1 seconds later" onClick={() => shiftAll(0.1)}>
                  <ChevronsRight aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Shift all +0.1s</TooltipContent>
            </Tooltip>
          </div>
        }
      />

      {generator && <div className="mt-4">{generator}</div>}

      {captions.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
          No subtitles yet. Generate them from the video&apos;s speech or add lines by hand.
        </p>
      )}

      <ol className="mt-4 grid gap-2">
        {captions.map((c, i) => {
          const selected = c.id === selectedId;
          const live = time >= c.start && time < c.end;
          return (
            <li
              key={c.id}
              className={cn(
                "rounded-xl border p-3 transition-colors duration-200",
                selected ? "border-violet/40 bg-violet/[0.08]" : "border-white/[0.06] bg-white/[0.015] hover:border-white/15",
              )}
              onFocus={() => select(c.id)}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <button
                  type="button"
                  onClick={() => {
                    select(c.id);
                    setTime(c.start + 0.01);
                  }}
                  className="flex items-center gap-2 rounded-md text-xs font-medium"
                  aria-label={`Jump to line ${i + 1} at ${formatTime(c.start)}`}
                >
                  <span className={cn("size-2 rounded-full", live ? "bg-ice" : "bg-white/20")} aria-hidden />
                  <span className="font-mono tabular-nums text-muted-foreground">#{i + 1}</span>
                </button>
                <TimeInput label="Start" value={c.start} onChange={(start) => update(c.id, { start })} />
                <TimeInput label="End" value={c.end} onChange={(end) => update(c.id, { end })} />
                <div className="ml-auto flex items-center gap-0.5">
                  <Button variant="ghost" size="icon-sm" aria-label={`Split line ${i + 1}`} onClick={() => split(c.id)}>
                    <Scissors aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Add a line after line ${i + 1}`} onClick={() => add(c.id)}>
                    <Plus aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="hover:text-destructive" aria-label={`Delete line ${i + 1}`} onClick={() => remove(c.id)}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
              <Textarea
                aria-label={`Text for line ${i + 1}`}
                value={c.text}
                onChange={(e) => update(c.id, { text: e.target.value })}
                rows={1}
                className="mt-2 min-h-9 resize-none border-white/[0.08] bg-black/20 text-sm"
              />
            </li>
          );
        })}
      </ol>
      <Button variant="glass" className="mt-3 w-full" onClick={() => add()}>
        <Plus aria-hidden /> Add line
      </Button>
    </GlassCard>
  );
}
