import { SITE_URL } from "@/lib/seo";
import type { VideoEntry } from "./types";

/**
 * schema.org VideoObject for one explainer. `siteUrl` is the absolute origin
 * (e.g. https://example.com) because Google requires absolute URLs.
 * `pageUrl` is the page the video is embedded on.
 */
export function videoObjectJsonLd(v: VideoEntry, siteUrl: string, pageUrl?: string) {
  const abs = (p: string) => (p.startsWith("http") ? p : `${siteUrl.replace(/\/$/, "")}${p}`);
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: v.title,
    description: v.description,
    thumbnailUrl: [abs(v.poster)],
    uploadDate: v.uploadDate,
    duration: v.isoDuration,
    contentUrl: abs(v.src),
    embedUrl: abs(`/videos/${v.slug}`),
    transcript: v.transcript,
    inLanguage: "en-US",
    isFamilyFriendly: true,
    ...(pageUrl ? { mainEntityOfPage: abs(pageUrl) } : {}),
    hasPart: v.chapters.map((ch, i) => ({
      "@type": "Clip",
      name: ch.title,
      startOffset: Math.round(ch.startSec),
      endOffset: Math.round(v.chapters[i + 1]?.startSec ?? v.durationSec),
      url: `${abs(pageUrl ?? `/videos/${v.slug}`)}?t=${Math.round(ch.startSec)}`,
    })),
  };
}

/** Site origin for absolute URLs in structured data. Set NEXT_PUBLIC_SITE_URL in production. */
export function siteUrl(): string {
  // Same origin as canonicals and the sitemap (placeholder until the domain is set), never a guessed domain.
  return SITE_URL;
}
