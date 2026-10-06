/**
 * Builds the rows each platform wants: Google Ads offline click conversions (with enhanced conversions
 * for leads: SHA-256 of normalized email and phone) and Meta Conversions API events. Pure functions,
 * no network. Plain-text contact details never leave this file: only hashes are returned.
 */
import { createHash } from "node:crypto";
import { clickIds, CONVERSION_CURRENCY, GOOGLE_CONVERSION_NAMES, META_EVENT_NAMES, conversionEventId } from "@/server/conversions/events";
import type { ConversionType, Lead, Person } from "@/server/types";

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** Google: trim, lowercase, and drop dots from the part before @ for gmail.com and googlemail.com. */
export function normalizeEmailForGoogle(email: string): string | undefined {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1 || at === e.length - 1) return undefined;
  const domain = e.slice(at + 1);
  const local = domain === "gmail.com" || domain === "googlemail.com" ? e.slice(0, at).replace(/\./g, "") : e.slice(0, at);
  return `${local}@${domain}`;
}

export function normalizeEmailForMeta(email: string): string | undefined {
  const e = email.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(e) ? e : undefined;
}

/** US numbers only (the form only accepts those): "+1XXXXXXXXXX" (E.164), or undefined when it is not a full number. */
export function e164(phone: string): string | undefined {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return undefined;
}

