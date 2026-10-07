import { describe, expect, it } from "vitest";
import { buildConsentRecord } from "@/lib/consent";
import { fillTemplate, MERGE_FIELDS, SAMPLE_VALUES, STARTER_TEMPLATE } from "@/lib/retainerTemplates";
import { ESIGN_CONSENT_VERSION } from "@/lib/esignConsent";
import { ForbiddenError } from "@/server/auth/policy";
import { verifyAuditChain } from "@/server/audit/log";
import { createMemoryDb, type Db } from "@/server/db";
import { BuiltinEsignProvider } from "@/server/esign/builtin";
import { MockPaymentProvider } from "@/server/esign/payments";
import { WebhookSignatureError } from "@/server/esign/provider";
import { LogEmailTransport } from "@/server/notify/transports";
import type { Notifier, NotifyMessage, NotifyTarget } from "@/server/notify";
import { pipelineBoard, retainerStatus } from "@/server/portal/pipeline";
import {
  approveEngagement,
  countersignEngagement,
  draftEngagement,
  handleEsignWebhook,
  MissingFieldsError,
  prepareDraft,
  sendDueReminders,
  sendEngagement,
} from "@/server/services/engagement";
import {
  approveTemplate,
  listFirmTemplates,
  pickTemplate,
  retireTemplate,
  saveTemplateVersion,
  setTemplateDefault,
  uploadAgreementPdf,
} from "@/server/services/retainerTemplates";
import { markViewed, namesMatch, signEngagement, signingView, SigningError } from "@/server/services/signing";
import { getBlob } from "@/server/storage/blobs";
import { acceptInvite, clientStatus, verifyInvite } from "@/server/services/clientPortal";
import { inviteSpouse } from "@/server/services/coSigner";
import type { Actor, Lead } from "@/server/types";

const T0 = new Date("2026-10-07T15:00:00Z");
const hours = (h: number) => new Date(T0.getTime() + h * 3_600_000);

const attorney: Actor = { userId: "u-att", role: "attorney", firmId: "f1", lawyerId: "l1", mfa: true };
const paralegal: Actor = { userId: "u-para", role: "paralegal", firmId: "f1", supportsLawyerIds: ["l1"], mfa: true };
const firmAdmin: Actor = { userId: "u-fa", role: "firm_admin", firmId: "f1", mfa: true };
const otherAttorney: Actor = { userId: "u-att2", role: "attorney", firmId: "f2", lawyerId: "l2", mfa: true };
const otherAdmin: Actor = { userId: "u-fa2", role: "firm_admin", firmId: "f2", mfa: true };
const platform: Actor = { userId: "u-admin", role: "platform_admin", mfa: true };
const client: Actor = { userId: "u-client", role: "client", personId: "p1", firmId: "f1", mfa: true };
const strangerClient: Actor = { userId: "u-client2", role: "client", personId: "p2", mfa: true };

const BODY = `ENGAGEMENT AGREEMENT for {{client_names}} of {{client_address}}
Matter: {{matter_type}}. Package: {{package}}. Fee: {{flat_fee}}. Payment: {{payment_plan}}.
Attorney: {{attorney_name}}, {{firm_name}}. Dated {{date}}.
What you told us: {{intake_summary}}`;

const PDF = new TextEncoder().encode("%PDF-1.4\n% firm standard terms\n");

function lawyer(id: string, firmId: string, name: string) {
  return {
    id, firmId, name, email: `${id}@firm.test`, licensedStates: ["IL"], matterTypes: ["new_plan" as const], specialties: [],
    languages: ["en"], weeklyCapacity: 5, activeLeadCap: 5, acceptSlaMinutes: 60, active: true, stats: { avgAcceptMinutes: 10, showRate: 1, reviewScore: 5 },
  };
}

