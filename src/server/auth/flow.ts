/**
 * Sign-in orchestration: email link -> pending pre-auth token -> TOTP (or a
 * recovery code) -> full session with mfa=true. Nothing here logs codes,
 * tokens or addresses; audit detail carries only ids and reasons.
 */
import type { Db } from "@/server/db";
import type { Role } from "@/server/types";
import { audit } from "@/server/audit/log";
import { issueSession } from "@/server/auth/session";
import {
  EmailLinkProvider,
  MemoryMfaStore,
  RateLimiter,
  readToken,
  signToken,
  type MfaStore,
  type SendEmail,
} from "@/server/auth/identity";
import {
  generateRecoveryCodes,
  generateSecret,
  hashRecoveryCode,
  otpauthUrl,
  verifyRecoveryCode,
  verifyTotp,
} from "@/server/auth/totp";

export const PREAUTH_COOKIE = "ep_preauth";
export const PREAUTH_TTL_S = 5 * 60;
const ISSUER = "Estate Planning Portal";

interface Deps {
  mfa: MfaStore;
  usedLinks: Set<string>;
  emailLimiter: RateLimiter;
  codeLimiter: RateLimiter;
  sendEmail?: SendEmail;
}

function fresh(): Deps {
  return {
    mfa: new MemoryMfaStore(),
    usedLinks: new Set(),
    emailLimiter: new RateLimiter(5, 3600_000),
    codeLimiter: new RateLimiter(5, 15 * 60_000),
  };
}

const g = globalThis as unknown as { __epAuthDeps?: Deps };
function deps(): Deps {
  return (g.__epAuthDeps ??= fresh());
}

/** Swap the store, mailer or limiters (production wiring and tests). Resets in-memory state. */
export function configureAuth(overrides: Partial<Deps> = {}): Deps {
  g.__epAuthDeps = { ...fresh(), ...overrides };
  return g.__epAuthDeps;
}

function provider(db: Db): EmailLinkProvider {
  const d = deps();
  return new EmailLinkProvider({
    findUserId: async (email) => (await db.users.list((u) => u.active && u.email.toLowerCase() === email))[0]?.id ?? null,
    sendEmail: d.sendEmail,
    usedIds: d.usedLinks,
    sendLimiter: d.emailLimiter,
  });
}

/** Always looks the same to the caller, whether or not the address has an account. */
export async function beginLogin(db: Db, email: string, now = new Date()): Promise<{ delivered: true }> {
  await provider(db).startSignIn(email, now);
  await audit(db, "system", { action: "auth.link_requested", resourceType: "auth", resourceId: "email_link", at: now });
  return { delivered: true };
}

interface PreauthPayload {
  uid: string;
  exp: number;
}

/** Link token -> short-lived pending token (mfa not yet passed). Null when the link is bad. */
export async function finishLink(db: Db, token: string, now = new Date()): Promise<string | null> {
  const uid = await provider(db).completeSignIn(token, now);
  const user = uid ? await db.users.get(uid) : null;
  if (!uid || !user || !user.active) {
    await audit(db, "system", { action: "auth.link_rejected", resourceType: "auth", resourceId: "email_link", at: now });
    return null;
  }
  await audit(db, { userId: user.id, role: user.role }, { action: "auth.link_accepted", resourceType: "user", resourceId: user.id, at: now });
  return issuePreauth(uid, now);
}

/** Pending token for a user who has proven who they are by some first factor (email link, client invite). */
export function issuePreauth(uid: string, now = new Date()): string {
  return signToken("preauth", { uid, exp: Math.floor(now.getTime() / 1000) + PREAUTH_TTL_S } satisfies PreauthPayload);
}

export function readPreauth(token: string | undefined, now = new Date()): string | null {
  const p = readToken<PreauthPayload>("preauth", token);
  if (!p || typeof p.uid !== "string" || Math.floor(now.getTime() / 1000) >= p.exp) return null;
  return p.uid;
}

