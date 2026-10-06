import { createHash, randomUUID } from "node:crypto";
import type { Db } from "@/server/db";
import type { Actor, AuditEvent } from "@/server/types";

export type AuditActor = Pick<Actor, "userId" | "role"> | "system";

export interface AuditInput {
  action: string;
  resourceType: string;
  resourceId: string;
  leadId?: string;
  detail?: Record<string, unknown>;
  at?: Date;
}

const GENESIS = "0".repeat(64);

function hashEvent(e: Omit<AuditEvent, "hash">): string {
  const { id, seq, at, actorId, actorRole, action, resourceType, resourceId, leadId, detail, prevHash } = e;
  return createHash("sha256")
    .update(JSON.stringify([id, seq, at, actorId, actorRole, action, resourceType, resourceId, leadId ?? null, detail ?? null, prevHash]))
    .digest("hex");
}

/**
 * Appends to the audit log. Each event carries the hash of the one before it,
 * so any edit or deletion breaks the chain and `verifyAuditChain` reports it.
 * Detail must never contain intake content, only ids and field names.
 */
export function audit(db: Db, actor: AuditActor, input: AuditInput): AuditEvent {
  const last = db.audit.last();
  const base: Omit<AuditEvent, "hash"> = {
    id: randomUUID(),
    seq: (last?.seq ?? 0) + 1,
    at: (input.at ?? new Date()).toISOString(),
    actorId: actor === "system" ? "system" : actor.userId,
    actorRole: actor === "system" ? "system" : actor.role,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    leadId: input.leadId,
    detail: input.detail,
    prevHash: last?.hash ?? GENESIS,
  };
  return db.audit.append({ ...base, hash: hashEvent(base) });
}

export function verifyAuditChain(events: AuditEvent[]): { ok: boolean; brokenAtSeq?: number } {
  let prev = GENESIS;
  let seq = 0;
  for (const e of events) {
    const { hash, ...rest } = e;
    if (e.seq !== seq + 1 || e.prevHash !== prev || hashEvent(rest) !== hash) return { ok: false, brokenAtSeq: e.seq };
    prev = hash;
    seq = e.seq;
  }
  return { ok: true };
}
