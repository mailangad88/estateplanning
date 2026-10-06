/**
 * Public site settings used for canonical URLs, sitemaps, structured data and llms.txt.
 * Set NEXT_PUBLIC_SITE_URL to the production origin (no trailing slash) before launch.
 */
export const site = {
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.example.com").replace(/\/$/, ""), // PLACEHOLDER domain
  /** Shown on every content page until the attorney signs off on it. */
  reviewStatus: "Pending attorney review",
  /** Year shown in copyright and used for "as of" statements. */
  contentYear: 2026,
};

export function absoluteUrl(path: string): string {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}
