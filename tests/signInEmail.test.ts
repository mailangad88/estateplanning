import { describe, expect, it } from "vitest";
import { signInEmailConfigured } from "@/server/auth/identity";

describe("sign-in email provider check", () => {
  it("is on with Resend and a from address, whatever OUTBOUND_SEND_MODE says", () => {
    expect(signInEmailConfigured({ EMAIL_TRANSPORT: "resend", RESEND_API_KEY: "k", EMAIL_FROM: "a@b.com", OUTBOUND_SEND_MODE: "log" })).toBe(true);
  });
  it("is on with Postmark", () => {
    expect(signInEmailConfigured({ EMAIL_TRANSPORT: "postmark", POSTMARK_SERVER_TOKEN: "t", EMAIL_FROM: "a@b.com" })).toBe(true);
  });
  it("is off without a key, a from address or a transport", () => {
    expect(signInEmailConfigured({ EMAIL_TRANSPORT: "resend", EMAIL_FROM: "a@b.com" })).toBe(false);
    expect(signInEmailConfigured({ EMAIL_TRANSPORT: "resend", RESEND_API_KEY: "k" })).toBe(false);
    expect(signInEmailConfigured({ RESEND_API_KEY: "k", EMAIL_FROM: "a@b.com" })).toBe(false);
  });
});
