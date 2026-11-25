"use client";

import { createClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert } from "@/lib/database.types";
import type { ResolveResponse } from "@/lib/platforms";
import { invalidateData } from "@/stores/data-store";

export type DownloadRow = Tables<"downloads">;
export type HistoryStatus = "analyzed" | "imported" | "download-unavailable" | "downloaded" | "failed";

/** Calls the resolve-link Edge Function (public oEmbed metadata, signed-in users only). */
export async function resolveLink(url: string): Promise<ResolveResponse> {
  const { data, error } = await createClient().functions.invoke<ResolveResponse>("resolve-link", { body: { url } });
  if (data) return data;
  // Non-2xx responses carry the JSON body on error.context
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      return (await ctx.json()) as ResolveResponse;
    } catch {
      /* fall through */
    }
  }
  return { ok: false, code: "upstream_error", message: error?.message ?? "Couldn't reach the link checker." };
}

export async function listDownloads(): Promise<DownloadRow[]> {
  const { data, error } = await createClient().from("downloads").select("*").order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  return data;
}

/**
 * Records an action in the download history. The same link analyzed again replaces its old row
 * (moves to the top) and keeps the project it was imported into.
 */
export async function recordDownload(entry: Omit<TablesInsert<"downloads">, "owner_id">): Promise<DownloadRow> {
  const supabase = createClient();
  let projectId = entry.project_id ?? null;
  if (entry.url) {
    const { data: prev } = await supabase.from("downloads").select("id, project_id").eq("url", entry.url);
    if (prev?.length) {
      projectId = projectId ?? prev.find((p) => p.project_id)?.project_id ?? null;
      await supabase.from("downloads").delete().in("id", prev.map((p) => p.id));
    }
  }
  const { data, error } = await supabase
    .from("downloads")
    .insert({ ...entry, project_id: projectId })
    .select()
    .single();
  if (error) throw error;
  invalidateData();
  return data;
}

export async function updateDownload(id: string, patch: Partial<Pick<DownloadRow, "status" | "detail" | "project_id">>) {
  const { error } = await createClient().from("downloads").update(patch).eq("id", id);
  if (error) throw error;
  invalidateData();
}

export async function removeDownload(id: string) {
  const { error } = await createClient().from("downloads").delete().eq("id", id);
  if (error) throw error;
  invalidateData();
}

export async function clearDownloads() {
  const { error } = await createClient().from("downloads").delete().not("id", "is", null);
  if (error) throw error;
  invalidateData();
}
