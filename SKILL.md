---
name: talking-head-reel
description: Turn a long, messy phone recording of one person talking to camera (every line taken several times, false starts, pauses, "okay, again") into a vertical Instagram / TikTok / Shorts reel, about a minute long, with the best take of each sentence, snap zooms on the cuts, word-timed captions, and animated overlays that amplify what the speaker says (logo chips as they name things, numbers as big callouts, lists that get stamped, a quote card, a typed prompt, polaroids of the other takes, memes, an end card). Use whenever the user hands over a portrait phone recording (IMG_xxxx.MOV) and says "edit this for Instagram", "make a reel", "vertical", "I did a lot of retakes, pick the best parts", "remove the duplicates and pauses", "add animations and zoom in and out", "make it entertaining", or wants a re-cut of a previous reel ("swap the closing take", "change the callout at 0:40", "add music"). Not for landscape walkthroughs with a screen recording.
---

# Talking-head reel

The raw material is one person on a phone, portrait, talking to camera for
five minutes to get ninety seconds of usable speech: every sentence is said
two or three times, the best version is usually the last, and the file ends
with an outtake. The deliverable is a 1080x1920 reel of the best take of
each sentence, cut on word boundaries, with framing snaps on every cut so
the jump cuts read as a style, and overlays that land on the word they
illustrate. Nothing on screen says anything the speaker did not say; it
makes what they said visible.

`assets/Reel.example.tsx` and `assets/reel-segments.example.json` are a
placeholder timeline built on the timings of a fictional recording, so
they compile and show the wiring, the pacing and the density; read them
once before planning a new reel. `overlays.tsx` holds the shared `Card`,
`Big`, `LogoRow` and `Word`; `reel-overlays.tsx` holds the vertical
grammar.

The Remotion project is `remotion/` next to this file (`cd remotion &&
npm install` once). Every path below that says `src/`, `public/` or
`out/` is inside it, and the scripts are run from inside it.

## What "good" looks like

The speaker is centred and fills the width. Under the chin, a band of dark
cards that change every few seconds: a row of logo chips popping one per
spoken name, a big number, a numbered list that fills in as things are
listed and then gets a red stamp slammed across it when they are
dismissed, a quote card whose last line lands in the accent colour, a
claim struck through, a terminal typing a prompt, three polaroids of the
other takes, two big logos bouncing at the close. Next to the head,
top-right on the wall, a "reaction slot": a logo that appears big and
alone on its name and is gone a second later, a big background-free emoji
on a feeling, a meme popping in on a punchline. Under the band, three-word
captions with the spoken word in the accent colour. The framing snaps
between 1.0 and 1.1 at every cut and at most sentence starts, and pushes
in slowly on the line that matters. The last frame freezes under an end
card with the thing the speaker wants people to click. All of it above
the Instagram UI.

## The pipeline

```
prep.sh       -> public/talk/ig1080.mp4           (portrait 1080x1920, 30 fps, cheap to seek)
transcribe.py -> words.whisper.json + segment table   (the WHOLE recording, all takes)
choose takes  -> reel-segments.json                 (original seconds, best take per sentence)
cut.py        -> reel-words.json + edit timeline    (captions in edit time, frames per take)
plan          -> beats: original second -> overlay
Reel.tsx      -> Remotion composition (copy assets/reel-overlays.tsx)
stills.sh     -> tiled portrait grids at the key seconds, fix layout
render.sh     -> detached render (~10 min for 80 s)
QA            -> probe, contact sheet, audio check, copy to Desktop, hand over
```

The scripts do the boring steps the same way every time. The creative
work is choosing takes and planning beats.

### 1. Ingest

Probe first, with per-stream (never per-frame) side data: `ffprobe -v
error -select_streams v:0 -show_entries stream_side_data=rotation -of
csv=p=0 <mov> | head -1`. A portrait phone file is a 1920x1080 HEVC stream
with `rotation=90`; ffmpeg rotates before the filter graph, so the scale
target is `1080:1920`. Asking ffprobe for `side_data=rotation` on the
stream entries prints one line per frame forever.

