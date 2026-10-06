import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildLeadPayload, deliverLead, flattenLead, idempotencyKey, postToCrm, toE164, topNeed, type LeadRecord,
} from "@/lib/crm";
import { buildConsentRecord } from "@/lib/consent";
import { scoreLead } from "@/lib/scoring";
import { ForbiddenError } from "@/server/auth/policy";
import { createMemoryDb, type Db } from "@/server/db";
import { leadHealthReport } from "@/server/leadHealth";
import { deliverAndLog, leadRecordFromPortal, recordDelivery, retryDelayMinutes, retryFailedDeliveries } from "@/server/leadDelivery";
import { ingestLead } from "@/server/services/leads";
import { actorFor, DEMO_FIRM_ID, DEMO_USERS } from "@/server/seed";
import type { Actor, Lead } from "@/server/types";

const URL = "https://hooks.example.test/secret-path-123";

function record(over: Partial<LeadRecord> = {}): LeadRecord {
  const answers = { matterType: "new_plan", ownsHome: "yes", children: "minors", assetRange: "250k_1m", urgency: "this_month" } as LeadRecord["answers"];
  return {
    id: "lead-1",
    receivedAt: "2026-10-06T14:03:22.000Z",
    contact: { firstName: "Maria", lastName: "Alvarez", email: "maria@example.com", phone: "(555) 555-0123", state: "TX", county: "Travis", language: "English" },
    contactMethod: "text",
    goals: "Protect my kids",
    answers,
    score: scoreLead({ state: "TX", servedStates: ["TX"], answers, smsConsent: true }),
    segments: ["homeowner", "new_parent"],
    source: { utmSource: "google", utmMedium: "cpc", utmCampaign: "will-vs-trust", landingPage: "/x", gclid: "g1" },
    heardFrom: undefined,
    capture: { tool: "plan_finder" },
    priorTools: [],
    consent: buildConsentRecord({ smsConsent: true, acknowledgedNoRelationship: true, pageUrl: "https://example.com/plan-finder", ip: "203.0.113.9", userAgent: "UA", now: new Date("2026-10-06T14:03:21.000Z") }),
    ...over,
  };
}

type Resp = { status?: number; headers?: Record<string, string> } | Error;
function mockFetch(...responses: Resp[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  let i = 0;
  const impl = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(i++, responses.length - 1)];
    if (r instanceof Error) throw r;
    const status = r.status ?? 200;
    return { ok: status >= 200 && status < 300, status, headers: new Headers(r.headers) } as Response;
  });
  return { impl: impl as unknown as typeof fetch, calls, mock: impl };
}
const noSleep = { sleep: async () => {}, random: () => 0.5, url: URL, secret: "s3cret" };

describe("idempotency key", () => {
  it("is stable per lead and event, and differs across leads and events", () => {
    expect(idempotencyKey("lead-1")).toBe("lead-1");
    expect(idempotencyKey("lead-1")).toBe(idempotencyKey("lead-1", "lead.created"));
    expect(idempotencyKey("lead-1", "lead.updated")).toBe("lead-1:lead.updated");
    expect(idempotencyKey("lead-2")).not.toBe(idempotencyKey("lead-1"));
  });

  it("is the same on every attempt and every retry, and travels in headers with the event and a signature", async () => {
    const f = mockFetch({ status: 503 }, { status: 503 }, { status: 200 });
    const res = await deliverLead(record(), f.impl, noSleep);
    expect(res).toMatchObject({ delivered: true, attempts: 3, idempotencyKey: "lead-1", event: "lead.created" });
    const keys = new Set(f.calls.map((c) => (c.init.headers as Record<string, string>)["idempotency-key"]));
    expect([...keys]).toEqual(["lead-1"]);
    const h = f.calls[0].init.headers as Record<string, string>;
    expect(h["x-event"]).toBe("lead.created");
    expect(h["x-signature"]).toBe(createHmac("sha256", "s3cret").update(f.calls[0].init.body as string).digest("hex"));
    expect(f.calls.every((c) => c.url === URL)).toBe(true);
  });

  it("omits the signature when no secret is configured", async () => {
    const f = mockFetch({ status: 200 });
    await deliverLead(record(), f.impl, { ...noSleep, secret: undefined });
    expect((f.calls[0].init.headers as Record<string, string>)["x-signature"]).toBeUndefined();
  });
});

