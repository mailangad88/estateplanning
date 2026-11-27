/**
 * Leads that staff enter by hand from the portal (/portal/leads/new): a phone call, a walk-in, a referral
 * from someone the firm knows, an event. The lead goes through the same ingest as a website submission
 * (person de-duplication, scoring, the conflict card), then:
 *   - an attorney's own entry is assigned to them straight away (they took the call)
 *   - a firm admin picks one of their firm's attorneys
 *   - a platform admin or intake can pick any attorney, send it to routing, or leave it in the queue
 * No marketing is started and no consent is claimed: the person has not signed up for anything themselves.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { servedStates, US_STATES } from "@/config/firm";
import { buildConsentRecord } from "@/lib/consent";
import type { LeadRecord } from "@/lib/crm";
import { HEARD_FROM_VALUES } from "@/lib/heardFrom";
import type { QuizAnswers } from "@/lib/quiz";
import { scoreLead } from "@/lib/scoring";
import { audit } from "@/server/audit/log";
import { assertCan, can, ForbiddenError, requireMfa } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { addComment } from "@/server/services/caseWork";
import { ingestLead } from "@/server/services/leads";
import { offerNext } from "@/server/services/routing";
import type { Actor, Lawyer, Lead } from "@/server/types";

export const ENTRY_CHANNELS = [
  { value: "phone_call", label: "Phone call" },
  { value: "walk_in", label: "Walk-in" },
  { value: "referral", label: "Referred by someone" },
  { value: "event", label: "Seminar or event" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
] as const;
export type EntryChannel = (typeof ENTRY_CHANNELS)[number]["value"];
export const MANUAL_SEGMENT = "manual_entry";

const opt = <T extends readonly [string, ...string[]]>(values: T) => z.preprocess((v) => (v === "" ? undefined : v), z.enum(values).optional());
const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);

export const manualLeadSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter a first name").max(80),
    lastName: z.string().trim().max(80).default(""),
    phone: z.string().trim().max(30).default(""),
    email: z.union([z.literal(""), z.email("Enter a valid email address").max(200)]).default(""),
    state: z.enum(US_STATES, "Pick a state").default("IL"),
    county: text(60),
    channel: z.enum(ENTRY_CHANNELS.map((c) => c.value) as [EntryChannel, ...EntryChannel[]]).default("phone_call"),
    heardFrom: opt(HEARD_FROM_VALUES),
    referredBy: text(120),
    contactMethod: z.enum(["phone", "text", "email"]).default("phone"),
    matterType: opt(["new_plan", "update_plan", "after_death", "elder_care", "not_sure"] as const),
    maritalStatus: opt(["single", "married", "partnered", "divorced", "widowed"] as const),
    children: opt(["none", "minors", "adults", "both"] as const),
    specialNeeds: opt(["yes", "no"] as const),
    ownsHome: opt(["yes", "no"] as const),
    ownsBusiness: opt(["yes", "no"] as const),
    outOfStateProperty: opt(["yes", "no"] as const),
    assetRange: opt(["under_250k", "250k_1m", "1m_5m", "over_5m", "prefer_not"] as const),
    existingDocuments: opt(["none", "will_only", "trust", "not_sure"] as const),
    urgency: opt(["exploring", "this_month", "health_event", "recent_death"] as const),
    notes: text(2000),
    /** "" leaves it in the intake queue, "auto" sends it to routing, otherwise a lawyer id */
    assignTo: z.string().trim().max(80).default(""),
  })
  .superRefine((v, ctx) => {
    const digits = v.phone.replace(/\D/g, "");
    if (v.phone && !(digits.length === 10 || (digits.length === 11 && digits.startsWith("1")))) ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a 10-digit US phone number" });
    if (!v.phone && !v.email) ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a phone number or an email" });
  });
export type ManualLeadInput = z.input<typeof manualLeadSchema>;

/** The attorneys this person may hand a new lead to. An attorney only ever gets themselves. */
export async function assignableLawyers(db: Db, actor: Actor): Promise<Pick<Lawyer, "id" | "name" | "firmId">[]> {
  if (!can(actor, "create_lead")) return [];
  const all = (await db.lawyers.list((l) => l.active)).map((l) => ({ id: l.id, name: l.name, firmId: l.firmId }));
  if (actor.role === "attorney") return all.filter((l) => l.id === actor.lawyerId);
  if (actor.role === "firm_admin") return all.filter((l) => !!actor.firmId && l.firmId === actor.firmId);
  return all;
}

/** Who-handles-it choices for the form: the lawyers, plus routing and the queue where this role may use them. */
export function assignChoices(actor: Actor): { queue: boolean; auto: boolean } {
  const office = actor.role === "platform_admin" || actor.role === "intake";
  return { queue: office, auto: office };
}