```bash
scripts/prep.sh <IMG_xxxx.MOV> public/talk
```

While it runs, make a contact sheet (`scripts/sheet.sh <mov> 10`) and look
at it for the geometry: where the face sits (the zoom origin), where the
chin is (the top of the card band), where the hands reach (they will be
covered, that is fine), and how bright the wall is (dark cards on a bright
wall). The reel is portrait, so `sheet.sh`'s 5-column tiling is fine at
10 s per tile.

### 2. Transcribe everything

```bash
scripts/transcribe.py <IMG_xxxx.MOV> --out <scratch>/words_all.json \
  --fix "Cloud=Claude" --fix "cloud=Claude"
```

Transcribe the whole file, not a cut of it; the segment table it prints
is the take map. Its suggested cut/end are meaningless here (they assume
one take), ignore them. The raw whisper json it keeps next to the output
is what `cut.py` reads. Whisper mangles product names; fix words with
`--fix` and phrases later with `cut.py --phrase "Claude code=Claude Code"`.

### 3. Choose the takes

Read `references/take-selection.md` the first time. The short version:

- Walk the segment table against the script the speaker meant to say (ask
  for it; people usually have one). Group the lines by sentence; each
  sentence appears two to four times.
- Prefer the take that matches the script, is fluent, and comes later;
  people warm up. A later take with a small stumble loses to an earlier
  clean one only if the stumble is inside the sentence.
- A stretch where several sentences are said in a row without a restart
  is one segment; keep the natural pauses inside it. Only cut where the
  speaker restarted.
- One-liners from an earlier take can be spliced in (a joke that landed
  only once) when the framing matches; check in stills.
- Cut points come from word times: start 0.10 to 0.15 s before the first
  word, end 0.20 to 0.30 s after the last word. A whisper word that spans
  a pause (a "but" that lasts three seconds) hides where the sound is; run
  `silencedetect` on that window and start the take just before the sound.
- Lines the speaker did not say in any take do not go in, not even as
  text.
- Aim for 60 to 90 s. Instagram allows more; attention does not.

Write them into `src/talk/reel-segments.json` (`a`, `b`, `note` per take,
`outro` seconds for the frozen end card), then:

```bash
scripts/cut.py <scratch>/words_all.whisper.json src/talk/reel-segments.json \
  --words-out src/talk/reel-words.json --fix "cloud=Claude" --phrase "Claude code=Claude Code"
```

It prints the edit timeline (edit start, original a-b, duration, text per
take), rewrites segments.json with frame counts, and writes the captions in
edit seconds. Read the caption text at the bottom; a missing word means a
cut point is inside it.

### 4. Plan the beats

Walk the transcript one sentence at a time and ask what the speaker just
made the viewer imagine, then show that thing, on the word:

| the speaker says | you show |
|---|---|
| a product, company or platform name | its logo chip (`LogoRow`), on the word; a list of names is a row, one chip per word with its own `at` |
| a number or a duration | `Big`, on the number or up to 0.2 s after, with a two-word sub |
| a claim they would put on a website | `Big` with a short sub |
| a list they then dismiss | `StampList`: lines in on each item, stamp and strikes on the dismissal |
| what someone told them | `QuoteCard`: small header (who), lines on each clause, the last one `big` in the accent |
| "not about X" | `StrikeBig`: X pops, then a red line and a ✗ |
| a file, a skill, a repo path | `TreeCard`: mono lines in one by one |
| the prompt or message they typed | `PromptCard`: typed at ~44 cps with key ticks, an `after` line for the punchline |
| "recording", "filming" | `RecBadge`: blinking REC with a timer, top corner |
| "a few tries", "many takes" | `Takes`: three polaroids from the other takes (`ffmpeg -ss` stills, cropped to the face) |
| a name that should land alone | `BigLogo` in the reaction slot, about a second, then gone |
| a feeling | `BigEmoji`: one emoji, no background, big, with a wobble; push in on the speaker at the same time |
| a punchline, a reaction, a wait | `Meme` in the reaction slot: a template from `https://api.imgflip.com/get_memes` (top 100, names and image URLs), downloaded into `public/memes/` (gitignored, never redistributed), 240 to 300 px wide, 1.3 to 2 s, five or six per reel at most |
| "link below", a repo being published | `GitHubCard`; put the real repo name in `repo` once it exists |
| the close, a company and its badge | `HeroChips`: two 220 px chips that bounce in and keep floating |
| the close | `EndCard` over the frozen last frame, held 3 to 3.5 s, with the repo or URL as text |

