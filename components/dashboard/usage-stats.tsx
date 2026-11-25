"use client";

import { useState } from "react";
import { BarChart3, Gauge, TrendingUp } from "lucide-react";
import { CardHeader, GlassCard, SampleDataNote } from "@/components/common/page";
import { SAMPLE_USAGE } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

export function UsageStats() {
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Usage this month</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline">{SAMPLE_USAGE.period}</span>
          <SampleDataNote />
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SAMPLE_USAGE.stats.map((s) => (
          <li key={s.label} className="glass rounded-2xl p-4 sm:p-5">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="font-heading text-3xl font-semibold tabular-nums">{s.value}</span>
              {s.unit && <span className="text-sm text-muted-foreground">{s.unit}</span>}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-success">
              <TrendingUp aria-hidden className="size-3" />
              {s.delta} <span className="text-muted-foreground">vs last month</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Single-series bar chart: minutes processed per day. Title names the series, so no legend. */
export function ActivityChart() {
  const data = SAMPLE_USAGE.daily;
  const max = Math.max(...data);
  const [hover, setHover] = useState<number | null>(null);
  const ticks = [0, Math.round(max / 2), max];
  const dayLabel = (i: number) => `Nov ${12 + i}`;

  return (
    <GlassCard className="flex flex-col p-5 sm:p-6">
      <CardHeader
        icon={BarChart3}
        title="Minutes processed per day"
        description="Last 14 days"
        actions={<SampleDataNote />}
      />
      <div className="relative mt-6 flex h-48 gap-3">
        {/* y axis */}
        <div aria-hidden className="flex flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-muted-foreground">
          {[...ticks].reverse().map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="relative flex-1">
          {/* recessive grid */}
          <div aria-hidden className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
            {ticks.map((t) => (
              <div key={t} className="border-t border-dashed border-white/[0.06]" />
            ))}
          </div>
          <div className="absolute inset-x-0 top-0 bottom-6 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
            {data.map((v, i) => (
              <button
                key={i}
                type="button"
                className="group relative flex h-full flex-1 items-end outline-offset-1"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${dayLabel(i)}: ${v} minutes`}
              >
                <span
                  className={cn(
                    "block w-full rounded-t-[4px] transition-colors duration-150",
                    hover === null || hover === i ? "bg-violet" : "bg-violet/45",
                  )}
                  style={{ height: `${(v / max) * 100}%` }}
                />
              </button>
            ))}
          </div>
          {hover !== null && (
            <div
              role="status"
              className="glass-strong pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap"
              style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
            >
              <span className="text-muted-foreground">{dayLabel(hover)}</span>{" "}
              <span className="font-semibold tabular-nums">{data[hover]} min</span>
            </div>
          )}
          <div aria-hidden className="absolute inset-x-0 bottom-0 flex justify-between text-[11px] text-muted-foreground">
            <span>{dayLabel(0)}</span>
            <span>{dayLabel(data.length - 1)}</span>
          </div>
        </div>
      </div>
      <div className="sr-only">
      <table>
        <caption>Minutes processed per day (sample data)</caption>
        <tbody>
          {data.map((v, i) => (
            <tr key={i}>
              <th scope="row">{dayLabel(i)}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </GlassCard>
  );
}

export function CreditsCard() {
  const { used, total } = SAMPLE_USAGE.credits;
  const pct = Math.round((used / total) * 100);
  return (
    <GlassCard className="flex flex-col p-5 sm:p-6">
      <CardHeader icon={Gauge} title="Processing credits" description="Resets Dec 1" actions={<SampleDataNote />} />
      <div className="mt-6 flex items-baseline gap-2">
        <span className="font-heading text-4xl font-semibold tabular-nums">{total - used}</span>
        <span className="text-sm text-muted-foreground">minutes left</span>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]"
        role="progressbar"
        aria-label="Credits used"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-gradient-to-r from-violet to-ice" style={{ width: `${pct}%` }} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <dt className="text-muted-foreground">Used</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{used} min</dd>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <dt className="text-muted-foreground">Plan</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{total} min</dd>
        </div>
      </dl>
    </GlassCard>
  );
}
