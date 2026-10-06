import { beforeEach, describe, expect, it, vi } from "vitest";
import { HubSpotAdapter } from "@/server/crm/hubspot";
import { LawmaticsAdapter } from "@/server/crm/lawmatics";
import { applyCrmEvent, CRM_EVENT_WINDOW_MS, parseCrmEvent, signCrmEvent, verifyCrmEvent } from "@/server/crm/events";
import { MockCrmAdapter } from "@/server/crm/mock";
import { buildNurtureState } from "@/server/crm/nurtureState";
import { CrmSync } from "@/server/crm/sync";
import { createMemoryDb, type Db } from "@/server/db";
import { isSuppressed } from "@/server/nurture/compliance";
import { nurtureOwnerFromEnv } from "@/server/nurture/owner";
import { enroll } from "@/server/nurture/scheduler";
import { LogEmailTransport, LogSmsTransport } from "@/server/notify/transports";
import { runNurtureSends, unsubscribeToken, type TemplateSource } from "@/server/nurture/sender";
import { unsubscribeWithToken } from "@/server/nurture/unsubscribe";
import type { Lead } from "@/server/types";

const T0 = new Date("2026-10-06T15:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
let db: Db;

const templates: TemplateSource = {
  render: async (_d, templateKey, channel, vars) => ({ templateKey, templateVersion: "1", subject: channel === "email" ? "Hi" : undefined, text: `Hi ${vars.firstName}` }),
};

async function seed(segments: string[] = [], leadId = "l1", personId = "p1", email = "ana@example.test") {
  await db.persons.insert({ id: personId, firstName: "Ana", lastName: "Q", email, phone: "+15125550100", language: "English", state: "TX" });
  await db.leads.insert({
    id: leadId, personId, createdAt: T0.toISOString(), stage: "new", stageHistory: [{ stage: "new", at: T0.toISOString(), by: "system" }],
    matterType: "new_plan", state: "TX", urgent: false, score: { score: 50, tier: "warm", grade: "B", urgent: false, components: [], redFlags: [] },
    segments, source: {}, consent: { version: "v1", smsConsent: true, smsConsentText: "x", acknowledgedNoRelationship: true, pageUrl: "", ip: null, userAgent: null, capturedAt: "" },
    offerSummary: "", conflictCard: { clientName: "Ana Q", parties: [], matterType: "new_plan", state: "TX", clearance: "pending" },
    intake: { summary: "", redFlags: [], deadlines: [], household: { members: [] }, assets: {}, answers: {} },
  } as unknown as Lead);
}

beforeEach(async () => {
  db = createMemoryDb();
  await seed();
  await enroll(db, "l1", "speed_to_lead", T0);
});

describe("NURTURE_OWNER", () => {
  it("defaults to internal and only honors crm with a live adapter", () => {
    expect(nurtureOwnerFromEnv({})).toBe("internal");
    expect(nurtureOwnerFromEnv({ NURTURE_OWNER: "crm" })).toBe("internal"); // no token
    expect(nurtureOwnerFromEnv({ NURTURE_OWNER: "crm", CRM_PROVIDER: "mock" })).toBe("internal");
    expect(nurtureOwnerFromEnv({ NURTURE_OWNER: "crm", LAWMATICS_API_TOKEN: "t" })).toBe("crm");
    expect(nurtureOwnerFromEnv({ NURTURE_OWNER: "crm", CRM_PROVIDER: "hubspot", HUBSPOT_PRIVATE_APP_TOKEN: "t" })).toBe("crm");
    expect(() => nurtureOwnerFromEnv({ NURTURE_OWNER: "both" })).toThrow();
  });

  it("owner=crm sends no email or SMS but still creates call tasks", async () => {
    const email = new LogEmailTransport(false);
    const sms = new LogSmsTransport(false);
    const sendE = vi.spyOn(email, "send");
    const sendS = vi.spyOn(sms, "send");
    const r = await runNurtureSends(db, { templates, email, sms, baseUrl: "https://x.test", owner: "crm" }, at(10));
    expect(r.owner).toBe("crm");
    expect(r.callTasks).toBe(1);
    expect(r.crmOwned).toBeGreaterThan(0);
    expect(r.sent + r.dryRun).toBe(0);
    expect(sendE).not.toHaveBeenCalled();
    expect(sendS).not.toHaveBeenCalled();
    expect(await db.tasks.list((t) => t.leadId === "l1")).toHaveLength(1);
    // enrollment stays active: it is the sequence tag the CRM keys on
    expect((await db.enrollments.list((e) => e.leadId === "l1"))[0].status).toBe("active");
  });
});

describe("nurture state push", () => {
  it("pushes sequence, consent and stage flags with no sensitive segment names", async () => {
    await db.leads.update("l1", { segments: ["quiz:x", "caregiver"], stage: "consult_booked" });
    const crm = new MockCrmAdapter();
    expect(await new CrmSync(crm).syncNurtureState(db, "l1")).toBe(true);
    const state = [...crm.nurtureStates.values()][0];
    expect(state).toMatchObject({ sequences: ["speed_to_lead"], sequenceGroup: "A", emailConsent: true, smsConsent: true, consultBooked: true, consultHeld: false, retainerSigned: false, griefTrack: false, doNotMarket: false });
    expect(state.segments).toEqual(["quiz:x"]);
    expect(JSON.stringify(state)).not.toContain("caregiver");
  });

  it("flags grief leads and retainer signed so the CRM never markets", async () => {
    await seed(["estate_administration"], "l2", "p2", "b@example.test");
    const g = await buildNurtureState(db, "l2");
    expect(g).toMatchObject({ griefTrack: true, doNotMarket: true });
    await db.leads.update("l1", { stage: "retainer_signed" });
    expect(await buildNurtureState(db, "l1")).toMatchObject({ retainerSigned: true, consultHeld: true, doNotMarket: true });
  });

  it("an unsubscribe link records locally and pushes the suppression to the CRM", async () => {
    const crm = new MockCrmAdapter();
    const sync = new CrmSync(crm);
    await sync.syncLead(db, "l1");
    const ok = await unsubscribeWithToken(db, unsubscribeToken("p1", "email"), at(1), sync);
    expect(ok).toBe(true);
    expect(await isSuppressed(db, "email", { email: "ana@example.test", phone: "+15125550100" })).toBe(true);
    const state = [...crm.nurtureStates.values()].at(-1)!;
    expect(state.emailSuppressed).toBe(true);
    expect(state.smsSuppressed).toBe(false);
  });

  it("a CRM outage does not undo the unsubscribe", async () => {
    const crm = new MockCrmAdapter();
    const sync = new CrmSync(crm, { maxAttempts: 1, sleep: async () => {} });
    await sync.syncLead(db, "l1");
    crm.failWith = [new Error("down")];
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await unsubscribeWithToken(db, unsubscribeToken("p1", "email"), at(1), sync)).toBe(true);
    expect(await isSuppressed(db, "email", { email: "ana@example.test", phone: "" })).toBe(true);
  });
});

