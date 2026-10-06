import manifest from "./manifest.json";
import type { VideoEntry } from "./types";

export const videos = manifest as unknown as VideoEntry[];

export function getVideo(slug: string): VideoEntry | undefined {
  return videos.find((v) => v.slug === slug);
}

/** Videos tagged with a topic such as "wills", "trusts", "probate" or "guardianship". */
export function videosForTopic(topic: string): VideoEntry[] {
  return videos.filter((v) => v.topics.includes(topic));
}
