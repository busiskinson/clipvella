from pathlib import Path

import pytest

from clipforge_worker.ai.base import Word
from clipforge_worker.ai.groq_whisper import merge_chunks
from clipforge_worker.config import MissingConfig, require
from clipforge_worker.loop import process_one
from clipforge_worker.media.ffmpeg import cut_clip_args


def test_chunk_offsets_and_overlap_dedup():
    # two 600 s chunks, 2 s overlap -> chunk 1 starts at 598 s; the boundary sits mid-overlap (599 s)
    chunk0 = [Word("hello", 10.0, 10.5), Word("dup-early", 598.5, 598.9), Word("dup-late", 599.5, 599.8)]
    chunk1 = [Word("dup-early", 0.5, 0.9), Word("dup-late", 1.5, 1.8), Word("world", 5.0, 5.4)]
    words = merge_chunks([(0.0, chunk0), (598.0, chunk1)], overlap=2.0)
    assert [(w.text, round(w.start, 2)) for w in words] == [
        ("hello", 10.0),
        ("dup-early", 598.5),
        ("dup-late", 599.5),
        ("world", 603.0),
    ]


def test_cut_clip_args_vertical_from_landscape():
    args = cut_clip_args(Path("src.mp4"), Path("out.mp4"), 12.0, 42.5, "9:16", src_w=1920, src_h=1080)
    vf = args[args.index("-vf") + 1]
    assert vf.startswith("crop=ih*9/16:ih,scale=1080:1920")
    assert args[args.index("-ss") + 1] == "12.000"
    assert args[args.index("-t") + 1] == "30.500"
    assert args[-1] == "out.mp4"


def test_cut_clip_args_landscape_from_vertical_crops_height():
    args = cut_clip_args(Path("src.mp4"), Path("out.mp4"), 0, 10, "16:9", src_w=1080, src_h=1920)
    assert args[args.index("-vf") + 1].startswith("crop=iw:iw*9/16,scale=1920:1080")


def test_cut_clip_args_burns_subtitles_by_file_name():
    args = cut_clip_args(Path("src.mp4"), Path("out.mp4"), 0, 5, "1:1", src_w=1000, src_h=1000, subtitles=Path("C:/tmp/job/subs.ass"))
    assert args[args.index("-vf") + 1].endswith(",subtitles=subs.ass")


def test_missing_key_message(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    with pytest.raises(MissingConfig) as e:
        require("GROQ_API_KEY")
    assert str(e.value) == "GROQ_API_KEY isn't set on the worker"


class FakeDb:
    def __init__(self, job):
        self.job = job
        self.failed = None
        self.succeeded = None

    def claim(self, worker_id):
        job, self.job = self.job, None
        return job

    def fail(self, job_id, message):
        self.failed = (job_id, message)

    def succeed(self, job_id, output):
        self.succeeded = (job_id, output)


def test_loop_marks_failure_with_handler_message():
    db = FakeDb({"id": "j1", "type": "transcribe", "input": {}})

    def boom(job, ctx):
        raise RuntimeError("No speech found in this video")

    assert process_one(db, "w1", {"transcribe": boom}) is True
    assert db.failed == ("j1", "No speech found in this video")
    assert db.succeeded is None


def test_loop_returns_false_when_queue_empty():
    assert process_one(FakeDb(None), "w1", {}) is False


def test_loop_settles_job_state_on_failure():
    db = FakeDb({"id": "j2", "type": "analyze_and_clip", "project_id": "p1", "input": {"project_id": "p1"}})
    settled = []

    def boom(job, ctx):
        raise RuntimeError("boom")

    process_one(db, "w1", {"analyze_and_clip": boom}, settle=lambda d, job: settled.append(job["id"]))
    assert settled == ["j2"]


def test_heartbeat_keeps_running_during_a_slow_step():
    import time

    beats = []

    class Pulse:
        def report(self, pct, stage):
            pass

        def beat(self):
            beats.append(1)

    def slow(job, ctx):
        time.sleep(0.35)
        return {}

    db = FakeDb({"id": "j3", "type": "transcribe", "input": {}})
    process_one(db, "w1", {"transcribe": slow}, pulse_factory=lambda job_id: Pulse(), heartbeat_seconds=0.05)
    assert len(beats) >= 3
    assert db.succeeded == ("j3", {})


def test_bitrate_cap_keeps_long_clips_under_limit():
    from clipforge_worker.media.ffmpeg import video_kbps_cap

    assert video_kbps_cap(10, 50) is None  # short clips need no cap
    cap = video_kbps_cap(90, 50)
    assert cap is not None and (cap + 128) * 90 / 8 / 1024 <= 50 * 0.9 + 0.01
    args = cut_clip_args(Path("s.mp4"), Path("o.mp4"), 0, 90, "9:16", 1920, 1080, max_mb=50)
    assert args[args.index("-maxrate") + 1] == f"{cap}k"
