/**
 * "My family plan" organizer, server side.
 *
 * Accounts: the plan row is the account, one per verified email. A visitor enters their email and agrees
 * to the consent text; we email a single-use link (through the normal transports, which only log in
 * development). Using the link proves the mailbox and gives a short pre-auth step only; a plan session
 * exists only after the second factor (an authenticator code, or a one-time recovery code), and the first
 * sign-in must set that factor up before any plan data is returned or saved. Second factor, devices,
 * idle and absolute timeouts, export and account deletion live in planAccount.ts. A plan session is not
 * a portal session and has no User behind it: it can read and change one plan, and nothing else. In
 * Postgres it runs as the "planner" RLS role (scopeToPlan), where every other table returns no rows.
 *
 * Storage: the answers are encrypted with AES-256-GCM (FAMILY_PLAN_KEY), bound to the plan id. The
 * plain columns hold only the derived summary (counts, value ranges, gaps), which is what an attorney
 * sees once the plan is linked to the same person's lead. The email address itself is never stored;
 * a keyed hash of it finds the plan again at the next sign-in.
 *
 * Every create, update, delete and staff view is audited. Audit detail carries ids and counts only.
 */
import { createHash, createHmac, randomUUID } from "node:crypto";
import {
  FAMILY_PLAN_CONSENT_VERSION,
  emptyPlan,
  familyPlanBodySchema,
  prefillPlan,
  summarizePlan,
  validatePlan,
  type FamilyPlanBody,
  type FamilyPlanSummary,
  type PlanValidation,
} from "@/lib/familyPlan";
import { audit, type AuditActor } from "@/server/audit/log";
import { aesGcmDecrypt, aesGcmEncrypt, consoleSendEmail, RateLimiter, readToken, signToken, type SendEmail } from "@/server/auth/identity";
import { canViewFamilyPlanSummary } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import type { Actor, Assignment, FamilyPlan, Lead } from "@/server/types";

