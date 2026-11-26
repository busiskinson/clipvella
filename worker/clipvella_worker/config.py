"""Worker configuration from environment (worker/.env). Secrets never leave this process."""

from __future__ import annotations

import os
import socket
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class MissingConfig(RuntimeError):
    """A required setting is absent. The message is shown to the user on the failed job."""


def require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise MissingConfig(f"{name} isn't set on the worker")
    return value


def optional(name: str, default: str) -> str:
    return os.environ.get(name, "").strip() or default


@dataclass(frozen=True)
class Config:
    supabase_url: str
    service_role_key: str
    worker_id: str
    whisper_model: str
    gemini_model: str
    gemini_fallbacks: tuple[str, ...]
    poll_seconds: float = 3.0
    heartbeat_seconds: float = 15.0
    requeue_seconds: float = 60.0

    @staticmethod
    def load() -> "Config":
        return Config(
            supabase_url=require("SUPABASE_URL"),
            service_role_key=require("SUPABASE_SERVICE_ROLE_KEY"),
            worker_id=optional("WORKER_ID", socket.gethostname()),
            whisper_model=optional("WHISPER_MODEL", "whisper-large-v3-turbo"),
            gemini_model=optional("GEMINI_MODEL", "gemini-flash-latest"),
            # tried in order when the main model is overloaded, retired or hangs
            gemini_fallbacks=tuple(m.strip() for m in optional("GEMINI_FALLBACK_MODELS", "gemini-3.6-flash,gemini-flash-lite-latest,gemini-3.5-flash-lite").split(",") if m.strip()),
        )


def keys_configured() -> dict[str, bool]:
    """Which provider keys are present — names only, never values."""
    return {"groq": bool(os.environ.get("GROQ_API_KEY", "").strip()), "gemini": bool(os.environ.get("GEMINI_API_KEY", "").strip())}
