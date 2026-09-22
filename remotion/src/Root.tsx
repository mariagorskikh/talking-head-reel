import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { REEL_DURATION, TalkReel } from "./talk/Reel";

export const Root: React.FC = () => (
  <>
    <Composition id="TalkReel" component={TalkReel} durationInFrames={REEL_DURATION} fps={30} width={1080} height={1920} />
  </>
);