If a sentence answers none of these, leave it alone; silence in the band
is what makes the next overlay land. Every beat time is an
ORIGINAL-recording second. `E(t)` in `Reel.tsx` maps it to an edit frame
through the takes and throws if `t` was cut, so a beat can never point at
material that is not in the video. A card may span a cut (`from` in one
take, `to` in the next) as long as the takes are in edit order.

### 5. Zoom grammar

Two layers multiplied together, both in `useZoom`:

- `SNAPS`: an instant base framing change, alternating 1.0 and 1.1
  (1.12 for a punchline), at every cut and at most sentence starts inside
  a long take. It turns jump cuts into a rhythm and keeps the frame alive
  in a 25 s continuous take. About one every three to four seconds; a
  soft `tap.wav` on each.
- `PUSHES`: slow push-ins (1.10 to 1.15 over 8 to 16 frames) on the line
  that matters, held to the end of its take or released over 8 frames.
  Four to six per reel.

`transformOrigin` is the face (`50% 29%` for a centred phone take); at
1.15 the chin drops from y 900 to about 950, which is why the card band
starts at `CARD_Y` 990.

### 6. Layout (1080x1920)

Instagram covers the top ~250 px (title), the bottom ~450 px (caption,
audio) and the right ~130 px from y 1000 down (like/comment/share). So:

- Card band: x 60 to 930, y 990 to about 1330. One card or one row at a
  time. Chips at size 130, labels 30 px.
- Reaction slot: x 720 to 1040, y 240 to 600, the wall next to the head.
  One thing at a time: a `BigLogo` (280 px, x 720; a 300 px one overshoots
  the frame edge on its spring), a `BigEmoji` (400 px box, x 690, it may
  brush the hair, that is fine without a background), a `Meme` (240 to
  300 px wide). The REC badge moves to the top-left (x 60) when the slot is
  taken.
- Captions: `ReelCaptions`, three words or up to punctuation, 66 px,
  bottom edge at y 1470 (`CAP_BOTTOM` 450), wrapped inside 900 px.
- End card centred at y 640 over a 55 percent dim; a repo line in mono at
  28 px with `whiteSpace: nowrap`, or it wraps at the hyphen.

Details and the measured geometry are in `references/layout.md`.

### 7. Check stills, then render

```bash
scripts/stills.sh TalkReel src/talk/reel-segments.json 12.7 14.8 22.6 25.9 58.3
```

One original second per beat (its landing moment), plus one per cut
(first frame of the new take) to see the framing change, plus
`npx remotion still src/index.ts TalkReel out/reel/f_outro.png
--frame=<last-10>` for the end card. Look for: a card on the chin, a row
wider than 870 px, a caption group colliding with the polaroids, a badge
wrapping to two lines, a chip label that should be empty, a beat that
lands after the sentence.

```bash
scripts/render.sh TalkReel out/talk-reel.mp4
```

Detached, log in `out/reel/render.log`; 2500 portrait frames with one
OffthreadVideo source render at about 4 fps, 10 minutes. Watch the log
for `Rendered N/M`, any `error`, and the process going away
(`pgrep -f "[r]emotion render"`, the bracket keeps the pattern from
matching itself).

