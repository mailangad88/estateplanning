import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("staging mode", () => {
  it("disallows every crawler on staging", async () => {
    vi.stubEnv("SITE_ENV", "staging");
    const { default: robots } = await import("@/app/robots");
    expect(robots().rules).toEqual([{ userAgent: "*", disallow: "/" }]);
  });

  it("keeps the public robots rules outside staging", async () => {
    vi.stubEnv("SITE_ENV", "");
    vi.stubEnv("VERCEL_ENV", "production");
    const { default: robots } = await import("@/app/robots");
    const rules = robots().rules;
    expect(Array.isArray(rules) && rules[0].allow).toBe("/");
  });

  it("does not forward submissions to the CRM on staging", async () => {
    vi.stubEnv("SITE_ENV", "staging");
    vi.stubEnv("CRM_WEBHOOK_URL", "https://example.com/hook");
    const { postToCrm } = await import("@/lib/crm");
    const fetchImpl = vi.fn();
    const res = await postToCrm({ id: "x" }, { id: "x" }, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(res.delivered).toBe(false);
  });
});
