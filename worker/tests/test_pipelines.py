"""Pipeline tests with real FFmpeg on a generated video and fake DB / storage / AI providers."""

import shutil
import subprocess
import uuid
from pathlib import Path

import pytest

from clipvella_worker.ai.base import RawMoment, Segment, Transcript, Word
from clipvella_worker.loop import JobContext
from clipvella_worker.media import ffmpeg
from clipvella_worker.pipelines import clips, transcribe
from clipvella_worker.pipelines.common import Deps

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

    def asset_in_use(self, asset_id, except_project=None):
        for p in self.tables["projects"].values():
            if p["id"] == except_project:
                continue
            if p.get("source_asset_id") == asset_id:
                return True
            if any(m.get("assetId") == asset_id for m in ((p.get("timeline") or {}).get("media") or [])):
                return True
        return False

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
        from clipvella_worker.pipelines.common import ensure_fits

        ensure_fits(src)
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
    from clipvella_worker.pipelines import export

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


@needs_ffmpeg
def test_worker_refuses_assets_owned_by_someone_else(tmp_path, test_video):
    db, deps, job, ctx, _ = setup(tmp_path, test_video, WORDS, [RawMoment(0, 5, score=50)])
    asset = db.one("media_assets", job["input"]["asset_id"])
    asset["owner_id"] = "someone-else"
    with pytest.raises(RuntimeError, match="doesn't belong to this job's owner"):
        clips.run_analyze(job, ctx, deps)


def _with_speech(deps, regions):
    deps.speech = lambda wav: regions
    return deps


@needs_ffmpeg
def test_vad_without_speech_overrides_hallucinated_words(tmp_path, test_video):
    db, deps, job, ctx, _ = setup(tmp_path, test_video, [Word("Thank", 1.0, 1.3), Word("you.", 1.3, 1.6)], [RawMoment(0, 5, score=50)])
    _with_speech(deps, [])
    with pytest.raises(RuntimeError, match="No speech found in this video"):
        clips.run_analyze(job, ctx, deps)


@needs_ffmpeg
def test_words_outside_speech_regions_are_dropped(tmp_path, test_video):
    db, deps, job, ctx, project = setup(tmp_path, test_video, WORDS, [])
    _with_speech(deps, [(0.0, 1.8)])  # "works" at 3.0 s is outside any speech
    transcribe.run(job, ctx, deps)
    text = " ".join(line["text"] for line in db.one("projects", project["id"])["captions"])
    assert "works" not in text and "hello" in text


def _analyzed(tmp_path, test_video):
    db, deps, job, ctx, project = setup(tmp_path, test_video, WORDS, [RawMoment(0.0, 5.0, title="Intro", score=80)])
    clips.run_analyze(job, ctx, deps)
    [clip] = db.tables["clips"].values()
    return db, deps, ctx, project, clip


@needs_ffmpeg
def test_render_clip_failure_keeps_previous_version(tmp_path, test_video):
    db, deps, ctx, project, clip = _analyzed(tmp_path, test_video)
    old = (clip["start_s"], clip["end_s"], clip["output_asset_id"])
    job = {"id": "r1", "owner_id": "u1", "type": "render_clip", "input": {"clip_id": clip["id"], "start_s": 2.0, "end_s": 99.0}}
    with pytest.raises(RuntimeError, match="only 6.0s long"):
        clips.run_render_clip(job, ctx, deps)
    after = db.one("clips", clip["id"])
    assert (after["start_s"], after["end_s"], after["output_asset_id"]) == old
    assert after["status"] == "ready" and "only 6.0s long" in after["error"]


@needs_ffmpeg
def test_render_clip_applies_new_times_on_success(tmp_path, test_video):
    db, deps, ctx, project, clip = _analyzed(tmp_path, test_video)
    job = {"id": "r2", "owner_id": "u1", "type": "render_clip", "input": {"clip_id": clip["id"], "start_s": 1.0, "end_s": 4.0}}
    clips.run_render_clip(job, ctx, deps)
    after = db.one("clips", clip["id"])
    assert (after["start_s"], after["end_s"], after["status"], after["error"]) == (1.0, 4.0, "ready", None)
    assert abs(db.one("media_assets", after["output_asset_id"])["duration_s"] - 3.0) <= 0.2


@needs_ffmpeg
def test_settle_unsticks_clips_and_project_after_failure(tmp_path, test_video):
    from clipvella_worker.loop import settle_job

    db, deps, ctx, project, clip = _analyzed(tmp_path, test_video)
    db.update("clips", clip["id"], {"status": "rendering"})
    db.update("projects", project["id"], {"status": "processing"})
    settle_job(db, {"type": "analyze_and_clip", "project_id": project["id"], "input": {"project_id": project["id"]}})
    assert db.one("clips", clip["id"])["status"] == "failed"
    assert db.one("projects", project["id"])["status"] == "ready"


@needs_ffmpeg
def test_regenerate_keeps_clip_file_used_by_another_project(tmp_path, test_video):
    db, deps, ctx, project, clip = _analyzed(tmp_path, test_video)
    out_id = clip["output_asset_id"]
    out_path = db.one("media_assets", out_id)["path"]
    db.add("projects", {"owner_id": "u1", "source_asset_id": out_id, "aspect": "9:16", "settings": {}})
    job = {"id": "j9", "owner_id": "u1", "input": {"project_id": project["id"], "asset_id": clip["source_asset_id"], "count": 1, "length": "15-30", "aspect": "9:16", "subtitles": False, "language": None}}
    clips.run_analyze(job, ctx, deps)
    assert out_id in db.tables["media_assets"]
    assert ("media", out_path) in deps.storage.objects


@needs_ffmpeg
def test_oversized_render_fails_with_plain_message(tmp_path, test_video, monkeypatch):
    monkeypatch.setenv("WORKER_MAX_UPLOAD_MB", "0.001")
    db, deps, job, ctx, _ = setup(tmp_path, test_video, WORDS, [RawMoment(0.0, 5.0, score=80)])
    with pytest.raises(RuntimeError, match="None of the clips could be rendered"):
        clips.run_analyze(job, ctx, deps)
    [clip] = db.tables["clips"].values()
    assert "storage limit" in clip["error"]
