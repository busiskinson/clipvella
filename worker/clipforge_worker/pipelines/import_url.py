"""import_url job: fetch a public TikTok / YouTube / Facebook video the user owns or may use, save it as the project's source.

Guardrails (also enforced by the create-job Edge Function): supported platforms only, the user must confirm they own
the video or have permission, and private, login-only, paid, live, DRM-protected or over-long videos are refused.
"""

from __future__ import annotations

import os
import re
import unicodedata
import uuid
from urllib.parse import urlparse

from ..loop import JobContext
from ..media import ffmpeg
from ..media.fetch import FetchError
from .common import Deps, max_upload_mb

ALLOWED_HOSTS = ("youtube.com", "youtu.be", "tiktok.com", "facebook.com", "fb.watch")


def max_import_seconds() -> float:
    try:
        return float(os.environ.get("WORKER_MAX_IMPORT_MINUTES", "10")) * 60
    except ValueError:
        return 600.0


def safe_file_name(name: str) -> str:
    """Mirror of safeFileName in lib/data/storage-paths.ts."""
    s = unicodedata.normalize("NFKD", name)
    s = re.sub(r"[^\w.\- ]+", "", s, flags=re.ASCII).strip()
    return re.sub(r"\s+", "-", s)[-120:] or "video"


def check_link(url: str) -> None:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    ok = parsed.scheme in ("http", "https") and any(host == h or host.endswith("." + h) for h in ALLOWED_HOSTS)
    if not ok:
        raise RuntimeError("Only TikTok, YouTube and Facebook video links can be imported.")


def check_info(info: dict) -> None:
    """Refuses videos the guardrails exclude, before anything is downloaded."""
    if info.get("_type") in ("playlist", "multi_video"):
        raise RuntimeError("That link is a playlist or channel. Paste a link to a single video.")
    if info.get("live_status") in ("is_live", "is_upcoming", "post_live") or info.get("is_live"):
        raise RuntimeError("Live streams can't be imported. Try again once the recording is published.")
    availability = info.get("availability")
    if availability in ("private", "needs_auth"):
        raise RuntimeError("This video is private or needs a login, so it can't be imported. Upload your own copy instead.")
    if availability in ("premium_only", "subscriber_only"):
        raise RuntimeError("This is a paid or members-only video, so it can't be imported.")
    duration = info.get("duration")
    limit = max_import_seconds()
    if duration and float(duration) > limit:
        raise RuntimeError(f"This video is longer than {limit / 60:g} minutes, the import limit. Upload a shorter version instead.")


def plain_error(message: str) -> str:
    m = message.lower()
    if "drm" in m:
        return "This video is DRM-protected, so it can't be imported."
    if "private" in m or "sign in" in m or "login" in m or "log in" in m or "cookies" in m:
        return "This video is private or needs a login, so it can't be imported. Upload your own copy instead."
    if "members" in m or "premium" in m or "paid" in m:
        return "This is a paid or members-only video, so it can't be imported."
    if "geo" in m or "not available in your country" in m:
        return "This video isn't available in your region."
    if "unavailable" in m or "removed" in m or "not found" in m or "404" in m:
        return "This video is unavailable. It may have been removed or made private."
    if "unsupported url" in m:
        return "That link isn't a video this importer can read. Paste a link to a single video."
    return f"The platform refused the download: {message.removeprefix('ERROR: ')[:200]}"


def run(job: dict, ctx: JobContext, deps: Deps) -> dict:
    inp = job["input"]
    owner, project_id, url = job["owner_id"], inp["project_id"], str(inp.get("url", "")).strip()

    if inp.get("rights_confirmed") is not True:
        raise RuntimeError("Confirm that you own this video or have permission to use it before importing.")
    check_link(url)
    project = deps.db.one("projects", project_id)
    if not project or project.get("owner_id") != owner:
        raise RuntimeError("That project doesn't belong to this job's owner.")
    if deps.fetcher is None:
        raise RuntimeError("Link import isn't available on this worker (yt-dlp isn't installed).")

    ctx.report(5, "Checking link")
    try:
        info = deps.fetcher.probe(url)
    except FetchError as e:
        raise RuntimeError(plain_error(str(e))) from e
    check_info(info)

    ctx.report(10, "Downloading video")
    last = [10]

    def progress(frac: float) -> None:
        pct = 10 + int(frac * 50)
        if pct >= last[0] + 5:
            last[0] = pct
            ctx.report(pct, "Downloading video")

    try:
        path = deps.fetcher.download(url, ctx.workdir, progress)
    except FetchError as e:
        raise RuntimeError(plain_error(str(e))) from e

    media = ffmpeg.probe(path)
    if media.width <= 0 or media.height <= 0:
        raise RuntimeError("The downloaded file has no video track.")
    if media.duration > max_import_seconds() + 1:
        raise RuntimeError(f"This video is longer than {max_import_seconds() / 60:g} minutes, the import limit.")

    limit = max_upload_mb()
    size_mb = path.stat().st_size / 1024 / 1024
    if size_mb > limit * 0.95 or path.suffix.lower() != ".mp4" or media.height > 720:
        ctx.report(65, "Optimizing video")
        path = ffmpeg.fit_video(path, ctx.workdir / "imported.mp4", media.duration, limit)
        media = ffmpeg.probe(path)

    title = str(info.get("title") or "").strip()[:200] or "Imported video"
    asset_id = str(uuid.uuid4())
    vpath = f"{owner}/uploads/{asset_id}/{safe_file_name(title)[:110]}.mp4"
    tpath = f"{owner}/uploads/{asset_id}.jpg"

    ctx.report(85, "Saving to your storage")
    thumb = ffmpeg.thumbnail(path, ctx.workdir / "poster.jpg", min(1.0, media.duration / 2))
    vsize = deps.storage.upload("uploads", vpath, path, "video/mp4")
    tsize = deps.storage.upload("thumbnails", tpath, thumb, "image/jpeg")
    common = {"owner_id": owner, "status": "ready"}
    asset = deps.db.insert(
        "media_assets",
        {**common, "id": asset_id, "kind": "upload", "bucket": "uploads", "path": vpath, "file_name": f"{title}.mp4", "mime": "video/mp4",
         "size_bytes": vsize, "duration_s": media.duration, "width": media.width, "height": media.height},
    )
    poster = deps.db.upsert_asset({**common, "kind": "thumbnail", "bucket": "thumbnails", "path": tpath, "mime": "image/jpeg", "size_bytes": tsize})
    deps.db.update("projects", project_id, {"source_asset_id": asset["id"], "thumbnail_asset_id": poster["id"], "status": "ready", "name": title})
    return {"asset_id": asset["id"], "title": title, "duration": media.duration, "platform": info.get("extractor_key")}
