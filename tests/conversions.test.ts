import { describe, expect, it, vi } from "vitest";
import { buildConsentRecord } from "@/lib/consent";
import { leadSubmissionSchema } from "@/lib/lead";
import { metaBrowserIds } from "@/lib/visitor";
import { ForbiddenError } from "@/server/auth/policy";
import { clickIds, conversionTimes, platformsFor } from "@/server/conversions/events";
import { e164, googleCsv, googleRow, googleTime, metaCsv, metaEvent, normalizeEmailForGoogle, sha256 } from "@/server/conversions/format";
import { GoogleAdsUploader, MetaCapiUploader, MockUploader, googleUploaderFromEnv, metaUploaderFromEnv, ConversionConfigError } from "@/server/conversions/providers";
import {
  MAX_ATTEMPTS,
  conversionsReport,
  exportConversionsCsv,
  resolveUploaders,
  retryAbandonedConversions,
  sweepConversions,
  type GoogleItem,
} from "@/server/conversions/sweep";
import { createMemoryDb, type Db } from "@/server/db";
import { applyOptOut } from "@/server/nurture/compliance";
import { actorFor, DEMO_USERS } from "@/server/seed";
import type { Lead, MatterType, Person, Stage } from "@/server/types";
import type { MetaEvent } from "@/server/conversions/format";

const T0 = new Date("2026-10-06T17:00:00Z");
const DAY = 86_400_000;
const at = (days: number) => new Date(T0.getTime() + days * DAY).toISOString();
const admin = actorFor(DEMO_USERS.find((u) => u.id === "u-admin")!);
const marketing = actorFor(DEMO_USERS.find((u) => u.id === "u-marketing")!);

const GCLID = "Cj0KCQjw-test_gclid-123";
const FBCLID = "IwAR0-test_fbclid-456";
const FBP = "fb.1.1696000000000.1234567890";

interface Opts {
  id?: string;
  source?: Lead["source"];
  stages?: [Stage, number][];
  segments?: string[];
  matterType?: MatterType;
  marketingConsent?: boolean;
  email?: string;
  phone?: string;
  capture?: Lead["capture"];
}

async function addLead(db: Db, o: Opts = {}): Promise<Lead> {
  const id = o.id ?? "l1";
  const person: Person = { id: `p-${id}`, firstName: "Dana", lastName: "Lee", email: o.email ?? `dana.${id}@example.com`, phone: o.phone ?? "5125550100", language: "English", state: "TX" };
  await db.persons.insert(person);
  const consent = buildConsentRecord({ smsConsent: true, acknowledgedNoRelationship: true, pageUrl: "https://x.test", ip: null, userAgent: null, now: T0 });
  const matterType = o.matterType ?? "new_plan";
  const stages = o.stages ?? [["qualified", 0]];
  const lead: Lead = {
    id,
    personId: person.id,
    createdAt: T0.toISOString(),
    stage: stages.at(-1)![0],
    stageHistory: [{ stage: "new", at: T0.toISOString(), by: "system" }, ...stages.map(([stage, d]) => ({ stage, at: at(d), by: "u" }))],
    matterType,
    state: "TX",
    urgent: false,
    score: { score: 60, tier: "warm", grade: "B", urgent: false, components: [], redFlags: [] },
    segments: o.segments ?? [],
    source: o.source ?? { gclid: GCLID },
    consent: { ...consent, ...(o.marketingConsent === undefined ? {} : { marketingConsent: o.marketingConsent }) },
    offerSummary: "",
    conflictCard: { clientName: "Dana Lee", parties: [], matterType, state: "TX", clearance: "pending" },
    intake: { summary: "", redFlags: [], deadlines: [], household: { members: [] }, assets: {}, answers: {} },
    capture: o.capture,
  };
  await db.leads.insert(lead);
  return lead;
}

async function addEngagement(db: Db, leadId: string, feeCents: number, status: "signed" | "draft" = "signed") {
  await db.engagements.insert({
    id: `e-${leadId}`, leadId, firmId: "f", lawyerId: "lw", packageId: "pk", feeCents, status, provider: "mock",
    history: [{ status, at: at(5) }], remindersSent: [], documentIds: [],
  });
}

function mocks() {
  return { google_ads: new MockUploader<GoogleItem>("google_ads"), meta: new MockUploader<MetaEvent>("meta") };
}

