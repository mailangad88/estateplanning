import { describe, expect, it, vi } from "vitest";
import { createMemoryDb } from "@/server/db";
import { applyEmailEvent, parseEmailEvent, svixSignature, verifySvix } from "@/server/notify/emailEvents";
import { emailTransportFromEnv, ResendEmailTransport, TransportConfigError } from "@/server/notify/transports";
import { applySmsInbound, twilioSignature, verifyTwilio } from "@/server/notify/twilioInbound";
import { isSuppressed } from "@/server/nurture/compliance";

describe("resend transport", () => {
  it("sends the documented request shape", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ id: "re_1" }), { status: 200 }));
    const t = emailTransportFromEnv({ OUTBOUND_SEND_MODE: "live", EMAIL_TRANSPORT: "resend", RESEND_API_KEY: "re_k", EMAIL_FROM: "F <a@b.test>" }, f as unknown as typeof fetch);
    expect(t).toBeInstanceOf(ResendEmailTransport);
    const r = await t.send({ to: "x@y.test", subject: "S", text: "T", tag: "tpl:one", headers: { "List-Unsubscribe": "<https://u>" } });
    expect(r).toEqual({ providerId: "re_1", dryRun: false });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_k");
    expect(JSON.parse(init.body as string)).toEqual({ from: "F <a@b.test>", to: ["x@y.test"], subject: "S", text: "T", headers: { "List-Unsubscribe": "<https://u>" }, tags: [{ name: "template", value: "tpl_one" }] });
  });
  it("refuses half-configured live mode and logs otherwise", () => {
    expect(() => emailTransportFromEnv({ OUTBOUND_SEND_MODE: "live", EMAIL_TRANSPORT: "resend", EMAIL_FROM: "a@b.test" })).toThrow(TransportConfigError);
    expect(emailTransportFromEnv({ EMAIL_TRANSPORT: "resend" }).dryRun).toBe(true);
  });
  it("does not echo provider error bodies", async () => {
    const t = new ResendEmailTransport({ apiKey: "k", from: "a@b.test" }, (async () => new Response("x@y.test bad", { status: 422 })) as typeof fetch);
    await expect(t.send({ to: "x@y.test", subject: "s", text: "t" })).rejects.toThrow("Resend responded 422");
  });
});

describe("svix verification", () => {
  it("matches the published Svix test vector", () => {
    const sig = svixSignature("whsec_plJ3nmyCDGBKInavdOK15jsl", "msg_loFOjxBNrRLzqYUf", "1731705121", '{"event_type":"ping","data":{"success":true}}');
    expect(`v1,${sig}`).toBe("v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=");
  });
  const secret = "whsec_" + Buffer.from("k".repeat(24)).toString("base64");
  const now = 1_800_000_000_000;
  const ts = String(now / 1000);
  const body = JSON.stringify({ type: "email.bounced", data: { to: ["Bad@Y.test"], bounce: { type: "Permanent" } } });
  const good = `v1,${svixSignature(secret, "msg_1", ts, body)}`;
  it("accepts good, rejects bad, missing secret and replay", () => {
    expect(verifySvix(body, { id: "msg_1", timestamp: ts, signature: `v1,zzzz ${good}` }, secret, now)).toBe(true);
    expect(verifySvix(body + " ", { id: "msg_1", timestamp: ts, signature: good }, secret, now)).toBe(false);
    expect(verifySvix(body, { id: "msg_1", timestamp: ts, signature: good }, undefined, now)).toBe(false);
    expect(verifySvix(body, { id: "msg_1", timestamp: ts, signature: good }, secret, now + 10 * 60_000)).toBe(false);
  });
  it("suppresses hard bounces and complaints only", async () => {
    const db = createMemoryDb();
    expect(parseEmailEvent(JSON.stringify({ type: "email.bounced", data: { to: ["t@y.test"], bounce: { type: "Transient" } } }))).toBeNull();
    await applyEmailEvent(db, parseEmailEvent(body)!);
    expect(await isSuppressed(db, "email", { email: "bad@y.test", phone: "" })).toBe(true);
    const c = parseEmailEvent(JSON.stringify({ type: "email.complained", data: { to: ["c@y.test"] } }))!;
    expect(c.type).toBe("complaint");
  });
});

describe("twilio inbound", () => {
  const url = "https://example.test/api/sms/inbound";
  const params = new URLSearchParams({ From: "+15125550100", Body: "STOP", MessageSid: "SM1" });
  it("verifies signature good/bad", () => {
    const sig = twilioSignature("tok", url, params);
    expect(verifyTwilio(url, params, sig, "tok")).toBe(true);
    expect(verifyTwilio(url, params, sig, "other")).toBe(false);
    expect(verifyTwilio(url + "x", params, sig, "tok")).toBe(false);
    expect(verifyTwilio(url, params, null, "tok")).toBe(false);
    expect(verifyTwilio(url, params, sig, undefined)).toBe(false);
  });
  it("STOP suppresses, HELP no-ops, START lifts", async () => {
    const db = createMemoryDb();
    const p = { phone: "+15125550100", email: "a@b.test" };
    await applySmsInbound(db, "+15125550100", "help");
    expect(await isSuppressed(db, "sms", p)).toBe(false);
    for (const w of ["STOP", "stopall", "Unsubscribe", "CANCEL", "end", "QUIT"]) {
      await db.suppressions.remove("sms:5125550100");
      await applySmsInbound(db, "+15125550100", ` ${w} `);
      expect(await isSuppressed(db, "sms", p)).toBe(true);
    }
    expect(await isSuppressed(db, "email", p)).toBe(false);
    await applySmsInbound(db, "+15125550100", "UNSTOP");
    expect(await isSuppressed(db, "sms", p)).toBe(false);
  });
});
