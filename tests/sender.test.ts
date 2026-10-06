import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDb, type Db } from "@/server/db";
import {
  emailTransportFromEnv, LogEmailTransport, LogSmsTransport, maskAddress, PostmarkEmailTransport, sendModeFromEnv, smsTransportFromEnv,
  TransportConfigError, TwilioSmsTransport, type EmailMessage, type EmailTransport,
} from "@/server/notify/transports";
import { enroll } from "@/server/nurture/scheduler";
import { NO_APPROVED_TEMPLATES, runNurtureSends, unsubscribeToken, type TemplateSource } from "@/server/nurture/sender";
import { unsubscribeWithToken } from "@/server/nurture/unsubscribe";
import { slaAlerts } from "@/server/services/intakeQueue";
import type { Lead } from "@/server/types";

const T0 = new Date("2026-10-06T15:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
let db: Db;

const approvedEverything: TemplateSource = {
  render: async (_db, templateKey, channel, vars) => ({
    templateKey,
    templateVersion: "1",
    subject: channel === "email" ? `Hello ${vars.firstName}` : undefined,
    text: `Hi ${vars.firstName}. Unsubscribe: ${vars.unsubscribeUrl}`,
  }),
};

class FakeLiveEmail implements EmailTransport {
  readonly name = "fake";
  readonly dryRun = false;
  readonly sent: EmailMessage[] = [];
  fail = false;
  async send(msg: EmailMessage) {
    if (this.fail) throw new Error("Postmark responded 500");
    this.sent.push(msg);
    return { providerId: `pm-${this.sent.length}`, dryRun: false };
  }
}

beforeEach(async () => {
  db = createMemoryDb();
  await db.persons.insert({ id: "p1", firstName: "Ana", lastName: "Q", email: "ana@example.test", phone: "+15125550100", language: "English", state: "TX" });
  await db.leads.insert({
    id: "l1", personId: "p1", createdAt: T0.toISOString(), stage: "new", stageHistory: [{ stage: "new", at: T0.toISOString(), by: "system" }],
    matterType: "new_plan", state: "TX", urgent: false, score: { score: 50, tier: "warm", grade: "B", urgent: false, components: [], redFlags: [] },
    segments: [], source: {}, consent: { version: "v1", smsConsent: false, smsConsentText: null, acknowledgedNoRelationship: true, pageUrl: "", ip: null, userAgent: null, capturedAt: "" },
    offerSummary: "", conflictCard: { clientName: "Ana Q", parties: [], matterType: "new_plan", state: "TX", clearance: "pending" },
    intake: { summary: "", redFlags: [], deadlines: [], household: { members: [] }, assets: {}, answers: {} },
  } as unknown as Lead);
  await enroll(db, "l1", "speed_to_lead", T0);
});

describe("nurture sender", () => {
  it("creates due call tasks and holds message steps until a template is approved", async () => {
    const email = new LogEmailTransport(true);
    const r = await runNurtureSends(db, { templates: NO_APPROVED_TEMPLATES, email, sms: new LogSmsTransport(true), baseUrl: "https://x.test" }, at(10));
    expect(r.callTasks).toBe(1);
    expect((await db.tasks.list((t) => t.leadId === "l1")).map((t) => t.title)).toEqual(["Call: Call attempt 1 within 5 minutes"]);
    expect(r.awaitingTemplate).toBe(1);
    expect(r.missingTemplates).toEqual(["stl_email_confirm"]);
    expect(email.sent).toHaveLength(0);
    // the text step was skipped for lack of SMS consent, never sent
    expect((await db.enrollments.list())[0].skipped?.map((s) => s.stepId)).toContain("stl_sms_confirm");
  });

  it("logs in dry-run mode and leaves the step due, so nothing is lost when sending goes live", async () => {
    const email = new LogEmailTransport(true);
    const deps = { templates: approvedEverything, email, sms: new LogSmsTransport(true), baseUrl: "https://x.test" };
    expect((await runNurtureSends(db, deps, at(1))).dryRun).toBe(1);
    expect((await runNurtureSends(db, deps, at(2))).dryRun).toBe(1);
    expect((await db.enrollments.list())[0].sentStepIds).not.toContain("stl_email_confirm");
    expect(email.sent[0].headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(email.sent[0].stream).toBe("transactional");
  });

  it("sends through a live transport once, records it, and does not count as human contact for speed to lead", async () => {
    const email = new FakeLiveEmail();
    const deps = { templates: approvedEverything, email, sms: new LogSmsTransport(true), baseUrl: "https://x.test" };
    expect((await runNurtureSends(db, deps, at(1))).sent).toBe(1);
    expect((await runNurtureSends(db, deps, at(2))).sent).toBe(0);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].to).toBe("ana@example.test");
    expect(email.sent[0].text).toContain("https://x.test/unsubscribe?t=");
    expect((await db.activities.list((a) => a.leadId === "l1" && a.kind === "email")).map((a) => a.summary)).toEqual(["nurture-service:stl_email_confirm"]);
    expect((await slaAlerts(db, at(7))).some((a) => a.kind === "speed_to_lead" && a.leadId === "l1")).toBe(true);
  });

  it("leaves a failed send due for the next run and never logs the address", async () => {
    const email = new FakeLiveEmail();
    email.fail = true;
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = { templates: approvedEverything, email, sms: new LogSmsTransport(true), baseUrl: "https://x.test" };
    expect((await runNurtureSends(db, deps, at(1))).failed).toBe(1);
    expect(JSON.stringify(errors.mock.calls)).not.toContain("ana@example.test");
    errors.mockRestore();
    email.fail = false;
    expect((await runNurtureSends(db, deps, at(2))).sent).toBe(1);
  });

  it("honours a signed one-click unsubscribe and rejects a forged one", async () => {
    expect(await unsubscribeWithToken(db, "forged.token", T0)).toBe(false);
    expect(await unsubscribeWithToken(db, unsubscribeToken("p1"), T0)).toBe(true);
    const email = new FakeLiveEmail();
    const r = await runNurtureSends(db, { templates: approvedEverything, email, sms: new LogSmsTransport(true), baseUrl: "https://x.test" }, at(1));
    expect(r.sent).toBe(0);
    expect(email.sent).toHaveLength(0);
  });
});

