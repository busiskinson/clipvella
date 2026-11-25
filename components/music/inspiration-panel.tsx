"use client";

import { useState } from "react";
import { Loader2, ScanSearch, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardHeader, DemoBadge, GlassCard } from "@/components/common/page";
import { GENRES, MOODS } from "@/lib/sample-data";
import { seeded } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MusicDraft } from "./prompt-form";

const SUPPORTED: { name: string; test: RegExp }[] = [
  { name: "TikTok", test: /(^|\.)tiktok\.com$/i },
  { name: "Facebook Reels", test: /(^|\.)(facebook\.com|fb\.watch)$/i },
  { name: "YouTube", test: /(^|\.)(youtube\.com|youtu\.be)$/i },
];

interface Analysis {
  platform: string;
  bpm: number;
  energy: number;
  genre: string;
  mood: string;
  descriptors: string[];
}

const DESCRIPTORS = ["punchy drums", "airy synth pads", "warm bass", "plucked guitar", "lo-fi texture", "bright piano", "sub drops", "hand claps", "string swells", "side-chained pulse"];

export function InspirationPanel({ draft, setDraft }: { draft: MusicDraft; setDraft: (d: MusicDraft) => void }) {
  const [url, setUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "analyzing" | "done">("idle");
  const [result, setResult] = useState<Analysis | null>(null);

  const analyze = (e: React.FormEvent) => {
    e.preventDefault();
    let platform: string | undefined;
    try {
      const host = new URL(url.trim()).hostname;
      platform = SUPPORTED.find((p) => p.test.test(host))?.name;
    } catch {
      platform = undefined;
    }
    if (!platform) {
      setError("Paste a full TikTok, Facebook Reels or YouTube link.");
      return;
    }
    if (!consent) {
      setError("Confirm you can access this video and use it as a style reference.");
      return;
    }
    setError(null);
    setState("analyzing");
    // Simulated: a real implementation would derive tempo/energy descriptors server-side.
    setTimeout(() => {
      const rnd = seeded(Array.from(url).reduce((n, c) => n + c.charCodeAt(0), 0));
      const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
      setResult({
        platform: platform!,
        bpm: 80 + Math.round(rnd() * 60),
        energy: Math.round(30 + rnd() * 70),
        genre: pick(GENRES),
        mood: pick(MOODS),
        descriptors: [pick(DESCRIPTORS), pick(DESCRIPTORS), pick(DESCRIPTORS)].filter((v, i, a) => a.indexOf(v) === i),
      });
      setState("done");
    }, 1600);
  };

  const apply = () => {
    if (!result) return;
    setDraft({
      ...draft,
      genre: result.genre,
      mood: result.mood,
      bpm: result.bpm,
      prompt: `Original ${result.mood.toLowerCase()} ${result.genre.toLowerCase()} track around ${result.bpm} BPM with ${result.descriptors.join(", ")}. Inspired by the overall feel only — no melodies or samples from the reference.`,
    });
  };

  return (
    <GlassCard className="p-5 sm:p-6">
      <CardHeader icon={ScanSearch} title="Find inspiration from a video" description="Turn the feel of a reference into a prompt." actions={<DemoBadge label="Planned workflow" />} />

      <form onSubmit={analyze} className="mt-5 grid gap-3" noValidate>
        <Label htmlFor="ref-url">Reference video link</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="ref-url"
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            placeholder="https://www.tiktok.com/@creator/video/…"
            aria-invalid={!!error}
            aria-describedby="ref-help"
            className="h-10 flex-1"
          />
          <Button type="submit" variant="glass" className="h-10" disabled={state === "analyzing"}>
            {state === "analyzing" ? <Loader2 aria-hidden className="animate-spin" /> : <ScanSearch aria-hidden />}
            {state === "analyzing" ? "Analyzing…" : "Analyze"}
          </Button>
        </div>
        <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              if (error) setError(null);
            }}
            className="mt-0.5 size-4 shrink-0 accent-violet"
          />
          I can access this video and I am using it only as a style reference.
        </label>
        <p id="ref-help" role={error ? "alert" : undefined} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
          {error ?? "Supported: TikTok, Facebook Reels, YouTube."}
        </p>
      </form>

      <div className="mt-4 flex gap-3 rounded-xl border border-ice/20 bg-ice/[0.06] p-3 text-xs text-muted-foreground">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-ice" />
        <p>
          ClipForge reads only broad style descriptors such as tempo, energy and instrumentation. It never downloads, extracts or reproduces the
          reference audio, and the result is always a new, original composition.
        </p>
      </div>

      {state === "done" && result && (
        <div className="mt-4 grid gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Style profile · {result.platform}</p>
            <span className="text-xs text-muted-foreground">Sample analysis</span>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[
              ["Tempo", `${result.bpm} BPM`],
              ["Energy", `${result.energy}%`],
              ["Genre", result.genre],
              ["Mood", result.mood],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-black/20 p-2">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-1.5">
            {result.descriptors.map((d) => (
              <span key={d} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-muted-foreground">
                {d}
              </span>
            ))}
          </div>
          <Button size="sm" onClick={apply} className="justify-self-start">
            Use as prompt
          </Button>
        </div>
      )}
    </GlassCard>
  );
}
