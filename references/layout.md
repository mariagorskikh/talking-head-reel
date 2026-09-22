# Vertical layout and zoom grammar

The stage is 1080x1920. There is no empty side of the frame: the speaker
is centred, the shoulders touch both edges, and the only free wall is a
strip above the head that Instagram covers anyway. So the overlays share
the frame with the body, never with the face.

## Measured geometry (phone on a table, speaker seated, face in the upper third)

| feature | y (px, base zoom 1.0) |
|---|---|
| top of hair | 180 |
| eyes | 540 |
| face centre (zoom origin `50% 29%`) | 560 |
| mouth | 810 |
| chin | 900 (about 935 at 1.1, 950 at 1.15) |
| shoulders | 1000 to 1100 |
| hands when gesturing | 1150 to 1700 |
| table edge | 1750 |

Measure a new recording the same way: one frame with a 10x10 grid
(`ffmpeg -vf drawgrid=width=108:height=192`) is enough. If the face sits
lower, move `CARD_Y` down with it; the captions stay where they are.

## Instagram safe zones (Reels, 1080x1920)

- Top 250 px: the "Reels" title and camera icon.
- Bottom 450 px: username, caption, audio strip.
- Right 130 px from about y 1000 to 1500: like, comment, share, more.

Anything important stays inside x 60 to 930, y 250 to 1470.

## The bands

- Card band: `CARD_X` 60, `CARD_W` 870, `CARD_Y` 990. Cards grow
  downward; keep them under 340 px tall (four list lines, a quote card
  with a big line and a sub, a prompt card with three lines of mono, or
  three 200 px polaroids with labels). One card or one row at a time.
- Chip rows: size 130, gap 26, labels 30 px on white pills. Five chips
  are 754 px wide, the widest row that fits.
- Captions: bottom edge at y 1470 (`CAP_BOTTOM` 450), 66 px, weight 800,
  three words or up to punctuation, wrapped inside 900 px, dark pill.
  Spoken words white, the current word in the accent `#FFD166` at 1.06
  scale, unspoken words at 42 percent.
- Reaction slot: x 720 to 1040, y 240 to 600, the wall to the right of
  the head. `BigLogo` 280 px at x 720 (a 300 px one overshoots the frame
  edge at the top of its spring), `BigEmoji` in a 400 px box at x 690
  y 240 (no background, so brushing the hair is fine), `Meme` 240 to
  300 px wide with a white border and a 3 to 5 degree tilt. One at a
  time.
- REC badge or any small tag: top-left, x 60, y 300, when the reaction
  slot is in use; top-right otherwise.
- End card: white card at y 640, 900 px wide, over a 55 percent dim of the
  frozen last frame; a small URL line under it.

## Zoom grammar

`useZoom` multiplies two layers:

1. `SNAPS`, `[originalSecond, baseZoom][]`: a step function. Put one at
   every cut (the first frame of each take) and at most sentence starts
   inside a long take, alternating 1.0 / 1.1; 1.12 for a punchline. About
   one every three to four seconds. Each one gets a `tap.wav` at 0.22.
2. `PUSHES`, `{at, z, up, until, down}`: a slow push-in on the line that
   matters: 1.10 to 1.15 reached over 8 to 16 frames, held `until` a
   second (usually the end of its take) or released over `down` frames.
   Four to six per reel. The last one holds through the outro.

Both are in original-recording seconds and go through `E()`, so a snap
at a cut is written as the take's `a`.

Why snaps and not crossfades: two takes of the same sentence dissolved
into each other look like a mistake; the same two takes with a framing
change between them look like a two-camera shoot.

## Sound

- Chips pop (`pop.wav` 0.28 to 0.30, built into `LogoRow` and `Takes`);
  the big logo, the emoji, memes and hero chips pop a little louder (0.35
  to 0.42).
- Stamps and the big quote line thud (`thud.wav` 0.4 to 0.55).
- The strike-through whooshes (`whoosh.wav` 0.3).
- A win dings (`ding.wav` 0.35).
- Typing ticks every seven characters (`tick.wav` 0.22, inside `PromptCard`).
- Snap zooms tap (`tap.wav` 0.22).
- Audio at every take boundary fades over 2 frames in and 3 frames out
  (the `volume` callback on each `OffthreadVideo`), so cuts do not click.
- No music bed by default: pick a track in the app when posting (reach,
  and no licence question). If one has to be baked in, check its licence
  first and say so in the handover.
