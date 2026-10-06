import { describe, it, expect } from "vitest";
import { addMonths, inheritanceTimeline, validateDeathDate, parseDate, CLAIMS_PERIOD, CONTEST_PERIOD, type TimelineInput } from "@/lib/tools/inheritanceTimeline";

const base = (o: Partial<TimelineInput>): TimelineInput => ({ deathDate: "2026-03-15", route: "probate_independent", disputes: false, estateTax: false, ...o });
const ids = (o: Partial<TimelineInput>) => inheritanceTimeline(base(o)).phases.map((p) => p.id);

describe("date math", () => {
  it("adds months", () => expect(addMonths("2026-03-15", 6)).toBe("2026-09-15"));
  it("clamps month end", () => expect(addMonths("2026-08-31", 6)).toBe("2027-02-28"));
  it("handles leap year", () => expect(addMonths("2023-08-31", 6)).toBe("2024-02-29"));
  it("rolls year", () => expect(addMonths("2026-11-30", 6)).toBe("2027-05-30"));
  it("validates dates", () => {
    const today = new Date("2026-10-06T00:00:00Z");
    expect(validateDeathDate("2026-02-30", today)).not.toBeNull();
    expect(validateDeathDate("2027-01-01", today)).not.toBeNull();
    expect(validateDeathDate("2026-01-01", today)).toBeNull();
    expect(parseDate("nope")).toBeNull();
  });
});

describe("statute facts unverified", () => {
  it("shows no date while confidence is not high", () => {
    expect(CLAIMS_PERIOD.confidence).toBe("unverified");
    expect(CONTEST_PERIOD.confidence).toBe("unverified");
    const r = inheritanceTimeline(base({ admissionDate: "2026-04-01", publicationDate: "2026-04-20" }));
    for (const id of ["claims", "contest"]) {
      const p = r.phases.find((x) => x.id === id)!;
      expect(p.endDate).toBeUndefined();
      expect(p.unverifiedStatute).toBe(true);
      expect(p.cite).toMatch(/755 ILCS/);
    }
  });
  it("never leaks a number in the range label", () => {
    const r = inheritanceTimeline(base({}));
    expect(r.phases.find((p) => p.id === "claims")!.range).not.toMatch(/\d/);
  });
});

describe("routes", () => {
  it("beneficiary is quick, no probate phases", () => {
    const r = inheritanceTimeline(base({ route: "beneficiary" }));
    expect(r.overall).toBe("weeks");
    expect(ids({ route: "beneficiary" })).not.toContain("claims");
  });
  it("joint and small estate are quick", () => {
    expect(inheritanceTimeline(base({ route: "joint" })).overall).toBe("weeks");
    expect(inheritanceTimeline(base({ route: "small_estate" })).overall).toBe("weeks");
  });
  it("trust has no court claims or contest bars", () => {
    const x = ids({ route: "trust" });
    expect(x).toContain("distribute");
    expect(x).not.toContain("claims");
    expect(inheritanceTimeline(base({ route: "trust" })).overall).toBe("months");
  });
  it("probate has statute phases", () => {
    const x = ids({});
    expect(x).toEqual(expect.arrayContaining(["open", "claims", "contest", "distribute"]));
  });
  it("supervised is longer than independent", () => {
    expect(inheritanceTimeline(base({ route: "probate_supervised" })).overall).toBe("year_plus");
    expect(inheritanceTimeline(base({})).overall).toBe("months");
  });
});

describe("flags", () => {
  it("estate tax adds a phase and lengthens quick routes", () => {
    const r = inheritanceTimeline(base({ route: "beneficiary", estateTax: true }));
    expect(r.phases.map((p) => p.id)).toContain("estate_tax");
    expect(r.overall).toBe("months");
  });
  it("disputes push to a year or more", () => {
    const r = inheritanceTimeline(base({ disputes: true }));
    expect(r.overall).toBe("year_plus");
    expect(r.phases.map((p) => p.id)).toContain("dispute");
  });
  it("no banned words", () => {
    const all = JSON.stringify(inheritanceTimeline(base({ disputes: true, estateTax: true })));
    expect(all).not.toMatch(/expert|specialist|guarantee|—/i);
  });
});
