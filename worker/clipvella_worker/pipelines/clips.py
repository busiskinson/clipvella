"""analyze_and_clip and render_clip jobs: AI highlight detection and FFmpeg clip rendering."""

from __future__ import annotations

import logging
from pathlib import Path

from ..ai.base import Transcript, Word
from ..captions import to_ass
from ..highlights import validate_moments
from ..loop import JobContext
from ..media import ffmpeg
from ..media.ffmpeg import OUTPUT_SIZE, MediaInfo
from ..storage import clip_thumb_path, clip_video_path
from .common import Deps, fetch_source, gate_speech, load_transcript, max_upload_mb, save_transcript, transcribe_media

log = logging.getLogger("clipvella.clips")

LENGTH_RANGE = {"auto": (15.0, 60.0), "15-30": (15.0, 30.0), "30-60": (30.0, 60.0), "60-90": (60.0, 90.0)}


def _render_one(deps: Deps, ctx: JobContext, clip: dict, src: Path, info: MediaInfo, aspect: str, words: list[Word] | None, style: dict | None) -> None:
    owner, project_id, clip_id = clip["owner_id"], clip["project_id"], clip["id"]
    deps.db.update("clips", clip_id, {"status": "rendering", "error": None})
    out = ctx.workdir / f"{clip_id}.mp4"
    subs = None
    if words:
        w, h = OUTPUT_SIZE[aspect]
        subs_dir = ctx.workdir / f"subs-{clip_id}"
        subs_dir.mkdir(exist_ok=True)
        subs = subs_dir / "subs.ass"
        in_range = [x for x in words if clip["start_s"] <= x.start < clip["end_s"]]
        subs.write_text(to_ass(in_range, style, w, h, offset=clip["start_s"]), encoding="utf-8")
    ffmpeg.cut_clip(src, out, clip["start_s"], clip["end_s"], aspect, info, subs, max_mb=max_upload_mb())
    thumb = ffmpeg.thumbnail(out, ctx.workdir / f"{clip_id}.jpg", min(1.0, (clip["end_s"] - clip["start_s"]) / 2))
    probe = ffmpeg.probe(out)

    vpath, tpath = clip_video_path(owner, project_id, clip_id), clip_thumb_path(owner, project_id, clip_id)
    vsize = deps.storage.upload("media", vpath, out, "video/mp4")
    tsize = deps.storage.upload("thumbnails", tpath, thumb, "image/jpeg")
    common = {"owner_id": owner, "status": "ready"}
    vasset = deps.db.upsert_asset({**common, "kind": "clip", "bucket": "media", "path": vpath, "file_name": f"{clip['title'] or 'clip'}.mp4", "mime": "video/mp4", "size_bytes": vsize, "duration_s": probe.duration, "width": probe.width, "height": probe.height})
    tasset = deps.db.upsert_asset({**common, "kind": "thumbnail", "bucket": "thumbnails", "path": tpath, "mime": "image/jpeg", "size_bytes": tsize})
    deps.db.update("clips", clip_id, {"status": "ready", "output_asset_id": vasset["id"], "thumbnail_asset_id": tasset["id"], "error": None})


def _remove_previous_clips(deps: Deps, project_id: str) -> None:
    """Regenerating replaces earlier clips (and their files) so storage doesn't grow.

    Files another project still uses (e.g. an edit project opened from a clip) are kept.
    """
    for c in deps.db.select("clips", project_id=project_id):
        doomed: list[tuple[str, dict]] = []
        for bucket, col in (("media", "output_asset_id"), ("thumbnails", "thumbnail_asset_id")):
            if c.get(col) and not deps.db.asset_in_use(c[col], except_project=project_id):
                doomed.append((bucket, deps.db.one("media_assets", c[col])))
        deps.db.delete("clips", id=c["id"])
        for bucket, asset in doomed:
            deps.storage.remove(bucket, [asset["path"]])
            deps.db.delete("media_assets", id=asset["id"])


