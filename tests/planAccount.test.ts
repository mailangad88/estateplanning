import { beforeEach, describe, expect, it } from "vitest";
import { verifyAuditChain } from "@/server/audit/log";
import { createMemoryDb, type Db } from "@/server/db";
import { seedDemo } from "@/server/seed";
import { configureFamilyPlan, loadOwnPlan, saveOwnPlan } from "@/server/services/familyPlan";
import {
  PLAN_MFA_LOCKOUT_S,
  PLAN_MFA_MAX_FAILURES,
  PLAN_SESSION_ABSOLUTE_S,
  PLAN_SESSION_IDLE_S,
  accountOverview,
  beginAuthenticatorChange,
  beginPlanEnrolment,
  confirmAuthenticatorChange,
  deletePlanAccount,
  deviceSummary,
  exportPlanAccount,
  ipPrefix,
  listActivity,
  listDevices,
  planSignInStatus,
  regenerateRecoveryCodes,
  resolvePlanSession,
  revokeAllPlanSessions,
  revokePlanSession,
  signOutPlanSession,
  verifyPlanSignIn,
  type PlanSessionContext,
} from "@/server/services/planAccount";
import { codeFor, phone, signInPlan, useLink } from "./planSignIn";

const NOW = new Date("2026-10-06T15:00:00Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);
const MIN = 60_000;

let db: Db;
let sent: { to: string; text: string }[];

beforeEach(async () => {
  db = createMemoryDb();
  await seedDemo(db, NOW);
  sent = [];
  phone.clear();
  configureFamilyPlan({ sendEmail: async (to, _s, text) => void sent.push({ to, text }), baseUrl: "https://site.test" });
});

async function ctxOf(token: string, now = NOW): Promise<PlanSessionContext> {
  const ctx = await resolvePlanSession(db, token, now);
  if (!ctx) throw new Error("no session");
  return ctx;
}

describe("first sign-in: two-step verification comes before any plan data", () => {
  it("the email link alone opens nothing; the plan is prefilled and linked only after the code", async () => {
    // morgan@example.com has a lead (lead-0002) whose answers would prefill the plan
    const link = await useLink(db, sent, "morgan@example.com", NOW);
    expect(link.created).toBe(true);
    expect(await planSignInStatus(db, link.preauthToken, NOW)).toBe("enrol");
    expect(await resolvePlanSession(db, link.preauthToken, NOW)).toBeNull(); // a pre-auth token is not a session
    expect(await db.planSessions.list()).toEqual([]);
    const before = (await db.familyPlans.get(link.planId))!;
    expect(before.leadId).toBeUndefined();
    expect(before.prefilledFrom).toBeUndefined();
    expect((await loadOwnPlan(db, link.planId))!.body.assets.items).toEqual([]);

    const start = await beginPlanEnrolment(db, link.preauthToken, NOW);
    if (!start.ok) throw new Error("no setup");
    expect(start.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(start.otpauthUrl).not.toContain("morgan");
    // reloading the setup page shows the same key, so an app that already scanned it keeps working
    const again = await beginPlanEnrolment(db, link.preauthToken, NOW);
    expect(again.ok && again.secret).toBe(start.secret);
    const stored = (await db.planMfa.get(link.planId))!;
    expect(stored.totpSecretEnc).not.toContain(start.secret);
    expect(stored.enrolledAt).toBeUndefined();
    expect(stored.recoveryCodeHashes).toEqual([]);

    // a recovery-code-shaped answer does not count before setup is confirmed
    expect(await verifyPlanSignIn(db, link.preauthToken, "abcde-fghij", {}, NOW)).toMatchObject({ ok: false, reason: "bad_code" });
    const v = await verifyPlanSignIn(db, link.preauthToken, codeFor(link.planId, NOW, start.secret), { userAgent: "Chrome on Mac" }, NOW);
    if (!v.ok) throw new Error(v.reason);
    expect(v.firstSignIn).toBe(true);
    expect(v.recoveryCodes).toHaveLength(10);
    expect(new Set(v.recoveryCodes).size).toBe(10);
    const rec = (await db.planMfa.get(link.planId))!;
    expect(rec.enrolledAt).toBe(NOW.toISOString());
    expect(rec.recoveryCodeHashes).toHaveLength(10);
    for (const c of v.recoveryCodes!) expect(JSON.stringify(rec)).not.toContain(c);

    const after = (await db.familyPlans.get(link.planId))!;
    expect(after.leadId).toBe("lead-0002");
    expect(after.prefilledFrom).toEqual(["lead"]);
    expect((await ctxOf(v.sessionToken)).planId).toBe(link.planId);
    const actions = (await db.audit.list((e) => e.resourceId === link.planId)).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["family_plan.create", "family_plan.link_used", "family_plan.mfa_failed", "family_plan.mfa_enrolled", "family_plan.prefill", "family_plan.link", "family_plan.sign_in"]));
    expect(actions.indexOf("family_plan.mfa_enrolled")).toBeLessThan(actions.indexOf("family_plan.prefill"));
  });

  it("once set up, a sign-in asks for a code and never shows the key or recovery codes again", async () => {
    const first = await signInPlan(db, sent, "two@x.test", NOW);
    const link = await useLink(db, sent, "two@x.test", at(MIN));
    expect(await planSignInStatus(db, link.preauthToken, at(MIN))).toBe("code");
    expect(await beginPlanEnrolment(db, link.preauthToken, at(MIN))).toEqual({ ok: false, reason: "enrolled" });
    const v = await verifyPlanSignIn(db, link.preauthToken, codeFor(first.planId, at(MIN)), {}, at(MIN));
    expect(v.ok && v.recoveryCodes).toBeUndefined();
    expect(v.ok && v.firstSignIn).toBe(false);
  });

  it("a code works once, and an old pre-auth token or a missing one gets nowhere", async () => {
    const s = await signInPlan(db, sent, "replay@x.test", NOW);
    const link = await useLink(db, sent, "replay@x.test", NOW);
    // the same 30-second code that was just used is refused
    expect(await verifyPlanSignIn(db, link.preauthToken, codeFor(s.planId, NOW), {}, NOW)).toMatchObject({ ok: false, reason: "bad_code" });
    expect(await verifyPlanSignIn(db, undefined, codeFor(s.planId, at(MIN)), {}, at(MIN))).toEqual({ ok: false, reason: "no_preauth" });
    expect(await verifyPlanSignIn(db, link.preauthToken, codeFor(s.planId, at(11 * MIN)), {}, at(11 * MIN))).toEqual({ ok: false, reason: "no_preauth" });
  });

  it("a session record whose second factor is gone, or a forged cookie, does not open the plan", async () => {
    const s = await signInPlan(db, sent, "gone@x.test", NOW);
    expect(await resolvePlanSession(db, s.sessionToken, NOW)).not.toBeNull();
    const [dataPart, sig] = s.sessionToken.split(".");
    const payload = JSON.parse(Buffer.from(dataPart, "base64url").toString());
    const forged = `${Buffer.from(JSON.stringify({ ...payload, pid: "fp_other" })).toString("base64url")}.${sig}`;
    expect(await resolvePlanSession(db, forged, NOW)).toBeNull();
    await db.planMfa.update(s.planId, { enrolledAt: undefined });
    expect(await resolvePlanSession(db, s.sessionToken, NOW)).toBeNull();
  });
});

