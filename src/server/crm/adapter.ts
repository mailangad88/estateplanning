/**
 * Contract every CRM integration implements. The rest of the platform only talks to
 * `CrmAdapter` (through CrmSync), so switching Lawmatics to HubSpot is a config change.
 * Vocabulary: Lawmatics calls our unit of work a "matter" (prospect), HubSpot a "deal".
 */
import type { Activity, Comment, DocumentRecord, ExitReason, Lead, Person, Stage } from "@/server/types";

export interface CrmAdapter {
  readonly name: string;
  upsertContact(person: Person, lead: Lead): Promise<{ contactId: string }>;
  upsertMatter(lead: Lead, person: Person, ctx: { contactId: string }): Promise<{ matterId: string }>;
  setStage(matterId: string, stage: Stage, exit?: ExitReason): Promise<void>;
  logActivity(matterId: string, activity: Activity): Promise<void>;
  /** Only comments with visibility "firm" may be passed. Adapters refuse anything else. */
  addNote(matterId: string, comment: Comment): Promise<void>;
  attachDocument(matterId: string, doc: Pick<DocumentRecord, "id" | "name" | "kind" | "contentType" | "sizeBytes">, url: string): Promise<void>;
}

export type StageMap = Record<Stage | ExitReason, string>;

/**
 * Pipeline stage names in Lawmatics. Configure to match your pipeline: these are the
 * names we send, so they must exist in the firm's Lawmatics account.
 */
export const LAWMATICS_STAGE_MAP: StageMap = {
  new: "New Lead",
  contacted: "Contacted",
  qualified: "Qualified",
  conflict_check: "Conflict Check",
  offered: "Offered to Attorney",
  accepted: "Attorney Accepted",
  consult_booked: "Consult Booked",
  consult_held: "Consult Held",
  proposal_sent: "Proposal Sent",
  retainer_signed: "Retainer Signed",
  paid: "Paid",
  drafting: "Drafting",
  signing_scheduled: "Signing Scheduled",
  plan_complete: "Plan Complete",
  annual_review: "Annual Review",
  not_a_fit: "Lost - Not a Fit",
  unresponsive: "Lost - Unresponsive",
  chose_another_option: "Lost - Chose Another Option",
  conflict: "Lost - Conflict",
  declined_by_all: "Lost - Declined by Attorneys",
};

/**
 * HubSpot deal stage internal ids. Configure to match your pipeline: replace with the
 * ids from Settings > Objects > Deals > Pipelines (default pipeline ids look like
 * "appointmentscheduled"; custom ones are numeric).
 */
export const HUBSPOT_STAGE_MAP: StageMap = {
  new: "ep_new",
  contacted: "ep_contacted",
  qualified: "ep_qualified",
  conflict_check: "ep_conflict_check",
  offered: "ep_offered",
  accepted: "ep_accepted",
  consult_booked: "ep_consult_booked",
  consult_held: "ep_consult_held",
  proposal_sent: "ep_proposal_sent",
  retainer_signed: "ep_retainer_signed",
  paid: "ep_paid",
  drafting: "ep_drafting",
  signing_scheduled: "ep_signing_scheduled",
  plan_complete: "ep_plan_complete",
  annual_review: "ep_annual_review",
  not_a_fit: "ep_lost_not_a_fit",
  unresponsive: "ep_lost_unresponsive",
  chose_another_option: "ep_lost_other_option",
  conflict: "ep_lost_conflict",
  declined_by_all: "ep_lost_declined",
};

/** An exit reason wins over the stage the lead was in when it left. */
export function resolveStage(map: StageMap, stage: Stage, exit?: ExitReason): string {
  return map[exit ?? stage];
}

/** Thrown for any non-2xx response so the retry layer can read status and Retry-After. */
export class CrmHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs?: number,
    message?: string,
  ) {
    super(message ?? `CRM request failed with status ${status}`);
    this.name = "CrmHttpError";
  }
}

/** Retry-After is either delta-seconds or an HTTP date. */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
}

/** Shared JSON request helper. Error messages carry status only, never response bodies (may echo PII). */
export async function requestJson(
  fetchImpl: typeof fetch,
  url: string,
  init: { method: string; token: string; body?: unknown },
): Promise<any> {
  const res = await fetchImpl(url, {
    method: init.method,
    headers: {
      authorization: `Bearer ${init.token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new CrmHttpError(res.status, parseRetryAfter(res.headers?.get?.("retry-after")));
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export function assertFirmVisible(comment: Comment): void {
  if (comment.visibility !== "firm") throw new Error("only firm-visible comments may be sent to the CRM");
}

export function fullName(p: Person): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

/**
 * Segment tags that reveal health, death or disability. They stay out of fields a
 * CRM can sync to ad audiences; workflows get a plain "sensitive track" flag instead.
 */
export const SENSITIVE_SEGMENTS = [
  "special_needs",
  "estate_administration",
  "heir_probate",
  "executor_or_heir",
  "widowed",
  "caregiver",
  "medicaid_planning_interest",
];

/** What the CRM gets about how the lead was captured: tool, resource and non-sensitive tags. Never the tool's figures. */
export function captureFields(lead: Lead) {
  const sensitive = lead.segments.some((s) => SENSITIVE_SEGMENTS.includes(s)) || lead.capture?.result?.mode === "heir";
  return {
    tool: lead.capture?.tool,
    resource: lead.capture?.resource,
    priorTools: lead.priorTools ?? [],
    /** Self-reported "How did you hear about us?" (e.g. ai_assistant), when the visitor answered */
    heardFrom: lead.source.heardFrom,
    tags: lead.segments.filter((s) => !SENSITIVE_SEGMENTS.includes(s)),
    sensitiveTrack: sensitive,
  };
}
