"use client";

import { AlertTriangle, CheckCircle2, Loader2, PlugZap, RotateCcw, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cancelJob, useWorkerStatus, type JobRow } from "@/lib/data/jobs";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function lastSeenLabel(iso: string | null) {
  if (!iso) return "never";
  const secs = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (secs < 120) return `${secs}s ago`;
  if (secs < 7200) return `${Math.round(secs / 60)} min ago`;
  return formatDate(iso);
}

/**
 * Real job state from the database. Never animates on its own: progress only moves when the worker reports it.
 */
export function JobProgress({ job, onRetry, className }: { job: JobRow | null; onRetry?: () => void; className?: string }) {
  const worker = useWorkerStatus();
  if (!job) return null;

  const active = job.status === "queued" || job.status === "running";
  const waiting = job.status === "queued" && !worker.online;
  const stalled = job.status === "running" && !worker.online;

  return (
    <div className={cn("grid gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4", className)} aria-live="polite">
      <div className="flex items-center gap-2 text-sm">
        {job.status === "succeeded" ? (
          <CheckCircle2 aria-hidden className="size-4 text-success" />
        ) : job.status === "failed" ? (
          <AlertTriangle aria-hidden className="size-4 text-destructive" />
        ) : waiting ? (
          <PlugZap aria-hidden className="size-4 text-warning" />
        ) : active ? (
          <Loader2 aria-hidden className="size-4 animate-spin text-lavender" />
        ) : (
          <Square aria-hidden className="size-4 text-muted-foreground" />
        )}
        <span className="font-medium">
          {job.status === "succeeded"
            ? "Done"
            : job.status === "failed"
              ? "Failed"
              : job.status === "canceled"
                ? "Canceled"
                : waiting
                  ? "Waiting for the worker"
                  : job.status === "queued"
                    ? "Queued"
                    : (job.stage ?? "Working")}
        </span>
        {active && !waiting && <span className="ml-auto tabular-nums text-muted-foreground">{job.progress}%</span>}
      </div>

      {active && !waiting && <Progress value={job.progress} aria-label="Job progress" className="h-2" />}

      {waiting && (
        <p className="text-xs text-muted-foreground">
          The worker on your PC isn&apos;t running (last seen {lastSeenLabel(worker.lastSeen)}). Start it with{" "}
          <code className="rounded bg-black/30 px-1 py-0.5">uv run python -m clipvella_worker</code> in the <code>worker</code> folder. The job
          will start automatically.
        </p>
      )}
      {stalled && (
        <p className="text-xs text-warning">
          The worker hasn&apos;t reported for a while (last seen {lastSeenLabel(worker.lastSeen)}). If it stopped, restart it; the job is retried
          automatically after 10 minutes.
        </p>
      )}
      {job.status === "failed" && job.error && (
        <p role="alert" className="text-sm text-destructive">
          {job.error}
        </p>
      )}

      {(active || (job.status === "failed" && onRetry)) && (
        <div className="flex gap-2">
          {active && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancelJob(job.id).catch((e) => toast.error("Couldn't cancel", { description: e instanceof Error ? e.message : undefined }))}
            >
              <Square aria-hidden /> Cancel
            </Button>
          )}
          {job.status === "failed" && onRetry && (
            <Button variant="glass" size="sm" onClick={onRetry}>
              <RotateCcw aria-hidden /> Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
