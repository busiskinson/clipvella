"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";
import { invalidateData } from "@/stores/data-store";
import { signedUrls, type AssetRow } from "./projects";

export type ClipRow = Tables<"clips">;
export interface ClipView extends ClipRow {
  videoUrl: string | null;
  thumbUrl: string | null;
  video: AssetRow | null;
}

/** Clips of a project, best score first, with signed URLs for their video and thumbnail. */
export async function listClips(projectId: string): Promise<ClipView[]> {
  const supabase = createClient();
  const { data: clips, error } = await supabase.from("clips").select("*").eq("project_id", projectId).order("score", { ascending: false, nullsFirst: false });
  if (error) throw error;
  const ids = clips.flatMap((c) => [c.output_asset_id, c.thumbnail_asset_id]).filter(Boolean) as string[];
  const { data: assets } = ids.length ? await supabase.from("media_assets").select("*").in("id", ids) : { data: [] as AssetRow[] };
  const byId = new Map((assets ?? []).map((a) => [a.id, a]));
  const [videos, thumbs] = await Promise.all([
    signedUrls("media", clips.map((c) => (c.output_asset_id ? byId.get(c.output_asset_id)?.path : undefined)).filter(Boolean) as string[]),
    signedUrls("thumbnails", clips.map((c) => (c.thumbnail_asset_id ? byId.get(c.thumbnail_asset_id)?.path : undefined)).filter(Boolean) as string[]),
  ]);
  return clips.map((c) => {
    const video = c.output_asset_id ? (byId.get(c.output_asset_id) ?? null) : null;
    const thumb = c.thumbnail_asset_id ? byId.get(c.thumbnail_asset_id) : undefined;
    // cache-bust re-renders that overwrite the same path
    const bust = `#v=${encodeURIComponent(c.updated_at)}`;
    return {
      ...c,
      video,
      videoUrl: video && videos[video.path] ? videos[video.path] + bust : null,
      thumbUrl: thumb && thumbs[thumb.path] ? thumbs[thumb.path] : null,
    };
  });
}

export async function updateClip(id: string, patch: Partial<Pick<ClipRow, "title" | "description" | "start_s" | "end_s" | "hashtags">>) {
  const { error } = await createClient().from("clips").update(patch).eq("id", id);
  if (error) throw error;
  invalidateData();
}

/** Refetch clip data whenever any clip of this project changes (renders finishing, re-renders). */
export function useClipsRealtime(projectId: string | null) {
  useEffect(() => {
    if (!projectId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`clips-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "clips", filter: `project_id=eq.${projectId}` }, () => invalidateData())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId]);
}
