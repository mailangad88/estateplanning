import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { firm, packages, PACKAGE_REVISIONS, SITE_DISCLAIMER } from "@/config/firm";
import { STATE_RULES } from "@/config/compliance";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : n.endsWith(".tsx") ? [p] : [];
  });
}

describe("referral network setup (Sargun Singh, 2026-10-25)", () => {
  it("names the attorney", () => expect(firm.attorneyName).toBe("Sargun Singh"));

  it("Essentials and Complete include exactly one round of revisions; Legacy is a custom quote", () => {
    for (const p of packages.filter((x) => x.id !== "legacy")) {
      expect(p.includes).toContain(PACKAGE_REVISIONS);
      expect(p.excludes).toContain("Revisions after the first round");
    }
    expect(packages.map((p) => p.price)).toEqual(["$2,500", "$3,500", "Custom quote"]);
  });

  it("the disclaimer says the site is a referral website and gives no legal advice", () => {
    expect(SITE_DISCLAIMER).toMatch(/educational purposes only/);
    expect(SITE_DISCLAIMER).toMatch(/referral website/);
    expect(SITE_DISCLAIMER).toMatch(/attorney-client relationship/);
  });

  it("New Jersey has a compliance entry, unverified until the attorney checks it", () => {
    expect(STATE_RULES.NJ?.name).toBe("New Jersey");
    expect(STATE_RULES.NJ?.verified).toBe(false);
  });

  it("every public form that asks for an email shows the disclaimer", () => {
    const missing: string[] = [];
    for (const f of files(join(process.cwd(), "src"))) {
      if (/[/\\](admin|portal|client)[/\\]/.test(f)) continue;
      const src = readFileSync(f, "utf8");
      if (!src.includes('type="email"')) continue;
      if (!src.includes("<FormDisclaimer")) missing.push(f);
    }
    expect(missing).toEqual([]);
  });
});
