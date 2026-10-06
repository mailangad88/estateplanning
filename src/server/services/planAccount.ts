/**
 * "My family plan" accounts: the second factor, signed-in devices, the account page, export and deletion.
 *
 * Sign-in is: emailed link (familyPlan.ts completePlanSignIn) -> pre-auth cookie -> authenticator code or
 * one-time recovery code (verifyPlanSignIn) -> a server-side session record plus a cookie pointing at it.
 * The first sign-in must set up an authenticator (beginPlanEnrolment) before any session exists, so no plan
 * data is returned or saved until two-step verification is on.
 *
 * - TOTP reuses src/server/auth/totp.ts. The secret is encrypted (AES-256-GCM, a FAMILY_PLAN_KEY-derived key)
 *   and bound to the plan id. Recovery codes: 10, scrypt-hashed, each works once, shown once.
 * - Wrong codes are counted in the database (plan_mfa.failed_attempts), so the lockout holds across app
 *   instances: PLAN_MFA_MAX_FAILURES wrong codes lock the code step for PLAN_MFA_LOCKOUT_S. Audited.
 * - Sessions: the cookie carries the plan id and a random secret, HMAC-signed; the table keeps only the
 *   secret's SHA-256. A session ends after PLAN_SESSION_IDLE_S without a request and PLAN_SESSION_ABSOLUTE_S
 *   after sign-in, whichever comes first, or when it is signed out from any device.
 * - Audit detail carries ids, counts and reasons only: never codes, secrets, addresses or device strings.
 *
 * TODO(passkeys): WebAuthn as a second factor (or a first factor that also satisfies the second). Not built
 * here because doing it safely without a vetted library means hand-parsing CBOR attestation objects and COSE
 * keys and checking origin, RP id hash, flags, sign counters and challenge binding ourselves. Shape when a
 * library (e.g. @simplewebauthn/server) is approved: a plan_passkeys table (id = credential id, plan_id,
 * public_key, sign_count, transports, created_at, last_used_at) under the same planner-only RLS as plan_mfa;
 * registration only from a signed-in session after a fresh TOTP code; challenges single-use and stored
 * server-side with a short expiry; keep TOTP + recovery codes as the fallback.
 */
import { createHash, randomBytes } from "node:crypto";
import { audit, type AuditActor } from "@/server/audit/log";
import { aesGcmDecrypt, aesGcmEncrypt, readToken, signToken } from "@/server/auth/identity";
import { generateRecoveryCodes, generateSecret, hashRecoveryCode, otpauthUrl, verifyRecoveryCode, verifyTotp } from "@/server/auth/totp";
import type { Db } from "@/server/db";
import type { AuditEvent, PlanMfaRecord, PlanSession } from "@/server/types";
import { deleteOwnPlan, familyPlanKey, finishPlanSignIn, loadOwnPlan, readPlanPreauth, type OwnPlan } from "@/server/services/familyPlan";

export const PLAN_SESSION_COOKIE = "ep_plan";
/** A session ends after 30 minutes without a request... */
export const PLAN_SESSION_IDLE_S = 30 * 60;
/** ...and 7 days after sign-in, whichever comes first. */
export const PLAN_SESSION_ABSOLUTE_S = 7 * 24 * 3600;
/** last-seen is written at most this often, so a busy page does not write on every request */
export const PLAN_SESSION_TOUCH_S = 60;
export const PLAN_MFA_MAX_FAILURES = 5;
export const PLAN_MFA_LOCKOUT_S = 15 * 60;
export const PLAN_RECOVERY_CODE_COUNT = 10;
const ISSUER = "My family plan";
const TOTP_LABEL = "Family plan";
const SECRET_VERSION = "v1";

const plannerActor = (planId: string): AuditActor => ({ userId: planId, role: "planner" });

/**
 * The store as seen by one plan's owner. With Postgres the session role is "planner" and app.user_id is
 * the plan id, so row-level security limits it to that plan, its answers, its second factor, its devices
 * and its own audit events. The memory store has no second layer; this module checks ids itself.
 */
