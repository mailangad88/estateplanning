import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryDb, type Db } from "@/server/db";
import { beginLogin, configureAuth, enrollMfa, finishLink, mfaStatus, readPreauth, verifyMfa } from "@/server/auth/flow";
import { MemoryMfaStore } from "@/server/auth/identity";
import { readSession } from "@/server/auth/session";
import { hotp, stepAt } from "@/server/auth/totp";

const T0 = new Date("2026-03-02T12:00:00Z");
const at = (s: number) => new Date(T0.getTime() + s * 1000);

let db: Db;
let sent: { to: string; text: string }[];
let store: MemoryMfaStore;

const linkToken = () => decodeURIComponent(sent[sent.length - 1].text.match(/token=([^\s]+)/)![1]);

async function preauth(now = T0) {
  await beginLogin(db, "Lawyer@Firm.com", now);
  const pre = await finishLink(db, linkToken(), now);
  expect(pre).toBeTruthy();
  return pre!;
}

beforeEach(async () => {
  sent = [];
  store = new MemoryMfaStore();
  configureAuth({ mfa: store, sendEmail: async (to, _s, text) => void sent.push({ to, text }) });
  db = createMemoryDb();
  await db.users.insert({ id: "u1", email: "lawyer@firm.com", name: "Lee", role: "attorney", active: true });
});

describe("email link", () => {
  it("is single use", async () => {
    await beginLogin(db, "lawyer@firm.com", T0);
    const t = linkToken();
    expect(await finishLink(db, t, at(10))).toBeTruthy();
    expect(await finishLink(db, t, at(20))).toBeNull();
  });

  it("expires after 15 minutes", async () => {
    await beginLogin(db, "lawyer@firm.com", T0);
    expect(await finishLink(db, linkToken(), at(15 * 60))).toBeNull();
  });

  it("rejects tampered tokens", async () => {
    await beginLogin(db, "lawyer@firm.com", T0);
    expect(await finishLink(db, linkToken() + "x", at(5))).toBeNull();
  });

  it("unknown email gives the same response and sends nothing", async () => {
    const known = await beginLogin(db, "lawyer@firm.com", T0);
    const n = sent.length;
    const unknown = await beginLogin(db, "nobody@nowhere.com", T0);
    expect(unknown).toEqual(known);
    expect(sent.length).toBe(n);
  });

  it("limits sign-in emails to 5 per hour per address, silently", async () => {
    for (let i = 0; i < 8; i++) expect(await beginLogin(db, "lawyer@firm.com", at(i))).toEqual({ delivered: true });
    expect(sent).toHaveLength(5);
  });
});

describe("two-step", () => {
  it("full flow ends in an mfa session", async () => {
    const pre = await preauth();
    expect(readPreauth(pre, at(60))).toBe("u1");
    expect(readPreauth(pre, at(301))).toBeNull();
    expect(await mfaStatus("u1")).toBe("none");
    const e = await enrollMfa("u1", "lawyer@firm.com");
    expect(await mfaStatus("u1")).toBe("pending");
    expect(store.raw.get("u1")!.totpSecretEnc).not.toContain(e.secret);
    const r = await verifyMfa(db, pre, hotp(e.secret, stepAt(at(30))), at(30));
    expect(r.ok).toBe(true);
    if (r.ok) expect(readSession(r.sessionToken, at(30))).toMatchObject({ uid: "u1", mfa: true });
    expect(await mfaStatus("u1")).toBe("enrolled");
    await expect(enrollMfa("u1", "lawyer@firm.com")).rejects.toThrow();
  });

  it("rejects a reused code", async () => {
    const pre = await preauth();
    const e = await enrollMfa("u1", "lawyer@firm.com");
    const code = hotp(e.secret, stepAt(T0));
    expect((await verifyMfa(db, pre, code, T0)).ok).toBe(true);
    const again = await verifyMfa(db, pre, code, at(5));
    expect(again).toEqual({ ok: false, reason: "bad_code" });
  });

  it("locks after 5 failures, even for a right code", async () => {
    const pre = await preauth();
    const e = await enrollMfa("u1", "lawyer@firm.com");
    for (let i = 0; i < 5; i++) expect((await verifyMfa(db, pre, "000000", at(i))).ok).toBe(false);
    const good = hotp(e.secret, stepAt(at(10)));
    expect(await verifyMfa(db, pre, good, at(10))).toEqual({ ok: false, reason: "locked" });
    const later = at(16 * 60);
    const pre2 = await preauth(later);
    expect((await verifyMfa(db, pre2, hotp(e.secret, stepAt(later)), later)).ok).toBe(true);
  });

  it("recovery code works once", async () => {
    const pre = await preauth();
    const e = await enrollMfa("u1", "lawyer@firm.com");
    await verifyMfa(db, pre, hotp(e.secret, stepAt(T0)), T0);
    const r1 = await verifyMfa(db, pre, e.recoveryCodes[0], at(40));
    expect(r1.ok).toBe(true);
    expect((await verifyMfa(db, pre, e.recoveryCodes[0], at(50))).ok).toBe(false);
    expect((await verifyMfa(db, pre, e.recoveryCodes[1], at(60))).ok).toBe(true);
  });

  it("rejects without a valid pre-auth token", async () => {
    expect(await verifyMfa(db, undefined, "123456", T0)).toEqual({ ok: false, reason: "no_preauth" });
    expect(await verifyMfa(db, "junk", "123456", T0)).toEqual({ ok: false, reason: "no_preauth" });
  });
});