describe("wrong codes lock the code step", () => {
  it(`locks after ${PLAN_MFA_MAX_FAILURES} wrong codes for ${PLAN_MFA_LOCKOUT_S / 60} minutes, even for the right code, and is audited`, async () => {
    const s = await signInPlan(db, sent, "lock@x.test", NOW);
    const t = at(2 * MIN);
    const link = await useLink(db, sent, "lock@x.test", t);
    for (let i = 1; i < PLAN_MFA_MAX_FAILURES; i++) {
      expect(await verifyPlanSignIn(db, link.preauthToken, "000000", {}, t)).toMatchObject({ ok: false, reason: "bad_code" });
    }
    const locked = await verifyPlanSignIn(db, link.preauthToken, "000000", {}, t);
    expect(locked).toMatchObject({ ok: false, reason: "locked" });
    expect((await db.planMfa.get(s.planId))!.lockedUntil).toBe(new Date(t.getTime() + PLAN_MFA_LOCKOUT_S * 1000).toISOString());
    // the right code is refused while locked, and a recovery code too
    expect(await verifyPlanSignIn(db, link.preauthToken, codeFor(s.planId, at(3 * MIN)), {}, at(3 * MIN))).toMatchObject({ ok: false, reason: "locked" });
    expect(await verifyPlanSignIn(db, link.preauthToken, s.recoveryCodes![0], {}, at(3 * MIN))).toMatchObject({ ok: false, reason: "locked" });
    // the lock lives in the database: a fresh pre-auth (or another app instance) is still locked
    const again = await useLink(db, sent, "lock@x.test", at(4 * MIN));
    expect(await verifyPlanSignIn(db, again.preauthToken, codeFor(s.planId, at(4 * MIN)), {}, at(4 * MIN))).toMatchObject({ ok: false, reason: "locked" });
    const audit = await db.audit.list((e) => e.resourceId === s.planId);
    expect(audit.filter((e) => e.action === "family_plan.mfa_failed")).toHaveLength(PLAN_MFA_MAX_FAILURES - 1);
    expect(audit.filter((e) => e.action === "family_plan.mfa_locked")).toEqual([expect.objectContaining({ detail: { purpose: "sign_in", failures: PLAN_MFA_MAX_FAILURES, minutes: 15 } })]);
    expect(audit.filter((e) => e.action === "family_plan.mfa_blocked").length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(audit)).not.toContain("000000");

    const later = at(2 * MIN + PLAN_MFA_LOCKOUT_S * 1000 + MIN);
    const fresh = await useLink(db, sent, "lock@x.test", later);
    const ok = await verifyPlanSignIn(db, fresh.preauthToken, codeFor(s.planId, later), {}, later);
    expect(ok.ok).toBe(true);
    expect((await db.planMfa.get(s.planId))!.failedAttempts).toBe(0);
  });

  it("the lockout also covers first-time setup, and reloading the setup page does not reset it", async () => {
    const link = await useLink(db, sent, "setup-lock@x.test", NOW);
    await beginPlanEnrolment(db, link.preauthToken, NOW);
    for (let i = 0; i < PLAN_MFA_MAX_FAILURES; i++) await verifyPlanSignIn(db, link.preauthToken, "111111", {}, NOW);
    await beginPlanEnrolment(db, link.preauthToken, NOW);
    expect((await db.planMfa.get(link.planId))!.lockedUntil).toBeDefined();
    expect(await verifyPlanSignIn(db, link.preauthToken, "222222", {}, NOW)).toMatchObject({ ok: false, reason: "locked" });
  });

  it("parallel guesses are counted one by one", async () => {
    const s = await signInPlan(db, sent, "parallel@x.test", NOW);
    const link = await useLink(db, sent, "parallel@x.test", at(MIN));
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => verifyPlanSignIn(db, link.preauthToken, String(100000 + i), {}, at(MIN))));
    expect(results.filter((r) => !r.ok && r.reason === "bad_code")).toHaveLength(PLAN_MFA_MAX_FAILURES - 1);
    expect(results.filter((r) => !r.ok && r.reason === "locked")).toHaveLength(12 - (PLAN_MFA_MAX_FAILURES - 1));
    expect((await db.planMfa.get(s.planId))!.lockedUntil).toBeDefined();
  });
});

