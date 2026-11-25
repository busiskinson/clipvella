"""Shared pipeline steps: fetch source media, transcribe, persist transcripts."""

from __future__ import annotations

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


def fetch_source(deps: Deps, asset_id: str, workdir: Path) -> tuple[dict, Path, MediaInfo]:
    asset = deps.db.one("media_assets", asset_id)
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
