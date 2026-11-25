"""FFmpeg / ffprobe helpers. Command builders are pure functions so they can be unit-tested."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

OUTPUT_SIZE = {"9:16": (1080, 1920), "1:1": (1080, 1080), "4:5": (1080, 1350), "16:9": (1920, 1080)}
RATIO_EXPR = {"9:16": ("9", "16"), "1:1": ("1", "1"), "4:5": ("4", "5"), "16:9": ("16", "9")}


def _find(name: str) -> str:
    found = shutil.which(name)
    if found:
        return found
    winget = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Links" / f"{name}.exe"
    if winget.exists():
        return str(winget)
    raise RuntimeError(f"{name} isn't installed on the worker (winget install Gyan.FFmpeg)")


def ffmpeg_bin() -> str:
    return _find("ffmpeg")


def ffprobe_bin() -> str:
    return _find("ffprobe")


def run(args: list[str], cwd: Path | None = None) -> None:
    proc = subprocess.run(args, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        tail = "\n".join(proc.stderr.strip().splitlines()[-6:])
        raise RuntimeError(f"FFmpeg failed: {tail}")


@dataclass
class MediaInfo:
    duration: float
    width: int
    height: int
    has_audio: bool


def probe(path: Path) -> MediaInfo:
    proc = subprocess.run(
        [ffprobe_bin(), "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError("This file couldn't be read as a video.")
    data = json.loads(proc.stdout or "{}")
    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    if not video:
        raise RuntimeError("This file has no video stream.")
    duration = float(data.get("format", {}).get("duration") or video.get("duration") or 0)
    return MediaInfo(duration, int(video.get("width", 0)), int(video.get("height", 0)), any(s.get("codec_type") == "audio" for s in streams))


def crop_filter(aspect: str, src_w: int, src_h: int) -> str:
    """Centre-crop to the target aspect, then scale to the output size."""
    num, den = RATIO_EXPR[aspect]
    out_w, out_h = OUTPUT_SIZE[aspect]
    target = int(num) / int(den)
    source = src_w / src_h if src_h else target
    if source > target:  # too wide: keep full height
        crop = f"crop=ih*{num}/{den}:ih" if (num, den) != ("1", "1") else "crop=ih:ih"
    elif source < target:  # too tall: keep full width
        crop = f"crop=iw:iw*{den}/{num}" if (num, den) != ("1", "1") else "crop=iw:iw"
    else:
        crop = ""
    scale = f"scale={out_w}:{out_h}"
    return f"{crop},{scale}" if crop else scale


AUDIO_KBPS = 128


def video_kbps_cap(duration: float, max_mb: float | None, audio_kbps: int = AUDIO_KBPS) -> int | None:
    """Video bitrate (kbps) that keeps a file of this length under ~90% of max_mb, or None if no cap is needed."""
    if not max_mb or duration <= 0:
        return None
    total_kbps = max_mb * 0.9 * 8 * 1024 / duration
    video = int(total_kbps - audio_kbps)
    if video >= 8000:
        return None
    return max(300, video)


def cut_clip_args(src: Path, dst: Path, start: float, end: float, aspect: str, src_w: int, src_h: int, subtitles: Path | None = None, max_mb: float | None = None) -> list[str]:
    vf = crop_filter(aspect, src_w, src_h) + ",setsar=1"
    if subtitles is not None:
        # referenced by bare file name; run() is called with cwd=subtitles.parent (avoids Windows path escaping)
        vf += f",subtitles={subtitles.name}"
    cap = video_kbps_cap(end - start, max_mb)
    rate = ["-maxrate", f"{cap}k", "-bufsize", f"{cap * 2}k"] if cap else []
    return [
        ffmpeg_bin() if shutil.which("ffmpeg") else "ffmpeg",
        "-y", "-ss", f"{start:.3f}", "-i", str(src), "-t", f"{max(0.1, end - start):.3f}",
        "-vf", vf,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", *rate, "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", f"{AUDIO_KBPS}k", "-movflags", "+faststart",
        str(dst),
    ]


def cut_clip(src: Path, dst: Path, start: float, end: float, aspect: str, info: MediaInfo, subtitles: Path | None = None, max_mb: float | None = None) -> Path:
    args = cut_clip_args(src.resolve(), dst.resolve(), start, end, aspect, info.width, info.height, subtitles, max_mb)
    args[0] = ffmpeg_bin()
    run(args, cwd=subtitles.parent if subtitles else None)
    return dst


def extract_audio(src: Path, dst_ogg: Path, dst_wav: Path | None = None) -> Path:
    """16 kHz mono Opus for Whisper (small upload) and optionally 16 kHz mono WAV for VAD."""
    run([ffmpeg_bin(), "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libopus", "-b:a", "24k", str(dst_ogg)])
    if dst_wav is not None:
        run([ffmpeg_bin(), "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", str(dst_wav)])
    return dst_ogg


def split_audio(src: Path, duration: float, chunk: float, overlap: float, outdir: Path) -> list[tuple[float, Path]]:
    """Cuts audio into overlapping pieces; returns (offset, path) pairs."""
    if duration <= chunk:
        return [(0.0, src)]
    out: list[tuple[float, Path]] = []
    offset, i = 0.0, 0
    while offset < duration:
        piece = outdir / f"chunk{i:03d}.ogg"
        run([ffmpeg_bin(), "-y", "-ss", f"{offset:.3f}", "-i", str(src), "-t", f"{chunk:.3f}", "-c", "copy", str(piece)])
        out.append((offset, piece))
        offset += chunk - overlap
        i += 1
    return out


def thumbnail(src: Path, dst: Path, at: float, width: int = 480) -> Path:
    run([ffmpeg_bin(), "-y", "-ss", f"{max(0.0, at):.3f}", "-i", str(src), "-frames:v", "1", "-vf", f"scale={width}:-2", "-q:v", "3", str(dst)])
    return dst
