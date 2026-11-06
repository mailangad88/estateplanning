import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bookHref, bookingNotes, fromForPath, parseBookParams, TOOL_BOOKING, topicForPath } from "@/lib/book";
import { TOOLS } from "@/config/tools";
import { EXPERIMENTS } from "@/lib/experiments";

describe("bookHref", () => {
  it("builds a plain link with no context", () => expect(bookHref()).toBe("/book"));
  it("keeps a known topic and a slug source", () => expect(bookHref("death-tax", "probate")).toBe("/book?from=death-tax&topic=probate"));
  it("drops unknown topics and unsafe sources", () => {
    expect(bookHref("<script>", "nope")).toBe("/book");
    expect(bookHref("Tool Name", "will")).toBe("/book?topic=will");
  });
});

describe("parseBookParams", () => {
  it("round-trips bookHref", () => {
    expect(parseBookParams(bookHref("guardian-picker", "kids").split("?")[1])).toEqual({ from: "guardian-picker", topic: "kids" });
  });
  it("ignores junk", () => expect(parseBookParams("?from=a%20b&topic=x")).toEqual({ from: null, topic: null }));
});

describe("bookingNotes", () => {
  it("names the topic and the source", () => expect(bookingNotes("trust", "header")).toBe("Wants to talk about a living trust. Booked from: header"));
  it("is empty with nothing known", () => expect(bookingNotes(null, null)).toBe(""));
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("booking links", () => {
  it("every 'Book a consult' link goes straight to /book, not through a questionnaire", () => {
    const offenders: string[] = [];
    for (const f of files(join(process.cwd(), "src"))) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/href=["{`]+\/(plan-finder|intake)["`}]+[^>]*>\s*(Book a consult|book a consult)/g)) offenders.push(`${f}: /${m[1]}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe("topicForPath", () => {
  it.each([
    ["/compare/will-vs-trust", "will-or-trust"],
    ["/learn/after-a-death/illinois-probate-process", "probate"],
    ["/guides/naming-a-guardian-for-children", "kids"],
    ["/life-events/caring-for-aging-parents", "parent"],
    ["/power-of-attorney", "poa"],
    ["/living-trusts", "trust"],
    ["/wills", "will"],
  ])("%s -> %s", (path, topic) => expect(topicForPath(path)).toBe(topic));
  it("returns nothing for pages with no clear topic", () => expect(topicForPath("/about")).toBeUndefined());
});

describe("fromForPath", () => {
  it("uses the first segment", () => expect(fromForPath("/learn/wills/x?y=1")).toBe("learn"));
  it("names the home page", () => expect(fromForPath("/")).toBe("home"));
  it("always gives a valid slug", () => expect(bookHref(fromForPath("/Ä_ü"))).toMatch(/^\/book(\?from=[a-z0-9-]+)?$/));
});

describe("tool booking", () => {
  it("every free tool has a booking topic and line", () => {
    for (const t of TOOLS) {
      expect(TOOL_BOOKING[t.slug], t.slug).toBeDefined();
      expect(bookHref(`tool-${t.slug}`.slice(0, 60), TOOL_BOOKING[t.slug].topic)).toContain(`topic=${TOOL_BOOKING[t.slug].topic}`);
    }
  });
});

describe("booking experiments", () => {
  it("booking first is the control on content CTAs", () => expect(EXPERIMENTS.cta_primary[0]).toBe("book_first"));
  it("the exit offer keeps the starter kit as control", () => expect(EXPERIMENTS.exit_offer[0]).toBe("starter_kit"));
});

describe("content CTAs offer booking", () => {
  it("the shared end-of-page Cta renders the booking card", () => {
    const ui = readFileSync(join(process.cwd(), "src/components/ui.tsx"), "utf8");
    expect(ui).toMatch(/export function Cta[\s\S]{0,300}<BookCta/);
  });
  it("the site footer links to /book", () => {
    expect(readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8")).toContain('href="/book?from=footer"');
  });
});
