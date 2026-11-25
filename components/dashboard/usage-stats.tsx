"use client";

import { useState } from "react";
import { BarChart3, HardDrive } from "lucide-react";
import { CardHeader, GlassCard } from "@/components/common/page";
import { useUsage } from "@/lib/data/hooks";
import { STORAGE_LIMIT_BYTES, type UsageSummary } from "@/lib/data/usage";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
};

function StatSkeleton() {
  return <span className="inline-block h-8 w-14 animate-pulse rounded bg-white/[0.08]" />;
}

export function UsageStats() {
  const { data, error } = useUsage();
  const stats: { label: string; key: keyof UsageSummary; unit?: string }[] = [
    { label: "Clips generated", key: "clips" },
    { label: "Minutes processed", key: "minutes_processed", unit: "min" },
    { label: "Transcripts created", key: "captions" },
    { label: "Videos imported", key: "imports" },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your usage</h2>
        <span className="text-xs text-muted-foreground">All time</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t load usage: {error}
        </p>
      )}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.key} className="glass rounded-2xl p-4 sm:p-5">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              {data ? <span className="font-heading text-3xl font-semibold tabular-nums">{data[s.key] as number}</span> : <StatSkeleton />}
              {s.unit && <span className="text-sm text-muted-foreground">{s.unit}</span>}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Single-series bar chart: minutes processed per day. Title names the series, so no legend. */
export function ActivityChart() {
  const { data: usage } = useUsage();
  const days = usage?.activity ?? [];
  const values = days.map((d) => d.minutes);
  const max = Math.max(1, ...values);
  const [hover, setHover] = useState<number | null>(null);
  const ticks = [0, Math.round(max / 2), max];
  const empty = usage && values.every((v) => v === 0);

  return (
    <GlassCard className="flex flex-col p-5 sm:p-6">
      <CardHeader icon={BarChart3} title="Minutes processed per day" description="Last 14 days" />
      <div className="relative mt-6 flex h-48 gap-3">
        <div aria-hidden className="flex flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-muted-foreground">
          {[...ticks].reverse().map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
        <div className="relative flex-1">
          <div aria-hidden className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
            {ticks.map((_, i) => (
              <div key={i} className="border-t border-dashed border-white/[0.06]" />
            ))}
          </div>
          {empty && (
            <p className="absolute inset-x-0 top-1/3 text-center text-sm text-muted-foreground">No videos processed yet</p>
          )}
          <div className="absolute inset-x-0 top-0 bottom-6 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
            {days.map((d, i) => (
              <button
                key={d.day}
                type="button"
                className="group relative flex h-full flex-1 items-end outline-offset-1"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${dayLabel(d.day)}: ${d.minutes} minutes`}
              >
                <span
                  className={cn("block w-full rounded-t-[4px] transition-colors duration-150", hover === null || hover === i ? "bg-violet" : "bg-violet/45")}
                  style={{ height: `${(d.minutes / max) * 100}%` }}
                />
              </button>
            ))}
          </div>
          {hover !== null && days[hover] && (
            <div
              role="status"
              className="glass-strong pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap"
              style={{ left: `${((hover + 0.5) / days.length) * 100}%` }}
            >
              <span className="text-muted-foreground">{dayLabel(days[hover].day)}</span>{" "}
              <span className="font-semibold tabular-nums">{days[hover].minutes} min</span>
            </div>
          )}
          {days.length > 0 && (
            <div aria-hidden className="absolute inset-x-0 bottom-0 flex justify-between text-[11px] text-muted-foreground">
              <span>{dayLabel(days[0].day)}</span>
              <span>{dayLabel(days[days.length - 1].day)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="sr-only">
        <table>
          <caption>Minutes processed per day</caption>
          <tbody>
            {days.map((d) => (
              <tr key={d.day}>
                <th scope="row">{dayLabel(d.day)}</th>
                <td>{d.minutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

export function StorageCard() {
  const { data } = useUsage();
  const used = data?.storage_bytes ?? 0;
  const pct = Math.min(100, Math.round((used / STORAGE_LIMIT_BYTES) * 100));
  return (
    <GlassCard className="flex flex-col p-5 sm:p-6">
      <CardHeader icon={HardDrive} title="Storage" description="Supabase free plan" />
      <div className="mt-6 flex items-baseline gap-2">
        <span className="font-heading text-4xl font-semibold tabular-nums">{data ? formatBytes(STORAGE_LIMIT_BYTES - used) : "…"}</span>
        <span className="text-sm text-muted-foreground">free</span>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]"
        role="progressbar"
        aria-label="Storage used"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn("h-full rounded-full", pct > 90 ? "bg-destructive" : "bg-gradient-to-r from-violet to-ice")} style={{ width: `${pct}%` }} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <dt className="text-muted-foreground">Used</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{formatBytes(used)}</dd>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <dt className="text-muted-foreground">Plan</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{formatBytes(STORAGE_LIMIT_BYTES)}</dd>
        </div>
      </dl>
    </GlassCard>
  );
}
