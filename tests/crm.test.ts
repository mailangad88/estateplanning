import { describe, expect, it } from "vitest";
import { HUBSPOT_STAGE_MAP, LAWMATICS_STAGE_MAP } from "@/server/crm/adapter";
import { HubSpotAdapter } from "@/server/crm/hubspot";
import { LawmaticsAdapter } from "@/server/crm/lawmatics";
import { MockCrmAdapter } from "@/server/crm/mock";
import { CrmSync } from "@/server/crm/sync";
import { CrmHttpError } from "@/server/crm/adapter";
import { crmAdapterFromEnv } from "@/server/crm";
import { createMemoryDb } from "@/server/db";
import { buildConsentRecord } from "@/lib/consent";
import { scoreLead } from "@/lib/scoring";
import type { Comment, Lead, Person } from "@/server/types";

const person: Person = {
  id: "p1", firstName: "Ana", lastName: "Lee", email: "ana@example.com", phone: "5125550100", language: "en", state: "TX",
};

function makeLead(over: Partial<Lead> = {}): Lead {
  return {
    id: "l1", personId: "p1", createdAt: "2026-10-06T00:00:00Z", stage: "new", stageHistory: [{ stage: "new", at: "2026-10-06T00:00:00Z", by: "system" }],
    matterType: "new_plan", state: "TX", urgent: false,
    score: scoreLead({ state: "TX", servedStates: ["TX"], answers: { matterType: "new_plan" }, smsConsent: false }),
    segments: [], source: { utmSource: "google" },
    consent: buildConsentRecord({ smsConsent: false, acknowledgedNoRelationship: true, pageUrl: "https://x.test", ip: "203.0.113.77", userAgent: "SecretAgent/1.0" }),
    offerSummary: "Couple wants a new plan.",
    conflictCard: { clientName: "Ana Lee", parties: [], matterType: "new_plan", state: "TX", clearance: "pending" },
    intake: { summary: "s", redFlags: [], deadlines: [], household: { members: [] }, assets: {}, answers: {} },
    ...over,
  };
}

async function setup(over: Partial<Lead> = {}) {
  const db = createMemoryDb();
  await db.persons.insert(person);
  await db.leads.insert(makeLead(over));
  return db;
}

interface Req { url: string; method: string; headers: Record<string, string>; body: any }
type Responder = (r: Req) => { status?: number; json?: unknown; headers?: Record<string, string> };

function fakeFetch(responder: Responder) {
  const reqs: Req[] = [];
  const impl = (async (url: string, init: any) => {
    const req: Req = { url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined };
    reqs.push(req);
    const r = responder(req);
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k: string) => r.headers?.[k.toLowerCase()] ?? null },
      text: async () => (r.json === undefined ? "" : JSON.stringify(r.json)),
    };
  }) as unknown as typeof fetch;
  return { impl, reqs };
}

const noSleep = async () => {};

describe("LawmaticsAdapter", async () => {
  it("creates contact and prospect with bearer auth", async () => {
    const f = fakeFetch((r) => {
      if (r.method === "GET") return { json: { data: [] } };
      return { json: { data: { id: r.url.endsWith("/contacts") ? 11 : 22 } } };
    });
    const a = new LawmaticsAdapter({ token: "tok", fetchImpl: f.impl });
    const { contactId } = await a.upsertContact(person, makeLead());
    const { matterId } = await a.upsertMatter(makeLead(), person, { contactId });
    expect([contactId, matterId]).toEqual(["11", "22"]);
    expect(f.reqs[0].url).toBe("https://api.lawmatics.com/v1/contacts?email=ana%40example.com");
    expect(f.reqs[1]).toMatchObject({ method: "POST", url: "https://api.lawmatics.com/v1/contacts" });
    expect(f.reqs[1].headers.authorization).toBe("Bearer tok");
    expect(f.reqs[1].body).toMatchObject({ first_name: "Ana", email: "ana@example.com" });
    expect(f.reqs[2].url).toBe("https://api.lawmatics.com/v1/prospects");
    expect(f.reqs[2].body).toMatchObject({ contact_id: "11", status: "New Lead" });
  });

  it("updates an existing contact", async () => {
    const f = fakeFetch((r) => (r.method === "GET" ? { json: { data: [{ id: 5 }] } } : { json: {} }));
    const a = new LawmaticsAdapter({ token: "t", fetchImpl: f.impl });
    expect((await a.upsertContact(person, makeLead())).contactId).toBe("5");
    expect(f.reqs[1]).toMatchObject({ method: "PUT", url: "https://api.lawmatics.com/v1/contacts/5" });
  });

  it("maps stages and exits, with overrides", async () => {
    const f = fakeFetch(() => ({ json: {} }));
    const a = new LawmaticsAdapter({ token: "t", fetchImpl: f.impl, stageMap: { paid: "Custom Paid" } });
    await a.setStage("9", "retainer_signed");
    await a.setStage("9", "paid");
    await a.setStage("9", "contacted", "unresponsive");
    expect(f.reqs.map((r) => r.body.status)).toEqual([LAWMATICS_STAGE_MAP.retainer_signed, "Custom Paid", LAWMATICS_STAGE_MAP.unresponsive]);
    expect(f.reqs[0]).toMatchObject({ method: "PUT", url: "https://api.lawmatics.com/v1/prospects/9" });
  });
});

