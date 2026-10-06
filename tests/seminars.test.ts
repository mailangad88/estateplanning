import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/server/auth/policy";
import { createMemoryDb, type Db } from "@/server/db";
import { actorFor, DEMO_USERS, seedDemo } from "@/server/seed";
import { attributesTo, createSeminar, seminarReadouts, updateSeminar } from "@/server/services/seminars";
import type { Actor, Lead, Stage } from "@/server/types";

const NOW = new Date("2026-10-06T15:00:00Z");
const user = (role: string): Actor => actorFor(DEMO_USERS.find((u) => u.role === role)!);
let db: Db;
let template: Lead;

async function lead(id: string, stage: Stage, over: Partial<Lead> = {}) {
  await db.leads.insert({ ...template, id, stage, stageHistory: [{ stage, at: NOW.toISOString(), by: "x" }], source: { utmCampaign: "trusts101" }, segments: [], exit: undefined, ...over });
}

beforeEach(async () => {
  db = createMemoryDb();
  await seedDemo(db, NOW);
  template = (await db.leads.list())[0];
});

const event = { code: "trusts101", title: "Trusts 101", format: "library_talk" as const, heldOn: "2026-10-01", costs: { mail: 200_000, venue: 50_000 }, rsvps: 40, attendees: 28 };

describe("seminar tracker", () => {
  it("lets marketing and platform admins create events, nobody else", async () => {
    await expect(createSeminar(db, user("attorney"), event, NOW)).rejects.toThrow(ForbiddenError);
    await expect(createSeminar(db, user("intake"), event, NOW)).rejects.toThrow(ForbiddenError);
    const s = await createSeminar(db, user("marketing"), event, NOW);
    expect(s.code).toBe("trusts101");
    await expect(createSeminar(db, user("platform_admin"), event, NOW)).rejects.toThrow(/already used/);
    expect((await db.audit.list((e) => e.action === "seminar.create")).length).toBe(1);
  });

  it("validates codes and counts", async () => {
    await expect(createSeminar(db, user("marketing"), { ...event, code: "Bad Code!" }, NOW)).rejects.toThrow();
    await expect(createSeminar(db, user("marketing"), { ...event, attendees: 50 }, NOW)).rejects.toThrow(/cannot exceed/);
    const s = await createSeminar(db, user("marketing"), { ...event, rsvps: 0, attendees: 0 }, NOW);
    await expect(updateSeminar(db, user("marketing"), s.id, { rsvps: 10, attendees: 12 }, NOW)).rejects.toThrow(/cannot exceed/);
    expect((await updateSeminar(db, user("marketing"), s.id, { rsvps: 12, attendees: 9 }, NOW)).attendees).toBe(9);
  });

  it("attributes leads by utm_campaign or seminar tag, case-insensitively", () => {
    expect(attributesTo({ source: { utmCampaign: "Trusts101" }, segments: [] }, "trusts101")).toBe(true);
    expect(attributesTo({ source: {}, segments: ["seminar:trusts101"] }, "trusts101")).toBe(true);
    expect(attributesTo({ source: { utmCampaign: "other" }, segments: [] }, "trusts101")).toBe(false);
  });

  it("computes the readout with totals only and a verdict against the research range", async () => {
    const s = await createSeminar(db, user("marketing"), event, NOW);
    await lead("s-1", "contacted");
    await lead("s-2", "consult_held");
    await lead("s-3", "retainer_signed");
    await lead("s-4", "paid");
    await db.engagements.insert({ id: "e-3", leadId: "s-3", firmId: "f", lawyerId: "l", packageId: "complete", feeCents: 350_000, status: "signed", provider: "mock", history: [], remindersSent: [], documentIds: [] });
    const [r] = await seminarReadouts(db, user("marketing"));
    expect(r.seminar.id).toBe(s.id);
    expect(r.totalCostCents).toBe(250_000);
    expect(r.leads).toBe(4);
    expect(r.consultsHeld).toBe(3);
    expect(r.signed).toBe(2);
    expect(r.cacCents).toBe(125_000);
    expect(r.showRate).toBe(0.7);
    expect(r.costPerAttendeeCents).toBe(Math.round(250_000 / 28));
    expect(r.feesCents).toBe(350_000);
    expect(r.verdict).toMatch(/Inside the research range/);
    expect(JSON.stringify(r)).not.toMatch(/Rivera|Taylor|@/);
  });

  it("says when nothing is signed yet, and refuses readouts to attorneys", async () => {
    await createSeminar(db, user("marketing"), event, NOW);
    expect((await seminarReadouts(db, user("platform_admin")))[0].verdict).toMatch(/No signed clients yet/);
    await expect(seminarReadouts(db, user("attorney"))).rejects.toThrow(ForbiddenError);
  });
});
