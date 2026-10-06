import { describe, it, expect } from "vitest";
import { CRITERIA, defaultImportance, rank, drivers, validateCandidates, candidateLabel, type Candidate, type Crit, type Rating } from "@/lib/tools/guardianPicker";

const all = (n: Rating) => Object.fromEntries(CRITERIA.map((c) => [c, n])) as Record<Crit, Rating>;
const cand = (id: string, ratings: Record<Crit, Rating>, extra: Partial<Candidate> = {}): Candidate => ({ id, label: id, ageBand: "40_54", asked: "yes", ratings, ...extra });

describe("guardian picker", () => {
  it("scores 100, 60 and 20 on the extremes", () => {
    const w = defaultImportance();
    expect(rank(w, [cand("a", all(5))]).scored[0].score).toBe(100);
    expect(rank(w, [cand("a", all(3))]).scored[0].score).toBe(60);
    expect(rank(w, [cand("a", all(1))]).scored[0].score).toBe(20);
  });
  it("weights importance (spec case 4)", () => {
    const w = { ...defaultImportance(), values: 3 as const, location: 1 as const };
    const A = cand("A", { values: 5, health: 4, location: 2, willing: 5, bond: 5, finances: 3, household: 4 });
    const B = cand("B", { values: 4, health: 5, location: 5, willing: 3, bond: 3, finances: 5, household: 3 });
    const r = rank(w, [B, A]);
    expect(r.scored.map((s) => [s.id, s.score])).toEqual([["A", 84], ["B", 79]]);
    expect(r.close).toBe(true);
    expect(r.scored[0].flags).toEqual(["distance"]);
    expect(drivers(w, [A, B]).length).toBe(2);
  });
  it("raises flags", () => {
    const r = rank(defaultImportance(), [cand("a", { ...all(3), willing: 2 }, { ageBand: "70_plus", asked: "no" })]);
    expect(r.scored[0].flags).toEqual(["age_70_plus", "willingness_low", "not_asked"]);
  });
  it("is not close at a 10 point gap and names a backup", () => {
    const w = defaultImportance();
    const r = rank(w, [cand("hi", all(5)), cand("lo", { ...all(4), values: 5, health: 5, location: 5, willing: 5 })]);
    expect(r.close).toBe(false);
    expect(r.backup).toBe("lo");
  });
  it("keeps input order on ties and treats 70, 70, 60 as close", () => {
    const w = defaultImportance();
    const same = all(3);
    const r = rank(w, [cand("x", same), cand("y", same), cand("z", all(2))]);
    expect(r.scored.map((s) => s.id)).toEqual(["x", "y", "z"]);
    expect(r.close).toBe(true);
  });
  it("one candidate has no backup and no drivers; zero candidates is invalid", () => {
    expect(rank(defaultImportance(), [cand("a", all(4))]).backup).toBeNull();
    expect(drivers(defaultImportance(), [cand("a", all(4))])).toEqual([]);
    expect(validateCandidates([])).toBe("Add at least one person");
    expect(candidateLabel({ label: "  " }, 1)).toBe("Person 2");
  });
});
