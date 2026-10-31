import type { NextConfig } from "next";
import { MERGED_PAGES } from "./src/config/merged-pages";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Page review hashes the content files at request time, so they must ship with these server functions.
  outputFileTracingIncludes: {
    "/portal/pages": ["./content/**/*"],
    "/api/portal/pages/**": ["./content/**/*"],
    "/api/portal/page-approvals/**": ["./content/**/*"],
  },
  async headers() {
    const staging = process.env.SITE_ENV === "staging" || process.env.VERCEL_ENV === "preview";
    if (staging) return [{ source: "/(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
    // The live project is also reachable at its *.vercel.app address: keep that copy out of search
    // so only the custom domain is indexed.
    return [{ source: "/(.*)", has: [{ type: "host", value: ".*\\.vercel\\.app" }], headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
  async redirects() {
    return [
      // Canonical host is the apex. Vercel's domain redirect normally does this first; this is the fallback.
      { source: "/:path*", has: [{ type: "host", value: "www.familyfutureplanning.com" }], destination: "https://familyfutureplanning.com/:path*", permanent: true },
      { source: "/tools/probate-cost", destination: "/tools/probate-cost-estimator", permanent: true },
      // The first six printable guides moved into the /free resource library.
      ...[
        ["estate-planning-checklist", "estate-planning-checklist"],
        ["new-parents-guide", "new-parents-kit"],
        ["after-a-death-checklist", "executor-first-30-days-guide"],
        ["probate-vs-trust-guide", "probate-vs-trust-guide"],
        ["family-meeting-worksheet", "family-meeting-worksheet"],
        ["caregiver-planning-guide", "caregiver-planning-guide"],
      ].flatMap(([from, to]) => [
        { source: `/resources/${from}`, destination: `/free/${to}`, permanent: true },
        { source: `/resources/${from}/read`, destination: `/free/${to}/view`, permanent: true },
      ]),
      { source: "/tools/readiness", destination: "/tools/plan-readiness-assessment", permanent: true },
      // Duplicate guides, comparisons and posts folded into their library article.
      ...MERGED_PAGES.map(([source, destination]) => ({ source, destination, permanent: true })),
    ];
  },
};

export default nextConfig;
