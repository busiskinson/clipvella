"""Shared pipeline steps: fetch source media, transcribe, persist transcripts."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from ..ai.base import HighlightModel, Segment, Transcriber, Transcript, Word
from ..ai.groq_whisper import CHUNK_SECONDS, OVERLAP_SECONDS
from ..media import ffmpeg
from ..media.ffmpeg import MediaInfo


@dataclass
class Deps:
    """Everything a pipeline touches, so tests can pass fakes."""

    db: Any
    storage: Any
    transcriber: Transcriber | None = None
    highlights: HighlightModel | None = None
    speech: Callable[[Path], list[tuple[float, float]]] | None = None
    scenes: Callable[[Path], list[float]] | None = None
    fetcher: Any = None  # downloads a platform link (yt-dlp); None when unavailable


def max_upload_mb() -> float:
    """Must match the storage bucket file_size_limit (50 MB on the Supabase free plan)."""
    try:
        return float(os.environ.get("WORKER_MAX_UPLOAD_MB", "50"))
    except ValueError:
        return 50.0


def ensure_fits(path: Path) -> None:
    """Fails with a plain message before uploading something the bucket would reject."""
    limit = max_upload_mb()
    size_mb = path.stat().st_size / 1024 / 1024
    if size_mb > limit:
        raise RuntimeError(f"The rendered file is {size_mb:.1f} MB, larger than the {limit:g} MB storage limit. Try 720p or a shorter clip.")


SPEECH_MARGIN = 0.3


def gate_speech(transcript: Transcript, speech: list[tuple[float, float]] | None) -> Transcript:
    """Drops words Whisper produced outside detected speech (it can hallucinate on silence or noise).

    `speech is None` means no VAD is available, so the transcript is kept as is.
    """
    if speech is None:
        return transcript
    if not speech:
        raise RuntimeError("No speech found in this video")

    def inside(start: float, end: float) -> bool:
        return any(start < e + SPEECH_MARGIN and end > s - SPEECH_MARGIN for s, e in speech)

    transcript.words = [w for w in transcript.words if inside(w.start, w.end)]
    transcript.segments = [s for s in transcript.segments if inside(s.start, s.end)]
    if not transcript.words:
        raise RuntimeError("No speech found in this video")
    return transcript


def owned_asset(deps: Deps, asset_id: str, owner_id: str) -> dict:
    """Loads a media row and refuses it unless it belongs to the job's owner (the worker runs as service role)."""
    asset = deps.db.one("media_assets", asset_id)
    if asset.get("owner_id") != owner_id or not str(asset.get("path", "")).startswith(f"{owner_id}/"):
        raise RuntimeError("That media file doesn't belong to this job's owner.")
    return asset


def fetch_source(deps: Deps, asset_id: str, workdir: Path, owner_id: str) -> tuple[dict, Path, MediaInfo]:
    asset = owned_asset(deps, asset_id, owner_id)
    suffix = Path(asset.get("file_name") or asset["path"]).suffix or ".mp4"
    src = deps.storage.download(asset["bucket"], asset["path"], workdir / f"source{suffix}")
    info = ffmpeg.probe(src)
    return asset, src, info


def transcribe_media(deps: Deps, src: Path, info: MediaInfo, workdir: Path, language: str | None, want_wav: bool = False) -> tuple[Transcript, Path | None]:
    """Extracts audio, transcribes (chunked when long) and returns the transcript plus the VAD wav."""
    if not info.has_audio:
        raise RuntimeError("This video has no audio track, so there's nothing to transcribe.")
    if deps.transcriber is None:
        raise RuntimeError("No transcription provider is configured on the worker")
    wav = workdir / "audio.wav" if want_wav else None
    ogg = ffmpeg.extract_audio(src, workdir / "audio.ogg", wav)
    chunks = ffmpeg.split_audio(ogg, info.duration, CHUNK_SECONDS, OVERLAP_SECONDS, workdir)
    if hasattr(deps.transcriber, "transcribe_chunks"):
        transcript = deps.transcriber.transcribe_chunks(chunks, language)  # type: ignore[attr-defined]
    else:
        transcript = deps.transcriber.transcribe(ogg, language)
    return transcript, wav


def save_transcript(deps: Deps, owner_id: str, asset_id: str, project_id: str | None, t: Transcript) -> dict:
    return deps.db.insert(
        "transcripts",
        {
            "owner_id": owner_id,
            "asset_id": asset_id,
            "project_id": project_id,
            "provider": t.provider or "unknown",
            "model": t.model or "unknown",
            "language": t.language,
            "text": t.text,
            "segments": [{"text": s.text, "start": s.start, "end": s.end} for s in t.segments],
            "words": [{"text": w.text, "start": w.start, "end": w.end} for w in t.words],
        },
    )


def load_transcript(row: dict) -> Transcript:
    return Transcript(
        words=[Word(w["text"], float(w["start"]), float(w["end"])) for w in row.get("words") or []],
        segments=[Segment(s["text"], float(s["start"]), float(s["end"])) for s in row.get("segments") or []],
        language=row.get("language"),
        provider=row.get("provider", ""),
        model=row.get("model", ""),
    )