describe("recovery codes", () => {
  it("each works once, is marked on the session, and new codes replace the old ones", async () => {
    const s = await signInPlan(db, sent, "rec@x.test", NOW);
    const [c1, c2] = s.recoveryCodes!;
    const link = await useLink(db, sent, "rec@x.test", at(MIN));
    const v = await verifyPlanSignIn(db, link.preauthToken, c1.toUpperCase().replace("-", " "), { userAgent: "Firefox on Windows" }, at(MIN));
    if (!v.ok) throw new Error(v.reason);
    expect(v.usedRecoveryCode).toBe(true);
    expect(v.recoveryCodesLeft).toBe(9);
    const ctx = await ctxOf(v.sessionToken, at(MIN));
    expect((await listDevices(ctx, at(MIN))).find((d) => d.current)).toMatchObject({ viaRecoveryCode: true, device: "Firefox on Windows" });

    const reuse = await useLink(db, sent, "rec@x.test", at(2 * MIN));
    expect(await verifyPlanSignIn(db, reuse.preauthToken, c1, {}, at(2 * MIN))).toMatchObject({ ok: false, reason: "bad_code" });
    expect((await db.audit.list((e) => e.action === "family_plan.recovery_code_used" && e.resourceId === s.planId))).toEqual([
      expect.objectContaining({ detail: { purpose: "sign_in", left: 9 } }),
    ]);

    // regenerating needs a fresh code; afterwards the old codes are dead
    expect(await regenerateRecoveryCodes(ctx, "123456", at(2 * MIN))).toMatchObject({ ok: false, reason: "bad_code" });
    const r = await regenerateRecoveryCodes(ctx, codeFor(s.planId, at(3 * MIN)), at(3 * MIN));
    if (!r.ok) throw new Error(r.reason);
    expect(r.recoveryCodes).toHaveLength(10);
    expect(r.recoveryCodes).not.toContain(c2);
    const old = await useLink(db, sent, "rec@x.test", at(4 * MIN));
    expect(await verifyPlanSignIn(db, old.preauthToken, c2, {}, at(4 * MIN))).toMatchObject({ ok: false, reason: "bad_code" });
    expect(await verifyPlanSignIn(db, old.preauthToken, r.recoveryCodes[0], {}, at(4 * MIN))).toMatchObject({ ok: true, usedRecoveryCode: true });
    expect((await accountOverview(ctx, at(4 * MIN))).mfa.recoveryCodesLeft).toBe(9);
  });

  it("moving to a new phone: the old app until the new one confirms, then only the new one", async () => {
    const s = await signInPlan(db, sent, "newphone@x.test", NOW);
    const ctx = await ctxOf(s.sessionToken);
    const oldSecret = phone.get(s.planId)!;
    const begin = await beginAuthenticatorChange(ctx, codeFor(s.planId, at(MIN)), at(MIN));
    if (!begin.ok) throw new Error(begin.reason);
    // the new app's first code is accepted even inside the same 30 seconds as the old app's last code
    expect(await confirmAuthenticatorChange(ctx, "000000", at(MIN))).toMatchObject({ ok: false });
    expect(await confirmAuthenticatorChange(ctx, codeFor(s.planId, at(MIN), begin.secret), at(MIN))).toEqual({ ok: true });
    phone.set(s.planId, begin.secret);
    const link = await useLink(db, sent, "newphone@x.test", at(2 * MIN));
    expect(await verifyPlanSignIn(db, link.preauthToken, codeFor(s.planId, at(2 * MIN), oldSecret), {}, at(2 * MIN))).toMatchObject({ ok: false });
    expect(await verifyPlanSignIn(db, link.preauthToken, codeFor(s.planId, at(3 * MIN)), {}, at(3 * MIN))).toMatchObject({ ok: true });
    expect((await listActivity(ctx)).map((a) => a.text)).toContain("Authenticator app changed");
  });
});