function lead(id: string, personId: string, more: Partial<Lead> = {}): Lead {
  return {
    id, personId, createdAt: T0.toISOString(), stage: "consult_held", stageHistory: [{ stage: "consult_held", at: T0.toISOString(), by: "u-att" }], matterType: "new_plan", state: "IL", urgent: false,
    score: { score: 80, tier: "hot", grade: "A", urgent: false, components: [], redFlags: [] }, segments: [], source: {},
    consent: buildConsentRecord({ smsConsent: true, acknowledgedNoRelationship: true, pageUrl: "/x", ip: null, userAgent: null, now: T0 }),
    offerSummary: "s",
    conflictCard: { clientName: "Pat Client", parties: [], matterType: "new_plan", state: "IL", clearance: "clear" },
    intake: { summary: "Married, two young children, own a home.", goals: "Name guardians", redFlags: [], deadlines: [], household: { members: [] }, assets: {}, answers: {} },
    firmId: "f1", assignedLawyerId: "l1",
    ...more,
  };
}

async function setup() {
  const db = createMemoryDb();
  await db.firms.insert({ id: "f1", name: "Demo Law PLLC", structure: "in_firm" });
  await db.firms.insert({ id: "f2", name: "Other Firm LLP", structure: "in_firm" });
  await db.lawyers.insert(lawyer("l1", "f1", "Avery Demo, Esq."));
  await db.lawyers.insert(lawyer("l2", "f2", "Robin Other, Esq."));
  for (const u of [
    { id: "u-att", email: "l1@firm.test", name: "Avery Demo", role: "attorney" as const, firmId: "f1", lawyerId: "l1", active: true },
    { id: "u-fa", email: "fa@firm.test", name: "Morgan Office", role: "firm_admin" as const, firmId: "f1", active: true },
    { id: "u-att2", email: "l2@firm.test", name: "Robin Other", role: "attorney" as const, firmId: "f2", lawyerId: "l2", active: true },
  ]) await db.users.insert(u);
  await db.persons.insert({ id: "p1", firstName: "Pat", lastName: "Client", email: "pat@x.test", phone: "+15555550100", language: "en", state: "IL" });
  await db.persons.insert({ id: "p2", firstName: "Lee", lastName: "Other", email: "lee@x.test", phone: "+15555550101", language: "en", state: "IL" });
  await db.leads.insert(lead("lead1", "p1"));
  await db.leads.insert(lead("lead2", "p2", { firmId: "f2", assignedLawyerId: "l2" }));
  const email = new LogEmailTransport(true);
  const esign = new BuiltinEsignProvider("s".repeat(40), () => email, "https://site.test");
  return { db, email, esign, pay: new MockPaymentProvider() };
}

async function approvedTemplate(db: Db, opts: { pdf?: boolean; body?: string } = {}) {
  const pdf = opts.pdf ? await uploadAgreementPdf(db, attorney, { name: "Standard terms.pdf", bytes: PDF }, T0) : undefined;
  const t = await saveTemplateVersion(db, firmAdmin, { name: "Estate plan retainer", matterTypes: ["new_plan"], body: opts.body ?? BODY, pdf }, T0);
  return approveTemplate(db, attorney, t.id, T0);
}

const TERMS = { tierId: "complete", tierPriceCents: 400000, plan: { mode: "plan" as const, depositCents: 100000, installments: 3 } };

async function sendWithTemplate(db: Db, esign: BuiltinEsignProvider, pay: MockPaymentProvider, email: LogEmailTransport, extra: Record<string, unknown> = {}) {
  const d = await draftEngagement(db, attorney, { leadId: "lead1", terms: TERMS, mergeValues: { client_address: "1 Elm St, Springfield, IL" }, ...extra }, T0);
  await approveEngagement(db, attorney, d.id, T0);
  return sendEngagement(db, attorney, d.id, esign, pay, T0, { email });
}

const sign = (db: Db, esign: BuiltinEsignProvider, pay: MockPaymentProvider, input: Partial<Parameters<typeof signEngagement>[2]> & { engagementId: string; documentSha256: string }, notifier?: Notifier, at = hours(1)) =>
  signEngagement(db, client, { signerRole: "client", typedName: "Pat Client", consent: true, intent: true, device: { ipPrefix: "203.0.113.0/24", userAgent: "Safari on iPhone" }, ...input }, esign, { payments: pay, notifier }, at);

