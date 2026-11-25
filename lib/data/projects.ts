"use client";

import { createClient } from "@/lib/supabase/client";
import type { Json, Tables } from "@/lib/database.types";
import type { AspectRatio, Project, ProjectKind, ProjectSource, SupportedPlatform } from "@/lib/types";
import { invalidateData } from "@/stores/data-store";
import { projectPrefix } from "./storage-paths";

export type ProjectRow = Tables<"projects">;
export type AssetRow = Tables<"media_assets">;

export interface LinkInfo {
  url: string;
  platform: SupportedPlatform;
  author?: string | null;
  thumbnail?: string | null;
}

const BUCKETS = ["media", "thumbnails", "captions"] as const;

async function uid() {
  const { data } = await createClient().auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) throw new Error("You're signed out. Log in again.");
  return id;
}

/** Signed URLs for a batch of objects in one bucket (missing paths are skipped). */
export async function signedUrls(bucket: string, paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await createClient().storage.from(bucket).createSignedUrls(paths, expiresIn);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

export async function getSignedUrl(bucket: string, path: string, expiresIn = 3600, download?: string): Promise<string> {
  const { data, error } = await createClient()
    .storage.from(bucket)
    .createSignedUrl(path, expiresIn, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

/** Stable small number from an id, used only to pick a decorative gradient. */
const hueOf = (id: string) => Array.from(id).reduce((n, c) => n + c.charCodeAt(0), 0) % 6;

export function toUiProject(row: ProjectRow, source: AssetRow | undefined, thumbUrl: string | undefined, clipCount: number): Project {
  const link = row.link as unknown as LinkInfo | null;
  const projectSource: ProjectSource | undefined = link
    ? { type: "link", url: link.url, platform: link.platform, author: link.author ?? undefined, thumbnail: link.thumbnail ?? undefined }
    : source
      ? { type: "file", fileName: source.file_name ?? undefined, fileSize: source.size_bytes, thumbnail: thumbUrl }
      : undefined;
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    status: row.status,
    aspect: row.aspect as AspectRatio,
    duration: source?.duration_s ?? 0,
    updatedAt: row.updated_at,
    hue: hueOf(row.id),
    clips: clipCount || undefined,
    source: projectSource ?? (thumbUrl ? { type: "file", thumbnail: thumbUrl } : undefined),
    sourceAssetId: row.source_asset_id ?? undefined,
  };
}

/** All of the user's projects with source durations, thumbnails and clip counts. */
export async function listProjects(): Promise<Project[]> {
  const supabase = createClient();
  const { data: rows, error } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  if (!rows.length) return [];

  const assetIds = [...new Set(rows.flatMap((r) => [r.source_asset_id, r.thumbnail_asset_id]).filter(Boolean))] as string[];
  const [{ data: assets, error: aErr }, { data: clips, error: cErr }] = await Promise.all([
    assetIds.length ? supabase.from("media_assets").select("*").in("id", assetIds) : Promise.resolve({ data: [] as AssetRow[], error: null }),
    supabase.from("clips").select("project_id").eq("status", "ready"),
  ]);
  if (aErr) throw aErr;
  if (cErr) throw cErr;

  const byId = new Map((assets ?? []).map((a) => [a.id, a]));
  const thumbs = await signedUrls(
    "thumbnails",
    rows.map((r) => (r.thumbnail_asset_id ? byId.get(r.thumbnail_asset_id)?.path : undefined)).filter(Boolean) as string[],
  );
  const clipCounts = new Map<string, number>();
  (clips ?? []).forEach((c) => clipCounts.set(c.project_id, (clipCounts.get(c.project_id) ?? 0) + 1));

  return rows.map((r) => {
    const thumbAsset = r.thumbnail_asset_id ? byId.get(r.thumbnail_asset_id) : undefined;
    return toUiProject(r, r.source_asset_id ? byId.get(r.source_asset_id) : undefined, thumbAsset ? thumbs[thumbAsset.path] : undefined, clipCounts.get(r.id) ?? 0);
  });
}

export async function getProjectRow(id: string): Promise<ProjectRow> {
  const { data, error } = await createClient().from("projects").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createProject(input: {
  name: string;
  kind: ProjectKind;
  aspect: AspectRatio;
  sourceAssetId?: string | null;
  thumbnailAssetId?: string | null;
  link?: LinkInfo | null;
  status?: ProjectRow["status"];
}): Promise<ProjectRow> {
  const { data, error } = await createClient()
    .from("projects")
    .insert({
      name: input.name,
      kind: input.kind,
      aspect: input.aspect,
      source_asset_id: input.sourceAssetId ?? null,
      thumbnail_asset_id: input.thumbnailAssetId ?? null,
      link: (input.link ?? null) as Json,
      status: input.status ?? "draft",
    })
    .select()
    .single();
  if (error) throw error;
  invalidateData();
  return data;
}

export async function updateProject(id: string, patch: Partial<Omit<ProjectRow, "id" | "owner_id" | "created_at">>) {
  const { error } = await createClient().from("projects").update(patch).eq("id", id);
  if (error) throw error;
  invalidateData();
}

export const renameProject = (id: string, name: string) => updateProject(id, { name });

export async function duplicateProject(id: string): Promise<ProjectRow> {
  const src = await getProjectRow(id);
  const { data, error } = await createClient()
    .from("projects")
    .insert({
      name: `${src.name} (copy)`.slice(0, 200),
      kind: src.kind,
      aspect: src.aspect,
      source_asset_id: src.source_asset_id,
      link: src.link,
      timeline: src.timeline,
      captions: src.captions,
      caption_style: src.caption_style,
      settings: src.settings,
    })
    .select()
    .single();
  if (error) throw error;
  invalidateData();
  return data;
}

/**
 * Deletes a project and everything generated for it (clips, renders, thumbnails, captions under
 * {uid}/projects/{id}/), then its source upload if no other project or clip still uses it.
 */
export async function deleteProject(id: string): Promise<void> {
  const supabase = createClient();
  const owner = await uid();
  const project = await getProjectRow(id);
  const prefix = projectPrefix(owner, id);

  const { data: all, error: gErr } = await supabase.from("media_assets").select("id, bucket, path").like("path", `${prefix}%`);
  if (gErr) throw gErr;
  // Keep files another project still uses as its source (e.g. an edit project opened from a clip).
  const ids = (all ?? []).map((a) => a.id);
  const { data: inUse } = ids.length
    ? await supabase.from("projects").select("source_asset_id").neq("id", id).in("source_asset_id", ids)
    : { data: [] as { source_asset_id: string | null }[] };
  const keep = new Set((inUse ?? []).map((p) => p.source_asset_id));
  const generated = (all ?? []).filter((a) => !keep.has(a.id));

  // Row first: cascades clips + jobs and releases the restrict on the source upload.
  const { error: pErr } = await supabase.from("projects").delete().eq("id", id);
  if (pErr) throw pErr;

  for (const bucket of BUCKETS) {
    const paths = (generated ?? []).filter((a) => a.bucket === bucket).map((a) => a.path);
    if (paths.length) await supabase.storage.from(bucket).remove(paths);
  }
  if (generated?.length) await supabase.from("media_assets").delete().in("id", generated.map((a) => a.id));

  if (project.source_asset_id) await deleteUploadIfUnused(project.source_asset_id);
  invalidateData();
}

async function deleteUploadIfUnused(assetId: string) {
  const supabase = createClient();
  const [{ count: p }, { count: c }] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("source_asset_id", assetId),
    supabase.from("clips").select("id", { count: "exact", head: true }).eq("source_asset_id", assetId),
  ]);
  if ((p ?? 0) > 0 || (c ?? 0) > 0) return;
  const { data: asset } = await supabase.from("media_assets").select("*").eq("id", assetId).maybeSingle();
  if (!asset) return;
  await supabase.storage.from(asset.bucket).remove([asset.path]);
  const owner = asset.owner_id;
  await supabase.storage.from("thumbnails").remove([`${owner}/uploads/${asset.id}.jpg`]);
  await supabase.from("media_assets").delete().in("path", [`${owner}/uploads/${asset.id}.jpg`]);
  await supabase.from("media_assets").delete().eq("id", assetId);
}
