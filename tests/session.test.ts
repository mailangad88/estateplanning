import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryDb } from "@/server/db";
import {
  actorFromSession,
  cookieFromHeader,
  devLoginEnabled,
  issueSession,
  readSession,
  SESSION_COOKIE,
  SESSION_IDLE_S,
  SESSION_MAX_AGE_S,
  touchSession,
} from "@/server/auth/session";

const T0 = new Date("2026-03-02T12:00:00Z");
const after = (s: number) => new Date(T0.getTime() + s * 1000);

afterEach(() => vi.unstubAllEnvs());

describe("sessions", () => {
  it("roundtrips", () => {
    const p = readSession(issueSession("u1", true, T0), T0);
    expect(p).toMatchObject({ uid: "u1", mfa: true });
    expect(p!.exp - p!.iat).toBe(SESSION_MAX_AGE_S);
  });

  it("rejects missing, malformed and tampered tokens", () => {
    expect(readSession(undefined, T0)).toBeNull();
    expect(readSession("garbage", T0)).toBeNull();
    const token = issueSession("u1", false, T0);
    const [data, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "u1", mfa: true, iat: 0, exp: 9e12, seen: 9e12 })).toString("base64url");
    expect(readSession(`${forged}.${sig}`, T0)).toBeNull();
    expect(readSession(`${data}.${sig.slice(0, -2)}xx`, T0)).toBeNull();
    expect(readSession(`${data}.`, T0)).toBeNull();
  });

  it("expires after 8h", () => {
    const t = issueSession("u1", true, T0);
    // keep touching so idle never trips, to test absolute expiry
    let token = t;
    for (let s = 20 * 60; s < SESSION_MAX_AGE_S; s += 20 * 60) token = touchSession(token, after(s))!;
    expect(token).toBeTruthy();
    expect(readSession(token, after(SESSION_MAX_AGE_S - 1))).not.toBeNull();
    expect(readSession(token, after(SESSION_MAX_AGE_S))).toBeNull();
  });

  it("rejects after idle > 30 minutes", () => {
    const t = issueSession("u1", true, T0);
    expect(readSession(t, after(SESSION_IDLE_S))).not.toBeNull();
    expect(readSession(t, after(SESSION_IDLE_S + 1))).toBeNull();
  });

  it("touchSession refreshes idle but keeps exp", () => {
    const t = issueSession("u1", true, T0);
    const orig = readSession(t, T0)!;
    const touched = touchSession(t, after(25 * 60))!;
    const p = readSession(touched, after(25 * 60))!;
    expect(p.exp).toBe(orig.exp);
    expect(p.seen).toBe(orig.seen + 25 * 60);
    expect(readSession(touched, after(50 * 60))).not.toBeNull(); // would be idle-expired without the touch
    expect(readSession(t, after(50 * 60))).toBeNull();
    expect(touchSession(t, after(SESSION_IDLE_S + 60))).toBeNull();
  });

  it("actorFromSession returns an actor, null for inactive or unknown users", () => {
    const db = createMemoryDb();
    db.users.insert({ id: "u1", email: "a@x.test", name: "A", role: "attorney", firmId: "f", lawyerId: "l", active: true });
    db.users.insert({ id: "u2", email: "b@x.test", name: "B", role: "intake", active: false });
    expect(actorFromSession(db, issueSession("u1", true, T0), T0)).toMatchObject({ userId: "u1", role: "attorney", lawyerId: "l", mfa: true });
    expect(actorFromSession(db, issueSession("u2", true, T0), T0)).toBeNull();
    expect(actorFromSession(db, issueSession("nobody", true, T0), T0)).toBeNull();
    expect(actorFromSession(db, undefined, T0)).toBeNull();
  });
});

describe("cookieFromHeader", () => {
  it("parses", () => {
    expect(cookieFromHeader(null)).toBeUndefined();
    expect(cookieFromHeader("a=1; b=2")).toBeUndefined();
    expect(cookieFromHeader(`a=1; ${SESSION_COOKIE}=tok.en; b=2`)).toBe("tok.en");
    expect(cookieFromHeader(`${SESSION_COOKIE}=a%20b`)).toBe("a b");
    expect(cookieFromHeader(`${SESSION_COOKIE}=x=y=`)).toBe("x=y=");
    expect(cookieFromHeader("foo=bar", "foo")).toBe("bar");
  });
});

describe("devLoginEnabled", () => {
  it("is on only outside production with the flag", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_DEV_LOGIN", "true");
    expect(devLoginEnabled()).toBe(true);
    vi.stubEnv("ENABLE_DEV_LOGIN", "false");
    expect(devLoginEnabled()).toBe(false);
  });
  it("is false in production even with ENABLE_DEV_LOGIN=true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_DEV_LOGIN", "true");
    expect(devLoginEnabled()).toBe(false);
  });
});
