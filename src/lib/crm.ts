import { createHmac } from "node:crypto";
import type { ConsentRecord } from "@/lib/consent";
import type { LeadSubmission } from "@/lib/lead";
import type { ScoreResult } from "@/lib/scoring";

export interface LeadRecord {
  id: string;
  receivedAt: string;
  contact: Pick<LeadSubmission, "firstName" | "lastName" | "email" | "phone" | "state" | "county" | "language">;
  contactMethod: "phone" | "text" | "email";
  goals?: string;
  answers: LeadSubmission["answers"];
  score: ScoreResult;
  segments: string[];
  source: LeadSubmission["source"];
  /** "How did you hear about us?" answer, copied out of `source` so the CRM can map it to its own field */
  heardFrom?: LeadSubmission["source"]["heardFrom"];
  /** Which tool or form captured the lead, what was requested, and the tool's figures */
  capture: LeadSubmission["capture"];
  visitorId?: string;
  priorTools: LeadSubmission["priorTools"];
  consent: ConsentRecord;
}

export interface DeliveryResult {
  delivered: boolean;
  target: "webhook" | "log";
  status?: number;
  /** HTTP requests made (0 when no webhook is configured) */
  attempts?: number;
  /** Short, PII-free description of the last failure: never includes the URL or the payload */
  error?: string;
  /** True when a later retry could succeed (network error, 5xx or 429) */
  retryable?: boolean;
  idempotencyKey?: string;
  event?: string;
}

export const LEAD_CREATED_EVENT = "lead.created";

/**
 * Deterministic key for one lead and event. The same lead always produces the same key, so the
 * middleware (or its retry logic) can drop a duplicate. The creation event uses the bare lead id.
 */
export function idempotencyKey(leadId: string, event: string = LEAD_CREATED_EVENT): string {
  return event === LEAD_CREATED_EVENT ? leadId : `${leadId}:${event}`;
}

/**
 * US phone number to E.164 (+15125550100). Accepts 10 digits, 11 digits starting with 1, and
 * punctuation or spaces. An explicit "+" number is kept when it is a valid E.164 length. Anything
 * else returns "" rather than a guess, so the CRM never receives a malformed number.
 */
export function toE164(raw: string | undefined | null): string {
  if (!raw) return "";
  const s = raw.trim();
  const digits = s.replace(/\D/g, "");
  if (s.startsWith("+") && !digits.startsWith("1")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : "";
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  // NANP: area code and exchange cannot start with 0 or 1
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(national) ? `+1${national}` : "";
}

/** Branch key for nurture Sequence A (nurture-sequences.md section 0.2). First match wins. */
export function topNeed(a: LeadRecord["answers"]): string {
  if (a.matterType === "after_death" || a.urgency === "recent_death") return "administration";
  if (a.specialNeeds === "yes") return "special_needs";
  if (a.ownsBusiness === "yes") return "business_owner";
  if (a.matterType === "elder_care") return "elder_medicaid";
  if (a.blendedFamily === "yes") return "blended_family";
  if (a.ownsHome === "yes" || a.outOfStateProperty === "yes" || a.assetRange === "1m_5m" || a.assetRange === "over_5m") return "living_trust";
  return "will";
}

export type FlatValue = string | number | boolean;

/** Flat keys the CRM middleware maps one to one (tech-stack-and-vendors.md section 12.3). Absent values are "" so every key always exists. */
export function flattenLead(lead: LeadRecord): Record<string, FlatValue> {
  const c = lead.contact;
  const a = lead.answers;
  const s = lead.source;
  const consent = lead.consent;
  return {
    first_name: c.firstName,
    last_name: c.lastName,
    full_name: [c.firstName, c.lastName].filter(Boolean).join(" "),
    email: c.email,
    phone_e164: toE164(c.phone),
    state: c.state,
    county: c.county ?? "",
    language: c.language ?? "",
    preferred_contact: lead.contactMethod,
    // The record already holds the effective method: text without SMS consent has fallen back to phone.
    effective_contact_method: lead.contactMethod === "text" && !consent.smsConsent ? "phone" : lead.contactMethod,
    goals: lead.goals ?? "",
    matter_type: a.matterType ?? "",
    marital_status: a.maritalStatus ?? "",
    children: a.children ?? "",
    special_needs: a.specialNeeds ?? "",
    blended_family: a.blendedFamily ?? "",
    owns_home: a.ownsHome ?? "",
    owns_business: a.ownsBusiness ?? "",
    out_of_state_property: a.outOfStateProperty ?? "",
    asset_range: a.assetRange ?? "",
    existing_documents: a.existingDocuments ?? "",
    urgency: a.urgency ?? "",
    score: lead.score.score,
    tier: lead.score.tier,
    red_flags: lead.score.redFlags.join("; "),
    not_fit_reason: lead.score.notFitReason ?? "",
    tags: lead.segments.join(","),
    top_need: topNeed(a),
    sms_consent: consent.smsConsent,
    sms_consent_timestamp: consent.capturedAt,
    sms_consent_text_version: consent.version,
    sms_consent_text: consent.smsConsentText ?? "",
    no_relationship_ack: consent.acknowledgedNoRelationship,
    // The form submission is the opt-in for educational email (spec: implicit email consent).
    email_consent: true,
    consent_page_url: consent.pageUrl,
    consent_ip: consent.ip ?? "",
    consent_ua: consent.userAgent ?? "",
    source: s.utmSource ?? "",
    medium: s.utmMedium ?? "",
    campaign: s.utmCampaign ?? "",
    term: s.utmTerm ?? "",
    content: s.utmContent ?? "",
    landing_page: s.landingPage ?? "",
    referrer: s.referrer ?? "",
    gclid: s.gclid ?? "",
    fbclid: s.fbclid ?? "",
    heard_from: lead.heardFrom ?? s.heardFrom ?? "",
    capture_tool: lead.capture.tool,
    capture_resource: lead.capture.resource ?? "",
    external_lead_id: lead.id,
    lead_received_at: lead.receivedAt,
  };
}

export interface LeadPayload {
  id: string;
  event: string;
  receivedAt: string;
  flat: Record<string, FlatValue>;
  /** The full nested LeadRecord, unchanged, for audit */
  record: LeadRecord;
}

export function buildLeadPayload(lead: LeadRecord, event: string = LEAD_CREATED_EVENT): LeadPayload {
  return { id: lead.id, event, receivedAt: lead.receivedAt, flat: flattenLead(lead), record: lead };
}

export interface DeliveryOptions {
  /** Total HTTP attempts, including the first. Default 3. */
  maxAttempts?: number;
  /** First backoff ceiling in ms; doubles each retry. Default 400. */
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Per-request timeout. Default 4000. */
  timeoutMs?: number;
  /** Stop retrying when waiting would push the call past this many ms. Default 9000, so a form post never hangs. */
  budgetMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Returns [0,1). Injectable for tests. */
  random?: () => number;
  now?: () => number;
  url?: string;
  secret?: string;
  event?: string;
  idempotencyKey?: string;
}

export const isRetryableStatus = (status: number) => status === 429 || status >= 500;

/** Describes a failure without echoing the URL, headers or body. */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return "unknown error";
  const code = (err.cause as { code?: unknown } | undefined)?.code ?? (err as { code?: unknown }).code;
  const base = err.name === "TimeoutError" || err.name === "AbortError" ? "timeout" : typeof code === "string" ? code : err.message;
  return `${err.name}: ${base}`.replace(/https?:\/\/\S+/g, "[url]").slice(0, 200);
}