describe("merge fields", () => {
  it("fills known fields, lists missing ones in order and flags unknown placeholders", () => {
    const r = fillTemplate("Hi {{client_names}}, at {{ client_address }}. {{client_names}} {{bogus}} {{flat_fee}}", { client_names: "Pat", flat_fee: "  " });
    expect(r.text).toBe("Hi Pat, at [[Client address: missing]]. Pat {{bogus}} [[Flat fee: missing]]");
    expect(r.missing).toEqual(["client_address", "flat_fee"]);
    expect(r.unknown).toEqual(["bogus"]);
    expect(r.used).toEqual(["client_names", "client_address", "flat_fee"]);
    expect(r.segments.filter((s) => "field" in s && !s.value)).toHaveLength(2);
  });

  it("the starter template and sample values cover every field", () => {
    const r = fillTemplate(MERGE_FIELDS.map((f) => `{{${f.key}}}`).join(" "), SAMPLE_VALUES);
    expect(r.missing).toEqual([]);
    expect(fillTemplate(STARTER_TEMPLATE, SAMPLE_VALUES).unknown).toEqual([]);
  });

  it("drafting fills the client's intake details and refuses while a field is missing; the lawyer's value fills it", async () => {
    const { db } = await setup();
    await approvedTemplate(db);
    const preview = await prepareDraft(db, attorney, { leadId: "lead1", terms: TERMS }, T0);
    expect(preview.template?.name).toBe("Estate plan retainer");
    expect(preview.missing).toEqual(["client_address"]);
    expect(preview.letter).toContain("Pat Client");
    expect(preview.letter).toContain("Married, two young children");
    expect(preview.letter).toContain("$4,000");
    expect(preview.letter).toContain("$1,000 deposit when you sign, then 3 monthly payments of $1,000");
    expect(preview.letter).toContain("Avery Demo, Esq., Demo Law PLLC");
    await expect(draftEngagement(db, attorney, { leadId: "lead1", terms: TERMS }, T0)).rejects.toThrow(MissingFieldsError);
    const d = await draftEngagement(db, attorney, { leadId: "lead1", terms: TERMS, mergeValues: { client_address: "1 Elm St", bogus: "x" } }, T0);
    expect(d.letter).toContain("of 1 Elm St");
    expect(d.letter).not.toMatch(/missing|DRAFT TEMPLATE/);
    expect(d.templateId).toMatch(/@1$/);
  });

  it("falls back to the platform letter, DRAFT banner and all, when the firm has no approved template", async () => {
    const { db } = await setup();
    const d = await draftEngagement(db, attorney, { leadId: "lead1", terms: TERMS }, T0);
    expect(d.templateId).toBeUndefined();
    expect(d.letter).toMatch(/^\*\*\* DRAFT TEMPLATE/);
  });
});

