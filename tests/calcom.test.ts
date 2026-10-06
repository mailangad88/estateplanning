import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseCalcomPayload, pickLead, verifyCalcomSignature } from "@/server/calcom";

const sign = (raw: string, secret: string) => createHmac("sha256", secret).update(raw).digest("hex");
const body = (triggerEvent: string, payload: object) => JSON.stringify({ triggerEvent, payload });

describe("calcom signature", () => {
  const raw = body("BOOKING_CREATED", {});
  it("accepts a valid signature", () => expect(verifyCalcomSignature(raw, sign(raw, "s3"), "s3")).toBe(true));
  it("rejects a bad signature", () => {
    expect(verifyCalcomSignature(raw, sign(raw, "other"), "s3")).toBe(false);
    expect(verifyCalcomSignature(raw, "zz", "s3")).toBe(false);
    expect(verifyCalcomSignature(raw, null, "s3")).toBe(false);
  });
  it("rejects when the secret is unset", () => {
    expect(verifyCalcomSignature(raw, sign(raw, ""), undefined)).toBe(false);
    expect(verifyCalcomSignature(raw, sign(raw, ""), "")).toBe(false);
  });
});

describe("calcom payload", () => {
  it("parses a created booking and matches by email", () => {
    const b = parseCalcomPayload(body("BOOKING_CREATED", { attendees: [{ email: "Pat@Example.com" }] }));
    expect(b).toEqual({ event: "BOOKING_CREATED", leadRef: undefined, emails: ["pat@example.com"] });
    const leads = [
      { id: "old", personId: "p1", createdAt: "2026-01-01" },
      { id: "new", personId: "p1", createdAt: "2026-02-01" },
      { id: "gone", personId: "p1", createdAt: "2026-03-01", exit: { reason: "x" } },
    ];
    expect(pickLead(leads)?.id).toBe("new");
  });
  it("reads metadata.leadRef", () => {
    expect(parseCalcomPayload(body("BOOKING_RESCHEDULED", { metadata: { leadRef: "L1" } }))?.leadRef).toBe("L1");
  });
  it("finds no lead for an unknown attendee", () => {
    expect(pickLead([])).toBeUndefined();
  });
  it("parses cancelled and ignores other events or bad json", () => {
    expect(parseCalcomPayload(body("BOOKING_CANCELLED", {}))?.event).toBe("BOOKING_CANCELLED");
    expect(parseCalcomPayload(body("PING", {}))).toBeNull();
    expect(parseCalcomPayload("nope")).toBeNull();
  });
});
