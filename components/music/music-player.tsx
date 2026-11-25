"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Repeat, SkipBack, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { GlassCard, DemoBadge } from "@/components/common/page";
import { useMusicStore } from "@/stores/music-store";
import { DemoSynth } from "@/lib/demo-synth";
import { formatTime } from "@/lib/format";
import type { MusicTrack } from "@/lib/types";
import { Waveform } from "./waveform";

export function MusicPlayer() {
  const track = useMusicStore((s) => s.tracks.find((t) => t.id === s.activeId) ?? null);

  // stop playback when leaving the Music Studio
  useEffect(() => () => useMusicStore.getState().setPlaying(false), []);

  if (!track) {
    return (
      <GlassCard className="p-6 text-center text-sm text-muted-foreground">Generate or select a track to preview it here.</GlassCard>
    );
  }
  // keyed so position and engine state reset whenever the active track changes
  return <PlayerBody key={track.id} track={track} />;
}

function PlayerBody({ track }: { track: MusicTrack }) {
  const playing = useMusicStore((s) => s.playing);
  const setPlaying = useMusicStore((s) => s.setPlaying);

  const synth = useRef<DemoSynth | null>(null);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(70);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(false);
  const positionRef = useRef(0);

  // create / dispose the audio engine
  useEffect(() => {
    synth.current = new DemoSynth();
    return () => synth.current?.dispose();
  }, []);

  // start / stop the engine
  useEffect(() => {
    const s = synth.current;
    if (!s) return;
    if (playing) {
      void s.play(track, positionRef.current >= track.duration ? 0 : positionRef.current);
      let raf = 0;
      const tick = () => {
        const p = s.position;
        positionRef.current = p;
        setPosition(p);
        if (!s.playing) {
          if (loop) {
            positionRef.current = 0;
            void s.play(track, 0);
          } else {
            positionRef.current = 0;
            setPosition(0);
            setPlaying(false);
            return;
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(raf);
        s.stop();
      };
    }
  }, [playing, track, loop, setPlaying]);

  useEffect(() => {
    synth.current?.setVolume(muted ? 0 : volume / 100);
  }, [volume, muted]);

  const seek = (fraction: number) => {
    const t = fraction * track.duration;
    positionRef.current = t;
    setPosition(t);
    if (playing) void synth.current?.play(track, t);
  };

  return (
    <GlassCard className="relative overflow-hidden p-5 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-10 size-56 rounded-full bg-ice/10 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-ice uppercase">Now previewing</p>
          <h2 className="mt-1 truncate text-xl font-semibold">{track.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {track.genre} · {track.mood} · {track.bpm} BPM · {track.voice === "vocal" ? "Vocal (instrumental sketch)" : "Instrumental"}
          </p>
        </div>
        <DemoBadge label="Procedural preview" title="Plays a browser-synthesised sketch of the chosen tempo and mood. Not AI-generated audio." />
      </div>

      <div className="relative mt-5">
        <Waveform seed={track.seed} progress={position / track.duration} onSeek={seek} />
        <Slider
          aria-label="Playback position"
          className="mt-3"
          value={[position]}
          min={0}
          max={track.duration}
          step={0.5}
          onValueChange={([v]) => seek(v / track.duration)}
        />
        <div className="mt-1.5 flex justify-between font-mono text-xs tabular-nums text-muted-foreground">
          <span>{formatTime(position)}</span>
          <span>{formatTime(track.duration)}</span>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Restart" onClick={() => seek(0)}>
          <SkipBack aria-hidden />
        </Button>
        <Button size="icon-lg" className="rounded-full" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)}>
          {playing ? <Pause aria-hidden className="fill-current" /> : <Play aria-hidden className="translate-x-px fill-current" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={loop ? "Turn loop off" : "Turn loop on"}
          aria-pressed={loop}
          onClick={() => setLoop((l) => !l)}
          className={loop ? "text-lavender" : undefined}
        >
          <Repeat aria-hidden />
        </Button>
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-40">
          <Button variant="ghost" size="icon-sm" aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>
            {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
          </Button>
          <Slider aria-label="Volume" value={[muted ? 0 : volume]} min={0} max={100} onValueChange={([v]) => { setMuted(false); setVolume(v); }} />
        </div>
      </div>
    </GlassCard>
  );
}
