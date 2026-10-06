import { describe, expect, it } from "vitest";
import { createMemoryDb, type Db } from "@/server/db";
import { buildConsentRecord } from "@/lib/consent";
import { ForbiddenError } from "@/server/auth/policy";
import { verifyAuditChain } from "@/server/audit/log";
import { MockEsignProvider } from "@/server/esign/mock";
import { MockPaymentProvider } from "@/server/esign/payments";
import { esignProviderFromEnv } from "@/server/esign/index";
import { WebhookSignatureError } from "@/server/esign/provider";
import {
  approveEngagement,
  countersignEngagement,
  draftEngagement,
  handleEsignWebhook,
  handlePaymentWebhook,
  sendDueReminders,
  sendEngagement,
  voidEngagement,
} from "@/server/services/engagement";
import type { Actor } from "@/server/types";

const T0 = new Date("2026-10-06T10:00:00Z");
const hours = (h: number) => new Date(T0.getTime() + h * 3_600_000);

const attorney: Actor = { userId: "u-att", role: "attorney", firmId: "f1", lawyerId: "l1", mfa: true };
const otherAttorney: Actor = { userId: "u-att2", role: "attorney", firmId: "f1", lawyerId: "l2", mfa: true };
const paralegal: Actor = { userId: "u-para", role: "paralegal", firmId: "f1", supportsLawyerIds: ["l1"], mfa: true };

function setup() {
  const db = createMemoryDb();
  db.firms.insert({ id: "f1", name: "Firm", structure: "in_firm" });
  db.lawyers.insert({
    id: "l1", firmId: "f1", name: "A. Attorney", email: "a@f.test", licensedStates: ["TX"], matterTypes: ["new_plan"], specialties: [],
    languages: ["en"], weeklyCapacity: 5, activeLeadCap: 5, acceptSlaMinutes: 60, active: true, stats: { avgAcceptMinutes: 10, showRate: 1, reviewScore: 5 },
  });
  db.persons.insert({ id: "p1", firstName: "Pat", lastName: "Client", email: "pat@x.test", phone: "+15555550100", language: "es", state: "TX" });
  db.leads.insert({
    id: "lead1", personId: "p1", createdAt: T0.toISOString(), stage: "consult_held", stageHistory: [], matterType: "new_plan", state: "TX", urgent: false,
    score: { score: 80, tier: "hot", grade: "A", urgent: false, components: [], redFlags: [] }, segments: [], source: {},
    consent: buildConsentRecord({ smsConsent: true, acknowledgedNoRelationship: true, pageUrl: "/x", ip: null, userAgent: null, now: T0 }),
    offerSummary: "s",
    conflictCard: { clientName: "Pat Client", parties: [], matterType: "new_plan", state: "TX", clearance: "clear" },
    intake: { summary: "s", redFlags: [], deadlines: [], household: { members: [] }, assets: {}, answers: {} },
    firmId: "f1", assignedLawyerId: "l1",
  });
  return { db, esign: new MockEsignProvider("s", () => T0), pay: new MockPaymentProvider() };
}

async function sent(db: Db, esign: MockEsignProvider, pay: MockPaymentProvider, extra = {}) {
  const d = draftEngagement(db, paralegal, { leadId: "lead1", packageId: "trust_package", feeCents: 400000, ...extra }, T0);
  approveEngagement(db, attorney, d.id, T0);
  return sendEngagement(db, paralegal, d.id, esign, pay, T0);
}