describe("click ids on the lead source", () => {
  it("the lead form schema accepts gclid, gbraid, wbraid, fbclid, fbc and fbp", () => {
    const parsed = leadSubmissionSchema.parse({
      firstName: "Ana", email: "ana@example.com", phone: "5125550100", state: "TX", smsConsent: false, acknowledgedNoRelationship: true,
      source: { gclid: "a", gbraid: "b", wbraid: "c", fbclid: "d", fbc: "fb.1.1696000000000.d", fbp: FBP },
    });
    expect(parsed.source).toMatchObject({ gclid: "a", gbraid: "b", wbraid: "c", fbclid: "d", fbc: "fb.1.1696000000000.d", fbp: FBP });
  });

  it("rebuilds _fbc from fbclid in Meta's format when the pixel cookie is absent", () => {
    expect(metaBrowserIds("abc123XYZ", 1_696_000_000_000)).toEqual({ fbc: "fb.1.1696000000000.abc123XYZ" });
    expect(metaBrowserIds(undefined)).toEqual({});
  });

  it("ignores malformed ids from the URL", async () => {
    const db = createMemoryDb();
    const l = await addLead(db, { source: { gclid: "=cmd|x", gbraid: "short", fbp: "nope", fbclid: "<script>" } });
    expect(clickIds(l)).toEqual({ gclid: undefined, gbraid: undefined, wbraid: undefined, fbc: undefined, fbp: undefined });
    expect(platformsFor(l)).toEqual([]);
  });

  it("routes a lead to the platform whose click id it carries", async () => {
    const db = createMemoryDb();
    expect(platformsFor(await addLead(db, { id: "a", source: { gclid: GCLID } }))).toEqual(["google_ads"]);
    expect(platformsFor(await addLead(db, { id: "b", source: { fbclid: FBCLID } }))).toEqual(["meta"]);
    expect(platformsFor(await addLead(db, { id: "c", source: { wbraid: "wbraid-12345", fbp: FBP } }))).toEqual(["google_ads", "meta"]);
    expect(platformsFor(await addLead(db, { id: "d", source: { utmSource: "google" } }))).toEqual([]);
  });
});

