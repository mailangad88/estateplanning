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

import { postalAddress, seoTitle } from "@/lib/seo";
import { citesOfficialSource, officialSourcesFor } from "@/config/official-sources";

describe("launch SEO helpers", () => {
  it("builds a PostalAddress from a one-line address", () => {
    expect(postalAddress("123 Main St, Suite 4, Naperville, IL 60540")).toEqual({
      "@type": "PostalAddress", streetAddress: "123 Main St, Suite 4", addressLocality: "Naperville", addressRegion: "IL", postalCode: "60540", addressCountry: "US",
    });
    expect(postalAddress("[Office address]")).toBe("[Office address]");
  });
  it("shortens long Topic: detail titles only when the topic stands alone", () => {
    expect(seoTitle("Selling a house in probate in Illinois: when the executor needs court approval")).toBe("Selling a house in probate in Illinois");
    expect(seoTitle("Short title")).toBe("Short title");
    const q = "What happens if you become incapacitated and have no family, or no one you trust to name as your agent?";
    expect(seoTitle(q)).toBe(q);
  });
  it("adds official sources only where the article cites none", () => {
    expect(citesOfficialSource('<a href="https://www.ilga.gov/legislation">x</a>')).toBe(true);
    expect(citesOfficialSource('<a href="/learn/wills">x</a>')).toBe(false);
    expect(officialSourcesFor("new-jersey")).toEqual([]);
    expect(officialSourcesFor("wills").map((s) => s.url)).toContain("https://www.ilga.gov/");
  });
});