function retryAfterMs(res: Response): number | undefined {
  const h = res.headers?.get?.("retry-after");
  if (!h) return undefined;
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(h);
  return Number.isNaN(when) ? undefined : Math.max(0, when - Date.now());
}

/**
 * Sends a record to the CRM. Phase 1 uses a signed webhook (Zapier, Make or n8n)
 * that creates the contact in the firm's CRM (Lawmatics by default).
 * Without a webhook configured, only the non-identifying summary is logged.
 *
 * Retries network errors, 5xx and 429 with exponential backoff and jitter (never other 4xx),
 * inside a short time budget. Never throws: failures come back as `delivered: false`.
 */
export async function postToCrm(
  record: object,
  summary: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
  opts: DeliveryOptions = {},
): Promise<DeliveryResult> {
  const url = opts.url ?? process.env.CRM_WEBHOOK_URL;
  if (!url) {
    console.info("record received (no CRM webhook configured)", summary);
    return { delivered: false, target: "log", attempts: 0 };
  }
  const rec = record as { id?: string; type?: string; event?: string };
  const event = opts.event ?? rec.event ?? (rec.type ? `${rec.type}.created` : LEAD_CREATED_EVENT);
  const key = opts.idempotencyKey ?? (rec.id ? idempotencyKey(rec.id, event) : undefined);
  const body = JSON.stringify(record);
  const headers: Record<string, string> = { "content-type": "application/json", "x-event": event };
  if (key) headers["idempotency-key"] = key;
  const secret = opts.secret ?? process.env.CRM_WEBHOOK_SECRET;
  if (secret) headers["x-signature"] = createHmac("sha256", secret).update(body).digest("hex");

  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
  const base = opts.baseDelayMs ?? 400;
  const maxDelay = opts.maxDelayMs ?? 3000;
  const timeoutMs = opts.timeoutMs ?? 4000;
  const budget = opts.budgetMs ?? 9000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = opts.random ?? Math.random;
  const now = opts.now ?? Date.now;
  const started = now();

  let status: number | undefined;
  let error: string | undefined;
  let retryable = false;
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    let wait: number | undefined;
    try {
      const signal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(timeoutMs) : undefined;
      const res = await fetchImpl(url, { method: "POST", headers, body, signal });
      status = res.status;
      if (res.ok) return { delivered: true, target: "webhook", status, attempts, idempotencyKey: key, event };
      error = `HTTP ${res.status}`;
      retryable = isRetryableStatus(res.status);
      wait = retryAfterMs(res);
    } catch (err) {
      status = undefined;
      error = describeError(err);
      retryable = true;
    }
    if (!retryable || attempts >= maxAttempts) break;
    // Equal jitter: half the ceiling is fixed, half is random, so retries spread out without collapsing to zero.
    const ceiling = Math.min(maxDelay, base * 2 ** (attempts - 1));
    const delay = Math.min(maxDelay, wait ?? ceiling / 2 + random() * (ceiling / 2));
    if (now() - started + delay > budget) break;
    await sleep(delay);
  }
  return { delivered: false, target: "webhook", status, attempts, error, retryable, idempotencyKey: key, event };
}

export function deliverLead(lead: LeadRecord, fetchImpl: typeof fetch = fetch, opts: DeliveryOptions = {}): Promise<DeliveryResult> {
  const event = opts.event ?? LEAD_CREATED_EVENT;
  return postToCrm(
    buildLeadPayload(lead, event),
    { id: lead.id, state: lead.contact.state, tier: lead.score.tier, score: lead.score.score },
    fetchImpl,
    { ...opts, event },
  );
}
