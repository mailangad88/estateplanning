/**
 * Client portal: invite a client after their attorney accepts the case, let them
 * in with a single-use link, and show them a plain-language status. Clients only
 * ever see client-visible comments and documents (enforced by buildCaseView).
 *
 * Invite tokens are HMAC-signed, bound to one user and one lead, expire after
 * 7 days and work once. Used token ids are recorded as system activities on the
 * lead so no new collection is needed.
 */
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { audit } from "@/server/audit/log";
import { assertCan, ForbiddenError } from "@/server/auth/policy";
import { devLoginEnabled, issueSession } from "@/server/auth/session";
import type { Db } from "@/server/db";
import { buildCaseView } from "@/server/portal/caseView";
import { STAGES, type Actor, type Comment, type DocumentKind, type DocumentRecord, type Lead, type Stage } from "@/server/types";

export const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;
const USED_PREFIX = "client-invite-used:";

interface InvitePayload {
  uid: string;
  lid: string;
  jti: string;
  exp: number;
}

function inviteKey(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return createHash("sha256").update(`client-invite:${s}`).digest();
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (32+ characters)");
  return createHash("sha256").update("client-invite:development-only-session-secret-change-me").digest();
}

export function signInvite(p: InvitePayload): string {
  const data = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${data}.${createHmac("sha256", inviteKey()).update(data).digest("base64url")}`;
}

export function verifyInvite(token: string, now = new Date()): InvitePayload | null {
  const [data, sig] = (token ?? "").split(".");
  if (!data || !sig) return null;
  const expected = Buffer.from(createHmac("sha256", inviteKey()).update(data).digest("base64url"));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString()) as InvitePayload;
    if (!p.uid || !p.lid || !p.jti || typeof p.exp !== "number" || now.getTime() >= p.exp) return null;
    return p;
  } catch {
    return null;
  }
}

const POST_ACCEPT: Stage[] = STAGES.slice(STAGES.indexOf("accepted")) as Stage[];

export async function inviteClient(db: Db, actor: Actor, leadId: string, now = new Date()): Promise<{ token: string; link: string; userId: string }> {
  const lead = await db.leads.get(leadId);
  if (!lead) throw new Error("Lead not found");
  const ok =
    actor.role === "platform_admin" ||
    (actor.role === "attorney" && !!actor.lawyerId && lead.assignedLawyerId === actor.lawyerId) ||
    (actor.role === "paralegal" && !!lead.assignedLawyerId && !!actor.supportsLawyerIds?.includes(lead.assignedLawyerId)) ||
    (actor.role === "firm_admin" && !!actor.firmId && lead.firmId === actor.firmId && !!lead.assignedLawyerId);
  assertCan(ok, "Only the assigned attorney's team can invite a client");
  if (!lead.assignedLawyerId || !POST_ACCEPT.includes(lead.stage) || lead.exit) throw new Error("Invite the client after the attorney accepts the case");
  const person = await db.persons.get(lead.personId);
  if (!person) throw new Error("Client record not found");

  let user = (await db.users.list((u) => u.role === "client" && u.personId === person.id))[0];
  if (!user) {
    user = await db.users.insert({
      id: randomUUID(),
      email: person.email,
      name: `${person.firstName} ${person.lastName}`.trim(),
      role: "client",
      firmId: lead.firmId,
      personId: person.id,
      active: true,
    });
  } else if (!user.active) {
    user = await db.users.update(user.id, { active: true });
  }
  const token = signInvite({ uid: user.id, lid: lead.id, jti: randomUUID(), exp: now.getTime() + INVITE_TTL_MS });
  // The caller delivers the link (email or text through the nurture layer); it is never logged.
  await audit(db, actor, { action: "client.invite", resourceType: "user", resourceId: user.id, leadId, at: now });
  return { token, link: `/client/welcome?token=${encodeURIComponent(token)}`, userId: user.id };
}

export interface AcceptResult {
  userId: string;
  /** Session token. mfa is false unless development sign-in is on; production must continue through the two-step verify flow. */
  session: string;
  mfa: boolean;
}

export async function acceptInvite(db: Db, token: string, now = new Date()): Promise<AcceptResult> {
  const p = verifyInvite(token, now);
  if (!p) throw new Error("This link is not valid or has expired. Ask your attorney's office for a new one.");
  const used = await db.activities.list((a) => a.leadId === p.lid && a.kind === "system" && a.summary === `${USED_PREFIX}${p.jti}`);
  if (used.length) throw new Error("This link has already been used. Ask your attorney's office for a new one.");
  const user = await db.users.get(p.uid);
  if (!user || !user.active || user.role !== "client") throw new Error("This link is not valid or has expired. Ask your attorney's office for a new one.");
  await db.activities.insert({ id: randomUUID(), leadId: p.lid, kind: "system", at: now.toISOString(), summary: `${USED_PREFIX}${p.jti}` });
  await audit(db, "system", { action: "client.invite_accept", resourceType: "user", resourceId: user.id, leadId: p.lid, at: now });
  const mfa = devLoginEnabled();
  return { userId: user.id, session: issueSession(user.id, mfa, now), mfa };
}

/** The client's own lead (a client user is tied to one person). */
export async function clientLeadId(db: Db, actor: Actor): Promise<string | null> {
  if (actor.role !== "client" || !actor.personId) return null;
  const leads = await db.leads.list((l) => l.personId === actor.personId);
  return leads.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id ?? null;
}

export interface StatusStep {
  label: string;
  done: boolean;
  current: boolean;
}

export interface ChecklistItem {
  key: string;
  label: string;
  hint: string;
  kinds: DocumentKind[];
  uploaded: number;
}

export interface ClientStatus {
  attorney?: string;
  steps: StatusStep[];
  nextStep: string;
  checklist: ChecklistItem[];
  documents: DocumentRecord[];
  comments: Comment[];
}

const CHECKLIST: Omit<ChecklistItem, "uploaded">[] = [
  { key: "will_trust", label: "Existing will or trust", hint: "Any plan you already have, even if it is old.", kinds: ["existing_will", "trust"] },
  { key: "deeds", label: "Deeds to property you own", hint: "A photo of each deed is fine.", kinds: ["deed"] },
  { key: "beneficiaries", label: "Beneficiary forms", hint: "Retirement accounts and life insurance.", kinds: ["beneficiary_form"] },
  { key: "accounts", label: "A list of your accounts", hint: "Banks, investments, and what you owe. A simple list works.", kinds: ["other"] },
];

function stepLabels(stage: Stage, consultAt?: string): { label: string; reached: boolean }[] {
  const at = (s: Stage) => STAGES.indexOf(stage) >= STAGES.indexOf(s);
  const date = consultAt ? new Date(consultAt).toLocaleDateString("en-US", { dateStyle: "long" }) : "";
  return [
    { label: "We received your request", reached: true },
    { label: "Your attorney accepted your case", reached: at("accepted") },
    { label: date ? `Consult booked for ${date}` : "Consult booked", reached: at("consult_booked") },
    { label: "Engagement agreement sent", reached: at("proposal_sent") },
    { label: "Signed", reached: at("retainer_signed") },
    { label: "Payment received", reached: at("paid") },
    { label: "Drafting your documents", reached: at("drafting") },
    { label: "Signing scheduled", reached: at("signing_scheduled") },
    { label: "Your plan is complete", reached: at("plan_complete") },
  ];
}

export async function clientStatus(db: Db, actor: Actor, leadId: string, now = new Date()): Promise<ClientStatus> {
  const view = await buildCaseView(db, actor, leadId, now);
  if (view.access !== "client") throw new ForbiddenError();
  const lead = (await db.leads.get(leadId)) as Lead;
  const consults = (view.sections.consult ?? []).filter((c) => c.status === "booked" || c.status === "held");
  const consultAt = consults[consults.length - 1]?.at;
  const labels = stepLabels(lead.stage, consultAt);
  const lastReached = labels.map((l) => l.reached).lastIndexOf(true);
  const steps = labels.map((l, i) => ({ label: l.label, done: l.reached, current: i === lastReached }));
  const documents = view.sections.documents ?? [];
  const checklist = CHECKLIST.map((c) => ({ ...c, uploaded: documents.filter((d) => c.kinds.includes(d.kind)).length }));
  const flat: Comment[] = [];
  const walk = (nodes: NonNullable<typeof view.sections.comments>) => nodes.forEach((n) => { const { replies, ...c } = n; flat.push(c); walk(replies); });
  walk(view.sections.comments ?? []);
  flat.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { attorney: view.header.assignedLawyer, steps, nextStep: nextStepFor(lead.stage), checklist, documents, comments: flat };
}

function nextStepFor(stage: Stage): string {
  switch (stage) {
    case "accepted":
      return "Your attorney's office will reach out to set up your consult.";
    case "consult_booked":
      return "Gather the items below before your consult.";
    case "consult_held":
    case "proposal_sent":
      return "Watch for your engagement agreement to review and sign.";
    case "retainer_signed":
      return "Next is payment, then your attorney starts drafting.";
    case "paid":
    case "drafting":
      return "Your attorney is preparing your documents. Send a message if anything changes at home.";
    case "signing_scheduled":
      return "Bring a photo ID to your signing.";
    case "plan_complete":
    case "annual_review":
      return "Your plan is complete. Keep your copies somewhere safe.";
    default:
      return "Your attorney's office will be in touch soon.";
  }
}
