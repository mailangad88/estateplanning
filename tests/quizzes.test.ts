import { describe, expect, it } from "vitest";
import { getMagnet } from "@/lib/magnets";
import { bandFor, getQuizzes, maxPoints } from "@/lib/quizzes";

describe("quizzes", () => {
  const quizzes = getQuizzes();

  it("exist and point at a real free resource", () => {
    expect(quizzes.length).toBeGreaterThanOrEqual(5);
    for (const q of quizzes) expect(getMagnet(q.magnet), q.slug).toBeDefined();
  });

  it("have bands covering every possible score exactly once", () => {
    for (const q of quizzes) {
      for (let s = 0; s <= maxPoints(q); s++) {
        expect(q.bands.filter((b) => s >= b.min && s <= b.max).length, `${q.slug} score ${s}`).toBe(1);
      }
      expect(bandFor(q, maxPoints(q))).toBeDefined();
    }
  });

  it("explain every question, without editorial markers or em dashes", () => {
    for (const q of quizzes) {
      expect(q.reviewed).toBe(false);
      for (const x of q.questions) {
        expect(x.explanation.length, `${q.slug}/${x.id}`).toBeGreaterThan(60);
        expect(x.options.length).toBeGreaterThanOrEqual(2);
        expect(`${x.prompt} ${x.explanation}`).not.toMatch(/<!--|—/);
      }
      if (q.kind === "knowledge") for (const x of q.questions) expect(x.options.filter((o) => o.points > 0).length, `${q.slug}/${x.id}`).toBe(1);
    }
  });
});
