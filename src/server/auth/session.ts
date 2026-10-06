/**
 * Portal sessions: an HMAC-signed cookie carrying the user id, whether the second
 * factor passed, and an expiry. Identity itself (email link, SSO, TOTP) comes from
 * an identity provider plugged in at sign-in; until one is configured only the
 * development sign-in in /api/auth/dev-login can mint sessions, and it is off in
 * production.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "@/server/db";
import type { Actor } from "@/server/types";

export const SESSION_COOKIE = "ep_portal";
/** Sessions end after 8 hours, and after 30 minutes without a request (enforced by re-issuing on each request). */
export const SESSION_MAX_AGE_S = 8 * 3600;
export const SESSION_IDLE_S = 30 * 60;

interface Payload {
  uid: string;
  mfa: boolean;
  iat: number;
  exp: number;
  /** last seen, for the idle timeout */
  seen: number;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (32+ characters)");
  return "development-only-session-secret-change-me";
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function issueSession(userId: string, mfa: boolean, now = new Date()): string {
  const t = Math.floor(now.getTime() / 1000);
  const payload: Payload = { uid: userId, mfa, iat: t, exp: t + SESSION_MAX_AGE_S, seen: t };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function readSession(token: string | undefined, now = new Date()): Payload | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  let p: Payload;
  try {
    p = JSON.parse(Buffer.from(data, "base64url").toString());
  } catch {
    return null;
  }
  const t = Math.floor(now.getTime() / 1000);
  if (t >= p.exp || t - p.seen > SESSION_IDLE_S) return null;
  return p;
}

/** Re-issues a still-valid token with a fresh last-seen time, keeping the original expiry. */
export function touchSession(token: string, now = new Date()): string | null {
  const p = readSession(token, now);
  if (!p) return null;
  const next: Payload = { ...p, seen: Math.floor(now.getTime() / 1000) };
  const data = Buffer.from(JSON.stringify(next)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function actorFromSession(db: Db, token: string | undefined, now = new Date()): Actor | null {
  const p = readSession(token, now);
  if (!p) return null;
  const user = db.users.get(p.uid);
  if (!user || !user.active) return null;
  return {
    userId: user.id,
    role: user.role,
    firmId: user.firmId,
    lawyerId: user.lawyerId,
    supportsLawyerIds: user.supportsLawyerIds,
    personId: user.personId,
    mfa: p.mfa,
  };
}

export function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_LOGIN === "true";
}

export function cookieFromHeader(header: string | null, name = SESSION_COOKIE): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_S}${secure}`;
}
