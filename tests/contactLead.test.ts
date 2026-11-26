import { describe, expect, it } from "vitest";
import { buildConsentRecord } from "@/lib/consent";
import { subscribeSchema } from "@/lib/subscribe";
import { CONTACT_KINDS, contactLeadRecord } from "@/server/contactLead";
import { leadAlertMessage } from "@/server/leadAlert";

const now = new Date("2026-11-26T20:37:00.000Z");
const consent = buildConsentRecord({ smsConsent: false, acknowledgedNoRelationship: false, pageUrl: "", ip: null, userAgent: null, now });

describe("call-back requests become leads", () => {
  it("treats call-backs and questions as contact requests, not list sign-ups", () => {
    expect(CONTACT_KINDS.has("callback")).toBe(true);
    expect(CONTACT_KINDS.has("question")).toBe(true);
    expect(CONTACT_KINDS.has("magnet")).toBe(false);
    expect(CONTACT_KINDS.has("newsletter")).toBe(false);
  });

  it("builds a phone lead from the /book call-back form", () => {
    const input = subscribeSchema.parse({ kind: "callback", interest: "book", email: "jane@example.com", firstName: "Jane", phone: "(312) 555-0100", details: { bestTime: "Morning" } });
    const lead = contactLeadRecord(input, "id-1", now, consent, "https://familyfutureplanning.com/book");
    expect(lead.contactMethod).toBe("phone");
    expect(lead.contact.phone).toBe("3125550100");
    expect(lead.contact.state).toBe("IL");
    expect(lead.capture).toMatchObject({ tool: "callback", resource: "book", result: { bestTime: "Morning" } });
    expect(lead.score.tier).not.toBe("not_a_fit");
  });

  it("alert for a call-back carries no personal details", () => {
    const input = subscribeSchema.parse({ kind: "callback", interest: "book", email: "jane@example.com", firstName: "Jane", phone: "3125550100" });
    const lead = contactLeadRecord(input, "id-2", now, consent, "https://familyfutureplanning.com/book");
    const { subject, text } = leadAlertMessage(lead, "https://familyfutureplanning.com");
    expect(subject).toContain("wants a call");
    for (const s of [subject, text]) {
      expect(s).not.toContain("Jane");
      expect(s).not.toContain("jane@example.com");
      expect(s).not.toContain("3125550100");
    }
  });

  it("falls back to email when no phone is given", () => {
    const input = subscribeSchema.parse({ kind: "question", interest: "contact", email: "q@example.com", message: "Do I need a trust?" });
    const lead = contactLeadRecord(input, "id-3", now, consent, "");
    expect(lead.contactMethod).toBe("email");
    expect(lead.contact.firstName).toBe("Website visitor");
  });
});
