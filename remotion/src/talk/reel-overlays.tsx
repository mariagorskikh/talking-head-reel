import React from "react";
import {
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Card, Chip, FONT, MONO, Shadow, Word, ease } from "./overlays";

// Overlay grammar for the VERTICAL (1080x1920) talking-head reel. The
// speaker is centred and fills the width, so there is no side column:
// cards live in a band between the chin and the captions, captions sit
// above the Instagram UI, and everything is short-lived.

export const REEL_W = 1080;
export const REEL_H = 1920;
export const CARD_X = 60; // cards keep clear of the IG action icons on the right (x > 940)
export const CARD_W = 870;
export const CARD_Y = 990; // below the chin at the strongest push-in
export const CAP_BOTTOM = 450; // captions bottom edge at y 1470, above the IG caption/audio strip
export const ACCENT = "#FFD166";
export const RED = "#FF453A";

// One sound effect at an edit frame.
export const Sfx: React.FC<{ at: number; src: string; vol?: number }> = ({ at, src, vol = 0.4 }) => (
  <Sequence from={at} durationInFrames={30} layout="none">
    <Audio src={staticFile(`sfx/${src}`)} volume={vol} />
  </Sequence>
);

// Word-timed captions for the vertical frame: three words at a time or up
// to punctuation, wrapped inside a 900 px pill, the spoken word bright and
// the current word in the accent colour.
export const ReelCaptions: React.FC<{ words: Word[]; groupSize?: number; size?: number; bottom?: number }> = ({
  words,
  groupSize = 3,
  size = 66,
  bottom = CAP_BOTTOM,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const groups: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    const punct = /[.?!,]$/.test(w.word.trim());
    if (cur.length >= groupSize || punct) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  const g = groups.find((gr) => t >= gr[0].start - 0.05 && t < gr[gr.length - 1].end + 0.3);
  if (!g) return null;
  const gStart = g[0].start - 0.05;
  const a = ease(t, gStart, gStart + 0.1);
  const current = [...g].reverse().find((w) => t >= w.start - 0.02);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom,
        display: "flex",
        justifyContent: "center",
        fontFamily: FONT,
        opacity: a,
        transform: `translateY(${(1 - a) * 14}px) scale(${0.96 + 0.04 * a})`,
      }}
    >
      <div
        style={{
          background: "rgba(12,12,14,0.88)",
          borderRadius: 22,
          padding: "16px 32px",
          fontSize: size,
          fontWeight: 800,
          letterSpacing: -0.5,
          lineHeight: 1.15,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "4px 16px",
          maxWidth: 900,
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        }}
      >
        {g.map((w, i) => {
          const on = t >= w.start - 0.02;
          const isCur = w === current;
          return (
            <span
              key={i}
              style={{
                color: isCur ? ACCENT : on ? "#fff" : "rgba(255,255,255,0.42)",
                display: "inline-block",
                transform: isCur ? "scale(1.06)" : "none",
              }}
            >
              {w.word.trim()}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// A list that fills in line by line as the speaker lists things, then gets
// a rotated stamp slammed over it and every line struck through. For any
// list the speaker then dismisses.
export const StampList: React.FC<{
  life: number;
  lines: { text: string; at: number; icons?: { src: string; at: number; bg?: string; invert?: boolean }[] }[];
  stamp: string;
  stampAt: number;
  x?: number;
  y?: number;
  w?: number;
}> = ({ life, lines, stamp, stampAt, x = CARD_X, y = CARD_Y, w = CARD_W }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const st = spring({ frame: f - stampAt, fps, config: { damping: 12, stiffness: 220, mass: 0.6 } });
  const stampOn = f >= stampAt;
  return (
    <Card life={life} x={x} y={y} w={w} padding={30} style={{ paddingRight: 40 }}>
      {lines.map((l, i) => {
        const a = interpolate(f - l.at, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const strike = interpolate(f - stampAt - i * 3, [2, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div
            key={l.text}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 42,
              fontWeight: 600,
              opacity: a * (stampOn ? 0.75 : 1),
              transform: `translateX(${(1 - a) * 24}px)`,
              marginTop: i === 0 ? 0 : 14,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.45)", fontFamily: MONO, fontSize: 30 }}>{String(i + 1).padStart(2, "0")}</span>
            <span>{l.text}</span>
            {(l.icons ?? []).map((ic) => {
              const ia = spring({ frame: f - ic.at, fps, config: { damping: 12, stiffness: 200, mass: 0.6 } });
              return (
                <span
                  key={ic.src}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 11,
                    background: ic.bg ?? "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 8,
                    boxSizing: "border-box",
                    opacity: f >= ic.at ? ia : 0,
                    transform: `scale(${0.5 + 0.5 * ia})`,
                    marginLeft: 2,
                  }}
                >
                  <Img src={staticFile(ic.src)} style={{ width: "100%", height: "100%", objectFit: "contain", filter: ic.invert ? "invert(1)" : undefined }} />
                </span>
              );
            })}
            <div
              style={{
                position: "absolute",
                left: -6,
                top: "50%",
                height: 5,
                width: `${strike * 104}%`,
                background: RED,
                borderRadius: 3,
                transform: "translateY(-50%) rotate(-1.5deg)",
              }}
            />
          </div>
        );
      })}
      {stampOn ? (
        <div
          style={{
            position: "absolute",
            right: 30,
            top: -34,
            padding: "10px 26px",
            border: `6px solid ${RED}`,
            borderRadius: 16,
            color: RED,
            fontSize: 64,
            fontWeight: 900,
            letterSpacing: 4,
            textTransform: "uppercase",
            transform: `rotate(-9deg) scale(${1.8 - 0.8 * st})`,
            opacity: st,
            background: "rgba(18,18,20,0.85)",
            boxShadow: Shadow,
          }}
        >
          {stamp}
        </div>
      ) : null}
    </Card>
  );
};

// A quote card: a small header (who said it), lines that appear as the
// speaker quotes them, and a final line in the accent colour that lands hard.
export const QuoteCard: React.FC<{
  life: number;
  header: string;
  headerIcon?: string;
  headerIconBg?: string;
  lines: { text: string; at: number; big?: boolean; sub?: boolean }[];
  x?: number;
  y?: number;
  w?: number;
}> = ({ life, header, headerIcon, headerIconBg, lines, x = CARD_X, y = CARD_Y, w = CARD_W }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Card life={life} x={x} y={y} w={w} padding={30}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, color: "rgba(255,255,255,0.6)", fontSize: 28, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>
        {headerIcon ? (
          <span style={{ width: 44, height: 44, borderRadius: 10, background: headerIconBg ?? "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 6, boxSizing: "border-box" }}>
            <Img src={staticFile(headerIcon)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </span>
        ) : null}
        {header}
      </div>
      {lines.map((l) => {
        const s = spring({ frame: f - l.at, fps, config: { damping: l.big ? 11 : 14, stiffness: l.big ? 210 : 160, mass: 0.7 } });
        const on = f >= l.at;
        return (
          <div
            key={l.text}
            style={{
              fontSize: l.big ? 60 : l.sub ? 30 : 40,
              fontWeight: l.big ? 800 : l.sub ? 500 : 600,
              color: l.big ? ACCENT : l.sub ? "rgba(255,255,255,0.7)" : "#fff",
              letterSpacing: l.big ? -2 : 0,
              lineHeight: 1.15,
              marginTop: l.sub ? 6 : 12,
              opacity: on ? s : 0,
              transform: `translateY(${(1 - s) * 18}px) scale(${l.big ? 0.9 + 0.1 * s : 1})`,
              transformOrigin: "0 50%",
            }}
          >
            {l.text}
          </div>
        );
      })}
    </Card>
  );
};

// Big text that gets struck through a moment later ("not about AI agents").
export const StrikeBig: React.FC<{ life: number; text: string; strikeAt: number; x?: number; y?: number; size?: number }> = ({
  life,
  text,
  strikeAt,
  x = CARD_X,
  y = CARD_Y,
  size = 96,
}) => {
  const f = useCurrentFrame();
  const p = interpolate(f - strikeAt, [0, 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const xs = spring({ frame: f - strikeAt - 4, fps: 30, config: { damping: 10, stiffness: 240, mass: 0.5 } });
  return (
    <Card life={life} x={x} y={y} padding={32} style={{ paddingLeft: 44, paddingRight: 44 }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ fontSize: size, fontWeight: 800, letterSpacing: -size * 0.04, lineHeight: 1, whiteSpace: "nowrap", opacity: 1 - 0.45 * p }}>{text}</div>
        <div style={{ position: "absolute", left: -8, top: "50%", height: 8, width: `${p * 100}%`, maxWidth: "calc(100% - 100px)", background: RED, borderRadius: 4, transform: "translateY(-50%) rotate(-3deg)" }} />
        <div style={{ fontSize: size * 0.9, fontWeight: 900, color: RED, opacity: f >= strikeAt + 4 ? xs : 0, transform: `scale(${0.4 + 0.6 * xs}) rotate(${(1 - xs) * 30}deg)` }}>✗</div>
      </div>
    </Card>
  );
};

// A mono "tree" card for a file path that appears line by line.
export const TreeCard: React.FC<{ life: number; title: string; lines: string[]; stagger?: number; x?: number; y?: number; w?: number }> = ({
  life,
  title,
  lines,
  stagger = 4,
  x = CARD_X,
  y = CARD_Y,
  w = CARD_W,
}) => {
  const f = useCurrentFrame();
  return (
    <Card life={life} x={x} y={y} w={w} padding={30}>
      <div style={{ fontSize: 28, color: "rgba(255,255,255,0.6)", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>{title}</div>
      {lines.map((l, i) => {
        const a = interpolate(f - 6 - i * stagger, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={l} style={{ fontFamily: MONO, fontSize: 38, fontWeight: 600, whiteSpace: "pre", opacity: a, transform: `translateX(${(1 - a) * 16}px)`, marginTop: 6 }}>
            {l}
          </div>
        );
      })}
    </Card>
  );
};

// A prompt being typed into a terminal-looking card, with a cursor and soft
// key ticks, and an optional second line that lands later.
export const PromptCard: React.FC<{
  life: number;
  prompt: string;
  cps?: number; // characters per second
  startAt?: number;
  after?: { text: string; at: number };
  x?: number;
  y?: number;
  w?: number;
}> = ({ life, prompt, cps = 42, startAt = 4, after, x = CARD_X, y = CARD_Y, w = CARD_W }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.max(0, Math.min(prompt.length, Math.floor(((f - startAt) / fps) * cps)));
  const done = n >= prompt.length;
  const cursorOn = Math.floor(f / 8) % 2 === 0 || !done;
  const ticks: number[] = [];
  for (let c = 6; c < prompt.length; c += 7) ticks.push(startAt + Math.round((c / cps) * fps));
  const afterA = after ? spring({ frame: f - after.at, fps, config: { damping: 13, stiffness: 190, mass: 0.6 } }) : 0;
  return (
    <Card life={life} x={x} y={y} w={w} padding={30} style={{ background: "rgba(10,10,12,0.95)", border: "1px solid rgba(255,255,255,0.12)" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 18, height: 18, borderRadius: 999, background: c, display: "inline-block" }} />
        ))}
        <span style={{ marginLeft: 12, fontFamily: MONO, fontSize: 24, color: "rgba(255,255,255,0.5)" }}>claude</span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 34, lineHeight: 1.35, color: "#fff", minHeight: 34 * 1.35 * 3 }}>
        <span style={{ color: "#34c759" }}>&gt; </span>
        {prompt.slice(0, n)}
        <span style={{ opacity: cursorOn ? 1 : 0, color: ACCENT }}>▍</span>
      </div>
      {after ? (
        <div style={{ fontFamily: MONO, fontSize: 32, color: ACCENT, marginTop: 14, opacity: f >= after.at ? afterA : 0, transform: `translateY(${(1 - afterA) * 14}px)` }}>
          {after.text}
        </div>
      ) : null}
      {ticks.map((t) => (
        <Sfx key={t} at={t} src="tick.wav" vol={0.22} />
      ))}
    </Card>
  );
};

// A blinking REC badge with a running timer, for "recording", "filming",
// "here I am on camera".
export const RecBadge: React.FC<{ life: number; x?: number; y?: number }> = ({ life, x = 720, y = 300 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 14, stiffness: 180, mass: 0.6 } });
  const exit = interpolate(f, [life - 8, life], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const blink = Math.floor(f / 15) % 2 === 0;
  const s = f / fps;
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(Math.floor(s % 60)).padStart(2, "0");
  const ff = String(f % fps).padStart(2, "0");
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 22px",
        borderRadius: 16,
        background: "rgba(18,18,20,0.9)",
        color: "#fff",
        fontFamily: MONO,
        fontSize: 34,
        fontWeight: 700,
        whiteSpace: "nowrap",
        boxShadow: Shadow,
        opacity: Math.min(enter, exit),
        transform: `scale(${0.8 + 0.2 * enter})`,
      }}
    >
      <span style={{ width: 22, height: 22, borderRadius: 999, background: RED, opacity: blink ? 1 : 0.25, boxShadow: blink ? `0 0 16px ${RED}` : undefined }} />
      REC {mm}:{ss}:{ff}
    </div>
  );
};