describe("HubSpotAdapter", async () => {
  it("updates when the email search finds a contact", async () => {
    const f = fakeFetch((r) => (r.url.endsWith("/search") ? { json: { results: [{ id: "77" }] } } : { json: {} }));
    const a = new HubSpotAdapter({ token: "hs", fetchImpl: f.impl });
    expect((await a.upsertContact(person, makeLead())).contactId).toBe("77");
    expect(f.reqs.some((r) => r.method === "POST" && r.url.endsWith("/contacts"))).toBe(false);
    expect(f.reqs[1]).toMatchObject({ method: "PATCH", url: "https://api.hubapi.com/crm/v3/objects/contacts/77" });
    expect(f.reqs[0].headers.authorization).toBe("Bearer hs");
    expect(f.reqs[0].body.filterGroups[0].filters[0]).toMatchObject({ propertyName: "email", value: "ana@example.com" });
  });

  it("falls back to phone then creates", async () => {
    const f = fakeFetch((r) => (r.url.endsWith("/search") ? { json: { results: [] } } : { json: { id: "88" } }));
    const a = new HubSpotAdapter({ token: "hs", fetchImpl: f.impl });
    expect((await a.upsertContact(person, makeLead())).contactId).toBe("88");
    expect(f.reqs[1].body.filterGroups[0].filters[0].propertyName).toBe("phone");
    expect(f.reqs[2]).toMatchObject({ method: "POST", url: "https://api.hubapi.com/crm/v3/objects/contacts" });
  });

  it("creates a deal with pipeline, stage and contact association; notes associate to the deal", async () => {
    const f = fakeFetch(() => ({ json: { id: "d1" } }));
    const a = new HubSpotAdapter({ token: "hs", pipelineId: "pipe9", fetchImpl: f.impl });
    const { matterId } = await a.upsertMatter(makeLead(), person, { contactId: "77" });
    expect(matterId).toBe("d1");
    expect(f.reqs[0].body.properties).toMatchObject({ pipeline: "pipe9", dealstage: HUBSPOT_STAGE_MAP.new });
    expect(f.reqs[0].body.associations[0].to.id).toBe("77");
    await a.addNote("d1", { id: "c", leadId: "l1", authorId: "u", authorName: "Sam", body: "hi", visibility: "firm", mentions: [], createdAt: "2026-10-06T00:00:00Z" });
    expect(f.reqs[1].url).toBe("https://api.hubapi.com/crm/v3/objects/notes");
    expect(f.reqs[1].body.associations[0].to.id).toBe("d1");
    await a.setStage("d1", "paid", "conflict");
    expect(f.reqs[2]).toMatchObject({ method: "PATCH" });
    expect(f.reqs[2].body.properties.dealstage).toBe(HUBSPOT_STAGE_MAP.conflict);
  });
});

