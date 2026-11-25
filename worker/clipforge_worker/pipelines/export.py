"""render_export job: renders the editor timeline (main video + music tracks) to one file.

Timeline format (projects.timeline, written by the editor — see lib/data/timeline.ts):
  { version: 1, aspect, tracks: [{id, kind, muted, hidden}],
    clips: [{id, trackId, start, duration, sourceIn, mediaId, props: {volume, speed, brightness, contrast, saturation, ...}}],
    media: [{id, assetId?, kind, name, duration}] }
Only media with an assetId (stored in Supabase) can be rendered.
"""

from __future__ import annotations

from pathlib import Path

from ..loop import JobContext
from ..media import ffmpeg
from ..media.ffmpeg import OUTPUT_SIZE
from ..storage import render_path
from .common import Deps

FPS_DEFAULT = 30


def _atempo(speed: float) -> str:
    """atempo accepts 0.5–2.0 per stage; chain stages for other speeds."""
    stages, s = [], max(0.25, min(4.0, speed))
    while s > 2.0:
        stages.append("atempo=2.0")
        s /= 2.0
    while s < 0.5:
        stages.append("atempo=0.5")
        s /= 0.5
    stages.append(f"atempo={s:.4f}")
    return ",".join(stages)


def segment_args(src: Path, dst: Path, source_in: float, duration: float, props: dict, aspect: str, size: tuple[int, int], fps: int, src_w: int, src_h: int, has_audio: bool) -> list[str]:
    """One normalised segment: trimmed, speed-adjusted, colour-adjusted, cropped to the canvas, with audio."""
    speed = float(props.get("speed", 1) or 1)
    src_len = duration * speed
    w, h = size
    eq = f"eq=brightness={float(props.get('brightness', 0)) / 100:.3f}:contrast={1 + float(props.get('contrast', 0)) / 100:.3f}:saturation={1 + float(props.get('saturation', 0)) / 100:.3f}"
    vf = f"{ffmpeg.crop_filter(aspect, src_w, src_h)},setsar=1,{eq},setpts=PTS/{speed:.4f},fps={fps}"
    vol = max(0.0, float(props.get("volume", 100)) / 100)
    args = [ffmpeg.ffmpeg_bin(), "-y", "-ss", f"{source_in:.3f}", "-t", f"{src_len:.3f}", "-i", str(src)]
    if not has_audio:
        args += ["-f", "lavfi", "-t", f"{duration:.3f}", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"]
    af = f"{_atempo(speed)},volume={vol:.3f},aresample=48000" if has_audio else "anull"
    args += ["-vf", vf, "-af", af, "-map", "0:v:0", "-map", "0:a:0" if has_audio else "1:a:0", "-t", f"{duration:.3f}",
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-s", f"{w}x{h}",
             "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-ar", "48000", str(dst)]
    return args


def gap_args(dst: Path, duration: float, size: tuple[int, int], fps: int) -> list[str]:
    w, h = size
    return [ffmpeg.ffmpeg_bin(), "-y", "-f", "lavfi", "-i", f"color=c=black:s={w}x{h}:r={fps}:d={duration:.3f}",
            "-f", "lavfi", "-t", f"{duration:.3f}", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", str(dst)]


def run(job: dict, ctx: JobContext, deps: Deps) -> dict:
    inp = job["input"]
    owner, project_id = job["owner_id"], inp["project_id"]
    project = deps.db.one("projects", project_id)
    tl = project.get("timeline") or {}
    aspect = tl.get("aspect") or project.get("aspect") or "9:16"
    base_w, base_h = OUTPUT_SIZE[aspect]
    scale = 720 / min(base_w, base_h) if inp.get("resolution") == "720p" else 1.0
    size = (int(base_w * scale) // 2 * 2, int(base_h * scale) // 2 * 2)
    fps = int(inp.get("fps") or FPS_DEFAULT)
    fmt = inp.get("format", "mp4")

    tracks = {t["id"]: t for t in tl.get("tracks", [])}
    media = {m["id"]: m for m in tl.get("media", [])}
    unsupported: set[str] = set()
    video_clips, music_clips = [], []
    for c in tl.get("clips", []):
        track = tracks.get(c["trackId"], {})
        if track.get("hidden") and track.get("kind") != "audio":
            continue
        if track.get("kind") == "overlay":
            unsupported.add("Text overlays")
            continue
        props = c.get("props") or {}
        if props.get("rotation") or props.get("positionX") or props.get("positionY") or props.get("scale", 100) != 100:
            unsupported.add("Scale, position and rotation")
        if props.get("effect", "none") != "none":
            unsupported.add("Looks (effect presets)")
        m = media.get(c.get("mediaId"))
        if not m or not m.get("assetId"):
            unsupported.add("Sample or local-only media (not in your storage)")
            continue
        (music_clips if track.get("kind") == "audio" else video_clips).append((c, m, track))
    if tl.get("captions_visible"):
        unsupported.add("Caption track (burn captions from the AI Clipper instead)")
    if not video_clips:
        raise RuntimeError("Add a video from your storage to the main track before exporting.")

    ctx.report(5, "Downloading media")
    sources: dict[str, tuple[Path, ffmpeg.MediaInfo]] = {}
    for c, m, _ in video_clips + music_clips:
        if m["assetId"] not in sources:
            asset = deps.db.one("media_assets", m["assetId"])
            path = deps.storage.download(asset["bucket"], asset["path"], ctx.workdir / f"src-{m['assetId']}{Path(asset['path']).suffix or '.mp4'}")
            sources[m["assetId"]] = (path, ffmpeg.probe(path))

    pieces: list[Path] = []
    cursor = 0.0
    video_clips.sort(key=lambda x: x[0]["start"])
    for i, (c, m, track) in enumerate(video_clips):
        ctx.report(10 + int(60 * i / len(video_clips)), f"Rendering segment {i + 1} of {len(video_clips)}")
        if c["start"] > cursor + 0.04:
            gap = ctx.workdir / f"gap{i:03d}.mp4"
            ffmpeg.run(gap_args(gap, c["start"] - cursor, size, fps))
            pieces.append(gap)
        src, info = sources[m["assetId"]]
        seg = ctx.workdir / f"seg{i:03d}.mp4"
        props = dict(c.get("props") or {})
        if track.get("muted"):
            props["volume"] = 0
        ffmpeg.run(segment_args(src, seg, float(c["sourceIn"]), float(c["duration"]), props, aspect, size, fps, info.width, info.height, info.has_audio))
        pieces.append(seg)
        cursor = max(cursor, c["start"] + c["duration"])

    listing = ctx.workdir / "concat.txt"
    listing.write_text("".join(f"file '{p.name}'\n" for p in pieces), encoding="utf-8")
    joined = ctx.workdir / "joined.mp4"
    ffmpeg.run([ffmpeg.ffmpeg_bin(), "-y", "-f", "concat", "-safe", "0", "-i", listing.name, "-c", "copy", joined.name], cwd=ctx.workdir)

    ctx.report(75, "Mixing music")
    final_mp4 = joined
    music = [(c, m, t) for c, m, t in music_clips if not t.get("muted") and sources[m["assetId"]][1].has_audio]
    if music:
        args = [ffmpeg.ffmpeg_bin(), "-y", "-i", str(joined)]
        chains, labels = [], []
        for j, (c, m, _) in enumerate(music, start=1):
            args += ["-i", str(sources[m["assetId"]][0])]
            delay = int(float(c["start"]) * 1000)
            vol = max(0.0, float((c.get("props") or {}).get("volume", 100)) / 100)
            chains.append(f"[{j}:a]atrim=start={float(c['sourceIn']):.3f}:duration={float(c['duration']):.3f},asetpts=PTS-STARTPTS,volume={vol:.3f},adelay={delay}|{delay}[m{j}]")
            labels.append(f"[m{j}]")
        graph = ";".join(chains) + f";[0:a]{''.join(labels)}amix=inputs={len(labels) + 1}:duration=first:normalize=0[aout]"
        final_mp4 = ctx.workdir / "mixed.mp4"
        ffmpeg.run(args + ["-filter_complex", graph, "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", str(final_mp4)])

    out = final_mp4
    if fmt == "webm":
        ctx.report(85, "Encoding WebM")
        out = ctx.workdir / "export.webm"
        ffmpeg.run([ffmpeg.ffmpeg_bin(), "-y", "-i", str(final_mp4), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "33", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", str(out)])

    ctx.report(92, "Uploading")
    info = ffmpeg.probe(out)
    path = render_path(owner, project_id, job["id"], fmt)
    mime = "video/webm" if fmt == "webm" else "video/mp4"
    size_bytes = deps.storage.upload("media", path, out, mime)
    asset = deps.db.upsert_asset({"owner_id": owner, "kind": "render", "bucket": "media", "path": path, "file_name": f"{project['name']}.{fmt}", "mime": mime, "size_bytes": size_bytes, "duration_s": info.duration, "width": info.width, "height": info.height, "status": "ready"})
    return {"asset_id": asset["id"], "unsupported": sorted(unsupported), "duration": info.duration}