export function scopeToPlan(db: Db, planId: string): Db {
  const pg = db as Db & { withSession?: (s: unknown) => Db };
  if (!pg.withSession) return db;
  return pg.withSession({ userId: planId, role: "planner" });
}

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

function encryptTotpSecret(planId: string, secret: string): string {
  return `${SECRET_VERSION}.${aesGcmEncrypt(familyPlanKey("family-plan-totp"), secret, `totp:${planId}`)}`;
}

function decryptTotpSecret(planId: string, stored: string): string {
  const [version, ...rest] = stored.split(".");
  if (version !== SECRET_VERSION) throw new Error("Unknown TOTP secret version");
  return aesGcmDecrypt(familyPlanKey("family-plan-totp"), rest.join("."), `totp:${planId}`);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const iso = (ms: number) => new Date(ms).toISOString();

/** Groups the key in fours for typing into an app by hand. */
export function formatSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

// ---------------------------------------------------------------------------
// Device details: coarse on purpose
// ---------------------------------------------------------------------------

export interface DeviceInfo {
  userAgent?: string;
  ipPrefix?: string;
}

/** "Safari on iPhone". Never the raw user-agent string. */
export function deviceSummary(ua: string | null | undefined): string | undefined {
  if (!ua) return undefined;
  const browser = /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Firefox\/|FxiOS/.test(ua) ? "Firefox"
    : /Chrome\/|CriOS/.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : "A browser";
  const os = /iPhone/.test(ua) ? "iPhone"
    : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Macintosh|Mac OS X/.test(ua) ? "Mac"
    : /Linux/.test(ua) ? "Linux"
    : undefined;
  return os ? `${browser} on ${os}` : browser;
}

/** The network, not the address: IPv4 to /24, IPv6 to /48. */
export function ipPrefix(ip: string | null | undefined): string | undefined {
  if (!ip) return undefined;
  const raw = ip.trim().replace(/^\[|\]$/g, "");
  const v4 = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i.exec(raw);
  if (v4) {
    const parts = v4.slice(1, 4).map(Number);
    if (parts.some((p) => p > 255)) return undefined;
    return `${parts.join(".")}.0/24`;
  }
  if (!raw.includes(":") || !/^[0-9a-f:]+$/i.test(raw)) return undefined;
  const [head, tail = ""] = raw.split("::");
  const h = head ? head.split(":") : [];
  const t = raw.includes("::") ? (tail ? tail.split(":") : []) : [];
  const groups = raw.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
  if (groups.length !== 8) return undefined;
  return `${groups.slice(0, 3).map((g) => g.toLowerCase().replace(/^0+(?=.)/, "")).join(":")}::/48`;
}

export function deviceFromRequest(request: Request): DeviceInfo {
  return {
    userAgent: deviceSummary(request.headers.get("user-agent")),
    ipPrefix: ipPrefix(request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip")),
  };
}

// ---------------------------------------------------------------------------
// Checking a code (shared by sign-in, re-auth on the account page and authenticator changes)
// ---------------------------------------------------------------------------

export type CodeFailure = { ok: false; reason: "bad_code" | "locked"; lockedUntil?: string };
type CodeResult = { ok: true; rec: PlanMfaRecord; usedRecoveryCode: boolean; step?: number } | CodeFailure;

function isLocked(rec: PlanMfaRecord, now: Date): boolean {
  return !!rec.lockedUntil && Date.parse(rec.lockedUntil) > now.getTime();
}

/**
 * One attempt. Digits are checked as an authenticator code (against the pending secret when `pending`);
 * anything else as a recovery code, which is then used up. Wrong codes count towards the lockout.
 */
const codeLocks = (globalThis as unknown as { __epPlanCodeLocks?: Map<string, Promise<unknown>> }).__epPlanCodeLocks ??= new Map();

/**
 * Attempts for one account run one at a time in this process, re-reading the record inside the lock, so
 * parallel guesses cannot all read the same failure count or spend the same recovery code twice.
 * (Across several app instances the window is one read-modify-write; see the report's open items.)
 */
async function checkCode(
  db: Db,
  rec: PlanMfaRecord,
  code: string,
  now: Date,
  opts: { purpose: string; allowRecovery: boolean; pending?: boolean },
): Promise<CodeResult> {
  const prev = codeLocks.get(rec.id) ?? Promise.resolve();
  const run = prev.then(async () => {
    const fresh = await db.planMfa.get(rec.id);
    if (!fresh || fresh.id !== rec.id) return { ok: false, reason: "bad_code" } as const;
    return checkCodeUnlocked(db, fresh, code, now, opts);
  });
  const tail = run.catch(() => undefined);
  codeLocks.set(rec.id, tail);
  void tail.then(() => {
    if (codeLocks.get(rec.id) === tail) codeLocks.delete(rec.id);
  });
  return run;
}

async function checkCodeUnlocked(
  db: Db,
  rec: PlanMfaRecord,
  code: string,
  now: Date,
  opts: { purpose: string; allowRecovery: boolean; pending?: boolean },
): Promise<CodeResult> {
  const planId = rec.id;
  const actor = plannerActor(planId);
  if (isLocked(rec, now)) {
    await audit(db, actor, { action: "family_plan.mfa_blocked", resourceType: "family_plan", resourceId: planId, detail: { purpose: opts.purpose }, at: now });
    return { ok: false, reason: "locked", lockedUntil: rec.lockedUntil };
  }
  const trimmed = code.trim().slice(0, 64);
  let step: number | null = null;
  let recoveryIndex = -1;
  if (/^\d[\d\s]*$/.test(trimmed)) {
    const enc = opts.pending ? rec.pendingSecretEnc : rec.totpSecretEnc;
    const hit = enc ? verifyTotp(decryptTotpSecret(planId, enc), trimmed, now) : null;
    // A code is accepted once: a step at or before the last one used is a replay. A new app's key has
    // never been used, so its first code is not held to the old app's last step.
    if (hit !== null && (opts.pending || hit > rec.lastUsedStep)) step = hit;
  } else if (opts.allowRecovery && trimmed) {
    recoveryIndex = rec.recoveryCodeHashes.findIndex((h) => verifyRecoveryCode(trimmed, h));
  }
  const at = now.toISOString();
  if (step === null && recoveryIndex < 0) {
    const failed = rec.failedAttempts + 1;
    if (failed >= PLAN_MFA_MAX_FAILURES) {
      const lockedUntil = iso(now.getTime() + PLAN_MFA_LOCKOUT_S * 1000);
      await db.planMfa.update(planId, { failedAttempts: 0, lockedUntil, updatedAt: at });
      await audit(db, actor, {
        action: "family_plan.mfa_locked",
        resourceType: "family_plan",
        resourceId: planId,
        detail: { purpose: opts.purpose, failures: failed, minutes: PLAN_MFA_LOCKOUT_S / 60 },
        at: now,
      });
      return { ok: false, reason: "locked", lockedUntil };
    }
    await db.planMfa.update(planId, { failedAttempts: failed, updatedAt: at });
    await audit(db, actor, { action: "family_plan.mfa_failed", resourceType: "family_plan", resourceId: planId, detail: { purpose: opts.purpose, failures: failed }, at: now });
    return { ok: false, reason: "bad_code" };
  }
  const patch: Partial<PlanMfaRecord> = { failedAttempts: 0, lockedUntil: undefined, updatedAt: at };
  if (step !== null) patch.lastUsedStep = Math.max(step, rec.lastUsedStep);
  if (recoveryIndex >= 0) patch.recoveryCodeHashes = rec.recoveryCodeHashes.filter((_, i) => i !== recoveryIndex);
  const next = await db.planMfa.update(planId, patch);
  if (recoveryIndex >= 0) {
    await audit(db, actor, {
      action: "family_plan.recovery_code_used",
      resourceType: "family_plan",
      resourceId: planId,
      detail: { purpose: opts.purpose, left: next.recoveryCodeHashes.length },
      at: now,
    });
  }
  return { ok: true, rec: next, usedRecoveryCode: recoveryIndex >= 0, step: step ?? undefined };
}

// ---------------------------------------------------------------------------
// Sign-in: enrolment and the code step (service store: no session exists yet)
// ---------------------------------------------------------------------------

export type EnrolmentStart =
  | { ok: true; secret: string; otpauthUrl: string }
  | { ok: false; reason: "no_preauth" | "enrolled" };

/** What the code step should show for this pre-auth token. */
export async function planSignInStatus(service: Db, preauthToken: string | undefined, now = new Date()): Promise<"no_preauth" | "enrol" | "code"> {
  const pre = readPlanPreauth(preauthToken, now);
  if (!pre || !(await service.familyPlans.get(pre.planId))) return "no_preauth";
  const rec = await service.planMfa.get(pre.planId);
  return rec?.enrolledAt ? "code" : "enrol";
}

/**
 * The authenticator key for a first sign-in. Shows the same pending key again until it is confirmed, so
 * reloading the page does not break an app that already scanned it. Keeps the failure count and any
 * lockout. Recovery codes are made only once the first code confirms the app.
 */
export async function beginPlanEnrolment(service: Db, preauthToken: string | undefined, now = new Date()): Promise<EnrolmentStart> {
  const pre = readPlanPreauth(preauthToken, now);
  const plan = pre ? await service.familyPlans.get(pre.planId) : undefined;
  if (!pre || !plan) return { ok: false, reason: "no_preauth" };
  const rec = await service.planMfa.get(plan.id);
  if (rec?.enrolledAt) return { ok: false, reason: "enrolled" };
  let secret: string;
  if (rec) {
    secret = decryptTotpSecret(plan.id, rec.totpSecretEnc);
  } else {
    secret = generateSecret();
    const at = now.toISOString();
    await service.planMfa.insert({
      id: plan.id,
      totpSecretEnc: encryptTotpSecret(plan.id, secret),
      lastUsedStep: 0,
      recoveryCodeHashes: [],
      failedAttempts: 0,
      createdAt: at,
      updatedAt: at,
    });
  }
  return { ok: true, secret, otpauthUrl: otpauthUrl(secret, TOTP_LABEL, ISSUER) };
}

export type PlanVerifyResult =
  | { ok: true; planId: string; sessionToken: string; firstSignIn: boolean; usedRecoveryCode: boolean; recoveryCodes?: string[]; recoveryCodesLeft: number }
  | { ok: false; reason: "no_preauth" | "no_setup" | "bad_code" | "locked"; lockedUntil?: string };

/**
 * The code step. On the first sign-in the code confirms the authenticator and the 10 recovery codes are
 * made and returned (once). Every sign-in then gets a new session record. `service` is the service store.
 */
export async function verifyPlanSignIn(
  service: Db,
  preauthToken: string | undefined,
  code: string,
  device: DeviceInfo = {},
  now = new Date(),
): Promise<PlanVerifyResult> {
  const pre = readPlanPreauth(preauthToken, now);
  const plan = pre ? await service.familyPlans.get(pre.planId) : undefined;
  if (!pre || !plan) return { ok: false, reason: "no_preauth" };
  const rec = await service.planMfa.get(plan.id);
  if (!rec) return { ok: false, reason: "no_setup" };
  const firstSignIn = !rec.enrolledAt;
  const r = await checkCode(service, rec, code, now, { purpose: "sign_in", allowRecovery: !firstSignIn });
  if (!r.ok) return r;

  let recoveryCodes: string[] | undefined;
  let left = r.rec.recoveryCodeHashes.length;
  if (firstSignIn) {
    recoveryCodes = generateRecoveryCodes(PLAN_RECOVERY_CODE_COUNT);
    const at = now.toISOString();
    await service.planMfa.update(plan.id, { enrolledAt: at, recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode), updatedAt: at });
    left = recoveryCodes.length;
    await audit(service, plannerActor(plan.id), { action: "family_plan.mfa_enrolled", resourceType: "family_plan", resourceId: plan.id, detail: { recoveryCodes: left }, at: now });
  }
  await finishPlanSignIn(service, plan.id, pre.leadId, firstSignIn, now);
  const sessionToken = await createPlanSession(service, plan.id, device, r.usedRecoveryCode, now);
  await audit(service, plannerActor(plan.id), {
    action: "family_plan.sign_in",
    resourceType: "family_plan",
    resourceId: plan.id,
    detail: { method: r.usedRecoveryCode ? "recovery_code" : "authenticator", first: firstSignIn },
    at: now,
  });
  return { ok: true, planId: plan.id, sessionToken, firstSignIn, usedRecoveryCode: r.usedRecoveryCode, recoveryCodes, recoveryCodesLeft: left };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

interface SessionCookiePayload {
  pid: string;
  /** random secret; the table keeps only its SHA-256 */
  sk: string;
}

async function createPlanSession(service: Db, planId: string, device: DeviceInfo, viaRecoveryCode: boolean, now: Date): Promise<string> {
  const secret = randomBytes(32).toString("base64url");
  const at = now.toISOString();
  // Tidy up this account's ended sessions while we are here.
  for (const s of await service.planSessions.list(undefined, { planId })) {
    if (sessionEnded(s, now)) await service.planSessions.remove(s.id);
  }
  await service.planSessions.insert({
    id: sha256(secret),
    planId,
    createdAt: at,
    lastSeenAt: at,
    expiresAt: iso(now.getTime() + PLAN_SESSION_ABSOLUTE_S * 1000),
    ...(device.userAgent ? { userAgent: device.userAgent } : {}),
    ...(device.ipPrefix ? { ipPrefix: device.ipPrefix } : {}),
    ...(viaRecoveryCode ? { viaRecoveryCode: true } : {}),
  });
  return signToken("plan_session", { pid: planId, sk: secret } satisfies SessionCookiePayload);
}

function sessionEnded(s: PlanSession, now: Date): boolean {
  const t = now.getTime();
  return t >= Date.parse(s.expiresAt) || t - Date.parse(s.lastSeenAt) > PLAN_SESSION_IDLE_S * 1000;
}

export interface PlanSessionContext {
  planId: string;
  /** the session record's id (hash), to mark "this device" */
  sessionId: string;
  /** the store scoped to this plan (planner role in Postgres) */
  db: Db;
}

/**
 * The cookie -> a live session, or null when the cookie is missing, forged, signed out, idle too long or
 * past its absolute expiry. Refreshes last-seen (at most once a minute) unless `touch` is false.
 * `root` is the unscoped store; every read here goes through the planner scope.
 */
export async function resolvePlanSession(
  root: Db,
  token: string | undefined,
  now = new Date(),
  opts: { touch?: boolean } = {},
): Promise<PlanSessionContext | null> {
  const p = readToken<SessionCookiePayload>("plan_session", token);
  if (!p || typeof p.pid !== "string" || !p.pid.startsWith("fp_") || typeof p.sk !== "string" || p.sk.length < 32) return null;
  const db = scopeToPlan(root, p.pid);
  const id = sha256(p.sk);
  const s = await db.planSessions.get(id);
  if (!s || s.planId !== p.pid) return null;
  if (sessionEnded(s, now)) {
    await db.planSessions.remove(id).catch(() => false);
    return null;
  }
  // A session is only made after the second factor; refuse one whose factor is gone.
  const mfa = await db.planMfa.get(p.pid);
  if (!mfa?.enrolledAt) return null;
  if (opts.touch !== false && now.getTime() - Date.parse(s.lastSeenAt) >= PLAN_SESSION_TOUCH_S * 1000) {
    await db.planSessions.update(id, { lastSeenAt: now.toISOString() });
  }
  return { planId: p.pid, sessionId: id, db };
}

export function planSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${PLAN_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${PLAN_SESSION_ABSOLUTE_S}${secure}`;
}

export function clearPlanSessionCookie(): string {
  return `${PLAN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export interface DeviceView {
  id: string;
  device: string;
  ipPrefix?: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
  viaRecoveryCode: boolean;
}

export async function listDevices(ctx: PlanSessionContext, now = new Date()): Promise<DeviceView[]> {
  const rows = await ctx.db.planSessions.list((s) => s.planId === ctx.planId, { planId: ctx.planId });
  return rows
    .filter((s) => !sessionEnded(s, now))
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .map((s) => ({
      id: s.id,
      device: s.userAgent ?? "Unknown device",
      ipPrefix: s.ipPrefix,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      expiresAt: s.expiresAt,
      current: s.id === ctx.sessionId,
      viaRecoveryCode: !!s.viaRecoveryCode,
    }));
}

/** Signs out this device. */
export async function signOutPlanSession(ctx: PlanSessionContext, now = new Date()): Promise<void> {
  await ctx.db.planSessions.remove(ctx.sessionId);
  await audit(ctx.db, plannerActor(ctx.planId), { action: "family_plan.sign_out", resourceType: "family_plan", resourceId: ctx.planId, at: now });
}

/** Signs out one device from the list. Resolves whether it was this one. */
export async function revokePlanSession(ctx: PlanSessionContext, sessionId: string, now = new Date()): Promise<{ ok: boolean; current: boolean }> {
  const s = await ctx.db.planSessions.get(sessionId);
  if (!s || s.planId !== ctx.planId) return { ok: false, current: false };
  await ctx.db.planSessions.remove(sessionId);
  const current = sessionId === ctx.sessionId;
  await audit(ctx.db, plannerActor(ctx.planId), { action: "family_plan.session_revoked", resourceType: "family_plan", resourceId: ctx.planId, detail: { current }, at: now });
  return { ok: true, current };
}

/** Signs out every device, this one included. */
export async function revokeAllPlanSessions(ctx: PlanSessionContext, now = new Date()): Promise<number> {
  const rows = await ctx.db.planSessions.list((s) => s.planId === ctx.planId, { planId: ctx.planId });
  for (const s of rows) await ctx.db.planSessions.remove(s.id);
  await audit(ctx.db, plannerActor(ctx.planId), { action: "family_plan.sessions_revoked", resourceType: "family_plan", resourceId: ctx.planId, detail: { count: rows.length }, at: now });
  return rows.length;
}

// ---------------------------------------------------------------------------
// The account page: two-step status, recovery codes, a new authenticator, activity
// ---------------------------------------------------------------------------

export interface MfaView {
  enrolledAt?: string;
  recoveryCodesLeft: number;
  lockedUntil?: string;
  replacing: boolean;
}

async function ownMfa(ctx: PlanSessionContext): Promise<PlanMfaRecord> {
  const rec = await ctx.db.planMfa.get(ctx.planId);
  if (!rec || rec.id !== ctx.planId || !rec.enrolledAt) throw new Error("Two-step verification is not set up for this plan");
  return rec;
}

export async function mfaView(ctx: PlanSessionContext, now = new Date()): Promise<MfaView> {
  const rec = await ownMfa(ctx);
  return {
    enrolledAt: rec.enrolledAt,
    recoveryCodesLeft: rec.recoveryCodeHashes.length,
    lockedUntil: isLocked(rec, now) ? rec.lockedUntil : undefined,
    replacing: !!rec.pendingSecretEnc,
  };
}

/** New recovery codes after a fresh code. The old ones stop working at once. */
export async function regenerateRecoveryCodes(ctx: PlanSessionContext, code: string, now = new Date()): Promise<{ ok: true; recoveryCodes: string[] } | CodeFailure> {
  const r = await checkCode(ctx.db, await ownMfa(ctx), code, now, { purpose: "recovery_codes", allowRecovery: true });
  if (!r.ok) return r;
  const recoveryCodes = generateRecoveryCodes(PLAN_RECOVERY_CODE_COUNT);
  await ctx.db.planMfa.update(ctx.planId, { recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode), updatedAt: now.toISOString() });
  await audit(ctx.db, plannerActor(ctx.planId), {
    action: "family_plan.recovery_codes_regenerated",
    resourceType: "family_plan",
    resourceId: ctx.planId,
    detail: { count: recoveryCodes.length },
    at: now,
  });
  return { ok: true, recoveryCodes };
}

/** Moving to a new phone, step 1: a fresh code from the current app (or a recovery code), then a new key. */
export async function beginAuthenticatorChange(
  ctx: PlanSessionContext,
  code: string,
  now = new Date(),
): Promise<{ ok: true; secret: string; otpauthUrl: string } | CodeFailure> {
  const r = await checkCode(ctx.db, await ownMfa(ctx), code, now, { purpose: "authenticator_change", allowRecovery: true });
  if (!r.ok) return r;
  const secret = generateSecret();
  await ctx.db.planMfa.update(ctx.planId, { pendingSecretEnc: encryptTotpSecret(ctx.planId, secret), updatedAt: now.toISOString() });
  return { ok: true, secret, otpauthUrl: otpauthUrl(secret, TOTP_LABEL, ISSUER) };
}

/** Step 2: the first code from the new app replaces the old one. */
export async function confirmAuthenticatorChange(ctx: PlanSessionContext, code: string, now = new Date()): Promise<{ ok: true } | CodeFailure | { ok: false; reason: "not_started" }> {
  const rec = await ownMfa(ctx);
  if (!rec.pendingSecretEnc) return { ok: false, reason: "not_started" };
  const r = await checkCode(ctx.db, rec, code, now, { purpose: "authenticator_confirm", allowRecovery: false, pending: true });
  if (!r.ok) return r;
  if (!r.rec.pendingSecretEnc) return { ok: false, reason: "not_started" };
  await ctx.db.planMfa.update(ctx.planId, { totpSecretEnc: r.rec.pendingSecretEnc, pendingSecretEnc: undefined, updatedAt: now.toISOString() });
  await audit(ctx.db, plannerActor(ctx.planId), { action: "family_plan.authenticator_changed", resourceType: "family_plan", resourceId: ctx.planId, at: now });
  return { ok: true };
}

export async function cancelAuthenticatorChange(ctx: PlanSessionContext, now = new Date()): Promise<void> {
  await ctx.db.planMfa.update(ctx.planId, { pendingSecretEnc: undefined, updatedAt: now.toISOString() });
}

/** Plain wording for the account's own events. Anything not listed here is not shown. */
const ACTIVITY_TEXT: Record<string, (e: AuditEvent) => string> = {
  "family_plan.create": () => "Account created",
  "family_plan.link_used": () => "Sign-in link used",
  "family_plan.sign_in": (e) => (e.detail?.method === "recovery_code" ? "Signed in with a recovery code" : "Signed in"),
  "family_plan.sign_out": () => "Signed out on a device",
  "family_plan.session_revoked": () => "Signed out a device from the list",
  "family_plan.sessions_revoked": () => "Signed out of all devices",
  "family_plan.mfa_enrolled": () => "Two-step verification turned on",
  "family_plan.mfa_failed": (e) => (e.detail?.purpose === "delete" ? "Wrong code entered while deleting the account" : "Wrong verification code entered"),
  "family_plan.mfa_locked": () => `Codes paused for ${PLAN_MFA_LOCKOUT_S / 60} minutes after too many wrong tries`,
  "family_plan.mfa_blocked": () => "Code tried while codes were paused",
  "family_plan.recovery_code_used": (e) => `Recovery code used (${Number(e.detail?.left ?? 0)} left)`,
  "family_plan.recovery_codes_regenerated": () => "New recovery codes made; the old ones stopped working",
  "family_plan.authenticator_changed": () => "Authenticator app changed",
  "family_plan.update": () => "Plan saved",
  "family_plan.prefill": () => "Plan filled in from your consult request",
  "family_plan.link": () => "Plan linked to your consult request",
  "family_plan.export": () => "Plan downloaded",
};

export interface ActivityItem {
  at: string;
  text: string;
  /** consecutive identical entries (saves, mostly) are folded into one */
  count: number;
}

/** The account's own events, newest first, in plain words. Read through the planner scope (RLS in Postgres). */
export async function listActivity(ctx: PlanSessionContext, limit = 40): Promise<ActivityItem[]> {
  const events = await ctx.db.audit.list((e) => e.resourceId === ctx.planId, { resourceType: "family_plan", resourceId: ctx.planId });
  const out: ActivityItem[] = [];
  for (const e of [...events].sort((a, b) => b.seq - a.seq)) {
    const fmt = ACTIVITY_TEXT[e.action];
    if (!fmt) continue;
    const text = fmt(e);
    const prev = out[out.length - 1];
    if (prev && prev.text === text) prev.count += 1;
    else out.push({ at: e.at, text, count: 1 });
    if (out.length > limit) break;
  }
  return out.slice(0, limit);
}

export interface AccountOverview {
  mfa: MfaView;
  devices: DeviceView[];
  activity: ActivityItem[];
}

export async function accountOverview(ctx: PlanSessionContext, now = new Date()): Promise<AccountOverview> {
  return { mfa: await mfaView(ctx, now), devices: await listDevices(ctx, now), activity: await listActivity(ctx) };
}

// ---------------------------------------------------------------------------
// Export and deletion
// ---------------------------------------------------------------------------

export interface PlanExport {
  format: "family-plan-export";
  version: 1;
  exportedAt: string;
  plan: Pick<OwnPlan, "id" | "body" | "summary" | "consent" | "prefilledFrom" | "updatedAt" | "linkedToLead">;
  account: { twoStepOnSince?: string; recoveryCodesLeft: number };
  devices: Omit<DeviceView, "id" | "current">[];
  activity: ActivityItem[];
}

/** "Download my plan": everything we keep for this account, as JSON. Audited. */
export async function exportPlanAccount(ctx: PlanSessionContext, now = new Date()): Promise<PlanExport | null> {
  const plan = await loadOwnPlan(ctx.db, ctx.planId);
  if (!plan) return null;
  const { mfa, devices, activity } = await accountOverview(ctx, now);
  await audit(ctx.db, plannerActor(ctx.planId), { action: "family_plan.export", resourceType: "family_plan", resourceId: ctx.planId, at: now });
  return {
    format: "family-plan-export",
    version: 1,
    exportedAt: now.toISOString(),
    plan: { id: plan.id, body: plan.body, summary: plan.summary, consent: plan.consent, prefilledFrom: plan.prefilledFrom, updatedAt: plan.updatedAt, linkedToLead: plan.linkedToLead },
    account: { twoStepOnSince: mfa.enrolledAt, recoveryCodesLeft: mfa.recoveryCodesLeft },
    devices: devices.map(({ id: _id, current: _current, ...d }) => d),
    activity,
  };
}

/**
 * "Delete my account": a fresh authenticator or recovery code, then the account, the plan, its answers,
 * the second factor and every session are removed for good. The audit trail keeps ids only.
 */
export async function deletePlanAccount(ctx: PlanSessionContext, code: string, now = new Date()): Promise<{ ok: true } | CodeFailure> {
  const r = await checkCode(ctx.db, await ownMfa(ctx), code, now, { purpose: "delete", allowRecovery: true });
  if (!r.ok) return r;
  await deleteOwnPlan(ctx.db, ctx.planId, now);
  return { ok: true };
}
