import { describe, expect, it } from "vitest";
import { effectiveContactMethod, leadSubmissionSchema } from "@/lib/lead";

const valid = {
  firstName: "Ana",
  lastName: "Lee",
  email: "ana@example.com",
  phone: "(512) 555-0100",
  state: "TX",
  preferredContact: "text",
  answers: { matterType: "new_plan" },
  smsConsent: false,
  acknowledgedNoRelationship: true,
};

describe("leadSubmissionSchema", () => {
  it("normalizes the phone number", () => {
    const r = leadSubmissionSchema.parse(valid);
    expect(r.phone).toBe("5125550100");
  });

  it("requires the no-relationship acknowledgment", () => {
    expect(leadSubmissionSchema.safeParse({ ...valid, acknowledgedNoRelationship: false }).success).toBe(false);
  });

  it("rejects an unknown state", () => {
    expect(leadSubmissionSchema.safeParse({ ...valid, state: "ZZ" }).success).toBe(false);
  });
});

describe("effectiveContactMethod", () => {
  it("falls back to a call when text was chosen without SMS consent", () => {
    expect(effectiveContactMethod({ preferredContact: "text", smsConsent: false })).toBe("phone");
    expect(effectiveContactMethod({ preferredContact: "text", smsConsent: true })).toBe("text");
  });
});
