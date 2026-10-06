import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/server/auth/policy";
import { funnelReport } from "@/server/analytics";
import { createMemoryDb, type Db } from "@/server/db";
import { actorFor, DEMO_FIRM_ID, DEMO_USERS, seedDemo } from "@/server/seed";
import type { Actor, Lead, Stage } from "@/server/types";

const NOW = new Date("2026-10-06T15:00:00Z");
const FROM = new Date("2026-10-01T00:00:00Z");
const TO = new Date("2026-10-07T00:00:00Z");
const user = (id: string): Actor => actorFor(DEMO_USERS.find((u) => u.id === id)!);
const min = (m: number) => new Date(new Date("2026-10-03T12:00:00Z").getTime() + m * 60_000).toISOString();

let db: Db;
let n = 0;

async function addLead(over: { source?: string; campaign?: string; tool?: string; stages?: Stage[]; firmId?: string; createdMinutes?: number }) {
  n++;
  const stages = over.stages ?? [];
  const lead = {
    id: `t-${n}`,
    personId: "p",
    createdAt: min(over.createdMinutes ?? 0),
    stage: stages.at(-1) ?? "new",
    stageHistory: [{ stage: "new", at: min(0), by: "system" }, ...stages.map((s) => ({ stage: s, at: min(30), by: "x" }))],
    matterType: "new_plan",
    state: "TX",
    urgent: false,
    score: { score: 50, tier: "B" },
    segments: [],
    source: { utmSource: over.source ?? "testsrc", utmCampaign: over.campaign ?? "c1" },
    firmId: over.firmId,
    capture: over.tool ? { tool: over.tool } : undefined,
  } as unknown as Lead;
  await db.leads.insert(lead);
  return lead;
}

beforeEach(async () => {
  db = createMemoryDb();
  await seedDemo(db, NOW);
});

describe("funnelReport", () => {
  it("requires view_reports and scopes firm admins to their firm", async () => {
    await expect(funnelReport(db, user("u-intake"), { from: FROM, to: TO })).rejects.toBeInstanceOf(ForbiddenError);
    await addLead({ firmId: DEMO_FIRM_ID });
    await addLead({ firmId: "other-firm" });
    const r = await funnelReport(db, user("u-firmadmin"), { from: FROM, to: TO, firmId: "other-firm" });
    expect(r.period.firmId).toBe(DEMO_FIRM_ID);
    expect(r.totalLeads).toBe(1);
  });

  it("counts stages reached, suppresses small cells and reports no PII", async () => {
    for (let i = 0; i < 5; i++) await addLead({ stages: i < 3 ? ["contacted", "qualified", "retainer_signed"] : ["contacted"], tool: "plan_finder" });
    await addLead({ source: "tiny", stages: ["retainer_signed"] });
    const r = await funnelReport(db, user("u-marketing"), { from: FROM, to: TO });
    expect(r.stages.find((s) => s.stage === "qualified")!.reached).toBeGreaterThanOrEqual(3);
    const row = r.bySource.find((s) => s.source === "testsrc")!;
    expect(row).toMatchObject({ leads: 5, retainersSigned: 3, signedRate: 0.6 });
    const tiny = r.bySource.find((s) => s.source === "tiny")!;
    expect(tiny.leads).toBe(1);
    expect(tiny.signedRate).toBeNull();
    expect(r.byTool.find((t) => t.tool === "unknown")!.signedRate).toBeNull();
    expect(JSON.stringify(r)).not.toMatch(/@example\.com|Rivera|Taylor/);
  });

  it("computes speed to lead and ROI", async () => {
    await addLead({ stages: ["contacted"], createdMinutes: 0 });
    const fast = await addLead({ createdMinutes: 0 });
    await db.activities.insert({ id: "a1", leadId: fast.id, kind: "call", direction: "outbound", at: min(2), summary: "x" });
    await db.billableEvents.insert({ id: "b1", type: "ad_spend_posted", occurredAt: min(0), amountCents: 100_000 });
    await db.billableEvents.insert({ id: "b2", type: "fee_collected", occurredAt: min(0), amountCents: 400_000 });
    const r = await funnelReport(db, user("u-admin"), { from: FROM, to: TO });
    expect(r.speedToLead.within5MinRate).toBeGreaterThan(0);
    expect(r.speedToLead.medianMinutes).not.toBeNull();
    expect(r.roi).toMatchObject({ adSpendCents: 100_000, revenueCents: 400_000 });
    expect(r.roi.costPerLeadCents).toBe(Math.round(100_000 / r.totalLeads));
  });

  it("summarises offers per lawyer", async () => {
    const l = await addLead({});
    const base = { leadId: l.id, firmId: DEMO_FIRM_ID, expiresAt: min(30), routingReason: "t", offeredAt: min(0) };
    await db.assignments.insert({ ...base, id: "as1", lawyerId: "lawyer-a", status: "accepted", respondedAt: min(10), slaMet: true });
    await db.assignments.insert({ ...base, id: "as2", lawyerId: "lawyer-b", status: "declined", declineReason: "capacity", respondedAt: min(5), slaMet: true });
    await db.assignments.insert({ ...base, id: "as3", lawyerId: "lawyer-b", status: "expired", slaMet: false });
    const r = await funnelReport(db, user("u-admin"), { from: FROM, to: TO });
    expect(r.offers.timeouts).toBeGreaterThanOrEqual(1);
    expect(r.offers.declinesByReason.capacity).toBe(1);
    expect(r.offers.perLawyer.find((x) => x.lawyerId === "lawyer-a")!.medianAcceptMinutes).toBe(10);
  });
});
