"""Caption lines from word timings, and ASS subtitles for FFmpeg burn-in (karaoke-capable)."""

from __future__ import annotations

from typing import Any

from .ai.base import Word

MAX_CHARS = 42
MAX_DURATION = 3.5
MAX_GAP = 1.0

FONT_FALLBACK = "Arial"  # used by libass when the chosen Google font isn't installed on the worker


def lines_from_words(words: list[Word], max_chars: int = MAX_CHARS, max_dur: float = MAX_DURATION, max_gap: float = MAX_GAP) -> list[dict[str, Any]]:
    """Groups words into readable caption lines: ≤ max_chars, ≤ max_dur seconds, split on long pauses."""
    lines: list[dict[str, Any]] = []
    cur: list[Word] = []

    def flush() -> None:
        if cur:
            lines.append({"start": round(cur[0].start, 3), "end": round(cur[-1].end, 3), "text": " ".join(w.text for w in cur)})
            cur.clear()

    for w in words:
        if not w.text.strip():
            continue
        if cur:
            text_len = len(" ".join(x.text for x in cur)) + 1 + len(w.text)
            if text_len > max_chars or w.end - cur[0].start > max_dur or w.start - cur[-1].end > max_gap:
                flush()
        cur.append(w)
    flush()
    # guarantee non-overlapping, ordered lines
    for a, b in zip(lines, lines[1:]):
        if a["end"] > b["start"]:
            a["end"] = b["start"]
    return lines


def _ass_time(t: float) -> str:
    t = max(0.0, t)
    cs = int(round(t * 100))
    h, rem = divmod(cs, 360000)
    m, rem = divmod(rem, 6000)
    s, cs = divmod(rem, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _ass_color(hex_color: str, alpha: int = 0) -> str:
    h = (hex_color or "#FFFFFF").lstrip("#")
    if len(h) != 6:
        h = "FFFFFF"
    r, g, b = h[0:2], h[2:4], h[4:6]
    return f"&H{alpha:02X}{b}{g}{r}".upper()


def _clean(text: str) -> str:
    return text.replace("{", "").replace("}", "").replace("\\", "")


def to_ass(words: list[Word], style: dict[str, Any] | None, width: int, height: int, offset: float = 0.0) -> str:
    """ASS subtitles for words (times relative to the clip start after subtracting offset)."""
    st = style or {}
    karaoke = st.get("highlightMode") in ("karaoke", "word-pop")
    scale = width / 1080
    size = int(round(float(st.get("fontSize", 64)) * scale))
    text_c = _ass_color(st.get("textColor", "#F8FAFC"))
    high_c = _ass_color(st.get("highlightColor", "#C4B5FD"))
    outline_c = _ass_color(st.get("outlineColor", "#080B14"))
    shadow_c = _ass_color(st.get("shadowColor", "#000000"), 0x60)
    bg_opacity = int(st.get("bgOpacity", 0))
    border_style = 3 if bg_opacity > 0 else 1
    back_c = _ass_color(st.get("bgColor", "#080B14"), 255 - int(255 * bg_opacity / 100)) if bg_opacity else shadow_c
    position = st.get("position", "bottom")
    align = {"top": 8, "middle": 5, "bottom": 2}.get(position, 2)
    align += {"left": -1, "right": 1}.get(st.get("align", "center"), 0)
    margin_v = int(height * (0.12 if position != "middle" else 0) + height * float(st.get("offsetY", 0)) / 100 * (-1 if position == "bottom" else 1))
    bold = -1 if int(st.get("fontWeight", 800)) >= 600 else 0
    primary, secondary = (high_c, text_c) if karaoke else (text_c, text_c)

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{st.get("font", FONT_FALLBACK)},{size},{primary},{secondary},{outline_c},{back_c},{bold},0,0,0,100,100,0,0,{border_style},{float(st.get("outlineWidth", 3)) * scale:.1f},{float(st.get("shadowBlur", 8)) / 4 * scale:.1f},{align},{int(60 * scale)},{int(60 * scale)},{max(0, margin_v)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    upper = bool(st.get("uppercase"))
    shifted = [Word(w.text, w.start - offset, w.end - offset) for w in words if w.end > offset]
    events = []
    for line in lines_from_words(shifted, max_chars=max(12, int(st.get("wordsPerLine", 4)) * 8)):
        line_words = [w for w in shifted if line["start"] <= w.start < line["end"] + 1e-6]
        parts = []
        for i, w in enumerate(line_words):
            text = _clean(w.text.upper() if upper else w.text)
            if karaoke:
                nxt = line_words[i + 1].start if i + 1 < len(line_words) else w.end
                parts.append(f"{{\\k{max(1, int(round((nxt - w.start) * 100)))}}}{text}")
            else:
                parts.append(text)
        events.append(f"Dialogue: 0,{_ass_time(line['start'])},{_ass_time(line['end'])},Default,,0,0,0,,{' '.join(parts)}")
    return header + "\n".join(events) + "\n"
