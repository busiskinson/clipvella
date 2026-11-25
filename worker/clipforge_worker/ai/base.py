"""Provider-neutral AI interfaces so Groq / Gemini can be swapped by configuration."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol


@dataclass
class Word:
    text: str
    start: float
    end: float


@dataclass
class Segment:
    text: str
    start: float
    end: float


@dataclass
class Transcript:
    words: list[Word]
    segments: list[Segment]
    language: str | None = None
    provider: str = ""
    model: str = ""

    @property
    def text(self) -> str:
        return " ".join(s.text.strip() for s in self.segments).strip()


@dataclass
class RawMoment:
    """A highlight as proposed by the model, before validation."""

    start: float
    end: float
    title: str = ""
    description: str = ""
    hashtags: list[str] = field(default_factory=list)
    score: int = 50
    reason: str = ""


class Transcriber(Protocol):
    def transcribe(self, audio: Path, language: str | None) -> Transcript: ...


class HighlightModel(Protocol):
    def find_moments(
        self, transcript: Transcript, scenes: list[float], duration: float, count: int, min_len: float, max_len: float
    ) -> list[RawMoment]: ...
