import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudflareBeaconToken, searchVerification } from "@/lib/search-verification";
import { stateNames } from "@/lib/served-state-names";

describe("search engine verification tags", () => {
  it("is empty until a code is set", () => {
    expect(searchVerification({})).toBeUndefined();
  });

  it("maps Google, Bing and Yandex codes to Next metadata", () => {
    expect(searchVerification({ GOOGLE_SITE_VERIFICATION: " abc_123 ", BING_SITE_VERIFICATION: "B1NG", YANDEX_VERIFICATION: "y" })).toEqual({
      google: "abc_123",
      yandex: "y",
      other: { "msvalidate.01": "B1NG" },
    });
  });

  it("strips characters that could break out of the meta tag", () => {
    expect(searchVerification({ GOOGLE_SITE_VERIFICATION: 'x"><script>' })).toEqual({ google: "xscript" });
  });

  it("never verifies a staging copy", () => {
    expect(searchVerification({ GOOGLE_SITE_VERIFICATION: "abc" }, true)).toBeUndefined();
    expect(cloudflareBeaconToken({ NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN: "abc" }, true)).toBeUndefined();
  });

  it("reads the Cloudflare Web Analytics token", () => {
    expect(cloudflareBeaconToken({ NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN: "0123abcd" })).toBe("0123abcd");
    expect(cloudflareBeaconToken({})).toBeUndefined();
  });
});

describe("served state names", () => {
  it("names real codes and skips the placeholder", () => {
    expect(stateNames(["IL", "nj", "XX"])).toEqual(["Illinois", "New Jersey"]);
  });
});

describe("robots.txt", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("welcomes AI crawlers by name and keeps private areas out", async () => {
    vi.stubEnv("SITE_ENV", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.resetModules();
    const { default: robots } = await import("@/app/robots");
    const rules = robots().rules;
    const list = Array.isArray(rules) ? rules : [rules];
    for (const ua of ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
      const rule = list.find((r) => r.userAgent === ua);
      expect(rule?.allow).toBe("/");
    }
    for (const r of list) {
      expect(r.disallow).toEqual(expect.arrayContaining(["/api/", "/portal", "/admin", "/client", "/my-plan"]));
    }
  });
});

describe("llms.txt", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("describes the referral network and the states served", async () => {
    vi.stubEnv("SERVED_STATES", "IL,NJ");
    vi.resetModules();
    const { GET } = await import("@/app/llms.txt/route");
    const text = await GET().text();
    expect(text).toContain("referral network for Illinois and New Jersey");
    expect(text).toContain("## Key facts");
    expect(text).toContain("/llms-full.txt");
    expect(text).not.toMatch(/\[Firm legal name\]/);
  });
});

import { leadChannel } from "@/lib/channel";

describe("lead channel", () => {
  it("credits AI assistants by referrer and by ChatGPT's utm tag", () => {
    expect(leadChannel({ referrer: "https://chatgpt.com/" })).toEqual({ channel: "ai_assistant", engine: "chatgpt" });
    expect(leadChannel({ utmSource: "chatgpt.com" })).toEqual({ channel: "ai_assistant", engine: "chatgpt" });
    expect(leadChannel({ referrer: "https://www.perplexity.ai/search?q=x" }).engine).toBe("perplexity");
    expect(leadChannel({ referrer: "https://gemini.google.com/app" }).engine).toBe("gemini");
  });

  it("separates organic search, paid, social, referral and direct", () => {
    expect(leadChannel({ referrer: "https://www.google.com/" })).toEqual({ channel: "organic_search", engine: "google" });
    expect(leadChannel({ referrer: "https://www.bing.com/search" }).engine).toBe("bing");
    expect(leadChannel({ referrer: "https://www.google.com/", gclid: "abc" }).channel).toBe("paid_search");
    expect(leadChannel({ referrer: "https://m.facebook.com/" }).channel).toBe("social");
    expect(leadChannel({ referrer: "https://www.avvo.com/x" })).toEqual({ channel: "referral", engine: "avvo.com" });
    expect(leadChannel({})).toEqual({ channel: "direct", engine: "" });
    expect(leadChannel({ referrer: "https://familyfutureplanning.com/learn" }, "familyfutureplanning.com").channel).toBe("direct");
  });
});