describe("engagement flow", () => {
  it("runs draft to countersigned with billable events and documents", async () => {
    const { db, esign, pay } = setup();
    const e = await sent(db, esign, pay);
    expect(e.status).toBe("sent");
    expect(db.leads.get("lead1")!.stage).toBe("proposal_sent");
    const env = esign.envelopes.get(e.providerEnvelopeId!)!;
    expect(env.input.requireSmsCode).toBe(true);
    expect(env.input.language).toBe("es");
    expect(db.activities.list().some((a) => a.summary === "Engagement sent for signature")).toBe(true);

    const view = esign.simulateView(e.providerEnvelopeId!, hours(1));
    await handleEsignWebhook(db, esign, view.rawBody, view.headers, hours(1));
    expect(db.engagements.get(e.id)!.status).toBe("viewed");

    const sign = esign.simulateSign(e.providerEnvelopeId!, hours(2));
    const stored: string[] = [];
    await handleEsignWebhook(db, esign, sign.rawBody, sign.headers, hours(2), (k) => void stored.push(k));
    const signed = db.engagements.get(e.id)!;
    expect(signed.status).toBe("signed");
    expect(signed.documentIds).toHaveLength(2);
    expect(stored).toEqual([`engagements/${e.id}/signed.pdf`, `engagements/${e.id}/audit-certificate.pdf`]);
    const docs = db.documents.list();
    expect(docs.map((d) => d.kind).sort()).toEqual(["audit_certificate", "engagement_signed"]);
    expect(docs.every((d) => d.visibility === "client" && d.scanStatus === "clean")).toBe(true);
    expect(db.leads.get("lead1")!.stage).toBe("retainer_signed");

    const link = [...pay.links.keys()][0];
    const paid = pay.webhookFor(link, "paid", hours(3));
    await handlePaymentWebhook(db, pay, paid.rawBody, paid.headers, hours(3));
    expect(db.engagements.get(e.id)!.status).toBe("paid");
    expect(db.leads.get("lead1")!.stage).toBe("paid");
    const events = db.billableEvents.list();
    expect(events.find((b) => b.type === "retainer_signed")).toMatchObject({ lawyerId: "l1", state: "TX" });
    expect(events.find((b) => b.type === "fee_collected")?.amountCents).toBe(400000);

    expect(countersignEngagement(db, attorney, e.id, hours(4)).status).toBe("countersigned");
    expect(verifyAuditChain(db.audit.list()).ok).toBe(true);
    expect(JSON.stringify(db.audit.list())).not.toMatch(/400000|ENGAGEMENT AGREEMENT/);
  });

  it("does not let a paralegal approve, or send unapproved", async () => {
    const { db, esign, pay } = setup();
    const d = draftEngagement(db, paralegal, { leadId: "lead1", packageId: "will_package", feeCents: 150000 }, T0);
    expect(() => approveEngagement(db, paralegal, d.id, T0)).toThrow(ForbiddenError);
    await expect(sendEngagement(db, paralegal, d.id, esign, pay, T0)).rejects.toThrow(/approved/);
    expect(() => countersignEngagement(db, paralegal, d.id, T0)).toThrow(ForbiddenError);
  });

  it("forbids an attorney who is not assigned", () => {
    const { db } = setup();
    expect(() => draftEngagement(db, otherAttorney, { leadId: "lead1", packageId: "will_package", feeCents: 1 }, T0)).toThrow(ForbiddenError);
    const d = draftEngagement(db, attorney, { leadId: "lead1", packageId: "will_package", feeCents: 150000 }, T0);
    expect(() => approveEngagement(db, otherAttorney, d.id, T0)).toThrow(ForbiddenError);
  });

  it("rejects a bad webhook signature", async () => {
    const { db, esign, pay } = setup();
    const e = await sent(db, esign, pay);
    const w = esign.simulateSign(e.providerEnvelopeId!);
    await expect(handleEsignWebhook(db, esign, w.rawBody, { "x-mock-signature": "00" }, T0)).rejects.toThrow(WebhookSignatureError);
    await expect(handleEsignWebhook(db, esign, w.rawBody + " ", w.headers, T0)).rejects.toThrow(WebhookSignatureError);
    const p = pay.webhookFor([...pay.links.keys()][0], "paid");
    await expect(handlePaymentWebhook(db, pay, p.rawBody, {}, T0)).rejects.toThrow(WebhookSignatureError);
    expect(db.engagements.get(e.id)!.status).toBe("sent");
  });

  it("is idempotent for duplicate and out-of-order webhooks", async () => {
    const { db, esign, pay } = setup();
    const e = await sent(db, esign, pay);
    const sign = esign.simulateSign(e.providerEnvelopeId!, hours(2));
    await handleEsignWebhook(db, esign, sign.rawBody, sign.headers, hours(2));
    await handleEsignWebhook(db, esign, sign.rawBody, sign.headers, hours(2));
    const late = esign.webhookFor(e.providerEnvelopeId!, "viewed", hours(1)); // arrives after signed
    await handleEsignWebhook(db, esign, late.rawBody, late.headers, hours(3));
    const cur = db.engagements.get(e.id)!;
    expect(cur.status).toBe("signed");
    expect(cur.documentIds).toHaveLength(2);
    expect(db.billableEvents.list().filter((b) => b.type === "retainer_signed")).toHaveLength(1);

    const paid = pay.webhookFor([...pay.links.keys()][0], "paid", hours(3));
    await handlePaymentWebhook(db, pay, paid.rawBody, paid.headers, hours(3));
    await handlePaymentWebhook(db, pay, paid.rawBody, paid.headers, hours(3));
    expect(db.billableEvents.list().filter((b) => b.type === "fee_collected")).toHaveLength(1);
    await handleEsignWebhook(db, esign, sign.rawBody, sign.headers, hours(4));
    expect(db.engagements.get(e.id)!.status).toBe("paid");
  });

  it("handles payment arriving before signature without losing the signed documents", async () => {
    const { db, esign, pay } = setup();
    const e = await sent(db, esign, pay);
    const paid = pay.webhookFor([...pay.links.keys()][0], "paid", hours(1));
    await handlePaymentWebhook(db, pay, paid.rawBody, paid.headers, hours(1));
    const sign = esign.simulateSign(e.providerEnvelopeId!, hours(2));
    await handleEsignWebhook(db, esign, sign.rawBody, sign.headers, hours(2));
    const cur = db.engagements.get(e.id)!;
    expect(cur.status).toBe("paid");
    expect(cur.documentIds).toHaveLength(2);
    expect(cur.history.map((h) => h.status)).toContain("signed");
  });

  it("sends reminders once each at 24h, 72h and 7d, and not after signing", async () => {
    const { db, esign, pay } = setup();
    const e = await sent(db, esign, pay);
    const id = e.providerEnvelopeId!;
    expect(await sendDueReminders(db, esign, hours(23))).toBe(0);
    expect(await sendDueReminders(db, esign, hours(25))).toBe(1);
    expect(await sendDueReminders(db, esign, hours(30))).toBe(0);
    expect(await sendDueReminders(db, esign, hours(73))).toBe(1);
    expect(await sendDueReminders(db, esign, hours(169))).toBe(1);
    expect(await sendDueReminders(db, esign, hours(400))).toBe(0);
    expect(esign.reminderCount(id)).toBe(3);
    expect(db.engagements.get(e.id)!.remindersSent).toEqual(["24h", "72h", "7d"]);

    const s = setup();
    const e2 = await sent(s.db, s.esign, s.pay);
    const sign = s.esign.simulateSign(e2.providerEnvelopeId!, hours(2));
    await handleEsignWebhook(s.db, s.esign, sign.rawBody, sign.headers, hours(2));
    expect(await sendDueReminders(s.db, s.esign, hours(100))).toBe(0);
  });

  it("includes the joint-representation waiver for couples only", () => {
    const { db } = setup();
    const c = draftEngagement(db, attorney, { leadId: "lead1", packageId: "couples_trust", feeCents: 600000, couple: { spouseName: "Sam Client" }, customScope: "Include deed for the lake house" }, T0);
    expect(c.letter).toMatch(/JOINT REPRESENTATION AND CONFLICT WAIVER/);
    expect(c.letter).toMatch(/Sam Client/);
    expect(c.letter).toMatch(/DRAFT TEMPLATE/);
    expect(c.letter).toMatch(/lake house/);
    const single = draftEngagement(db, attorney, { leadId: "lead1", packageId: "will_package", feeCents: 150000 }, T0);
    expect(single.letter).not.toMatch(/JOINT REPRESENTATION/);
  });

  it("voids an unsigned engagement but not a signed one", async () => {
    const { db, esign, pay } = setup();
    const e = await sent(db, esign, pay);
    expect((await voidEngagement(db, paralegal, e.id, esign, "client changed mind", T0)).status).toBe("voided");
    const s = setup();
    const e2 = await sent(s.db, s.esign, s.pay);
    const sign = s.esign.simulateSign(e2.providerEnvelopeId!);
    await handleEsignWebhook(s.db, s.esign, sign.rawBody, sign.headers, T0);
    await expect(voidEngagement(s.db, attorney, e2.id, s.esign, "x", T0)).rejects.toThrow(/signed/);
  });
});