describe("retry rules", () => {
  it("retries 5xx and 429, then gives up after maxAttempts and reports it retryable", async () => {
    const f = mockFetch({ status: 502 });
    const res = await deliverLead(record(), f.impl, noSleep);
    expect(f.mock).toHaveBeenCalledTimes(3);
    expect(res).toMatchObject({ delivered: false, status: 502, attempts: 3, retryable: true, error: "HTTP 502" });
    const g = mockFetch({ status: 429 }, { status: 200 });
    expect((await deliverLead(record(), g.impl, noSleep)).delivered).toBe(true);
    expect(g.mock).toHaveBeenCalledTimes(2);
  });

  it("retries network errors and does not leak the URL in the error", async () => {
    const f = mockFetch(new TypeError(`fetch failed ${URL}`), new Error("boom"), { status: 200 });
    const res = await deliverLead(record(), f.impl, noSleep);
    expect(res).toMatchObject({ delivered: true, attempts: 3 });
    const bad = mockFetch(Object.assign(new TypeError(`fetch failed ${URL}`), { cause: { code: "ECONNREFUSED" } }));
    const failed = await deliverLead(record(), bad.impl, { ...noSleep, maxAttempts: 1 });
    expect(failed.error).toBe("TypeError: ECONNREFUSED");
    expect(failed.error).not.toContain("hooks.example");
    const timeout = mockFetch(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
    expect((await deliverLead(record(), timeout.impl, { ...noSleep, maxAttempts: 1 })).error).toBe("TimeoutError: timeout");
  });

  it.each([400, 401, 403, 404, 409, 422])("never retries a %i", async (status) => {
    const f = mockFetch({ status });
    const res = await deliverLead(record(), f.impl, noSleep);
    expect(f.mock).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ delivered: false, status, attempts: 1, retryable: false });
  });

  it("does not retry after a success", async () => {
    const f = mockFetch({ status: 200 });
    await deliverLead(record(), f.impl, noSleep);
    expect(f.mock).toHaveBeenCalledTimes(1);
  });

  it("backs off exponentially with jitter, capped, and honours Retry-After", async () => {
    const delays: number[] = [];
    const sleep = async (ms: number) => void delays.push(ms);
    const f = mockFetch({ status: 500 });
    await deliverLead(record(), f.impl, { url: URL, sleep, random: () => 0, maxAttempts: 4, baseDelayMs: 400, maxDelayMs: 1500, budgetMs: 60_000 });
    expect(delays).toEqual([200, 400, 750]); // random 0: half the ceiling; ceilings 400, 800, 1500 (capped)
    const hi: number[] = [];
    await deliverLead(record(), mockFetch({ status: 500 }).impl, { url: URL, sleep: async (ms) => void hi.push(ms), random: () => 0.999, maxAttempts: 3, budgetMs: 60_000 });
    expect(hi[0]).toBeGreaterThan(390);
    expect(hi[0]).toBeLessThan(400);
    const ra: number[] = [];
    await deliverLead(record(), mockFetch({ status: 429, headers: { "retry-after": "2" } }, { status: 200 }).impl, { url: URL, sleep: async (ms) => void ra.push(ms), random: () => 0.5 });
    expect(ra).toEqual([2000]);
  });

  it("stops retrying when the wait would blow the time budget, so a request never stalls", async () => {
    const f = mockFetch({ status: 500 });
    const res = await deliverLead(record(), f.impl, { ...noSleep, baseDelayMs: 5000, maxDelayMs: 5000, budgetMs: 1000, random: () => 0 });
    expect(f.mock).toHaveBeenCalledTimes(1);
    expect(res.retryable).toBe(true);
  });

  describe("with fake timers", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("really waits between attempts using the default sleep", async () => {
      const f = mockFetch({ status: 503 }, { status: 200 });
      const p = deliverLead(record(), f.impl, { url: URL, random: () => 0, baseDelayMs: 1000 });
      await vi.advanceTimersByTimeAsync(0);
      expect(f.mock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(499);
      expect(f.mock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(f.mock).toHaveBeenCalledTimes(2);
      expect((await p).delivered).toBe(true);
    });
  });

  it("returns log target without a webhook and never calls fetch", async () => {
    const f = mockFetch({ status: 200 });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("CRM_WEBHOOK_URL", "");
    expect(await deliverLead(record(), f.impl)).toMatchObject({ delivered: false, target: "log" });
    expect(f.mock).not.toHaveBeenCalled();
    info.mockRestore();
    vi.unstubAllEnvs();
  });
});

