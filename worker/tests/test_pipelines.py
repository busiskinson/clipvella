"""Pipeline tests with real FFmpeg on a generated video and fake DB / storage / AI providers."""

import shutil
import subprocess
import uuid
from pathlib import Path

import pytest

from clipforge_worker.ai.base import RawMoment, Segment, Transcript, Word
from clipforge_worker.loop import JobContext
from clipforge_worker.media import ffmpeg
from clipforge_worker.pipelines import clips, transcribe
from clipforge_worker.pipelines.common import Deps

try:
    FFMPEG = ffmpeg.ffmpeg_bin()
except RuntimeError:
    FFMPEG = None
needs_ffmpeg = pytest.mark.skipif(FFMPEG is None, reason="FFmpeg not installed")


@pytest.fixture(scope="session")
def test_video(tmp_path_factory) -> Path:
    out = tmp_path_factory.mktemp("media") / "test.mp4"
    subprocess.run(
        [FFMPEG, "-y", "-f", "lavfi", "-i", "testsrc=size=1280x720:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(out)],
        check=True, capture_output=True,
    )
    return out


class FakeDb:
    def __init__(self):
        self.tables: dict[str, dict[str, dict]] = {t: {} for t in ("media_assets", "projects", "clips", "transcripts")}

    def add(self, table, row):
        row = {"id": str(uuid.uuid4()), **row}
        self.tables[table][row["id"]] = row
        return row

    def one(self, table, row_id):
        return self.tables[table][row_id]

    def insert(self, table, row):
        return self.add(table, row)

    def update(self, table, row_id, patch):
        self.tables[table][row_id].update(patch)

    def select(self, table, order=None, **eq):
        return [r for r in self.tables[table].values() if all(r.get(k) == v for k, v in eq.items())]

    def delete(self, table, **eq):
        for r in self.select(table, **eq):
            del self.tables[table][r["id"]]

    def upsert_asset(self, row):
        for r in self.tables["media_assets"].values():
            if r["bucket"] == row["bucket"] and r["path"] == row["path"]:
                r.update(row)
                return r
        return self.add("media_assets", row)


class FakeStorage:
    def __init__(self, root: Path, source: Path):
        self.root, self.source, self.objects = root, source, {}

    def download(self, bucket, path, dest):
        shutil.copy(self.source, dest)
        return dest

    def upload(self, bucket, path, src, content_type):
        self.objects[(bucket, path)] = src.stat().st_size
        return src.stat().st_size

    def remove(self, bucket, paths):
        for p in paths:
            self.objects.pop((bucket, p), None)


class FakeTranscriber:
    def __init__(self, words):
        self.words = words

    def transcribe(self, audio, language):
        return Transcript(self.words, [Segment(" ".join(w.text for w in self.words), 0.0, 6.0)] if self.words else [], "en", "fake", "fake")


class FakeHighlights:
    def __init__(self, moments):
        self.moments = moments

    def find_moments(self, transcript, scenes, duration, count, min_len, max_len):
        return self.moments


def setup(tmp_path, test_video, words, moments):
    db = FakeDb()
    asset = db.add("media_assets", {"owner_id": "u1", "bucket": "uploads", "path": "u1/uploads/a/test.mp4", "file_name": "test.mp4"})
    project = db.add("projects", {"owner_id": "u1", "aspect": "9:16", "settings": {}})
    deps = Deps(db=db, storage=FakeStorage(tmp_path, test_video), transcriber=FakeTranscriber(words), highlights=FakeHighlights(moments))
    job = {"id": "j1", "owner_id": "u1", "input": {"project_id": project["id"], "asset_id": asset["id"], "count": 3, "length": "15-30", "aspect": "9:16", "subtitles": True, "language": None}}
    work = tmp_path / "work"
    work.mkdir()
    return db, deps, job, JobContext(workdir=work), project


WORDS = [Word("hello", 0.2, 0.6), Word("clip", 0.7, 1.1), Word("forge", 1.2, 1.6), Word("works", 3.0, 3.5)]


@needs_ffmpeg
def test_no_speech_fails(tmp_path, test_video):
    db, deps, job, ctx, _ = setup(tmp_path, test_video, [], [])
    with pytest.raises(RuntimeError, match="No speech found in this video"):
        clips.run_analyze(job, ctx, deps)


@needs_ffmpeg
def test_short_video_creates_whole_video_clip_with_real_file(tmp_path, test_video):
    # 6 s video < 15 s minimum -> one clip spanning the whole video
    db, deps, job, ctx, project = setup(tmp_path, test_video, WORDS, [RawMoment(1.0, 4.0, title="Intro", score=80)])
    out = clips.run_analyze(job, ctx, deps)
    assert out["clips"] == 1
    [clip] = db.tables["clips"].values()
    assert (clip["start_s"], round(clip["end_s"], 1), clip["status"]) == (0.0, 6.0, "ready")
    video = db.one("media_assets", clip["output_asset_id"])
    assert video["kind"] == "clip" and abs(video["duration_s"] - 6.0) <= 0.2
    assert (video["width"], video["height"]) == (1080, 1920)
    assert db.one("projects", project["id"])["status"] == "ready"


@needs_ffmpeg
def test_transcribe_writes_caption_lines(tmp_path, test_video):
    db, deps, job, ctx, project = setup(tmp_path, test_video, WORDS, [])
    out = transcribe.run(job, ctx, deps)
    lines = db.one("projects", project["id"])["captions"]
    assert out["lines"] == len(lines) >= 1
    assert lines[0]["id"] == "c1" and lines[0]["text"].startswith("hello")


@needs_ffmpeg
def test_export_concat_two_trims(tmp_path, test_video):
    from clipforge_worker.pipelines import export

    db, deps, _, ctx, project = setup(tmp_path, test_video, WORDS, [])
    asset_id = next(iter(db.tables["media_assets"]))
    db.update("projects", project["id"], {"name": "Export test", "timeline": {
        "version": 1, "aspect": "9:16",
        "tracks": [{"id": "t-video", "kind": "video"}, {"id": "t-audio", "kind": "audio"}],
        "media": [{"id": "m1", "assetId": asset_id, "kind": "video", "name": "test.mp4", "duration": 6}],
        "clips": [
            {"id": "a", "trackId": "t-video", "start": 0, "duration": 2.0, "sourceIn": 0.5, "mediaId": "m1", "props": {}},
            {"id": "b", "trackId": "t-video", "start": 2.0, "duration": 1.5, "sourceIn": 3.0, "mediaId": "m1", "props": {"brightness": 10}},
        ],
    }})
    job = {"id": "exp1", "owner_id": "u1", "input": {"project_id": project["id"], "format": "mp4", "resolution": "1080p", "fps": 30}}
    out = export.run(job, ctx, deps)
    render = db.one("media_assets", out["asset_id"])
    assert abs(render["duration_s"] - 3.5) <= 0.2
    assert (render["width"], render["height"]) == (1080, 1920)
    assert out["unsupported"] == []