describe("sessions and devices", () => {
  it("lists devices with a coarse summary only, and signing out one or all ends those sessions", async () => {
    const a = await signInPlan(db, sent, "dev@x.test", NOW, { userAgent: "Safari on iPhone", ipPrefix: "203.0.113.0/24" });
    const b = await signInPlan(db, sent, "dev@x.test", at(MIN), { userAgent: "Chrome on Windows", ipPrefix: "198.51.100.0/24" });
    const c = await signInPlan(db, sent, "dev@x.test", at(2 * MIN), { userAgent: "Firefox on Linux" });
    const ctxA = await ctxOf(a.sessionToken, at(2 * MIN));
    const devices = await listDevices(ctxA, at(2 * MIN));
    expect(devices.map((d) => d.device).sort()).toEqual(["Chrome on Windows", "Firefox on Linux", "Safari on iPhone"]);
    expect(devices.filter((d) => d.current).map((d) => d.device)).toEqual(["Safari on iPhone"]);
    expect(JSON.stringify(await db.planSessions.list())).not.toContain(a.sessionToken.split(".")[0]);

    const bId = devices.find((d) => d.device === "Chrome on Windows")!.id;
    expect(await revokePlanSession(ctxA, bId, at(2 * MIN))).toEqual({ ok: true, current: false });
    expect(await resolvePlanSession(db, b.sessionToken, at(2 * MIN))).toBeNull();
    expect(await resolvePlanSession(db, a.sessionToken, at(2 * MIN))).not.toBeNull();

    const ctxC = await ctxOf(c.sessionToken, at(2 * MIN));
    await signOutPlanSession(ctxC, at(2 * MIN));
    expect(await resolvePlanSession(db, c.sessionToken, at(2 * MIN))).toBeNull();

    const d = await signInPlan(db, sent, "dev@x.test", at(3 * MIN));
    expect(await revokeAllPlanSessions(ctxA, at(3 * MIN))).toBe(2);
    expect(await resolvePlanSession(db, a.sessionToken, at(3 * MIN))).toBeNull();
    expect(await resolvePlanSession(db, d.sessionToken, at(3 * MIN))).toBeNull();
    expect(await db.planSessions.list((s) => s.planId === a.planId)).toEqual([]);
    const actions = (await db.audit.list((e) => e.resourceId === a.planId)).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["family_plan.session_revoked", "family_plan.sign_out", "family_plan.sessions_revoked"]));
  });

  it(`ends after ${PLAN_SESSION_IDLE_S / 60} idle minutes, and ${PLAN_SESSION_ABSOLUTE_S / 86400} days after sign-in even when active`, async () => {
    const s = await signInPlan(db, sent, "idle@x.test", NOW);
    expect(await resolvePlanSession(db, s.sessionToken, at(29 * MIN))).not.toBeNull(); // refreshes last seen
    expect(await resolvePlanSession(db, s.sessionToken, at(58 * MIN))).not.toBeNull(); // 29 minutes after that
    expect(await resolvePlanSession(db, s.sessionToken, at(89 * MIN))).toBeNull(); // 31 minutes idle
    expect(await db.planSessions.list((x) => x.planId === s.planId)).toEqual([]); // and the record is gone

    const t = await signInPlan(db, sent, "idle@x.test", at(100 * MIN));
    let now = at(100 * MIN);
    const end = at(100 * MIN + PLAN_SESSION_ABSOLUTE_S * 1000);
    while (now.getTime() + 25 * MIN < end.getTime()) {
      now = new Date(now.getTime() + 25 * MIN);
      expect(await resolvePlanSession(db, t.sessionToken, now)).not.toBeNull();
    }
    expect(await resolvePlanSession(db, t.sessionToken, new Date(end.getTime() + 1000))).toBeNull();
  });

  it("one account cannot see or end another account's devices or activity", async () => {
    const a = await signInPlan(db, sent, "a@x.test", NOW);
    const b = await signInPlan(db, sent, "b@x.test", NOW);
    const ctxA = await ctxOf(a.sessionToken);
    const ctxB = await ctxOf(b.sessionToken);
    const bDevice = (await listDevices(ctxB, NOW))[0].id;
    expect((await listDevices(ctxA, NOW)).map((d) => d.id)).not.toContain(bDevice);
    expect(await revokePlanSession(ctxA, bDevice, NOW)).toEqual({ ok: false, current: false });
    expect(await resolvePlanSession(db, b.sessionToken, NOW)).not.toBeNull();
    await saveOwnPlan(db, b.planId, { papers: { location: "desk" } }, NOW);
    expect((await listActivity(ctxA)).map((x) => x.text)).not.toContain("Plan saved");
    expect((await listActivity(ctxB)).map((x) => x.text)).toContain("Plan saved");
  });
});

