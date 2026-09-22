import { continueRender, delayRender, staticFile } from "remotion";

const handle = delayRender("Loading Geist fonts");

const geist = new FontFace(
  "Geist",
  `url('${staticFile("fonts/geist-latin.woff2")}') format('woff2')`
);
const geistMono = new FontFace(
  "Geist Mono",
  `url('${staticFile("fonts/geist-mono-latin.woff2")}') format('woff2')`
);

Promise.all([geist.load(), geistMono.load()])
  .then(([g, gm]) => {
    document.fonts.add(g);
    document.fonts.add(gm);
    continueRender(handle);
  })
  .catch((err) => {
    // Render with fallback fonts rather than hanging the render
    console.error("Font loading failed", err);
    continueRender(handle);
  });
