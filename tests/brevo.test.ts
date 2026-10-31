import { describe, expect, it } from "vitest";
import { BrevoAdapter, allowedSequences } from "@/server/crm/brevo";
import { parseBrevoEvents, verifyBrevoWebhook } from "@/server/crm/brevoEvents";
import { brevoSequenceLists, brevoTemplatePayload, toBrevoText } from "@/server/crm/brevoSetup";
import type { NurtureState } from "@/server/crm/adapter";
import { crmAdapterFromEnv } from "@/server/crm";
import { nurtureOwnerFromEnv } from "@/server/nurture/owner";
import { getTemplateCopy } from "@/server/nurture/templateCopy";
import { buildConsentRecord } from "@/lib/consent";
import { scoreLead } from "@/lib/scoring";
import type { Lead, Person } from "@/server/types";

const person: Person = { id: "p1", firstName: "Ana", lastName: "Lee", email: "Ana@Example.com", phone: "3125550100", language: "en", state: "IL" };

function makeLead(over: Partial<Lead> = {}): Lead {
  return {
    id: "l1", personId: "p1", createdAt: "2026-10-31T00:00:00Z", stage: "new", stageHistory: [{ stage: "new", at: "2026-10-31T00:00:00Z", by: "system" }],
    matterType: "new_plan", state: "IL", urgent: false,
    score: scoreLead({ state: "IL", servedStates: ["IL"], answers: { matterType: "new_plan" }, smsConsent: false }),
    segments: ["homeowner", "widowed"], source: {},
    consent: buildConsentRecord({ smsConsent: false, acknowledgedNoRelationship: true, pageUrl: "https://x.test", ip: "203.0.113.77", userAgent: "SecretAgent/1.0" }),
    offerSummary: "", conflictCard: { clientName: "Ana Lee", parties: [], matterType: "new_plan", state: "IL", clearance: "pending" },
    intake: { summary: "s", redFlags: [], deadlines: [], household: { members: [] }, assets: {}, answers: {} },
    capture: { tool: "cost_calculator", result: { estate: 900000 } },
    ...over,
  };
}

interface Req { url: string; method: string; headers: Record<string, string>; body: any }
function fakeFetch(responder: (r: Req) => { status?: number; json?: unknown }) {
  const reqs: Req[] = [];
  const impl = (async (url: string, init: any) => {
    const req: Req = { url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined };
    reqs.push(req);
    const r = responder(req);
    const status = r.status ?? 200;
    return { ok: status < 300, status, headers: { get: () => null }, text: async () => (r.json === undefined ? "" : JSON.stringify(r.json)) };
  }) as unknown as typeof fetch;
  return { impl, reqs };
}

const LISTS = { lists: [{ id: 1, name: "ep-seq-welcome" }, { id: 2, name: "ep-seq-grief_support" }, { id: 3, name: "ep-seq-consult_booked" }, { id: 9, name: "Newsletter" }] };

function state(over: Partial<NurtureState> = {}): NurtureState {
  return {
    contactEmail: "ana@example.com", sequences: ["welcome"], segments: [], emailConsent: true, smsConsent: false,
    emailSuppressed: false, smsSuppressed: false, griefTrack: false, consultBooked: false, consultHeld: false,
    retainerSigned: false, doNotMarket: false, ...over,
  };
}

