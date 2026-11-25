"""transcribe job: Whisper → transcripts row + caption lines on the project (Caption Studio)."""

from __future__ import annotations

from ..captions import lines_from_words
from ..loop import JobContext
from .common import Deps, fetch_source, save_transcript, transcribe_media


def run(job: dict, ctx: JobContext, deps: Deps) -> dict:
    inp = job["input"]
    owner, project_id, asset_id = job["owner_id"], inp["project_id"], inp["asset_id"]

    ctx.report(5, "Downloading video")
    asset, src, info = fetch_source(deps, asset_id, ctx.workdir)
    ctx.report(20, "Extracting audio")
    ctx.report(35, "Transcribing speech")
    transcript, _ = transcribe_media(deps, src, info, ctx.workdir, inp.get("language"))
    if not transcript.words:
        raise RuntimeError("No speech found in this video")

    ctx.report(85, "Building caption lines")
    row = save_transcript(deps, owner, asset_id, project_id, transcript)
    lines = [{"id": f"c{i + 1}", **line} for i, line in enumerate(lines_from_words(transcript.words))]
    deps.db.update("projects", project_id, {"captions": lines, "status": "ready"})
    return {"transcript_id": row["id"], "lines": len(lines), "language": transcript.language}
