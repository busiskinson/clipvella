"""import_url job: link checks, guardrails and saving the downloaded video (fake fetcher, real FFmpeg)."""

import shutil
from pathlib import Path

import pytest

from clipvella_worker.loop import JobContext, settle_job
from clipvella_worker.media import ffmpeg
from clipvella_worker.pipelines import import_url
from clipvella_worker.pipelines.common import Deps
from test_pipelines import FakeDb, FakeStorage, needs_ffmpeg, test_video  # noqa: F401 — test_video is a fixture

URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


class FakeFetcher:
    def __init__(self, info: dict, source: Path | None = None, error: Exception | None = None):
        self.info, self.source, self.error, self.downloaded = info, source, error, False

    def probe(self, url):
        if self.error:
            raise self.error
        return self.info

    def download(self, url, workdir, progress):
        self.downloaded = True
        progress(0.5)
        dest = workdir / "download.mp4"
        shutil.copy(self.source, dest)
        return dest


def setup(tmp_path, fetcher, url=URL, owner="u1", project_owner="u1"):
    db = FakeDb()
    project = db.add("projects", {"owner_id": project_owner, "name": "Importing…", "kind": "clip", "status": "processing", "settings": {}})
    deps = Deps(db=db, storage=FakeStorage(tmp_path, Path("unused")), fetcher=fetcher)
    job = {"id": "j1", "type": "import_url", "owner_id": owner, "project_id": project["id"], "input": {"project_id": project["id"], "url": url, "rights_confirmed": True}}
    work = tmp_path / "work"
    work.mkdir()
    return db, deps, job, JobContext(workdir=work), project


INFO = {"title": "My talk: part 1/2", "duration": 6, "availability": "public", "live_status": "not_live", "extractor_key": "Youtube"}


@needs_ffmpeg
def test_import_saves_video_and_attaches_it_to_the_project(tmp_path, test_video):
    db, deps, job, ctx, project = setup(tmp_path, FakeFetcher(INFO, test_video))
    out = import_url.run(job, ctx, deps)

    asset = db.one("media_assets", out["asset_id"])
    assert asset["owner_id"] == "u1" and asset["kind"] == "upload" and asset["bucket"] == "uploads"
    assert asset["path"].startswith(f"u1/uploads/{asset['id']}/") and asset["path"].endswith(".mp4")
    assert asset["duration_s"] == pytest.approx(6, abs=0.3) and asset["width"] == 1280
    assert ("uploads", asset["path"]) in deps.storage.objects
    thumb = db.one("media_assets", db.one("projects", project["id"])["thumbnail_asset_id"])
    assert thumb["path"] == f"u1/uploads/{asset['id']}.jpg" and ("thumbnails", thumb["path"]) in deps.storage.objects
    p = db.one("projects", project["id"])
    assert p["source_asset_id"] == asset["id"] and p["status"] == "ready" and p["name"] == "My talk: part 1/2"
    assert out["title"] == "My talk: part 1/2"


@pytest.mark.parametrize(
    "info, message",
    [
        ({**INFO, "availability": "private"}, "private or needs a login"),
        ({**INFO, "availability": "needs_auth"}, "private or needs a login"),
        ({**INFO, "availability": "premium_only"}, "paid or members-only"),
        ({**INFO, "live_status": "is_live"}, "Live streams"),
        ({**INFO, "duration": 11 * 60}, "longer than 10 minutes"),
        ({**INFO, "_type": "playlist"}, "playlist"),
    ],
)
def test_guardrails_refuse_before_downloading(tmp_path, info, message):
    fetcher = FakeFetcher(info)
    _, deps, job, ctx, _ = setup(tmp_path, fetcher)
    with pytest.raises(RuntimeError, match=message):
        import_url.run(job, ctx, deps)
    assert not fetcher.downloaded


@pytest.mark.parametrize(
    "error, message",
    [
        ("ERROR: [youtube] x: This video is DRM protected", "DRM"),
        ("ERROR: [youtube] x: Private video. Sign in if you've been granted access", "private or needs a login"),
        ("ERROR: [tiktok] x: Video unavailable", "unavailable"),
    ],
)
def test_platform_errors_become_plain_messages(tmp_path, error, message):
    _, deps, job, ctx, _ = setup(tmp_path, FakeFetcher(INFO, error=import_url.FetchError(error)))
    with pytest.raises(RuntimeError, match=message):
        import_url.run(job, ctx, deps)


@pytest.mark.parametrize("url", ["https://vimeo.com/123", "https://example.com/video.mp4", "file:///C:/secret.mp4", "https://www.youtube.com.evil.io/watch?v=x"])
def test_only_supported_platform_links_are_fetched(tmp_path, url):
    fetcher = FakeFetcher(INFO)
    _, deps, job, ctx, _ = setup(tmp_path, fetcher, url=url)
    with pytest.raises(RuntimeError, match="TikTok, YouTube and Facebook"):
        import_url.run(job, ctx, deps)
    assert not fetcher.downloaded


def test_requires_rights_confirmation(tmp_path):
    _, deps, job, ctx, _ = setup(tmp_path, FakeFetcher(INFO))
    job["input"]["rights_confirmed"] = False
    with pytest.raises(RuntimeError, match="permission"):
        import_url.run(job, ctx, deps)


def test_refuses_project_owned_by_someone_else(tmp_path):
    _, deps, job, ctx, _ = setup(tmp_path, FakeFetcher(INFO), project_owner="someone-else")
    with pytest.raises(RuntimeError, match="doesn't belong"):
        import_url.run(job, ctx, deps)


@needs_ffmpeg
def test_large_download_is_shrunk_to_fit_storage(tmp_path, test_video, monkeypatch):
    monkeypatch.setenv("WORKER_MAX_UPLOAD_MB", "0.2")
    db, deps, job, ctx, _ = setup(tmp_path, FakeFetcher(INFO, test_video))
    out = import_url.run(job, ctx, deps)
    asset = db.one("media_assets", out["asset_id"])
    assert asset["size_bytes"] <= 0.2 * 1024 * 1024
    assert asset["height"] <= 720


def test_failed_import_puts_project_back_to_draft():
    db = FakeDb()
    p = db.add("projects", {"owner_id": "u1", "status": "processing"})
    settle_job(db, {"id": "j", "type": "import_url", "project_id": p["id"], "input": {"project_id": p["id"]}})
    assert db.one("projects", p["id"])["status"] == "draft"


def test_fit_args_scale_down_to_720p_and_cap_bitrate():
    args = ffmpeg.fit_video_args(Path("in.mp4"), Path("out.mp4"), duration=600, max_mb=50)
    joined = " ".join(args)
    assert "scale=-2:'min(720,ih)'" in joined and "-maxrate" in joined