/** "2026-10-06 14:03:21-05:00": Google's conversion time format, in the given IANA zone (UTC by default). */
export function googleTime(iso: string, timeZone = "UTC"): string {
  const at = new Date(iso);
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  const offsetMin = Math.round((local - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
  const sign = offsetMin < 0 ? "-" : "+";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}${sign}${hh}:${mm}`;
}

export interface ConversionInput {
  lead: Lead;
  person: Person;
  type: ConversionType;
  occurredAt: string;
  valueCents?: number;
}

export interface GoogleConversionRow {
  /** Exactly one of the three click ids, in the order gclid, gbraid, wbraid (Google takes one per row). */
  clickIdKind: "gclid" | "gbraid" | "wbraid";
  clickId: string;
  conversionName: string;
  /** "yyyy-mm-dd hh:mm:ss+hh:mm" */
  conversionTime: string;
  /** Dollars, or absent when no fee is known */
  value?: number;
  currency: string;
  /** Dedupe key (Google drops a second upload with the same order id for the same action). */
  orderId: string;
  hashedEmail?: string;
  hashedPhone?: string;
}

export function googleRow(i: ConversionInput, timeZone = "UTC"): GoogleConversionRow | undefined {
  const ids = clickIds(i.lead);
  const kind = ids.gclid ? "gclid" : ids.gbraid ? "gbraid" : ids.wbraid ? "wbraid" : undefined;
  if (!kind) return undefined;
  const email = normalizeEmailForGoogle(i.person.email);
  const phone = e164(i.person.phone);
  return {
    clickIdKind: kind,
    clickId: ids[kind]!,
    conversionName: GOOGLE_CONVERSION_NAMES[i.type],
    conversionTime: googleTime(i.occurredAt, timeZone),
    ...(i.valueCents !== undefined ? { value: i.valueCents / 100 } : {}),
    currency: CONVERSION_CURRENCY,
    orderId: conversionEventId(i.type, i.lead.id),
    ...(email ? { hashedEmail: sha256(email) } : {}),
    ...(phone ? { hashedPhone: sha256(phone) } : {}),
  };
}

export interface MetaEvent {
  event_name: string;
  /** Unix seconds */
  event_time: number;
  /** With event_name, the dedupe key */
  event_id: string;
  /** "system_generated" for CRM events; "physical_store" for a consult held in the office. */
  action_source: "system_generated" | "physical_store";
  user_data: {
    em?: string[];
    ph?: string[];
    fn?: string[];
    ln?: string[];
    st?: string[];
    country?: string[];
    external_id?: string[];
    fbc?: string;
    fbp?: string;
  };
  custom_data: { currency: string; value?: number; event_source: "crm"; lead_event_source: string };
}

export const META_LEAD_EVENT_SOURCE = "Estate Planning CRM";

export function metaEvent(i: ConversionInput, opts: { inPerson?: boolean } = {}): MetaEvent | undefined {
  const ids = clickIds(i.lead);
  if (!ids.fbc && !ids.fbp) return undefined;
  const email = normalizeEmailForMeta(i.person.email);
  const phone = i.person.phone.replace(/\D/g, "");
  const ph = phone.length === 10 ? `1${phone}` : phone.length === 11 && phone.startsWith("1") ? phone : undefined;
  const h = (v: string | undefined) => (v && v.trim() ? [sha256(v.trim().toLowerCase())] : undefined);
  const user_data: MetaEvent["user_data"] = {
    ...(email ? { em: [sha256(email)] } : {}),
    ...(ph ? { ph: [sha256(ph)] } : {}),
    ...(h(i.person.firstName) ? { fn: h(i.person.firstName) } : {}),
    ...(h(i.person.lastName) ? { ln: h(i.person.lastName) } : {}),
    ...(h(i.person.state) ? { st: h(i.person.state) } : {}),
    country: [sha256("us")],
    external_id: [sha256(i.lead.id)],
    ...(ids.fbc ? { fbc: ids.fbc } : {}),
    ...(ids.fbp ? { fbp: ids.fbp } : {}),
  };
  return {
    event_name: META_EVENT_NAMES[i.type],
    event_time: Math.floor(Date.parse(i.occurredAt) / 1000),
    event_id: conversionEventId(i.type, i.lead.id),
    action_source: opts.inPerson ? "physical_store" : "system_generated",
    user_data,
    custom_data: {
      currency: CONVERSION_CURRENCY,
      ...(i.valueCents !== undefined ? { value: i.valueCents / 100 } : {}),
      event_source: "crm",
      lead_event_source: META_LEAD_EVENT_SOURCE,
    },
  };
}

// ---------- CSV (manual upload) ----------

function cell(v: string | number | undefined): string {
  const s = v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csv = (rows: (string | number | undefined)[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

const GOOGLE_ID_COLUMN = { gclid: "Google Click ID", gbraid: "GBRAID", wbraid: "WBRAID" } as const;

/**
 * Google Ads manual upload file (Goals > Conversions > Uploads). Google wants one kind of click id per file,
 * so pass the kind. Email and phone columns carry SHA-256 hashes for enhanced conversions for leads.
 */
export function googleCsv(rows: GoogleConversionRow[], kind: "gclid" | "gbraid" | "wbraid" = "gclid"): string {
  return csv([
    [GOOGLE_ID_COLUMN[kind], "Conversion Name", "Conversion Time", "Conversion Value", "Conversion Currency", "Order ID", "Email", "Phone Number"],
    ...rows.filter((r) => r.clickIdKind === kind).map((r) => [r.clickId, r.conversionName, r.conversionTime, r.value, r.currency, r.orderId, r.hashedEmail, r.hashedPhone]),
  ]);
}

/** Meta Events Manager offline file: hashed identifiers, Unix event time, and the same event_id used by the API path. */
export function metaCsv(events: MetaEvent[]): string {
  return csv([
    ["event_name", "event_time", "event_id", "action_source", "email", "phone", "fn", "ln", "st", "country", "external_id", "fbc", "fbp", "value", "currency"],
    ...events.map((e) => [
      e.event_name, e.event_time, e.event_id, e.action_source, e.user_data.em?.[0], e.user_data.ph?.[0], e.user_data.fn?.[0], e.user_data.ln?.[0],
      e.user_data.st?.[0], e.user_data.country?.[0], e.user_data.external_id?.[0], e.user_data.fbc, e.user_data.fbp, e.custom_data.value, e.custom_data.currency,
    ]),
  ]);
}
