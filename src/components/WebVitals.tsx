"use client";

import { useReportWebVitals } from "next/web-vitals";
import { track } from "@/components/capture";

/**
 * Sends Core Web Vitals (LCP, INP, CLS, plus FCP and TTFB) from real visits to the dataLayer as `web_vitals`
 * events, so GA4 can show which templates are slow before Search Console's 28-day field report does.
 * Values only: no page content or visitor data. CLS is scaled by 1000 so every value is a whole number.
 */
export default function WebVitals() {
  useReportWebVitals((m) => {
    track("web_vitals", {
      metric_name: m.name,
      value: Math.round(m.name === "CLS" ? m.value * 1000 : m.value),
      rating: (m as { rating?: string }).rating ?? "unknown",
      navigation_type: m.navigationType ?? "unknown",
    });
  });
  return null;
}
