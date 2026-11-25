"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Repeat, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SceneThumb } from "@/components/common/scene-thumb";
import { Segmented } from "@/components/common/fields";
import { useCaptionStore } from "@/stores/caption-store";
import { captionFontVariables } from "@/lib/caption-fonts";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CaptionOverlay } from "./caption-overlay";

type Frame = "9:16" | "1:1" | "16:9";
const FRAME_CLASS: Record<Frame, string> = {
  "9:16": "aspect-[9/16] w-full max-w-[300px]",
  "1:1": "aspect-square w-full max-w-[420px]",
  "16:9": "aspect-video w-full max-w-[560px]",
};

export function CaptionPreview({
  time,
  setTime,
  videoUrl = null,
  defaultFrame = "9:16",
}: {
  time: number;
  setTime: (t: number) => void;
  videoUrl?: string | null;
  defaultFrame?: Frame;
}) {
  const captions = useCaptionStore((s) => s.captions);
  const style = useCaptionStore((s) => s.style);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(!videoUrl);
  const [loop, setLoop] = useState(true);
  const [frame, setFrame] = useState<Frame>(defaultFrame);
  const [videoDuration, setVideoDuration] = useState(0);
  const end = videoUrl && videoDuration ? videoDuration : captions.reduce((n, c) => Math.max(n, c.end), 0) + 0.6;

  // Real video: the element is the clock.
  useEffect(() => {
    const v = video.current;
    if (!videoUrl || !v) return;
    v.loop = loop;
    if (!playing) {
      v.pause();
      return;
    }
    void v.play().catch(() => setPlaying(false));
    let raf = 0;
    const tick = () => {
      setTime(v.currentTime);
      if (v.ended && !loop) return setPlaying(false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoUrl, playing, loop, setTime]);

  const seek = (t: number) => {
    setTime(t);
    if (video.current) video.current.currentTime = t;
  };

  // No video yet: a simple clock so styles can still be previewed.
  useEffect(() => {
    if (videoUrl || !playing) return;
    let raf = 0;
    let last = performance.now();
    let t = time;
    const tick = (now: number) => {
      t += (now - last) / 1000;
      last = now;
      if (t >= end) {
        if (loop) t = 0;
        else {
          setTime(end);
          setPlaying(false);
          return;
        }
      }
      setTime(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `time` is only the starting point of a run
  }, [playing, loop, end, setTime]);

  return (
    <div className="flex flex-col items-center gap-4">
      <Segmented<Frame>
        label="Preview frame"
        value={frame}
        onChange={setFrame}
        size="sm"
        className="w-auto"
        options={[
          { value: "9:16", label: "9:16" },
          { value: "1:1", label: "1:1" },
          { value: "16:9", label: "16:9" },
        ]}
      />
      <div className={cn("@container relative overflow-hidden rounded-2xl bg-black shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)] ring-1 ring-white/10", FRAME_CLASS[frame], captionFontVariables)}>
        {videoUrl ? (
          <video
            ref={video}
            src={videoUrl}
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
            className="absolute inset-0 size-full object-cover"
          >
            <track kind="captions" />
          </video>
        ) : (
          <SceneThumb hue={3} className="absolute inset-0" />
        )}
        <CaptionOverlay captions={captions} style={style} time={time} />
      </div>

      <div className="flex w-full max-w-[420px] items-center gap-2">
        <Button size="icon" className="rounded-full" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause preview" : "Play preview"}>
          {playing ? <Pause aria-hidden className="fill-current" /> : <Play aria-hidden className="translate-x-px fill-current" />}
        </Button>
        <Slider
          aria-label="Preview time"
          className="flex-1"
          value={[Math.min(time, end)]}
          min={0}
          max={end}
          step={0.05}
          onValueChange={([v]) => {
            setPlaying(false);
            seek(v);
          }}
        />
        <span className="w-12 text-right font-mono text-xs tabular-nums text-muted-foreground">{formatTime(time)}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Restart preview" onClick={() => seek(0)}>
          <RotateCcw aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={loop ? "Turn loop off" : "Turn loop on"}
          aria-pressed={loop}
          onClick={() => setLoop((l) => !l)}
          className={loop ? "text-lavender" : "text-muted-foreground"}
        >
          <Repeat aria-hidden />
        </Button>
      </div>
    </div>
  );
}