describe("E.164 phone normalization", () => {
  it.each([
    ["5125550100", "+15125550100"],
    ["(512) 555-0100", "+15125550100"],
    ["512.555.0100", "+15125550100"],
    ["1 512 555 0100", "+15125550100"],
    ["15125550100", "+15125550100"],
    ["+1 (512) 555-0100", "+15125550100"],
    ["+442071838750", "+442071838750"],
  ])("%s -> %s", (raw, out) => expect(toE164(raw)).toBe(out));

  it.each(["", "   ", "12345", "512555010", "51255501000", "0125550100", "5121550100", "+123", "abc"])("rejects %j", (raw) => {
    expect(toE164(raw)).toBe("");
  });
  it("handles undefined", () => expect(toE164(undefined)).toBe(""));
});

describe("payload map", () => {
  const flat = flattenLead(record());

  it("follows the field map from the vendor research", () => {
    expect(flat).toMatchObject({
      first_name: "Maria", last_name: "Alvarez", full_name: "Maria Alvarez", email: "maria@example.com", phone_e164: "+15555550123",
      state: "TX", county: "Travis", language: "English", preferred_contact: "text", effective_contact_method: "text",
      goals: "Protect my kids", matter_type: "new_plan", children: "minors", owns_home: "yes", asset_range: "250k_1m", urgency: "this_month",
      tier: expect.any(String), tags: "homeowner,new_parent", top_need: "living_trust",
      sms_consent: true, sms_consent_timestamp: "2026-10-06T14:03:21.000Z", sms_consent_text_version: "2026-10-06.1", no_relationship_ack: true, email_consent: true,
      consent_page_url: "https://example.com/plan-finder", consent_ip: "203.0.113.9",
      source: "google", medium: "cpc", campaign: "will-vs-trust", landing_page: "/x", gclid: "g1", gbraid: "", wbraid: "", fbclid: "", fbc: "", fbp: "",
      external_lead_id: "lead-1", lead_received_at: "2026-10-06T14:03:22.000Z",
    });
  });

  it("is flat: only strings, numbers and booleans, and every key is always present", () => {
    for (const v of Object.values(flat)) expect(["string", "number", "boolean"]).toContain(typeof v);
    const bare = flattenLead(record({ goals: undefined, contact: { ...record().contact, county: undefined, phone: "" }, source: {}, answers: {} }));
    expect(Object.keys(bare).sort()).toEqual(Object.keys(flat).sort());
    expect(bare.phone_e164).toBe("");
    expect(bare.goals).toBe("");
    expect(bare.top_need).toBe("will");
  });

  it("falls back to phone when text was preferred without SMS consent", () => {
    const f = flattenLead(record({ consent: { ...record().consent, smsConsent: false } }));
    expect(f.preferred_contact).toBe("text");
    expect(f.effective_contact_method).toBe("phone");
  });

  it("derives top_need in the documented priority order", () => {
    expect(topNeed({ matterType: "after_death", specialNeeds: "yes" })).toBe("administration");
    expect(topNeed({ urgency: "recent_death" })).toBe("administration");
    expect(topNeed({ specialNeeds: "yes", ownsBusiness: "yes" })).toBe("special_needs");
    expect(topNeed({ ownsBusiness: "yes", blendedFamily: "yes" })).toBe("business_owner");
    expect(topNeed({ matterType: "elder_care", blendedFamily: "yes" })).toBe("elder_medicaid");
    expect(topNeed({ blendedFamily: "yes", ownsHome: "yes" })).toBe("blended_family");
    expect(topNeed({ assetRange: "over_5m" })).toBe("living_trust");
    expect(topNeed({ assetRange: "under_250k" })).toBe("will");
  });

  it("wraps flat and the unchanged nested record, and posts that body", async () => {
    const rec = record();
    const p = buildLeadPayload(rec);
    expect(p).toMatchObject({ id: "lead-1", event: "lead.created", receivedAt: rec.receivedAt });
    expect(p.record).toBe(rec);
    const f = mockFetch({ status: 200 });
    await deliverLead(rec, f.impl, noSleep);
    const body = JSON.parse(f.calls[0].init.body as string);
    expect(Object.keys(body).sort()).toEqual(["event", "flat", "id", "receivedAt", "record"]);
    expect(body.record.contact.phone).toBe("(555) 555-0123");
  });

  it("subscriber posts keep working with a derived event and key", async () => {
    const f = mockFetch({ status: 200 });
    await postToCrm({ id: "sub-1", type: "subscriber" }, {}, f.impl, noSleep);
    const h = f.calls[0].init.headers as Record<string, string>;
    expect(h["x-event"]).toBe("subscriber.created");
    expect(h["idempotency-key"]).toBe("sub-1:subscriber.created");
  });
});

