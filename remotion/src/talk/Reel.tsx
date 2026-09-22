import React from "react";
import { AbsoluteFill, Easing, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import segSpec from "./reel-segments.json";
import wordsRaw from "./reel-words.json";
import { Big, FONT, LogoRow, Word } from "./overlays";
import {
  BigEmoji,
  BigLogo,
  CARD_X,
  CARD_Y,
  EndCard,
  GitHubCard,
  Meme,
  QuoteCard,
  ReelCaptions,
  Sfx,
  StrikeBig,
} from "./reel-overlays";

// EXAMPLE timeline for a vertical talking-head reel. The timings below
// belong to a FICTIONAL recording (see reel-segments.json and
// reel-words.json, both placeholders written by hand) so that the file
// compiles and shows the wiring: takes back to back, framing snaps at
// cuts, push-ins on emphasis, one card at a time under the chin, one
// reaction (logo, emoji, meme) at a time next to the head, captions above
// the Instagram UI. Replace the data files with cut.py's output and
// rewrite the beats against your own transcript table.
//
// Every time in this file is a second of the ORIGINAL recording. E() maps
// it to an edit frame through the takes and throws when the second was
// cut, so a beat can never point at material that is not in the video.

const FPS = 30;
const SRC = "talk/ig1080.mp4"; // prep.sh writes it; gitignored
const REPO = "github.com/you/your-repo";
type Seg = { a: number; b: number; frames: number; note?: string };
const SEGS = segSpec.segments as Seg[];
const SPEECH_FRAMES = SEGS.reduce((n, s) => n + s.frames, 0);
const OUTRO_FRAMES = Math.round(segSpec.outro * FPS);
export const REEL_DURATION = SPEECH_FRAMES + OUTRO_FRAMES;
const words = wordsRaw as Word[];

const segStart = (i: number) => SEGS.slice(0, i).reduce((n, s) => n + s.frames, 0);

export const E = (t: number): number => {
  for (let i = 0; i < SEGS.length; i++) {
    const s = SEGS[i];
    if (t >= s.a - 1e-6 && t <= s.b + 1e-6) return segStart(i) + Math.round((t - s.a) * FPS);
  }
  throw new Error(`E(${t}): not inside any take in reel-segments.json`);
};
const rel = (t: number, from: number) => E(t) - E(from);
const life = (from: number, to: number) => E(to) - E(from);

const At: React.FC<{ from: number; to: number; children: React.ReactNode; name?: string }> = ({ from, to, children, name }) => (
  <Sequence from={E(from)} durationInFrames={E(to) - E(from)} name={name} layout="none">
    {children}
  </Sequence>
);

// Snap zooms: an instant change of the base framing at every cut and at
// most sentence starts, alternating 1.0 / 1.1, so jump cuts read as
// deliberate and the frame never sits still for long.
const SNAPS: [number, number][] = [
  [10.0, 1.0],
  [13.4, 1.1],
  [16.0, 1.0],
  [20.2, 1.1],
  [23.6, 1.0],
  [27.6, 1.1],
  [48.0, 1.0],
  [51.4, 1.1],
  [56.8, 1.0],
  [60.0, 1.1],
];
const SNAP_FRAMES = SNAPS.map(([t, z]) => [E(t), z] as [number, number]).sort((p, q) => p[0] - q[0]);

// Slow push-ins on the emphasis, multiplied onto the base framing.
type Push = { at: number; z: number; up?: number; until: number | "end"; down?: number };
const PUSHES: Push[] = [
  { at: 21.8, z: 1.08, up: 8, until: 23.2 }, // "nobody would care"
  { at: 24.0, z: 1.1, up: 10, until: 27.2, down: 8 }, // "fifty people"
  { at: 58.1, z: 1.12, up: 14, until: 59.6 }, // "the boring version first"
  { at: 62.0, z: 1.1, up: 16, until: "end" }, // "Cheers"
];

const useZoom = () => {
  const f = useCurrentFrame();
  let base = 1;
  for (const [fr, z] of SNAP_FRAMES) if (f >= fr) base = z;
  let push = 1;
  for (const p of PUSHES) {
    const a = E(p.at);
    const b = p.until === "end" ? REEL_DURATION : E(p.until);
    const up = p.up ?? 12;
    const down = p.down ?? 0;
    if (f < a || f >= b + down) continue;
    const rise = interpolate(f, [a, a + up], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
    const fall = down > 0 ? interpolate(f, [b, b + down], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : f < b ? 1 : 0;
    push *= 1 + (p.z - 1) * rise * fall;
  }
  return base * push;
};

export const TalkReel: React.FC = () => {
  const zoom = useZoom();
  const last = SEGS[SEGS.length - 1];
  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: FONT }}>
      {/* the speaker: chosen takes back to back, framing snaps at cuts, push-ins on emphasis */}
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "50% 29%" }}>
        {SEGS.map((s, i) => {
          const from = Math.round(s.a * FPS);
          return (
            <Sequence key={i} from={segStart(i)} durationInFrames={s.frames} layout="none" name={`take ${i + 1}`}>
              <OffthreadVideo
                src={staticFile(SRC)}
                startFrom={from}
                endAt={from + s.frames}
                volume={(f) => interpolate(f, [0, 2, s.frames - 3, s.frames - 1], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
                style={{ width: "100%", height: "100%" }}
              />
            </Sequence>
          );
        })}
        <Sequence from={SPEECH_FRAMES} durationInFrames={OUTRO_FRAMES} layout="none" name="outro freeze">
          <Freeze frame={last.frames - 1}>
            <OffthreadVideo src={staticFile(SRC)} startFrom={Math.round(last.a * FPS)} muted style={{ width: "100%", height: "100%" }} />
          </Freeze>
        </Sequence>
      </AbsoluteFill>

      {/* soft camera taps on the snap zooms */}
      {SNAP_FRAMES.slice(1).map(([fr]) => (
        <Sfx key={`snap-${fr}`} at={fr} src="tap.wav" vol={0.22} />
      ))}

      {/* 1. "launching on GitHub": the logo, big, alone, gone a second later */}
      <At from={12.65} to={13.6} name="github">
        <BigLogo life={life(12.65, 13.6)} src="icons/github.svg" bg="#fff" size={280} x={720} pad={40} />
      </At>

      {/* 2. "we shipped in three weeks": a feeling, then the number */}
      <At from={13.45} to={14.6} name="shipped">
        <BigEmoji life={life(13.45, 14.6)} emoji="🚀" size={400} x={690} y={240} />
      </At>
      <At from={14.7} to={16.0} name="3 weeks">
        <Big life={life(14.7, 16.0)} x={CARD_X} y={CARD_Y} text="3 weeks" sub="to ship" size={96} />
      </At>

      {/* 3. a list of numbers: text chips, one per spoken item */}
      <At from={15.95} to={20.1} name="team">
        <LogoRow
          life={life(15.95, 20.1)}
          x={CARD_X}
          y={CARD_Y}
          size={130}
          chips={[
            { text: "2", label: "founders", bg: "#111", fg: "#fff", at: rel(16.0, 15.95) },
            { text: "1", label: "laptop", bg: "#111", fg: "#fff", at: rel(17.27, 15.95) },
            { text: "0", label: "designers", bg: "#111", fg: "#fff", at: rel(18.53, 15.95) },
          ]}
        />
      </At>

      {/* 4. "I thought nobody would care": the claim, then struck through */}
      <At from={21.85} to={23.5} name="nobody cares">
        <StrikeBig life={life(21.85, 23.5)} text="nobody cares" strikeAt={rel(22.5, 21.85)} />
      </At>
      <Sfx at={E(22.5)} src="whoosh.wav" vol={0.3} />

      {/* 5. "fifty people signed up on day one": the number, and a reaction */}
      <At from={24.1} to={27.4} name="50 people">
        <Big life={life(24.1, 27.4)} x={CARD_X} y={CARD_Y} text="50 people" sub="on day one" size={96} />
      </At>
      <At from={25.0} to={27.4} name="meme">
        {/* memes are downloaded at edit time into public/memes/ (gitignored); see SKILL.md */}
        <Meme life={life(25.0, 27.4)} src="memes/pikachu.jpg" w={280} tilt={4} />
      </At>

      {/* 6. "Instagram, X and LinkedIn": a chip on each name */}
      <At from={30.3} to={33.0} name="social">
        <LogoRow
          life={life(30.3, 33.0)}
          x={CARD_X}
          y={CARD_Y}
          size={130}
          chips={[
            { src: "icons/instagram.svg", label: "Instagram", at: rel(30.38, 30.3), bg: "linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)", invert: true, pad: 28 },
            { src: "icons/x.svg", label: "X", at: rel(30.93, 30.3), bg: "#000", invert: true, pad: 32 },
            { src: "icons/linkedin.svg", label: "LinkedIn", at: rel(32.04, 30.3), bg: "#0A66C2", invert: true, pad: 30 },
          ]}
        />
      </At>

      {/* 7-10. "what I would do differently": a quote card, the last line lands */}
      <At from={48.4} to={60.0} name="next time">
        <QuoteCard
          life={life(48.4, 60.0)}
          header="next time"
          lines={[
            { text: "post before you feel ready", at: rel(51.4, 48.4) },
            { text: "talk to every user", at: rel(54.2, 48.4) },
            { text: "ship the boring version first.", at: rel(58.2, 48.4), big: true },
          ]}
        />
      </At>
      <Sfx at={E(58.2)} src="thud.wav" vol={0.5} />

      {/* 11. "link below" */}
      <At from={60.0} to={62.0} name="link">
        <GitHubCard life={life(60.0, 62.0)} title="open source" sub="the launch checklist" />
      </At>

      {/* 12. "Cheers": a reaction that runs into the outro */}
      <Sequence from={E(62.0)} durationInFrames={45} layout="none" name="cheers">
        <Meme life={45} src="memes/cheers.jpg" w={300} tilt={4} />
      </Sequence>

      {/* outro on the frozen last frame */}
      <Sequence from={SPEECH_FRAMES} durationInFrames={OUTRO_FRAMES} layout="none" name="end card">
        <EndCard life={OUTRO_FRAMES} name="your-repo" line="one line about what it is" repo={REPO} url="yoursite.com" />
      </Sequence>

      <ReelCaptions words={words} />
    </AbsoluteFill>
  );
};

// Components not used above, all in reel-overlays.tsx:
//   <StampList lines={[{text, at, icons?}]} stamp="myths" stampAt={...} />   a list that fills in, then gets stamped and struck
//   <TreeCard title="the skill" lines={[".claude/skills/", "└─ name/"]} />       mono lines in one by one (a path, a file tree)
//   <PromptCard prompt="..." startAt={...} cps={44} after={{text, at}} />        a terminal typing what the speaker typed
//   <RecBadge life={...} x={60} />                                               blinking REC with a timer, for "recording"
//   <Takes stills={[{src: "talk/take_12.0.png", label: "try 1", at}]} />         polaroids of the other takes (ffmpeg -ss stills)
//   <HeroChips chips={[{src, label, bg, pad, at}]} size={220} />                  two big chips that bounce in and float, for the close