If the log says `ENOSPC: no space left on device` in
`/var/folders/.../react-motion-render*`, the disk is not full of frames:
the machine is swapping (check `sysctl vm.swapusage`) and eight headless
Chromes push the swap files onto the last gigabyte. Check `df -h /` before
every render; under 2 GB free, use

```bash
scripts/render-chunked.sh TalkReel out/talk-reel.mp4 420 2
```

which renders muted 420-frame chunks with two browser tabs, renders the
audio on its own, and joins them with ffmpeg (same log). Your own
leftovers to clear first: `out/reel/f_*.png`, whisper's `thead-*` temp
dirs, and headless Chrome processes older than the session
(`pgrep -fl chrome-headless-shell`). Anything else on the disk belongs to
the user; ask, with sizes, before removing it.

### 8. QA and deliver

Probe (duration = speech + outro, aac stream present), measure loudness
(`ebur128`; speech from a phone lands around -27 LUFS, lift it to about
-16 LUFS with `volume` plus `alimiter`, video stream copied), a contact
sheet at 4 s tiles, and a `silencedetect` pass over the whole output: a
silence longer than 0.8 s inside the speech means a pause that should have
been cut. Copy to `~/Desktop/<name>-reel.mp4`, plus a 720p preview under
30 MB for phones. In the handover, list the takes chosen (original
seconds and why), the beats in plain words, the constants the user might
move, and the obvious follow-ups: music (the platform's own audio library
is the safe choice; a local bed needs a licence check), a different
closing take, the repo name for the GitHub card once it exists.

## Rules that came from getting it wrong

- The whole recording gets transcribed. The takes are chosen from the
  table, never by scrubbing.
- Cut on word times, never on whisper segment times; segments absorb the
  pause before a sentence.
- A word is kept when at least 0.1 s of it (or half of a short word) is
  inside the take. Keeping only words that start inside the take drops
  every "one", "of", "to" near a cut.
- Capitalise the first word of a take only when the previous kept word
  ended a sentence; a sentence can continue across a cut.
- Snap zooms replace crossfades. A crossfade between two takes of the same
  sentence reads as a mistake; a framing change reads as an edit.
- One thing in the card band and one thing in the reaction slot at a
  time, nothing in the first half second of a sentence, everything gone
  0.3 s after the sentence. A meme is a reaction, so it lands on the
  punchline word, never before it.
- When the user asks to cut a line, cut the line and the one that only
  made sense after it; what the line carried moves to the end card as
  text.
- Real numbers, real quotes, the speaker's words. The prompt card shows
  what they actually typed, shortened, not a better prompt.
- No em dashes anywhere in on-screen text.
- `public/talk/` and `public/memes/` are gitignored; the reel needs the
  transcoded recording, the `take_*.png` polaroids and the meme images
  regenerated or re-downloaded to render again.

## Files

- `scripts/prep.sh` portrait transcode for Remotion
- `scripts/sheet.sh` timestamped contact sheet of any video
- `scripts/transcribe.py` whisper turbo to words json, with word fixes
- `scripts/cut.py` takes + whisper json to captions and the edit timeline
- `scripts/stills.sh` render and tile portrait check frames at original seconds, through the takes
- `scripts/render.sh` detached render with log
- `scripts/render-chunked.sh` the same in frame-range chunks with two browser tabs, for a swapping machine
- `assets/reel-overlays.tsx` the vertical components (captions, stamp list, quote card, strike, tree, prompt, REC, polaroids, GitHub card, end card, big logo, big emoji, meme, hero chips), copy into `src/talk/`
- `assets/Reel.example.tsx` a placeholder timeline on fictional timings, the reference for the wiring and pacing
- `assets/reel-segments.example.json` its placeholder cut
- `references/take-selection.md` how to choose takes, with a worked example on a fictional recording
- `references/layout.md` the vertical geometry, the Instagram safe zones, the zoom grammar
