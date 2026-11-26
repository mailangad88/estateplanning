import { US_STATES, servedStates } from "@/config/firm";
import type { buildConsentRecord } from "@/lib/consent";
import type { LeadRecord } from "@/lib/crm";
import { scoreLead } from "@/lib/scoring";
import type { SubscribeInput } from "@/lib/subscribe";

/** Kinds where the visitor is asking a person to contact them. These are leads, not list sign-ups. */
export const CONTACT_KINDS: ReadonlySet<SubscribeInput["kind"]> = new Set(["callback", "question"]);

type Consent = ReturnType<typeof buildConsentRecord>;

/**
 * A call-back or question from the light capture form, shaped as a lead so it lands in the intake
 * queue and alerts the firm exactly like a full intake. Without this, /book "Request a call back"
 * only reached the CRM webhook (or the log when none is set), so the firm never heard about it.
 */
export function contactLeadRecord(input: SubscribeInput, id: string, now: Date, consent: Consent, pageUrl: string): LeadRecord {
  const served = servedStates();
  const state = input.state && (US_STATES as readonly string[]).includes(input.state.toUpperCase())
    ? (input.state.toUpperCase() as LeadRecord["contact"]["state"])
    : ((served[0] ?? "IL") as LeadRecord["contact"]["state"]);
  const result = input.details
    ? Object.fromEntries(
        Object.entries(input.details)
          .slice(0, 30)
          .map(([k, v]) => [k.slice(0, 60), typeof v === "string" ? v.slice(0, 500) : v]),
      )
    : undefined;
  const capture = { tool: "callback" as const, resource: input.interest, ...(result ? { result } : {}) };
  const smsConsent = input.smsConsent && Boolean(input.phone);
  return {
    id,
    receivedAt: now.toISOString(),
    contact: {
      firstName: input.firstName || "Website visitor",
      lastName: "",
      email: input.email,
      phone: input.phone ?? "",
      state,
      language: "English",
    },
    contactMethod: input.phone ? (smsConsent ? "text" : "phone") : "email",
    goals: input.message,
    answers: {},
    score: scoreLead({ state, servedStates: served, answers: {}, goals: input.message, smsConsent, capture, priorTools: [] }),
    segments: [`capture:${input.kind}`],
    source: { landingPage: pageUrl || undefined },
    capture,
    priorTools: [],
    consent,
  };
}

