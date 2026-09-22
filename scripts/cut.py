#!/usr/bin/env python3
"""Turn a whisper transcript plus a list of chosen takes into the two files
the Remotion reel composition reads: segments.json (the cut) and
words.json (captions, in EDIT seconds).

    cut.py <whisper.json> <segments.json> --words-out src/talk/reel-words.json \
        [--fix "cloud=Claude"]... [--phrase "Claude code=Claude Code"]...

segments.json is hand-written from the transcript table, in ORIGINAL
recording seconds:

    {
      "fps": 30,
      "outro": 2.5,                       # seconds of frozen last frame after the last take
      "segments": [
        {"a": 10.0, "b": 33.0, "note": "take 1: the launch story"},
        {"a": 48.0, "b": 65.0, "note": "take 2: the close"}
      ]
    }

Words are kept when their start falls inside a segment and remapped to
edit time; a word cut in half by a segment end is clamped to the end. The
script prints the edit timeline (edit start, original a-b, text) so every
beat can be planned against original seconds and checked against edit
seconds, and it fails loudly if segments overlap in edit order or a
segment has no words in it (that usually means a typo in a/b).

Fixes: --fix OLD=NEW replaces a single word (core, punctuation kept,
case-sensitive). --phrase "A B=C D" replaces consecutive words
(case-insensitive on the cores, punctuation of the last word kept).
"""
import argparse
import json
import sys


def core(w):
    return w.rstrip(".,!?;:")


def punct(w):
    return w[len(core(w)):]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("whisper")
    ap.add_argument("segments")
    ap.add_argument("--words-out", required=True)
    ap.add_argument("--fix", action="append", default=[])
    ap.add_argument("--phrase", action="append", default=[])
    a = ap.parse_args()

    data = json.load(open(a.whisper))
    spec = json.load(open(a.segments))
    fps = spec.get("fps", 30)
    segs = spec["segments"]
    for s in segs:
        if s["b"] <= s["a"]:
            sys.exit(f"segment {s} has b <= a")

    all_words = []
    for s in data["segments"]:
        for w in s.get("words", []):
            all_words.append({"word": w["word"].strip(), "start": w["start"], "end": w["end"]})

    fixes = [tuple(f.split("=", 1)) for f in a.fix]
    phrases = []
    for p in a.phrase:
        old, new = p.split("=", 1)
        phrases.append((old.lower().split(), new.split()))

    out = []
    off = 0.0
    print("\n edit-start   orig a  ->  orig b   dur   text")
    for i, s in enumerate(segs):
        a0, b0 = s["a"], s["b"]
        # keep a word when at least 0.1 s of it (or half of a short word) falls
        # inside the take; whisper stretches a word over the pause before it,
        # so a word can "start" before the cut and still be spoken after it
        def inside(w):
            ov = min(w["end"], b0) - max(w["start"], a0)
            return ov > 0 and ov >= min(0.1, 0.5 * (w["end"] - w["start"]))
        ws = [w for w in all_words if inside(w)]
        if not ws:
            sys.exit(f"segment {i} ({a0}-{b0}) contains no words; check a/b against the transcript table")
        # frame-snap the offset so edit seconds and frames agree exactly
        seg_frames = round((b0 - a0) * fps)
        for k, w in enumerate(ws):
            text = w["word"]
            if k == 0 and text[:1].islower() and (not out or punct(out[-1]["word"]) in (".", "?", "!")):
                text = text[:1].upper() + text[1:]  # a take that starts a sentence mid-way still opens its caption
            nw = {
                "word": text,
                "start": round(off + (max(w["start"], a0) - a0), 3),
                "end": round(off + (min(w["end"], b0) - a0), 3),
                "orig": w["start"],
            }
            out.append(nw)
        text = " ".join(w["word"] for w in ws)
        print(f"{off:9.2f}   {a0:7.2f} -> {b0:7.2f}  {b0 - a0:5.2f}   {text[:96]}{'...' if len(text) > 96 else ''}")
        s["editStart"] = round(off, 3)
        s["frames"] = seg_frames
        off += seg_frames / fps

    # single-word fixes
    for w in out:
        for old, new in fixes:
            if core(w["word"]) == old:
                w["word"] = new + punct(w["word"])
    # phrase fixes
    for old, new in phrases:
        n = len(old)
        i = 0
        while i + n <= len(out):
            window = [core(x["word"]).lower() for x in out[i:i + n]]
            if window == old:
                for k in range(n):
                    p = punct(out[i + k]["word"]) if k == n - 1 else ""
                    out[i + k]["word"] = new[k] + p
                i += n
            else:
                i += 1
    # merge hyphen splits and immediate stutters, same as transcribe.py
    merged = []
    for w in out:
        if merged and w["word"].startswith("-"):
            merged[-1]["word"] += w["word"]
            merged[-1]["end"] = w["end"]
            continue
        if merged and core(merged[-1]["word"]).lower() == core(w["word"]).lower() and w["start"] - merged[-1]["end"] < 0.3:
            merged[-1]["end"] = w["end"]
            merged[-1]["word"] = w["word"] if punct(w["word"]) else merged[-1]["word"]
            continue
        merged.append(w)

    total = off + spec.get("outro", 0)
    json.dump(merged, open(a.words_out, "w"))
    spec["totalFrames"] = round(total * fps)
    json.dump(spec, open(a.segments, "w"), indent=2)
    print(f"\n{len(segs)} segments, {off:.2f}s of speech + {spec.get('outro', 0)}s outro = {total:.2f}s = {spec['totalFrames']} frames @ {fps}")
    print(f"{len(merged)} words -> {a.words_out}; segments.json updated with editStart/frames/totalFrames")
    print("\ncaption text:\n" + " ".join(w["word"] for w in merged))


if __name__ == "__main__":
    main()
