import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bookHref, bookingNotes, parseBookParams } from "@/lib/book";

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
