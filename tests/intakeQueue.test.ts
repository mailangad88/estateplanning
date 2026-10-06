import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/server/auth/policy";
import { createMemoryDb, type Db } from "@/server/db";
import { ConsoleNotifier, type Notifier, type NotifyMessage } from "@/server/notify";
import { actorFor, DEMO_USERS, seedDemo } from "@/server/seed";
import { claimLead, deliverSlaAlerts, intakeQueue, slaAlerts } from "@/server/services/intakeQueue";
import type { Actor, Lead } from "@/server/types";

const NOW = new Date("2026-10-06T15:00:00Z");
const user = (id: string): Actor => actorFor(DEMO_USERS.find((u) => u.id === id)!);
const ago = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

let db: Db;

async function addLead(id: string, over: Partial<Lead> = {}) {
  await db.leads.insert({
    id,
    personId: "p",
    createdAt: ago(1),
    stage: "new",
    stageHistory: [{ stage: "new", at: ago(1), by: "system" }],
    matterType: "new_plan",
    state: "TX",
    urgent: false,
    score: { score: 50, tier: "B" },
    segments: [],
    source: {},
    ...over,
  } as unknown as Lead);
}

beforeEach(async () => {
  db = createMemoryDb();
  await seedDemo(db, NOW);
  // Keep the queue to leads this test controls.
  for (const l of await db.leads.list()) await db.leads.update(l.id, { exit: { reason: "not_a_fit", at: ago(500) } });
});

describe("intakeQueue", () => {
  it("is restricted to intake and admins", async () => {
    await expect(intakeQueue(db, user("u-marketing"), NOW)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("orders urgent first, then speed-to-lead breaches, then oldest, without contact details", async () => {
    await addLead("q-old", { createdAt: ago(60), stage: "qualified", stageHistory: [{ stage: "contacted", at: ago(55), by: "x" }] });
    await addLead("q-breach", { createdAt: ago(8) });
    await addLead("q-urgent", { createdAt: ago(2), urgent: true });
    await addLead("q-fresh", { createdAt: ago(1) });
    const items = await intakeQueue(db, user("u-intake"), NOW);
    expect(items.map((i) => i.leadId)).toEqual(["q-urgent", "q-breach", "q-old", "q-fresh"]);
    expect(items[1]).toMatchObject({ slaStatus: "breached", minutesWaiting: 8, nextAction: "Call the lead now", ownerName: "Unclaimed" });
    expect(JSON.stringify(items)).not.toMatch(/@|phone|email/i);
  });

  it("includes open call tasks for the actor or unassigned only", async () => {
    await addLead("q-t", { stage: "contacted", stageHistory: [{ stage: "contacted", at: ago(30), by: "x" }], createdAt: ago(30) });
    await db.tasks.insert({ id: "t1", leadId: "q-t", title: "Call: attempt 1", ownerId: "unassigned", dueAt: ago(10) });
    await db.tasks.insert({ id: "t2", leadId: "q-t", title: "Call: attempt 2", ownerId: "u-admin", dueAt: ago(10) });
    const items = await intakeQueue(db, user("u-intake"), NOW);
    expect(items.filter((i) => i.kind === "call_task").map((i) => i.taskId)).toEqual(["t1"]);
  });
});

describe("claimLead", () => {
  it("claims once and refuses a second person", async () => {
    await addLead("c1");
    await claimLead(db, user("u-intake"), "c1", NOW);
    expect((await db.leads.get("c1"))!.intakeOwnerId).toBe("u-intake");
    await claimLead(db, user("u-intake"), "c1", NOW);
    await expect(claimLead(db, user("u-admin"), "c1", NOW)).rejects.toThrow(/already claimed/);
    const events = await db.audit.list((e) => e.action === "intake.claim");
    expect(events).toHaveLength(1);
  });
});

describe("SLA alerts", () => {
  it("raises each kind of alert without client details, and delivers each key once", async () => {
    await addLead("s1", { createdAt: ago(7) });
    await addLead("s2", { createdAt: ago(20), urgent: true, stage: "offered", stageHistory: [{ stage: "contacted", at: ago(19), by: "x" }] });
    await db.assignments.insert({ id: "o1", leadId: "s2", lawyerId: "lawyer-a", firmId: "firm-demo", offeredAt: ago(25), expiresAt: new Date(NOW.getTime() + 5 * 60_000).toISOString(), status: "offered", routingReason: "t" });
    await db.engagements.insert({ id: "e1", leadId: "s1", firmId: "firm-demo", lawyerId: "lawyer-b", packageId: "p", feeCents: 1, status: "sent", provider: "mock", history: [{ status: "sent", at: ago(73 * 60) }], remindersSent: [], documentIds: [] });

    const alerts = await slaAlerts(db, NOW);
    expect(alerts.map((a) => a.kind).sort()).toEqual(["engagement_unsigned", "offer_expiring", "speed_to_lead", "urgent_unaccepted"]);
    expect(alerts.find((a) => a.kind === "speed_to_lead")!.text).toBe("A new lead has waited 7 minutes without a call.");
    expect(alerts.find((a) => a.kind === "offer_expiring")!.to).toEqual(["u-lawyer-a"]);
    expect(alerts.find((a) => a.kind === "urgent_unaccepted")!.to).toEqual(["u-admin"]);
    expect(alerts.find((a) => a.kind === "engagement_unsigned")!.to).toEqual(["u-lawyer-b"]);

    const sent: NotifyMessage[] = [];
    const notifier: Notifier = { send: async (_to, m) => void sent.push(m) };
    expect(await deliverSlaAlerts(db, notifier, NOW)).toBe(4);
    expect(await deliverSlaAlerts(db, notifier, NOW)).toBe(0);
    expect(sent.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(sent)).not.toMatch(/Rivera|Taylor|@example/);
    expect(new ConsoleNotifier().send).toBeTypeOf("function");
  });
});
