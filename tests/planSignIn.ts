/** Test helper: the whole family plan sign-in (email link -> authenticator -> session). */
import { expect } from "vitest";
import { FAMILY_PLAN_CONSENT_VERSION } from "@/lib/familyPlan";
import { hotp, stepAt } from "@/server/auth/totp";
import type { Db } from "@/server/db";
import { completePlanSignIn, startPlanSignIn } from "@/server/services/familyPlan";
import { beginPlanEnrolment, verifyPlanSignIn, type DeviceInfo } from "@/server/services/planAccount";

/** The "phone": authenticator keys by plan id, as the visitor's app would hold them. */
export const phone = new Map<string, string>();

export function tokenFrom(text: string): string {
  const m = /token=([^\s]+)/.exec(text);
  if (!m) throw new Error("no link in email");
  return m[1];
}

/** The code the visitor's app shows at `at`. */
export function codeFor(planId: string, at: Date, secret = phone.get(planId)): string {
  if (!secret) throw new Error(`no authenticator for ${planId}`);
  return hotp(secret.replace(/\s/g, ""), stepAt(at));
}

/** Email -> link -> pre-auth token. */
export async function useLink(db: Db, sent: { text: string }[], email: string, now: Date) {
  const r = await startPlanSignIn(db, { email, consent: true, consentVersion: FAMILY_PLAN_CONSENT_VERSION }, now);
  expect(r).toEqual({ ok: true });
  const done = await completePlanSignIn(db, tokenFrom(sent[sent.length - 1].text), now);
  if (!done) throw new Error("link failed");
  return done;
}

/**
 * The full sign-in; sets up the authenticator on first use. Codes are single use, so each call for the
 * same account must be at a later 30-second step than the last code used.
 */
export async function signInPlan(
  db: Db,
  sent: { text: string }[],
  email: string,
  now: Date,
  device: DeviceInfo = { userAgent: "Safari on iPhone", ipPrefix: "203.0.113.0/24" },
) {
  const link = await useLink(db, sent, email, now);
  const start = await beginPlanEnrolment(db, link.preauthToken, now);
  if (start.ok) phone.set(link.planId, start.secret);
  const v = await verifyPlanSignIn(db, link.preauthToken, codeFor(link.planId, now), device, now);
  if (!v.ok) throw new Error(`verify failed: ${v.reason}`);
  return { planId: link.planId, created: link.created, sessionToken: v.sessionToken, recoveryCodes: v.recoveryCodes, preauthToken: link.preauthToken };
}