export class FamilyPlanConfigError extends Error {
  constructor(message = "The family plan organizer is not configured") {
    super(message);
    this.name = "FamilyPlanConfigError";
  }
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

const KEY_VERSION = "v1";

function rawKey(env: Record<string, string | undefined> = process.env): string {
  const k = env.FAMILY_PLAN_KEY;
  if (k && k.length >= 32) return k;
  if (env.NODE_ENV === "production") throw new FamilyPlanConfigError("FAMILY_PLAN_KEY must be set (32+ characters) before family plans can be saved");
  return "development-only-family-plan-key";
}

/** True when plans can be saved here: always in development, only with FAMILY_PLAN_KEY in production. */
export function familyPlanConfigured(env: Record<string, string | undefined> = process.env): boolean {
  try {
    rawKey(env);
    return true;
  } catch {
    return false;
  }
}

const derive = (label: string) => createHash("sha256").update(`${label}:${rawKey()}`).digest();

/** A 32-byte key for one purpose, derived from FAMILY_PLAN_KEY (the account's TOTP secret uses its own label). */
export const familyPlanKey = derive;

/** Keyed hash of a normalized email address. Finds a plan without storing the address. */
export function hashEmail(email: string): string {
  return createHmac("sha256", derive("family-plan-email")).update(email.trim().toLowerCase()).digest("hex");
}

/** Encrypts the answers. The plan id is authenticated with them, so a body moved to another row will not open. */
export function encryptPlanBody(planId: string, body: FamilyPlanBody): string {
  return `${KEY_VERSION}.${aesGcmEncrypt(derive("family-plan-body"), JSON.stringify(body), planId)}`;
}

/** Throws when the ciphertext was changed, belongs to another plan or was made with another key. */
export function decryptPlanBody(planId: string, stored: string): FamilyPlanBody {
  const [version, ...rest] = stored.split(".");
  if (version !== KEY_VERSION) throw new Error("Unknown family plan key version");
  const plain = aesGcmDecrypt(derive("family-plan-body"), rest.join("."), planId);
  return familyPlanBodySchema.parse(JSON.parse(plain));
}

// ---------------------------------------------------------------------------
// Sign-in link and plan session
// ---------------------------------------------------------------------------

export const PLAN_LINK_TTL_S = 30 * 60;
/** The step between the email link and the second factor. Short: it only lets the visitor enter a code. */
export const PLAN_PREAUTH_COOKIE = "ep_plan_preauth";
export const PLAN_PREAUTH_TTL_S = 10 * 60;

interface LinkPayload {
  /** email hash */
  eh: string;
  jti: string;
  exp: number;
  /** consent version and the time the visitor agreed */
  cv: string;
  cat: string;
  /** the latest lead for the same email when the link was sent, if any */
  lid?: string;
}

interface PreauthPayload {
  pid: string;
  exp: number;
  /** the lead to link once the second factor passes, from the link */
  lid?: string;
}

interface Deps {
  emailLimiter: RateLimiter;
  sendEmail?: SendEmail;
  baseUrl?: string;
}

const g = globalThis as unknown as { __epPlanDeps?: Deps };
const fresh = (): Deps => ({ emailLimiter: new RateLimiter(5, 3600_000) });
function deps(): Deps {
  return (g.__epPlanDeps ??= fresh());
}

/** Swap the mailer or limiter (tests). Used links live in the database (plan_link_uses), not here. */
export function configureFamilyPlan(overrides: Partial<Deps> = {}): Deps {
  g.__epPlanDeps = { ...fresh(), ...overrides };
  return g.__epPlanDeps;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function latestLeadIdForEmail(db: Db, email: string): Promise<string | undefined> {
  const e = email.trim().toLowerCase();
  const people = await db.persons.list((p) => p.email.toLowerCase() === e);
  if (!people.length) return undefined;
  const ids = new Set(people.map((p) => p.id));
  const leads = (await db.leads.list((l) => ids.has(l.personId))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return leads[0]?.id;
}

export type StartResult = { ok: true } | { ok: false; error: string; status: number };

/**
 * Emails a sign-in link for the visitor's plan. Looks the same whether or not a plan or a lead exists
 * for the address. `db` must be the service store (it reads persons and leads to find a lead to link).
 */
export async function startPlanSignIn(
  db: Db,
  input: { email: string; consent: boolean; consentVersion: string },
  now = new Date(),
): Promise<StartResult> {
  rawKey(); // refuse before sending anything when production has no key
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, error: "Enter a valid email address", status: 422 };
  if (!input.consent || input.consentVersion !== FAMILY_PLAN_CONSENT_VERSION) {
    return { ok: false, error: "Please read and agree to how we store your plan", status: 422 };
  }
  const d = deps();
  if (d.emailLimiter.isBlocked(email, now.getTime())) return { ok: true };
  d.emailLimiter.record(email, now.getTime());
  const payload: LinkPayload = {
    eh: hashEmail(email),
    jti: randomUUID(),
    exp: Math.floor(now.getTime() / 1000) + PLAN_LINK_TTL_S,
    cv: FAMILY_PLAN_CONSENT_VERSION,
    cat: now.toISOString(),
  };
  const lid = await latestLeadIdForEmail(db, email);
  if (lid) payload.lid = lid;
  const token = signToken("plan_link", payload);
  const base = d.baseUrl ?? process.env.APP_URL ?? "http://localhost:3000";
  try {
    await (d.sendEmail ?? consoleSendEmail)(
      email,
      "Your family plan link",
      `Use this link to open and save your family plan. It works once and expires in 30 minutes.\n\n${base}/my-plan/open?token=${token}\n\nIf you did not ask for this, you can ignore this email. Nothing has been saved.`,
    );
  } catch (e) {
    console.error("family plan email failed", e instanceof Error ? e.message : "unknown error");
  }
  await audit(db, "system", { action: "family_plan.link_requested", resourceType: "family_plan", resourceId: "email_link", at: now });
  return { ok: true };
}

/**
 * Marks a link id used. The insert fails when the id is already there, in this instance or any other,
 * so whoever inserts first wins and every later attempt is refused. Any other failure also refuses
 * (fail closed): the visitor can ask for a new link.
 */
export async function consumeLink(db: Db, jti: string, now = new Date()): Promise<boolean> {
  try {
    await db.planLinkUses.insert({ id: jti, usedAt: now.toISOString() });
    return true;
  } catch (e) {
    const code = (e as { code?: string }).code;
    const msg = e instanceof Error ? e.message : "";
    if (code !== "23505" && !msg.startsWith("duplicate id")) console.error("family plan link check failed", msg || "unknown error");
    return false;
  }
}

const plannerActor = (planId: string): AuditActor => ({ userId: planId, role: "planner" });

/**
 * Link token -> pre-auth token (the step before the second factor). Creates the account on first use: a
 * plan row found again by the email hash, with an empty body and the consent the visitor agreed to.
 * Nothing the visitor wrote is stored, nothing is prefilled and no lead is linked until the second factor
 * passes (finishPlanSignIn). `db` must be the service store.
 */
export async function completePlanSignIn(
  db: Db,
  token: string,
  now = new Date(),
): Promise<{ planId: string; preauthToken: string; created: boolean } | null> {
  const p = readToken<LinkPayload>("plan_link", token);
  const valid = !!p && typeof p.eh === "string" && typeof p.jti === "string" && Math.floor(now.getTime() / 1000) < p.exp;
  if (!p || !valid || !(await consumeLink(db, p.jti, now))) {
    await audit(db, "system", { action: "family_plan.link_rejected", resourceType: "family_plan", resourceId: "email_link", at: now });
    return null;
  }
  const at = now.toISOString();
  const consent = { version: p.cv, at: p.cat };
  let plan = (await db.familyPlans.list(undefined, { emailHash: p.eh }))[0];
  let created = false;
  if (!plan) {
    const body = emptyPlan();
    const summary = summarizePlan(body, now.getUTCFullYear());
    const id = `fp_${randomUUID()}`;
    plan = { id, emailHash: p.eh, summary, sectionsDone: summary.sectionsDone, gapCount: summary.gaps.length, consent, createdAt: at, updatedAt: at };
    await db.familyPlans.insert(plan);
    await db.familyPlanBodies.insert({ id, ciphertext: encryptPlanBody(id, body), updatedAt: at });
    created = true;
    await audit(db, plannerActor(id), {
      action: "family_plan.create",
      resourceType: "family_plan",
      resourceId: id,
      detail: { consentVersion: consent.version },
      at: now,
    });
  } else {
    await db.familyPlans.update(plan.id, { consent });
  }
  await audit(db, plannerActor(plan.id), { action: "family_plan.link_used", resourceType: "family_plan", resourceId: plan.id, at: now });
  return { planId: plan.id, preauthToken: issuePlanPreauth(plan.id, p.lid, now), created };
}

/** The pre-auth token proves the email link was used; it opens nothing but the code step. */
export function issuePlanPreauth(planId: string, leadId: string | undefined, now = new Date()): string {
  const payload: PreauthPayload = { pid: planId, exp: Math.floor(now.getTime() / 1000) + PLAN_PREAUTH_TTL_S };
  if (leadId) payload.lid = leadId;
  return signToken("plan_preauth", payload);
}

export function readPlanPreauth(token: string | undefined, now = new Date()): { planId: string; leadId?: string } | null {
  const p = readToken<PreauthPayload>("plan_preauth", token);
  if (!p || typeof p.pid !== "string" || !p.pid.startsWith("fp_") || Math.floor(now.getTime() / 1000) >= p.exp) return null;
  return { planId: p.pid, leadId: typeof p.lid === "string" ? p.lid : undefined };
}

export function planPreauthCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${PLAN_PREAUTH_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${PLAN_PREAUTH_TTL_S}${secure}`;
}

export function clearPlanPreauthCookie(): string {
  return `${PLAN_PREAUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * After the second factor passes. On the first sign-in, an untouched plan is prefilled from the
 * visitor's lead (if the link found one); on every sign-in the plan is linked to that lead. `db` must be
 * the service store.
 */
export async function finishPlanSignIn(db: Db, planId: string, leadId: string | undefined, firstSignIn: boolean, now = new Date()): Promise<void> {
  const plan = await db.familyPlans.get(planId);
  if (!plan || !leadId) return;
  const lead = await db.leads.get(leadId);
  if (!lead) return;
  if (firstSignIn && plan.sectionsDone === 0 && plan.gapCount === 0 && !plan.prefilledFrom) {
    const stored = await db.familyPlanBodies.get(planId);
    const current = stored ? decryptPlanBody(planId, stored.ciphertext) : emptyPlan();
    const person = await db.persons.get(lead.personId);
    const body = prefillPlan({ answers: lead.intake.answers, state: person?.state ?? lead.state, answersFrom: "lead" });
    if (body && JSON.stringify(current) === JSON.stringify(emptyPlan())) {
      const summary = summarizePlan(body, now.getUTCFullYear());
      const at = now.toISOString();
      await db.familyPlanBodies.update(planId, { ciphertext: encryptPlanBody(planId, body), updatedAt: at });
      await db.familyPlans.update(planId, {
        summary,
        sectionsDone: summary.sectionsDone,
        gapCount: summary.gaps.length,
        prefilledFrom: body.prefill?.sources.length ? [...body.prefill.sources] : undefined,
        updatedAt: at,
      });
      await audit(db, "system", { action: "family_plan.prefill", resourceType: "family_plan", resourceId: planId, detail: { from: "lead" }, at: now });
    }
  }
  if (plan.leadId !== leadId) await linkPlan(db, planId, leadId, now);
}

// ---------------------------------------------------------------------------
// The owner's own plan. `db` is the planner-scoped store (plannerDb).
// ---------------------------------------------------------------------------

export interface OwnPlan {
  id: string;
  body: FamilyPlanBody;
  summary: FamilyPlanSummary;
  linkedToLead: boolean;
  consent: FamilyPlan["consent"];
  prefilledFrom?: string[];
  updatedAt: string;
}

export async function loadOwnPlan(db: Db, planId: string): Promise<OwnPlan | null> {
  const plan = await db.familyPlans.get(planId);
  const stored = plan ? await db.familyPlanBodies.get(planId) : undefined;
  if (!plan || !stored || plan.id !== planId) return null;
  const body = decryptPlanBody(planId, stored.ciphertext);
  return {
    id: plan.id,
    body,
    summary: plan.summary,
    linkedToLead: !!plan.leadId,
    consent: plan.consent,
    prefilledFrom: plan.prefilledFrom,
    updatedAt: plan.updatedAt,
  };
}

export type SaveResult = { ok: true; plan: OwnPlan } | Extract<PlanValidation, { ok: false }> | { ok: false; error: string; fields: Record<string, string>; notFound: true };

/** Validates (including the account-number and SSN check), recomputes the summary and gaps, and saves. */
export async function saveOwnPlan(db: Db, planId: string, input: unknown, now = new Date()): Promise<SaveResult> {
  const v = validatePlan(input);
  if (!v.ok) return v;
  const plan = await db.familyPlans.get(planId);
  if (!plan) return { ok: false, error: "This plan no longer exists", fields: {}, notFound: true };
  const summary = summarizePlan(v.body, now.getUTCFullYear());
  const at = now.toISOString();
  await db.familyPlanBodies.update(planId, { ciphertext: encryptPlanBody(planId, v.body), updatedAt: at });
  const next = await db.familyPlans.update(planId, { summary, sectionsDone: summary.sectionsDone, gapCount: summary.gaps.length, updatedAt: at });
  await audit(db, plannerActor(planId), {
    action: "family_plan.update",
    resourceType: "family_plan",
    resourceId: planId,
    leadId: next.leadId,
    detail: { sectionsDone: summary.sectionsDone, gapCount: summary.gaps.length },
    at: now,
  });
  return {
    ok: true,
    plan: { id: planId, body: v.body, summary, linkedToLead: !!next.leadId, consent: next.consent, prefilledFrom: next.prefilledFrom, updatedAt: at },
  };
}

/**
 * Hard delete of the whole account: every signed-in device, the second factor and recovery codes, the
 * answers and the summary are removed, not flagged. The audit entry keeps only ids and a count. Callers
 * ask for a fresh code first (deletePlanAccount in planAccount.ts).
 */
export async function deleteOwnPlan(db: Db, planId: string, now = new Date()): Promise<boolean> {
  const plan = await db.familyPlans.get(planId);
  if (!plan) return false;
  const sessions = await db.planSessions.list(undefined, { planId });
  for (const s of sessions) await db.planSessions.remove(s.id);
  await db.planMfa.remove(planId);
  await db.familyPlanBodies.remove(planId);
  await db.familyPlans.remove(planId);
  await audit(db, plannerActor(planId), {
    action: "family_plan.delete",
    resourceType: "family_plan",
    resourceId: planId,
    leadId: plan.leadId,
    detail: { sessionsEnded: sessions.length },
    at: now,
  });
  return true;
}

/** Validation, summary and gaps for a draft that only lives on the visitor's device. Nothing is stored. */
export function previewPlan(input: unknown, now = new Date()): { ok: true; body: FamilyPlanBody; summary: FamilyPlanSummary } | Extract<PlanValidation, { ok: false }> {
  const v = validatePlan(input);
  if (!v.ok) return v;
  return { ok: true, body: v.body, summary: summarizePlan(v.body, now.getUTCFullYear()) };
}

// ---------------------------------------------------------------------------
// Linking to a lead, and the attorney's view
// ---------------------------------------------------------------------------

async function linkPlan(db: Db, planId: string, leadId: string, now: Date): Promise<void> {
  await db.familyPlans.update(planId, { leadId });
  await audit(db, "system", { action: "family_plan.link", resourceType: "family_plan", resourceId: planId, leadId, at: now });
}

/**
 * Links a signed-in visitor's plan to the lead they just created, when the lead's email matches the
 * plan's. Called from the lead form with the plan session; a lead alone never pulls in a plan, because
 * lead emails are not verified and the plan's owner has proven theirs. `db` must be the service store.
 */
export async function linkPlanToNewLead(db: Db, planId: string, lead: Pick<Lead, "id">, leadEmail: string, now = new Date()): Promise<boolean> {
  if (!familyPlanConfigured()) return false;
  const plan = await db.familyPlans.get(planId);
  if (!plan || plan.emailHash !== hashEmail(leadEmail)) return false;
  if (plan.leadId === lead.id) return true;
  await linkPlan(db, planId, lead.id, now);
  return true;
}

export interface OrganizerSummaryView {
  planId: string;
  updatedAt: string;
  summary: FamilyPlanSummary;
}

/**
 * The organizer summary for a lead, when the viewer may see it. The answers are never decrypted here.
 * Viewing is audited.
 */
export async function organizerSummaryForLead(
  db: Db,
  actor: Actor,
  lead: Lead,
  assignments: Assignment[],
  now = new Date(),
): Promise<OrganizerSummaryView | undefined> {
  if (!canViewFamilyPlanSummary(actor, lead, assignments, now)) return undefined;
  const plan = (await db.familyPlans.list(undefined, { leadId: lead.id })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!plan) return undefined;
  await audit(db, actor, { action: "family_plan.staff_view", resourceType: "family_plan", resourceId: plan.id, leadId: lead.id, at: now });
  return { planId: plan.id, updatedAt: plan.updatedAt, summary: plan.summary };
}
