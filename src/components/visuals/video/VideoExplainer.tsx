import { getVideo } from "./videos";
import { siteUrl, videoObjectJsonLd } from "./schema";
import { VideoPlayer } from "./VideoPlayer";

export type VideoExplainerProps = {
  /** Slug from manifest.json, e.g. "how-a-revocable-living-trust-works". */
  slug: string;
  /** Path of the page embedding the video, for the schema's mainEntityOfPage. */
  pagePath?: string;
  /** Show the full transcript in a disclosure under the player (default true). */
  transcript?: boolean;
  /** Emit VideoObject JSON-LD (default true). Turn off if the page already emits it. */
  schema?: boolean;
  vertical?: boolean;
};

/**
 * Drop-in explainer video: player with captions and chapters, a visible
 * transcript, and VideoObject structured data. Renders nothing for an
 * unknown slug so pages never break if a video is renamed.
 */
export function VideoExplainer({ slug, pagePath, transcript = true, schema = true, vertical }: VideoExplainerProps) {
  const video = getVideo(slug);
  if (!video) return null;
  const jsonLd = schema ? JSON.stringify(videoObjectJsonLd(video, siteUrl(), pagePath)).replace(/</g, "\\u003c") : null;
  return (
    <section className="v-video" aria-label={`Video: ${video.title}`}>
      <VideoPlayer video={video} vertical={vertical} />
      {transcript ? (
        <details>
          <summary>Read the transcript</summary>
          <p>{video.transcript}</p>
        </details>
      ) : null}
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} /> : null}
    </section>
  );
}
