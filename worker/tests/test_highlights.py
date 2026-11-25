import pytest

from clipforge_worker.ai.base import RawMoment
from clipforge_worker.highlights import NoUsableMoments, validate_moments

SPEECH = [(0.0, 9.0), (10.2, 30.0), (31.0, 70.0), (72.0, 119.0)]


def run(raw, duration=120.0, count=5, min_len=15.0, max_len=30.0, speech=SPEECH, scenes=()):
    return validate_moments(raw, duration, list(speech), list(scenes), count, min_len, max_len)


def test_out_of_range_end_is_clamped_to_duration():
    [m] = run([RawMoment(100.0, 150.0, score=80)])
    # clamped to the video end, then allowed to snap back to where speech stops (119 s)
    assert 118.5 <= m.end <= 120.0
    assert 15.0 <= m.end - m.start <= 30.0


def test_overlapping_pair_keeps_higher_score():
    out = run([RawMoment(31.0, 55.0, title="low", score=40), RawMoment(40.0, 65.0, title="high", score=90)])
    assert [m.title for m in out] == ["high"]


def test_too_short_moment_is_extended_to_min_length():
    [m] = run([RawMoment(31.0, 36.0, score=70)])
    assert m.start == 31.0
    assert m.end - m.start >= 15.0


def test_start_snaps_to_nearby_speech_start():
    [m] = run([RawMoment(9.5, 28.0, score=70)])
    assert m.start == 10.2


def test_video_shorter_than_min_length_returns_whole_video():
    [m] = run([RawMoment(1.0, 3.0, title="t", score=60)], duration=8.0, speech=[(0.2, 7.5)])
    assert (m.start, m.end) == (0.0, 8.0)
    assert m.title == "t"


def test_all_invalid_raises():
    with pytest.raises(NoUsableMoments) as e:
        run([RawMoment(200.0, 210.0), RawMoment(50.0, 40.0)])
    assert str(e.value) == "The AI didn't return any usable moments"


def test_sorted_by_score_and_limited_to_count():
    raw = [RawMoment(0.0, 20.0, score=50), RawMoment(31.0, 50.0, score=90), RawMoment(72.0, 95.0, score=70)]
    out = run(raw, count=2)
    assert [m.score for m in out] == [90, 70]