describe("retainer templates", () => {
  it("must be approved by an attorney of the firm before use; approving a new version supersedes the old one and keeps the default", async () => {
    const { db } = await setup();
    const draft = await saveTemplateVersion(db, firmAdmin, { name: "Estate plan retainer", matterTypes: ["new_plan"], body: BODY }, T0);
    expect(draft.status).toBe("draft");
    expect(await pickTemplate(db, "f1", "new_plan")).toBeUndefined();
    await expect(draftEngagement(db, attorney, { leadId: "lead1", terms: TERMS, templateId: draft.id }, T0)).rejects.toThrow(/not approved/);
    await expect(approveTemplate(db, firmAdmin, draft.id, T0)).rejects.toThrow(ForbiddenError);
    await expect(approveTemplate(db, paralegal, draft.id, T0)).rejects.toThrow(ForbiddenError);
    await expect(approveTemplate(db, otherAttorney, draft.id, T0)).rejects.toThrow(ForbiddenError);
    const v1 = await approveTemplate(db, attorney, draft.id, T0);
    expect(v1).toMatchObject({ status: "approved", approvedBy: "u-att", approvedByName: "Avery Demo" });
    await setTemplateDefault(db, firmAdmin, v1.id, "new_plan", true, T0);
    expect((await pickTemplate(db, "f1", "new_plan"))?.id).toBe(v1.id);

    const v2 = await saveTemplateVersion(db, attorney, { templateKey: v1.templateKey, name: "Estate plan retainer", matterTypes: ["new_plan"], body: `${BODY}\nNew clause.` }, hours(1));
    expect(v2.version).toBe(2);
    expect((await pickTemplate(db, "f1", "new_plan"))?.id).toBe(v1.id); // still v1 until v2 is approved
    await approveTemplate(db, attorney, v2.id, hours(1));
    expect((await db.retainerTemplates.get(v1.id))?.status).toBe("superseded");
    const picked = await pickTemplate(db, "f1", "new_plan");
    expect(picked?.id).toBe(v2.id);
    expect(picked?.defaultFor).toEqual(["new_plan"]);
    const audits = (await db.audit.list()).filter((a) => a.action === "retainer_template.approve");
    expect(audits.map((a) => a.resourceId)).toEqual([v1.id, v2.id]);
    expect(JSON.stringify(audits)).not.toContain("ENGAGEMENT AGREEMENT"); // hashes, not wording
    await retireTemplate(db, firmAdmin, v2.id, hours(2));
    expect(await pickTemplate(db, "f1", "new_plan")).toBeUndefined();
  });

  it("refuses to approve a template with an unknown merge field", async () => {
    const { db } = await setup();
    const t = await saveTemplateVersion(db, attorney, { name: "Typo", matterTypes: ["new_plan"], body: "Hello {{client_nmes}}" }, T0);
    await expect(approveTemplate(db, attorney, t.id, T0)).rejects.toThrow(/client_nmes/);
  });

  it("keeps each firm's templates to itself", async () => {
    const { db } = await setup();
    const mine = await approvedTemplate(db);
    expect((await listFirmTemplates(db, firmAdmin)).map((s) => s.templateKey)).toEqual([mine.templateKey]);
    expect(await listFirmTemplates(db, otherAdmin)).toEqual([]);
    await expect(listFirmTemplates(db, otherAdmin, "f1")).rejects.toThrow(ForbiddenError);
    expect((await listFirmTemplates(db, platform, "f1")).length).toBe(1); // platform admins can look
    await expect(saveTemplateVersion(db, otherAdmin, { templateKey: mine.templateKey, name: "x", matterTypes: ["new_plan"], body: "x" }, T0)).rejects.toThrow(ForbiddenError);
    await expect(setTemplateDefault(db, otherAdmin, mine.id, "new_plan", true, T0)).rejects.toThrow(ForbiddenError);
    await expect(retireTemplate(db, otherAttorney, mine.id, T0)).rejects.toThrow(ForbiddenError);
    await expect(saveTemplateVersion(db, paralegal, { name: "x", matterTypes: ["new_plan"], body: "x" }, T0)).rejects.toThrow(ForbiddenError);
    await expect(saveTemplateVersion(db, platform, { name: "x", matterTypes: ["new_plan"], body: "x" }, T0)).rejects.toThrow(ForbiddenError);
    // another firm's lead never picks this firm's template
    expect(await pickTemplate(db, "f2", "new_plan")).toBeUndefined();
  });

  it("a lawyer cannot send another firm's template", async () => {
    const { db } = await setup();
    const theirs = await (async () => {
      const t = await saveTemplateVersion(db, otherAdmin, { name: "Theirs", matterTypes: ["new_plan"], body: BODY }, T0);
      return approveTemplate(db, otherAttorney, t.id, T0);
    })();
    await expect(prepareDraft(db, attorney, { leadId: "lead1", terms: TERMS, templateId: theirs.id }, T0)).rejects.toThrow(ForbiddenError);
    await expect(draftEngagement(db, attorney, { leadId: "lead1", terms: TERMS, templateId: theirs.id, mergeValues: { client_address: "x" } }, T0)).rejects.toThrow(ForbiddenError);
  });

  it("only accepts a real PDF the firm uploaded itself", async () => {
    const { db } = await setup();
    await expect(uploadAgreementPdf(db, attorney, { name: "x.pdf", bytes: new TextEncoder().encode("not a pdf") }, T0)).rejects.toThrow(/PDF/);
    const pdf = await uploadAgreementPdf(db, attorney, { name: "Terms.pdf", bytes: PDF }, T0);
    expect((await getBlob(db, pdf.storageKey))?.bytes.equals(Buffer.from(PDF))).toBe(true);
    await expect(saveTemplateVersion(db, otherAdmin, { name: "x", matterTypes: ["new_plan"], body: "x", pdf }, T0)).rejects.toThrow(ForbiddenError);
    await expect(db.blobs.update(pdf.storageKey, { data: "" })).rejects.toThrow(/immutable/);
  });
});

