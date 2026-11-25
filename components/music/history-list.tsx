"use client";

import { useState } from "react";
import { History, Pause, Play, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardHeader, GlassCard } from "@/components/common/page";
import { Segmented } from "@/components/common/fields";
import { useMusicStore } from "@/stores/music-store";
import { formatDate, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export function HistoryList() {
  const tracks = useMusicStore((s) => s.tracks);
  const activeId = useMusicStore((s) => s.activeId);
  const playing = useMusicStore((s) => s.playing);
  const setActive = useMusicStore((s) => s.setActive);
  const setPlaying = useMusicStore((s) => s.setPlaying);
  const toggleFavorite = useMusicStore((s) => s.toggleFavorite);
  const removeTrack = useMusicStore((s) => s.removeTrack);
  const [filter, setFilter] = useState<"all" | "favorites">("all");

  const list = filter === "favorites" ? tracks.filter((t) => t.favorite) : tracks;

  const toggle = (id: string) => {
    if (id === activeId) setPlaying(!playing);
    else {
      setActive(id);
      setPlaying(true);
    }
  };

  return (
    <GlassCard className="p-5 sm:p-6">
      <CardHeader icon={History} title="Generated music" description={`${tracks.length} tracks`} />
      <Segmented<"all" | "favorites">
        label="Filter tracks"
        value={filter}
        onChange={setFilter}
        size="sm"
        className="mt-4"
        options={[
          { value: "all", label: "All" },
          { value: "favorites", label: "Favorites" },
        ]}
      />
      {list.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{filter === "favorites" ? "No favorites yet — star a track to keep it here." : "No tracks yet."}</p>
      ) : (
        <ul className="mt-3 grid gap-1.5">
          {list.map((t) => {
            const active = t.id === activeId;
            const isPlaying = active && playing;
            return (
              <li
                key={t.id}
                className={cn(
                  "flex min-w-0 items-center gap-3 rounded-xl border p-2.5 transition-colors duration-200",
                  active ? "border-ice/30 bg-ice/[0.06]" : "border-transparent hover:bg-white/[0.03]",
                )}
              >
                <Button variant={active ? "default" : "glass"} size="icon" className="shrink-0 rounded-full" aria-label={isPlaying ? `Pause ${t.title}` : `Play ${t.title}`} onClick={() => toggle(t.id)}>
                  {isPlaying ? (
                    <span aria-hidden className="flex h-3.5 items-end gap-[2px]">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="w-[3px] origin-bottom rounded-full bg-current" style={{ height: "100%", animation: `cf-eq 0.9s ${i * 0.15}s ease-in-out infinite` }} />
                      ))}
                    </span>
                  ) : active ? (
                    <Play aria-hidden className="translate-x-px fill-current" />
                  ) : (
                    <Play aria-hidden className="translate-x-px" />
                  )}
                  {isPlaying && <Pause aria-hidden className="sr-only" />}
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="truncate text-xs text-muted-foreground" title={t.prompt}>
                    {t.genre} · {t.mood} · {formatDuration(t.duration)} · {formatDate(t.createdAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t.favorite ? `Remove ${t.title} from favorites` : `Add ${t.title} to favorites`}
                  aria-pressed={t.favorite}
                  onClick={() => toggleFavorite(t.id)}
                >
                  <Star aria-hidden className={t.favorite ? "fill-warning text-warning" : undefined} />
                </Button>
                <Button variant="ghost" size="icon-sm" className="hover:text-destructive" aria-label={`Delete ${t.title}`} onClick={() => removeTrack(t.id)}>
                  <Trash2 aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
