"use client";

import { createClient } from "@/lib/supabase/client";

export interface UsageSummary {
  clips: number;
  minutes_processed: number;
  captions: number;
  imports: number;
  storage_bytes: number;
  activity: { day: string; minutes: number }[];
}

/** 1 GiB on the Supabase free plan; keep in sync with the create-job Edge Function. */
export const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

export async function getUsage(): Promise<UsageSummary> {
  const { data, error } = await createClient().rpc("usage_summary");
  if (error) throw error;
  return data as unknown as UsageSummary;
}
