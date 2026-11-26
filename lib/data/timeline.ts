"use client";

import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/database.types";
import type { AspectRatio, MediaItem, TimelineClip, Track } from "@/lib/types";
import { DEFAULT_PROPS, INITIAL_TRACKS } from "@/stores/editor-store";
import { getProjectRow, signedUrls, updateProject, type AssetRow } from "./projects";

/**
 * What the editor saves in projects.timeline. Read by the worker's render_export pipeline
 * (worker/clipvella_worker/pipelines/export.py) — keep both in sync.
 * Media is stored by reference (assetId); signed URLs are created fresh on every load.
 */
export interface TimelineSnapshot {
  version: 1;
  aspect: AspectRatio;
  tracks: Track[];
  clips: TimelineClip[];
  media: { id: string; assetId?: string; kind: MediaItem["kind"]; name: string; duration: number; hue: number }[];
  captions_visible: boolean;
}

export function toSnapshot(s: { aspect: AspectRatio; tracks: Track[]; clips: TimelineClip[]; media: MediaItem[] }): TimelineSnapshot {
  const used = new Set(s.clips.map((c) => c.mediaId));
  return {
    version: 1,
    aspect: s.aspect,
    tracks: s.tracks,
    clips: s.clips,
    // keep stored media plus anything on the timeline; local-only blobs can't be restored later
    media: s.media.filter((m) => m.assetId || used.has(m.id)).map((m) => ({ id: m.id, assetId: m.assetId, kind: m.kind, name: m.name, duration: m.duration, hue: m.hue })),
    captions_visible: !(s.tracks.find((t) => t.kind === "caption")?.hidden ?? false),
  };
}

const hue = (id: string) => Array.from(id).reduce((n, c) => n + c.charCodeAt(0), 0) % 6;

export const assetToMedia = (a: AssetRow, url?: string): MediaItem => ({
  id: `asset-${a.id}`,
  assetId: a.id,
  name: a.file_name ?? a.path.split("/").pop() ?? "media",
  kind: a.kind === "audio" || a.mime?.startsWith("audio/") ? "audio" : "video",
  duration: a.duration_s ?? 0,
  url,
  hue: hue(a.id),
});

/** The user's stored uploads, clips and audio, with fresh signed URLs (for the media bin). */
export async function listLibrary(): Promise<MediaItem[]> {
  const { data, error } = await createClient()
    .from("media_assets")
    .select("*")
    .in("kind", ["upload", "clip", "audio"])
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const urls: Record<string, string> = {};
  for (const bucket of ["uploads", "media"]) Object.assign(urls, await signedUrls(bucket, data.filter((a) => a.bucket === bucket).map((a) => a.path), 6 * 3600));
  return data.map((a) => assetToMedia(a, urls[a.path]));
}

export interface LoadedEditorProject {
  projectId: string;
  name: string;
  aspect: AspectRatio;
  tracks: Track[];
  clips: TimelineClip[];
  media: MediaItem[];
  captions: Json;
  captionStyle: Json | null;
  linkOnly: boolean;
}

/** Loads a project's saved timeline, or starts one from its source video. */
export async function loadEditorProject(projectId: string): Promise<LoadedEditorProject> {
  const p = await getProjectRow(projectId);
  const library = await listLibrary();
  const byAsset = new Map(library.map((m) => [m.assetId, m]));
  const snap = p.timeline as unknown as TimelineSnapshot | null;

  let clips: TimelineClip[] = [];
  let tracks: Track[] = INITIAL_TRACKS;
  let media: MediaItem[] = library;
  if (snap?.version === 1) {
    tracks = snap.tracks;
    clips = snap.clips;
    const extra = snap.media.filter((m) => !m.assetId || !byAsset.has(m.assetId)).map((m) => ({ ...m, url: undefined }));
    // timeline media ids must resolve to the same entries
    media = [
      ...snap.media.filter((m) => m.assetId && byAsset.has(m.assetId)).map((m) => ({ ...byAsset.get(m.assetId)!, id: m.id })),
      ...extra,
      ...library.filter((l) => !snap.media.some((m) => m.assetId === l.assetId)),
    ];
  } else if (p.source_asset_id) {
    const src = byAsset.get(p.source_asset_id);
    if (src) {
      clips = [
        {
          id: `k-${p.source_asset_id.slice(0, 8)}`,
          trackId: "t-video",
          name: src.name,
          start: 0,
          duration: src.duration > 0 ? src.duration : 10,
          sourceIn: 0,
          mediaId: src.id,
          hue: src.hue,
          props: { ...DEFAULT_PROPS },
        },
      ];
    }
  }
  return {
    projectId,
    name: p.name,
    aspect: (snap?.aspect ?? p.aspect) as AspectRatio,
    tracks,
    clips,
    media,
    captions: p.captions,
    captionStyle: p.caption_style,
    linkOnly: !!p.link && !p.source_asset_id,
  };
}

export async function saveTimeline(projectId: string, snapshot: TimelineSnapshot, name?: string) {
  await updateProject(projectId, { timeline: snapshot as unknown as Json, aspect: snapshot.aspect, ...(name ? { name } : {}) }, { silent: true });
}
