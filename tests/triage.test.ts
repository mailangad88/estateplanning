import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAutomations } from "@/server/automation";
import { createMemoryDb, type Db } from "@/server/db";
import { actorFor, DEMO_USERS, seedDemo } from "@/server/seed";
import { intakeQueue, slaAlerts } from "@/server/services/intakeQueue";
import { AFTER_DEATH_TASK_PREFIX, applyTriage, triageLead } from "@/server/services/triage";
import type { Lead } from "@/server/types";

const NOW = new Date("2026-10-06T15:00:00Z");
const ago = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const base = { matterType: "new_plan", segments: [] as string[], capture: undefined, intake: undefined } as unknown as Lead;

let db: Db;

async function addLead(id: string, over: Partial<Lead> = {}) {
  await db.leads.insert({
    id, personId: "p", createdAt: ago(1), stage: "new", stageHistory: [{ stage: "new", at: ago(1), by: "system" }],
    matterType: "new_plan", state: "TX", urgent: false, score: { score: 50, tier: "warm", redFlags: [] }, segments: [], source: {},
    consent: {}, offerSummary: "", conflictCard: { clientName: "x", parties: [], matterType: "new_plan", state: "TX", clearance: "pending" },
    intake: { summary: "", redFlags: [], deadlines: [], household: { members: [] }, assets: {}, answers: {} },
    ...over,
  } as unknown as Lead);
  await db.audit.appendWith?.((prev) => ({ id: `ev-${id}`, seq: (prev?.seq ?? 0) + 1, at: NOW.toISOString(), actorId: "system", actorRole: "system", action: "lead.create", resourceType: "lead", resourceId: id, leadId: id, prevHash: prev?.hash ?? "", hash: "" }) as never);
}

beforeEach(async () => {
  db = createMemoryDb();
  await seedDemo(db, NOW);
  for (const l of await db.leads.list()) await db.leads.update(l.id, { exit: { reason: "not_a_fit", at: ago(500) } });
});

afterEach(() => {
  delete process.env.PORTAL_PRACTICE_MATTERS;
});

describe("triageLead", () => {
  it("puts estate administration and heir-mode tool leads in the after-death lane", () => {
    expect(triageLead({ ...base, matterType: "administration" }).lane).toBe("after_death");
    expect(triageLead({ ...base, segments: ["estate_administration"] }).lane).toBe("after_death");
    expect(triageLead({ ...base, capture: { tool: "probate_calculator", result: { mode: "heir" } } } as unknown as Lead).callWithinMinutes).toBe(60);
  });

  it("prioritizes Medicaid, caregiver, estate tax and large estates", () => {
    expect(triageLead({ ...base, matterType: "elder_law" })).toEqual({ lane: "priority", reasons: ["Medicaid or long-term care"] });
    expect(triageLead({ ...base, segments: ["caregiver", "medicaid_planning_interest"] }).reasons).toEqual(["Medicaid or long-term care"]);
    expect(triageLead({ ...base, intake: { assets: { range: "over_5m" } } } as unknown as Lead).reasons).toEqual(["Possible estate tax"]);
    expect(triageLead(base).lane).toBe("standard");
  });

  it("turns away only matters outside a configured practice list, never after-death families", () => {
    expect(triageLead({ ...base, matterType: "business_succession" }).lane).toBe("standard");
    expect(triageLead({ ...base, matterType: "business_succession" }, ["new_plan"]).lane).toBe("out_of_practice");
    expect(triageLead({ ...base, matterType: "administration" }, ["new_plan"]).lane).toBe("after_death");
  });
});

describe("applyTriage", () => {
  it("opens one one-hour call task for an after-death lead, once", async () => {
    await addLead("d1", { matterType: "administration" });
    await applyTriage(db, "d1", NOW);
    await applyTriage(db, "d1", NOW);
    const tasks = await db.tasks.list((t) => t.leadId === "d1");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title.startsWith(AFTER_DEATH_TASK_PREFIX)).toBe(true);
    expect(tasks[0].dueAt).toBe(new Date(NOW.getTime() + 60 * 60_000).toISOString());
  });

  it("closes out-of-practice leads before nurture enrollment", async () => {
    process.env.PORTAL_PRACTICE_MATTERS = "new_plan,update_plan,administration";
    await addLead("x1", { matterType: "business_succession" });
    await runAutomations(db, null, NOW);
    expect((await db.leads.get("x1"))?.exit?.note).toBe("Outside the firm's practice");
    expect(await db.enrollments.list((e) => e.leadId === "x1")).toHaveLength(0);
  });

  it("enrolls after-death leads only in the grief track", async () => {
    await addLead("d2", { segments: ["estate_administration"] });
    await runAutomations(db, null, NOW);
    expect((await db.enrollments.list((e) => e.leadId === "d2")).map((e) => e.sequenceId)).toEqual(["grief_support"]);
    expect(await db.tasks.list((t) => t.leadId === "d2")).toHaveLength(1);
  });
});

describe("queue and alerts", () => {
  it("orders after-death ahead of breaches and priority ahead of standard", async () => {
    await addLead("std", { createdAt: ago(3) });
    await addLead("pri", { createdAt: ago(2), matterType: "elder_law" });
    await addLead("late", { createdAt: ago(9) });
    await addLead("death", { createdAt: ago(1), matterType: "administration" });
    const q = (await intakeQueue(db, actorFor(DEMO_USERS.find((u) => u.id === "u-intake")!), NOW)).filter((i) => i.kind === "lead");
    expect(q.map((i) => i.leadId)).toEqual(["death", "late", "pri", "std"]);
    expect(q[0].nextAction).toMatch(/within the hour/);
    expect(q[0].slaStatus).toBe("ok");
    expect(q[2].laneReasons).toEqual(["Medicaid or long-term care"]);
  });

  it("alerts intake and the platform admin at once for an after-death lead, with no case facts", async () => {
    await addLead("death", { createdAt: ago(1), matterType: "administration" });
    const alerts = (await slaAlerts(db, NOW)).filter((a) => a.leadId === "death");
    expect(alerts.map((a) => a.kind)).toContain("after_death");
    const first = alerts.find((a) => a.key === "after-death:death")!;
    expect(first.to).toContain("u-admin");
    expect(first.to).toContain("u-intake");
    expect(alerts.some((a) => a.kind === "speed_to_lead")).toBe(false);
    const onCall = alerts.find((a) => a.key === "after-death-oncall:death")!;
    expect(onCall.to.length).toBeGreaterThan(0);
    expect(onCall.link).toBe("/portal");
    expect(JSON.stringify(alerts)).not.toMatch(/Rivera|Taylor|@/);
  });

  it("raises a speed-to-lead breach for an after-death lead only after the hour", async () => {
    await addLead("death", { createdAt: ago(61), matterType: "administration" });
    expect((await slaAlerts(db, NOW)).some((a) => a.kind === "speed_to_lead" && a.leadId === "death")).toBe(true);
  });
});
