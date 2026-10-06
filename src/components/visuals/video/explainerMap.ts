/**
 * Interactive explainers (src/explainers) that have a rendered, captioned
 * video on the same topic. The explainer page embeds the video, which also
 * carries the page's VideoObject schema (the interactive player is not a
 * video file, so it gets no VideoObject of its own).
 */
export const EXPLAINER_VIDEO: Record<string, string> = {
  "how-probate-works": "the-probate-timeline-animated",
  "how-a-revocable-trust-works": "how-a-revocable-living-trust-works",
  "what-happens-without-a-will": "what-happens-if-you-die-without-a-will",
  "funding-your-trust": "funding-your-trust-the-six-assets-to-retitle",
};

/** Reverse lookup: the interactive explainer for a video slug, if any. */
export function explainerForVideo(videoSlug: string): string | undefined {
  return Object.entries(EXPLAINER_VIDEO).find(([, v]) => v === videoSlug)?.[0];
}
