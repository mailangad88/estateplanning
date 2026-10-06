import { describe, expect, it } from "vitest";
import { HEARD_FROM_OPTIONS } from "@/lib/heardFrom";
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

describe("capture fields", () => {
  it("defaults to the plan finder and accepts tool results", () => {
    expect(leadSubmissionSchema.parse(valid).capture.tool).toBe("plan_finder");
    const r = leadSubmissionSchema.parse({ ...valid, capture: { tool: "cost_calculator", result: { estateValue: 500000 } } });
    expect(r.capture.result?.estateValue).toBe(500000);
  });

  it("allows a missing last name but still requires a phone", () => {
    const { lastName: _ignored, ...noLast } = valid;
    expect(leadSubmissionSchema.safeParse(noLast).success).toBe(true);
    expect(leadSubmissionSchema.safeParse({ ...valid, phone: "" }).success).toBe(false);
  });

  it("rejects unknown capture tools", () => {
    expect(leadSubmissionSchema.safeParse({ ...valid, capture: { tool: "spam" } }).success).toBe(false);
  });
});

describe("how did you hear about us", () => {
  it("is optional and accepts the listed answers, including AI assistants", () => {
    expect(leadSubmissionSchema.parse(valid).source.heardFrom).toBeUndefined();
    const r = leadSubmissionSchema.parse({ ...valid, source: { landingPage: "https://x.test/plan-finder", heardFrom: "ai_assistant" } });
    expect(r.source.heardFrom).toBe("ai_assistant");
  });

  it("rejects answers that are not on the list", () => {
    expect(leadSubmissionSchema.safeParse({ ...valid, source: { heardFrom: "billboard" } }).success).toBe(false);
  });

  it("offers every option the playbook asks for", () => {
    expect(HEARD_FROM_OPTIONS.map((o) => o.value)).toEqual(["google_search", "ai_assistant", "social_media", "friend_family", "advisor_cpa", "other"]);
    expect(HEARD_FROM_OPTIONS.find((o) => o.value === "ai_assistant")?.label).toMatch(/ChatGPT/);
  });
});
