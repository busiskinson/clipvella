"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Music2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { CardHeader, DemoBadge, GlassCard } from "@/components/common/page";
import { Segmented, SliderField } from "@/components/common/fields";
import { useMusicStore } from "@/stores/music-store";
import { GENRES, MOODS } from "@/lib/sample-data";
import type { MusicVoice } from "@/lib/types";
import { formatDuration, uid } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MusicDraft {
  prompt: string;
  genre: string;
  mood: string;
  voice: MusicVoice;
  duration: number;
  bpm: number;
}

function ChipGroup({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2">
      <span id={`chips-${label}`} className="text-sm font-medium">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={`chips-${label}`} className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => onChange(o)}
            className={cn(
              "h-8 rounded-full border px-3 text-sm transition-colors duration-200",
              value === o ? "border-violet/50 bg-violet/[0.16] text-foreground" : "border-white/[0.08] text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

const TITLES_A = ["Velvet", "Neon", "Golden", "Midnight", "Paper", "Crystal", "Silver", "Ember", "Ocean", "Static"];
const TITLES_B = ["Skyline", "Drift", "Hours", "Signal", "Bloom", "Echoes", "Motion", "Lights", "Avenue", "Pulse"];

export function PromptForm({ draft, setDraft }: { draft: MusicDraft; setDraft: (d: MusicDraft) => void }) {
  const addTrack = useMusicStore((s) => s.addTrack);
  const setPlaying = useMusicStore((s) => s.setPlaying);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const patch = (p: Partial<MusicDraft>) => setDraft({ ...draft, ...p });

  const generate = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.prompt.trim().length < 8) {
      setError("Describe the music in a few more words (at least 8 characters).");
      return;
    }
    setError(null);
    setPlaying(false);
    setProgress(0);
    let pct = 0;
    // Simulated generation; side effects stay outside state updaters.
    timer.current = setInterval(() => {
      pct += 5;
      setProgress(Math.min(pct, 100));
      if (pct >= 100) {
        if (timer.current) clearInterval(timer.current);
        const seed = Math.floor(Math.random() * 10000);
        addTrack({
            id: uid("m"),
            title: `${TITLES_A[seed % TITLES_A.length]} ${TITLES_B[(seed >> 3) % TITLES_B.length]}`,
            prompt: draft.prompt.trim(),
            genre: draft.genre,
            mood: draft.mood,
            voice: draft.voice,
            duration: draft.duration,
            bpm: draft.bpm,
            createdAt: new Date().toISOString(),
            seed,
            favorite: false,
          });
          toast.success("Demo track added to history", { description: "A procedural sketch stands in for AI audio until the music API is connected." });
        setTimeout(() => setProgress(null), 300);
      }
    }, 80);
  };

  const busy = progress !== null;

  return (
    <GlassCard className="p-5 sm:p-6">
      <CardHeader icon={Wand2} title="Describe your track" description="Original music only — never a copy of an existing song." actions={<DemoBadge />} />
      <form onSubmit={generate} className="mt-5 grid gap-5" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="music-prompt">Prompt</Label>
          <Textarea
            id="music-prompt"
            value={draft.prompt}
            onChange={(e) => {
              patch({ prompt: e.target.value });
              if (error) setError(null);
            }}
            rows={3}
            placeholder="e.g. Warm lo-fi beat with soft keys and vinyl crackle for a cozy study vlog"
            aria-invalid={!!error}
            aria-describedby="music-prompt-help"
            className="resize-none bg-black/20"
          />
          <p id="music-prompt-help" className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
            {error ?? `${draft.prompt.length}/280 · Mention instruments, energy and where the music will be used.`}
          </p>
        </div>

        <ChipGroup label="Genre" options={GENRES} value={draft.genre} onChange={(genre) => patch({ genre })} />
        <ChipGroup label="Mood" options={MOODS} value={draft.mood} onChange={(mood) => patch({ mood })} />

        <div className="grid gap-2">
          <span className="text-sm font-medium">Vocals</span>
          <Segmented<MusicVoice>
            label="Vocals"
            value={draft.voice}
            onChange={(voice) => patch({ voice })}
            options={[
              { value: "instrumental", label: <><Music2 aria-hidden className="size-4" /> Instrumental</> },
              { value: "vocal", label: <><Mic aria-hidden className="size-4" /> With vocals</> },
            ]}
          />
          {draft.voice === "vocal" && <p className="text-xs text-muted-foreground">Vocal generation needs the music API. The demo preview plays an instrumental sketch.</p>}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <SliderField label="Duration" value={draft.duration} min={15} max={240} step={5} onChange={(duration) => patch({ duration })} format={formatDuration} />
          <SliderField label="Tempo" value={draft.bpm} min={60} max={160} onChange={(bpm) => patch({ bpm })} format={(v) => `${v} BPM`} />
        </div>

        {busy ? (
          <div className="grid gap-2" aria-live="polite">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 aria-hidden className="size-4 animate-spin text-lavender" /> Composing demo sketch… {progress}%
            </div>
            <Progress value={progress} aria-label="Generation progress" className="h-2" />
          </div>
        ) : (
          <Button type="submit" size="lg">
            <Sparkles aria-hidden /> Generate music
          </Button>
        )}
      </form>
    </GlassCard>
  );
}
