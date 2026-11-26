/**
 * Compliance guards for nurture sends: copy linting (no AI slop, no uncited
 * claims), sensitive-content rules for channels that show previews, quiet
 * hours, frequency caps and opt-out handling. Pure functions except applyOptOut.
 */
import type { Db } from "@/server/db";
import { audit } from "@/server/audit/log";
import type { Channel, Suppression } from "@/server/nurture/types";

// ---------- Copy linting ----------

export const BANNED_PHRASES = [
  "navigate the complexities",
  "navigating the complexities",
  // Always flagged. An editor can override when it is followed by a concrete, specific fact.
  "peace of mind",
  "in today's world",
  "in today's fast-paced",
  "ever-changing landscape",
  "delve",
  "unlock",
  "seamless",
  "tailored solutions",
  "it's important to note",
  "game-changer",
  "rest assured",
  "at the end of the day",
  "comprehensive solution",
  "holistic approach",
  "leverage",
  "empower",
  "embark on",
  "tapestry",
] as const;

export const EDUCATIONAL_DISCLAIMER =
  "This is educational information, not legal advice. Reading it does not create an attorney-client relationship.";

export interface LintIssue {
  phrase: string;
  /** Character index in the text; -1 for whole-piece issues. */
  index: number;
  kind: "banned_phrase" | "missing_disclaimer" | "missing_citation";
}

export interface LintOptions {
  /** Pass the copy object's citations. When provided, an empty list is an issue. */
  brainFileEntryIds?: string[];
  /** Defaults to true. SMS and call scripts can turn it off. */
  requireDisclaimer?: boolean;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function lintCopy(text: string, opts: LintOptions = {}): { ok: boolean; issues: LintIssue[] } {
  const issues: LintIssue[] = [];
  const norm = text.replace(/[‘’]/g, "'"); // same length, keeps indices valid
  for (const phrase of BANNED_PHRASES) {
    const re = new RegExp(`\\b${escapeRe(phrase)}\\w*`, "gi");
    for (const m of norm.matchAll(re)) issues.push({ phrase, index: m.index ?? 0, kind: "banned_phrase" });
  }
  if ((opts.requireDisclaimer ?? true) && !/educational (information|purposes)|not legal advice/i.test(norm)) {
    issues.push({ phrase: "missing educational disclaimer", index: -1, kind: "missing_disclaimer" });
  }
  if (opts.brainFileEntryIds !== undefined && opts.brainFileEntryIds.length === 0) {
    issues.push({ phrase: "missing brain-file citation", index: -1, kind: "missing_citation" });
  }
  issues.sort((a, b) => a.index - b.index);
  return { ok: issues.length === 0, issues };
}

// ---------- Sensitive content ----------

const SENSITIVE: { category: string; re: RegExp }[] = [
  { category: "health", re: /\b(cancer|diagnos\w*|hospice|terminal\w*|dementia|alzheimer\w*|chemo\w*|surgery|illness|nursing home|health (issue|problem|condition)s?|medical condition)\b/gi },
  { category: "amount", re: /\$\s?\d|\b\d[\d,.]*\s?(k|thousand|million|billion)\b/gi },
  { category: "family_conflict", re: /\b(divorc\w*|separation|separated|custody|estranged|disinherit\w*|feud|family (fight|conflict|dispute)s?)\b/gi },
  { category: "special_needs", re: /\b(special[- ]needs|disabled|disability|autis\w+)\b/gi },
  { category: "death", re: /\b(passed away|died|death of|funeral|deceased|late (husband|wife|father|mother|spouse))\b/gi },
];

export interface SensitiveIssue {
  phrase: string;
  index: number;
  category: string;
}

/**
 * SMS bodies and email subjects show up on lock screens and shared devices, so
 * they must not carry health, money, family-conflict, special-needs or death
 * details. Email bodies and call scripts are not restricted here.
 */
export function sensitiveContentIssues(text: string, channel: Channel, part: "subject" | "body"): SensitiveIssue[] {
  const exposed = (channel === "sms" && part === "body") || (channel === "email" && part === "subject");
  if (!exposed) return [];
  const out: SensitiveIssue[] = [];
  for (const { category, re } of SENSITIVE) {
    for (const m of text.matchAll(re)) out.push({ phrase: m[0], index: m.index ?? 0, category });
  }
  return out.sort((a, b) => a.index - b.index);
}

// ---------- Quiet hours ----------

/**
 * Primary IANA zone per state. Split states use the zone covering most people
 * (for example FL panhandle is really Central); refine by county if it matters.
 */
export const STATE_TIMEZONE: Record<string, string> = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix", AR: "America/Chicago",
  CA: "America/Los_Angeles", CO: "America/Denver", CT: "America/New_York", DE: "America/New_York",
  DC: "America/New_York", FL: "America/New_York", GA: "America/New_York", HI: "Pacific/Honolulu",
  ID: "America/Boise", IL: "America/Chicago", IN: "America/Indiana/Indianapolis", IA: "America/Chicago",
  KS: "America/Chicago", KY: "America/New_York", LA: "America/Chicago", ME: "America/New_York",
  MD: "America/New_York", MA: "America/New_York", MI: "America/Detroit", MN: "America/Chicago",
  MS: "America/Chicago", MO: "America/Chicago", MT: "America/Denver", NE: "America/Chicago",
  NV: "America/Los_Angeles", NH: "America/New_York", NJ: "America/New_York", NM: "America/Denver",
  NY: "America/New_York", NC: "America/New_York", ND: "America/Chicago", OH: "America/New_York",
  OK: "America/Chicago", OR: "America/Los_Angeles", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago",
  UT: "America/Denver", VT: "America/New_York", VA: "America/New_York", WA: "America/Los_Angeles",
  WV: "America/New_York", WI: "America/Chicago", WY: "America/Denver",
};

