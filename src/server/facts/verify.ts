/**
 * Attorney fact-verification queue (C7). Reads the registry in src/lib/facts.ts, stores one
 * append-only approval record per approval, audits every approval, and exposes staleness alerts
 * for the cron sweep. Only `verify_facts` actors (attorneys and platform admins) can approve.
 */
import { audit } from "@/server/audit/log";
import { assertCan, can } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import {
  factRows,
  getFact,
  isPublishable,
  latestVerification,
  factRegistry,
  stalenessAlerts,
  type FactAlert,
  type FactRow,
  type FactVerification,
} from "@/lib/facts";
import type { Actor } from "@/server/types";

/** Everything the verification queue shows, newest state first. Attorneys and platform admins only. */
export async function listFactRows(db: Db, actor: Actor, now = new Date()): Promise<FactRow[]> {
  assertCan(can(actor, "verify_facts"), "Only attorneys and platform admins can review facts");
  return factRows(await db.factVerifications.list(), now);
}

export interface ApproveInput {
  factId: string;
  /** The exact value the approver was shown. Rejected if the registry value has changed since. */
  value: string;
  note?: string;
}

export async function approveFact(db: Db, actor: Actor, input: ApproveInput, now = new Date()): Promise<FactVerification> {
  assertCan(can(actor, "verify_facts"), "Only attorneys and platform admins can approve facts");
  const fact = getFact(String(input.factId));
  if (!fact) throw new Error("Unknown fact");
  if (input.value !== fact.value) throw new Error("This fact changed while you were reviewing it. Reload and review the new value.");
  const note = (input.note ?? "").trim();
  if (fact.confidence === "unverified" && !note) {
    throw new Error("This fact is marked unverified in the research. Record in the note which source you checked.");
  }
  const previous = latestVerification(await db.factVerifications.list(undefined, { factId: fact.id }), fact.id);
  const version = (previous?.version ?? 0) + 1;
  const record: FactVerification = {
    id: `${fact.id}@${version}`,
    factId: fact.id,
    version,
    approvedValue: fact.value,
    approvedBy: actor.userId,
    approvedAt: now.toISOString(),
    note,
  };
  // A concurrent approval of the same version fails on the unique id (and the schema's unique key).
  await db.factVerifications.insert(record);
  await audit(db, actor, {
    action: "fact.approve",
    resourceType: "fact",
    resourceId: fact.id,
    detail: { version, previousVersion: previous?.version ?? null, asOf: fact.asOf, valueChanged: !!previous && previous.approvedValue !== fact.value },
    at: now,
  });
  return record;
}

/**
 * Staleness alerts across the whole registry, for the cron sweep to forward to the attorney
 * (the existing notifier, a task, an email). Pure read; expired alerts come first.
 */
export async function factAlerts(db: Db, now = new Date()): Promise<FactAlert[]> {
  const verifications = await db.factVerifications.list();
  const alerts: FactAlert[] = [];
  for (const fact of factRegistry()) {
    const v = latestVerification(verifications, fact.id);
    // An unapproved fact has no alerts of its own: it is already pending and blocked. Alert on the rest.
    if (!v && !fact.changeDate && !fact.annualIndexing) continue;
    alerts.push(...stalenessAlerts(fact, v, now));
  }
  return alerts.sort((a, b) => Number(b.severity === "expired") - Number(a.severity === "expired") || a.dueOn.localeCompare(b.dueOn));
}

/**
 * Ids of the facts the site may publish right now. Pages call this when REQUIRE_ATTORNEY_REVIEW=true
 * (see gatedFactValue in src/lib/facts.ts for the single-value form).
 */
export async function publishableFactIds(db: Db, now = new Date()): Promise<Set<string>> {
  const verifications = await db.factVerifications.list();
  const ids = new Set<string>();
  for (const fact of factRegistry()) {
    if (isPublishable(fact, latestVerification(verifications, fact.id), now)) ids.add(fact.id);
  }
  return ids;
}
