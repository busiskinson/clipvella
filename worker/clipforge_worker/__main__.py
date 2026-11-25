"""Entry point: `uv run python -m clipforge_worker` (run) or `... --check` (diagnostics)."""

from __future__ import annotations

import argparse
import logging
import sys

from .config import Config, keys_configured


def main() -> int:
    parser = argparse.ArgumentParser(prog="clipforge_worker")
    parser.add_argument("--check", action="store_true", help="print available tools and which keys are set, then exit")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    from .media.analysis import capabilities

    caps = {**capabilities(), "keys": keys_configured()}
    if args.check:
        for name in ("ffmpeg", "vad", "scenedetect"):
            print(f"{name:12} {'OK' if caps[name] else 'MISSING'}")
        for name, ok in caps["keys"].items():
            print(f"{name + ' key':12} {'set' if ok else 'not set'}")
        return 0 if all(caps[n] for n in ("ffmpeg", "vad", "scenedetect")) else 1

    from .ai.gemini import GeminiHighlights
    from .ai.groq_whisper import GroqWhisper
    from .db import Db
    from .loop import run_forever
    from .media.analysis import scene_cuts, speech_segments
    from .pipelines import clips, export, transcribe
    from .pipelines.common import Deps
    from .storage import Storage

    cfg = Config.load()
    db = Db(cfg)
    deps = Deps(
        db=db,
        storage=Storage(db),
        transcriber=GroqWhisper(cfg.whisper_model),
        highlights=GeminiHighlights(cfg.gemini_model),
        speech=speech_segments if caps["vad"] else None,
        scenes=scene_cuts if caps["scenedetect"] else None,
    )
    handlers = {
        "transcribe": lambda job, ctx: transcribe.run(job, ctx, deps),
        "analyze_and_clip": lambda job, ctx: clips.run_analyze(job, ctx, deps),
        "render_clip": lambda job, ctx: clips.run_render_clip(job, ctx, deps),
        "render_export": lambda job, ctx: export.run(job, ctx, deps),
    }
    run_forever(db, cfg, handlers, caps)
    return 0


if __name__ == "__main__":
    sys.exit(main())
