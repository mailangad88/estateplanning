import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("site URL", () => {
  it("points at the live domain when NEXT_PUBLIC_SITE_URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const { SITE_URL, abs } = await import("@/lib/seo");
    expect(SITE_URL).toBe("https://familyfutureplanning.com");
    expect(abs("/book")).toBe("https://familyfutureplanning.com/book");
  });

  it("uses the staging address when staging sets it, without a trailing slash", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://estateplanning-staging.vercel.app/");
    const { SITE_URL } = await import("@/lib/seo");
    const { site } = await import("@/config/site");
    expect(SITE_URL).toBe("https://estateplanning-staging.vercel.app");
    expect(site.url).toBe(SITE_URL);
  });

  it("puts the sitemap and host in robots.txt on the same origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_ENV", "");
    vi.stubEnv("VERCEL_ENV", "production");
    const { default: robots } = await import("@/app/robots");
    expect(robots().sitemap).toBe("https://familyfutureplanning.com/sitemap.xml");
  });
});

describe("served states wording", () => {
  it("says Illinois only when New Jersey is switched off", async () => {
    vi.stubEnv("SERVED_STATES", "IL");
    const { SERVED_AND, SERVED_OR } = await import("@/config/firm");
    expect([SERVED_AND, SERVED_OR]).toEqual(["Illinois", "Illinois"]);
  });

  it("names both states when New Jersey is on", async () => {
    vi.stubEnv("SERVED_STATES", "IL,NJ");
    const { SERVED_AND, SERVED_OR } = await import("@/config/firm");
    expect([SERVED_AND, SERVED_OR]).toEqual(["Illinois and New Jersey", "Illinois or New Jersey"]);
  });
});
