"use client";

import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";
import { readLocalVideo, type LocalFileInfo } from "@/components/downloader/shared";
import { invalidateData } from "@/stores/data-store";
import { projectPrefix, safeFileName, uploadPath, uploadThumbPath } from "@/lib/data/storage-paths";

export type AssetRow = Tables<"media_assets">;

/** Upload limit in MB; must match the storage bucket's file_size_limit. */
export const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 50) || 50;

export function validateVideo(file: File, maxMb: number = MAX_UPLOAD_MB): { ok: true } | { ok: false; message: string } {
  if (!file.type.startsWith("video/")) return { ok: false, message: "That file isn't a video. Use MP4, MOV or WebM." };
  if (file.size <= 0) return { ok: false, message: "That file is empty." };
  if (file.size > maxMb * 1024 * 1024) {
    return { ok: false, message: `This file is ${Math.ceil(file.size / 1024 / 1024)} MB. The upload limit is ${maxMb} MB.` };
  }
  return { ok: true };
}

/** PUT to Supabase Storage with XHR so we get real upload progress. */
function putObject(bucket: string, path: string, body: Blob, contentType: string, token: string, onProgress?: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = `Upload failed (${xhr.status}).`;
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        if (/maximum allowed size|too large|payload/i.test(body.message ?? body.error ?? "")) {
          message = `This file is larger than the storage limit (${MAX_UPLOAD_MB} MB).`;
        } else if (body.message) message = `Upload failed: ${body.message}`;
      } catch {
        /* keep generic message */
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(body);
  });
}

const dataUrlToBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob();

export interface UploadedVideo {
  asset: AssetRow;
  thumbnail: AssetRow | null;
  info: LocalFileInfo;
}

/**
 * Validates, reads real metadata in the browser, uploads the file to uploads/{uid}/uploads/{assetId}/…,
 * stores a poster frame in thumbnails, and records both in media_assets.
 */
export async function uploadVideo(file: File, opts: { onProgress?: (pct: number) => void; info?: LocalFileInfo } = {}): Promise<UploadedVideo> {
  const check = validateVideo(file);
  if (!check.ok) throw new Error(check.message);

  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const userId = session.session?.user.id;
  if (!token || !userId) throw new Error("You're signed out. Log in again.");

  const info = opts.info ?? (await readLocalVideo(file));
  const assetId = crypto.randomUUID();
  const path = uploadPath(userId, assetId, file.name);

  await putObject("uploads", path, file, file.type, token, opts.onProgress);

  const { data: asset, error } = await supabase
    .from("media_assets")
    .insert({
      id: assetId,
      kind: "upload",
      bucket: "uploads",
      path,
      file_name: file.name,
      mime: file.type,
      size_bytes: file.size,
      duration_s: info.duration || null,
      width: info.width || null,
      height: info.height || null,
      status: "ready",
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from("uploads").remove([path]);
    throw error;
  }

  let thumbnail: AssetRow | null = null;
  if (info.thumbnail) {
    try {
      const blob = await dataUrlToBlob(info.thumbnail);
      const tPath = uploadThumbPath(userId, assetId);
      await putObject("thumbnails", tPath, blob, "image/jpeg", token);
      const { data } = await supabase
        .from("media_assets")
        .insert({ kind: "thumbnail", bucket: "thumbnails", path: tPath, mime: "image/jpeg", size_bytes: blob.size, status: "ready" })
        .select()
        .single();
      thumbnail = data;
    } catch {
      thumbnail = null; // a missing poster frame never blocks the upload
    }
  }
  invalidateData();
  return { asset, thumbnail, info };
}

/** Music / voice-over for the editor: stored with the project in the media bucket. */
export async function uploadAudio(file: File, projectId: string, opts: { onProgress?: (pct: number) => void } = {}): Promise<AssetRow> {
  if (!file.type.startsWith("audio/")) throw new Error("That file isn't audio. Use MP3, WAV, M4A or OGG.");
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`This file is ${Math.ceil(file.size / 1024 / 1024)} MB. The upload limit is ${MAX_UPLOAD_MB} MB.`);
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const userId = session.session?.user.id;
  if (!token || !userId) throw new Error("You're signed out. Log in again.");

  const duration = await new Promise<number>((resolve) => {
    const a = document.createElement("audio");
    const url = URL.createObjectURL(file);
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      resolve(Number.isFinite(a.duration) ? a.duration : 0);
      URL.revokeObjectURL(url);
    };
    a.onerror = () => resolve(0);
    a.src = url;
  });
  const assetId = crypto.randomUUID();
  const path = `${projectPrefix(userId, projectId)}audio/${assetId}-${safeFileName(file.name)}`;
  await putObject("media", path, file, file.type, token, opts.onProgress);
  const { data, error } = await supabase
    .from("media_assets")
    .insert({ id: assetId, kind: "audio", bucket: "media", path, file_name: file.name, mime: file.type, size_bytes: file.size, duration_s: duration || null, status: "ready" })
    .select()
    .single();
  if (error) {
    await supabase.storage.from("media").remove([path]);
    throw error;
  }
  invalidateData();
  return data;
}
