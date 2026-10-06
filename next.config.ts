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
    return staging ? [{ source: "/(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }] : [];
  },
  async redirects() {
    return [
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
