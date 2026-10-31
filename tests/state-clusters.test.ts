import { afterEach, describe, expect, it } from "vitest";
import { isClusterServed, isIndexable } from "@/lib/library";

const saved = process.env.SERVED_STATES;
afterEach(() => {
  if (saved === undefined) delete process.env.SERVED_STATES;
  else process.env.SERVED_STATES = saved;
});

describe("state library sections", () => {
  it("hides New Jersey pages while only Illinois is served", () => {
    process.env.SERVED_STATES = "IL";
    expect(isClusterServed("new-jersey")).toBe(false);
    expect(isClusterServed("illinois")).toBe(true);
    expect(isClusterServed("wills")).toBe(true);
    expect(isIndexable({ review: "approved", cluster: "new-jersey" })).toBe(false);
  });

  it("shows New Jersey pages once NJ is served", () => {
    process.env.SERVED_STATES = "IL,NJ";
    expect(isClusterServed("new-jersey")).toBe(true);
  });

  it("shows every section with the placeholder state", () => {
    process.env.SERVED_STATES = "XX";
    expect(isClusterServed("new-jersey")).toBe(true);
  });
});
