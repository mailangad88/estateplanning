import { Composition, Folder, type CalculateMetadataFunction } from "remotion";
import type { VideoPlan } from "../../../src/server/studio/types";
import { StudioVideo, type StudioVideoProps } from "../../../src/studio/video/StudioVideo";
import { planDurationInFrames } from "../../../src/studio/video/timing";
import { SAMPLE_LONG_PLAN, SAMPLE_SHORT_PLAN } from "../../../src/studio/video/samplePlans";

/**
 * Social video studio compositions. The `plan` input prop is a director's VideoPlan
 * (src/server/studio/types.ts); duration comes from the plan's scenes. The size is fixed per
 * composition id, so render a long plan with StudioLong and a short plan with StudioShort.
 */
const meta =
  (fallback: VideoPlan): CalculateMetadataFunction<StudioVideoProps> =>
  ({ props }) => {
    const plan = props.plan?.scenes?.length ? props.plan : fallback;
    return { props: { ...props, plan }, durationInFrames: planDurationInFrames(plan), fps: plan.fps ?? 30 };
  };

export const StudioCompositions: React.FC = () => (
  <Folder name="Studio">
    <Composition
      id="StudioLong"
      component={StudioVideo}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={planDurationInFrames(SAMPLE_LONG_PLAN)}
      defaultProps={{ plan: SAMPLE_LONG_PLAN }}
      calculateMetadata={meta(SAMPLE_LONG_PLAN)}
    />
    <Composition
      id="StudioShort"
      component={StudioVideo}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={planDurationInFrames(SAMPLE_SHORT_PLAN)}
      defaultProps={{ plan: SAMPLE_SHORT_PLAN }}
      calculateMetadata={meta(SAMPLE_SHORT_PLAN)}
    />
  </Folder>
);
