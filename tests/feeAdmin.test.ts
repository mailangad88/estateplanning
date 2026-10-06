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

async function setup(structure: "in_firm" | "certified_lrs" | "marketing_services"): Promise<Db> {
  const db = createMemoryDb();
  await db.firms.insert({ id: "f1", name: "Firm", structure });
  await db.lawyers.insert({
    id: "l1", firmId: "f1", name: "L", email: "l@x.test", licensedStates: ["TX"], matterTypes: ["new_plan"], specialties: [],
    languages: ["English"], weeklyCapacity: 5, activeLeadCap: 5, acceptSlaMinutes: 30, active: true,
    stats: { avgAcceptMinutes: 1, showRate: 1, reviewScore: 5 },
  });
  await seedFeeRules(db, feeRules, structure);
  return db;
}

describe("seedFeeRules", async () => {
  it("writes v1 for each config rule, idempotently", async () => {
    const db = await setup("in_firm");
    for (const r of feeRules) {
      const h = await ruleHistory(db, r.id);
      expect(h).toHaveLength(1);
      expect(h[0].version).toBe(1);
      expect(h[0].editedBy).toBe("system");
    }
    await seedFeeRules(db, feeRules, "in_firm");
    expect(await db.feeRuleVersions.list()).toHaveLength(feeRules.length);
  });

  it("locks every rule under in_firm and invoices nothing", async () => {
    const db = await setup("in_firm");
    expect((await currentRuleVersions(db)).every((v) => !v.billable && v.lockReason)).toBe(true);
    await recordBillableEvent(db, { type: "fee_collected", occurredAt: "2026-03-10T00:00:00Z", amountCents: 1_000_000, lawyerId: "l1" });
    await recordBillableEvent(db, { type: "month_started", occurredAt: "2026-03-01T00:00:00Z" });
    const p = await previewInvoice(db, "f1", "2026-03-01", "2026-04-01", "in_firm");
    expect(p.totalCents).toBe(0);
    expect(p.lines).toHaveLength(0);
    expect(p.blockedRules.length).toBeGreaterThan(0);
  });
});

describe("saveFeeRule", async () => {
  it("requires platform_admin", async () => {
    const db = await setup("in_firm");
    await expect(saveFeeRule(db, attorney, pctInput(30), "r", "in_firm")).rejects.toThrow(ForbiddenError);
    await expect(saveFeeRule(db, firmAdmin, pctInput(30), "r", "in_firm")).rejects.toThrow(ForbiddenError);
  });

  it("requires a non-empty reason", async () => {
    const db = await setup("in_firm");
    await expect(saveFeeRule(db, admin, pctInput(30), "   ", "in_firm")).rejects.toThrow(/reason/i);
  });

  it("editing 50% to 30 creates v2, keeps history, stays locked under in_firm", async () => {
    const db = await setup("in_firm");
    const v2 = await saveFeeRule(db, admin, pctInput(30), "Lower rate", "in_firm");
    expect(v2.version).toBe(2);
    expect(v2.rule.percent).toBe(30);
    expect(v2.billable).toBe(false);
    const h = await ruleHistory(db, "percent-of-fee");
    expect(h.map((v) => v.version)).toEqual([1, 2]);
    expect(h[0].rule.percent).toBe(50);
  });
});

describe("recordCounselApproval", async () => {
  it("is refused for percent_of_fee under marketing_services and in_firm", async () => {
    for (const s of ["marketing_services", "in_firm"] as const) {
      const db = await setup(s);
      await expect(recordCounselApproval(db, admin, "percent-of-fee", counsel, s)).rejects.toThrow(/cannot be approved/);
      expect(await ruleHistory(db, "percent-of-fee")).toHaveLength(1);
    }
  });

  it("requires platform_admin", async () => {
    const db = await setup("certified_lrs");
    await expect(recordCounselApproval(db, attorney, "percent-of-fee", counsel, "certified_lrs")).rejects.toThrow(ForbiddenError);
  });

  it("is accepted under certified_lrs and makes the rule billable", async () => {
    const db = await setup("certified_lrs");
    expect((await ruleHistory(db, "percent-of-fee"))[0].billable).toBe(false);
    const v = await recordCounselApproval(db, admin, "percent-of-fee", counsel, "certified_lrs");
    expect(v.billable).toBe(true);
    expect(v.rule.counselApprovedAt).toBe("2026-02-01");
    expect(v.counsel?.opinionRef).toBe("OP-2026-1");
  });

  it("changing the rate after approval drops the approval; identical terms keep it", async () => {
    const db = await setup("certified_lrs");
    await recordCounselApproval(db, admin, "percent-of-fee", counsel, "certified_lrs");
    const same = await saveFeeRule(db, admin, pctInput(50), "No change", "certified_lrs");
    expect(same.billable).toBe(true);
    expect(same.rule.counselApprovedAt).toBe("2026-02-01");
    const changed = await saveFeeRule(db, admin, pctInput(40), "Raise?", "certified_lrs");
    expect(changed.billable).toBe(false);
    expect(changed.rule.counselApprovedAt).toBeUndefined();
    expect(changed.counsel).toBeUndefined();
  });
});