/** Allowed local send window as [startHour, endHour). Editable. */
export const SEND_WINDOW = {
  default: { start: 8, end: 21 },
  byState: { FL: { start: 8, end: 20 }, OK: { start: 8, end: 20 } } as Record<string, { start: number; end: number }>,
};

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function localMinutes(zone: string, at: Date): number {
  let f = fmtCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "numeric", hourCycle: "h23" });
    fmtCache.set(zone, f);
  }
  const parts = f.formatToParts(at);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

function inWindow(zone: string, at: Date, w: { start: number; end: number }): boolean {
  const mins = localMinutes(zone, at);
  return mins >= w.start * 60 && mins < w.end * 60;
}

/**
 * True when `at` is INSIDE the allowed send window (so sending is OK), 8am to 9pm
 * recipient-local, 8pm in FL and OK. An unknown state is allowed only when both
 * Eastern and Pacific are inside 8am to 8pm, which is safe anywhere in the US.
 */
export function insideSendWindow(state: string, at: Date): boolean {
  const st = state.toUpperCase();
  const zone = STATE_TIMEZONE[st];
  if (!zone) {
    const w = { start: 8, end: 20 };
    return inWindow("America/New_York", at, w) && inWindow("America/Los_Angeles", at, w);
  }
  return inWindow(zone, at, SEND_WINDOW.byState[st] ?? SEND_WINDOW.default);
}

/** Earliest time at or after `at` that is inside the send window (minute resolution). */
export function nextAllowedSendTime(state: string, at: Date): Date {
  if (insideSendWindow(state, at)) return at;
  const t = new Date(Math.floor(at.getTime() / 60_000) * 60_000);
  for (let i = 0; i < 48 * 60; i++) {
    t.setTime(t.getTime() + 60_000);
    if (insideSendWindow(state, t)) return new Date(t);
  }
  return new Date(at.getTime() + 24 * 3_600_000);
}

// ---------- Caps ----------

/** Max marketing texts per rolling 24h per recipient, by state. Editable. States not listed have no cap. */
export const MARKETING_TEXT_CAPS: Record<string, number> = { FL: 3, OK: 3 };
/** Max marketing emails per rolling 24h per recipient, all states. */
export const MARKETING_EMAIL_CAP_PER_DAY = 2;

// ---------- Opt-out ----------

export type OptOutScope = "channel" | "sms" | "email" | "call" | "all";

