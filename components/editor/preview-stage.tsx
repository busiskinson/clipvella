"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { useCaptionStore } from "@/stores/caption-store";
import { CaptionOverlay } from "@/components/captions/caption-overlay";
import { SceneThumb } from "@/components/common/scene-thumb";
import type { MediaItem, TimelineClip } from "@/lib/types";
import { captionFontVariables } from "@/lib/caption-fonts";
import { filterFor, transformFor } from "./clip-visuals";
import { cn } from "@/lib/utils";

const RATIO: Record<string, number> = { "9:16": 9 / 16, "1:1": 1, "4:5": 4 / 5, "16:9": 16 / 9 };

function VideoLayer({ clip, media, muted }: { clip: TimelineClip; media: MediaItem; muted: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const playing = useEditorStore((s) => s.playing);
  const playhead = useEditorStore((s) => s.playhead);
  const local = clip.sourceIn + (playhead - clip.start) * clip.props.speed;

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.playbackRate = clip.props.speed;
    v.volume = Math.min(1, clip.props.volume / 100);
    v.muted = muted;
  }, [clip.props.speed, clip.props.volume, muted]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing) void v.play().catch(() => undefined);
    else v.pause();
  }, [playing]);

  useEffect(() => {
    const v = ref.current;
    if (!v || Number.isNaN(local)) return;
    // seek when scrubbing, or correct drift while playing
    if (!playing || Math.abs(v.currentTime - local) > 0.3) v.currentTime = Math.max(0, local);
  }, [local, playing]);

  return <video ref={ref} src={media.url} playsInline className="absolute inset-0 size-full object-cover" />;
}

export function PreviewStage() {
  const clips = useEditorStore((s) => s.clips);
  const tracks = useEditorStore((s) => s.tracks);
  const media = useEditorStore((s) => s.media);
  const playhead = useEditorStore((s) => s.playhead);
  const aspect = useEditorStore((s) => s.aspect);
  const select = useEditorStore((s) => s.select);
  const selectedId = useEditorStore((s) => s.selectedClipId);
  const captions = useCaptionStore((s) => s.captions);
  const captionStyle = useCaptionStore((s) => s.style);

  const visible = (trackId: string) => !tracks.find((t) => t.id === trackId)?.hidden;
  const at = (c: TimelineClip) => playhead >= c.start && playhead < c.start + c.duration;

  const videoClip = clips.find((c) => c.trackId === "t-video" && at(c) && visible(c.trackId));
  const overlays = clips.filter((c) => c.trackId === "t-overlay" && at(c) && visible(c.trackId));
  const videoMedia = videoClip?.mediaId ? media.find((m) => m.id === videoClip.mediaId) : undefined;
  const videoMuted = tracks.find((t) => t.id === "t-video")?.muted ?? false;
  const captionsVisible = visible("t-caption");
  const r = RATIO[aspect];

  return (
    <div className={cn("relative grid size-full place-items-center", captionFontVariables)} style={{ containerType: "size" }}>
      <div
        className="@container relative overflow-hidden rounded-lg bg-black shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)] ring-1 ring-white/10"
        style={{ width: `min(100cqw, calc(100cqh * ${r}))`, aspectRatio: String(r) }}
      >
        {videoClip ? (
          <button
            type="button"
            aria-label={`Select ${videoClip.name}`}
            onClick={() => select(videoClip.id)}
            className="absolute inset-0 cursor-default"
            style={{ opacity: videoClip.props.opacity / 100, filter: filterFor(videoClip.props), transform: transformFor(videoClip.props) }}
          >
            {videoMedia?.url ? (
              <VideoLayer clip={videoClip} media={videoMedia} muted={videoMuted} />
            ) : videoMedia?.remote ? (
              <span className="absolute inset-0 grid place-items-center bg-black">
                {videoMedia.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- remote platform thumbnail, host varies
                  <img src={videoMedia.thumbnailUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover opacity-80" />
                )}
                <span className="relative mx-3 rounded-lg bg-black/70 px-2.5 py-1.5 text-center text-[11px] leading-snug text-white/90 backdrop-blur">
                  Linked video · file not downloaded
                  <br />
                  Playback needs the media service
                </span>
              </span>
            ) : (
              <SceneThumb hue={videoClip.hue} className="absolute inset-0">
                <span className="absolute top-3 left-3 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/80 backdrop-blur">Media unavailable</span>
              </SceneThumb>
            )}
            {videoClip.props.effect === "glow" && (
              <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgb(196_181_253/0.25),transparent_60%)] mix-blend-screen" />
            )}
          </button>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs text-white/50">No video at playhead</div>
        )}

        {overlays.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => select(o.id)}
            aria-label={`Select text overlay ${o.name}`}
            className={cn(
              "absolute inset-x-[8%] top-1/2 cursor-default rounded-md text-center font-heading font-bold text-white [text-shadow:0_2px_12px_rgb(0_0_0/0.7)]",
              selectedId === o.id && "outline-2 outline-dashed outline-lavender",
            )}
            style={{
              fontSize: "7cqw",
              opacity: o.props.opacity / 100,
              transform: `translateY(-50%) ${transformFor(o.props)}`,
            }}
          >
            {o.name.replace(/^Title:\s*/i, "")}
          </button>
        ))}

        {captionsVisible && <CaptionOverlay captions={captions} style={captionStyle} time={playhead} />}
      </div>
    </div>
  );
}