describe("adapters (mock fetch, no live calls)", () => {
  const state = { contactEmail: "ana@example.test", sequences: ["quiz_follow_up"], segments: [], emailConsent: true, smsConsent: false, emailSuppressed: true, smsSuppressed: false, griefTrack: false, consultBooked: false, consultHeld: false, retainerSigned: false, doNotMarket: false };
  const res = (body: unknown) => ({ ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(body) }) as unknown as Response;

  it("Lawmatics sends tags and custom fields", async () => {
    const f = vi.fn(async () => res({}));
    await new LawmaticsAdapter({ token: "t", fetchImpl: f as unknown as typeof fetch }).pushNurtureState!("9", state);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/prospects/9");
    const body = JSON.parse(init.body as string);
    expect(body.tags).toContain("ep-seq-quiz_follow_up");
    expect(body.tags).toContain("ep-email-suppressed");
    expect(body.custom_fields.ep_email_suppressed).toBe("true");
  });

  it("HubSpot patches the deal and the contact opt-out", async () => {
    const f = vi.fn(async (url: string) => res(url.includes("/search") ? { results: [{ id: "c1" }] } : {}));
    await new HubSpotAdapter({ token: "t", fetchImpl: f as unknown as typeof fetch }).pushNurtureState!("d1", state);
    const urls = f.mock.calls.map((c) => (c as unknown as [string])[0]);
    expect(urls.some((u) => u.endsWith("/deals/d1"))).toBe(true);
    const contactCall = f.mock.calls.find((c) => (c as unknown as [string])[0].endsWith("/contacts/c1")) as unknown as [string, RequestInit];
    expect(JSON.parse(contactCall[1].body as string).properties.hs_email_optout).toBe("true");
  });
});

