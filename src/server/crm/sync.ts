/**
 * Wraps a CrmAdapter with the rules that must hold for every CRM:
 * - idempotency: the CRM matter id is stored on the Lead (lead.crmId); we never create twice;
 * - retry with exponential backoff on 429, 5xx and network errors, honouring Retry-After;
 * - field minimization: consent IP and user agent are never read here, so they cannot reach
 *   the CRM, and quiz free text is only ever sent inside the matter description or notes,
 *   never into custom fields that CRM-to-ad-platform audience syncs could pick up;
 * - an audit event per sync with adapter name and operation only (no PII).
 */
import { audit } from "@/server/audit/log";
import { CrmHttpError, type CrmAdapter } from "@/server/crm/adapter";
import { buildNurtureState } from "@/server/crm/nurtureState";
import type { Db } from "@/server/db";

export interface CrmSyncOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Signed, short-lived URL for a stored document; required by syncDocument. */
  documentUrl?: (storageKey: string) => Promise<string>;
}

export class CrmSync {
  private maxAttempts: number;
  private baseDelayMs: number;
  private sleep: (ms: number) => Promise<void>;

  constructor(
    readonly adapter: CrmAdapter,
    private opts: CrmSyncOptions = {},
  ) {
    this.maxAttempts = opts.maxAttempts ?? 4;
    this.baseDelayMs = opts.baseDelayMs ?? 500;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /**
   * Note: a create that timed out after the CRM processed it can be repeated on retry.
   * Contacts are deduped by the adapters; matters are guarded by lead.crmId once stored.
   */
  private async retry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const http = err instanceof CrmHttpError ? err : undefined;
        const retryable = http ? http.status === 429 || http.status >= 500 : true; // non-HTTP = network
        if (!retryable || attempt >= this.maxAttempts) throw err;
        await this.sleep(http?.retryAfterMs ?? this.baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }

  private async record(db: Db, operation: string, leadId: string, ok: boolean) {
    await audit(db, "system", {
      action: "crm.sync",
      resourceType: "lead",
      resourceId: leadId,
      leadId,
      detail: { adapter: this.adapter.name, operation, ok },
    });
  }

  private async run<T>(db: Db, operation: string, leadId: string, fn: () => Promise<T>): Promise<T> {
    try {
      const out = await this.retry(fn);
      await this.record(db, operation, leadId, true);
      return out;
    } catch (err) {
      await this.record(db, operation, leadId, false);
      throw err;
    }
  }

  /** Creates contact and matter once. Returns the matter id; later calls return the stored one. */
  async syncLead(db: Db, leadId: string): Promise<{ matterId: string; created: boolean }> {
    const lead = await db.leads.get(leadId);
    if (!lead) throw new Error(`lead not found: ${leadId}`);
    if (lead.crmId) return { matterId: lead.crmId, created: false };
    const person = await db.persons.get(lead.personId);
    if (!person) throw new Error(`person not found for lead ${leadId}`);
    const matterId = await this.run(db, "upsertLead", leadId, async () => {
      const { contactId } = await this.adapter.upsertContact(person, lead);
      return (await this.adapter.upsertMatter(lead, person, { contactId })).matterId;
    });
    await db.leads.update(leadId, { crmId: matterId });
    return { matterId, created: true };
  }

  /** Pushes the current stage (or exit). A never-synced lead is created at its current stage instead. */
  async syncStage(db: Db, leadId: string): Promise<void> {
    const { matterId, created } = await this.syncLead(db, leadId);
    if (created) return;
    const lead = (await db.leads.get(leadId))!;
    await this.run(db, "setStage", leadId, () => this.adapter.setStage(matterId, lead.stage, lead.exit?.reason));
  }

  /**
   * Pushes consent, suppression, sequence and stage flags for the CRM's automations. No-op (false) when
   * the adapter has no nurture support or the lead is gone. Creates the CRM record first if needed.
   */
  async syncNurtureState(db: Db, leadId: string): Promise<boolean> {
    if (!this.adapter.pushNurtureState) return false;
    const state = await buildNurtureState(db, leadId);
    if (!state) return false;
    const { matterId } = await this.syncLead(db, leadId);
    await this.run(db, "pushNurtureState", leadId, () => this.adapter.pushNurtureState!(matterId, state));
    return true;
  }

  /** After a local opt-out: pushes the new suppression for every CRM-synced lead of the person. Best effort per lead. */
  async syncPersonSuppression(db: Db, personId: string): Promise<number> {
    let pushed = 0;
    for (const lead of await db.leads.list(undefined, { personId })) {
      if (!lead.crmId) continue;
      try {
        if (await this.syncNurtureState(db, lead.id)) pushed++;
      } catch (err) {
        console.error("crm suppression push failed", { leadId: lead.id, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return pushed;
  }

  async syncActivity(db: Db, activityId: string): Promise<void> {
    const activity = await db.activities.get(activityId);
    if (!activity) throw new Error(`activity not found: ${activityId}`);
    const { matterId } = await this.syncLead(db, activity.leadId);
    await this.run(db, "logActivity", activity.leadId, () => this.adapter.logActivity(matterId, activity));
  }

  /** Returns false (and sends nothing) unless the comment is firm-visible. */
  async syncComment(db: Db, commentId: string): Promise<boolean> {
    const comment = await db.comments.get(commentId);
    if (!comment) throw new Error(`comment not found: ${commentId}`);
    if (comment.visibility !== "firm") return false;
    const { matterId } = await this.syncLead(db, comment.leadId);
    await this.run(db, "addNote", comment.leadId, () => this.adapter.addNote(matterId, comment));
    return true;
  }

  /** Firm-visible, virus-scanned-clean documents only. */
  async syncDocument(db: Db, documentId: string): Promise<boolean> {
    const doc = await db.documents.get(documentId);
    if (!doc) throw new Error(`document not found: ${documentId}`);
    if (doc.visibility !== "firm" || doc.scanStatus !== "clean") return false;
    if (!this.opts.documentUrl) throw new Error("documentUrl option required to sync documents");
    const { matterId } = await this.syncLead(db, doc.leadId);
    const url = await this.opts.documentUrl(doc.storageKey);
    await this.run(db, "attachDocument", doc.leadId, () => this.adapter.attachDocument(matterId, doc, url));
    return true;
  }
}