// A row of polaroid-style stills from the other takes ("a few tries").
export const Takes: React.FC<{ life: number; stills: { src: string; label: string; at: number; tilt?: number }[]; x?: number; y?: number; w?: number }> = ({
  life,
  stills,
  x = CARD_X,
  y = CARD_Y,
  w = 200,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = interpolate(f, [life - 8, life], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: x, top: y, display: "flex", gap: 26, fontFamily: FONT }}>
      {stills.map((s, i) => {
        const e = spring({ frame: f - s.at, fps, config: { damping: 11, stiffness: 200, mass: 0.6 } });
        const a = f < s.at ? 0 : Math.min(e, exit);
        return (
          <div
            key={s.src}
            style={{
              width: w,
              padding: 10,
              paddingBottom: 12,
              background: "#fff",
              borderRadius: 10,
              boxShadow: Shadow,
              opacity: a,
              transform: `rotate(${s.tilt ?? (i % 2 ? 3 : -4)}deg) scale(${0.6 + 0.4 * e}) translateY(${(1 - e) * 30}px)`,
            }}
          >
            <Img src={staticFile(s.src)} style={{ width: "100%", display: "block", borderRadius: 4 }} />
            <div style={{ textAlign: "center", fontSize: 26, fontWeight: 700, color: "#111", marginTop: 8, fontFamily: MONO }}>{s.label}</div>
            <Sequence from={s.at} durationInFrames={20} layout="none">
              <Audio src={staticFile("sfx/pop.wav")} volume={0.3} />
            </Sequence>
          </div>
        );
      })}
    </div>
  );
};

