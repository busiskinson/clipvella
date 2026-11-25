"use client";

import { memo, useMemo, useRef } from "react";
import { AudioLines, Film, Type } from "lucide-react";
import type { TimelineClip, TrackKind } from "@/lib/types";
import { useEditorStore } from "@/stores/editor-store";
import { useSettingsStore } from "@/stores/settings-store";
import { sceneFor } from "@/lib/sample-data";
import { seeded } from "@/lib/format";
import { cn } from "@/lib/utils";

function Waveform({ seed }: { seed: number }) {
  const bars = useMemo(() => {
    const rnd = seeded(seed);
    // rounded so server and client markup match exactly
    return Array.from({ length: 120 }, (_, i) => Math.round((0.25 + Math.abs(Math.sin(i / 5)) * 0.4 + rnd() * 0.35) * 1000) / 1000);
  }, [seed]);
  return (
    <svg aria-hidden viewBox="0 0 120 20" preserveAspectRatio="none" className="absolute inset-x-1 bottom-1 h-[55%] w-[calc(100%-8px)]">
      {bars.map((h, i) => (
        <rect key={i} x={i + 0.15} width={0.7} y={10 - h * 10} height={h * 20} fill="currentColor" />
      ))}
    </svg>
  );
}

const KIND_STYLE: Record<TrackKind, string> = {
  video: "border-violet/40 text-white",
  overlay: "border-lavender/40 bg-lavender/[0.16] text-lavender",
  caption: "border-ice/30 bg-ice/[0.12] text-ice",
  audio: "border-ice/40 bg-ice/[0.14] text-ice",
};

type DragMode = "move" | "trim-start" | "trim-end";

export const TimelineClipBlock = memo(function TimelineClipBlock({
  clip,
  kind,
  zoom,
  locked,
  selected,
  snapPoints,
}: {
  clip: TimelineClip;
  kind: TrackKind;
  zoom: number;
  locked: boolean;
  selected: boolean;
  snapPoints: () => number[];
}) {
  const drag = useRef<{ mode: DragMode; x: number; start: number; end: number; moved: boolean; points: number[] } | null>(null);

  const snap = (t: number, points: number[]) => {
    if (!useSettingsStore.getState().timelineSnapping) return t;
    const threshold = 8 / zoom;
    let best = t;
    let dist = threshold;
    for (const p of points) {
      const d = Math.abs(p - t);
      if (d < dist) {
        dist = d;
        best = p;
      }
    }
    return best;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    const mode = (e.currentTarget.dataset.mode ?? "move") as DragMode;
    const s = useEditorStore.getState();
    s.select(clip.id);
    if (locked || e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, x: e.clientX, start: clip.start, end: clip.start + clip.duration, moved: false, points: snapPoints() };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved) {
      if (Math.abs(dx) < 3) return;
      d.moved = true;
      useEditorStore.getState().checkpoint();
    }
    const dt = dx / zoom;
    const s = useEditorStore.getState();
    if (d.mode === "move") {
      let start = d.start + dt;
      const snappedStart = snap(start, d.points);
      const snappedEnd = snap(start + (d.end - d.start), d.points);
      if (snappedStart !== start) start = snappedStart;
      else if (snappedEnd !== start + (d.end - d.start)) start = snappedEnd - (d.end - d.start);
      s.moveClipLive(clip.id, start);
    } else if (d.mode === "trim-start") {
      s.trimClipLive(clip.id, "start", snap(d.start + dt, d.points));
    } else {
      s.trimClipLive(clip.id, "end", snap(d.end + dt, d.points));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    drag.current = null;
  };

  const Icon = kind === "audio" ? AudioLines : kind === "overlay" ? Type : Film;
  const width = clip.duration * zoom;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${clip.name}, starts ${clip.start.toFixed(1)} seconds, ${clip.duration.toFixed(1)} seconds long${locked ? ", locked" : ""}`}
      aria-pressed={selected}
      data-mode="move"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          useEditorStore.getState().select(clip.id);
        }
      }}
      className={cn(
        "group absolute top-1 bottom-1 touch-none overflow-hidden rounded-lg border select-none",
        KIND_STYLE[kind],
        locked ? "cursor-not-allowed opacity-80" : "cursor-grab active:cursor-grabbing",
        selected && "ring-2 ring-lavender ring-offset-1 ring-offset-midnight",
      )}
      style={{
        left: clip.start * zoom,
        width,
        background: kind === "video" ? sceneFor(clip.hue) : undefined,
      }}
    >
      {kind === "video" && <div aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_63px,rgb(0_0_0/0.35)_63px,rgb(0_0_0/0.35)_64px)]" />}
      {kind === "audio" && <Waveform seed={clip.hue * 31 + clip.id.length} />}
      <div className="relative flex h-full items-start gap-1.5 px-2 pt-1 text-[11px] font-medium">
        {width > 40 && <Icon aria-hidden className="mt-px size-3 shrink-0" />}
        {width > 70 && <span className="truncate [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">{clip.name}</span>}
      </div>
      {!locked && (
        <>
          <span
            aria-hidden
            data-mode="trim-start"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-white/0 transition-colors group-hover:bg-white/30"
          />
          <span
            aria-hidden
            data-mode="trim-end"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-white/0 transition-colors group-hover:bg-white/30"
          />
        </>
      )}
    </div>
  );
});
