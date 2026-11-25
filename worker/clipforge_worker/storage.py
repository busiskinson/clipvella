"""Supabase Storage I/O and path conventions (mirror of lib/data/storage-paths.ts)."""

from __future__ import annotations

from pathlib import Path

import httpx

from .db import Db


def project_prefix(uid: str, project_id: str) -> str:
    return f"{uid}/projects/{project_id}/"


def clip_video_path(uid: str, project_id: str, clip_id: str) -> str:
    return f"{project_prefix(uid, project_id)}clips/{clip_id}.mp4"


def clip_thumb_path(uid: str, project_id: str, clip_id: str) -> str:
    return f"{project_prefix(uid, project_id)}clips/{clip_id}.jpg"


def render_path(uid: str, project_id: str, job_id: str, ext: str) -> str:
    return f"{project_prefix(uid, project_id)}renders/{job_id}.{ext}"


def captions_path(uid: str, project_id: str, name: str) -> str:
    return f"{project_prefix(uid, project_id)}{name}"


class Storage:
    def __init__(self, db: Db):
        self.db = db

    def download(self, bucket: str, path: str, dest: Path) -> Path:
        """Streams an object to disk through a short-lived signed URL (handles large files)."""
        signed = self.db.client.storage.from_(bucket).create_signed_url(path, 600)
        url = signed.get("signedURL") or signed.get("signedUrl") or signed.get("signed_url")
        if not url:
            raise RuntimeError(f"Couldn't read {bucket}/{path} from storage")
        dest.parent.mkdir(parents=True, exist_ok=True)
        with httpx.stream("GET", url, timeout=120, follow_redirects=True) as r:
            r.raise_for_status()
            with dest.open("wb") as f:
                for chunk in r.iter_bytes(1 << 20):
                    f.write(chunk)
        return dest

    def upload(self, bucket: str, path: str, src: Path, content_type: str) -> int:
        """Uploads (overwriting) and returns the size in bytes."""
        data = src.read_bytes()
        self.db.client.storage.from_(bucket).upload(path, data, {"content-type": content_type, "upsert": "true"})
        return len(data)

    def remove(self, bucket: str, paths: list[str]) -> None:
        if paths:
            self.db.client.storage.from_(bucket).remove(paths)
