/**
 * Links for social posts. Every video caption, bio link and pinned comment points at a /tips page with
 * UTM tags, so the site's session attribution (src/lib/visitor.ts) and the booking `from` slug both
 * show which platform and which video brought the visitor in.
 */

export const SOCIAL_PLATFORMS = {
  instagram: { utm: "instagram", short: "ig", label: "Instagram Reels" },
  facebook: { utm: "facebook", short: "fb", label: "Facebook Reels" },
  youtube: { utm: "youtube", short: "yt", label: "YouTube Shorts" },
} as const;

export type SocialPlatform = keyof typeof SOCIAL_PLATFORMS;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;

/** Path and query for a tip page, tagged for one platform and one video (content id like "v2026-11-03"). */
export function socialLink(tipSlug: string, platform: SocialPlatform, contentId: string, campaign = "tips-il-launch"): string {
  if (!SLUG_RE.test(tipSlug)) throw new Error(`Bad tip slug: ${tipSlug}`);
  const q = new URLSearchParams({
    utm_source: SOCIAL_PLATFORMS[platform].utm,
    utm_medium: "social-video",
    utm_campaign: campaign,
    utm_content: contentId,
  });
  return `/tips/${tipSlug}?${q.toString()}`;
}

/**
 * Booking `from` slug for a tip page. With a known utm_source it carries the platform ("ig-who-gets-my-kids"),
 * otherwise "tips-<slug>". Stays inside the /book from-slug pattern (60 chars, a-z 0-9 and dashes).
 */
export function tipBookingSource(tipSlug: string, utmSource: string | null | undefined): string {
  const hit = Object.values(SOCIAL_PLATFORMS).find((p) => p.utm === utmSource?.toLowerCase());
  return `${hit ? hit.short : "tips"}-${tipSlug}`.slice(0, 60).replace(/-+$/, "");
}
