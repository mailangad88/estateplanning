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
}

/**
 * Sends a record to the CRM. Phase 1 uses a signed webhook (Zapier, Make or n8n)
 * that creates the contact in the firm's CRM (Lawmatics by default).
 * Without a webhook configured, only the non-identifying summary is logged.
 */
export async function postToCrm(
  record: object,
  summary: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<DeliveryResult> {
  const url = process.env.CRM_WEBHOOK_URL;
  if (!url) {
    console.info("record received (no CRM webhook configured)", summary);
    return { delivered: false, target: "log" };
  }
  const body = JSON.stringify(record);
  const headers: Record<string, string> = { "content-type": "application/json" };
  const secret = process.env.CRM_WEBHOOK_SECRET;
  if (secret) headers["x-signature"] = createHmac("sha256", secret).update(body).digest("hex");
  const res = await fetchImpl(url, { method: "POST", headers, body });
  return { delivered: res.ok, target: "webhook", status: res.status };
}

export function deliverLead(lead: LeadRecord, fetchImpl: typeof fetch = fetch): Promise<DeliveryResult> {
  return postToCrm({ type: "lead", ...lead }, { id: lead.id, state: lead.contact.state, tier: lead.score.tier, score: lead.score.score }, fetchImpl);
}
