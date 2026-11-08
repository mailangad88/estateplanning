import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DROPDOWN_STATES, leadStates, OTHER_STATE } from "@/config/firm";
import { scoreLead } from "@/lib/scoring";

afterEach(() => vi.unstubAllEnvs());

describe("state dropdown (Angad 2026-11-08: IL and NJ only)", () => {
  it("lists Illinois and New Jersey", () => expect([...DROPDOWN_STATES]).toEqual(["IL", "NJ"]));

  it("accepts NJ leads while SERVED_STATES is IL (NJ content stays hidden)", () => {
    vi.stubEnv("SERVED_STATES", "IL");
    expect(leadStates()).toEqual(["IL", "NJ"]);
    const nj = scoreLead({ state: "NJ", servedStates: leadStates(), answers: {}, smsConsent: false });
    expect(nj.tier).not.toBe("not_a_fit");
    const other = scoreLead({ state: OTHER_STATE, servedStates: leadStates(), answers: {}, smsConsent: false });
    expect(other.tier).toBe("not_a_fit");
  });

  it("no \"where do you live\" dropdown maps over the full US_STATES list", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".tsx")) {
          // Property and signing-state pickers keep every state; residence pickers must not.
          for (const line of readFileSync(p, "utf8").split("\n")) if (/US_STATES\.map\(/.test(line) && !/signed|property/i.test(line)) hits.push(p);
        }
      }
    };
    walk("src");
    expect(hits).toEqual([]);
  });
});
