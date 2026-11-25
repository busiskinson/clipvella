"""Turns raw model suggestions into clip times that are valid, non-overlapping and aligned to speech."""

from __future__ import annotations

from dataclasses import dataclass, field

from .ai.base import RawMoment

SNAP_WINDOW = 1.5


class NoUsableMoments(RuntimeError):
    def __init__(self) -> None:
        super().__init__("The AI didn't return any usable moments")


@dataclass
class Moment:
    start: float
    end: float
    title: str = ""
    description: str = ""
    hashtags: list[str] = field(default_factory=list)
    score: int = 50
    reason: str = ""


def _nearest(value: float, candidates: list[float], window: float) -> float:
    best = min(candidates, key=lambda c: abs(c - value), default=None)
    return best if best is not None and abs(best - value) <= window else value


def _from_raw(r: RawMoment, start: float, end: float) -> Moment:
    return Moment(round(start, 3), round(end, 3), r.title.strip(), r.description.strip(), r.hashtags, max(0, min(100, int(r.score))), r.reason.strip())


def validate_moments(
    raw: list[RawMoment],
    duration: float,
    speech: list[tuple[float, float]],
    scenes: list[float],
    count: int,
    min_len: float,
    max_len: float,
) -> list[Moment]:
    if duration <= 0:
        raise NoUsableMoments()

    # A video shorter than the minimum clip length becomes one clip of the whole video.
    if duration < min_len:
        best = max(raw, key=lambda r: r.score, default=RawMoment(0.0, duration, title="Full video"))
        return [_from_raw(best, 0.0, duration)]

    starts = [s for s, _ in speech] + list(scenes)
    ends = [e for _, e in speech] + list(scenes)
    fixed: list[Moment] = []
    for r in raw:
        start, end = max(0.0, r.start), min(duration, r.end)
        if not (end > start) or start >= duration:
            continue
        start = _nearest(start, starts, SNAP_WINDOW)
        end = _nearest(end, ends, SNAP_WINDOW)
        if end - start > max_len:
            end = start + max_len
        if end - start < min_len:
            end = min(duration, start + min_len)
            if end - start < min_len:
                start = max(0.0, end - min_len)
        if end - start < min_len - 1e-6 or end <= start:
            continue
        fixed.append(_from_raw(r, start, end))

    kept: list[Moment] = []
    for m in sorted(fixed, key=lambda m: m.score, reverse=True):
        if all(m.end <= k.start or m.start >= k.end for k in kept):
            kept.append(m)
        if len(kept) >= count:
            break
    if not kept:
        raise NoUsableMoments()
    return kept
