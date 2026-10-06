/**
 * Staging is any build that must not be indexed or treated as the live site:
 * SITE_ENV=staging (set on a staging Vercel project) or a Vercel preview deploy.
 * Read at build time, so changing it needs a redeploy.
 */
export const IS_STAGING = process.env.SITE_ENV === "staging" || process.env.VERCEL_ENV === "preview";
