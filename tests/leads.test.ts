import { describe, expect, it } from "vitest";
import { buildConsentRecord } from "@/lib/consent";
import type { LeadRecord } from "@/lib/crm";
import { scoreLead } from "@/lib/scoring";
import { createMemoryDb } from "@/server/db";
import { ingestLead } from "@/server/services/leads";

function record(id: string, contact: Partial<LeadRecord["contact"]>, extra: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id,
    receivedAt: "2026-10-06T00:00:00Z",
    contact: { firstName: "Ana", lastName: "Lee", email: "ana@example.com", phone: "", state: "TX", language: "English", ...contact },
    contactMethod: "email",
    answers: {},
    score: scoreLead({ state: "TX", servedStates: ["TX"], answers: {}, smsConsent: false }),
    segments: ["tool:guide", "resource:new-parents-guide"],
    source: {},
    consent: buildConsentRecord({ smsConsent: false, acknowledgedNoRelationship: true, pageUrl: "/resources", ip: null, userAgent: null }),
    capture: { tool: "guide", resource: "new-parents-guide" },
    priorTools: ["cost_calculator"],
    ...extra,
  } as LeadRecord;
}

describe("ingestLead", async () => {
  it("keeps capture details on the lead", async () => {
    const db = createMemoryDb();
    const lead = await ingestLead(db, record("l1", {}, { visitorId: "v1" }));
    expect(lead.capture).toEqual({ tool: "guide", resource: "new-parents-guide" });
    expect(lead.priorTools).toEqual(["cost_calculator"]);
    expect(lead.visitorId).toBe("v1");
  });

  it("never merges two people just because neither gave a phone number", async () => {
    const db = createMemoryDb();
    await ingestLead(db, record("l1", { email: "a@example.com" }));
    await ingestLead(db, record("l2", { email: "b@example.com", firstName: "Bo" }));
    expect(await db.persons.list()).toHaveLength(2);
  });

  it("merges repeat submissions by email, phone or browser id", async () => {
    const db = createMemoryDb();
    await ingestLead(db, record("l1", { email: "a@example.com", phone: "5125550100" }, { visitorId: "v9" }));
    await ingestLead(db, record("l2", { email: "A@Example.com" }));
    await ingestLead(db, record("l3", { email: "other@example.com", phone: "15125550100" }));
    await ingestLead(db, record("l4", { email: "third@example.com" }, { visitorId: "v9" }));
    expect(await db.persons.list()).toHaveLength(1);
  });
});