describe("esignProviderFromEnv", () => {
  it("defaults to mock outside production", () => {
    expect(esignProviderFromEnv({}).name).toBe("mock");
    expect(esignProviderFromEnv({ ESIGN_PROVIDER: "docusign" }).name).toBe("mock"); // credentials missing
  });

  it("selects real providers when credentials exist", () => {
    expect(esignProviderFromEnv({ ESIGN_PROVIDER: "dropboxsign", DROPBOXSIGN_API_KEY: "k" }).name).toBe("dropboxsign");
    expect(
      esignProviderFromEnv({
        ESIGN_PROVIDER: "docusign", DOCUSIGN_ACCOUNT_ID: "a", DOCUSIGN_ACCESS_TOKEN: "t", DOCUSIGN_BASE_URI: "https://demo.docusign.net", DOCUSIGN_HMAC_KEY: "h",
      }).name,
    ).toBe("docusign");
  });

  it("refuses the mock in production unless explicitly allowed", () => {
    expect(() => esignProviderFromEnv({ NODE_ENV: "production" })).toThrow();
    expect(() => esignProviderFromEnv({ NODE_ENV: "production", ESIGN_PROVIDER: "docusign" })).toThrow();
    expect(esignProviderFromEnv({ NODE_ENV: "production", ESIGN_ALLOW_MOCK: "true" }).name).toBe("mock");
  });
});
