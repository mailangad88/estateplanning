/** Builds the NurtureState the CRM keys its own automations on. Pure reads from the db. */
import { SENSITIVE_SEGMENTS, type NurtureState } from "@/server/crm/adapter";
import type { Db } from "@/server/db";
import { isSuppressed } from "@/server/nurture/compliance";
import { isGriefLead } from "@/server/nurture/scheduler";
import { STAGES } from "@/server/types";

/**
 * Letter group of a sequence, as in the template copy (A quiz follow-up, B guide download, C consult
 * booked, D consult held, E onboarding, F plan complete and reviews, G after a death). Speed-to-lead and
 * life-event tracks ride with A; no-show recovery with C. "long_term" is the unlettered newsletter track.
 */
export function sequenceGroup(sequenceId: string): string {
  if (sequenceId === "speed_to_lead" || sequenceId === "quiz_follow_up" || sequenceId.startsWith("life_event")) return "A";
  switch (sequenceId) {
    case "magnet_follow_up": return "B";
    case "consult_booked": case "no_show_recovery": return "C";
    case "consult_held_not_signed": return "D";
    case "signed_onboarding": return "E";
    case "plan_complete": case "review_request": case "annual_review": return "F";
    case "grief_support": return "G";
    default: return sequenceId;
  }
}

export async function buildNurtureState(db: Db, leadId: string): Promise<NurtureState | null> {
  const lead = await db.leads.get(leadId);
  const person = lead ? await db.persons.get(lead.personId) : undefined;
  if (!lead || !person) return null;
  const idx = STAGES.indexOf(lead.stage);
  const consults = await db.consults.list((c) => c.leadId === lead.id);
  const sequences = (await db.enrollments.list((e) => e.leadId === lead.id && e.status === "active")).map((e) => e.sequenceId);
  const emailSuppressed = await isSuppressed(db, "email", person);
  const smsSuppressed = await isSuppressed(db, "sms", person);
  const grief = isGriefLead(lead);
  const retainerSigned = idx >= STAGES.indexOf("retainer_signed");
  const consultHeld = idx >= STAGES.indexOf("consult_held") || consults.some((c) => c.status === "held");
  const consultBooked = idx >= STAGES.indexOf("consult_booked") || consults.some((c) => c.status === "booked");
  const lost = !!lead.exit && lead.exit.reason !== "unresponsive";
  return {
    contactEmail: person.email.trim().toLowerCase(),
    sequences,
    sequenceGroup: sequences[0] ? sequenceGroup(sequences[0]) : undefined,
    segments: lead.segments.filter((s) => !SENSITIVE_SEGMENTS.includes(s)),
    // Submitting the form with the no-relationship acknowledgement is the email opt-in we hold; SMS needs its own checkbox.
    emailConsent: lead.consent.acknowledgedNoRelationship === true,
    smsConsent: lead.consent.smsConsent === true,
    emailSuppressed,
    smsSuppressed,
    griefTrack: grief,
    consultBooked,
    consultHeld,
    retainerSigned,
    doNotMarket: grief || retainerSigned || lost || lead.segments.includes("partner_referral") || (emailSuppressed && smsSuppressed),
  };
}
