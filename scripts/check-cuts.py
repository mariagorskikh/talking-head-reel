#!/usr/bin/env python3
"""Listen to every cut of a rendered reel and compare it with the captions.

    check-cuts.py <rendered.mp4> <segments.json> <words.json> [--window 1.6] [--edge 0.6] [--model turbo]

Whisper's word times drift, most of all over road noise, fans or a quiet
speaker: a word can be placed half a second early, so a cut set from word
times clips it ("we shipped in three [weeks]") or keeps the tail of a word
the take was meant to drop ("zero designers. [and] I thought..."). Captions built
from the same times look right while the audio is wrong, so this reads
the AUDIO: for each cut it transcribes the last WINDOW seconds of the take
and the first WINDOW seconds of the next take, each clip on its own (no
context to guess from), and prints what was heard next to the caption
words for the same span, in edit seconds.

Only the words in the EDGE seconds touching the cut are judged, located
with whisper's word timestamps, so a pause at the cut does not make a word
from earlier in the window count as the edge. A cut is FLAGGED when a word
heard in the edge zone is not in the captions for the window (a leftover
such as "and", "so", or a whole word the captions never had), or a caption
word in the edge zone was not heard anywhere in the window (a word the cut
chopped off).
Whisper mishears short clips, so a flag means listen to that cut, not
that it is wrong. Fix a real one by moving the take's a/b in
segments.json (find the true word edges with the recipe in SKILL.md,
section 8), rerun cut.py and re-render.

Exit status is 0 when nothing is flagged, 1 otherwise.
"""
import argparse
import difflib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

WHISPER = shutil.which("whisper") or "/opt/anaconda3/bin/whisper"  # openai-whisper CLI


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower())


def seen(x, pool):
    """x is in pool, allowing for caption spelling fixes and short-clip
    mishearings ("Alkalizer" / "Alcolizer", "sometime" / "sometimes"). Words
    of three letters or fewer must match exactly, so a leftover "is" or "and"
    is never excused by a nearby "it" or "an"."""
    if x in pool:
        return True
    if len(x) <= 3:
        return False
    return any(len(y) > 3 and difflib.SequenceMatcher(None, x, y).ratio() >= 0.75 for y in pool)


PAD = 0.4  # seconds of silence on the cut side of each clip


def heard(mp4, a, b, tmp, model, tag, side):
    """Transcribe [a, b] of the render on its own. Returns the text and the
    words as (word, start, end) in seconds from a.

    The leftover a cut keeps is often a fragment sitting on the very first
    (or last) sample of the clip, and whisper drops a sound it hears no
    onset for: at one real cut it missed a leftover "was" with the clip
    starting exactly on the cut and heard it with the clip starting 3 ms
    later. So the cut side of the clip gets PAD seconds of silence."""
    wav = os.path.join(tmp, f"{tag}.wav")
    pad = f"adelay={int(PAD * 1000)}:all=1" if side == "start" else f"apad=pad_dur={PAD}"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.3f}", "-t", f"{b - a:.3f}", "-i", mp4,
                    "-vn", "-ac", "1", "-ar", "16000", "-af", pad, wav], check=True)
    subprocess.run([WHISPER, wav, "--model", model, "--language", "en", "--output_format", "json",
                    "--output_dir", tmp, "--fp16", "False", "--condition_on_previous_text", "False",
                    "--word_timestamps", "True"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    with open(os.path.join(tmp, f"{tag}.json")) as f:
        segs = json.load(f)["segments"]
    text = " ".join(s["text"].strip() for s in segs).strip()
    shift = PAD if side == "start" else 0.0
    ws = [(w["word"].strip(), w["start"] - shift, w["end"] - shift) for s in segs for w in s.get("words", [])]
    return text, ws


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mp4")
    ap.add_argument("segments")
    ap.add_argument("words")
    ap.add_argument("--window", type=float, default=1.6, help="seconds transcribed either side of a cut")
    ap.add_argument("--edge", type=float, default=0.6, help="seconds next to the cut whose words are judged")
    ap.add_argument("--model", default="turbo")
    a = ap.parse_args()

    spec = json.load(open(a.segments))
    fps = spec.get("fps", 30)  # the same default cut.py uses
    segs = spec["segments"]
    words = json.load(open(a.words))
    cuts, t = [], 0.0
    for s in segs:
        t += s["frames"] / fps
        cuts.append(t)

    def caption(lo, hi):
        return [w for w in words if w["end"] > lo + 0.05 and w["start"] < hi - 0.05]

    def tokens(text):
        return [n for n in (norm(x) for x in text.split()) if n]

    flagged = 0
    with tempfile.TemporaryDirectory(prefix="cutcheck-") as tmp:
        for i, c in enumerate(cuts[:-1]):
            print(f"-- cut {i + 1} at {c:6.2f}s edit   (take {i + 1} ends at orig {segs[i]['b']}, take {i + 2} starts at orig {segs[i + 1]['a']})")
            for side, lo, hi in (("end", max(0.0, c - a.window), c), ("start", c, c + a.window)):
                text, hws = heard(a.mp4, lo, hi, tmp, a.model, f"c{i}_{side}", side)
                cap = caption(lo, hi)
                # everything in the window, for "was it there at all"
                h_all = set(tokens(text))
                c_all = set(tokens(" ".join(w["word"] for w in cap)))
                # only what touches the cut is judged
                if side == "end":
                    h_edge = [w for w, s0, e0 in hws if e0 >= (hi - lo) - a.edge]
                    c_edge = [w["word"] for w in cap if w["end"] >= hi - a.edge]
                else:
                    h_edge = [w for w, s0, e0 in hws if s0 <= a.edge]
                    c_edge = [w["word"] for w in cap if w["start"] <= lo + a.edge]
                notes = []
                for x in dict.fromkeys(tokens(" ".join(h_edge))):
                    if not seen(x, c_all):
                        notes.append(f"heard '{x}' next to the cut, not in the captions")
                for x in dict.fromkeys(tokens(" ".join(c_edge))):
                    if not seen(x, h_all):
                        notes.append(f"caption '{x}' next to the cut was not heard")
                if c_all and not h_all:
                    notes.append("heard nothing")
                mark = "  FLAG" if notes else "  ok  "
                flagged += bool(notes)
                print(f"{mark} {side:5}  heard:   {text!r}\n              caption: {' '.join(w['word'] for w in cap)!r}")
                for n in notes:
                    print(f"              -> {n}")
    print(f"\n{len(cuts) - 1} cuts, {flagged} window(s) flagged" + ("; listen to those." if flagged else "."))
    sys.exit(1 if flagged else 0)


if __name__ == "__main__":
    main()