describe("delivery log", () => {
  let db: Db;
  const T = (m: number) => new Date(Date.UTC(2026, 9, 6, 12, m));
  beforeEach(() => {
    db = createMemoryDb();
  });

  const failed = { delivered: false, target: "webhook" as const, status: 503, attempts: 3, error: "HTTP 503", retryable: true, idempotencyKey: "lead-1", event: "lead.created" };
  const ok = { delivered: true, target: "webhook" as const, status: 200, attempts: 1, idempotencyKey: "lead-1", event: "lead.created" };

  it("records one row per lead and event, accumulating attempts, and never stores the payload", async () => {
    const first = await recordDelivery(db, "lead-1", "lead.created", failed, T(0));
    expect(first).toMatchObject({ id: "lead-1", leadId: "lead-1", event: "lead.created", status: "failed", httpStatus: 503, attempts: 3, error: "HTTP 503", createdAt: T(0).toISOString() });
    const second = await recordDelivery(db, "lead-1", "lead.created", ok, T(5));
    expect(second).toMatchObject({ status: "delivered", attempts: 4, httpStatus: 200, deliveredAt: T(5).toISOString(), createdAt: T(0).toISOString(), updatedAt: T(5).toISOString() });
    expect(second?.error).toBeUndefined();
    expect(await db.crmDeliveries.list()).toHaveLength(1);
    expect(JSON.stringify(await db.crmDeliveries.list())).not.toMatch(/maria|example\.com|555/i);
  });

  it("abandons non-retryable failures and exhausted retries, and ignores the log-only target", async () => {
    expect((await recordDelivery(db, "a", "lead.created", { ...failed, status: 422, retryable: false, idempotencyKey: "a" }, T(0)))?.status).toBe("abandoned");
    await recordDelivery(db, "b", "lead.created", { ...failed, attempts: 11, idempotencyKey: "b" }, T(0));
    expect((await recordDelivery(db, "b", "lead.created", { ...failed, attempts: 1, idempotencyKey: "b" }, T(1)))?.status).toBe("abandoned");
    expect(await recordDelivery(db, "c", "lead.created", { delivered: false, target: "log" }, T(0))).toBeUndefined();
    expect(await db.crmDeliveries.get("c")).toBeUndefined();
  });

  it("deliverAndLog logs the outcome, and a broken log never fails the request", async () => {
    vi.stubEnv("CRM_WEBHOOK_URL", URL);
    const f = mockFetch({ status: 200 });
    const res = await deliverAndLog(async () => db, record(), f.impl, noSleep);
    expect(res.delivered).toBe(true);
    expect((await db.crmDeliveries.get("lead-1"))?.status).toBe("delivered");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res2 = await deliverAndLog(async () => { throw new Error("db down"); }, record({ id: "lead-2" }), f.impl, noSleep);
    expect(res2.delivered).toBe(true);
    err.mockRestore();
    vi.unstubAllEnvs();
  });

  describe("retry sweep", () => {
    const portalLead = async (id: string) => {
      const rec = record({ id });
      await ingestLead(db, rec, new Date(rec.receivedAt));
      return rec;
    };

    it("spaces retries with growing delays", () => {
      expect([3, 4, 5, 6, 7, 8, 9].map(retryDelayMinutes)).toEqual([2, 4, 8, 16, 32, 60, 60]);
    });

    it("retries only due failed rows, with the same idempotency key, and marks them delivered", async () => {
      await portalLead("lead-1");
      await recordDelivery(db, "lead-1", "lead.created", failed, T(0));
      await recordDelivery(db, "done", "lead.created", { ...ok, idempotencyKey: "done" }, T(0));
      const f = mockFetch({ status: 200 });
      vi.stubEnv("CRM_WEBHOOK_URL", URL);
      const early = await retryFailedDeliveries(db, { fetchImpl: f.impl, now: T(1) });
      expect(early).toMatchObject({ considered: 0, skipped: 1 });
      expect(f.mock).not.toHaveBeenCalled();
      const sweep = await retryFailedDeliveries(db, { fetchImpl: f.impl, now: T(3), delivery: noSleep });
      expect(sweep).toMatchObject({ considered: 1, delivered: 1 });
      expect(f.mock).toHaveBeenCalledTimes(1);
      expect((f.calls[0].init.headers as Record<string, string>)["idempotency-key"]).toBe("lead-1");
      expect((await db.crmDeliveries.get("lead-1"))).toMatchObject({ status: "delivered", attempts: 4 });
      vi.unstubAllEnvs();
    });

    it("keeps failing rows failed (one attempt per sweep) and abandons on a 4xx", async () => {
      await portalLead("lead-1");
      await portalLead("lead-2");
      await recordDelivery(db, "lead-1", "lead.created", failed, T(0));
      await recordDelivery(db, "lead-2", "lead.created", { ...failed, idempotencyKey: "lead-2" }, T(0));
      vi.stubEnv("CRM_WEBHOOK_URL", URL);
      const f = mockFetch({ status: 503 });
      expect(await retryFailedDeliveries(db, { fetchImpl: f.impl, now: T(3), delivery: noSleep })).toMatchObject({ considered: 2, stillFailing: 2 });
      expect(f.mock).toHaveBeenCalledTimes(2);
      expect(await db.crmDeliveries.get("lead-1")).toMatchObject({ status: "failed", attempts: 4 });
      const g = mockFetch({ status: 410 });
      expect(await retryFailedDeliveries(db, { fetchImpl: g.impl, now: T(60), delivery: noSleep })).toMatchObject({ abandoned: 2 });
      expect((await db.crmDeliveries.get("lead-2"))?.status).toBe("abandoned");
      vi.unstubAllEnvs();
    });

    it("abandons a delivery whose lead record is unavailable, and honours the per-sweep limit", async () => {
      await recordDelivery(db, "lead-1", "lead.created", failed, T(0));
      const f = mockFetch({ status: 200 });
      const s = await retryFailedDeliveries(db, { fetchImpl: f.impl, now: T(3) });
      expect(s.abandoned).toBe(1);
      expect(await db.crmDeliveries.get("lead-1")).toMatchObject({ status: "abandoned", error: "lead record not available for retry" });
      expect(f.mock).not.toHaveBeenCalled();

      for (const id of ["x1", "x2", "x3"]) await recordDelivery(db, id, "lead.created", { ...failed, idempotencyKey: id }, T(0));
      vi.stubEnv("CRM_WEBHOOK_URL", URL);
      const rec = async (id: string) => record({ id });
      const lim = await retryFailedDeliveries(db, { fetchImpl: mockFetch({ status: 200 }).impl, now: T(3), limit: 2, loadRecord: rec, delivery: noSleep });
      expect(lim.considered).toBe(2);
      vi.unstubAllEnvs();
    });

    it("rebuilds a lead record from the portal lead", async () => {
      const rec = await portalLead("lead-1");
      const back = await leadRecordFromPortal(db, "lead-1");
      expect(back?.id).toBe("lead-1");
      expect(back?.receivedAt).toBe(rec.receivedAt);
      expect(back?.contact).toMatchObject({ firstName: "Maria", email: "maria@example.com", state: "TX" });
      expect(flattenLead(back!).phone_e164).toBe("+15555550123");
      expect(await leadRecordFromPortal(db, "nope")).toBeUndefined();
    });
  });
});

