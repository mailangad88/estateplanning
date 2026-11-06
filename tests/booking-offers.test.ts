import { describe, expect, it } from "vitest";
import { approvedOffers, BOOKING_OFFERS, offerForPath } from "@/config/booking-offers";
import { BOOK_TOPICS } from "@/lib/book";

const none = new Set<string>();

describe("booking offers", () => {
  it("every offer books a known topic", () => {
    const ids = new Set(BOOK_TOPICS.map((t) => t.id));
    for (const o of BOOKING_OFFERS) expect(ids.has(o.topic), o.id).toBe(true);
  });

  it("every offer that needs Sargun's OK has neutral wording", () => {
    for (const o of BOOKING_OFFERS.filter((x) => x.needsOk)) expect(o.neutral, o.id).toBeDefined();
  });

  it("neutral wording makes no promise about price, length or turnaround", () => {
    for (const o of BOOKING_OFFERS) {
      const copy = o.needsOk ? `${o.neutral!.title} ${o.neutral!.body}` : `${o.title} ${o.body}`;
      expect(copy, o.id).not.toMatch(/\bfree\b|minute|same[- ]day|same week|this week|evening/i);
    }
  });

  it("shows neutral wording until the offer is approved", () => {
    expect(offerForPath("/learn/basics/what-is-a-will", none).title).not.toMatch(/free/i);
    expect(offerForPath("/learn/basics/what-is-a-will", new Set(["fit-call"])).title).toMatch(/free 15-minute/i);
  });

  it("matches audiences from the path", () => {
    expect(offerForPath("/learn/after-a-death/illinois-probate-timeline", none)).toMatchObject({ id: "executor-first-call", topic: "probate", callFirst: true });
    expect(offerForPath("/estate-planning-for/new-parents", none).id).toBe("new-parent-guardian");
    expect(offerForPath("/life-events/caring-for-aging-parents", none).id).toBe("parent-planning-call");
    expect(offerForPath("/learn/illinois/illinois-estate-tax-cliff", none)).toMatchObject({ id: "custom-strategy-call", approved: true });
    expect(offerForPath("/estate-planning-for/blended-families", none).id).toBe("couples-call");
    expect(offerForPath("/about", none).id).toBe("fit-call");
  });

  it("reads approvals from a comma list", () => {
    expect([...approvedOffers(" fit-call, plan-check ,")]).toEqual(["fit-call", "plan-check"]);
    expect(approvedOffers(undefined).size).toBe(0);
  });

  it("leaves out the Spanish-language call until a Spanish-speaking attorney is confirmed", () => {
    expect(BOOKING_OFFERS.some((o) => /spanish|espa/i.test(o.id + o.title))).toBe(false);
  });
});
