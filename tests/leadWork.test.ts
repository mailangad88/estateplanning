import { describe, expect, it } from "vitest";
import { buildConsentRecord } from "@/lib/consent";
import { ForbiddenError } from "@/server/auth/policy";
import { parseCalcomPayload } from "@/server/calcom";
import { createMemoryDb, type Db } from "@/server/db";
import { intakeQueue } from "@/server/services/intakeQueue";
import { closeLead, logContact, moveStage, recordCalcomBooking, reopenLead } from "@/server/services/leadWork";
import { acceptOffer, offerNext } from "@/server/services/routing";
import type { Actor, Lawyer, Lead } from "@/server/types";

const T0 = new Date("2026-11-07T15:00:00Z");
const mins = (m: number) => new Date(T0.getTime() + m * 60_000);

const sargun: Actor = { userId: "u-sargun", role: "attorney", firmId: "f1", lawyerId: "sargun", mfa: true };
const intake: Actor = { userId: "u-intake", role: "intake", mfa: true };
const admin: Actor = { userId: "u-admin", role: "platform_admin", mfa: true };
const marketing: Actor = { userId: "u-mkt", role: "marketing", mfa: true };

function lawyer(id: string, more: Partial<Lawyer> = {}): Lawyer {
  return {
    id, firmId: "f1", name: "Sargun Singh", email: `${id}@firm.test`, licensedStates: ["IL"], matterTypes: ["new_plan"], specialties: [],
    languages: ["en"], weeklyCapacity: 10, activeLeadCap: 10, acceptSlaMinutes: 60, active: true, primaryIntake: true,
    stats: { avgAcceptMinutes: 10, showRate: 1, reviewScore: 5 }, ...more,
  };
}

function lead(id: string, more: Partial<Lead> = {}): Lead {
  return {
    id, personId: "p1", createdAt: T0.toISOString(), stage: "new", stageHistory: [{ stage: "new", at: T0.toISOString(), by: "system" }], matterType: "new_plan", state: "IL", urgent: false,
    score: { score: 80, tier: "hot", grade: "A", urgent: false, components: [], redFlags: [] }, segments: [], source: {},
    consent: buildConsentRecord({ smsConsent: true, acknowledgedNoRelationship: true, pageUrl: "/x", ip: null, userAgent: null, now: T0 }),
    offerSummary: "s",
    conflictCard: { clientName: "Pat Client", parties: [], matterType: "new_plan", state: "IL", clearance: "clear" },
    intake: { summary: "Married, two kids.", goals: "Guardians", redFlags: [], deadlines: [], household: { members: [] }, assets: {}, answers: {} },
    ...more,
  };
}

async function setup(): Promise<Db> {
  const db = createMemoryDb();
  await db.firms.insert({ id: "f1", name: "Sargun Singh Law", structure: "in_firm" });
  await db.lawyers.insert(lawyer("sargun"));
  for (const u of [
    { id: "u-sargun", email: "s@x.test", name: "Sargun Singh", role: "attorney" as const, firmId: "f1", lawyerId: "sargun", active: true },
    { id: "u-intake", email: "i@x.test", name: "Intake", role: "intake" as const, active: true },
    { id: "u-admin", email: "a@x.test", name: "Admin", role: "platform_admin" as const, active: true },
  ]) await db.users.insert(u);
  await db.persons.insert({ id: "p1", firstName: "Pat", lastName: "Client", email: "pat@x.test", phone: "+15555550100", language: "en", state: "IL" });
  await db.leads.insert(lead("lead1"));
  return db;
}

async function sargunHasIt(db: Db) {
  await db.leads.update("lead1", { stage: "qualified" });
  const { offered } = await offerNext(db, "lead1", T0);
  await acceptOffer(db, sargun, offered!.id, mins(1));
}