describe("built-in e-sign", () => {
  it("send emails a dry-run signing invite; the client signs; the lead moves to retainer_signed; the payment plan starts; the attorney countersigns", async () => {
    const { db, esign, pay, email } = await setup();
    await approvedTemplate(db, { pdf: true });
    const e = await sendWithTemplate(db, esign, pay, email);
    expect(e).toMatchObject({ status: "sent", provider: "builtin", providerEnvelopeId: `builtin-${e.id}` });
    expect(e.attachment?.name).toBe("Standard terms.pdf");
    expect(e.signingInvite?.delivered).toBe(false); // dry run
    expect(e.signingInvite?.link).toMatch(new RegExp(`^/client/welcome\\?token=.+&next=%2Fclient%2Fsign%2F${e.id}$`));
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]).toMatchObject({ to: "pat@x.test", tag: "engagement-signing-invite" });
    expect(email.sent[0].text).not.toMatch(/\$|Married/); // no fee or case facts in the email
    expect((await db.leads.get("lead1"))!.stage).toBe("proposal_sent");
    expect(pay.links.size).toBe(0); // with a plan the link goes out after signing

    const view = await signingView(db, client, e.id, hours(1));
    expect(view.state).toBe("ready");
    expect(view.summary.fee).toContain("$4,000");
    expect(view.summary.payment.join(" ")).toMatch(/\$1,000 deposit/);
    expect(view.attachment?.sha256).toBe(e.attachment?.sha256);
    await markViewed(db, client, e.id, esign, hours(1));
    expect((await db.engagements.get(e.id))!.status).toBe("viewed");

    const sent: { to: NotifyTarget; msg: NotifyMessage }[] = [];
    const notifier: Notifier = { send: async (to, msg) => void sent.push({ to, msg }) };
    const r = await sign(db, esign, pay, { engagementId: e.id, documentSha256: view.documentSha256 }, notifier);
    expect(r.complete).toBe(true);
    expect(r.signature).toMatchObject({
      typedName: "Pat Client", expectedName: "Pat Client", signerRole: "client", ipPrefix: "203.0.113.0/24", userAgent: "Safari on iPhone",
      consentVersion: ESIGN_CONSENT_VERSION, intent: true, attachmentSha256: e.attachment!.sha256, documentSha256: e.documentSha256,
    });
    const signed = (await db.engagements.get(e.id))!;
    expect(signed.status).toBe("signed");
    expect((await db.leads.get("lead1"))!.stage).toBe("retainer_signed");
    const docs = await db.documents.list(undefined, { leadId: "lead1" });
    expect(docs.map((d) => [d.kind, d.contentType]).sort()).toEqual([["audit_certificate", "text/html"], ["engagement_signed", "text/html"]]);
    const copy = (await getBlob(db, docs.find((d) => d.kind === "engagement_signed")!.storageKey))!.bytes.toString();
    expect(copy).toContain("Signature certificate");
    expect(copy).toContain(e.documentSha256!);
    expect(signed.paymentPlan?.activatedAt).toBe(hours(1).toISOString());
    expect(pay.links.size).toBe(1); // the deposit link went out on signing
    expect((await signingView(db, client, e.id, hours(1))).paymentLinkUrl).toMatch(/^https:\/\/pay\.mock\.local\//);
    expect(sent).toHaveLength(1);
    expect(sent[0].msg).toEqual({ subject: "A retainer was signed", text: expect.not.stringMatching(/Pat|Client Pat/), link: "/portal/leads/lead1" });

    expect((await countersignEngagement(db, attorney, e.id, hours(2))).status).toBe("countersigned");
    expect((await signingView(db, client, e.id, hours(2))).countersigned).toBe(true);
    expect(verifyAuditChain(await db.audit.list()).ok).toBe(true);
    expect(JSON.stringify(await db.audit.list())).not.toMatch(/400000|ENGAGEMENT AGREEMENT|Pat Client/);
  });

  it("requires consent, intent and the printed name, and binds the signature to the approved document hash", async () => {
    const { db, esign, pay, email } = await setup();
    await approvedTemplate(db, { pdf: true });
    const e = await sendWithTemplate(db, esign, pay, email);
    const hash = e.documentSha256!;
    await expect(sign(db, esign, pay, { engagementId: e.id, documentSha256: hash, consent: false })).rejects.toThrow(/electronic records/);
    await expect(sign(db, esign, pay, { engagementId: e.id, documentSha256: hash, intent: false })).rejects.toThrow(/intend/);
    await expect(sign(db, esign, pay, { engagementId: e.id, documentSha256: hash, typedName: "Somebody Else" })).rejects.toThrow(/Pat Client/);
    await expect(sign(db, esign, pay, { engagementId: e.id, documentSha256: "0".repeat(64) })).rejects.toThrow(/reload/);
    // the letter changed after approval: nothing can be signed
    await db.engagements.update(e.id, { letter: `${e.letter} plus a sneaky clause` });
    await expect(sign(db, esign, pay, { engagementId: e.id, documentSha256: hash })).rejects.toThrow(/changed after your attorney approved/);
    await db.engagements.update(e.id, { letter: e.letter });
    // another client cannot sign it
    await expect(signEngagement(db, strangerClient, { engagementId: e.id, signerRole: "client", typedName: "Pat Client", consent: true, intent: true, documentSha256: hash }, esign)).rejects.toThrow(ForbiddenError);
    expect(await db.signatures.list()).toEqual([]);
    expect(namesMatch("  pat   CLIENT ", "Pat Client")).toBe(true);
    expect(namesMatch("José Núñez", "Jose Nunez")).toBe(true);

    const r = await sign(db, esign, pay, { engagementId: e.id, documentSha256: hash, typedName: "pat client" });
    // signature records are immutable
    await expect(db.signatures.update(r.signature.id, { typedName: "x" })).rejects.toThrow(/immutable/);
    await expect(db.signatures.remove(r.signature.id)).rejects.toThrow(/immutable/);
    await expect(sign(db, esign, pay, { engagementId: e.id, documentSha256: hash })).rejects.toThrow(SigningError);
  });

  it("a couple: each spouse gets their own invite and signs only their own slot, from their own login", async () => {
    const { db, esign, pay, email } = await setup();
    await approvedTemplate(db);
    // each spouse needs their own email: the first client's is refused before anything is saved
    await expect(sendWithTemplate(db, esign, pay, email, { couple: { spouseName: "Jamie Client", spouseEmail: "PAT@x.test" } })).rejects.toThrow(/own email/);
    expect(await db.engagements.list()).toEqual([]);
    const e = await sendWithTemplate(db, esign, pay, email, { couple: { spouseName: "Jamie Client", spouseEmail: "jamie@x.test" } });
    expect(e.letter).toContain("Pat Client and Jamie Client");
    // two invites: one per spouse, each to their own address and their own login
    expect(email.sent.map((m) => m.to)).toEqual(["pat@x.test", "jamie@x.test"]);
    expect(e.signingInvite?.spouse).toMatchObject({ firstName: "Jamie", emailHint: "j•••@x.test", delivered: false });
    const spouseToken = new URLSearchParams(e.signingInvite!.spouse!.link!.split("?")[1]).get("token")!;
    const spouseUser = (await db.users.get(verifyInvite(spouseToken, T0)!.uid))!;
    expect(spouseUser).toMatchObject({ role: "client", email: "jamie@x.test", personId: e.spousePersonId });
    expect(spouseUser.personId).not.toBe("p1");
    const spouse: Actor = { userId: spouseUser.id, role: "client", personId: spouseUser.personId, firmId: "f1", mfa: true };
    // and the spouse signs in through the same single-use invite flow
    expect((await acceptInvite(db, spouseToken, hours(1))).userId).toBe(spouseUser.id);

    const view = await signingView(db, client, e.id, hours(1));
    expect(view.signers.map((s) => s.name)).toEqual(["Pat Client", "Jamie Client"]);
    expect(view.mySlot).toBe("client");
    expect(view.waitingFor).toEqual(["Pat", "Jamie"]);
    // the spouse slot cannot be signed from the first client's session
    await expect(sign(db, esign, pay, { engagementId: e.id, documentSha256: view.documentSha256, signerRole: "spouse", typedName: "Jamie Client" })).rejects.toThrow(ForbiddenError);
    const first = await sign(db, esign, pay, { engagementId: e.id, documentSha256: view.documentSha256 });
    expect(first.complete).toBe(false);
    expect(first.signature).toMatchObject({ signerRole: "client", signerPersonId: "p1", signedByUserId: "u-client" });
    const partly = await signingView(db, client, e.id, hours(1));
    expect(partly.state).toBe("partly_signed");
    expect(partly.waitingFor).toEqual(["Jamie"]);
    expect((await db.leads.get("lead1"))!.stage).toBe("proposal_sent");
    expect((await db.engagements.get(e.id))!.status).not.toBe("signed");
    await expect(sign(db, esign, pay, { engagementId: e.id, documentSha256: view.documentSha256, signerRole: "spouse", typedName: "Jamie Client" })).rejects.toThrow(/Only Jamie can sign/);

    // the spouse sees only this agreement, not the case, and cannot sign the first client's slot
    const spouseView = await signingView(db, spouse, e.id, hours(2));
    expect(spouseView.mySlot).toBe("spouse");
    await expect(clientStatus(db, spouse, "lead1")).rejects.toThrow();
    const asSpouse = (input: Partial<Parameters<typeof signEngagement>[2]>) =>
      signEngagement(db, spouse, { engagementId: e.id, documentSha256: view.documentSha256, signerRole: "spouse", typedName: "Jamie Client", consent: true, intent: true, ...input }, esign, { payments: pay }, hours(3));
    await expect(asSpouse({ signerRole: "client", typedName: "Pat Client" })).rejects.toThrow(ForbiddenError);
    await expect(asSpouse({ typedName: "Pat Client" })).rejects.toThrow(/Jamie Client/);
    const second = await asSpouse({});
    expect(second.complete).toBe(true);
    expect(second.signature).toMatchObject({ signerRole: "spouse", signerPersonId: spouseUser.personId, signedByUserId: spouseUser.id });
    expect((await db.leads.get("lead1"))!.stage).toBe("retainer_signed");
    expect((await db.signatures.list(undefined, { engagementId: e.id })).map((s) => s.signerRole).sort()).toEqual(["client", "spouse"]);
    expect((await signingView(db, client, e.id, hours(3))).waitingFor).toEqual([]);
  });

  it("a couple without the spouse's email: the first client gives it and the spouse gets their own link, which the first client never sees", async () => {
    const { db, esign, pay, email } = await setup();
    await approvedTemplate(db);
    const e = await sendWithTemplate(db, esign, pay, email, { couple: { spouseName: "Jamie Client" } });
    expect(e.signingInvite?.spouseEmailNeeded).toEqual({ firstName: "Jamie" });
    expect(e.spousePersonId).toBeUndefined();
    // nobody can sign the spouse slot yet: there is no second client login
    await expect(sign(db, esign, pay, { engagementId: e.id, documentSha256: e.documentSha256!, signerRole: "spouse", typedName: "Jamie Client" })).rejects.toThrow(ForbiddenError);
    await expect(inviteSpouse(db, client, e.id, "pat@x.test", { email }, hours(1))).rejects.toThrow(/own email/);
    await expect(inviteSpouse(db, strangerClient, e.id, "jamie@x.test", { email }, hours(1))).rejects.toThrow(ForbiddenError);
    const byClient = await inviteSpouse(db, client, e.id, "Jamie@X.test", { email }, hours(1));
    expect(byClient).toEqual({ name: "Jamie Client", firstName: "Jamie", emailHint: "j•••@x.test", delivered: false });
    expect(byClient).not.toHaveProperty("link"); // holding it would let the first client sign in as Jamie
    expect(email.sent.at(-1)).toMatchObject({ to: "jamie@x.test", tag: "engagement-signing-invite" });
    expect((await signingView(db, client, e.id, hours(1))).spouseEmailHint).toBe("j•••@x.test");
    // the office can resend it, and sees the link to text it
    const byOffice = await inviteSpouse(db, paralegal, e.id, undefined, { email }, hours(2));
    expect(byOffice.link).toMatch(/^\/client\/welcome\?token=/);
    expect((await db.audit.list()).filter((a) => a.action === "engagement.cosigner_invite").map((a) => (a.detail as { requestedBy: string }).requestedBy)).toEqual(["client", "office"]);
  });

  it("rejects forged events and sends reminders for unsigned built-in envelopes", async () => {
    const { db, esign, pay, email } = await setup();
    const e = await sendWithTemplate(db, esign, pay, email);
    const forged = new BuiltinEsignProvider("x".repeat(40)).eventFor(e.providerEnvelopeId!, "signed", T0);
    await expect(handleEsignWebhook(db, esign, forged.rawBody, forged.headers, T0)).rejects.toThrow(WebhookSignatureError);
    expect((await db.engagements.get(e.id))!.status).toBe("sent");
    expect(await sendDueReminders(db, esign, hours(25))).toBe(1);
    expect(email.sent.at(-1)).toMatchObject({ to: "pat@x.test", tag: "engagement-reminder" });
    expect(email.sent.at(-1)!.text).toContain(`https://site.test/client/sign/${e.id}`);
    expect(await sendDueReminders(db, esign, hours(26))).toBe(0);
  });
});