describe("lead health report", () => {
  const NOW = new Date("2026-10-06T12:00:00Z");
  const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
  const user = (id: string): Actor => actorFor(DEMO_USERS.find((u) => u.id === id)!);
  let db: Db;
  let n = 0;

  const del = (leadId: string, status: "delivered" | "failed" | "abandoned", h: number, over: Record<string, unknown> = {}) =>
    db.crmDeliveries.insert({
      id: `d-${++n}`, leadId, event: "lead.created", status, attempts: 3, createdAt: hoursAgo(h).toISOString(),
      updatedAt: hoursAgo(h).toISOString(), lastAttemptAt: hoursAgo(h).toISOString(), ...(status !== "delivered" ? { error: "HTTP 503", httpStatus: 503 } : {}), ...over,
    } as never);

  const lead = async (id: string, minutesAgo: number, over: { firmId?: string; contactedAfterMin?: number; activityAfterMin?: number } = {}) => {
    const created = new Date(NOW.getTime() - minutesAgo * 60_000);
    const at = (m: number) => new Date(created.getTime() + m * 60_000).toISOString();
    await db.leads.insert({
      id, personId: "p", createdAt: created.toISOString(), stage: "new",
      stageHistory: [{ stage: "new", at: created.toISOString(), by: "system" }, ...(over.contactedAfterMin !== undefined ? [{ stage: "contacted", at: at(over.contactedAfterMin), by: "x" }] : [])],
      matterType: "new_plan", state: "TX", urgent: false, score: { score: 50, tier: "warm", redFlags: [] }, segments: [], source: {}, firmId: over.firmId,
    } as unknown as Lead);
    if (over.activityAfterMin !== undefined) {
      await db.activities.insert({ id: `a-${id}`, leadId: id, kind: "call", direction: "outbound", at: at(over.activityAfterMin), summary: "called" });
    }
  };

  beforeEach(() => {
    db = createMemoryDb();
    n = 0;
  });

  it("counts deliveries over 24h and 7d, lists open failures with errors, and suppresses rates on small samples", async () => {
    for (let i = 0; i < 4; i++) await del(`l${i}`, "delivered", 2);
    await del("lf", "failed", 3);
    await del("la", "abandoned", 30, { error: "HTTP 422", httpStatus: 422 });
    await del("lold", "delivered", 24 * 8);
    const r = await leadHealthReport(db, user("u-admin"), { now: NOW });
    expect(r.windows[0]).toMatchObject({ label: "24h", total: 5, delivered: 4, failed: 1, abandoned: 0, failureRate: 0.2 });
    expect(r.windows[1]).toMatchObject({ label: "7d", total: 6, delivered: 4, failed: 1, abandoned: 1 });
    expect(r.windows[1].failureRate).toBeCloseTo(1 / 3);
    expect(r.openFailures).toEqual({ failed: 1, abandoned: 1 });
    expect(r.recentFailures.map((f) => [f.leadId, f.error])).toEqual([["lf", "HTTP 503"], ["la", "HTTP 422"]]);

    const small = createMemoryDb();
    await small.crmDeliveries.insert({ id: "x", leadId: "x", event: "lead.created", status: "failed", attempts: 1, createdAt: hoursAgo(1).toISOString(), updatedAt: hoursAgo(1).toISOString(), lastAttemptAt: hoursAgo(1).toISOString() });
    const rs = await leadHealthReport(small, user("u-admin"), { now: NOW });
    expect(rs.windows[0]).toMatchObject({ total: 1, failed: 1, failureRate: null });
  });

  it("keeps old open failures visible even outside the windows", async () => {
    await del("lold", "failed", 24 * 20);
    const r = await leadHealthReport(db, user("u-admin"), { now: NOW });
    expect(r.windows[1].total).toBe(0);
    expect(r.openFailures.failed).toBe(1);
    expect(r.recentFailures).toHaveLength(1);
  });

  it("computes speed to lead from activities and stage history, and hides it under 5 contacted leads", async () => {
    await lead("s1", 600, { activityAfterMin: 2 });
    await lead("s2", 600, { contactedAfterMin: 4 });
    await lead("s3", 600, { activityAfterMin: 10, contactedAfterMin: 6 });
    await lead("s4", 600, { activityAfterMin: 30 });
    const few = await leadHealthReport(db, user("u-admin"), { now: NOW });
    expect(few.speedToLead).toMatchObject({ leads: 4, contacted: 4, suppressed: true, medianMinutes: null, p90Minutes: null });

    await lead("s5", 600, { activityAfterMin: 60 });
    await lead("s6", 600);
    const r = await leadHealthReport(db, user("u-admin"), { now: NOW });
    expect(r.speedToLead).toMatchObject({ leads: 6, contacted: 5, uncontacted: 1, suppressed: false, medianMinutes: 6, p90Minutes: 60 });
  });

  it("ignores contact before creation and leads outside the lookback", async () => {
    await lead("old", 60 * 24 * 40, { activityAfterMin: 1 });
    const r = await leadHealthReport(db, user("u-admin"), { now: NOW, speedDays: 30 });
    expect(r.speedToLead.leads).toBe(0);
  });

  it("scopes firm admins to their firm's leads and rejects other roles", async () => {
    await lead("mine", 600, { firmId: DEMO_FIRM_ID, activityAfterMin: 3 });
    await lead("theirs", 600, { firmId: "other-firm", activityAfterMin: 3 });
    await del("mine", "failed", 1);
    await del("theirs", "failed", 1);
    await del("orphan", "failed", 1);
    const firm = await leadHealthReport(db, user("u-firmadmin"), { now: NOW });
    expect(firm.recentFailures.map((f) => f.leadId)).toEqual(["mine"]);
    expect(firm.speedToLead.leads).toBe(1);
    expect(firm.firmId).toBe(DEMO_FIRM_ID);
    const all = await leadHealthReport(db, user("u-admin"), { now: NOW });
    expect(all.recentFailures).toHaveLength(3);
    for (const id of ["u-marketing", "u-intake", "u-lawyer-a", "u-paralegal"]) {
      await expect(leadHealthReport(db, user(id), { now: NOW })).rejects.toBeInstanceOf(ForbiddenError);
    }
    await expect(leadHealthReport(db, { userId: "x", role: "firm_admin", mfa: true } as Actor, { now: NOW })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