describe("formatting", () => {
  it("normalizes and hashes with SHA-256", () => {
    expect(normalizeEmailForGoogle("  Jane.Doe+x@Gmail.COM ")).toBe("janedoe+x@gmail.com");
    expect(normalizeEmailForGoogle("Jane.Doe@example.com")).toBe("jane.doe@example.com");
    expect(e164("(512) 555-0100")).toBe("+15125550100");
    expect(e164("15125550100")).toBe("+15125550100");
    expect(e164("555")).toBeUndefined();
    expect(sha256("a@b.co")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("writes Google conversion time with an explicit offset", () => {
    expect(googleTime("2026-10-06T17:00:00Z")).toBe("2026-10-06 17:00:00+00:00");
    expect(googleTime("2026-10-06T17:00:00Z", "America/New_York")).toBe("2026-10-06 13:00:00-04:00");
    expect(googleTime("2026-01-06T17:00:00Z", "America/Chicago")).toBe("2026-01-06 11:00:00-06:00");
  });

  it("builds a Google row with hashed enhanced-conversion identifiers", async () => {
    const db = createMemoryDb();
    const lead = await addLead(db, { email: "Dana.Lee@Example.com" });
    const person = (await db.persons.get(lead.personId))!;
    const row = googleRow({ lead, person, type: "retainer_signed", occurredAt: at(5), valueCents: 250_000 }, "America/Chicago")!;
    expect(row).toMatchObject({
      clickIdKind: "gclid", clickId: GCLID, conversionName: "EP Retainer Signed", conversionTime: "2026-10-11 12:00:00-05:00", value: 2500, currency: "USD",
      orderId: "ep-l1-retainer_signed", hashedEmail: sha256("dana.lee@example.com"), hashedPhone: sha256("+15125550100"),
    });
    expect(JSON.stringify(row)).not.toMatch(/example\.com|5125550100/);
  });

  it("builds a Meta event: system_generated, hashed user_data, fbc/fbp and a dedupe event_id", async () => {
    const db = createMemoryDb();
    const lead = await addLead(db, { source: { fbclid: FBCLID, fbp: FBP } });
    const person = (await db.persons.get(lead.personId))!;
    const ev = metaEvent({ lead, person, type: "consult_booked", occurredAt: at(1) })!;
    expect(ev).toMatchObject({ event_name: "Schedule", event_time: Math.floor(Date.parse(at(1)) / 1000), event_id: "ep-l1-consult_booked", action_source: "system_generated" });
    expect(ev.user_data.em).toEqual([sha256("dana.l1@example.com")]);
    expect(ev.user_data.ph).toEqual([sha256("15125550100")]);
    expect(ev.user_data.fbp).toBe(FBP);
    expect(ev.user_data.fbc).toBe(`fb.1.${Date.parse(T0.toISOString())}.${FBCLID}`);
    expect(ev.custom_data).toMatchObject({ currency: "USD", event_source: "crm" });
    expect("value" in ev.custom_data).toBe(false);
    expect(JSON.stringify(ev)).not.toMatch(/dana|example\.com|new_plan/i);
    expect(metaEvent({ lead, person, type: "consult_held", occurredAt: at(2) }, { inPerson: true })!.action_source).toBe("physical_store");
  });

  it("maps stages to conversions even when a stage was skipped", async () => {
    const db = createMemoryDb();
    const l = await addLead(db, { stages: [["consult_booked", 1], ["retainer_signed", 4]] });
    expect(conversionTimes(l)).toEqual({ qualified_lead: at(1), consult_booked: at(1), consult_held: at(4), retainer_signed: at(4) });
  });

  it("CSV files carry one click-id type and hashes only", async () => {
    const db = createMemoryDb();
    const lead = await addLead(db);
    const person = (await db.persons.get(lead.personId))!;
    const g = googleRow({ lead, person, type: "qualified_lead", occurredAt: at(0) })!;
    const csv = googleCsv([g, { ...g, clickIdKind: "gbraid", clickId: "gb-12345678" }], "gclid");
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency,Order ID,Email,Phone Number");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(GCLID);
    expect(googleCsv([g], "gbraid").trim().split("\r\n")).toHaveLength(1);
    const m = metaEvent({ lead: { ...lead, source: { fbp: FBP } }, person, type: "qualified_lead", occurredAt: at(0) })!;
    expect(metaCsv([m]).trim().split("\r\n")[0]).toMatch(/^event_name,event_time,event_id,action_source,email,phone/);
  });
});

describe("sweepConversions", () => {
  it("sends each conversion once, with the engagement fee on retainer signed", async () => {
    const db = createMemoryDb();
    await addLead(db, { stages: [["qualified", 0], ["consult_booked", 1], ["consult_held", 3], ["retainer_signed", 5]] });
    await addEngagement(db, "l1", 450_000);
    const u = mocks();
    const now = new Date(T0.getTime() + 5 * DAY + 3_600_000);
    const first = await sweepConversions(db, { now, uploaders: u });
    expect(first).toMatchObject({ queued: 4, sent: 4, failed: 0, refused: [] });
    expect(u.google_ads.uploads.map((x) => x.payload.conversionName)).toEqual(["EP Qualified Lead", "EP Consult Booked", "EP Consult Held", "EP Retainer Signed"]);
    expect(u.google_ads.uploads.at(-1)!.payload.value).toBe(4500);
    expect(u.google_ads.uploads[0].payload.value).toBeUndefined();
    expect(u.meta.uploads).toHaveLength(0); // no Meta click id
    // Run again: nothing new is queued or sent.
    const second = await sweepConversions(db, { now, uploaders: u });
    expect(second).toMatchObject({ queued: 0, sent: 0 });
    expect(u.google_ads.uploads).toHaveLength(4);
    const log = await db.conversionEvents.list();
    expect(log.every((e) => e.status === "sent" && e.channel === "mock")).toBe(true);
    expect(log.find((e) => e.type === "retainer_signed")!.valueCents).toBe(450_000);
    expect((await db.audit.list((e) => e.action === "conversion.sent")).length).toBe(4);
  });

  it("an engagement that is not signed gives no value", async () => {
    const db = createMemoryDb();
    await addLead(db, { stages: [["retainer_signed", 1]] });
    await addEngagement(db, "l1", 450_000, "draft");
    const u = mocks();
    await sweepConversions(db, { now: new Date(at(2)), uploaders: u });
    expect(u.google_ads.uploads.find((x) => x.payload.conversionName === "EP Retainer Signed")!.payload.value).toBeUndefined();
  });

  it("sends a new stage later without resending earlier ones", async () => {
    const db = createMemoryDb();
    await addLead(db);
    const u = mocks();
    await sweepConversions(db, { now: new Date(at(1)), uploaders: u });
    await db.leads.update("l1", { stage: "consult_booked", stageHistory: [...(await db.leads.get("l1"))!.stageHistory, { stage: "consult_booked", at: at(2), by: "u" }] });
    const r = await sweepConversions(db, { now: new Date(at(3)), uploaders: u });
    expect(r.sent).toBe(1);
    expect(u.google_ads.uploads.map((x) => x.payload.conversionName)).toEqual(["EP Qualified Lead", "EP Consult Booked"]);
  });

  it("routes to Meta with the same dedupe id", async () => {
    const db = createMemoryDb();
    await addLead(db, { source: { gclid: GCLID, fbclid: FBCLID, fbp: FBP }, stages: [["consult_booked", 1]] });
    const u = mocks();
    await sweepConversions(db, { now: new Date(at(2)), uploaders: u });
    expect(u.meta.uploads.map((x) => [x.payload.event_name, x.payload.event_id])).toEqual([["Lead", "ep-l1-qualified_lead"], ["Schedule", "ep-l1-consult_booked"]]);
    expect(u.google_ads.uploads.map((x) => x.payload.orderId)).toEqual(["ep-l1-qualified_lead", "ep-l1-consult_booked"]);
  });

  it("does nothing for leads without an ad click id", async () => {
    const db = createMemoryDb();
    await addLead(db, { source: { utmSource: "google", utmMedium: "organic" } });
    const u = mocks();
    expect(await sweepConversions(db, { now: new Date(at(1)), uploaders: u })).toMatchObject({ queued: 0, sent: 0, skipped: 0 });
    expect(await db.conversionEvents.list()).toHaveLength(0);
  });

  it("skips leads that declined ad measurement, and says why in the log", async () => {
    const db = createMemoryDb();
    await addLead(db, { marketingConsent: false });
    await addLead(db, { id: "l2", marketingConsent: true });
    const u = mocks();
    const r = await sweepConversions(db, { now: new Date(at(1)), uploaders: u });
    expect(r).toMatchObject({ queued: 1, skipped: 1, sent: 1 });
    expect((await db.conversionEvents.get("google_ads:qualified_lead:l1"))).toMatchObject({ status: "skipped", reason: "no_ads_consent" });
    expect(u.google_ads.uploads.map((x) => x.id)).toEqual(["google_ads:qualified_lead:l2"]);
  });

  it("never sends health or sensitive segments, matters or heir-mode leads", async () => {
    const db = createMemoryDb();
    await addLead(db, { id: "s1", segments: ["special_needs"] });
    await addLead(db, { id: "s2", segments: ["widowed"] });
    await addLead(db, { id: "s3", segments: ["caregiver"] });
    await addLead(db, { id: "s4", matterType: "administration" });
    await addLead(db, { id: "s5", capture: { tool: "cost_calculator", result: { mode: "heir" } } });
    await addLead(db, { id: "s6", matterType: "elder_law" });
    await addLead(db, { id: "ok", segments: ["homeowner"] });
    const u = mocks();
    const r = await sweepConversions(db, { now: new Date(at(1)), uploaders: u });
    expect(r.sent).toBe(1);
    expect(u.google_ads.uploads.map((x) => x.id)).toEqual(["google_ads:qualified_lead:ok"]);
    expect((await db.conversionEvents.list((e) => e.status === "skipped")).every((e) => e.reason === "sensitive_segment")).toBe(true);
    expect(JSON.stringify(u.google_ads.uploads)).not.toMatch(/homeowner|special_needs|widowed/);
  });

  it("re-checks sensitivity and do-not-contact at send time", async () => {
    const db = createMemoryDb();
    const lead = await addLead(db);
    await addLead(db, { id: "l2" });
    const u = mocks();
    // Queue only, then the lead gains a sensitive tag and another opts out of everything before the upload.
    const { queueConversions } = await import("@/server/conversions/sweep");
    await queueConversions(db, new Date(at(1)));
    await db.leads.update(lead.id, { segments: ["estate_administration"] });
    await applyOptOut(db, { channel: "sms", address: "5125550100", text: "do not contact me", at: T0 });
    const r = await sweepConversions(db, { now: new Date(at(1)), uploaders: u });
    expect(r.sent).toBe(0);
    expect((await db.conversionEvents.get("google_ads:qualified_lead:l1"))!.reason).toBe("sensitive_segment");
    expect((await db.conversionEvents.get("google_ads:qualified_lead:l2"))!.reason).toBe("do_not_contact");
  });

  it("does not send conversions Meta would reject as too old, and logs them", async () => {
    const db = createMemoryDb();
    await addLead(db, { source: { fbp: FBP, gclid: GCLID } });
    const u = mocks();
    await sweepConversions(db, { now: new Date(at(10)), uploaders: u });
    expect((await db.conversionEvents.get("meta:qualified_lead:l1"))).toMatchObject({ status: "skipped", reason: "too_old" });
    expect((await db.conversionEvents.get("google_ads:qualified_lead:l1"))!.status).toBe("sent");
  });

  it("retries failures, abandons after the limit, and a person can requeue", async () => {
    const db = createMemoryDb();
    await addLead(db);
    const failing = { google_ads: new MockUploader<GoogleItem>("google_ads", new Set(["google_ads:qualified_lead:l1"])) };
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      const r = await sweepConversions(db, { now: new Date(at(1)), uploaders: { ...failing, meta: mocks().meta } });
      expect(r.failed).toBe(1);
    }
    expect(await db.conversionEvents.get("google_ads:qualified_lead:l1")).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS - 1 });
    const last = await sweepConversions(db, { now: new Date(at(1)), uploaders: failing });
    expect(last.abandoned).toBe(1);
    expect((await db.conversionEvents.get("google_ads:qualified_lead:l1"))!.status).toBe("abandoned");
    expect((await sweepConversions(db, { now: new Date(at(1)), uploaders: failing })).failed).toBe(0);
    await expect(retryAbandonedConversions(db, marketing)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await retryAbandonedConversions(db, admin)).toBe(1);
    const u = mocks();
    expect((await sweepConversions(db, { now: new Date(at(1)), uploaders: u })).sent).toBe(1);
  });

  it("an uploader that throws leaves the rows retryable, not lost", async () => {
    const db = createMemoryDb();
    await addLead(db);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = { upload: async () => { throw new Error("secret detail"); }, provider: "google_ads", channel: "api" } as unknown as MockUploader<GoogleItem>;
    const r = await sweepConversions(db, { now: new Date(at(1)), uploaders: { google_ads: boom } });
    expect(r.failed).toBe(1);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secret detail");
    spy.mockRestore();
    expect((await db.conversionEvents.get("google_ads:qualified_lead:l1"))!.status).toBe("failed");
  });

  it("logs ids and values only, never contact details", async () => {
    const db = createMemoryDb();
    await addLead(db, { email: "private.person@example.com" });
    await sweepConversions(db, { now: new Date(at(1)), uploaders: mocks() });
    const dump = JSON.stringify([await db.conversionEvents.list(), await db.audit.list()]);
    expect(dump).not.toMatch(/private\.person|5125550100|Dana/);
  });
});

