/**
 * Which CRM stage changes become ad-platform conversions, what they are called on each platform,
 * and which leads may be reported at all. Pure except for the reads of suppressions and engagements.
 *
 * Rules (research/paid-ads-strategy.md section 11, tech-stack-and-vendors.md section 10):
 * - Only leads that arrived through a Google or Meta ad (a click id is stored) are reported to that platform.
 * - Only generic stage names and a fee value leave the system. Never matter details, health or sensitive segments.
 * - Leads that said no to ad measurement, or asked not to be contacted at all, are skipped.
 */
import { SENSITIVE_SEGMENTS } from "@/server/crm/adapter";
import type { Db } from "@/server/db";
import { normalizeAddress } from "@/server/nurture/compliance";
import { isGriefLead } from "@/server/nurture/scheduler";
import { STAGES, type ConversionProvider, type ConversionType, type Lead, type MatterType, type Person, type Stage } from "@/server/types";

export const CONVERSION_TYPES: ConversionType[] = ["qualified_lead", "consult_booked", "consult_held", "retainer_signed"];
export const CONVERSION_PROVIDERS: ConversionProvider[] = ["google_ads", "meta"];
export const CONVERSION_CURRENCY = "USD";

/** The first stage at or past which each conversion is true. Skipping a stage still counts. */
export const CONVERSION_STAGE: Record<ConversionType, Stage> = {
  qualified_lead: "qualified",
  consult_booked: "consult_booked",
  consult_held: "consult_held",
  retainer_signed: "retainer_signed",
};

/**
 * Conversion action names. In Google Ads these must match conversion actions created in the account
 * (Goals > Conversions > Uploads), so edit here if the account uses other names.
 */
export const GOOGLE_CONVERSION_NAMES: Record<ConversionType, string> = {
  qualified_lead: "EP Qualified Lead",
  consult_booked: "EP Consult Booked",
  consult_held: "EP Consult Held",
  retainer_signed: "EP Retainer Signed",
};

/** Meta standard events where one fits (Lead, Schedule, Purchase per the ads strategy), custom otherwise. */
export const META_EVENT_NAMES: Record<ConversionType, string> = {
  qualified_lead: "Lead",
  consult_booked: "Schedule",
  consult_held: "ConsultHeld",
  retainer_signed: "Purchase",
};

/** Meta rejects events older than 7 days. Google accepts conversions up to 90 days after the click. */
export const MAX_AGE_DAYS: Record<ConversionProvider, number> = { meta: 7, google_ads: 90 };

export const conversionRowId = (provider: ConversionProvider, type: ConversionType, leadId: string) => `${provider}:${type}:${leadId}`;
/** Dedupe key for Meta (event_name plus event_id). Stable per lead and conversion, so a resend never double counts. */
export const conversionEventId = (type: ConversionType, leadId: string) => `ep-${leadId}-${type}`;

// Click ids come from the URL, so only well-formed values are ever used (this also keeps junk out of CSV files).
const CLICK_ID = /^[A-Za-z0-9_-]{8,300}$/;
const FBC = /^fb\.\d\.\d{10,13}\.[A-Za-z0-9_-]{4,300}$/;
const FBP = /^fb\.\d\.\d{10,13}\.\d{4,20}$/;

export interface ClickIds {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbc?: string;
  fbp?: string;
}

/** Meta _fbc from a bare fbclid, per Meta's format: fb.<subdomain index>.<creation time in ms>.<fbclid>. */
export function fbcFromFbclid(fbclid: string, receivedAt: string): string {
  return `fb.1.${Date.parse(receivedAt)}.${fbclid}`;
}

/** Validated click ids stored on the lead's source. */
export function clickIds(lead: Pick<Lead, "source" | "createdAt">): ClickIds {
  const s = lead.source;
  const ok = (v: string | undefined, re: RegExp) => (v && re.test(v.trim()) ? v.trim() : undefined);
  const fbclid = ok(s.fbclid, CLICK_ID);
  return {
    gclid: ok(s.gclid, CLICK_ID),
    gbraid: ok(s.gbraid, CLICK_ID),
    wbraid: ok(s.wbraid, CLICK_ID),
    fbc: ok(s.fbc, FBC) ?? (fbclid ? fbcFromFbclid(fbclid, lead.createdAt) : undefined),
    fbp: ok(s.fbp, FBP),
  };
}

/** The ad platforms this lead can be reported to, by the click ids stored on its source. */
export function platformsFor(lead: Pick<Lead, "source" | "createdAt">): ConversionProvider[] {
  const ids = clickIds(lead);
  const out: ConversionProvider[] = [];
  if (ids.gclid || ids.gbraid || ids.wbraid) out.push("google_ads");
  if (ids.fbc || ids.fbp) out.push("meta");
  return out;
}

/** Matter types whose existence is itself sensitive (a death, a disability, long-term care). */
const SENSITIVE_MATTERS: MatterType[] = ["administration", "special_needs", "elder_law"];

export function isSensitiveLead(lead: Pick<Lead, "segments" | "matterType" | "capture">): boolean {
  return (
    lead.segments.some((s) => SENSITIVE_SEGMENTS.includes(s)) ||
    SENSITIVE_MATTERS.includes(lead.matterType) ||
    lead.capture?.result?.mode === "heir" ||
    isGriefLead(lead)
  );
}

/** Why this lead must not be reported, or undefined when it may be. Checked again at send time. */
export async function conversionBlock(db: Db, lead: Lead, person: Person | undefined): Promise<string | undefined> {
  if (isSensitiveLead(lead)) return "sensitive_segment";
  if (lead.consent.marketingConsent === false) return "no_ads_consent";
  if (person) {
    for (const a of [person.email, person.phone]) {
      if (a && (await db.suppressions.get(`all:${normalizeAddress("all", a)}`))) return "do_not_contact";
    }
  }
  return undefined;
}

/** When each conversion first became true, from the stage history (earliest entry at or past the stage). */
export function conversionTimes(lead: Pick<Lead, "stageHistory">): Partial<Record<ConversionType, string>> {
  const out: Partial<Record<ConversionType, string>> = {};
  for (const type of CONVERSION_TYPES) {
    const idx = STAGES.indexOf(CONVERSION_STAGE[type]);
    const hits = lead.stageHistory.filter((h) => STAGES.indexOf(h.stage) >= idx).map((h) => h.at).sort();
    if (hits.length) out[type] = hits[0];
  }
  return out;
}

const SIGNED = ["signed", "paid", "countersigned"];

/** Engagement fee in cents once a retainer is signed, when known. */
export async function engagementFeeCents(db: Db, leadId: string): Promise<number | undefined> {
  const signed = (await db.engagements.list((e) => SIGNED.includes(e.status) && e.feeCents > 0, { leadId }));
  if (!signed.length) return undefined;
  const at = (e: (typeof signed)[number]) => e.history.filter((h) => SIGNED.includes(h.status)).map((h) => h.at).sort().at(-1) ?? "";
  return signed.sort((a, b) => at(b).localeCompare(at(a)))[0].feeCents;
}
