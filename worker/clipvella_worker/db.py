"""Thin wrapper over the Supabase service-role client: job claiming, progress and results."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from supabase import Client, create_client

from .config import Config


class JobCanceled(RuntimeError):
    """The user canceled the job while it was running."""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Db:
    def __init__(self, cfg: Config):
        self.client: Client = create_client(cfg.supabase_url, cfg.service_role_key)

    # ---- queue ----
    def claim(self, worker_id: str) -> dict[str, Any] | None:
        res = self.client.rpc("claim_job", {"p_worker_id": worker_id}).execute()
        job = res.data
        if isinstance(job, list):
            job = job[0] if job else None
        return job if job and job.get("id") else None

    def progress(self, job_id: str, pct: int, stage: str) -> None:
        """Reports progress; raises JobCanceled if the user canceled the job."""
        res = self.client.rpc("job_heartbeat", {"p_job_id": job_id, "p_progress": int(pct), "p_stage": stage}).execute()
        if res.data == "canceled":
            raise JobCanceled("Canceled by the user")

    def succeed(self, job_id: str, output: dict[str, Any]) -> None:
        self.client.table("jobs").update(
            {"status": "succeeded", "progress": 100, "stage": "Done", "output": output, "finished_at": _now()}
        ).eq("id", job_id).eq("status", "running").execute()

    def fail(self, job_id: str, message: str) -> None:
        self.client.table("jobs").update(
            {"status": "failed", "error": message[:2000], "finished_at": _now()}
        ).eq("id", job_id).eq("status", "running").execute()

    def beat(self, worker_id: str, capabilities: dict[str, Any]) -> None:
        self.client.table("worker_status").upsert(
            {"worker_id": worker_id, "last_seen": _now(), "capabilities": capabilities}
        ).execute()

    def requeue_stale(self) -> int:
        return int(self.client.rpc("requeue_stale_jobs", {}).execute().data or 0)

    # ---- rows ----
    def one(self, table: str, row_id: str) -> dict[str, Any]:
        res = self.client.table(table).select("*").eq("id", row_id).single().execute()
        return res.data

    def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        return self.client.table(table).insert(row).execute().data[0]

    def update(self, table: str, row_id: str, patch: dict[str, Any]) -> None:
        self.client.table(table).update(patch).eq("id", row_id).execute()

    def select(self, table: str, order: str | None = None, **eq: Any) -> list[dict[str, Any]]:
        q = self.client.table(table).select("*")
        for k, v in eq.items():
            q = q.eq(k, v)
        if order:
            q = q.order(order, desc=True)
        return q.execute().data or []

    def delete(self, table: str, **eq: Any) -> None:
        q = self.client.table(table).delete()
        for k, v in eq.items():
            q = q.eq(k, v)
        q.execute()

    def asset_in_use(self, asset_id: str, except_project: str | None = None) -> bool:
        """True if any project uses the asset as its source or on its saved timeline."""
        q = self.client.table("projects").select("id").eq("source_asset_id", asset_id)
        if except_project:
            q = q.neq("id", except_project)
        if q.limit(1).execute().data:
            return True
        q = self.client.table("projects").select("id").contains("timeline", {"media": [{"assetId": asset_id}]})
        if except_project:
            q = q.neq("id", except_project)
        return bool(q.limit(1).execute().data)

    def upsert_asset(self, row: dict[str, Any]) -> dict[str, Any]:
        """Insert or refresh a media_assets row keyed by (bucket, path) — re-renders overwrite in place."""
        res = self.client.table("media_assets").upsert(row, on_conflict="bucket,path").execute()
        return res.data[0]
