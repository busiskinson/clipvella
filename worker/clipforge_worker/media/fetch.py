"""Downloads a public video from a supported platform link with yt-dlp (runs only on the worker)."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable


class FetchError(RuntimeError):
    """The platform refused or the link couldn't be read; the message is mapped to plain words by the pipeline."""


# ≤720p, H.264 + AAC in MP4 when the platform offers it (plays everywhere and rarely needs re-encoding)
FORMAT = "bv*[height<=720][vcodec^=avc1]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b[height<=720]/b"


def _base_options() -> dict[str, Any]:
    from .ffmpeg import ffmpeg_bin

    return {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "noprogress": True,
        # never use browser cookies or accounts: only what anyone can watch without signing in
        "cookiefile": None,
        "ffmpeg_location": str(Path(ffmpeg_bin()).parent),
        "socket_timeout": 30,
        "retries": 3,
    }


class YtDlpFetcher:
    def probe(self, url: str) -> dict[str, Any]:
        import yt_dlp

        try:
            with yt_dlp.YoutubeDL(_base_options()) as ydl:
                return ydl.extract_info(url, download=False, process=False) or {}
        except yt_dlp.utils.DownloadError as e:
            raise FetchError(str(e)) from e

    def download(self, url: str, workdir: Path, progress: Callable[[float], None]) -> Path:
        import yt_dlp

        def hook(d: dict[str, Any]) -> None:
            if d.get("status") == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate")
                if total:
                    progress(min(1.0, d.get("downloaded_bytes", 0) / total))

        opts = {
            **_base_options(),
            "format": FORMAT,
            "merge_output_format": "mp4",
            "outtmpl": str(workdir / "download.%(ext)s"),
            "progress_hooks": [hook],
        }
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
                path = Path(ydl.prepare_filename(info))
        except yt_dlp.utils.DownloadError as e:
            raise FetchError(str(e)) from e
        if not path.exists():  # merged output changes the extension
            found = sorted(workdir.glob("download.*"))
            if not found:
                raise FetchError("The download finished but no video file was produced.")
            path = found[0]
        return path
