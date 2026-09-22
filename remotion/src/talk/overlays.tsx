import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Shared visual grammar for the talking-head overlays: dark cards with a
// soft shadow and large type, meant for a bright wall behind the speaker.

export const FONT = "Geist, ui-sans-serif, system-ui, -apple-system, sans-serif";
export const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, monospace";

export const ease = (t: number, from: number, to: number, a = 0, b = 1) =>
  interpolate(t, [from, to], [a, b], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

// Enter/exit envelope for an element that lives from frame 0 to `life`.
export const useEnvelope = (life: number, inDur = 10, outDur = 8) => {
  const t = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: t, fps, config: { damping: 14, stiffness: 160, mass: 0.7 } });
  const exit = interpolate(t, [life - outDur, life], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  void inDur;
  return { t, enter, exit, alpha: Math.min(enter, exit) };
};

export const Shadow = "0 30px 80px rgba(0,0,0,0.35), 0 6px 18px rgba(0,0,0,0.18)";

// A dark rounded card that pops in from slightly below and fades out.
export const Card: React.FC<{
  life: number;
  x: number;
  y: number;
  w?: number;
  children: React.ReactNode;
  padding?: number;
  light?: boolean;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ life, x, y, w, children, padding = 28, light, delay = 0, style }) => {
  const t = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  const enter = spring({ frame: t, fps, config: { damping: 15, stiffness: 170, mass: 0.7 } });
  const exit = interpolate(t, [life - delay - 8, life - delay], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const a = t < 0 ? 0 : Math.min(enter, exit);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        padding,
        borderRadius: 26,
        background: light ? "rgba(255,255,255,0.96)" : "rgba(18,18,20,0.94)",
        color: light ? "#111" : "#fff",
        boxShadow: Shadow,
        fontFamily: FONT,
        opacity: a,
        transform: `translateY(${(1 - enter) * 40}px) scale(${0.92 + 0.08 * enter})`,
        transformOrigin: "50% 100%",
        backdropFilter: "blur(10px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Big keyword. Used for "40 seconds", "$1 / month", "one command".
export const Big: React.FC<{
  life: number;
  x: number;
  y: number;
  text: string;
  sub?: string;
  size?: number;
  accent?: string;
  delay?: number;
}> = ({ life, x, y, text, sub, size = 120, accent = "#fff", delay = 0 }) => (
  <Card life={life} x={x} y={y} padding={32} delay={delay} style={{ paddingLeft: 44, paddingRight: 44 }}>
    <div style={{ fontSize: size, fontWeight: 700, letterSpacing: -size * 0.04, lineHeight: 1, color: accent, whiteSpace: "nowrap" }}>
      {text}
    </div>
    {sub ? (
      <div style={{ fontSize: size * 0.3, color: "rgba(255,255,255,0.7)", marginTop: 10, fontWeight: 500 }}>{sub}</div>
    ) : null}
  </Card>
);

// A row of logo chips. Each chip can name its own entry frame (`at`,
// relative to the row's Sequence) so they land on the spoken word.
export type Chip = { src?: string; text?: string; label: string; bg?: string; pad?: number; invert?: boolean; at?: number; fg?: string };
export const LogoRow: React.FC<{
  life: number;
  x: number;
  y: number;
  chips: Chip[];
  stagger?: number;
  size?: number;
  vertical?: boolean;
}> = ({ life, x, y, chips, stagger = 9, size = 150, vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        display: "flex",
        flexDirection: vertical ? "column" : "row",
        gap: 26,
        fontFamily: FONT,
      }}
    >
      {chips.map((c, i) => {
        const t = frame - (c.at ?? i * stagger);
        const enter = spring({ frame: t, fps, config: { damping: 12, stiffness: 190, mass: 0.6 } });
        const exit = interpolate(frame, [life - 10, life], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const a = t < 0 ? 0 : Math.min(enter, exit);
        return (
          <div
            key={c.label}
            style={{
              opacity: a,
              transform: `scale(${0.6 + 0.4 * enter}) translateY(${(1 - enter) * 30}px)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: size,
                height: size,
                borderRadius: size * 0.24,
                background: c.bg ?? "#fff",
                boxShadow: c.bg === "transparent" ? undefined : Shadow,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: c.pad ?? size * 0.2,
                boxSizing: "border-box",
                color: c.fg ?? "#111",
                fontFamily: MONO,
                fontSize: size * 0.34,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {c.src ? (
                <Img
                  src={staticFile(c.src)}
                  style={{ width: "100%", height: "100%", objectFit: "contain", filter: c.invert ? "invert(1)" : undefined }}
                />
              ) : (
                c.text
              )}
            </div>
            {c.label ? (
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 600,
                  color: "#111",
                  background: "rgba(255,255,255,0.9)",
                  padding: "6px 16px",
                  borderRadius: 14,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}
              </div>
            ) : null}
            {c.bg === "transparent" ? null : (
              <Sequence from={c.at ?? i * stagger} durationInFrames={20} layout="none">
                <Audio src={staticFile("sfx/pop.wav")} volume={0.28} />
              </Sequence>
            )}
          </div>
        );
      })}
    </div>
  );
};

// GitHub repo card in the style of the repo header: owner / name, Public,
// star count. Stars count up.
export const RepoCard: React.FC<{
  life: number;
  x: number;
  y: number;
  owner: string;
  name: string;
  stars: number;
  forks?: number;
  logo?: string;
  delay?: number;
}> = ({ life, x, y, owner, name, stars, forks, logo, delay = 0 }) => {
  const frame = useCurrentFrame() - delay;
  const n = Math.round(ease(frame, 6, 42, 0, stars));
  const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : `${v}`);
  return (
    <Card life={life} x={x} y={y} padding={26} delay={delay} style={{ background: "#0d1117", border: "1px solid #30363d" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {logo ? (
          <Img src={staticFile(logo)} style={{ width: 64, height: 64, borderRadius: 14, objectFit: "contain", background: "#fff", padding: 6 }} />
        ) : (
          <Img src={staticFile("icons/github.svg")} style={{ width: 52, height: 52, filter: "invert(1)" }} />
        )}
        <div style={{ fontSize: 46, fontWeight: 600, color: "#58a6ff", whiteSpace: "nowrap" }}>
          <span style={{ color: "#8b949e", fontWeight: 400 }}>{owner} / </span>
          {name}
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#8b949e",
            border: "1px solid #30363d",
            borderRadius: 999,
            padding: "4px 14px",
            marginLeft: 6,
          }}
        >
          Public
        </div>
      </div>
      <div style={{ display: "flex", gap: 34, marginTop: 22, fontSize: 34, color: "#e6edf3", fontWeight: 500, alignItems: "center" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#e3b341", fontSize: 40 }}>★</span> {fmt(n)} stars
        </span>
        {forks ? (
          <span style={{ display: "flex", alignItems: "center", gap: 10, color: "#8b949e" }}>⑂ {fmt(forks)} forks</span>
        ) : null}
      </div>
    </Card>
  );
};

// A window showing a slice of the screen recording, optionally zoomed into a
// region (zoom > 1 with a focus point in 0..1 coordinates).
export const ScreenClip: React.FC<{
  life: number;
  x: number;
  y: number;
  w: number;
  from: number; // seconds into screen1080.mp4
  zoom?: number;
  fx?: number;
  fy?: number;
  zoomTo?: { zoom: number; fx: number; fy: number; at: number; dur?: number };
  speed?: number;
  title?: string;
  delay?: number;
  fadeIn?: number;
}> = ({ life, x, y, w, from, zoom = 1, fx = 0.5, fy = 0.5, zoomTo, speed = 1, title, delay = 0, fadeIn = 8 }) => {
  const frame = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  const h = Math.round((w * 1080) / 1920) ;
  // the screen file is 1920x991 (2922x1508 scaled), keep its aspect
  const sh = Math.round((w * 991) / 1920);
  void h;
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 150, mass: 0.8 } });
  const exit = interpolate(frame, [life - delay - 8, life - delay], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const a = frame < 0 ? 0 : Math.min(interpolate(frame, [0, fadeIn], [0, 1], { extrapolateRight: "clamp" }), exit);
  let z = zoom;
  let cx = fx;
  let cy = fy;
  if (zoomTo) {
    const d = zoomTo.dur ?? 18;
    const p = ease(frame, zoomTo.at, zoomTo.at + d);
    z = zoom + (zoomTo.zoom - zoom) * p;
    cx = fx + (zoomTo.fx - fx) * p;
    cy = fy + (zoomTo.fy - fy) * p;
  }
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        opacity: a,
        transform: `translateY(${(1 - enter) * 30}px) scale(${0.96 + 0.04 * enter})`,
        transformOrigin: "50% 0%",
      }}
    >
      {title ? (
        <div
          style={{
            fontFamily: FONT,
            fontSize: 26,
            fontWeight: 600,
            color: "#fff",
            background: "rgba(18,18,20,0.94)",
            display: "inline-block",
            padding: "8px 18px",
            borderRadius: 12,
            marginBottom: 12,
            boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
          }}
        >
          {title}
        </div>
      ) : null}
      <div
        style={{
          width: w,
          height: sh,
          borderRadius: 22,
          overflow: "hidden",
          boxShadow: Shadow,
          background: "#0a0a0a",
          border: "2px solid rgba(255,255,255,0.35)",
          position: "relative",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: `scale(${z})`,
            transformOrigin: `${cx * 100}% ${cy * 100}%`,
          }}
        >
          <OffthreadVideo
            src={staticFile("talk/screen1080.mp4")}
            startFrom={Math.round(from * 30)}
            playbackRate={speed}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      </div>
    </div>
  );
};

// A single cropped screenshot from the screen recording (frozen frame).
export const Still: React.FC<{
  life: number;
  x: number;
  y: number;
  w: number;
  src: string;
  delay?: number;
  caption?: string;
}> = ({ life, x, y, w, src, delay = 0, caption }) => (
  <Card life={life} x={x} y={y} w={w} padding={0} delay={delay} style={{ overflow: "hidden", borderRadius: 22, border: "2px solid rgba(255,255,255,0.35)" }}>
    <Img src={staticFile(src)} style={{ width: "100%", display: "block" }} />
    {caption ? (
      <div style={{ padding: "14px 22px", fontSize: 28, fontWeight: 600, background: "#111", color: "#fff" }}>{caption}</div>
    ) : null}
  </Card>
);

// Word-timed captions along the bottom, three or four words at a time, the
// spoken word highlighted.
export type Word = { word: string; start: number; end: number };
export const Captions: React.FC<{ words: Word[]; offset: number; groupSize?: number }> = ({ words, offset, groupSize = 4 }) => {
  const frame = useCurrentFrame();
  const t = frame / 30 + offset;
  // find the group containing t
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
  const g = groups.find((gr) => t >= gr[0].start - 0.05 && t < gr[gr.length - 1].end + 0.25);
  if (!g) return null;
  const gStart = g[0].start - 0.05;
  const a = ease(t, gStart, gStart + 0.12);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 54,
        display: "flex",
        justifyContent: "center",
        fontFamily: FONT,
        opacity: a,
        transform: `translateY(${(1 - a) * 12}px)`,
      }}
    >
      <div
        style={{
          background: "rgba(12,12,14,0.9)",
          borderRadius: 18,
          padding: "14px 30px",
          fontSize: 48,
          fontWeight: 700,
          letterSpacing: -0.5,
          color: "rgba(255,255,255,0.55)",
          display: "flex",
          gap: 14,
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        }}
      >
        {g.map((w, i) => {
          const on = t >= w.start - 0.02;
          return (
            <span key={i} style={{ color: on ? "#fff" : "rgba(255,255,255,0.45)", transition: "none" }}>
              {w.word.trim()}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// Full-frame slow push-in on the talking head between `from` and `to`.
export const usePush = (beats: { at: number; dur: number; zoom: number; fx?: number; fy?: number }[]) => {
  const f = useCurrentFrame();
  let z = 1;
  let fx = 0.28;
  let fy = 0.4;
  for (const b of beats) {
    const p = ease(f, b.at, b.at + b.dur);
    z = 1 + (b.zoom - 1) * p;
    if (p > 0 && p < 1) {
      fx = b.fx ?? fx;
      fy = b.fy ?? fy;
    }
    if (f >= b.at) {
      fx = b.fx ?? fx;
      fy = b.fy ?? fy;
    }
  }
  return { z, fx, fy };
};

export const Base: React.FC<{ children?: React.ReactNode }> = ({ children }) => <AbsoluteFill>{children}</AbsoluteFill>;