describe("logging calls, texts and emails", () => {
  it("counts attempts, claims the lead for intake, and moves it to contacted only once they are reached", async () => {
    const db = await setup();
    const one = await logContact(db, intake, "lead1", { channel: "call", direction: "outbound", result: "voicemail" }, mins(2));
    expect(one.attempts).toBe(1);
    expect(one.lead.stage).toBe("new");
    expect(one.lead.intakeOwnerId).toBe("u-intake");
    const two = await logContact(db, intake, "lead1", { channel: "sms", direction: "outbound", result: "sent", note: "Speed-to-lead text" }, mins(3));
    expect(two.attempts).toBe(2);
    const three = await logContact(db, intake, "lead1", { channel: "call", direction: "inbound", result: "reached" }, mins(30));
    expect(three.attempts).toBe(2); // an incoming call is not an attempt
    expect(three.lead.stage).toBe("contacted");
    const timeline = await db.activities.list((a) => a.leadId === "lead1");
    expect(timeline.map((a) => a.summary)).toEqual(["Call: Left a voicemail", "Text: Sent. Speed-to-lead text", "Call: Spoke with them"]);
  });

  it("the first logged attempt stops the speed-to-lead clock and the queue shows the next attempt", async () => {
    const db = await setup();
    expect((await intakeQueue(db, intake, mins(10)))[0]).toMatchObject({ slaStatus: "breached", nextAction: "Call the lead now" });
    await logContact(db, intake, "lead1", { channel: "call", direction: "outbound", result: "no_answer" }, mins(11));
    expect((await intakeQueue(db, intake, mins(12)))[0]).toMatchObject({ slaStatus: "ok", nextAction: "Not reached yet: try again (attempt 2 of 6)" });
    for (let i = 0; i < 5; i++) await logContact(db, intake, "lead1", { channel: "call", direction: "outbound", result: "voicemail" }, mins(20 + i));
    expect((await intakeQueue(db, intake, mins(30)))[0].nextAction).toMatch(/^No answer after 6 tries/);
  });

  it("rejects mismatched results and people who do not work leads", async () => {
    const db = await setup();
    await expect(logContact(db, intake, "lead1", { channel: "email", direction: "outbound", result: "voicemail" })).rejects.toThrow(/for calls/);
    await expect(logContact(db, intake, "lead1", { channel: "call", direction: "inbound", result: "no_answer" })).rejects.toThrow(/reached you/);
    await expect(logContact(db, marketing, "lead1", { channel: "call", direction: "outbound", result: "reached" })).rejects.toBeInstanceOf(ForbiddenError);
    // Before accepting, the attorney sees the conflict card only.
    await db.leads.update("lead1", { stage: "qualified" });
    await offerNext(db, "lead1", T0);
    await expect(logContact(db, sargun, "lead1", { channel: "call", direction: "outbound", result: "reached" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("the attorney logs calls once they hold the case", async () => {
    const db = await setup();
    await sargunHasIt(db);
    const r = await logContact(db, sargun, "lead1", { channel: "call", direction: "outbound", result: "reached" }, mins(5));
    expect(r.attempts).toBe(1);
  });
});

describe("stages, closing and reopening", () => {
  it("moves forward by hand only", async () => {
    const db = await setup();
    expect((await moveStage(db, intake, "lead1", "qualified", mins(1))).stage).toBe("qualified");
    await expect(moveStage(db, intake, "lead1", "contacted")).rejects.toThrow(/already past/);
  });

  it("closes with a reason and note, and reopens when they come back", async () => {
    const db = await setup();
    const closed = await closeLead(db, intake, "lead1", "unresponsive", "Six tries, no reply", mins(1));
    expect(closed.exit).toMatchObject({ reason: "unresponsive", note: "Six tries, no reply" });
    await expect(moveStage(db, intake, "lead1", "qualified")).rejects.toThrow(/closed/);
    expect((await intakeQueue(db, intake, mins(2))).length).toBe(0);
    const back = await reopenLead(db, admin, "lead1", mins(3));
    expect(back.exit).toBeUndefined();
  });

  it("does not reopen a conflict or an outside referral", async () => {
    const db = await setup();
    await db.leads.update("lead1", { exit: { reason: "conflict", at: T0.toISOString() } });
    await expect(reopenLead(db, admin, "lead1")).rejects.toThrow(/stays closed/);
  });
});

describe("Cal.com bookings", () => {
  const payload = (event: string, startTime?: string) =>
    parseCalcomPayload(JSON.stringify({ triggerEvent: event, payload: { attendees: [{ email: "pat@x.test" }], ...(startTime ? { startTime } : {}) } }))!;

  it("reads the start time", () => {
    expect(payload("BOOKING_CREATED", "2026-11-09T16:00:00Z").startTime).toBe("2026-11-09T16:00:00.000Z");
    expect(payload("BOOKING_CREATED", "nonsense").startTime).toBeUndefined();
  });

  it("a lead who books before anyone called gets a call task on the queue", async () => {
    const db = await setup();
    await recordCalcomBooking(db, (await db.leads.get("lead1"))!, payload("BOOKING_CREATED", "2026-11-09T16:00:00Z"), mins(1));
    expect((await db.leads.get("lead1"))!.stage).toBe("consult_booked");
    const tasks = await db.tasks.list();
    expect(tasks[0].title).toMatch(/^Call before the booked consult/);
    expect((await intakeQueue(db, intake, mins(2))).some((i) => i.kind === "call_task")).toBe(true);
    expect((await db.activities.list())[0].summary).toMatch(/^Booked a consult on Cal.com for Nov 9, 2026, 10:00 AM Central/);
  });

  it("with the attorney holding the case, the consult row is added, moved on reschedule and cancelled with a rebook task", async () => {
    const db = await setup();
    await sargunHasIt(db);
    const get = async () => (await db.leads.get("lead1"))!;
    await recordCalcomBooking(db, await get(), payload("BOOKING_CREATED", "2026-11-09T16:00:00Z"), mins(2));
    let consults = await db.consults.list();
    expect(consults).toHaveLength(1);
    expect(consults[0]).toMatchObject({ lawyerId: "sargun", status: "booked", at: "2026-11-09T16:00:00.000Z" });
    await recordCalcomBooking(db, await get(), payload("BOOKING_RESCHEDULED", "2026-11-10T16:00:00Z"), mins(3));
    consults = await db.consults.list();
    expect(consults).toHaveLength(1);
    expect(consults[0].at).toBe("2026-11-10T16:00:00.000Z");
    await recordCalcomBooking(db, await get(), payload("BOOKING_CANCELLED", "2026-11-10T16:00:00Z"), mins(4));
    expect((await db.consults.list())[0].status).toBe("cancelled");
    expect((await db.tasks.list()).map((t) => t.title)).toContain("Call to rebook the cancelled consult");
  });
});
