import { z } from "zod";
import { US_STATES } from "@/config/firm";
import { toolConfig } from "@/config/tools";
import { HEARD_FROM_VALUES } from "@/lib/heardFrom";

const quizAnswers = z.object({
  matterType: z.enum(["new_plan", "update_plan", "after_death", "elder_care", "not_sure"]),
  maritalStatus: z.enum(["single", "married", "partnered", "divorced", "widowed"]),
  children: z.enum(["none", "minors", "adults", "both"]),
  specialNeeds: z.enum(["yes", "no"]),
  blendedFamily: z.enum(["yes", "no"]),
  ownsHome: z.enum(["yes", "no"]),
  ownsBusiness: z.enum(["yes", "no"]),
  outOfStateProperty: z.enum(["yes", "no"]),
  assetRange: z.enum(["under_250k", "250k_1m", "1m_5m", "over_5m", "prefer_not"]),
  existingDocuments: z.enum(["none", "will_only", "trust", "not_sure"]),
  urgency: z.enum(["exploring", "this_month", "health_event", "recent_death"]),
});

/** Every place on the site that can capture a lead. Sent to the CRM so follow-up matches what the visitor did. */
export const CAPTURE_TOOLS = [
  "plan_finder",
  "intake",
  "readiness_score",
  "cost_calculator",
  "will_vs_trust",
  "guide",
  "exit_offer",
  "callback",
] as const;
export type CaptureTool = (typeof CAPTURE_TOOLS)[number];

const captureSchema = z
  .object({
    tool: z.enum(CAPTURE_TOOLS),
    /** Guide slug or other resource the visitor asked for */
    resource: z.string().trim().max(120).optional(),
    /** Tool inputs and results (calculator figures, readiness score, intake details). Flat, small values only. */
    result: z.record(z.string().max(60), z.union([z.string().max(500), z.number(), z.boolean()])).optional(),
  })
  .default({ tool: "plan_finder" });

export const leadSubmissionSchema = z.object({
  firstName: z.string("Enter your first name").trim().min(1, "Enter your first name").max(80),
  lastName: z.string().trim().max(80).default(""),
  email: z.email("Enter a valid email address").max(200),
  phone: z
    .string("Enter a 10-digit US phone number")
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().regex(/^(1?\d{10})?$/, "Enter a 10-digit US phone number"))
    .default(""),
  state: z.enum(US_STATES, "Choose your state"),
  county: z.string().trim().max(80).optional(),
  preferredContact: z.enum(["phone", "text", "email"]).default("phone"),
  language: z.string().trim().max(40).default("English"),
  goals: z.string().trim().max(2000).optional(),
  answers: quizAnswers.partial().default({}),
  capture: captureSchema,
  /** Random id kept in the visitor's browser so repeat submissions can be merged into one CRM contact. */
  visitorId: z.string().trim().max(64).optional(),
  /** Capture tools this visitor used before, oldest first (progressive profiling). */
  priorTools: z.array(z.enum(CAPTURE_TOOLS)).max(20).default([]),
  smsConsent: z.boolean(),
  acknowledgedNoRelationship: z.literal(true, { message: "Please confirm you have read the notice" }),
  source: z
    .object({
      landingPage: z.string().max(500).optional(),
      referrer: z.string().max(500).optional(),
      utmSource: z.string().max(200).optional(),
      utmMedium: z.string().max(200).optional(),
      utmCampaign: z.string().max(200).optional(),
      utmTerm: z.string().max(200).optional(),
      utmContent: z.string().max(200).optional(),
      gclid: z.string().max(300).optional(),
      fbclid: z.string().max(300).optional(),
      /** Referral partner code from a ?ref= link (src/lib/partners.ts). Unknown codes are ignored on the server. */
      partnerRef: z.string().max(64).optional(),
      /** Optional "How did you hear about us?" answer. Self-reported, so AI-assistant referrals can be counted. */
      heardFrom: z.enum(HEARD_FROM_VALUES).optional(),
    })
    .default({}),
  /** Honeypot. Real visitors never see or fill this field. */
  website: z.string().max(0).optional(),
}).superRefine((lead, ctx) => {
  if (!lead.phone && !toolConfig.phoneOptionalFor.includes(lead.capture.tool)) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a 10-digit US phone number" });
  }
  if (lead.smsConsent && !lead.phone) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a mobile number to receive texts" });
  }
});

export type LeadSubmission = z.infer<typeof leadSubmissionSchema>;

/** A text preference without SMS consent falls back to a phone call. */
export function effectiveContactMethod(lead: Pick<LeadSubmission, "preferredContact" | "smsConsent">) {
  return lead.preferredContact === "text" && !lead.smsConsent ? "phone" : lead.preferredContact;
}
