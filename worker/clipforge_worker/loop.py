"""Job loop: claim → run handler → succeed/fail, with heartbeats and stale-job recovery."""

from __future__ import annotations

import logging
import shutil
import tempfile
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Protocol

from .db import JobCanceled

log = logging.getLogger("clipforge.worker")


class JobDb(Protocol):
    def claim(self, worker_id: str) -> dict[str, Any] | None: ...
    def fail(self, job_id: str, message: str) -> None: ...
    def succeed(self, job_id: str, output: dict[str, Any]) -> None: ...


@dataclass
class JobContext:
    """Passed to every handler: scratch directory and a progress reporter."""

    workdir: Path
    report: Callable[[int, str], None] = field(default=lambda pct, stage: None)


Handler = Callable[[dict[str, Any], JobContext], dict[str, Any]]


def process_one(db: JobDb, worker_id: str, handlers: dict[str, Handler], report_factory: Callable[[str], Callable[[int, str], None]] | None = None) -> bool:
    """Claims and runs at most one job. Returns False when the queue was empty."""
    job = db.claim(worker_id)
    if not job:
        return False
    job_id = job["id"]
    workdir = Path(tempfile.mkdtemp(prefix=f"clipforge-{job_id[:8]}-"))
    try:
        handler = handlers.get(job["type"])
        if handler is None:
            raise RuntimeError(f"This worker can't run {job['type']} jobs yet")
        ctx = JobContext(workdir=workdir, report=report_factory(job_id) if report_factory else (lambda pct, stage: None))
        output = handler(job, ctx)
        db.succeed(job_id, output or {})
        log.info("job %s (%s) succeeded", job_id, job["type"])
    except JobCanceled:
        log.info("job %s canceled by user", job_id)
    except Exception as e:  # noqa: BLE001 — every failure must reach the user, never crash the loop
        log.error("job %s failed: %s\n%s", job_id, e, traceback.format_exc())
        db.fail(job_id, str(e) or e.__class__.__name__)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
    return True


def run_forever(db, cfg, handlers: dict[str, Handler], capabilities: dict[str, Any]) -> None:  # pragma: no cover - I/O loop
    last_beat = last_requeue = 0.0

    def report_factory(job_id: str):
        def report(pct: int, stage: str) -> None:
            db.progress(job_id, pct, stage)
            db.beat(cfg.worker_id, capabilities)

        return report

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
            if process_one(db, cfg.worker_id, handlers, report_factory):
                last_beat = 0.0  # beat again right after a job
                continue
        except Exception as e:  # noqa: BLE001 — network blips must not kill the worker
            log.error("loop error: %s", e)
        time.sleep(cfg.poll_seconds)