describe("transports", () => {
  it("stays in dry-run unless OUTBOUND_SEND_MODE=live, and refuses a half-configured live mode", () => {
    expect(sendModeFromEnv({})).toBe("log");
    expect(emailTransportFromEnv({ EMAIL_TRANSPORT: "postmark", POSTMARK_SERVER_TOKEN: "t", EMAIL_FROM: "a@b.test" }).dryRun).toBe(true);
    expect(smsTransportFromEnv({ SMS_TRANSPORT: "twilio" }).dryRun).toBe(true);
    expect(() => emailTransportFromEnv({ OUTBOUND_SEND_MODE: "live" })).toThrow(TransportConfigError);
    expect(() => smsTransportFromEnv({ OUTBOUND_SEND_MODE: "live", SMS_TRANSPORT: "twilio", TWILIO_ACCOUNT_SID: "AC1" })).toThrow(TransportConfigError);
    expect(emailTransportFromEnv({ OUTBOUND_SEND_MODE: "live", EMAIL_TRANSPORT: "postmark", POSTMARK_SERVER_TOKEN: "t", EMAIL_FROM: "a@b.test" }).name).toBe("postmark");
  });

  it("builds the Postmark and Twilio requests without leaking error bodies", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const ok = (body: object) => async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      return new Response(JSON.stringify(body), { status: 200 });
    };
    const pm = new PostmarkEmailTransport({ serverToken: "tok", from: "Firm <hi@firm.test>" }, ok({ MessageID: "m1" }) as typeof fetch);
    expect((await pm.send({ to: "a@b.test", subject: "S", text: "T", stream: "marketing" })).providerId).toBe("m1");
    const sent = JSON.parse(String(calls[0].init.body));
    expect(calls[0].url).toBe("https://api.postmarkapp.com/email");
    expect((calls[0].init.headers as Record<string, string>)["X-Postmark-Server-Token"]).toBe("tok");
    expect(sent).toMatchObject({ From: "Firm <hi@firm.test>", To: "a@b.test", MessageStream: "broadcast" });

    const tw = new TwilioSmsTransport({ accountSid: "AC1", authToken: "secret", messagingServiceSid: "MG1" }, ok({ sid: "SM1" }) as typeof fetch);
    expect((await tw.send({ to: "+15125550100", body: "Hi. Reply STOP to opt out" })).providerId).toBe("SM1");
    expect(calls[1].url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
    expect(String(calls[1].init.body)).toContain("MessagingServiceSid=MG1");

    const bad = new PostmarkEmailTransport({ serverToken: "tok", from: "x@y.test" }, (async () => new Response("recipient a@b.test invalid", { status: 422 })) as typeof fetch);
    await expect(bad.send({ to: "a@b.test", subject: "S", text: "T" })).rejects.toThrow(/^Postmark responded 422$/);
  });

  it("masks addresses in logs", () => {
    expect(maskAddress("ana@example.test")).toBe("a***@example.test");
    expect(maskAddress("+1 (512) 555-0100")).toBe("***00");
  });
});