describe("providers", () => {
  it("refuse to run in production without credentials, and use the mock in development", () => {
    expect(() => googleUploaderFromEnv({ NODE_ENV: "production" })).toThrow(ConversionConfigError);
    expect(() => metaUploaderFromEnv({ NODE_ENV: "production" })).toThrow(ConversionConfigError);
    expect(googleUploaderFromEnv({ NODE_ENV: "development" })).toBeInstanceOf(MockUploader);
    expect(metaUploaderFromEnv({})).toBeInstanceOf(MockUploader);
    expect(() => googleUploaderFromEnv({ NODE_ENV: "production", GOOGLE_ADS_CUSTOMER_ID: "1", GOOGLE_ADS_DEVELOPER_TOKEN: "t", GOOGLE_ADS_ACCESS_TOKEN: "a", GOOGLE_ADS_CONVERSION_ACTIONS: "{}" })).toThrow(/missing/);
  });

  it("the sweep reports a refused platform and leaves its rows pending", async () => {
    const db = createMemoryDb();
    await addLead(db, { source: { gclid: GCLID, fbp: FBP } });
    const env = { NODE_ENV: "production", META_CAPI_PIXEL_ID: "px", META_CAPI_ACCESS_TOKEN: "tok" };
    const { uploaders, refused } = resolveUploaders(env);
    expect(refused).toEqual(["google_ads"]);
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    const meta = new MetaCapiUploader({ pixelId: "px", accessToken: "tok" }, fetchSpy as unknown as typeof fetch);
    const r = await sweepConversions(db, { now: new Date(at(1)), uploaders: { meta: uploaders.meta ? meta : undefined } });
    expect(r.sent).toBe(1);
    expect((await db.conversionEvents.get("google_ads:qualified_lead:l1"))!.status).toBe("pending");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("the Meta stub posts hashed events with the test code, and reports failures without bodies", async () => {
    const calls: { url: string; body: any }[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response("email leaked@example.com", { status: calls.length === 1 ? 200 : 503 });
    });
    const up = new MetaCapiUploader({ pixelId: "123", accessToken: "tok", testEventCode: "TEST1" }, fetchMock as unknown as typeof fetch);
    const ev = { event_name: "Lead", event_id: "e1" } as MetaEvent;
    expect(await up.upload([{ id: "r1", payload: ev }])).toEqual([{ id: "r1", ok: true }]);
    expect(calls[0].url).toBe("https://graph.facebook.com/v21.0/123/events");
    expect(calls[0].body).toMatchObject({ test_event_code: "TEST1", data: [{ event_id: "e1" }] });
    const bad = await up.upload([{ id: "r2", payload: ev }]);
    expect(bad[0]).toEqual({ id: "r2", ok: false, retryable: true, error: "HTTP 503" });
  });

  it("the Google Ads stub maps partial failures to the rows that failed", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ partialFailureError: { details: [{ errors: [{ location: { fieldPathElements: [{ fieldName: "conversions", index: 1 }] } }] }] } }), { status: 200 }),
    );
    const up = new GoogleAdsUploader(
      { customerId: "123", developerToken: "dev", accessToken: "tok", conversionActions: { qualified_lead: "customers/123/conversionActions/1", consult_booked: "a", consult_held: "b", retainer_signed: "c" } },
      fetchMock as unknown as typeof fetch,
    );
    const row = (id: string): GoogleItem => ({ clickIdKind: "gclid", clickId: GCLID, conversionName: "n", conversionTime: "2026-10-06 17:00:00+00:00", currency: "USD", orderId: id, type: "qualified_lead", hashedEmail: "h" });
    const res = await up.upload([{ id: "a", payload: row("a") }, { id: "b", payload: row("b") }]);
    expect(res.map((r) => r.ok)).toEqual([true, false]);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.partialFailure).toBe(true);
    expect(body.conversions[0]).toMatchObject({ gclid: GCLID, conversionAction: "customers/123/conversionActions/1", userIdentifiers: [{ hashedEmail: "h" }] });
  });
});