describe("POST /api/crm/events signature", () => {
  const secret = "s3cret";
  const now = T0.getTime();
  const raw = JSON.stringify({ type: "unsubscribe", email: "Ana@Example.test" });
  const ts = String(Math.floor(now / 1000));

  it("accepts a good signature", () => {
    expect(verifyCrmEvent(raw, signCrmEvent(raw, ts, secret), ts, secret, now)).toBe(true);
  });
  it("rejects bad signature, tampered body, wrong secret and missing secret", () => {
    expect(verifyCrmEvent(raw, "00".repeat(32), ts, secret, now)).toBe(false);
    expect(verifyCrmEvent(raw + " ", signCrmEvent(raw, ts, secret), ts, secret, now)).toBe(false);
    expect(verifyCrmEvent(raw, signCrmEvent(raw, ts, "other"), ts, secret, now)).toBe(false);
    expect(verifyCrmEvent(raw, signCrmEvent(raw, ts, secret), ts, undefined, now)).toBe(false);
    expect(verifyCrmEvent(raw, "zz", ts, secret, now)).toBe(false);
    expect(verifyCrmEvent(raw, null, ts, secret, now)).toBe(false);
  });
  it("rejects a replay outside the window, even with a valid signature", () => {
    const old = String(Math.floor((now - CRM_EVENT_WINDOW_MS - 1000) / 1000));
    expect(verifyCrmEvent(raw, signCrmEvent(raw, old, secret), old, secret, now)).toBe(false);
    const future = String(Math.floor((now + CRM_EVENT_WINDOW_MS + 1000) / 1000));
    expect(verifyCrmEvent(raw, signCrmEvent(raw, future, secret), future, secret, now)).toBe(false);
  });
  it("a timestamp swapped in after signing fails", () => {
    const old = String(Math.floor((now - 3_600_000) / 1000));
    expect(verifyCrmEvent(raw, signCrmEvent(raw, old, secret), ts, secret, now)).toBe(false);
  });

  it("records unsubscribe, bounce and complaint locally", async () => {
    await applyCrmEvent(db, parseCrmEvent(raw)!, at(1));
    expect(await isSuppressed(db, "email", { email: "ana@example.test", phone: "" })).toBe(true);
    await applyCrmEvent(db, parseCrmEvent(JSON.stringify({ type: "unsubscribe", channel: "sms", phone: "+15125550100" }))!, at(2));
    expect(await db.suppressions.get("sms:5125550100")).toBeDefined();
    await applyCrmEvent(db, parseCrmEvent(JSON.stringify({ type: "bounce", email: "bad@example.test" }))!, at(3));
    expect((await db.suppressions.get("email:bad@example.test"))?.reason).toBe("crm:bounce");
    await applyCrmEvent(db, parseCrmEvent(JSON.stringify({ type: "complaint", email: "c@example.test" }))!, at(4));
    expect((await db.suppressions.get("email:c@example.test"))?.reason).toBe("crm:complaint");
    expect(parseCrmEvent("{}")).toBeNull();
    expect(parseCrmEvent("nope")).toBeNull();
  });
});
