"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Copy, Eye, EyeOff, Lock, Maximize2, Scissors, Trash2, Unlock, Volume2, VolumeX, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MAX_ZOOM, MIN_ZOOM, timelineDuration, useEditorStore } from "@/stores/editor-store";
import { useCaptionStore } from "@/stores/caption-store";
import type { Track } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TimelineClipBlock } from "./timeline-clip";

const TRACK_H = 52;
const RULER_H = 28;
const TICK_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60];

function ToolButton({ label, shortcut, onClick, disabled, children }: { label: string; shortcut?: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={disabled} aria-label={label}>
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

function TrackHeader({ track }: { track: Track }) {
  const toggle = useEditorStore((s) => s.toggleTrack);
  const isCaption = track.kind === "caption";
  return (
    <div className="flex items-center gap-1 border-b border-white/[0.05] pr-1 pl-3" style={{ height: TRACK_H }}>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground" title={track.name}>
        {track.name}
      </span>
      {(track.kind === "video" || track.kind === "audio") && (
        <ToolButton label={track.muted ? `Unmute ${track.name}` : `Mute ${track.name}`} onClick={() => toggle(track.id, "muted")}>
          {track.muted ? <VolumeX aria-hidden className="text-destructive" /> : <Volume2 aria-hidden />}
        </ToolButton>
      )}
      {track.kind !== "audio" && (
        <ToolButton label={track.hidden ? `Show ${track.name}` : `Hide ${track.name}`} onClick={() => toggle(track.id, "hidden")}>
          {track.hidden ? <EyeOff aria-hidden className="text-muted-foreground" /> : <Eye aria-hidden />}
        </ToolButton>
      )}
      {!isCaption && (
        <ToolButton label={track.locked ? `Unlock ${track.name}` : `Lock ${track.name}`} onClick={() => toggle(track.id, "locked")}>
          {track.locked ? <Lock aria-hidden className="text-warning" /> : <Unlock aria-hidden />}
        </ToolButton>
      )}
    </div>
  );
}

export function Timeline() {
  const clips = useEditorStore((s) => s.clips);
  const tracks = useEditorStore((s) => s.tracks);
  const zoom = useEditorStore((s) => s.zoom);
  const playhead = useEditorStore((s) => s.playhead);
  const playing = useEditorStore((s) => s.playing);
  const selectedId = useEditorStore((s) => s.selectedClipId);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const select = useEditorStore((s) => s.select);
  const split = useEditorStore((s) => s.splitAtPlayhead);
  const del = useEditorStore((s) => s.deleteSelected);
  const dup = useEditorStore((s) => s.duplicateSelected);
  const captions = useCaptionStore((s) => s.captions);
  const selectCaption = useCaptionStore((s) => s.select);

  const scroller = useRef<HTMLDivElement>(null);
  const duration = timelineDuration(clips);
  const width = duration * zoom;
  const step = TICK_STEPS.find((s) => s * zoom >= 70) ?? 60;
  const ticks = Array.from({ length: Math.floor(duration / step) + 1 }, (_, i) => i * step);

  const snapPoints = useCallback(() => {
    const s = useEditorStore.getState();
    const pts = [0, s.playhead];
    for (const c of s.clips) {
      if (c.id === s.selectedClipId) continue;
      pts.push(c.start, c.start + c.duration);
    }
    return pts;
  }, []);

  // keep the playhead in view while playing
  useEffect(() => {
    const el = scroller.current;
    if (!el || !playing) return;
    const x = playhead * zoom;
    if (x > el.scrollLeft + el.clientWidth - 40 || x < el.scrollLeft) el.scrollLeft = Math.max(0, x - 80);
  }, [playhead, playing, zoom]);

  const timeFromEvent = (e: React.PointerEvent) => {
    const el = scroller.current!;
    const rect = el.getBoundingClientRect();
    return (e.clientX - rect.left + el.scrollLeft) / zoom;
  };

  const scrubbing = useRef(false);
  const onScrubDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    scrubbing.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setPlayhead(timeFromEvent(e));
  };
  const onScrubMove = (e: React.PointerEvent) => {
    if (scrubbing.current) setPlayhead(timeFromEvent(e));
  };
  const onScrubUp = () => {
    scrubbing.current = false;
  };

  const fit = () => {
    const el = scroller.current;
    if (!el) return;
    setZoom((el.clientWidth - 24) / duration);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* toolbar */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] px-2 py-1.5">
        <ToolButton label="Split at playhead" shortcut="S" onClick={split}>
          <Scissors aria-hidden />
        </ToolButton>
        <ToolButton label="Duplicate clip" shortcut="Ctrl D" onClick={dup} disabled={!selectedId}>
          <Copy aria-hidden />
        </ToolButton>
        <ToolButton label="Delete clip" shortcut="Del" onClick={del} disabled={!selectedId}>
          <Trash2 aria-hidden />
        </ToolButton>
        <span className="mx-2 hidden h-5 w-px bg-white/10 sm:block" />
        <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:inline">{formatTime(playhead, true)}</span>

        <div className="ml-auto flex items-center gap-1">
          <ToolButton label="Zoom out" shortcut="−" onClick={() => setZoom(zoom / 1.25)}>
            <ZoomOut aria-hidden />
          </ToolButton>
          <Slider
            aria-label="Timeline zoom"
            className="w-24 sm:w-32"
            value={[zoom]}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={1}
            onValueChange={([v]) => setZoom(v)}
          />
          <ToolButton label="Zoom in" shortcut="+" onClick={() => setZoom(zoom * 1.25)}>
            <ZoomIn aria-hidden />
          </ToolButton>
          <ToolButton label="Fit timeline to view" onClick={fit}>
            <Maximize2 aria-hidden />
          </ToolButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-y-auto">
        {/* track headers */}
        <div className="w-36 shrink-0 border-r border-white/[0.06] bg-black/10 sm:w-44">
          <div style={{ height: RULER_H }} className="border-b border-white/[0.05]" />
          {tracks.map((t) => (
            <TrackHeader key={t.id} track={t} />
          ))}
        </div>

        {/* lanes */}
        <div ref={scroller} className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="relative" style={{ width: width + 24, minWidth: "100%" }}>
            {/* ruler */}
            <div
              className="sticky top-0 z-10 cursor-pointer border-b border-white/[0.05] bg-midnight/60"
              style={{ height: RULER_H }}
              onPointerDown={onScrubDown}
              onPointerMove={onScrubMove}
              onPointerUp={onScrubUp}
              role="slider"
              aria-label="Playhead position"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={Math.round(playhead * 10) / 10}
              aria-valuetext={formatTime(playhead)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setPlayhead(playhead - 1);
                if (e.key === "ArrowRight") setPlayhead(playhead + 1);
              }}
            >
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 h-full" style={{ left: t * zoom }}>
                  <div className="h-2 w-px bg-white/25" />
                  <span className="absolute top-2 left-1 text-[10px] tabular-nums text-muted-foreground">{formatTime(t)}</span>
                </div>
              ))}
            </div>

            {tracks.map((t) => (
              <div
                key={t.id}
                className={cn("relative border-b border-white/[0.05]", t.hidden && "opacity-40")}
                style={{ height: TRACK_H }}
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) {
                    select(null);
                    onScrubDown(e);
                  }
                }}
                onPointerMove={onScrubMove}
                onPointerUp={onScrubUp}
              >
                {t.kind === "caption"
                  ? captions.map((c) => (
                      <Link
                        key={c.id}
                        href="/captions"
                        onClick={() => selectCaption(c.id)}
                        title={`${c.text} — edit in Caption Studio`}
                        className="absolute top-1.5 bottom-1.5 overflow-hidden rounded-md border border-ice/30 bg-ice/[0.12] px-1.5 py-1 text-[10px] leading-tight text-ice transition-colors hover:bg-ice/20"
                        style={{ left: c.start * zoom, width: Math.max(4, (c.end - c.start) * zoom - 2) }}
                      >
                        <span className="line-clamp-2">{c.text}</span>
                      </Link>
                    ))
                  : clips
                      .filter((c) => c.trackId === t.id)
                      .map((c) => (
                        <TimelineClipBlock
                          key={c.id}
                          clip={c}
                          kind={t.kind}
                          zoom={zoom}
                          locked={t.locked}
                          selected={c.id === selectedId}
                          snapPoints={snapPoints}
                        />
                      ))}
              </div>
            ))}

            {/* playhead */}
            <div aria-hidden className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-lavender" style={{ left: playhead * zoom }}>
              <div className="absolute -top-px -left-[5px] h-3 w-[11px] rounded-b-sm bg-lavender" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
