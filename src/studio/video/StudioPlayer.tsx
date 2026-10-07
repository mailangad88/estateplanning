"use client";

import { Player } from "@remotion/player";
import type { VideoPlan } from "../../server/studio/types";
import { StudioVideo } from "./StudioVideo";
import { planDurationInFrames } from "./timing";

/** Admin preview of a director's plan, same component the video/ project renders to mp4. */
export default function StudioPlayer({ plan, className }: { plan: VideoPlan; className?: string }) {
  if (!plan.scenes.length) return null;
  const vertical = plan.height > plan.width;
  return (
    <div className={className ?? "player-wrap"} style={vertical ? { maxWidth: 420, margin: "0 auto" } : undefined}>
      <Player
        component={StudioVideo}
        inputProps={{ plan }}
        durationInFrames={planDurationInFrames(plan)}
        fps={plan.fps}
        compositionWidth={plan.width}
        compositionHeight={plan.height}
        style={{ width: "100%", aspectRatio: `${plan.width} / ${plan.height}` }}
        controls
        clickToPlay
        acknowledgeRemotionLicense
      />
    </div>
  );
}