describe("BrevoAdapter", () => {
  it("creates a contact with the api-key header and no consent IP or user agent", async () => {
    const f = fakeFetch(() => ({ status: 201, json: { id: 42 } }));
    const { contactId } = await new BrevoAdapter({ apiKey: "k", fetchImpl: f.impl }).upsertContact(person, makeLead());
    expect(contactId).toBe("42");
    expect(f.reqs[0]).toMatchObject({ method: "POST", url: "https://api.brevo.com/v3/contacts" });
    expect(f.reqs[0].headers["api-key"]).toBe("k");
    expect(f.reqs[0].body).toMatchObject({ email: "ana@example.com", updateEnabled: true, attributes: { FIRSTNAME: "Ana", EP_STATE: "IL" } });
    expect(JSON.stringify(f.reqs[0].body)).not.toMatch(/203\.0\.113\.77|SecretAgent/);
  });

  it("reads the id back when Brevo updates an existing contact (204, no body)", async () => {
    const f = fakeFetch((r) => (r.method === "POST" ? { status: 204 } : { json: { id: 7 } }));
    expect((await new BrevoAdapter({ apiKey: "k", fetchImpl: f.impl }).upsertContact(person, makeLead())).contactId).toBe("7");
    expect(f.reqs[1].url).toBe("https://api.brevo.com/v3/contacts/ana%40example.com?identifierType=email_id");
  });

  it("keeps the matter on the contact, without sensitive segments or tool figures", async () => {
    const f = fakeFetch(() => ({ status: 204 }));
    const { matterId } = await new BrevoAdapter({ apiKey: "k", fetchImpl: f.impl }).upsertMatter(makeLead(), person, { contactId: "42" });
    expect(matterId).toBe("42");
    expect(f.reqs[0]).toMatchObject({ method: "PUT", url: "https://api.brevo.com/v3/contacts/42?identifierType=contact_id" });
    expect(f.reqs[0].body.attributes).toMatchObject({ EP_STAGE: "new", EP_CAPTURE_TOOL: "cost_calculator", EP_SEGMENTS: "homeowner", EP_SENSITIVE_TRACK: "true" });
    expect(JSON.stringify(f.reqs[0].body)).not.toMatch(/900000|widowed/);
  });

  it("writes an exit reason as the stage and notes against the contact", async () => {
    const f = fakeFetch(() => ({ status: 201, json: { id: "n1" } }));
    const a = new BrevoAdapter({ apiKey: "k", fetchImpl: f.impl });
    await a.setStage("42", "contacted", "unresponsive");
    await a.addNote("42", { id: "c", leadId: "l1", authorId: "u", authorName: "Intake", body: "Called", visibility: "firm", createdAt: "2026-10-31T00:00:00Z" } as any);
    expect(f.reqs[0].body).toEqual({ attributes: { EP_STAGE: "unresponsive" } });
    expect(f.reqs[1]).toMatchObject({ method: "POST", url: "https://api.brevo.com/v3/crm/notes", body: { text: "Intake: Called", contactIds: [42] } });
    await expect(a.addNote("42", { visibility: "internal" } as any)).rejects.toThrow();
  });

  it("does not join sequence lists unless enrollment is on, but always unlinks", async () => {
    const f = fakeFetch((r) => (r.method === "GET" ? { json: LISTS } : { status: 204 }));
    await new BrevoAdapter({ apiKey: "k", fetchImpl: f.impl }).pushNurtureState("42", state());
    const put = f.reqs.find((r) => r.method === "PUT")!;
    expect(put.body.listIds).toBeUndefined();
    expect(put.body.unlinkListIds).toEqual([2, 3]);
    expect(put.body.attributes).toMatchObject({ EP_SEQUENCES: "welcome", EP_EMAIL_CONSENT: "true", EP_DO_NOT_MARKET: "false" });
  });

  it("with enrollment on, joins only allowed lists and never touches other lists", async () => {
    const f = fakeFetch((r) => (r.method === "GET" ? { json: LISTS } : { status: 204 }));
    await new BrevoAdapter({ apiKey: "k", enrollLists: true, fetchImpl: f.impl }).pushNurtureState("42", state());
    const put = f.reqs.find((r) => r.method === "PUT")!;
    expect(put.body.listIds).toEqual([1]);
    expect(put.body.unlinkListIds).toEqual([2, 3]);
  });

  it("blocklists a suppressed contact and removes every sequence list", async () => {
    const f = fakeFetch((r) => (r.method === "GET" ? { json: LISTS } : { status: 204 }));
    await new BrevoAdapter({ apiKey: "k", enrollLists: true, fetchImpl: f.impl }).pushNurtureState("42", state({ emailSuppressed: true }));
    const put = f.reqs.find((r) => r.method === "PUT")!;
    expect(put.body.emailBlacklisted).toBe(true);
    expect(put.body.listIds).toBeUndefined();
    expect(put.body.unlinkListIds).toEqual([1, 2, 3]);
  });
});

describe("allowedSequences", () => {
  it("applies consent, grief and do-not-market rules", () => {
    expect(allowedSequences(state({ emailConsent: false }))).toEqual([]);
    expect(allowedSequences(state({ griefTrack: true, sequences: ["grief_support", "welcome"] }))).toEqual(["grief_support"]);
    expect(allowedSequences(state({ doNotMarket: true, sequences: ["welcome", "signed_onboarding"] }))).toEqual(["signed_onboarding"]);
    expect(allowedSequences(state({ sequences: ["welcome", "grief_support"] }))).toEqual(["welcome"]);
  });
});

