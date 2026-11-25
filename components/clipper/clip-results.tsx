"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clapperboard, Download, Flame, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SceneThumb } from "@/components/common/scene-thumb";
import { Segmented } from "@/components/common/fields";
import { DemoBadge } from "@/components/common/page";
import { useClipperStore } from "@/stores/clipper-store";
import type { AspectRatio, GeneratedClip } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const ASPECT_CLASS: Record<AspectRatio, string> = {
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "16:9": "aspect-video",
};

function scoreTone(score: number) {
  if (score >= 85) return "text-success border-success/30 bg-success/10";
  if (score >= 75) return "text-lavender border-violet/30 bg-violet/10";
  return "text-muted-foreground border-white/15 bg-white/[0.06]";
}

export function ClipResults() {
  const phase = useClipperStore((s) => s.phase);
  const clips = useClipperStore((s) => s.clips);
  const aspect = useClipperStore((s) => s.aspect);
  const [sort, setSort] = useState<"score" | "time">("score");
  const [preview, setPreview] = useState<GeneratedClip | null>(null);

  if (phase !== "done") return null;

  const sorted = [...clips].sort((a, b) => (sort === "score" ? b.score - a.score : a.start - b.start));
  const wide = aspect === "16:9";

  return (
    <section aria-labelledby="clips-heading" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 id="clips-heading" className="text-lg font-semibold">
            Generated clips
          </h2>
          <DemoBadge label="Sample results" />
        </div>
        <Segmented<"score" | "time">
          label="Sort clips"
          value={sort}
          onChange={setSort}
          size="sm"
          className="w-auto"
          options={[
            { value: "score", label: "Top score" },
            { value: "time", label: "Timeline order" },
          ]}
        />
      </div>

      {sorted.length === 0 ? (
        <p className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">All clips removed. Regenerate to get new ones.</p>
      ) : (
        <ul className={cn("grid gap-4", wide ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6")}>
          {sorted.map((clip, i) => (
            <motion.li
              key={clip.id}
              layout
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05, ease: "easeOut" }}
            >
              <ClipCard clip={clip} aspect={aspect} onPreview={() => setPreview(clip)} />
            </motion.li>
          ))}
        </ul>
      )}

      <PreviewDialog clip={preview} aspect={aspect} onClose={() => setPreview(null)} />
    </section>
  );
}

function ClipCard({ clip, aspect, onPreview }: { clip: GeneratedClip; aspect: AspectRatio; onPreview: () => void }) {
  const removeClip = useClipperStore((s) => s.removeClip);
  const router = useRouter();

  return (
    <article className="glass glow-hover group flex h-full flex-col overflow-hidden rounded-2xl">
      <button type="button" onClick={onPreview} className="relative block w-full" aria-label={`Preview clip: ${clip.title}`}>
        <SceneThumb hue={clip.hue} className={ASPECT_CLASS[aspect]}>
          <span className={cn("absolute top-2 left-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md", scoreTone(clip.score))}>
            <Flame aria-hidden className="size-3" />
            {clip.score}
          </span>
          <span className="absolute right-2 bottom-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] tabular-nums backdrop-blur-md">
            {Math.round(clip.end - clip.start)}s
          </span>
          <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="grid size-11 place-items-center rounded-full bg-black/50 backdrop-blur-md">
              <Play aria-hidden className="size-5 translate-x-px fill-current" />
            </span>
          </span>
        </SceneThumb>
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 font-sans text-sm font-semibold tracking-normal">{clip.title}</h3>
        <p className="text-xs tabular-nums text-muted-foreground">
          {formatTime(clip.start)} – {formatTime(clip.end)}
        </p>
        <div className="flex flex-wrap gap-1">
          {clip.tags.map((t) => (
            <span key={t} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-1 pt-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Open in editor"
                onClick={() => {
                  toast.success(`“${clip.title}” sent to the editor`, { description: "Sample media is used until clip rendering is connected." });
                  router.push("/editor");
                }}
              >
                <Clapperboard aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open in editor</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Download clip"
                onClick={() => toast.info("Download needs the rendering service", { description: "Clips are previews only in this frontend demo." })}
              >
                <Download aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="ml-auto hover:text-destructive" aria-label="Remove clip" onClick={() => removeClip(clip.id)}>
                <Trash2 aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </article>
  );
}

function PreviewDialog({ clip, aspect, onClose }: { clip: GeneratedClip | null; aspect: AspectRatio; onClose: () => void }) {
  const source = useClipperStore((s) => s.source);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isFile = source?.kind === "file";

  return (
    <Dialog open={!!clip} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong sm:max-w-2xl">
        {clip && (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading">{clip.title}</DialogTitle>
              <DialogDescription>
                {formatTime(clip.start)} – {formatTime(clip.end)} · Score {clip.score} ·{" "}
                {isFile ? "Playing the matching segment of your upload (uncropped)." : "Placeholder preview — connect the clip renderer to see real output."}
              </DialogDescription>
            </DialogHeader>
            <div className="mx-auto w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-black">
              {isFile ? (
                <video
                  ref={videoRef}
                  src={`${source.url}#t=${clip.start},${clip.end}`}
                  controls
                  autoPlay
                  className="aspect-video w-full"
                  onTimeUpdate={(e) => {
                    if (e.currentTarget.currentTime >= clip.end) e.currentTarget.pause();
                  }}
                >
                  <track kind="captions" />
                </video>
              ) : (
                <SceneThumb hue={clip.hue} className={cn(ASPECT_CLASS[aspect], "mx-auto max-h-[60vh]")}>
                  <p className="absolute inset-x-4 bottom-[18%] text-center font-heading text-lg font-bold text-white [text-shadow:0_2px_8px_rgb(0_0_0/0.8)]">
                    {clip.title}
                  </p>
                </SceneThumb>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
