"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Json, Tables } from "@/lib/database.types";
import { invalidateData } from "@/stores/data-store";
import { isWorkerOnline } from "./worker-status";

export type JobRow = Tables<"jobs">;
export type JobType = JobRow["type"];
export type CreateJobResult = { ok: true; job: JobRow; reused?: boolean } | { ok: false; code: string; message: string };

/** Queues work through the create-job Edge Function (ownership + storage checks happen there). */
export async function createJob(type: JobType, input: Record<string, unknown>): Promise<CreateJobResult> {
  const { data, error } = await createClient().functions.invoke<CreateJobResult>("create-job", { body: { type, input } });
  if (data) return data;
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      return (await ctx.json()) as CreateJobResult;
    } catch {
      /* fall through */
    }
  }
  return { ok: false, code: "server", message: error?.message ?? "Couldn't start the job." };
}

export async function cancelJob(id: string) {
  const { error } = await createClient().from("jobs").update({ status: "canceled" }).eq("id", id);
  if (error) throw error;
}

/** Most recent job of a type for a project (to resume progress after a reload). */
export async function latestJob(projectId: string, type: JobType): Promise<JobRow | null> {
  const { data, error } = await createClient()
    .from("jobs")
    .select("*")
    .eq("project_id", projectId)
    .eq("type", type)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Live job row via Realtime (plus an initial fetch). Invalidates data when the job finishes. */
export function useJob(jobId: string | null): JobRow | null {
  const [job, setJob] = useState<JobRow | null>(null);

  useEffect(() => {
    if (!jobId) return;
    const supabase = createClient();
    let alive = true;
    supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single()
      .then(({ data }) => alive && data && setJob(data));
    const channel = supabase
      .channel(`job-${jobId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${jobId}` }, (payload) => {
        const next = payload.new as JobRow;
        setJob(next);
        if (["succeeded", "failed", "canceled"].includes(next.status)) invalidateData();
      })
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [jobId]);

  return jobId ? job : null;
}

export interface WorkerState {
  online: boolean;
  lastSeen: string | null;
  capabilities: { ffmpeg?: boolean; vad?: boolean; scenedetect?: boolean; keys?: { groq?: boolean; gemini?: boolean } } | null;
}

/** Most recently seen worker, kept fresh with Realtime and a 15 s re-check of the timeout. */
export function useWorkerStatus(): WorkerState {
  const [row, setRow] = useState<Tables<"worker_status"> | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    supabase
      .from("worker_status")
      .select("*")
      .order("last_seen", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => alive && setRow(data));
    const channel = supabase
      .channel("worker-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_status" }, (payload) => setRow(payload.new as Tables<"worker_status">))
      .subscribe();
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      alive = false;
      clearInterval(tick);
      void supabase.removeChannel(channel);
    };
  }, []);

  return {
    online: isWorkerOnline(row?.last_seen, now),
    lastSeen: row?.last_seen ?? null,
    capabilities: (row?.capabilities as WorkerState["capabilities"] & Json) ?? null,
  };
}
