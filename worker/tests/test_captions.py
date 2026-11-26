from clipvella_worker.ai.base import Word
from clipvella_worker.captions import lines_from_words, to_ass


def make_words(n, gap=0.3, dur=0.25, text="word"):
    return [Word(f"{text}{i}", round(i * gap, 3), round(i * gap + dur, 3)) for i in range(n)]


def test_lines_respect_length_and_duration_limits():
    words = make_words(30)  # 9 s of speech
    lines = lines_from_words(words)
    assert lines
    for ln in lines:
        assert len(ln["text"]) <= 42
        assert ln["end"] - ln["start"] <= 3.5
    for a, b in zip(lines, lines[1:]):
        assert a["end"] <= b["start"]
    assert " ".join(ln["text"] for ln in lines).split() == [w.text for w in words]


def test_long_pause_starts_a_new_line():
    words = [Word("hello", 0.0, 0.4), Word("there", 0.5, 0.9), Word("again", 3.0, 3.4)]
    lines = lines_from_words(words)
    assert [ln["text"] for ln in lines] == ["hello there", "again"]


def test_ass_contains_karaoke_tags_when_enabled():
    words = [Word("hi", 0.0, 0.5), Word("you", 0.5, 1.0)]
    ass = to_ass(words, {"font": "Montserrat", "highlightMode": "karaoke"}, 1080, 1920)
    assert "PlayResX: 1080" in ass and "PlayResY: 1920" in ass
    assert r"{\k50}hi" in ass and r"{\k50}you" in ass
