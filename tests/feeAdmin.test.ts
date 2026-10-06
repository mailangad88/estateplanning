import { beforeEach, describe, expect, it } from "vitest";
import { feeRules } from "@/config/fees";
import { verifyAuditChain } from "@/server/audit/log";
import { ForbiddenError } from "@/server/auth/policy";
import { createMemoryDb, type Db } from "@/server/db";
import {
  approveInvoice,
  createInvoice,
  creditInvoiceLine,
  currentRuleVersions,
  previewInvoice,
  recordBillableEvent,
  recordCounselApproval,
  ruleHistory,
  saveFeeRule,
  seedFeeRules,
  type FeeRuleInput,
} from "@/server/fees/admin";
import type { Actor } from "@/server/types";

const admin: Actor = { userId: "u-admin", role: "platform_admin", mfa: true };
const attorney: Actor = { userId: "u-a", role: "attorney", firmId: "f1", lawyerId: "l1", mfa: true };
const firmAdmin: Actor = { userId: "u-fa", role: "firm_admin", firmId: "f1", mfa: true };
const counsel = { name: "Ethics Counsel", opinionRef: "OP-2026-1", approvedOn: "2026-02-01" };

const pctInput = (percent: number): FeeRuleInput => ({ id: "percent-of-fee", feeType: "percent_of_fee", percent, effectiveFrom: "2026-01-01" });
const pctRule = feeRules.find((r) => r.id === "percent-of-fee")!;

function setup(structure: "in_firm" | "certified_lrs" | "marketing_services"): Db {
  const db = createMemoryDb();
  db.firms.insert({ id: "f1", name: "Firm", structure });
  db.lawyers.insert({
    id: "l1", firmId: "f1", name: "L", email: "l@x.test", licensedStates: ["TX"], matterTypes: ["new_plan"], specialties: [],
    languages: ["English"], weeklyCapacity: 5, activeLeadCap: 5, acceptSlaMinutes: 30, active: true,
    stats: { avgAcceptMinutes: 1, showRate: 1, reviewScore: 5 },
  });
  seedFeeRules(db, feeRules, structure);
  return db;
}

describe("seedFeeRules", () => {
  it("writes v1 for each config rule, idempotently", () => {
    const db = setup("in_firm");
    for (const r of feeRules) {
      const h = ruleHistory(db, r.id);
      expect(h).toHaveLength(1);
      expect(h[0].version).toBe(1);
      expect(h[0].editedBy).toBe("system");
    }
    seedFeeRules(db, feeRules, "in_firm");
    expect(db.feeRuleVersions.list()).toHaveLength(feeRules.length);
  });

  it("locks every rule under in_firm and invoices nothing", () => {
    const db = setup("in_firm");
    expect(currentRuleVersions(db).every((v) => !v.billable && v.lockReason)).toBe(true);
    recordBillableEvent(db, { type: "fee_collected", occurredAt: "2026-03-10T00:00:00Z", amountCents: 1_000_000, lawyerId: "l1" });
    recordBillableEvent(db, { type: "month_started", occurredAt: "2026-03-01T00:00:00Z" });
    const p = previewInvoice(db, "f1", "2026-03-01", "2026-04-01", "in_firm");
    expect(p.totalCents).toBe(0);
    expect(p.lines).toHaveLength(0);
    expect(p.blockedRules.length).toBeGreaterThan(0);
  });
});

describe("saveFeeRule", () => {
  it("requires platform_admin", () => {
    const db = setup("in_firm");
    expect(() => saveFeeRule(db, attorney, pctInput(30), "r", "in_firm")).toThrow(ForbiddenError);
    expect(() => saveFeeRule(db, firmAdmin, pctInput(30), "r", "in_firm")).toThrow(ForbiddenError);
  });

  it("requires a non-empty reason", () => {
    const db = setup("in_firm");
    expect(() => saveFeeRule(db, admin, pctInput(30), "   ", "in_firm")).toThrow(/reason/i);
  });

  it("editing 50% to 30 creates v2, keeps history, stays locked under in_firm", () => {
    const db = setup("in_firm");
    const v2 = saveFeeRule(db, admin, pctInput(30), "Lower rate", "in_firm");
    expect(v2.version).toBe(2);
    expect(v2.rule.percent).toBe(30);
    expect(v2.billable).toBe(false);
    const h = ruleHistory(db, "percent-of-fee");
    expect(h.map((v) => v.version)).toEqual([1, 2]);
    expect(h[0].rule.percent).toBe(50);
  });
});

