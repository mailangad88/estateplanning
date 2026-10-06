/**
 * Lead routing engine. Pure functions: callers load the data, this decides.
 *
 * Routing filters on hard requirements (licence, matter type, conflicts,
 * capacity, language), ranks on soft ones (distance, complexity fit,
 * performance) and rotates among ties so work is shared fairly. It never looks
 * at retention or signed rate: ranking on results would turn routing into
 * paying for results, which the fee structure forbids.
 */
import type { Assignment, Consult, Lawyer, Lead, Person, Specialty, Stage } from "@/server/types";
import { STAGES } from "@/server/types";

/** Editable weights. Each factor contributes at most its weight to the score. */
export const ROUTING_WEIGHTS = {
  /** Only used when the client needs an in-person meeting and both sides have coordinates */
  distance: 20,
  /** Distance in km at which the distance score reaches zero */
  distanceCutoffKm: 150,
  /** Per matching specialty, capped */
  specialtyMatch: 10,
  specialtyCap: 30,
  /** Accept speed: 0 minutes is best, `acceptSlowMinutes` or more scores zero */
  acceptSpeed: 10,
  acceptSlowMinutes: 120,
  showRate: 10,
  reviewScore: 10,
  reviewMax: 5,
  /** Scores closer than this count as tied, so rotation decides */
  tieEpsilon: 0.5,
};

export interface RoutingInput {
  lead: Lead;
  person: Pick<Person, "language">;
  /** Ids of other people with the same householdId, for keeping a household with one lawyer */
  householdPersonIds?: string[];
  lawyers: Lawyer[];
  /** All assignments, for declines on this lead and rotation history */
  assignments: Assignment[];
  /** All leads, for open-lead counts and household matching */
  leads: Lead[];
  consults: Consult[];
  now: Date;
}

export interface RankedLawyer {
  lawyerId: string;
  score: number;
  reason: string;
}

export interface ExcludedLawyer {
  lawyerId: string;
  reason: string;
}

export interface RoutingResult {
  ranked: RankedLawyer[];
  excluded: ExcludedLawyer[];
  /** Which special case decided the first position, if any */
  special?: "client_choice" | "urgent_on_call" | "returning_client" | "requested_lawyer" | "household";
}

const DAY_MS = 86_400_000;
const CLOSED_FROM = STAGES.indexOf("retainer_signed");

