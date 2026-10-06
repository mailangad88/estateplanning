import { z } from "zod";

/** Light-weight capture used by lead magnets, the email course, callbacks and questions. */
export const subscribeSchema = z.object({
  kind: z.enum(["magnet", "course", "newsletter", "callback", "question", "report"]),
  /** What they asked for: a checklist slug, tool slug, "course", etc. */
  interest: z.string().trim().min(1).max(120),
  email: z.email("Enter a valid email address").max(200),
  firstName: z.string().trim().max(80).optional(),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().regex(/^(1?\d{10})?$/, "Enter a 10-digit US phone number"))
    .optional(),
  state: z.string().trim().max(2).optional(),
  message: z.string().trim().max(2000).optional(),
  /** Tool results or answers the visitor chose to send with the request. */
  details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  smsConsent: z.boolean().default(false),
  pageUrl: z.string().max(500).optional(),
  website: z.string().max(0).optional(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