describe("capture data", async () => {
  const captured = {
    segments: ["tool:guide", "resource:after-a-death-checklist", "estate_administration", "homeowner"],
    capture: { tool: "guide", resource: "after-a-death-checklist", result: { estimate: 12000 } },
    priorTools: ["cost_calculator"],
  };

  it("sends tool, resource and tags to HubSpot without sensitive segments or tool figures", async () => {
    const f = fakeFetch(() => ({ json: { id: "d1" } }));
    await new HubSpotAdapter({ token: "hs", fetchImpl: f.impl }).upsertMatter(makeLead(captured), person, { contactId: "77" });
    const p = f.reqs[0].body.properties;
    expect(p).toMatchObject({ ep_capture_tool: "guide", ep_capture_resource: "after-a-death-checklist", ep_prior_tools: "cost_calculator", ep_sensitive_track: "true" });
    expect(p.ep_segments).toBe("tool:guide;resource:after-a-death-checklist;homeowner");
    expect(JSON.stringify(f.reqs[0].body)).not.toMatch(/12000|estate_administration/);
  });

  it("sends the UTM source and capture tags to Lawmatics", async () => {
    const f = fakeFetch(() => ({ json: { data: { id: 1 } } }));
    await new LawmaticsAdapter({ token: "t", fetchImpl: f.impl }).upsertMatter(makeLead(captured), person, { contactId: "1" });
    expect(f.reqs[0].body).toMatchObject({ source: "google", custom_fields: { capture_tool: "guide" } });
    expect(f.reqs[0].body.tags).toContain("sensitive_track");
    expect(f.reqs[0].body.tags).not.toContain("estate_administration");
  });

  it("sends the self-reported lead source to both CRMs", async () => {
    const lead = makeLead({ ...captured, source: { utmSource: "google", heardFrom: "ai_assistant" }, segments: [...captured.segments, "heard:ai_assistant"] });
    const lm = fakeFetch(() => ({ json: { data: { id: 1 } } }));
    await new LawmaticsAdapter({ token: "t", fetchImpl: lm.impl }).upsertMatter(lead, person, { contactId: "1" });
    expect(lm.reqs[0].body.custom_fields.heard_from).toBe("ai_assistant");
    expect(lm.reqs[0].body.tags).toContain("heard:ai_assistant");
    const hs = fakeFetch(() => ({ json: { id: "d1" } }));
    await new HubSpotAdapter({ token: "hs", fetchImpl: hs.impl }).upsertMatter(lead, person, { contactId: "77" });
    expect(hs.reqs[0].body.properties.ep_heard_from).toBe("ai_assistant");
  });
});

