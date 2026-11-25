"""Groq Whisper speech-to-text with word timestamps. Long audio is split into overlapping chunks."""

from __future__ import annotations

import time
from pathlib import Path

import httpx

from ..config import require
from .base import Segment, Transcript, Word

ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions"
MAX_REQUEST_BYTES = 24 * 1024 * 1024
NO_SPEECH_PROB = 0.6  # segments Whisper itself flags as probably not speech are dropped  # free tier allows 25 MB; keep headroom
CHUNK_SECONDS = 1800.0  # 30 min of 24 kbps opus ≈ 5.4 MB
OVERLAP_SECONDS = 2.0


def merge_chunks(chunks: list[tuple[float, list[Word]]], overlap: float = OVERLAP_SECONDS) -> list[Word]:
    """Shifts each chunk's words by its offset and drops duplicates in the overlap.

    The boundary between chunk k-1 and chunk k sits in the middle of their overlap: chunk k-1 keeps
    words starting before it, chunk k keeps words starting at or after it.
    """
    out: list[Word] = []
    offsets = [off for off, _ in chunks]
    for k, (offset, words) in enumerate(chunks):
        lo = offsets[k] + overlap / 2 if k > 0 else float("-inf")
        hi = offsets[k + 1] + overlap / 2 if k + 1 < len(chunks) else float("inf")
        for w in words:
            start = w.start + offset
            if lo <= start < hi:
                out.append(Word(w.text, start, w.end + offset))
    return out


def _segments_merge(chunks: list[tuple[float, list[Segment]]], overlap: float = OVERLAP_SECONDS) -> list[Segment]:
    words = merge_chunks([(o, [Word(s.text, s.start, s.end) for s in segs]) for o, segs in chunks], overlap)
    return [Segment(w.text, w.start, w.end) for w in words]


class GroqWhisper:
    provider = "groq"

    def __init__(self, model: str, api_key: str | None = None, client: httpx.Client | None = None):
        self.model = model
        self._key = api_key
        self._client = client or httpx.Client(timeout=300)

    def _request(self, audio: Path, language: str | None) -> dict:
        key = self._key or require("GROQ_API_KEY")
        if audio.stat().st_size > MAX_REQUEST_BYTES:
            raise RuntimeError("Audio chunk is larger than Groq's 25 MB limit")
        data: list[tuple[str, str]] = [
            ("model", self.model),
            ("response_format", "verbose_json"),
            ("timestamp_granularities[]", "word"),
            ("timestamp_granularities[]", "segment"),
            ("temperature", "0"),
        ]
        if language:
            data.append(("language", language))
        for attempt in range(4):
            with audio.open("rb") as f:
                res = self._client.post(
                    ENDPOINT,
                    headers={"Authorization": f"Bearer {key}"},
                    data=data,
                    files={"file": (audio.name, f, "audio/ogg")},
                )
            if res.status_code == 429 and attempt < 3:
                time.sleep(float(res.headers.get("retry-after", 2 ** (attempt + 1))))
                continue
            if res.status_code == 401:
                raise RuntimeError("Groq rejected the API key (401). Check GROQ_API_KEY on the worker.")
            if res.status_code >= 400:
                raise RuntimeError(f"Groq transcription failed ({res.status_code}): {res.text[:300]}")
            return res.json()
        raise RuntimeError("Groq is rate-limiting transcription. Try again in a few minutes.")

    def transcribe_chunks(self, chunks: list[tuple[float, Path]], language: str | None) -> Transcript:
        word_chunks: list[tuple[float, list[Word]]] = []
        seg_chunks: list[tuple[float, list[Segment]]] = []
        detected = None
        for offset, path in chunks:
            body = self._request(path, language)
            detected = detected or body.get("language")
            segs = body.get("segments") or []
            silent = [(float(s["start"]), float(s["end"])) for s in segs if float(s.get("no_speech_prob", 0) or 0) > NO_SPEECH_PROB]

            def in_silent(t: float, silent=silent) -> bool:
                return any(a <= t < b for a, b in silent)

            word_chunks.append((offset, [Word(w.get("word", "").strip(), float(w["start"]), float(w["end"])) for w in body.get("words") or [] if not in_silent(float(w["start"]))]))
            seg_chunks.append((offset, [Segment(s.get("text", "").strip(), float(s["start"]), float(s["end"])) for s in segs if float(s.get("no_speech_prob", 0) or 0) <= NO_SPEECH_PROB]))
        words = [w for w in merge_chunks(word_chunks) if w.text]
        return Transcript(words=words, segments=_segments_merge(seg_chunks), language=detected, provider=self.provider, model=self.model)

    def transcribe(self, audio: Path, language: str | None) -> Transcript:
        return self.transcribe_chunks([(0.0, audio)], language)
