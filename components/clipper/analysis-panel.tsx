"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Radar } from "lucide-react";
import { CardHeader, DemoBadge, GlassCard } from "@/components/common/page";
import { Progress } from "@/components/ui/progress";
import { ANALYSIS_STEPS, analysisDuration, useClipperStore } from "@/stores/clipper-store";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AnalysisPanel() {
  const phase = useClipperStore((s) => s.phase);
  const progress = useClipperStore((s) => s.progress);
  const stepIndex = useClipperStore((s) => s.stepIndex);
  const heatmap = useClipperStore((s) => s.heatmap);
  const clips = useClipperStore((s) => s.clips);
  const source = useClipperStore((s) => s.source);
  const duration = analysisDuration(source);
  const lengthUnknown = !source?.duration;

  if (phase === "idle") return null;

  return (
    <GlassCard className="p-5 sm:p-6">
      <CardHeader
        icon={Radar}
        title={phase === "done" ? "Analysis complete" : "Analyzing video"}
        description={phase === "done" ? `${clips.length} highlights found` : ANALYSIS_STEPS[Math.min(stepIndex, ANALYSIS_STEPS.length - 1)].detail}
        actions={<DemoBadge label="Simulated" />}
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <ol className="grid gap-2" aria-label="Analysis steps">
          {ANALYSIS_STEPS.map((step, i) => {
            const state = i < stepIndex ? "done" : i === stepIndex && phase === "analyzing" ? "active" : "pending";
            return (
              <li key={step.id} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border transition-colors duration-300",
                    state === "done" && "border-success/40 bg-success/15 text-success",
                    state === "active" && "border-violet/50 bg-violet/15 text-lavender",
                    state === "pending" && "border-white/10 text-muted-foreground",
                  )}
                >
                  {state === "done" ? <Check aria-hidden className="size-3.5" /> : state === "active" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <span className="text-[10px]">{i + 1}</span>}
                </span>
                <span className={state === "pending" ? "text-muted-foreground" : "text-foreground"}>{step.label}</span>
                <span className="sr-only">{state === "done" ? "complete" : state === "active" ? "in progress" : "pending"}</span>
              </li>
            );
          })}
        </ol>

        <div className="grid content-start gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall progress</span>
            <span className="tabular-nums" aria-live="polite">
              {progress}%
            </span>
          </div>
          <Progress value={progress} aria-label="Analysis progress" className="h-2" />

          <div className="mt-2">
            <p className="mb-2 text-sm text-muted-foreground">Engagement signal across the video</p>
            <div className="relative flex h-16 items-end gap-[2px] rounded-lg border border-white/[0.06] bg-black/20 p-1.5" aria-hidden>
              <AnimatePresence>
                {heatmap.map((v, i) => {
                  const revealed = (i / heatmap.length) * 100 <= progress;
                  return (
                    <motion.span
                      key={i}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: revealed ? 1 : 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex-1 origin-bottom rounded-t-[2px] bg-ice/50"
                      style={{ height: `${v * 100}%` }}
                    />
                  );
                })}
              </AnimatePresence>
              {phase === "done" &&
                clips.map((c) => (
                  <span
                    key={c.id}
                    className="absolute top-0 bottom-0 rounded-sm border-x border-violet bg-violet/25"
                    style={{ left: `${(c.start / duration) * 100}%`, width: `${((c.end - c.start) / duration) * 100}%` }}
                  />
                ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted-foreground">
              <span>00:00</span>
              {phase === "done" && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-sm bg-violet" /> Detected clip
                </span>
              )}
              <span>{lengthUnknown ? "Length unknown · illustrative" : formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
