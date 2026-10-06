import type { MetadataRoute } from "next";
import { abs } from "@/lib/seo";
import { IS_STAGING } from "@/lib/env";

/** Search engines and AI assistants are welcome to read and cite the public content. */
const AI_AGENTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai",
  "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot", "Bingbot", "DuckAssistBot", "meta-externalagent",
  "Applebot", "GoogleOther", "Amazonbot", "MistralAI-User", "cohere-ai",
];

export default function robots(): MetadataRoute.Robots {
  // Staging holds draft content: keep every crawler out.
  if (IS_STAGING) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/portal", "/my-plan", "/api/my-plan"] },
      ...AI_AGENTS.map((ua) => ({ userAgent: ua, allow: "/", disallow: ["/api/", "/portal", "/my-plan", "/api/my-plan"] })),
    ],
    sitemap: abs("/sitemap.xml"),
    host: abs("/"),
  };
}