describe("development demo data", () => {
  it("seeds a firm template, a ready lead, a sent retainer, a signed one and a lost lead", async () => {
    const { seedDemo } = await import("@/server/seed");
    const { seedRetainerDemo, simplePdf } = await import("@/server/seedRetainers");
    const db = createMemoryDb();
    await seedDemo(db, T0);
    await seedRetainerDemo(db, T0);
    const board = await pipelineBoard(db, platform, {}, T0);
    expect(board.counts).toMatchObject({ consult_held: 1, retainer_sent: 1, retainer_signed: 1, lost: 1 });
    expect(Buffer.from(simplePdf("x", ["y"])).toString("latin1")).toMatch(/^%PDF-1\.4[\s\S]*%%EOF\n$/);
  });
});

describe("pipeline board", () => {
  it("platform admins see every lead, firm admins only their firm's, lawyers and marketing none", async () => {
    const { db, esign, pay, email } = await setup();
    await sendWithTemplate(db, esign, pay, email);
    const all = await pipelineBoard(db, platform, {}, hours(48));
    expect(all.rows.map((r) => r.leadId).sort()).toEqual(["lead1", "lead2"]);
    const row = all.rows.find((r) => r.leadId === "lead1")!;
    expect(row).toMatchObject({ label: "Pat", column: "retainer_sent", retainer: "sent", lawyerName: "Avery Demo, Esq.", state: "IL", daysInStage: 2 });
    expect(all.counts.retainer_sent).toBe(1);
    expect(all.counts.consult_held).toBe(1);

    const mine = await pipelineBoard(db, firmAdmin, {}, hours(48));
    expect(mine.rows.map((r) => r.leadId)).toEqual(["lead1"]);
    expect((await pipelineBoard(db, otherAdmin, {}, hours(48))).rows.map((r) => r.leadId)).toEqual(["lead2"]);
    for (const a of [attorney, paralegal, client, { userId: "u-m", role: "marketing" as const, mfa: true }, { userId: "u-i", role: "intake" as const, mfa: true }]) {
      await expect(pipelineBoard(db, a, {}, T0), a.role).rejects.toThrow(ForbiddenError);
    }
    expect((await pipelineBoard(db, platform, { column: "consult_held" }, T0)).rows.map((r) => r.leadId)).toEqual(["lead2"]);
    expect((await pipelineBoard(db, platform, { lawyerId: "l2" }, T0)).rows.map((r) => r.leadId)).toEqual(["lead2"]);
    expect((await pipelineBoard(db, platform, { from: "2026-10-08" }, T0)).rows).toEqual([]);
  });

  it("summarizes retainer status from the newest live engagement", () => {
    const e = (status: string, at: string) => ({ status, history: [{ status: "draft", at }] }) as never;
    expect(retainerStatus([])).toBe("not_sent");
    expect(retainerStatus([e("voided", "2026-01-01"), e("viewed", "2026-01-02")])).toBe("viewed");
    expect(retainerStatus([e("paid", "2026-01-01")])).toBe("signed");
    expect(retainerStatus([e("voided", "2026-01-01")])).toBe("voided");
  });
});
