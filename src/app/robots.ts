import type { MetadataRoute } from "next";
import { abs } from "@/lib/seo";
import { IS_STAGING } from "@/lib/env";

/** Search engines and AI assistants are welcome to read and cite the public content. */
const AI_AGENTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai",
  "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot", "Bingbot", "DuckAssistBot", "meta-externalagent",
  "Applebot", "GoogleOther", "Amazonbot", "MistralAI-User", "cohere-ai",
];

/** Private or per-visitor areas: sign-in screens, dashboards and APIs have nothing to rank and waste crawl budget. */
const PRIVATE_PATHS = ["/api/", "/portal", "/admin", "/client", "/my-plan", "/unsubscribe"];

export default function robots(): MetadataRoute.Robots {
  // Staging holds draft content: keep every crawler out.
  if (IS_STAGING) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      // Named groups so each AI crawler sees an explicit welcome (a crawler obeys only its most specific group).
      ...AI_AGENTS.map((ua) => ({ userAgent: ua, allow: "/", disallow: PRIVATE_PATHS })),
    ],
    sitemap: abs("/sitemap.xml"),
    host: abs("/"),
  };
}