export async function createManualLead(db: Db, actor: Actor, raw: Record<string, unknown>, now = new Date()): Promise<Lead> {
  requireMfa(actor);
  assertCan(can(actor, "create_lead"), "You cannot add leads");
  const parsed = manualLeadSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the form");
  const v = parsed.data;

  const lawyers = await assignableLawyers(db, actor);
  const choices = assignChoices(actor);
  let assignTo = v.assignTo;
  if (actor.role === "attorney") assignTo = actor.lawyerId ?? "";
  const lawyer = assignTo && assignTo !== "auto" ? lawyers.find((l) => l.id === assignTo) : undefined;
  if (assignTo && assignTo !== "auto" && !lawyer) throw new ForbiddenError("You cannot assign a lead to that attorney");
  if (assignTo === "auto" && !choices.auto) throw new ForbiddenError("Pick an attorney");
  if (!assignTo && !choices.queue) throw new Error("Pick an attorney to handle this lead");

  const answers: Partial<QuizAnswers> = {};
  for (const k of ["matterType", "maritalStatus", "children", "specialNeeds", "ownsHome", "ownsBusiness", "outOfStateProperty", "assetRange", "existingDocuments", "urgency"] as const) {
    if (v[k]) (answers as Record<string, string>)[k] = v[k]!;
  }
  const pageUrl = "portal:/portal/leads/new";
  const record: LeadRecord = {
    id: randomUUID(),
    receivedAt: now.toISOString(),
    contact: { firstName: v.firstName, lastName: v.lastName, email: v.email, phone: v.phone, state: v.state, county: v.county, language: "English" },
    contactMethod: v.contactMethod,
    goals: v.notes,
    answers,
    score: scoreLead({ state: v.state, servedStates: servedStates(), answers, goals: v.notes, smsConsent: false, capture: { tool: "intake" } }),
    segments: [MANUAL_SEGMENT, `entered:${v.channel}`],
    source: { utmSource: "staff_entry", utmMedium: v.channel, ...(v.heardFrom ? { heardFrom: v.heardFrom } : {}), ...(v.referredBy ? { referrer: v.referredBy } : {}) },
    heardFrom: v.heardFrom,
    capture: { tool: "intake", result: { manualEntry: true, channel: v.channel } },
    priorTools: [],
    // Entered by staff: the person has not seen the site's notices or agreed to texts.
    consent: buildConsentRecord({ smsConsent: false, acknowledgedNoRelationship: false, pageUrl, ip: null, userAgent: null, now }),
  };
  let lead = await ingestLead(db, record, now, { skipPartnerAttribution: true });
  const at = now.toISOString();
  // They already spoke with someone at the firm.
  if (v.channel === "phone_call" || v.channel === "walk_in") {
    lead = await db.leads.update(lead.id, { stage: "contacted", stageHistory: [...lead.stageHistory, { stage: "contacted", at, by: actor.userId }] });
  }
  await audit(db, actor, { action: "lead.manual_create", resourceType: "lead", resourceId: lead.id, leadId: lead.id, detail: { channel: v.channel, assign: lawyer ? "lawyer" : assignTo || "queue" }, at: now });

  if (lead.exit) return lead;
  if (lawyer) {
    await db.assignments.insert({
      id: randomUUID(),
      leadId: lead.id,
      lawyerId: lawyer.id,
      firmId: lawyer.firmId,
      offeredAt: at,
      expiresAt: at,
      respondedAt: at,
      status: "accepted",
      slaMet: true,
      routingReason: actor.role === "attorney" ? "Entered by the attorney" : `Assigned by hand when entered (${actor.role.replaceAll("_", " ")})`,
    });
    lead = await db.leads.update(lead.id, {
      assignedLawyerId: lawyer.id,
      firmId: lawyer.firmId,
      stage: "accepted",
      stageHistory: [...lead.stageHistory, { stage: "accepted", at, by: actor.userId }],
    });
    await audit(db, actor, { action: "routing.assign_manual", resourceType: "lead", resourceId: lead.id, leadId: lead.id, detail: { lawyerId: lawyer.id }, at: now });
  } else if (assignTo === "auto") {
    try {
      await offerNext(db, lead.id, now);
    } catch (err) {
      console.error("manual lead routing failed", { id: lead.id, error: err instanceof Error ? err.message : String(err) });
    }
    lead = (await db.leads.get(lead.id))!;
  }
  if (v.notes) await addComment(db, actor, { leadId: lead.id, body: `Entered by hand (${ENTRY_CHANNELS.find((c) => c.value === v.channel)!.label.toLowerCase()}).\n\n${v.notes}`, visibility: lead.assignedLawyerId ? "firm" : "internal" }, now).catch((err) =>
    console.error("manual lead note failed", { id: lead.id, error: err instanceof Error ? err.message : String(err) }),
  );
  return lead;
}
