"""Job loop: claim → run handler → succeed/fail, with a background heartbeat and stale-job recovery."""

from __future__ import annotations

import logging
import shutil
import tempfile
import threading
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Protocol

from .db import JobCanceled

log = logging.getLogger("clipvella.worker")


class JobDb(Protocol):
    def claim(self, worker_id: str) -> dict[str, Any] | None: ...
    def fail(self, job_id: str, message: str) -> None: ...
    def succeed(self, job_id: str, output: dict[str, Any]) -> None: ...


class Pulse(Protocol):
    def report(self, pct: int, stage: str) -> None: ...
    def beat(self) -> None: ...


@dataclass
class JobContext:
    """Passed to every handler: scratch directory and a progress reporter."""

    workdir: Path
    report: Callable[[int, str], None] = field(default=lambda pct, stage: None)


Handler = Callable[[dict[str, Any], JobContext], dict[str, Any]]


def settle_job(db: Any, job: dict[str, Any]) -> None:
    """After a failed or canceled job, release anything it left half-done so the UI never shows it stuck."""
    inp = job.get("input") or {}
    project_id = job.get("project_id") or inp.get("project_id")
    try:
        if job["type"] == "analyze_and_clip" and project_id:
            for c in db.select("clips", project_id=project_id):
                if c["status"] in ("pending", "rendering"):
                    db.update("clips", c["id"], {"status": "failed", "error": "Processing stopped before this clip was rendered."})
        if job["type"] == "render_clip" and inp.get("clip_id"):
            c = db.one("clips", inp["clip_id"])
            if c and c["status"] in ("pending", "rendering"):
                db.update(
                    "clips",
                    c["id"],
                    {"status": "ready" if c.get("output_asset_id") else "failed", "error": "The re-render didn't finish; the previous version is kept."},
                )
        if project_id and job["type"] == "import_url":
            p = db.one("projects", project_id)
            if p and p.get("status") == "processing" and not p.get("source_asset_id"):
                db.update("projects", project_id, {"status": "draft"})
        if project_id and job["type"] in ("analyze_and_clip", "transcribe"):
            p = db.one("projects", project_id)
            if p and p.get("status") == "processing":
                db.update("projects", project_id, {"status": "ready"})
    except Exception as e:  # noqa: BLE001 — settling is best effort and must never break the loop
        log.warning("couldn't settle job %s: %s", job.get("id"), e)


def process_one(
    db: JobDb,
    worker_id: str,
    handlers: dict[str, Handler],
    pulse_factory: Callable[[str], Pulse] | None = None,
    heartbeat_seconds: float = 15.0,
    settle: Callable[[Any, dict[str, Any]], None] = settle_job,
) -> bool:
    """Claims and runs at most one job. Returns False when the queue was empty."""
    job = db.claim(worker_id)
    if not job:
        return False
    job_id = job["id"]
    workdir = Path(tempfile.mkdtemp(prefix=f"clipvella-{job_id[:8]}-"))
    pulse = pulse_factory(job_id) if pulse_factory else None
    stop = threading.Event()
    beater = None
    if pulse is not None:
        # keeps heartbeat_at / worker last_seen fresh during long steps that don't report progress
        beater = threading.Thread(target=lambda: [pulse.beat() for _ in iter(lambda: stop.wait(heartbeat_seconds), True)], daemon=True)
        beater.start()
    try:
        handler = handlers.get(job["type"])
        if handler is None:
            raise RuntimeError(f"This worker can't run {job['type']} jobs yet")
        ctx = JobContext(workdir=workdir, report=pulse.report if pulse else (lambda pct, stage: None))
        output = handler(job, ctx)
        db.succeed(job_id, output or {})
        log.info("job %s (%s) succeeded", job_id, job["type"])
    except JobCanceled:
        log.info("job %s canceled by user", job_id)
        settle(db, job)
    except Exception as e:  # noqa: BLE001 — every failure must reach the user, never crash the loop
        log.error("job %s failed: %s\n%s", job_id, e, traceback.format_exc())
        db.fail(job_id, str(e) or e.__class__.__name__)
        settle(db, job)
    finally:
        stop.set()
        if beater is not None:
            beater.join(timeout=5)
        shutil.rmtree(workdir, ignore_errors=True)
    return True


class LivePulse:
    """Progress + heartbeat for one job. A cancel seen by the heartbeat surfaces at the next report."""

    def __init__(self, db: Any, worker_id: str, capabilities: dict[str, Any], job_id: str):
        self.db, self.worker_id, self.capabilities, self.job_id = db, worker_id, capabilities, job_id
        self.pct, self.stage = 0, "Starting"
        self.canceled = False
        self._lock = threading.Lock()

    def report(self, pct: int, stage: str) -> None:
        if self.canceled:
            raise JobCanceled("Canceled by the user")
        with self._lock:
            self.pct, self.stage = pct, stage
        self.db.progress(self.job_id, pct, stage)  # raises JobCanceled
        self.db.beat(self.worker_id, self.capabilities)

    def beat(self) -> None:
        with self._lock:
            pct, stage = self.pct, self.stage
        try:
            self.db.progress(self.job_id, pct, stage)
        except JobCanceled:
            self.canceled = True
        except Exception as e:  # noqa: BLE001
            log.debug("heartbeat failed: %s", e)
        try:
            self.db.beat(self.worker_id, self.capabilities)
        except Exception as e:  # noqa: BLE001
            log.debug("worker beat failed: %s", e)


def run_forever(db, cfg, handlers: dict[str, Handler], capabilities: dict[str, Any]) -> None:  # pragma: no cover - I/O loop
    last_beat = last_requeue = 0.0
    log.info("worker %s polling every %.0fs", cfg.worker_id, cfg.poll_seconds)
    while True:
        now = time.monotonic()
        try:
            if now - last_beat > cfg.heartbeat_seconds:
                db.beat(cfg.worker_id, capabilities)
                last_beat = now
            if now - last_requeue > cfg.requeue_seconds:
                if n := db.requeue_stale():
                    log.warning("requeued/failed %d stale job(s)", n)
                last_requeue = now
            if process_one(db, cfg.worker_id, handlers, lambda job_id: LivePulse(db, cfg.worker_id, capabilities, job_id), cfg.heartbeat_seconds):
                last_beat = 0.0
                continue
        except Exception as e:  # noqa: BLE001 — network blips must not kill the worker
            log.error("loop error: %s", e)
        time.sleep(cfg.poll_seconds)
