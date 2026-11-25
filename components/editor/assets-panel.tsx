"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, AudioLines, Captions, Film, Plus, Sparkles, Type, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SceneThumb } from "@/components/common/scene-thumb";
import { useEditorStore } from "@/stores/editor-store";
import { useCaptionStore } from "@/stores/caption-store";
import { useMusicStore } from "@/stores/music-store";
import { CAPTION_TEMPLATES } from "@/lib/sample-data";
import { formatDuration, formatTime, uid } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EFFECTS } from "./clip-visuals";

function readDuration(url: string, kind: "video" | "audio"): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement(kind);
    el.preload = "metadata";
    el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : 10);
    el.onerror = () => resolve(10);
    el.src = url;
  });
}

function MediaTab() {
  const media = useEditorStore((s) => s.media);
  const addMedia = useEditorStore((s) => s.addMedia);
  const removeMedia = useEditorStore((s) => s.removeMedia);
  const addClip = useEditorStore((s) => s.addClipFromMedia);
  const input = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const kind = file.type.startsWith("audio/") ? "audio" : file.type.startsWith("video/") ? "video" : null;
      if (!kind) {
        toast.error(`${file.name} is not a video or audio file`);
        continue;
      }
      const url = URL.createObjectURL(file);
      const duration = await readDuration(url, kind);
      addMedia({ id: uid("m"), name: file.name, kind, duration, url, hue: Math.floor(Math.random() * 6) });
      toast.success(`Imported ${file.name}`, { description: "Plays locally in the preview. Nothing is uploaded." });
    }
  };

  return (
    <div className="grid gap-3">
      <Button variant="glass" className="w-full" onClick={() => input.current?.click()}>
        <Upload aria-hidden /> Import media
      </Button>
      <input ref={input} type="file" accept="video/*,audio/*" multiple className="sr-only" aria-label="Import media files" onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
      <ul className="grid grid-cols-2 gap-2">
        {media.map((m) => (
          <li key={m.id} className="group relative overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02]">
            {m.kind === "audio" ? (
              <div className="grid aspect-video place-items-center bg-ice/10 text-ice">
                <AudioLines aria-hidden className="size-6" />
              </div>
            ) : (
              <SceneThumb hue={m.hue} className="aspect-video" subject={false}>
                {m.url && <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[10px]">Local</span>}
              </SceneThumb>
            )}
            <div className="p-1.5">
              <p className="truncate text-[11px] font-medium" title={m.name}>{m.name}</p>
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {m.kind === "audio" ? <AudioLines aria-hidden className="size-3" /> : <Film aria-hidden className="size-3" />}
                {formatDuration(m.duration)}
              </p>
            </div>
            <div className="absolute top-1 right-1 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <Button size="icon-xs" aria-label={`Add ${m.name} to timeline`} onClick={() => addClip(m.id)}>
                <Plus aria-hidden />
              </Button>
              <Button size="icon-xs" variant="secondary" aria-label={`Remove ${m.name}`} onClick={() => removeMedia(m.id)}>
                <X aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CaptionsTab() {
  const captions = useCaptionStore((s) => s.captions);
  const templateId = useCaptionStore((s) => s.templateId);
  const applyTemplate = useCaptionStore((s) => s.applyTemplate);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const playhead = useEditorStore((s) => s.playhead);

  return (
    <div className="grid gap-4">
      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Style</p>
        <div className="grid grid-cols-2 gap-1.5">
          {CAPTION_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={templateId === t.id}
              onClick={() => applyTemplate(t.id)}
              className={cn(
                "rounded-lg border px-2 py-2 text-left text-xs font-medium transition-colors",
                templateId === t.id ? "border-violet/50 bg-violet/[0.14]" : "border-white/[0.08] hover:border-white/20",
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Lines</p>
        <ul className="grid gap-1">
          {captions.map((c) => {
            const active = playhead >= c.start && playhead < c.end;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setPlayhead(c.start)}
                  className={cn("w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors", active ? "bg-ice/[0.12] text-foreground" : "text-muted-foreground hover:bg-white/[0.04]")}
                >
                  <span className="font-mono text-[10px] tabular-nums text-ice">{formatTime(c.start)}</span> {c.text}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <Button variant="glass" asChild>
        <Link href="/captions">
          <Captions aria-hidden /> Open Caption Studio <ArrowUpRight aria-hidden />
        </Link>
      </Button>
    </div>
  );
}

function AudioTab() {
  const tracks = useMusicStore((s) => s.tracks);
  const addMedia = useEditorStore((s) => s.addMedia);
  const addClip = useEditorStore((s) => s.addClipFromMedia);

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">Tracks from your AI Music Studio history.</p>
      <ul className="grid gap-1.5">
        {tracks.map((t) => (
          <li key={t.id} className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-ice/10 text-ice">
              <AudioLines aria-hidden className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{t.title}</span>
              <span className="block text-[10px] text-muted-foreground">
                {t.genre} · {formatDuration(t.duration)}
              </span>
            </span>
            <Button
              size="icon-xs"
              variant="secondary"
              aria-label={`Add ${t.title} to the music track`}
              onClick={() => {
                const id = uid("m");
                addMedia({ id, name: `${t.title}.wav`, kind: "audio", duration: t.duration, hue: 2 });
                addClip(id);
              }}
            >
              <Plus aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="glass" asChild>
        <Link href="/music">
          <Sparkles aria-hidden /> Generate new music <ArrowUpRight aria-hidden />
        </Link>
      </Button>
    </div>
  );
}

function EffectsTab() {
  const selectedId = useEditorStore((s) => s.selectedClipId);
  const clip = useEditorStore((s) => s.clips.find((c) => c.id === s.selectedClipId));
  const updateProps = useEditorStore((s) => s.updateProps);
  const addText = useEditorStore((s) => s.addTextOverlay);
  const canApply = clip && clip.trackId === "t-video";

  return (
    <div className="grid gap-4">
      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Looks</p>
        {!canApply && <p className="mb-2 text-xs text-muted-foreground">Select a video clip to apply a look.</p>}
        <div className="grid grid-cols-3 gap-1.5">
          {EFFECTS.map((fx) => (
            <button
              key={fx.id}
              type="button"
              disabled={!canApply}
              aria-pressed={clip?.props.effect === fx.id}
              onClick={() => selectedId && updateProps(selectedId, { effect: fx.id }, true)}
              className={cn(
                "overflow-hidden rounded-lg border text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                clip?.props.effect === fx.id ? "border-violet/60" : "border-white/[0.08] hover:border-white/20",
              )}
            >
              <SceneThumb hue={0} className="aspect-square" subject={false}>
                <span className="absolute inset-0" style={{ backdropFilter: fx.filter || undefined }} />
              </SceneThumb>
              <span className="block py-1">{fx.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Text</p>
        <div className="grid gap-1.5">
          {["Title: Big reveal", "Subscribe for more", "Part 2"].map((t) => (
            <Button key={t} variant="glass" size="sm" className="justify-start" onClick={() => addText(t)}>
              <Type aria-hidden /> {t.replace(/^Title:\s*/, "")}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AssetsPanel({ className }: { className?: string }) {
  return (
    <Tabs defaultValue="media" className={cn("flex h-full min-h-0 flex-col gap-0", className)}>
      <TabsList className="m-2 grid h-9 w-auto grid-cols-4 bg-black/25 p-1">
        <TabsTrigger value="media" className="text-xs">Media</TabsTrigger>
        <TabsTrigger value="captions" className="text-xs">Captions</TabsTrigger>
        <TabsTrigger value="audio" className="text-xs">Audio</TabsTrigger>
        <TabsTrigger value="effects" className="text-xs">Effects</TabsTrigger>
      </TabsList>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <TabsContent value="media"><MediaTab /></TabsContent>
        <TabsContent value="captions"><CaptionsTab /></TabsContent>
        <TabsContent value="audio"><AudioTab /></TabsContent>
        <TabsContent value="effects"><EffectsTab /></TabsContent>
      </div>
    </Tabs>
  );
}
