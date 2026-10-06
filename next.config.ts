import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/tools/probate-cost", destination: "/tools/probate-cost-estimator", permanent: true },
      { source: "/tools/readiness", destination: "/tools/plan-readiness-assessment", permanent: true },
    ];
  },
};

export default nextConfig;
