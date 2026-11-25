"""Gemini highlight detection + titles, descriptions and hashtags, using structured JSON output."""

from __future__ import annotations

import json
import time

import httpx

from ..config import require
from .base import RawMoment, Transcript

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
MAX_TRANSCRIPT_CHARS = 180_000
BACKOFF = (2, 4, 8)

SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "moments": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "start": {"type": "NUMBER"},
                    "end": {"type": "NUMBER"},
                    "title": {"type": "STRING"},
                    "description": {"type": "STRING"},
                    "hashtags": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "score": {"type": "INTEGER"},
                    "reason": {"type": "STRING"},
                },
                "required": ["start", "end", "title", "description", "hashtags", "score", "reason"],
            },
        }
    },
    "required": ["moments"],
}


def build_prompt(transcript: Transcript, scenes: list[float], duration: float, count: int, min_len: float, max_len: float) -> str:
    lines = [f"[{s.start:.1f}-{s.end:.1f}] {s.text}" for s in transcript.segments if s.text]
    body = "\n".join(lines)[:MAX_TRANSCRIPT_CHARS]
    cuts = ", ".join(f"{t:.1f}" for t in scenes[:400]) or "none detected"
    return f"""You are an expert short-form video editor. Pick the {count} best moments from this video to publish as
standalone vertical clips (TikTok, Reels, Shorts).

Video length: {duration:.1f} seconds.
Each clip must be between {min_len:.0f} and {max_len:.0f} seconds long, must not overlap another clip, and must
lie within 0 and {duration:.1f}. Start on the first word of a sentence and end after a complete thought.
Prefer moments with a strong hook in the first 3 seconds, a clear payoff, emotion, humour, a surprising fact or a
quotable line. Avoid intros, sponsor reads and filler.

Scene cuts (seconds): {cuts}

Transcript with timestamps in seconds:
{body}

For each moment return: start and end in seconds, a punchy title under 60 characters, a one-sentence description,
3-5 relevant hashtags without the # sign, a virality score 0-100, and a short reason. Use only what the transcript
supports — do not invent facts."""


class GeminiHighlights:
    provider = "gemini"

    def __init__(self, model: str, api_key: str | None = None, client: httpx.Client | None = None):
        self.model = model
        self._key = api_key
        self._client = client or httpx.Client(timeout=180)

    def find_moments(self, transcript: Transcript, scenes: list[float], duration: float, count: int, min_len: float, max_len: float) -> list[RawMoment]:
        key = self._key or require("GEMINI_API_KEY")
        payload = {
            "contents": [{"role": "user", "parts": [{"text": build_prompt(transcript, scenes, duration, count, min_len, max_len)}]}],
            "generationConfig": {"responseMimeType": "application/json", "responseSchema": SCHEMA, "temperature": 0.4},
        }
        url = ENDPOINT.format(model=self.model)
        for attempt in range(len(BACKOFF) + 1):
            res = self._client.post(url, headers={"x-goog-api-key": key, "Content-Type": "application/json"}, json=payload)
            if res.status_code in (429, 500, 503) and attempt < len(BACKOFF):
                time.sleep(BACKOFF[attempt])
                continue
            if res.status_code in (400, 403) and "API key" in res.text:
                raise RuntimeError("Gemini rejected the API key. Check GEMINI_API_KEY on the worker.")
            if res.status_code == 404:
                raise RuntimeError(f"Gemini model '{self.model}' wasn't found. Set GEMINI_MODEL to a current model name.")
            if res.status_code >= 400:
                raise RuntimeError(f"Gemini request failed ({res.status_code}): {res.text[:300]}")
            return parse_moments(res.json())
        raise RuntimeError("Gemini is rate-limiting requests. Try again in a few minutes.")


def parse_moments(body: dict) -> list[RawMoment]:
    """Extracts moments from a generateContent response; malformed output yields an empty list."""
    try:
        text = body["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(text)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
        return []
    out: list[RawMoment] = []
    for m in data.get("moments") or []:
        try:
            out.append(
                RawMoment(
                    start=float(m["start"]),
                    end=float(m["end"]),
                    title=str(m.get("title", ""))[:120],
                    description=str(m.get("description", ""))[:500],
                    hashtags=[str(h).lstrip("#").strip() for h in (m.get("hashtags") or []) if str(h).strip()][:8],
                    score=int(m.get("score", 50)),
                    reason=str(m.get("reason", ""))[:300],
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    return out