/** A lead occupies a lawyer's capacity from acceptance until the retainer is signed. */
function isOpenLead(l: Lead, lawyerId: string): boolean {
  return l.assignedLawyerId === lawyerId && !l.exit && STAGES.indexOf(l.stage as Stage) < CLOSED_FROM;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function needsTranslation(language: string): boolean {
  const l = language.trim().toLowerCase();
  return l !== "" && l !== "en" && !l.startsWith("english");
}

/** Hard filters. Returns the reason for exclusion, or undefined when eligible. */
export function hardFilter(lawyer: Lawyer, input: RoutingInput): string | undefined {
  const { lead, person, assignments, leads, consults, now } = input;
  if (!lawyer.active) return "Not active";
  if (!lawyer.licensedStates.includes(lead.state)) return `Not licensed in ${lead.state}`;
  if (lead.matterType === "administration") {
    // Probate runs through the court where the property sits.
    const missing = (lead.intake.assets.outOfStateStates ?? []).filter((s) => !lawyer.licensedStates.includes(s));
    if (missing.length) return `Not licensed in ${missing.join(", ")} (probate needs every state with property)`;
  }
  if (!lawyer.matterTypes.includes(lead.matterType)) return `Does not handle ${lead.matterType}`;
  if (lead.conflictCard.clearance === "conflict") return "Lead has a conflict";
  const prior = assignments.find((a) => a.leadId === lead.id && a.lawyerId === lawyer.id && (a.status === "declined" || a.status === "expired"));
  if (prior) return `Already ${prior.status} this lead`;
  const open = leads.filter((l) => isOpenLead(l, lawyer.id)).length;
  if (open >= lawyer.activeLeadCap) return `At active lead cap (${open}/${lawyer.activeLeadCap})`;
  const horizon = now.getTime() + 7 * DAY_MS;
  const booked = consults.filter(
    (c) => c.lawyerId === lawyer.id && c.status === "booked" && new Date(c.at).getTime() >= now.getTime() && new Date(c.at).getTime() <= horizon,
  ).length;
  if (booked >= lawyer.weeklyCapacity) return `At weekly consult capacity (${booked}/${lawyer.weeklyCapacity})`;
  if (needsTranslation(person.language) && !lawyer.languages.some((x) => x.toLowerCase() === person.language.trim().toLowerCase())) {
    return `Does not speak ${person.language}`;
  }
  return undefined;
}

/** Specialties this lead calls for, from intake answers and matter type. */
export function neededSpecialties(lead: Lead): Specialty[] {
  const a = lead.intake.answers;
  const out = new Set<Specialty>();
  if (a.specialNeeds === "yes" || lead.matterType === "special_needs") out.add("special_needs");
  if (lead.intake.assets.ownsBusiness || a.ownsBusiness === "yes" || lead.matterType === "business_succession") out.add("business_succession");
  if (a.blendedFamily === "yes") out.add("blended_family");
  if (lead.intake.assets.range === "over_5m" || a.assetRange === "over_5m") out.add("tax");
  if (lead.matterType === "elder_law") out.add("medicaid");
  if (lead.matterType === "administration") out.add("probate");
  return [...out];
}

function softScore(lawyer: Lawyer, lead: Lead): { score: number; parts: string[] } {
  const w = ROUTING_WEIGHTS;
  const parts: string[] = [];
  let score = 0;

  const client = lead.intake.clientLocation;
  if (lead.intake.needsInPerson && client && lawyer.office) {
    const km = haversineKm(client, lawyer.office);
    score += w.distance * Math.max(0, 1 - km / w.distanceCutoffKm);
    parts.push(`${Math.round(km)} km away`);
  }

  const matched = neededSpecialties(lead).filter((s) => lawyer.specialties.includes(s));
  if (matched.length) {
    score += Math.min(matched.length * w.specialtyMatch, w.specialtyCap);
    parts.push(`specialty fit: ${matched.join(", ")}`);
  }

  const { avgAcceptMinutes, showRate, reviewScore } = lawyer.stats;
  score += w.acceptSpeed * (1 - Math.min(Math.max(avgAcceptMinutes, 0), w.acceptSlowMinutes) / w.acceptSlowMinutes);
  score += w.showRate * Math.min(Math.max(showRate, 0), 1);
  score += w.reviewScore * (Math.min(Math.max(reviewScore, 0), w.reviewMax) / w.reviewMax);
  parts.push(`accepts in ~${Math.round(avgAcceptMinutes)} min, ${Math.round(showRate * 100)}% show rate, ${reviewScore.toFixed(1)} rating`);
  return { score, parts };
}

/** Time of the lawyer's most recent offer; 0 if never offered, so they go first. */
function lastOfferedAt(lawyerId: string, assignments: Assignment[]): number {
  let t = 0;
  for (const a of assignments) if (a.lawyerId === lawyerId) t = Math.max(t, new Date(a.offeredAt).getTime());
  return t;
}

export function rankLawyers(input: RoutingInput): RoutingResult {
  const { lead, lawyers, assignments, leads } = input;
  const excluded: ExcludedLawyer[] = [];
  const eligible: Lawyer[] = [];

  const choice = lead.clientChoiceLawyerIds;
  const pool = choice?.length ? choice.map((id) => lawyers.find((l) => l.id === id)).filter((l): l is Lawyer => !!l) : lawyers;
  if (choice?.length) {
    for (const id of choice) if (!lawyers.some((l) => l.id === id)) excluded.push({ lawyerId: id, reason: "Unknown lawyer" });
  }
  // Lawyers the client did not pick are not candidates, so they are not listed as excluded.
  for (const l of pool) {
    const why = hardFilter(l, input);
    if (why) excluded.push({ lawyerId: l.id, reason: why });
    else eligible.push(l);
  }

  if (choice?.length) {
    // The client's own order is the ranking.
    const ranked = eligible.map((l) => ({ lawyerId: l.id, score: 0, reason: `Client choice, position ${choice.indexOf(l.id) + 1}` }));
    ranked.sort((a, b) => choice.indexOf(a.lawyerId) - choice.indexOf(b.lawyerId));
    return { ranked, excluded, special: ranked.length ? "client_choice" : undefined };
  }

  const scored = eligible.map((l) => {
    const { score, parts } = softScore(l, lead);
    return { lawyer: l, score, parts, last: lastOfferedAt(l.id, assignments) };
  });
  scored.sort((a, b) => {
    if (Math.abs(a.score - b.score) > ROUTING_WEIGHTS.tieEpsilon) return b.score - a.score;
    if (a.last !== b.last) return a.last - b.last; // round robin: least recently offered first
    return a.lawyer.id < b.lawyer.id ? -1 : a.lawyer.id > b.lawyer.id ? 1 : 0;
  });

  let ranked: RankedLawyer[] = scored.map((s, i) => ({
    lawyerId: s.lawyer.id,
    score: Math.round(s.score * 10) / 10,
    reason: `Rank ${i + 1}, score ${s.score.toFixed(1)}: ${s.parts.join("; ")}`,
  }));

  // Special cases are checked before normal ranking and pull one lawyer to the front.
  const householdIds = new Set(input.householdPersonIds ?? []);
  const householdLawyer = householdIds.size
    ? leads.find((l) => l.id !== lead.id && l.assignedLawyerId && householdIds.has(l.personId))?.assignedLawyerId
    : undefined;
  const candidates: [RoutingResult["special"], string | undefined, string][] = [
    ["urgent_on_call", lead.urgent ? ranked.find((r) => eligible.find((l) => l.id === r.lawyerId)?.onCall)?.lawyerId : undefined, "Urgent lead, on-call attorney"],
    ["returning_client", lead.previousLawyerId, "Returning client, prior attorney"],
    ["requested_lawyer", lead.requestedLawyerId, "Partner referral named this attorney"],
    ["household", householdLawyer, "Household member already with this attorney"],
  ];
  for (const [special, id, why] of candidates) {
    if (id && ranked.some((r) => r.lawyerId === id)) {
      const front = ranked.find((r) => r.lawyerId === id)!;
      ranked = [{ ...front, reason: `${why}. ${front.reason}` }, ...ranked.filter((r) => r.lawyerId !== id)];
      return { ranked, excluded, special };
    }
  }
  return { ranked, excluded };
}

export interface ClientChoiceOption {
  lawyerId: string;
  name: string;
  bio?: string;
}

/** Up to three eligible lawyers to show the client, best ranked first. */
export function eligibleForClientChoice(input: RoutingInput): ClientChoiceOption[] {
  const { ranked } = rankLawyers({ ...input, lead: { ...input.lead, clientChoiceLawyerIds: undefined } });
  return ranked.slice(0, 3).flatMap((r) => {
    const l = input.lawyers.find((x) => x.id === r.lawyerId);
    return l ? [{ lawyerId: l.id, name: l.name, bio: l.bio }] : [];
  });
}
