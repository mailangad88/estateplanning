/**
 * Seminar economics tracker (backlog C17). Each event records its costs and the
 * RSVP and attendance counts entered afterwards; leads attribute through the
 * event code (utm_campaign on invitations and registration links, or a
 * "seminar:<code>" tag). The readout is counts and money only, never people.
 *
 * Research base case (research/competitor-ads-and-funnels.md section 6): cost per
 * signed client roughly $650 to $2,900 across scenarios. The readout states which
 * side of that band a real event landed on.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { audit } from "@/server/audit/log";
import { assertCan, can, requireMfa } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { type Actor, type Lead, type Seminar, STAGES, type Stage } from "@/server/types";

export const SEMINAR_CAC_BAND_CENTS = { low: 65_000, high: 290_000 };

const code = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,48}$/, "Use letters, numbers and dashes for the code");
const cents = z.number().int().min(0).max(100_000_000);

export const seminarInput = z.object({
  code,
  title: z.string().trim().min(2).max(200),
  format: z.enum(["in_person", "webinar", "library_talk"]),
  heldOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  venue: z.string().trim().max(200).optional(),
  costs: z.record(z.string().trim().min(1).max(40), cents).default({}),
  mailPieces: z.number().int().min(0).max(10_000_000).optional(),
  rsvps: z.number().int().min(0).max(100_000).default(0),
  attendees: z.number().int().min(0).max(100_000).default(0),
  notes: z.string().max(2000).optional(),
});
export type SeminarInput = z.input<typeof seminarInput>;

export const seminarUpdate = seminarInput.omit({ code: true }).partial();

export async function createSeminar(db: Db, actor: Actor, input: SeminarInput, now = new Date()): Promise<Seminar> {
  requireMfa(actor);
  assertCan(can(actor, "manage_seminars"));
  const v = seminarInput.parse(input);
  if (v.attendees > v.rsvps && v.rsvps > 0) throw new Error("Attendees cannot exceed RSVPs; enter walk-ins as RSVPs too");
  if ((await db.seminars.list((s) => s.code === v.code, { code: v.code })).length) throw new Error("That code is already used by another event");
  const at = now.toISOString();
  const seminar = await db.seminars.insert({ id: randomUUID(), ...v, createdBy: actor.userId, createdAt: at, updatedAt: at });
  await audit(db, actor, { action: "seminar.create", resourceType: "seminar", resourceId: seminar.id, detail: { code: v.code }, at: now });
  return seminar;
}

export async function updateSeminar(db: Db, actor: Actor, id: string, patch: z.input<typeof seminarUpdate>, now = new Date()): Promise<Seminar> {
  requireMfa(actor);
  assertCan(can(actor, "manage_seminars"));
  const prev = await db.seminars.get(id);
  if (!prev) throw new Error("Event not found");
  const v = seminarUpdate.parse(patch);
  const rsvps = v.rsvps ?? prev.rsvps;
  const attendees = v.attendees ?? prev.attendees;
  if (attendees > rsvps && rsvps > 0) throw new Error("Attendees cannot exceed RSVPs; enter walk-ins as RSVPs too");
  const next = await db.seminars.update(id, { ...v, updatedAt: now.toISOString() });
  await audit(db, actor, { action: "seminar.update", resourceType: "seminar", resourceId: id, detail: { fields: Object.keys(v) }, at: now });
  return next;
}

export function attributesTo(lead: Pick<Lead, "source" | "segments">, seminarCode: string): boolean {
  const c = seminarCode.toLowerCase();
  return lead.source.utmCampaign?.toLowerCase() === c || lead.segments.includes(`seminar:${c}`);
}

export interface SeminarReadout {
  seminar: Seminar;
  totalCostCents: number;
  leads: number;
  consultsBooked: number;
  consultsHeld: number;
  signed: number;
  /** Fees on signed or paid engagements for attributed leads */
  feesCents: number;
  showRate: number | null;
  costPerRsvpCents: number | null;
  costPerAttendeeCents: number | null;
  /** Leads per attendee: how many attendees asked for a consult or plan review */
  attendeeToLead: number | null;
  cacCents: number | null;
  /** Fees divided by cost; null until something is signed */
  returnOnCost: number | null;
  verdict: string;
}

const reached = (lead: Lead, stage: Stage) =>
  STAGES.indexOf(lead.stage as Stage) >= STAGES.indexOf(stage) || lead.stageHistory.some((h) => h.stage === stage);

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/**
 * Readouts for every event. Marketing cannot read individual leads, so this is
 * called with the service store after the permission check and returns totals only.
 */
export async function seminarReadouts(db: Db, actor: Actor): Promise<SeminarReadout[]> {
  requireMfa(actor);
  assertCan(can(actor, "manage_seminars"));
  const seminars = (await db.seminars.list()).sort((a, b) => b.heldOn.localeCompare(a.heldOn));
  if (!seminars.length) return [];
  const leads = await db.leads.list();
  const engagements = await db.engagements.list((e) => e.status === "signed" || e.status === "paid" || e.status === "countersigned");
  return seminars.map((seminar) => {
    const mine = leads.filter((l) => attributesTo(l, seminar.code));
    const ids = new Set(mine.map((l) => l.id));
    const totalCostCents = Object.values(seminar.costs).reduce((s, c) => s + c, 0);
    const signed = mine.filter((l) => reached(l, "retainer_signed")).length;
    const feesCents = engagements.filter((e) => ids.has(e.leadId)).reduce((s, e) => s + e.feeCents, 0);
    const cacCents = signed ? Math.round(totalCostCents / signed) : null;
    let verdict: string;
    if (seminar.attendees === 0 && mine.length === 0) verdict = "Enter RSVPs and attendance after the event to see its economics.";
    else if (cacCents === null) verdict = "No signed clients yet. Consults usually close over the following weeks.";
    else if (cacCents <= SEMINAR_CAC_BAND_CENTS.low) verdict = "Cheaper per signed client than the research range. Worth repeating.";
    else if (cacCents <= SEMINAR_CAC_BAND_CENTS.high) verdict = "Inside the research range for seminars. Compare with paid search before scaling.";
    else verdict = "Above the research range. Change the list, the offer or the format before running it again.";
    return {
      seminar,
      totalCostCents,
      leads: mine.length,
      consultsBooked: mine.filter((l) => reached(l, "consult_booked")).length,
      consultsHeld: mine.filter((l) => reached(l, "consult_held")).length,
      signed,
      feesCents,
      showRate: ratio(seminar.attendees, seminar.rsvps),
      costPerRsvpCents: seminar.rsvps ? Math.round(totalCostCents / seminar.rsvps) : null,
      costPerAttendeeCents: seminar.attendees ? Math.round(totalCostCents / seminar.attendees) : null,
      attendeeToLead: ratio(mine.length, seminar.attendees),
      cacCents,
      returnOnCost: signed && totalCostCents ? feesCents / totalCostCents : null,
      verdict,
    };
  });
}
