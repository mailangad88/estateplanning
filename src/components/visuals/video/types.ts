/** One rendered explainer video, as written to manifest.json by video/scripts/render-all.mjs. */
export type VideoEntry = {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationSec: number;
  /** ISO 8601 duration, e.g. "PT1M30S". */
  isoDuration: string;
  uploadDate: string;
  src: string;
  verticalSrc?: string;
  poster: string;
  captions: string;
  transcript: string;
  chapters: { title: string; startSec: number }[];
  topics: string[];
  cta?: { label: string; href: string };
};