describe("CrmSync", async () => {
  it("is idempotent and stores crmId", async () => {
    const db = await setup();
    const mock = new MockCrmAdapter();
    const sync = new CrmSync(mock, { sleep: noSleep });
    const first = await sync.syncLead(db, "l1");
    const second = await sync.syncLead(db, "l1");
    expect(first.created).toBe(true);
    expect(second).toEqual({ matterId: first.matterId, created: false });
    expect(mock.count("upsertMatter")).toBe(1);
    expect((await db.leads.get("l1"))!.crmId).toBe(first.matterId);
    const ev = (await db.audit.list()).filter((e) => e.action === "crm.sync");
    expect(ev).toHaveLength(1);
    expect(ev[0].detail).toEqual({ adapter: "mock", operation: "upsertLead", ok: true });
  });

  it("retries on 429 honouring Retry-After, then succeeds", async () => {
    const db = await setup();
    const mock = new MockCrmAdapter();
    mock.failWith = [new CrmHttpError(429, 3000)];
    const sleeps: number[] = [];
    await new CrmSync(mock, { sleep: async (ms) => void sleeps.push(ms) }).syncLead(db, "l1");
    expect(sleeps).toEqual([3000]);
    expect((await db.leads.get("l1"))!.crmId).toBeTruthy();
  });

  it("backs off exponentially and gives up after 4 attempts", async () => {
    const db = await setup();
    const mock = new MockCrmAdapter();
    mock.failWith = [new CrmHttpError(503), new CrmHttpError(503), new CrmHttpError(503), new CrmHttpError(503), new CrmHttpError(503)];
    const sleeps: number[] = [];
    await expect(new CrmSync(mock, { sleep: async (ms) => void sleeps.push(ms) }).syncLead(db, "l1")).rejects.toThrow();
    expect(mock.count("upsertContact")).toBe(4);
    expect(sleeps).toEqual([500, 1000, 2000]);
    expect((await db.leads.get("l1"))!.crmId).toBeUndefined();
    expect((await db.audit.list()).at(-1)!.detail).toMatchObject({ ok: false });
  });

  it("does not retry other 4xx errors", async () => {
    const db = await setup();
    const mock = new MockCrmAdapter();
    mock.failWith = [new CrmHttpError(401)];
    await expect(new CrmSync(mock, { sleep: noSleep }).syncLead(db, "l1")).rejects.toThrow();
    expect(mock.count("upsertContact")).toBe(1);
  });

  it("syncs stage and exit changes", async () => {
    const db = await setup();
    const mock = new MockCrmAdapter();
    const sync = new CrmSync(mock, { sleep: noSleep });
    await sync.syncLead(db, "l1");
    await db.leads.update("l1", { stage: "contacted", exit: { reason: "unresponsive", at: "2026-10-07T00:00:00Z" } });
    await sync.syncStage(db, "l1");
    expect(mock.calls.find((c) => c.op === "setStage")!.args.slice(1)).toEqual(["contacted", "unresponsive"]);
  });

  it("never syncs internal or client comments, syncs firm ones", async () => {
    const db = await setup();
    const mock = new MockCrmAdapter();
    const base: Comment = { id: "c1", leadId: "l1", authorId: "u", authorName: "Sam", body: "x", visibility: "internal", mentions: [], createdAt: "2026-10-06T00:00:00Z" };
    await db.comments.insert(base);
    await db.comments.insert({ ...base, id: "c2", visibility: "client" });
    await db.comments.insert({ ...base, id: "c3", visibility: "firm" });
    const sync = new CrmSync(mock, { sleep: noSleep });
    expect(await sync.syncComment(db, "c1")).toBe(false);
    expect(await sync.syncComment(db, "c2")).toBe(false);
    expect(mock.calls).toHaveLength(0);
    expect(await sync.syncComment(db, "c3")).toBe(true);
    expect(mock.count("addNote")).toBe(1);
    await expect(mock.addNote("m", { ...base, visibility: "internal" })).rejects.toThrow();
  });

  it("never sends consent IP or user agent to the CRM", async () => {
    const db = await setup();
    const f = fakeFetch((r) => {
      if (r.method === "GET") return { json: { data: [] } };
      return { json: { data: { id: 1 } } };
    });
    await new CrmSync(new LawmaticsAdapter({ token: "t", fetchImpl: f.impl }), { sleep: noSleep }).syncLead(db, "l1");
    const sent = JSON.stringify(f.reqs.map((r) => r.body));
    expect(sent).not.toContain("203.0.113.77");
    expect(sent).not.toContain("SecretAgent");

    const db2 = await setup();
    const f2 = fakeFetch((r) => (r.url.endsWith("/search") ? { json: { results: [] } } : { json: { id: "1" } }));
    await new CrmSync(new HubSpotAdapter({ token: "t", fetchImpl: f2.impl }), { sleep: noSleep }).syncLead(db2, "l1");
    expect(JSON.stringify(f2.reqs.map((r) => r.body))).not.toContain("203.0.113.77");
  });
});

describe("crmAdapterFromEnv", () => {
  it("defaults to lawmatics, supports hubspot and mock", () => {
    expect(crmAdapterFromEnv({ LAWMATICS_API_TOKEN: "x" }).name).toBe("lawmatics");
    expect(crmAdapterFromEnv({ CRM_PROVIDER: "hubspot", HUBSPOT_PRIVATE_APP_TOKEN: "x" }).name).toBe("hubspot");
    expect(crmAdapterFromEnv({ CRM_PROVIDER: "mock" }).name).toBe("mock");
  });
  it("falls back to mock without a token outside production", () => {
    expect(crmAdapterFromEnv({}).name).toBe("mock");
  });
  it("throws in production without a token unless CRM_ALLOW_MOCK=true", () => {
    expect(() => crmAdapterFromEnv({ NODE_ENV: "production" })).toThrow();
    expect(crmAdapterFromEnv({ NODE_ENV: "production", CRM_ALLOW_MOCK: "true" }).name).toBe("mock");
    expect(crmAdapterFromEnv({ NODE_ENV: "production", LAWMATICS_API_TOKEN: "x" }).name).toBe("lawmatics");
  });
});
