"""Speech (Silero VAD) and scene (PySceneDetect) detection. Heavy imports are deferred until used."""

from __future__ import annotations

import wave
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def _vad_model():
    from silero_vad import load_silero_vad

    return load_silero_vad()


def speech_segments(wav_path: Path) -> list[tuple[float, float]]:
    """Speech regions in seconds from a 16 kHz mono WAV."""
    import numpy as np
    import torch
    from silero_vad import get_speech_timestamps

    with wave.open(str(wav_path), "rb") as w:
        if w.getframerate() != 16000 or w.getnchannels() != 1:
            raise RuntimeError("VAD expects 16 kHz mono audio")
        frames = w.readframes(w.getnframes())
    audio = torch.from_numpy(np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0)
    stamps = get_speech_timestamps(audio, _vad_model(), sampling_rate=16000, return_seconds=True)
    return [(float(s["start"]), float(s["end"])) for s in stamps]


def scene_cuts(video: Path) -> list[float]:
    """Times (s) where a new shot starts, excluding 0."""
    from scenedetect import ContentDetector, detect

    scenes = detect(str(video), ContentDetector(threshold=27.0), show_progress=False)
    return [round(start.get_seconds(), 3) for start, _end in scenes[1:]]


def capabilities() -> dict[str, bool]:
    caps: dict[str, bool] = {}
    try:
        from .ffmpeg import ffmpeg_bin, ffprobe_bin

        ffmpeg_bin(), ffprobe_bin()
        caps["ffmpeg"] = True
    except RuntimeError:
        caps["ffmpeg"] = False
    for name, mod in (("vad", "silero_vad"), ("scenedetect", "scenedetect")):
        try:
            __import__(mod)
            caps[name] = True
        except ImportError:
            caps[name] = False
    return caps
