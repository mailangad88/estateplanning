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
  consent: ConsentRecord;
}

export interface DeliveryResult {
  delivered: boolean;
  target: "webhook" | "log";
  status?: number;
}

/**
 * Sends a lead to the CRM. Phase 1 uses a signed webhook (Zapier, Make or n8n)
 * that creates the contact and matter in the firm's CRM (Lawmatics by default).
 * Without a webhook configured, only a non-identifying summary is logged.
 */
export async function deliverLead(lead: LeadRecord, fetchImpl: typeof fetch = fetch): Promise<DeliveryResult> {
  const url = process.env.CRM_WEBHOOK_URL;
  if (!url) {
    console.info("lead received (no CRM webhook configured)", {
      id: lead.id,
      state: lead.contact.state,
      tier: lead.score.tier,
      score: lead.score.score,
    });
    return { delivered: false, target: "log" };
  }
  const body = JSON.stringify(lead);
  const headers: Record<string, string> = { "content-type": "application/json" };
  const secret = process.env.CRM_WEBHOOK_SECRET;
  if (secret) headers["x-signature"] = createHmac("sha256", secret).update(body).digest("hex");
  const res = await fetchImpl(url, { method: "POST", headers, body });
  return { delivered: res.ok, target: "webhook", status: res.status };
}
