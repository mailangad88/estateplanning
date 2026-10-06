import { describe, expect, it } from "vitest";
import {
  ANNUAL_INDEXING,
  CHANGE_DATES,
  factRegistry,
  factRows,
  factStatus,
  gatedFactValue,
  getFact,
  isPublishable,
  normalizeAsOf,
  publishGateOn,
  stalenessAlerts,
  type Fact,
  type FactVerification,
} from "@/lib/facts";
import { FIGURE_DETAILS } from "@/config/figures";
import { verifyAuditChain } from "@/server/audit/log";
import { can, ForbiddenError } from "@/server/auth/policy";
import { createMemoryDb } from "@/server/db";
import { approveFact, factAlerts, listFactRows, publishableFactIds } from "@/server/facts/verify";
import type { Actor, Role } from "@/server/types";

const NOW = new Date("2026-10-06T12:00:00Z");
const actor = (role: Role, userId = `u-${role}`): Actor => ({ userId, role, firmId: "f1", lawyerId: "l1", mfa: true });

const fact = (over: Partial<Fact> = {}): Fact => ({
  id: "state.XX.test", kind: "state_fact", state: "XX", label: "Test", value: "$100", source: "https://example.test",
  asOf: "2026-10-06", confidence: "medium", dollar: true, ...over,
});
const approval = (f: Fact, over: Partial<FactVerification> = {}): FactVerification => ({
  id: `${f.id}@1`, factId: f.id, version: 1, approvedValue: f.value, approvedBy: "u-attorney", approvedAt: "2026-10-06T12:00:00.000Z", note: "", ...over,
});