describe("account page: activity, export and deletion", () => {
  it("activity is the account's own events in plain words, newest first, with saves folded together", async () => {
    const s = await signInPlan(db, sent, "act@x.test", NOW);
    for (let i = 0; i < 3; i++) await saveOwnPlan(db, s.planId, { papers: { location: `box ${i}` } }, at(i * MIN));
    const items = await listActivity(await ctxOf(s.sessionToken));
    expect(items[0]).toMatchObject({ text: "Plan saved", count: 3 });
    expect(items.map((i) => i.text)).toEqual(expect.arrayContaining(["Signed in", "Two-step verification turned on", "Account created"]));
    expect(JSON.stringify(items)).not.toContain("box");
  });

  it("export holds the plan and account details, never secrets, and is audited", async () => {
    const s = await signInPlan(db, sent, "exp@x.test", NOW);
    await saveOwnPlan(db, s.planId, { people: { spouseName: "Jamie" } }, NOW);
    const ctx = await ctxOf(s.sessionToken);
    const data = await exportPlanAccount(ctx, at(MIN));
    expect(data).toMatchObject({ format: "family-plan-export", plan: { id: s.planId, body: { people: { spouseName: "Jamie" } } }, account: { recoveryCodesLeft: 10 } });
    expect(data!.devices).toHaveLength(1);
    const json = JSON.stringify(data);
    const rec = (await db.planMfa.get(s.planId))!;
    for (const secret of [phone.get(s.planId)!, rec.totpSecretEnc, ...rec.recoveryCodeHashes, ...s.recoveryCodes!, s.sessionToken]) expect(json).not.toContain(secret);
    expect(json).not.toContain((await db.planSessions.list())[0].id);
    expect(await db.audit.list((e) => e.action === "family_plan.export" && e.resourceId === s.planId)).toHaveLength(1);
  });

  it("delete needs a fresh code, then removes the account, plan, answers, second factor and every session", async () => {
    const s = await signInPlan(db, sent, "del@x.test", NOW);
    const other = await signInPlan(db, sent, "del@x.test", at(MIN));
    const keep = await signInPlan(db, sent, "keep@x.test", NOW);
    await saveOwnPlan(db, s.planId, { papers: { location: "desk drawer" } }, NOW);
    const ctx = await ctxOf(s.sessionToken, at(MIN));
    expect(await deletePlanAccount(ctx, "999999", at(2 * MIN))).toMatchObject({ ok: false, reason: "bad_code" });
    expect(await db.familyPlans.get(s.planId)).toBeDefined();
    expect(await deletePlanAccount(ctx, codeFor(s.planId, at(2 * MIN)), at(2 * MIN))).toEqual({ ok: true });

    expect(await db.familyPlans.get(s.planId)).toBeUndefined();
    expect(await db.familyPlanBodies.get(s.planId)).toBeUndefined();
    expect(await db.planMfa.get(s.planId)).toBeUndefined();
    expect(await db.planSessions.list((x) => x.planId === s.planId)).toEqual([]);
    expect(await resolvePlanSession(db, s.sessionToken, at(2 * MIN))).toBeNull();
    expect(await resolvePlanSession(db, other.sessionToken, at(2 * MIN))).toBeNull();
    expect(await resolvePlanSession(db, keep.sessionToken, at(2 * MIN))).not.toBeNull();

    const del = await db.audit.list((e) => e.action === "family_plan.delete");
    expect(del).toEqual([expect.objectContaining({ resourceId: s.planId, actorRole: "planner", detail: { sessionsEnded: 2 } })]);
    const trail = JSON.stringify(await db.audit.list((e) => e.resourceId === s.planId));
    expect(trail).not.toContain("desk drawer");
    expect(trail).not.toContain("del@x.test");
    expect(verifyAuditChain(await db.audit.list())).toEqual({ ok: true });

    // the same email starts over with a new, empty account and a new authenticator
    const fresh = await useLink(db, sent, "del@x.test", at(3 * MIN));
    expect(fresh.created).toBe(true);
    expect(fresh.planId).not.toBe(s.planId);
    expect(await planSignInStatus(db, fresh.preauthToken, at(3 * MIN))).toBe("enrol");
  });
});

describe("device details are coarse", () => {
  it("summarizes the browser and system, never the raw string", () => {
    expect(deviceSummary("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari on iPhone");
    expect(deviceSummary("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0")).toBe("Edge on Windows");
    expect(deviceSummary("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")).toBe("Chrome on Mac");
    expect(deviceSummary("Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36")).toBe("Chrome on Android");
    expect(deviceSummary("curl/8.0")).toBe("A browser");
    expect(deviceSummary(null)).toBeUndefined();
  });

  it("keeps only the network part of an address", () => {
    expect(ipPrefix("203.0.113.77")).toBe("203.0.113.0/24");
    expect(ipPrefix("::ffff:198.51.100.9")).toBe("198.51.100.0/24");
    expect(ipPrefix("2001:db8:abcd:12::1")).toBe("2001:db8:abcd::/48");
    expect(ipPrefix("2001:db8::1")).toBe("2001:db8:0::/48");
    expect(ipPrefix("999.1.1.1")).toBeUndefined();
    expect(ipPrefix("not an ip")).toBeUndefined();
    expect(ipPrefix(undefined)).toBeUndefined();
  });
});
