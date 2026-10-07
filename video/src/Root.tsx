import { Composition } from "remotion";
import { Explainer, type ExplainerProps } from "./Explainer";
import { SocialCompositions } from "./social/Root";
import { StudioCompositions } from "./studio/Root";
import { FPS, SIZES, compId, videos, type Aspect } from "./data";

const aspects: Aspect[] = ["16:9", "9:16"];

export const RemotionRoot: React.FC = () => (
  <>
    {videos.flatMap((v) =>
      aspects.map((a) => (
        <Composition
          key={compId(v, a)}
          id={compId(v, a)}
          component={Explainer}
          durationInFrames={Math.round(v.durationSec * FPS)}
          fps={FPS}
          width={SIZES[a].width}
          height={SIZES[a].height}
          defaultProps={{ videoId: v.id, aspect: a } satisfies ExplainerProps}
        />
      )),
    )}
    <SocialCompositions />
    <StudioCompositions />
  </>
);