// GitHub card for a repo that is being published: mark, title, and a
// bouncing "link below" arrow. Set `repo` once the repo exists.
export const GitHubCard: React.FC<{ life: number; title: string; sub: string; repo?: string; x?: number; y?: number; w?: number }> = ({ life, title, sub, repo, x = CARD_X, y = CARD_Y, w = CARD_W }) => {
  const f = useCurrentFrame();
  const bounce = Math.sin(f / 5) * 6;
  return (
    <Card life={life} x={x} y={y} w={w} padding={30} style={{ background: "#0d1117", border: "1px solid #30363d" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Img src={staticFile("icons/github.svg")} style={{ width: 72, height: 72, filter: "invert(1)" }} />
        <div>
          <div style={{ fontSize: 48, fontWeight: 700, color: "#e6edf3", letterSpacing: -1 }}>{title}</div>
          <div style={{ fontSize: 28, color: "#8b949e", marginTop: 4 }}>{repo ?? sub}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18, color: ACCENT, fontSize: 36, fontWeight: 700 }}>
        <span style={{ display: "inline-block", transform: `translateY(${bounce}px)` }}>↓</span> link below
      </div>
    </Card>
  );
};

// End card over the frozen last frame.
export const EndCard: React.FC<{ life: number; name: string; line: string; url: string; repo?: string }> = ({ life, name, line, url, repo }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 4, fps, config: { damping: 14, stiffness: 150, mass: 0.8 } });
  const dim = interpolate(f, [0, 12], [0, 0.55], { extrapolateRight: "clamp" });
  void life;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${dim})` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, display: "flex", flexDirection: "column", alignItems: "center", gap: 26, fontFamily: FONT, opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>
        <div style={{ background: "rgba(255,255,255,0.97)", color: "#111", borderRadius: 30, padding: "40px 50px", boxShadow: Shadow, textAlign: "center", width: 900, boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
            <Img src={staticFile("icons/github.svg")} style={{ width: 70, height: 70 }} />
            <div style={{ fontFamily: MONO, fontSize: 60, fontWeight: 700, letterSpacing: -2 }}>{name}</div>
          </div>
          <div style={{ fontSize: 34, color: "#555", marginTop: 16, fontWeight: 500 }}>{line}</div>
          {repo ? <div style={{ fontFamily: MONO, fontSize: 28, color: "#111", marginTop: 18, fontWeight: 600, background: "#f1f1f3", borderRadius: 12, padding: "10px 16px", display: "inline-block", whiteSpace: "nowrap" }}>{repo}</div> : null}
          <div style={{ fontSize: 40, color: "#111", marginTop: 22, fontWeight: 800 }}>↓ link below</div>
        </div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 30, fontWeight: 600, letterSpacing: 1 }}>{url}</div>
      </div>
    </>
  );
};

// ---- the top-right "reaction" slot: next to the head, on the wall ----
// A big logo that appears on its name and is gone a second later.
export const REACT_X = 750;
export const REACT_Y = 270;
export const BigLogo: React.FC<{ life: number; src: string; bg?: string; size?: number; pad?: number; x?: number; y?: number; invert?: boolean }> = ({
  life,
  src,
  bg = "#fff",
  size = 300,
  pad = 0,
  x = REACT_X,
  y = REACT_Y,
  invert,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 9, stiffness: 190, mass: 0.7 } });
  const exit = interpolate(f, [life - 7, life], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const sc = enter * exit;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: bg,
        boxShadow: Shadow,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: pad,
        boxSizing: "border-box",
        opacity: Math.min(1, sc * 1.5),
        transform: `scale(${sc}) rotate(${(1 - enter) * -14}deg)`,
        transformOrigin: "50% 50%",
      }}
    >
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "contain", filter: invert ? "invert(1)" : undefined }} />
      <Sequence from={0} durationInFrames={20} layout="none">
        <Audio src={staticFile("sfx/pop.wav")} volume={0.4} />
      </Sequence>
    </div>
  );
};

// A big emoji with no background, popping in with a wobble.
export const BigEmoji: React.FC<{ life: number; emoji: string; size?: number; x?: number; y?: number }> = ({ life, emoji, size = 300, x = REACT_X, y = REACT_Y }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 8, stiffness: 170, mass: 0.7 } });
  const exit = interpolate(f, [life - 7, life], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const wobble = Math.sin(f / 2.2) * 6 * Math.max(0, 1 - f / 14);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.82,
        lineHeight: 1,
        opacity: Math.min(1, enter * exit * 1.5),
        transform: `scale(${enter * exit}) rotate(${wobble}deg)`,
        transformOrigin: "50% 60%",
        filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.35))",
      }}
    >
      {emoji}
      <Sequence from={0} durationInFrames={20} layout="none">
        <Audio src={staticFile("sfx/pop.wav")} volume={0.4} />
      </Sequence>
    </div>
  );
};

// A meme image in the reaction slot: white border, slight tilt, pop in,
// shrink out. Width fixed, height follows the image.
export const Meme: React.FC<{ life: number; src: string; w?: number; x?: number; y?: number; tilt?: number; delay?: number }> = ({
  life,
  src,
  w = 280,
  x = REACT_X,
  y = REACT_Y,
  tilt = -4,
  delay = 0,
}) => {
  const f = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 10, stiffness: 200, mass: 0.7 } });
  const exit = interpolate(f, [life - delay - 7, life - delay], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const sc = f < 0 ? 0 : enter * exit;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        padding: 8,
        background: "#fff",
        borderRadius: 14,
        boxShadow: Shadow,
        opacity: Math.min(1, sc * 1.5),
        transform: `scale(${sc}) rotate(${tilt + (1 - enter) * 16}deg)`,
        transformOrigin: "50% 40%",
      }}
    >
      <Img src={staticFile(src)} style={{ width: "100%", display: "block", borderRadius: 8 }} />
      <Sequence from={delay} durationInFrames={20} layout="none">
        <Audio src={staticFile("sfx/pop.wav")} volume={0.35} />
      </Sequence>
    </div>
  );
};

// Two or three big chips that bounce in and keep floating, for the close.
export const HeroChips: React.FC<{ life: number; chips: Chip[]; size?: number; x?: number; y?: number; gap?: number }> = ({ life, chips, size = 220, x = CARD_X, y = CARD_Y, gap = 40 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = interpolate(f, [life - 10, life], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: x, top: y, display: "flex", gap, fontFamily: FONT }}>
      {chips.map((c, i) => {
        const at = c.at ?? i * 10;
        const t = f - at;
        const enter = spring({ frame: t, fps, config: { damping: 8, stiffness: 160, mass: 0.8 } });
        const floatY = Math.sin(t / 9 + i) * 9;
        const rot = Math.sin(t / 13 + i * 2) * 4;
        const a = t < 0 ? 0 : Math.min(enter, exit);
        return (
          <div key={c.label} style={{ opacity: a, transform: `scale(${0.4 + 0.6 * enter}) translateY(${(1 - enter) * 60 + floatY}px) rotate(${rot}deg)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ width: size, height: size, borderRadius: size * 0.24, background: c.bg ?? "#fff", boxShadow: Shadow, display: "flex", alignItems: "center", justifyContent: "center", padding: c.pad ?? size * 0.2, boxSizing: "border-box" }}>
              {c.src ? <Img src={staticFile(c.src)} style={{ width: "100%", height: "100%", objectFit: "contain", filter: c.invert ? "invert(1)" : undefined }} /> : c.text}
            </div>
            {c.label ? (
              <div style={{ fontSize: 36, fontWeight: 700, color: "#111", background: "rgba(255,255,255,0.92)", padding: "8px 22px", borderRadius: 16, boxShadow: "0 4px 14px rgba(0,0,0,0.12)", whiteSpace: "nowrap" }}>{c.label}</div>
            ) : null}
            <Sequence from={at} durationInFrames={20} layout="none">
              <Audio src={staticFile("sfx/pop.wav")} volume={0.42} />
            </Sequence>
          </div>
        );
      })}
    </div>
  );
};
