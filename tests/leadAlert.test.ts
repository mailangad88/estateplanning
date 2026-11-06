import { describe, expect, it } from "vitest";
import { leadAlertMessage, leadAlertRecipients, sendLeadAlert } from "@/server/leadAlert";
import type { LeadRecord } from "@/lib/crm";
import type { EmailMessage, EmailTransport } from "@/server/notify/transports";

const record = {
  id: "lead-1",
  receivedAt: "2026-11-07T15:00:00.000Z",
  contact: { firstName: "Jane", lastName: "Doe", email: "jane@example.com", phone: "3125550100", state: "IL" },
  contactMethod: "phone",
  score: { score: 80, tier: "hot", grade: "A", urgent: true, components: {}, redFlags: [] },
  segments: [],
  source: { landingPage: "https://familyfutureplanning.com/learn/illinois/probate?utm_source=google", utmSource: "google" },
  capture: { tool: "plan_finder" },
  priorTools: [],
} as unknown as LeadRecord;

class FakeTransport implements EmailTransport {
  readonly name = "fake";
  readonly dryRun = false;
  sent: EmailMessage[] = [];
  async send(msg: EmailMessage) {
    this.sent.push(msg);
    return { providerId: "x", dryRun: false };
  }
}

describe("lead alert", () => {
  it("parses recipients and drops bad addresses", () => {
    expect(leadAlertRecipients({ LEAD_ALERT_EMAIL: "a@b.com, nope ,c@d.org" })).toEqual(["a@b.com", "c@d.org"]);
    expect(leadAlertRecipients({})).toEqual([]);
  });

  it("never includes the visitor's name, email or phone", () => {
    const { subject, text } = leadAlertMessage(record, "https://familyfutureplanning.com");
    for (const s of ["Jane", "Doe", "jane@example.com", "3125550100"]) {
      expect(subject).not.toContain(s);
      expect(text).not.toContain(s);
    }
    expect(subject).toContain("HOT");
    expect(text).toContain("/learn/illinois/probate");
    expect(text).not.toContain("utm_source");
    expect(text).toContain("https://familyfutureplanning.com/portal/queue");
  });

  it("sends to every recipient and skips quietly when unconfigured", async () => {
    const t = new FakeTransport();
    expect(await sendLeadAlert(record, { LEAD_ALERT_EMAIL: "a@b.com,c@d.org" }, t)).toEqual({ sent: 2 });
    expect(t.sent.map((m) => m.to)).toEqual(["a@b.com", "c@d.org"]);
    expect((await sendLeadAlert(record, {}, t)).sent).toBe(0);
    expect((await sendLeadAlert(record, { LEAD_ALERT_EMAIL: "a@b.com" }, null)).skipped).toBe("no email provider configured");
  });

  it("does not throw when the provider fails", async () => {
    const bad: EmailTransport = { name: "bad", dryRun: false, send: async () => { throw new Error("down"); } };
    expect(await sendLeadAlert(record, { LEAD_ALERT_EMAIL: "a@b.com" }, bad)).toEqual({ sent: 0 });
  });
});
