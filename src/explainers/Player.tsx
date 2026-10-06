"use client";

import { Player } from "@remotion/player";
import { EXPLAINERS } from "./data";
import { ExplainerVideo } from "./Composition";
import { durationFor, FPS } from "./timing";

export default function ExplainerPlayer({ slug }: { slug: string }) {
  const explainer = EXPLAINERS.find((e) => e.slug === slug);
  if (!explainer) return null;
  return (
    <div className="player-wrap">
      <Player
        component={ExplainerVideo}
        inputProps={{ explainer }}
        durationInFrames={durationFor(explainer)}
        fps={FPS}
        compositionWidth={1280}
        compositionHeight={720}
        style={{ width: "100%", aspectRatio: "16 / 9" }}
        controls
        clickToPlay
        acknowledgeRemotionLicense
      />
    </div>
  );
}