describe("Brevo env wiring", () => {
  it("builds the adapter and only lets Brevo own sends with a key", () => {
    expect(crmAdapterFromEnv({ CRM_PROVIDER: "brevo", BREVO_API_KEY: "k" }).name).toBe("brevo");
    expect(nurtureOwnerFromEnv({ NURTURE_OWNER: "crm", CRM_PROVIDER: "brevo" })).toBe("internal");
    expect(nurtureOwnerFromEnv({ NURTURE_OWNER: "crm", CRM_PROVIDER: "brevo", BREVO_API_KEY: "k" })).toBe("crm");
  });

  it("ignores BREVO_ENROLL_LISTS while our own sender owns the sequences", async () => {
    for (const [env, joins] of [
      [{ CRM_PROVIDER: "brevo", BREVO_API_KEY: "k", BREVO_ENROLL_LISTS: "true" }, false],
      [{ CRM_PROVIDER: "brevo", BREVO_API_KEY: "k", BREVO_ENROLL_LISTS: "true", NURTURE_OWNER: "crm" }, true],
    ] as const) {
      const f = fakeFetch((r) => (r.method === "GET" ? { json: LISTS } : { status: 204 }));
      const a = crmAdapterFromEnv(env) as BrevoAdapter;
      (a as any).fetchImpl = f.impl;
      await a.pushNurtureState("42", state());
      expect(f.reqs.find((r) => r.method === "PUT")!.body.listIds !== undefined).toBe(joins);
    }
  });
});

describe("Brevo webhook", () => {
  it("fails closed and accepts a bearer token or ?token=", () => {
    expect(verifyBrevoWebhook("Bearer s3cret", null, undefined)).toBe(false);
    expect(verifyBrevoWebhook(null, null, "s3cret")).toBe(false);
    expect(verifyBrevoWebhook("Bearer wrong", null, "s3cret")).toBe(false);
    expect(verifyBrevoWebhook("Bearer s3cret", null, "s3cret")).toBe(true);
    expect(verifyBrevoWebhook(null, "s3cret", "s3cret")).toBe(true);
  });

  it("maps marketing and transactional events, single or batched", () => {
    expect(parseBrevoEvents(JSON.stringify({ event: "unsubscribe", email: "a@x.com" }))).toEqual([{ type: "unsubscribe", channel: "email", address: "a@x.com" }]);
    expect(parseBrevoEvents(JSON.stringify([
      { event: "hardBounce", email: "b@x.com" }, { event: "hard_bounce", email: "c@x.com" }, { event: "spam", email: "d@x.com" },
      { event: "opened", email: "e@x.com" }, { event: "unsubscribed" },
    ])).map((e) => `${e.type}:${e.address}`)).toEqual(["bounce:b@x.com", "bounce:c@x.com", "complaint:d@x.com"]);
    expect(parseBrevoEvents("not json")).toEqual([]);
  });
});

describe("Brevo setup", () => {
  it("has a list for each new sequence", () => {
    const names = brevoSequenceLists().map((l) => l.listName);
    for (const id of ["welcome", "calculator_follow_up", "quiz_follow_up", "consult_booked", "consult_held_not_signed"]) expect(names).toContain(`ep-seq-${id}`);
  });

  it("converts placeholders and marks the template as an inactive draft", () => {
    const vars = { firmName: "Family Net", attorneyName: "A. Lawyer", bookingUrl: "https://x.test/book" };
    expect(toBrevoText("Hi {{firstName}}, {{resourceUrl}} {{bookingUrl}}", vars)).toBe("Hi {{ contact.FIRSTNAME | default: 'there' }}, [[resourceUrl: replace before use]] https://x.test/book");
    const p = brevoTemplatePayload(getTemplateCopy("wl_1_how_it_works")!, vars, { email: "hello@x.test", name: "Family Net" });
    expect(p.isActive).toBe(false);
    expect(p.templateName).toBe("DRAFT not approved - wl_1_how_it_works");
    expect(p.htmlContent).toContain('<a href="{{ unsubscribe }}">Unsubscribe</a>');
    expect(p.htmlContent).not.toContain("{{unsubscribeUrl}}");
  });
});
