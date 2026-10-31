/** The live domain. Canonical host is the apex; www redirects to it (docs/deploy-production.md). */
export const PRODUCTION_URL = "https://familyfutureplanning.com";

/**
 * Public origin for canonical URLs, the sitemap, robots.txt, llms.txt, Open Graph and structured data.
 * NEXT_PUBLIC_SITE_URL wins (staging sets its own *.vercel.app address); without it every link points
 * at the live domain, never at whichever host served the request.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || PRODUCTION_URL).trim().replace(/\/+$/, "");

/**
 * Public site settings used for canonical URLs, sitemaps, structured data and llms.txt.
 */
export const site = {
  url: SITE_URL,
  /** Shown on every content page until the attorney signs off on it. */
  reviewStatus: "Pending attorney review",
  /** Year shown in copyright and used for "as of" statements. */
  contentYear: 2026,
};

export function absoluteUrl(path: string): string {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}
