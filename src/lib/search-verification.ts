import type { Metadata } from "next";

/**
 * Site-ownership meta tags for Google Search Console, Bing Webmaster Tools and Yandex, read from env so the
 * codes never live in the repo. Domain-level DNS verification in Cloudflare is the preferred route (it
 * covers every subdomain and survives redesigns); these tags are the fallback for a URL-prefix property.
 * Staging never gets them, so a staging copy can't be claimed as the site.
 */
export function searchVerification(env: Record<string, string | undefined> = process.env, staging = false): Metadata["verification"] | undefined {
  if (staging) return undefined;
  const clean = (v: string | undefined) => (v ?? "").trim().replace(/[^A-Za-z0-9_-]/g, "") || undefined;
  const google = clean(env.GOOGLE_SITE_VERIFICATION);
  const bing = clean(env.BING_SITE_VERIFICATION);
  const yandex = clean(env.YANDEX_VERIFICATION);
  if (!google && !bing && !yandex) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(yandex ? { yandex } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}

/** Cloudflare Web Analytics token (free, cookieless, so it needs no consent banner). Off on staging. */
export function cloudflareBeaconToken(env: Record<string, string | undefined> = process.env, staging = false): string | undefined {
  if (staging) return undefined;
  return (env.NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN ?? "").trim().replace(/[^A-Za-z0-9]/g, "") || undefined;
}