const KEYWORDS = /^(stop|stopall|stop all|unsubscribe|cancel|end|quit|revoke|optout|opt out|opt-out)$/;
const SHORT_STOP = /^(please )?(stop|unsubscribe|cancel|end|quit)( (all|now|please|messages|texts|texting|these|sending|emails|calls|calling))*$/;
const PHRASES: { re: RegExp; scope: OptOutScope }[] = [
  { re: /\bdo not contact\b|\bdon'?t contact\b|\bleave me alone\b|\bremove me\b|\btake me off\b/, scope: "all" },
  { re: /\b(do not|don'?t|dont) call\b|\bstop calling\b|\bno more calls\b/, scope: "call" },
  { re: /\b(do not|don'?t|dont) text\b|\bstop (texting|messaging)\b|\bno more (texts|messages)\b/, scope: "sms" },
  { re: /\b(do not|don'?t|dont) email\b|\bstop emailing\b|\bno more emails\b/, scope: "email" },
  { re: /\bstop (sending|contacting) me\b|\b(opt|unsubscribe) me\b|\bi (want|would like) to (opt|unsubscribe)\b/, scope: "channel" },
];

/** Classifies a reply. Whole-message keywords and explicit phrases only, so "can you stop by Tuesday?" is not an opt-out. */
export function classifyOptOut(text: string): { optOut: boolean; scope: OptOutScope } {
  const t = text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return { optOut: false, scope: "channel" };
  if (t === "stopall" || t === "stop all") return { optOut: true, scope: "all" };
  if (KEYWORDS.test(t) || SHORT_STOP.test(t)) return { optOut: true, scope: "channel" };
  for (const p of PHRASES) if (p.re.test(t)) return { optOut: true, scope: p.scope };
  return { optOut: false, scope: "channel" };
}

export function isOptOut(text: string): boolean {
  return classifyOptOut(text).optOut;
}

export function normalizeAddress(channel: Channel | "all", address: string): string {
  const a = address.trim();
  if (a.includes("@")) return a.toLowerCase();
  const digits = a.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export async function putSuppression(db: Db, channel: Channel | "all", address: string, reason: string, at: Date): Promise<Suppression> {
  const addr = normalizeAddress(channel, address);
  const id = `${channel}:${addr}`;
  const existing = await db.suppressions.get(id);
  if (existing) return existing;
  return await db.suppressions.insert({ id, channel, address: addr, reason, at: at.toISOString() });
}

/**
 * Records an opt-out. Suppression is checked at send time, so nothing needs to
 * be cancelled: every later step for that channel is skipped. "Do not contact"
 * writes an "all" suppression for the address and for the same person's other
 * address. Returns null when the text is not an opt-out.
 */
export async function applyOptOut(
  db: Db,
  input: { channel: Channel; address: string; text: string; at: Date },
): Promise<{ scope: Channel | "all"; suppressions: Suppression[] } | null> {
  const c = classifyOptOut(input.text);
  if (!c.optOut) return null;
  const scope: Channel | "all" =
    c.scope === "all" ? "all" : c.scope === "sms" ? "sms" : c.scope === "email" ? "email" : c.scope === "call" ? "call_task" : input.channel;
  const addr = normalizeAddress(scope, input.address);
  const written = [await putSuppression(db, scope, addr, `opt_out:${input.text.trim().slice(0, 40)}`, input.at)];
  if (scope === "all") {
    const person = (await db.persons.list()).find((p) => normalizeAddress("sms", p.phone) === addr || normalizeAddress("email", p.email) === addr);
    if (person) {
      for (const other of [person.phone, person.email]) {
        if (normalizeAddress("all", other) !== addr) written.push(await putSuppression(db, "all", other, "opt_out:do_not_contact", input.at));
      }
    }
  }
  await audit(db, "system", {
    action: "nurture.opt_out",
    resourceType: "suppression",
    resourceId: written[0].id,
    detail: { scope, channel: input.channel },
    at: input.at,
  });
  return { scope, suppressions: written };
}

/** True when sending on `channel` to this person is suppressed (channel-specific or "all"). */
export async function isSuppressed(db: Db, channel: Channel, person: { phone: string; email: string }): Promise<boolean> {
  const addrs = channel === "email" ? [person.email] : [person.phone];
  const all = [person.phone, person.email];
  const keys = [...addrs.map((a) => `${channel}:${normalizeAddress(channel, a)}`), ...all.map((a) => `all:${normalizeAddress("all", a)}`)];
  for (const k of keys) if (await db.suppressions.get(k)) return true;
  return false;
}