describe("fact registry", () => {
  const reg = factRegistry();

  it("has unique, stable ids in the documented shape", () => {
    const ids = reg.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of reg) expect(f.id).toMatch(f.kind === "federal_figure" ? /^federal\.\w+$/ : /^state\.[A-Z]{2}\.[a-z_]+$/);
    expect(getFact("state.CA.small_estate_threshold")?.value).toContain("$208,850");
    expect(getFact("federal.federalExemption")?.value).toBe("15000000");
  });

  it("covers every federal figure and all ten states", () => {
    for (const key of Object.keys(FIGURE_DETAILS)) expect(getFact(`federal.${key}`), key).toBeTruthy();
    expect(new Set(reg.filter((f) => f.state).map((f) => f.state)).size).toBe(10);
  });

  it("gives every fact a value, a source and an ISO as_of", () => {
    for (const f of reg) {
      expect(f.value, f.id).not.toBe("");
      expect(f.source, f.id).not.toBe("");
      expect(f.asOf, f.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("flags dollar figures", () => {
    expect(getFact("state.CA.small_estate_threshold")?.dollar).toBe(true);
    expect(getFact("state.CA.community_property")?.dollar).toBe(false);
  });

  it("carries the known change dates and indexing rules", () => {
    expect(getFact("state.CA.small_estate_threshold")?.changeDate).toBe("2028-04-01");
    expect(getFact("state.MI.small_estate_threshold")?.annualIndexing).toBe(true);
    for (const id of Object.keys(CHANGE_DATES)) expect(getFact(id), id).toBeTruthy();
    for (const id of ANNUAL_INDEXING) expect(getFact(id), id).toBeTruthy();
  });

  it("turns a bare tax year into a date", () => {
    expect(normalizeAsOf("2025")).toBe("2025-01-01");
    expect(normalizeAsOf("2026-10-06")).toBe("2026-10-06");
  });
});

describe("staleness rules", () => {
  const kinds = (f: Fact, v: FactVerification | undefined, now: Date) => stalenessAlerts(f, v, now).map((a) => a.kind);

  it("a fresh fact has no alerts", () => {
    expect(kinds(fact(), undefined, NOW)).toEqual([]);
  });

  it("as_of over 12 months old is stale, exactly 12 months is not", () => {
    expect(kinds(fact({ asOf: "2025-10-06" }), undefined, NOW)).toEqual([]);
    expect(kinds(fact({ asOf: "2025-10-05" }), undefined, NOW)).toEqual(["as_of_stale"]);
  });

  it("a recent approval of the current value refreshes the 12 month clock, an approval of an old value does not", () => {
    const f = fact({ asOf: "2024-01-01" });
    expect(kinds(f, approval(f), NOW)).toEqual([]);
    expect(kinds(f, approval(f, { approvedValue: "$90" }), NOW)).toEqual(["as_of_stale"]);
  });

  it("a change date within 60 days warns, further out does not", () => {
    expect(kinds(fact({ changeDate: "2026-12-05" }), undefined, NOW)).toEqual(["change_date_soon"]);
    expect(kinds(fact({ changeDate: "2026-12-06" }), undefined, NOW)).toEqual([]);
  });

  it("a passed change date expires the fact unless it was confirmed after the date", () => {
    const f = fact({ asOf: "2028-03-01", changeDate: "2028-04-01" });
    const later = new Date("2028-04-02T00:00:00Z");
    const a = stalenessAlerts(f, undefined, later);
    expect(a.map((x) => [x.kind, x.severity])).toEqual([["change_date_passed", "expired"]]);
    expect(kinds({ ...f, asOf: "2028-04-02" }, undefined, later)).toEqual([]);
    expect(kinds(f, approval(f, { approvedAt: "2028-04-02T00:00:00Z" }), later)).toEqual([]);
  });

  it("the real CA threshold alerts 60 days before 2028-04-01 and expires after it", () => {
    const ca = getFact("state.CA.small_estate_threshold")!;
    expect(kinds(ca, approval(ca), new Date("2028-02-01T00:00:00Z"))).toContain("change_date_soon");
    expect(kinds(ca, approval(ca), new Date("2028-04-01T00:00:00Z"))).toContain("change_date_passed");
  });

  it("annual-indexing facts expire on January 1 and warn in the 60 days before", () => {
    const mi = fact({ annualIndexing: true, asOf: "2026-10-06" });
    expect(kinds(mi, undefined, new Date("2026-11-01T00:00:00Z"))).toEqual([]);
    expect(kinds(mi, undefined, new Date("2026-11-02T00:00:00Z"))).toEqual(["indexing_soon"]);
    const jan = new Date("2027-01-01T00:00:00Z");
    expect(stalenessAlerts(mi, undefined, jan).map((a) => [a.kind, a.severity])).toEqual([["indexing_due", "expired"]]);
    // re-confirmed in January: fine until the next one
    expect(kinds(mi, approval(mi, { approvedAt: "2027-01-05T00:00:00Z" }), new Date("2027-02-01T00:00:00Z"))).toEqual([]);
  });

  it("the 2025 gift exclusion is already stale and past its January re-index", () => {
    const gift = getFact("federal.annualGiftExclusion")!;
    expect(kinds(gift, undefined, NOW)).toEqual(expect.arrayContaining(["as_of_stale", "indexing_due"]));
  });
});

describe("status and publish gate", () => {
  const f = fact();

  it("unapproved facts are pending and never publishable", () => {
    expect(factStatus(f, undefined, NOW)).toBe("pending");
    expect(isPublishable(f, undefined, NOW)).toBe(false);
  });

  it("an approved, unchanged, current fact is publishable", () => {
    expect(factStatus(f, approval(f), NOW)).toBe("approved");
    expect(isPublishable(f, approval(f), NOW)).toBe(true);
  });

  it("a value changed after approval is 'changed' and unpublishable until re-approved", () => {
    const v = approval(f);
    const changed = { ...f, value: "$120" };
    expect(factStatus(changed, v, NOW)).toBe("changed");
    expect(isPublishable(changed, v, NOW)).toBe(false);
    expect(isPublishable(changed, approval(changed, { id: "x@2", version: 2 }), NOW)).toBe(true);
  });

  it("old as_of makes a fact stale but does not unpublish it; an expired change date does both", () => {
    const old = fact({ asOf: "2024-01-01" });
    const v = approval(old, { approvedAt: "2024-02-01T00:00:00Z" });
    expect(factStatus(old, v, NOW)).toBe("stale");
    expect(isPublishable(old, v, NOW)).toBe(true);
    const due = fact({ changeDate: "2026-09-01", asOf: "2026-01-01" });
    const dv = approval(due, { approvedAt: "2026-02-01T00:00:00Z" });
    expect(factStatus(due, dv, NOW)).toBe("stale");
    expect(isPublishable(due, dv, NOW)).toBe(false);
  });

  it("the gate is off by default and gatedFactValue only hides unapproved facts when it is on", () => {
    const id = "state.CA.small_estate_threshold";
    const value = getFact(id)!.value;
    expect(publishGateOn({})).toBe(false);
    expect(publishGateOn({ REQUIRE_ATTORNEY_REVIEW: "true" })).toBe(true);
    expect(gatedFactValue(id, [], NOW, {})).toBe(value);
    expect(gatedFactValue(id, [], NOW, { REQUIRE_ATTORNEY_REVIEW: "true" })).toBeUndefined();
    const v = approval(getFact(id)!, { id: `${id}@1`, approvedAt: NOW.toISOString() });
    expect(gatedFactValue(id, [v], NOW, { REQUIRE_ATTORNEY_REVIEW: "true" })).toBe(value);
    expect(gatedFactValue("nope", [], NOW, {})).toBeUndefined();
  });

  it("uses the latest version when several approvals exist", () => {
    const v1 = approval(f, { approvedValue: "$90" });
    const v2 = approval(f, { id: `${f.id}@2`, version: 2 });
    expect(isPublishable(f, [v1, v2].reduce((a, b) => (b.version > a.version ? b : a)), NOW)).toBe(true);
    const rows = factRows([v1, v2], NOW);
    expect(rows.length).toBe(factRegistry().length);
  });
});

describe("permissions", () => {
  it("only attorneys and platform admins can verify facts", () => {
    const roles: Role[] = ["platform_admin", "attorney", "firm_admin", "paralegal", "intake", "marketing", "client"];
    expect(roles.filter((r) => can(actor(r), "verify_facts"))).toEqual(["platform_admin", "attorney"]);
  });
});

describe("approval service", () => {
  const id = "state.CA.small_estate_threshold";
  const value = () => getFact(id)!.value;

  it("records an approval with approver, date and note, and audits it", async () => {
    const db = createMemoryDb();
    const v = await approveFact(db, actor("attorney"), { factId: id, value: value(), note: "Checked leginfo" }, NOW);
    expect(v).toMatchObject({ id: `${id}@1`, version: 1, approvedBy: "u-attorney", approvedAt: NOW.toISOString(), note: "Checked leginfo", approvedValue: value() });
    const events = await db.audit.list();
    expect(events.map((e) => [e.action, e.resourceType, e.resourceId, e.actorId])).toEqual([["fact.approve", "fact", id, "u-attorney"]]);
    expect(verifyAuditChain(events).ok).toBe(true);
    expect((await publishableFactIds(db, NOW)).has(id)).toBe(true);
  });

  it("a second approval is a new version and keeps the first", async () => {
    const db = createMemoryDb();
    await approveFact(db, actor("attorney"), { factId: id, value: value() }, NOW);
    const v2 = await approveFact(db, actor("platform_admin"), { factId: id, value: value() }, NOW);
    expect(v2.version).toBe(2);
    expect((await db.factVerifications.list()).length).toBe(2);
    expect((await db.audit.list()).length).toBe(2);
  });

  it("refuses everyone else, without writing or auditing", async () => {
    const db = createMemoryDb();
    for (const role of ["firm_admin", "paralegal", "intake", "marketing", "client"] as const) {
      await expect(approveFact(db, actor(role), { factId: id, value: value() }, NOW), role).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listFactRows(db, actor(role), NOW), role).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.factVerifications.list()).toEqual([]);
    expect(await db.audit.list()).toEqual([]);
  });

  it("rejects unknown facts and values that are not the current one", async () => {
    const db = createMemoryDb();
    await expect(approveFact(db, actor("attorney"), { factId: "state.ZZ.nope", value: "x" }, NOW)).rejects.toThrow(/Unknown fact/);
    await expect(approveFact(db, actor("attorney"), { factId: id, value: "$1" }, NOW)).rejects.toThrow(/changed while you were reviewing/);
    expect(await db.factVerifications.list()).toEqual([]);
  });

  it("needs a source note for facts the research marked unverified", async () => {
    const db = createMemoryDb();
    const unverified = factRegistry().find((f) => f.confidence === "unverified")!;
    await expect(approveFact(db, actor("attorney"), { factId: unverified.id, value: unverified.value }, NOW)).rejects.toThrow(/note/);
    await approveFact(db, actor("attorney"), { factId: unverified.id, value: unverified.value, note: "CMS notice" }, NOW);
  });

  it("lists pending facts first and reports alerts for the cron sweep", async () => {
    const db = createMemoryDb();
    const rows = await listFactRows(db, actor("attorney"), NOW);
    expect(rows.every((r) => r.status === "pending")).toBe(true);
    expect(rows.some((r) => r.publishable)).toBe(false);
    // Today: the 2025 figures are stale and the 2026 indexing is coming up; expired ones sort first.
    const alerts = await factAlerts(db, NOW);
    expect(alerts.length).toBeGreaterThan(0);
    const firstWarning = alerts.findIndex((a) => a.severity === "warning");
    expect(alerts.slice(firstWarning < 0 ? alerts.length : firstWarning).every((a) => a.severity === "warning")).toBe(true);
    expect(alerts.some((a) => a.factId === "federal.annualGiftExclusion" && a.kind === "indexing_due")).toBe(true);
    // CA's 2028 change shows up 60 days ahead
    const near = await factAlerts(db, new Date("2028-02-15T00:00:00Z"));
    expect(near.some((a) => a.factId === "state.CA.small_estate_threshold" && a.kind === "change_date_soon")).toBe(true);
  });
});
