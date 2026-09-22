#!/usr/bin/env python3
"""Transcribe a talking-head recording with whisper (turbo, word timestamps)
and export the words the Remotion captions need.

    transcribe.py <talk.MOV> --out src/talk/words.json \
        [--cut 12.4] [--end 95.0] [--fix "Cloud=Claude"]... [--model turbo]

Prints a segment table in ORIGINAL-recording seconds (the numbers you plan
beats against), suggests a cut and an end when they are not given, and
writes words.json with times relative to the cut.

What it fixes on the way out, because whisper gets these wrong every time:
  - product names, via --fix OLD=NEW pairs (matched case-sensitively, with
    trailing punctuation preserved); whisper writes "Cloud" for "Claude"
  - hyphen splits: "co" "-founder" becomes one word "co-founder"
  - stutters: an immediate repeat of the same word ("cloud, cloud,") is
    collapsed into one word spanning both
The audio is extracted to 16 kHz mono first so whisper does not choke on
the phone's multi-track container.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

WHISPER = "/opt/anaconda3/bin/whisper"  # openai-whisper CLI on this Mac
STRONG_GREETING = re.compile(r"^(hey|hi|hello|welcome)\b", re.I)
OUTTAKES = re.compile(r"(oh shit|oh no|let's do it again|let's do this again|let me do that again|do it again|one more time|take two|bye\.?$|see you soon|fuck|damn)", re.I)


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def transcribe(src, model):
    tmp = tempfile.mkdtemp(prefix="thead-")
    wav = os.path.join(tmp, "talk.wav")
    run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000", wav])
    print(f"whisper {model} on {wav} ...", file=sys.stderr)
    run([WHISPER, wav, "--model", model, "--language", "en", "--word_timestamps", "True",
         "--output_format", "json", "--output_dir", tmp, "--fp16", "False"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    with open(os.path.join(tmp, "talk.json")) as f:
        return json.load(f)


def suggest_cut(segments):
    """Where the take really starts: the first greeting ("hey everyone",
    "hi, I'm...") that is not a false start and is followed by continuous
    speech. Phone takes begin with dead air and often a muttered restart
    ("okay, let's do it again"), which must not count. Returns seconds with
    a half-second lead so the first word is not clipped."""

    def followed(i):
        return i + 1 < len(segments) and segments[i + 1]["start"] - segments[i]["end"] < 3.0

    real = [(i, s) for i, s in enumerate(segments) if not OUTTAKES.search(s["text"])]
    for i, s in real:
        if STRONG_GREETING.match(s["text"].strip()) and followed(i):
            return max(0.0, round(s["start"] - 0.5, 2))
    for i, s in real:
        if (s["end"] - s["start"]) > 2 and followed(i):
            return max(0.0, round(s["start"] - 0.5, 2))
    return 0.0


def suggest_end(segments):
    """End after the last real sentence, before trailing outtakes."""
    last = None
    for s in segments:
        t = s["text"].strip()
        if not t:
            continue
        if OUTTAKES.search(t) and last is not None:
            break
        last = s
    return round(last["end"] + 1.0, 2) if last else segments[-1]["end"]


def apply_fixes(word, fixes):
    core = word.rstrip(".,!?;:")
    punct = word[len(core):]
    for old, new in fixes:
        if core == old:
            return new + punct
    return word


def export(data, cut, end, fixes):
    words = []
    for s in data["segments"]:
        for w in s.get("words", []):
            if w["start"] < cut or w["end"] > end:
                continue
            words.append({"word": w["word"].strip(), "start": w["start"], "end": w["end"]})
    out = []
    for w in words:
        w = dict(w)
        w["word"] = apply_fixes(w["word"], fixes)
        if out and w["word"].startswith("-"):
            out[-1]["word"] += w["word"]
            out[-1]["end"] = w["end"]
            continue
        if out and out[-1]["word"].rstrip(".,!?").lower() == w["word"].rstrip(".,!?").lower():
            out[-1]["end"] = w["end"]
            out[-1]["word"] = w["word"] if w["word"][-1] in ".,!?" else out[-1]["word"]
            continue
        out.append(w)
    for w in out:
        w["start"] = round(w["start"] - cut, 3)
        w["end"] = round(w["end"] - cut, 3)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--out", required=True, help="words.json path inside the Remotion project")
    ap.add_argument("--cut", type=float, help="original-recording seconds where the edit starts")
    ap.add_argument("--end", type=float, help="original-recording seconds where the edit ends")
    ap.add_argument("--fix", action="append", default=[], help="OLD=NEW word replacement, repeatable")
    ap.add_argument("--model", default="turbo")
    ap.add_argument("--raw", help="reuse an existing whisper json instead of transcribing")
    a = ap.parse_args()

    data = json.load(open(a.raw)) if a.raw else transcribe(a.src, a.model)
    raw_path = a.out.replace(".json", ".whisper.json")
    json.dump(data, open(raw_path, "w"))
    segs = [s for s in data["segments"] if s["text"].strip()]

    print("\n  start    end   text   (original-recording seconds)")
    for s in segs:
        print(f"{s['start']:7.2f} {s['end']:7.2f}  {s['text'].strip()}")

    cut = a.cut if a.cut is not None else suggest_cut(segs)
    end = a.end if a.end is not None else suggest_end(segs)
    fixes = [tuple(f.split("=", 1)) for f in a.fix]
    words = export(data, cut, end, fixes)
    json.dump(words, open(a.out, "w"))

    print(f"\ncut={cut}  end={end}  duration={end - cut:.2f}s  frames@30={round((end - cut) * 30)}")
    print(f"{len(words)} words -> {a.out}   (raw whisper json kept at {raw_path})")
    print("\ncaption text:\n" + " ".join(w["word"] for w in words))
    if not a.cut or not a.end:
        print("\n(cut/end were suggested; check them against the table and rerun with --cut/--end --raw", raw_path, ")")


if __name__ == "__main__":
    main()
