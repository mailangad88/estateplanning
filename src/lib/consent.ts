import { firm } from "@/config/firm";

/**
 * Consent language shown on every lead form. The exact text and its version are
 * stored with each lead as proof of consent. Bump the version whenever the text changes.
 */
export const CONSENT_VERSION = "2026-10-06.1";

export function smsConsentText(): string {
  return (
    `I agree to receive calls and text messages from ${firm.firmLegalName} about my inquiry and estate planning ` +
    `at the number I provided, including messages sent with automated technology. Consent is not a condition of ` +
    `receiving services. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help.`
  );
}

export function recordingNoticeText(): string {
  return "Calls with our intake team may be recorded for quality and to make sure your information reaches your attorney accurately.";
}

export function noRelationshipText(): string {
  return (
    "Submitting this form does not create an attorney-client relationship. Our intake team are not lawyers and cannot give legal advice. " +
    "Your information is kept confidential and shared only with an attorney at the firm who may represent you."
  );
}

export interface ConsentRecord {
  version: string;
  smsConsent: boolean;
  smsConsentText: string | null;
  acknowledgedNoRelationship: boolean;
  pageUrl: string;
  ip: string | null;
  userAgent: string | null;
  capturedAt: string;
}

export function buildConsentRecord(input: {
  smsConsent: boolean;
  acknowledgedNoRelationship: boolean;
  pageUrl: string;
  ip: string | null;
  userAgent: string | null;
  now?: Date;
}): ConsentRecord {
  return {
    version: CONSENT_VERSION,
    smsConsent: input.smsConsent,
    smsConsentText: input.smsConsent ? smsConsentText() : null,
    acknowledgedNoRelationship: input.acknowledgedNoRelationship,
    pageUrl: input.pageUrl,
    ip: input.ip,
    userAgent: input.userAgent,
    capturedAt: (input.now ?? new Date()).toISOString(),
  };
}
