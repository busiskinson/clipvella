"use client";

import { useRef } from "react";
import { MousePointerClick, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SliderField } from "@/components/common/fields";
import { DEFAULT_PROPS, useEditorStore } from "@/stores/editor-store";
import type { ClipProps } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-white/[0.06] px-4 py-4 last:border-b-0">
      <h3 className="font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

export function PropertiesPanel({ className }: { className?: string }) {
  const clip = useEditorStore((s) => s.clips.find((c) => c.id === s.selectedClipId));
  const updateProps = useEditorStore((s) => s.updateProps);
  const checkpoint = useEditorStore((s) => s.checkpoint);
  const renameClip = useEditorStore((s) => s.renameClip);
  const pending = useRef(false);

  if (!clip) {
    return (
      <div className={cn("grid h-full place-items-center p-6 text-center", className)}>
        <div>
          <span className="mx-auto mb-3 grid size-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
            <MousePointerClick aria-hidden className="size-5 text-lavender" />
          </span>
          <p className="text-sm font-medium">Nothing selected</p>
          <p className="mt-1 text-xs text-muted-foreground">Select a clip on the timeline or in the preview to edit its properties.</p>
        </div>
      </div>
    );
  }

  const p = clip.props;
  const isAudio = clip.trackId === "t-audio";
  const isVideo = clip.trackId === "t-video";

  // One undo step per slider gesture
  const change = (patch: Partial<ClipProps>) => {
    if (!pending.current) {
      checkpoint();
      pending.current = true;
    }
    updateProps(clip.id, patch);
  };
  const commit = () => {
    pending.current = false;
  };
  const field = (key: keyof ClipProps, label: string, min: number, max: number, step = 1, format?: (v: number) => string) => (
    <SliderField
      label={label}
      value={p[key] as number}
      min={min}
      max={max}
      step={step}
      format={format}
      onChange={(v) => change({ [key]: v } as Partial<ClipProps>)}
      onCommit={commit}
    />
  );

  return (
    <div className={cn("h-full overflow-y-auto", className)}>
      <div className="border-b border-white/[0.06] px-4 py-4">
        <Label htmlFor="clip-name" className="text-xs text-muted-foreground">
          Clip name
        </Label>
        <Input
          id="clip-name"
          className="mt-1.5 h-9"
          key={`${clip.id}-${clip.name}`}
          defaultValue={clip.name}
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name && name !== clip.name) renameClip(clip.id, name);
            else e.target.value = clip.name;
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <dt className="text-muted-foreground">Start</dt>
            <dd className="font-mono tabular-nums">{formatTime(clip.start, true)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Length</dt>
            <dd className="font-mono tabular-nums">{clip.duration.toFixed(1)}s</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">In point</dt>
            <dd className="font-mono tabular-nums">{formatTime(clip.sourceIn)}</dd>
          </div>
        </dl>
      </div>

      {!isAudio && (
        <Section title="Transform">
          {field("scale", "Scale", 50, 200, 1, (v) => `${v}%`)}
          {field("positionX", "Position X", -50, 50, 1, (v) => `${v}%`)}
          {field("positionY", "Position Y", -50, 50, 1, (v) => `${v}%`)}
          {field("rotation", "Rotation", -180, 180, 1, (v) => `${v}°`)}
          {field("opacity", "Opacity", 0, 100, 1, (v) => `${v}%`)}
        </Section>
      )}

      {isVideo && (
        <Section title="Adjust">
          {field("brightness", "Brightness", -50, 50)}
          {field("contrast", "Contrast", -50, 50)}
          {field("saturation", "Saturation", -50, 50)}
        </Section>
      )}

      {(isVideo || isAudio) && (
        <Section title="Audio & speed">
          {field("volume", "Volume", 0, 200, 1, (v) => `${v}%`)}
          {field("speed", "Speed", 0.25, 4, 0.25, (v) => `${v}×`)}
        </Section>
      )}

      <div className="px-4 py-4">
        <Button variant="glass" size="sm" className="w-full" onClick={() => updateProps(clip.id, { ...DEFAULT_PROPS }, true)}>
          <RotateCcw aria-hidden /> Reset properties
        </Button>
      </div>
    </div>
  );
}
