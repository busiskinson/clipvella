"use client";

import { useMemo } from "react";
import { seeded } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Decorative seeded waveform with a progress fill. */
export function Waveform({
  seed,
  progress = 0,
  bars = 96,
  className,
  onSeek,
}: {
  seed: number;
  progress?: number;
  bars?: number;
  className?: string;
  onSeek?: (fraction: number) => void;
}) {
  const heights = useMemo(() => {
    const rnd = seeded(seed);
    // rounded so server and client markup match exactly
    return Array.from({ length: bars }, (_, i) => Math.round(Math.min(1, 0.18 + Math.abs(Math.sin(i / 7 + seed)) * 0.45 + rnd() * 0.35) * 1000) / 1000);
  }, [seed, bars]);

  return (
    <div
      className={cn("flex h-16 items-center gap-[2px]", onSeek && "cursor-pointer", className)}
      onPointerDown={(e) => {
        if (!onSeek) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onSeek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
      }}
      aria-hidden
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className={cn("flex-1 rounded-full transition-colors duration-150", i / bars < progress ? "bg-ice" : "bg-white/15")}
          style={{ height: `${Math.round(h * 1000) / 10}%` }}
        />
      ))}
    </div>
  );
}
