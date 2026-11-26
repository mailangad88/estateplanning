import { beforeEach, describe, expect, it } from "vitest";
import { commissionFor, DEFAULT_COMMISSION } from "@/lib/commission";
import { ForbiddenError } from "@/server/auth/policy";
import { createMemoryDb, type Db } from "@/server/db";
import { actorFor, DEMO_FIRM_ID, DEMO_USERS, seedDemo } from "@/server/seed";
import { caseCommission, commissionCsv, commissionReport, markCommissionPaid, setCommissionRule } from "@/server/services/commissions";
import type { Actor, Lead } from "@/server/types";

const NOW = new Date("2026-11-26T15:00:00Z");
const user = (id: string): Actor => actorFor(DEMO_USERS.find((u) => u.id === id)!, true);
const para2: Actor = { userId: "u-para-2", role: "paralegal", firmId: DEMO_FIRM_ID, supportsLawyerIds: ["lawyer-a"], mfa: true };
const pkg = (p: string) => ({ answers: { package: p }, startedAt: NOW.toISOString(), startedBy: "u-lawyer-a", updatedAt: NOW.toISOString(), updatedBy: "u-lawyer-a" });

let db: Db;
async function caseLead(id: string, stage: Lead["stage"], extra: Partial<Lead>) {
  const base = (await db.leads.get("lead-0001"))!;
  await db.leads.insert({ ...structuredClone(base), id, stage, stageHistory: [{ stage, at: NOW.toISOString(), by: "x" }], firmId: DEMO_FIRM_ID, assignedLawyerId: "lawyer-a", ...extra });
}

beforeEach(async () => {
  db = createMemoryDb();
  await seedDemo(db, NOW);
  await db.users.insert({ id: "u-para-2", email: "p2@example.com", name: "Drew Paralegal", role: "paralegal", firmId: DEMO_FIRM_ID, active: true });
  await caseLead("c-open", "drafting", { assignedParalegalId: "u-paralegal", questionnaire: pkg("Second tier ($3,500)") });
  await caseLead("c-closed", "plan_complete", { assignedParalegalId: "u-paralegal", questionnaire: pkg("Basic ($2,500)") });
  await caseLead("c-drew", "plan_complete", { assignedParalegalId: "u-para-2", questionnaire: pkg("Second tier ($3,500)") });
});

describe("commissionFor", () => {
  it("uses the firm default percent of the package fee, pending until the file closes", () => {
    const line = commissionFor({ stage: "drafting", questionnaire: pkg("Second tier ($3,500)") });
    expect(line).toMatchObject({ mode: "percent", percent: DEFAULT_COMMISSION.percent, feeCents: 350_000, feeSource: "package", status: "pending", isDefault: true });
    expect(line.amountCents).toBe(350_000 * DEFAULT_COMMISSION.percent / 100);
  });
  it("prefers the retainer fee, honours a flat rule, and pays nothing on a case that ended early", () => {
    expect(commissionFor({ stage: "paid", questionnaire: pkg("Basic ($2,500)"), commission: { mode: "percent", percent: 12 } }, 400_000).amountCents).toBe(48_000);
    expect(commissionFor({ stage: "plan_complete", commission: { mode: "flat", flatCents: 30_000 } })).toMatchObject({ amountCents: 30_000, status: "earned" });
    expect(commissionFor({ stage: "consult_held", exit: { reason: "unresponsive", at: NOW.toISOString() } }).amountCents).toBe(0);
  });
});

describe("commission report", () => {
  it("totals per paralegal for the office", async () => {
    const r = await commissionReport(db, user("u-firmadmin"), {}, NOW);
    const casey = r.totals.find((t) => t.paralegalId === "u-paralegal")!;
    expect(casey).toMatchObject({ cases: 2, pendingCents: 35_000, earnedCents: 25_000, paidCents: 0 });
    expect(r.all.earnedCents).toBe(25_000 + 35_000);
  });
  it("shows a paralegal only their own commission", async () => {
    const mine = await commissionReport(db, user("u-paralegal"), {}, NOW);
    expect(mine.rows.map((x) => x.leadId).sort()).toEqual(["c-closed", "c-open"]);
    expect(mine.totals.map((t) => t.paralegalId)).toEqual(["u-paralegal"]);
    expect(await caseCommission(db, para2, "c-open", NOW)).toBeUndefined();
  });
  it("keeps intake and marketing out", async () => {
    for (const id of ["u-intake", "u-marketing"]) await expect(commissionReport(db, user(id), {}, NOW)).rejects.toThrow(ForbiddenError);
  });
});

describe("rules and payouts", () => {
  it("lets the attorney or office set the rule, never the paralegal", async () => {
    await setCommissionRule(db, user("u-lawyer-a"), "c-open", { mode: "flat", flatCents: 50_000 }, NOW);
    expect((await caseCommission(db, user("u-paralegal"), "c-open", NOW))?.line.amountCents).toBe(50_000);
    await expect(setCommissionRule(db, user("u-paralegal"), "c-open", { mode: "percent", percent: 50 }, NOW)).rejects.toThrow(ForbiddenError);
    await expect(setCommissionRule(db, user("u-firmadmin"), "c-open", { mode: "percent", percent: 80 }, NOW)).rejects.toThrow(/between 0 and 50/);
    await setCommissionRule(db, user("u-firmadmin"), "c-open", { mode: "default" }, NOW);
    expect((await caseCommission(db, user("u-firmadmin"), "c-open", NOW))?.line.isDefault).toBe(true);
  });

  it("lets only the office record a payout, once earned, and locks the rule after", async () => {
    await expect(markCommissionPaid(db, user("u-firmadmin"), "c-open", false, NOW)).rejects.toThrow(/earned when the file is closed/);
    await expect(markCommissionPaid(db, user("u-lawyer-a"), "c-closed", false, NOW)).rejects.toThrow(ForbiddenError);
    const lead = await markCommissionPaid(db, user("u-firmadmin"), "c-closed", false, NOW);
    expect(lead.commission).toMatchObject({ paidCents: 25_000, paidTo: "u-paralegal", paidBy: "u-firmadmin" });
    await expect(setCommissionRule(db, user("u-firmadmin"), "c-closed", { mode: "flat", flatCents: 1 }, NOW)).rejects.toThrow(/already paid/);
    // reassigning the case later does not move a paid commission
    await db.leads.update("c-closed", { assignedParalegalId: "u-para-2" });
    const r = await commissionReport(db, user("u-firmadmin"), {}, NOW);
    expect(r.totals.find((t) => t.paralegalId === "u-paralegal")!.paidCents).toBe(25_000);
    await markCommissionPaid(db, user("u-firmadmin"), "c-closed", true, NOW);
    expect((await db.leads.get("c-closed"))!.commission?.paidAt).toBeUndefined();
  });

  it("exports CSV for the office only, with formulas defused", async () => {
    const person = (await db.leads.get("c-open"))!.personId;
    await db.persons.update(person, { firstName: "=HYPERLINK(1)" });
    const csv = await commissionCsv(db, user("u-firmadmin"), NOW);
    expect(csv.split("\n")[0]).toBe("case,client,paralegal,attorney,rule,fee,commission,status,closed,paid");
    expect(csv).toContain("'=HYPERLINK(1)");
    await expect(commissionCsv(db, user("u-paralegal"), NOW)).rejects.toThrow(ForbiddenError);
  });
});