describe("recordCounselApproval", () => {
  it("is refused for percent_of_fee under marketing_services and in_firm", () => {
    for (const s of ["marketing_services", "in_firm"] as const) {
      const db = setup(s);
      expect(() => recordCounselApproval(db, admin, "percent-of-fee", counsel, s)).toThrow(/cannot be approved/);
      expect(ruleHistory(db, "percent-of-fee")).toHaveLength(1);
    }
  });

  it("requires platform_admin", () => {
    const db = setup("certified_lrs");
    expect(() => recordCounselApproval(db, attorney, "percent-of-fee", counsel, "certified_lrs")).toThrow(ForbiddenError);
  });

  it("is accepted under certified_lrs and makes the rule billable", () => {
    const db = setup("certified_lrs");
    expect(ruleHistory(db, "percent-of-fee")[0].billable).toBe(false);
    const v = recordCounselApproval(db, admin, "percent-of-fee", counsel, "certified_lrs");
    expect(v.billable).toBe(true);
    expect(v.rule.counselApprovedAt).toBe("2026-02-01");
    expect(v.counsel?.opinionRef).toBe("OP-2026-1");
  });

  it("changing the rate after approval drops the approval; identical terms keep it", () => {
    const db = setup("certified_lrs");
    recordCounselApproval(db, admin, "percent-of-fee", counsel, "certified_lrs");
    const same = saveFeeRule(db, admin, pctInput(50), "No change", "certified_lrs");
    expect(same.billable).toBe(true);
    expect(same.rule.counselApprovedAt).toBe("2026-02-01");
    const changed = saveFeeRule(db, admin, pctInput(40), "Raise?", "certified_lrs");
    expect(changed.billable).toBe(false);
    expect(changed.rule.counselApprovedAt).toBeUndefined();
    expect(changed.counsel).toBeUndefined();
  });
});

describe("invoices", () => {
  function billing() {
    const db = setup("certified_lrs");
    recordCounselApproval(db, admin, "percent-of-fee", counsel, "certified_lrs");
    recordBillableEvent(db, { id: "e1", type: "fee_collected", occurredAt: "2026-03-10T00:00:00Z", amountCents: 1_000_000, lawyerId: "l1" });
    recordBillableEvent(db, { id: "e2", type: "fee_collected", occurredAt: "2026-03-12T00:00:00Z", amountCents: 200_000, lawyerId: "l1" });
    return db;
  }

  it("snapshots ruleVersionId; later edits do not change the stored invoice", () => {
    const db = billing();
    const inv = createInvoice(db, admin, "f1", "2026-03-01", "2026-04-01", "certified_lrs");
    expect(inv.status).toBe("draft");
    expect(inv.totalCents).toBe(600_000);
    expect(inv.lines.every((l) => l.ruleVersionId.startsWith("percent-of-fee@"))).toBe(true);
    const approvedVersion = inv.lines[0].ruleVersionId;
    saveFeeRule(db, admin, pctInput(10), "Cut", "certified_lrs");
    const stored = db.invoices.get(inv.id)!;
    expect(stored.totalCents).toBe(600_000);
    expect(stored.lines[0].ruleVersionId).toBe(approvedVersion);
  });

  it("credits lines, not twice, only on drafts", () => {
    const db = billing();
    const inv = createInvoice(db, admin, "f1", "2026-03-01", "2026-04-01", "certified_lrs");
    const credited = creditInvoiceLine(db, admin, inv.id, "e1", "duplicate");
    expect(credited.totalCents).toBe(100_000);
    expect(credited.credits).toHaveLength(1);
    expect(() => creditInvoiceLine(db, admin, inv.id, "e1", "again")).toThrow(/already credited/);
    expect(() => creditInvoiceLine(db, admin, inv.id, "nope", "x")).toThrow(/No billed line/);
    approveInvoice(db, admin, inv.id);
    expect(() => creditInvoiceLine(db, admin, inv.id, "e2", "late")).toThrow(/draft/);
  });

  it("approveInvoice moves draft to approved, once; non-admin forbidden", () => {
    const db = billing();
    const inv = createInvoice(db, admin, "f1", "2026-03-01", "2026-04-01", "certified_lrs");
    expect(() => approveInvoice(db, attorney, inv.id)).toThrow(ForbiddenError);
    const a = approveInvoice(db, admin, inv.id);
    expect(a.status).toBe("approved");
    expect(a.approvedBy).toBe("u-admin");
    expect(() => approveInvoice(db, admin, inv.id)).toThrow(/approved/);
  });

  it("audit chain verifies", () => {
    const db = billing();
    const inv = createInvoice(db, admin, "f1", "2026-03-01", "2026-04-01", "certified_lrs");
    creditInvoiceLine(db, admin, inv.id, "e1", "dup");
    approveInvoice(db, admin, inv.id);
    saveFeeRule(db, admin, pctInput(20), "x", "certified_lrs");
    const events = db.audit.list();
    expect(events.length).toBeGreaterThanOrEqual(5);
    expect(verifyAuditChain(events).ok).toBe(true);
  });
});
