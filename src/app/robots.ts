import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/site";

/**
 * Search engines and AI assistants are all welcome to read and cite the educational content.
 * AI crawlers are listed by name so the intent is explicit (some only crawl when named).
 * Only the lead API is off limits.
 */
const AI_CRAWLERS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-User", "Claude-SearchBot", "anthropic-ai",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "GoogleOther",
  "Applebot", "Applebot-Extended",
  "Bingbot", "DuckAssistBot", "Amazonbot", "meta-externalagent", "MistralAI-User", "cohere-ai", "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  const disallow = ["/api/"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      { userAgent: AI_CRAWLERS, allow: "/", disallow },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
