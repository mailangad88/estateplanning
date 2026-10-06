import { z } from "zod";
import { US_STATES } from "@/config/firm";

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

export const leadSubmissionSchema = z.object({
  firstName: z.string("Enter your first name").trim().min(1, "Enter your first name").max(80),
  lastName: z.string("Enter your last name").trim().min(1, "Enter your last name").max(80),
  email: z.email("Enter a valid email address").max(200),
  phone: z
    .string("Enter a 10-digit US phone number")
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().regex(/^1?\d{10}$/, "Enter a 10-digit US phone number")),
  state: z.enum(US_STATES, "Choose your state"),
  county: z.string().trim().max(80).optional(),
  preferredContact: z.enum(["phone", "text", "email"]),
  language: z.string().trim().max(40).default("English"),
  goals: z.string().trim().max(2000).optional(),
  answers: quizAnswers.partial(),
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
    })
    .default({}),
  /** Honeypot. Real visitors never see or fill this field. */
  website: z.string().max(0).optional(),
});

export type LeadSubmission = z.infer<typeof leadSubmissionSchema>;

/** A text preference without SMS consent falls back to a phone call. */
export function effectiveContactMethod(lead: Pick<LeadSubmission, "preferredContact" | "smsConsent">) {
  return lead.preferredContact === "text" && !lead.smsConsent ? "phone" : lead.preferredContact;
}