describe("invoices", async () => {
  async function billing() {
    const db = await setup("certified_lrs");
    await recordCounselApproval(db, admin, "percent-of-fee", counsel, "certified_lrs");
    await recordBillableEvent(db, { id: "e1", type: "fee_collected", occurredAt: "2026-03-10T00:00:00Z", amountCents: 1_000_000, lawyerId: "l1" });
    await recordBillableEvent(db, { id: "e2", type: "fee_collected", occurredAt: "2026-03-12T00:00:00Z", amountCents: 200_000, lawyerId: "l1" });
    return db;
  }

  it("snapshots ruleVersionId; later edits do not change the stored invoice", async () => {
    const db = await billing();
    const inv = await createInvoice(db, admin, "f1", "2026-03-01", "2026-04-01", "certified_lrs");
    expect(inv.status).toBe("draft");
    expect(inv.totalCents).toBe(600_000);
    expect(inv.lines.every((l) => l.ruleVersionId.startsWith("percent-of-fee@"))).toBe(true);
    const approvedVersion = inv.lines[0].ruleVersionId;
    await saveFeeRule(db, admin, pctInput(10), "Cut", "certified_lrs");
    const stored = (await db.invoices.get(inv.id))!;
    expect(stored.totalCents).toBe(600_000);
    expect(stored.lines[0].ruleVersionId).toBe(approvedVersion);
  });

  it("credits lines, not twice, only on drafts", async () => {
    const db = await billing();
    const inv = await createInvoice(db, admin, "f1", "2026-03-01", "2026-04-01", "certified_lrs");
    const credited = await creditInvoiceLine(db, admin, inv.id, "e1", "duplicate");
    expect(credited.totalCents).toBe(100_000);
    expect(credited.credits).toHaveLength(1);
    await expect(creditInvoiceLine(db, admin, inv.id, "e1", "again")).rejects.toThrow(/already credited/);
    await expect(creditInvoiceLine(db, admin, inv.id, "nope", "x")).rejects.toThrow(/No billed line/);
    await approveInvoice(db, admin, inv.id);
    await expect(creditInvoiceLine(db, admin, inv.id, "e2", "late")).rejects.toThrow(/draft/);
  });

  it("approveInvoice moves draft to approved, once; non-admin forbidden", async () => {
    const db = await billing();
    const inv = await createInvoice(db, admin, "f1", "2026-03-01", "2026-04-01", "certified_lrs");
    await expect(approveInvoice(db, attorney, inv.id)).rejects.toThrow(ForbiddenError);
    const a = await approveInvoice(db, admin, inv.id);
    expect(a.status).toBe("approved");
    expect(a.approvedBy).toBe("u-admin");
    await expect(approveInvoice(db, admin, inv.id)).rejects.toThrow(/approved/);
  });

  it("audit chain verifies", async () => {
    const db = await billing();
    const inv = await createInvoice(db, admin, "f1", "2026-03-01", "2026-04-01", "certified_lrs");
    await creditInvoiceLine(db, admin, inv.id, "e1", "dup");
    await approveInvoice(db, admin, inv.id);
    await saveFeeRule(db, admin, pctInput(20), "x", "certified_lrs");
    const events = await db.audit.list();
    expect(events.length).toBeGreaterThanOrEqual(5);
    expect(verifyAuditChain(events).ok).toBe(true);
  });
});