describe("manual CSV export", () => {
  it("previews without changing anything, and marking sent stops the sweep resending", async () => {
    const db = createMemoryDb();
    await addLead(db, { stages: [["qualified", 0], ["retainer_signed", 2]] });
    await addEngagement(db, "l1", 300_000);
    const now = new Date(at(3));
    const preview = await exportConversionsCsv(db, marketing, "google_ads", { now });
    expect(preview.count).toBe(0); // nothing queued yet
    const { queueConversions } = await import("@/server/conversions/sweep");
    await queueConversions(db, now);
    const p = await exportConversionsCsv(db, marketing, "google_ads", { now });
    expect(p.count).toBe(4);
    expect(p.csv.split("\r\n")[0]).toContain("Google Click ID");
    expect((await db.conversionEvents.list((e) => e.status === "pending")).length).toBe(p.count);
    await expect(exportConversionsCsv(db, marketing, "google_ads", { now, markSent: true })).rejects.toBeInstanceOf(ForbiddenError);
    const done = await exportConversionsCsv(db, admin, "google_ads", { now, markSent: true });
    expect(done.filename).toBe("google_ads-conversions-2026-10-09.csv");
    expect(done.csv).toContain("EP Retainer Signed");
    expect(done.csv).toContain("3000");
    const u = mocks();
    expect((await sweepConversions(db, { now, uploaders: u })).sent).toBe(0);
    expect((await db.conversionEvents.list()).every((e) => e.status === "sent" && e.channel === "manual_csv")).toBe(true);
    expect((await db.audit.list((e) => e.action === "conversion.exported")).length).toBe(1);
  });

  it("the report counts by platform and status for marketing, and refuses intake", async () => {
    const db = createMemoryDb();
    await addLead(db);
    await addLead(db, { id: "l2", marketingConsent: false });
    await sweepConversions(db, { now: new Date(at(1)), uploaders: mocks() });
    const r = await conversionsReport(db, marketing);
    expect(r.byProvider.google_ads).toMatchObject({ sent: 1, skipped: 1 });
    expect(r.skippedReasons).toEqual({ no_ads_consent: 1 });
    await expect(conversionsReport(db, actorFor(DEMO_USERS.find((u) => u.id === "u-intake")!))).rejects.toBeInstanceOf(ForbiddenError);
  });
});