def run_analyze(job: dict, ctx: JobContext, deps: Deps) -> dict:
    inp = job["input"]
    owner, project_id, asset_id = job["owner_id"], inp["project_id"], inp["asset_id"]
    count, aspect = int(inp["count"]), inp["aspect"]
    min_len, max_len = LENGTH_RANGE[inp.get("length", "auto")]
    if deps.highlights is None:
        raise RuntimeError("No highlight model is configured on the worker")

    ctx.report(5, "Reading video")
    asset, src, info = fetch_source(deps, asset_id, ctx.workdir, owner)
    ctx.report(10, "Transcribing speech")
    transcript, wav = transcribe_media(deps, src, info, ctx.workdir, inp.get("language"), want_wav=deps.speech is not None)
    ctx.report(40, "Detecting speech")
    vad = deps.speech(wav) if deps.speech and wav else None
    transcript = gate_speech(transcript, vad)
    speech = vad or []
    if not transcript.words:
        raise RuntimeError("No speech found in this video")
    save_transcript(deps, owner, asset_id, project_id, transcript)
    ctx.report(55, "Detecting scenes")
    scenes = deps.scenes(src) if deps.scenes else []
    ctx.report(65, "Finding highlights")
    raw = deps.highlights.find_moments(transcript, scenes, info.duration, count, min_len, max_len)
    moments = validate_moments(raw, info.duration, speech, scenes, count, min_len, max_len)

    _remove_previous_clips(deps, project_id)
    clips = [
        deps.db.insert(
            "clips",
            {"owner_id": owner, "project_id": project_id, "source_asset_id": asset_id, "start_s": m.start, "end_s": m.end, "title": m.title, "description": m.description, "hashtags": m.hashtags, "score": m.score, "reason": m.reason, "status": "pending"},
        )
        for m in moments
    ]

    words = transcript.words if inp.get("subtitles") else None
    rendered = 0
    for i, clip in enumerate(clips):
        ctx.report(65 + int(30 * i / max(1, len(clips))), f"Rendering clip {i + 1} of {len(clips)}")
        try:
            _render_one(deps, ctx, clip, src, info, aspect, words, inp.get("caption_style"))
            rendered += 1
        except Exception as e:  # noqa: BLE001 — one bad clip shouldn't lose the others
            log.error("clip %s failed: %s", clip["id"], e)
            deps.db.update("clips", clip["id"], {"status": "failed", "error": str(e)[:500]})
    if rendered == 0:
        raise RuntimeError("None of the clips could be rendered. See the clip errors for details.")
    settings = {"aspect": aspect, "length": inp.get("length"), "count": count, "subtitles": bool(inp.get("subtitles"))}
    deps.db.update("projects", project_id, {"status": "ready", "settings": {"clipper": settings}})
    return {"clips": rendered, "failed": len(clips) - rendered, "duration": info.duration}


def run_render_clip(job: dict, ctx: JobContext, deps: Deps) -> dict:
    """Re-renders a clip. New times (start_s/end_s in the job input) are saved only if the render succeeds."""
    inp = job["input"]
    clip = deps.db.one("clips", inp["clip_id"])
    if clip.get("owner_id", job["owner_id"]) != job["owner_id"]:
        raise RuntimeError("That clip doesn't belong to this job's owner.")
    project = deps.db.one("projects", clip["project_id"])
    start = float(inp.get("start_s", clip["start_s"]))
    end = float(inp.get("end_s", clip["end_s"]))
    try:
        ctx.report(10, "Reading video")
        _, src, info = fetch_source(deps, clip["source_asset_id"], ctx.workdir, job["owner_id"])
        if start < 0 or end - start < 1:
            raise RuntimeError("A clip must start at 0 s or later and be at least 1 second long.")
        if end > info.duration + 0.05:
            raise RuntimeError(f"The clip ends at {end:.1f}s but the video is only {info.duration:.1f}s long.")
        words = None
        if inp.get("subtitles"):
            rows = deps.db.select("transcripts", order="created_at", asset_id=clip["source_asset_id"])
            words = load_transcript(rows[0]).words if rows else None
        aspect = (project.get("settings") or {}).get("clipper", {}).get("aspect") or project.get("aspect") or "9:16"
        ctx.report(40, "Rendering clip")
        _render_one(deps, ctx, {**clip, "start_s": start, "end_s": end}, src, info, aspect, words, inp.get("caption_style"))
    except Exception as e:
        # keep the previous version playable and say why the re-render didn't happen
        deps.db.update("clips", clip["id"], {"status": "ready" if clip.get("output_asset_id") else "failed", "error": str(e)[:500]})
        raise
    deps.db.update("clips", clip["id"], {"start_s": start, "end_s": end, "error": None})
    return {"clip_id": clip["id"], "start_s": start, "end_s": end}


__all__ = ["run_analyze", "run_render_clip", "Transcript"]
