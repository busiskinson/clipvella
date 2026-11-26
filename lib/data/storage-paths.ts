/**
 * Storage path conventions (shared with the worker — keep in sync with worker/clipvella_worker/storage.py).
 * Every object path starts with the owner's user id so storage RLS can scope access.
 *
 *   uploads/{uid}/uploads/{assetId}/{fileName}           original videos
 *   media/{uid}/projects/{projectId}/clips/{clipId}.mp4   rendered clips
 *   media/{uid}/projects/{projectId}/renders/{jobId}.mp4  editor exports
 *   thumbnails/{uid}/projects/{projectId}/...             clip / project thumbnails
 *   thumbnails/{uid}/uploads/{assetId}.jpg                upload poster frames
 *   captions/{uid}/projects/{projectId}/...               SRT / VTT files
 */
export const safeFileName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(-120) || "video";

export const uploadPath = (uid: string, assetId: string, fileName: string) => `${uid}/uploads/${assetId}/${safeFileName(fileName)}`;
export const uploadThumbPath = (uid: string, assetId: string) => `${uid}/uploads/${assetId}.jpg`;
export const projectPrefix = (uid: string, projectId: string) => `${uid}/projects/${projectId}/`;