export type MfaStatus = "none" | "pending" | "enrolled";

export async function mfaStatus(userId: string): Promise<MfaStatus> {
  const r = await deps().mfa.get(userId);
  return !r ? "none" : r.enrolledAt ? "enrolled" : "pending";
}

/**
 * Starts authenticator enrollment. Only allowed while no confirmed authenticator
 * exists; calling again before the first confirmation replaces the pending secret.
 * Recovery codes are returned once; only their hashes are kept.
 */
export async function enrollMfa(
  userId: string,
  accountEmail: string,
  now = new Date(),
): Promise<{ secret: string; otpauthUrl: string; recoveryCodes: string[] }> {
  const store = deps().mfa;
  const existing = await store.get(userId);
  if (existing?.enrolledAt) throw new Error("Two-step verification is already set up");
  const secret = generateSecret();
  const recoveryCodes = generateRecoveryCodes(10);
  await store.put(userId, {
    totpSecret: secret,
    lastUsedStep: 0,
    recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode),
    enrolledAt: null,
  });
  void now;
  return { secret, otpauthUrl: otpauthUrl(secret, accountEmail, ISSUER), recoveryCodes };
}

export type VerifyResult =
  | { ok: true; sessionToken: string; usedRecoveryCode: boolean; role: Role }
  | { ok: false; reason: "no_preauth" | "bad_code" | "locked" };

/** Checks a TOTP code or a one-time recovery code and, on success, returns a full session token. */
export async function verifyMfa(db: Db, preauthToken: string | undefined, code: string, now = new Date()): Promise<VerifyResult> {
  const uid = readPreauth(preauthToken, now);
  const user = uid ? await db.users.get(uid) : null;
  if (!uid || !user || !user.active) return { ok: false, reason: "no_preauth" };
  const actor = { userId: user.id, role: user.role };
  const limiter = deps().codeLimiter;
  const t = now.getTime();

  if (limiter.isBlocked(uid, t)) {
    await audit(db, actor, { action: "auth.mfa_locked", resourceType: "user", resourceId: uid, at: now });
    return { ok: false, reason: "locked" };
  }

  const store = deps().mfa;
  const rec = await store.get(uid);
  const trimmed = code.trim();
  let ok = false;
  let usedRecovery = false;
  if (rec) {
    if (/^\d[\d\s]*$/.test(trimmed)) {
      const step = verifyTotp(rec.totpSecret, trimmed, now);
      if (step !== null && step > rec.lastUsedStep) {
        ok = true;
        await store.put(uid, { ...rec, lastUsedStep: step, enrolledAt: rec.enrolledAt ?? now.toISOString() });
      }
    } else if (rec.enrolledAt) {
      const i = rec.recoveryCodeHashes.findIndex((h) => verifyRecoveryCode(trimmed, h));
      if (i >= 0) {
        ok = true;
        usedRecovery = true;
        await store.put(uid, { ...rec, recoveryCodeHashes: rec.recoveryCodeHashes.filter((_, j) => j !== i) });
      }
    }
  }

  if (!ok) {
    limiter.record(uid, t);
    await audit(db, actor, { action: "auth.mfa_failed", resourceType: "user", resourceId: uid, at: now });
    return { ok: false, reason: limiter.isBlocked(uid, t) ? "locked" : "bad_code" };
  }
  limiter.reset(uid);
  await audit(db, actor, {
    action: usedRecovery ? "auth.mfa_recovery_used" : "auth.mfa_passed",
    resourceType: "user",
    resourceId: uid,
    at: now,
  });
  return { ok: true, sessionToken: issueSession(uid, true, now), usedRecoveryCode: usedRecovery, role: user.role };
}

export function preauthCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${PREAUTH_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${PREAUTH_TTL_S}${secure}`;
}

export function clearPreauthCookie(): string {
  return `${PREAUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
