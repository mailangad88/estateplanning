/**
 * Admin side of the commission engine: editable fee rules with a full version
 * history, counsel approval as its own step, and invoices that snapshot the rule
 * versions they used so later edits never rewrite a past invoice.
 *
 * The compliance lock lives in src/lib/fees.ts. Rates are always editable; whether
 * a rule bills anything is decided by the structure and counsel approval.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  checkRule,
  computeCharges,
  feePermission,
  FEE_TYPES,
  type BillableEvent,
  type BusinessStructure,
  type ChargeLine,
  type FeeRule,
} from "@/lib/fees";
import { audit } from "@/server/audit/log";
import { assertCan, can } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import type { Actor } from "@/server/types";

export interface FeeRuleVersion {
  /** `${ruleId}@${version}` */
  id: string;
  ruleId: string;
  version: number;
  rule: FeeRule;
  editedBy: string;
  editedAt: string;
  reason: string;
  /** Whether the rule can bill under the structure in force when it was saved */
  billable: boolean;
  lockReason?: string;
  counsel?: { name: string; opinionRef: string };
}

export interface InvoiceLine extends ChargeLine {
  ruleVersionId: string;
}

export interface Invoice {
  id: string;
  firmId: string;
  periodStart: string; // ISO date, inclusive
  periodEnd: string; // ISO date, exclusive
  structure: BusinessStructure;
  lines: InvoiceLine[];
  totalCents: number;
  blockedRules: { ruleId: string; reason: string }[];
  status: "draft" | "approved" | "sent" | "void";
  createdAt: string;
  createdBy: string;
  approvedBy?: string;
  credits: { eventId: string; reason: string; amountCents: number }[];
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const feeRuleInput = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,60}$/, "Use lowercase letters, numbers and dashes"),
  feeType: z.enum(FEE_TYPES as [FeeRule["feeType"], ...FeeRule["feeType"][]]),
  amountCents: z.number().int().min(0).optional(),
  percent: z.number().min(0).max(100).optional(),
  capCents: z.number().int().min(0).optional(),
  state: z.string().length(2).toUpperCase().optional(),
  lawyerId: z.string().optional(),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.optional(),
});
export type FeeRuleInput = z.infer<typeof feeRuleInput>;

export function ruleHistory(db: Db, ruleId: string): FeeRuleVersion[] {
  return db.feeRuleVersions.list((v) => v.ruleId === ruleId).sort((a, b) => a.version - b.version);
}

export function currentRuleVersions(db: Db): FeeRuleVersion[] {
  const latest = new Map<string, FeeRuleVersion>();
  for (const v of db.feeRuleVersions.list()) {
    const cur = latest.get(v.ruleId);
    if (!cur || v.version > cur.version) latest.set(v.ruleId, v);
  }
  return [...latest.values()].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

function writeVersion(
  db: Db,
  actorId: string,
  rule: FeeRule,
  structure: BusinessStructure,
  reason: string,
  /** undefined keeps the previous version's counsel record; null clears it */
  counsel?: FeeRuleVersion["counsel"] | null,
): FeeRuleVersion {
  const prev = ruleHistory(db, rule.id).at(-1);
  const version = (prev?.version ?? 0) + 1;
  const check = checkRule(rule, structure);
  return db.feeRuleVersions.insert({
    id: `${rule.id}@${version}`,
    ruleId: rule.id,
    version,
    rule,
    editedBy: actorId,
    editedAt: new Date().toISOString(),
    reason,
    billable: check.allowed,
    lockReason: check.allowed ? undefined : check.reason,
    counsel: counsel === null ? undefined : (counsel ?? prev?.counsel),
  });
}

/** Loads the starting rules from config once, as version 1 by "system". */
export function seedFeeRules(db: Db, rules: FeeRule[], structure: BusinessStructure): void {
  for (const rule of rules) {
    if (ruleHistory(db, rule.id).length === 0) writeVersion(db, "system", rule, structure, "Initial configuration");
  }
}

/**
 * Creates or edits a rule. Editing the rate or dates never clears the lock: a
 * changed rule that needs counsel approval loses its previous approval, because
 * counsel approved specific terms.
 */
export function saveFeeRule(
  db: Db,
  actor: Actor,
  input: FeeRuleInput,
  reason: string,
  structure: BusinessStructure,
): FeeRuleVersion {
  assertCan(can(actor, "manage_fee_rules"), "Only platform admins can edit fee rules");
  if (!reason.trim()) throw new Error("A reason is required for every fee rule change");
  const parsed = feeRuleInput.parse(input);
  if (parsed.effectiveTo && parsed.effectiveTo <= parsed.effectiveFrom) throw new Error("End date must be after the start date");
  const prev = ruleHistory(db, parsed.id).at(-1);
  const { counselApprovedAt: _dropped, ...prevTerms } = prev?.rule ?? ({} as FeeRule);
  const termsUnchanged = prev && JSON.stringify(prevTerms) === JSON.stringify(parsed);
  const rule: FeeRule = { ...parsed, counselApprovedAt: termsUnchanged ? prev?.rule.counselApprovedAt : undefined };
  const v = writeVersion(db, actor.userId, rule, structure, reason, termsUnchanged ? prev?.counsel : null);
  audit(db, actor, { action: "fee_rule.save", resourceType: "fee_rule", resourceId: v.id, detail: { billable: v.billable } });
  return v;
}

/**
 * Records that ethics counsel approved a rule under the current structure.
 * Refused outright for fee types the structure prohibits: no approval unlocks those.
 */
export function recordCounselApproval(
  db: Db,
  actor: Actor,
  ruleId: string,
  counsel: { name: string; opinionRef: string; approvedOn: string },
  structure: BusinessStructure,
): FeeRuleVersion {
  assertCan(can(actor, "approve_fee_rule"), "Only platform admins can record counsel approval");
  const prev = ruleHistory(db, ruleId).at(-1);
  if (!prev) throw new Error(`No fee rule ${ruleId}`);
  const permission = feePermission(prev.rule.feeType, structure);
  if (permission === "prohibited") {
    throw new Error(`${prev.rule.feeType} cannot be approved under the ${structure} structure`);
  }
  if (!counsel.name.trim() || !counsel.opinionRef.trim()) throw new Error("Counsel name and opinion reference are required");
  isoDate.parse(counsel.approvedOn);
  const rule: FeeRule = { ...prev.rule, counselApprovedAt: counsel.approvedOn };
  const v = writeVersion(db, actor.userId, rule, structure, `Counsel approval recorded (${counsel.opinionRef})`, {
    name: counsel.name,
    opinionRef: counsel.opinionRef,
  });
  audit(db, actor, { action: "fee_rule.counsel_approval", resourceType: "fee_rule", resourceId: v.id, detail: { billable: v.billable } });
  return v;
}

export function recordBillableEvent(db: Db, event: Omit<BillableEvent, "id"> & { id?: string }): BillableEvent {
  return db.billableEvents.insert({ ...event, id: event.id ?? randomUUID() });
}

function eventsFor(db: Db, firmId: string, periodStart: string, periodEnd: string, lawyerFirm: (lawyerId: string) => string | undefined) {
  return db.billableEvents.list((e) => {
    const day = e.occurredAt.slice(0, 10);
    if (day < periodStart || day >= periodEnd) return false;
    return !e.lawyerId || lawyerFirm(e.lawyerId) === firmId;
  });
}

export function previewInvoice(db: Db, firmId: string, periodStart: string, periodEnd: string, structure: BusinessStructure) {
  const versions = currentRuleVersions(db);
  const events = eventsFor(db, firmId, periodStart, periodEnd, (id) => db.lawyers.get(id)?.firmId);
  const result = computeCharges(events, versions.map((v) => v.rule), structure);
  const versionOf = new Map(versions.map((v) => [v.ruleId, v.id]));
  const lines: InvoiceLine[] = result.lines.map((l) => ({ ...l, ruleVersionId: versionOf.get(l.ruleId)! }));
  return { lines, totalCents: result.totalCents, blockedRules: result.blockedRules };
}

/** Creates a draft invoice. An admin reviews and approves it before anything is sent. */
export function createInvoice(
  db: Db,
  actor: Actor,
  firmId: string,
  periodStart: string,
  periodEnd: string,
  structure: BusinessStructure,
): Invoice {
  assertCan(can(actor, "manage_fee_rules"));
  const p = previewInvoice(db, firmId, periodStart, periodEnd, structure);
  const invoice = db.invoices.insert({
    id: randomUUID(),
    firmId,
    periodStart,
    periodEnd,
    structure,
    lines: p.lines,
    totalCents: p.totalCents,
    blockedRules: p.blockedRules,
    status: "draft",
    createdAt: new Date().toISOString(),
    createdBy: actor.userId,
    credits: [],
  });
  audit(db, actor, { action: "invoice.create", resourceType: "invoice", resourceId: invoice.id, detail: { totalCents: invoice.totalCents } });
  return invoice;
}

/** Credits a line, for example a duplicate or out-of-area lead. Only on a draft invoice. */
export function creditInvoiceLine(db: Db, actor: Actor, invoiceId: string, eventId: string, reason: string): Invoice {
  assertCan(can(actor, "manage_fee_rules"));
  const inv = db.invoices.get(invoiceId);
  if (!inv) throw new Error("Invoice not found");
  if (inv.status !== "draft") throw new Error("Only draft invoices can be credited; issue a credit note instead");
  const amount = inv.lines.filter((l) => l.eventId === eventId).reduce((s, l) => s + l.amountCents, 0);
  if (amount === 0) throw new Error("No billed line for that event");
  if (inv.credits.some((c) => c.eventId === eventId)) throw new Error("That event is already credited");
  const credits = [...inv.credits, { eventId, reason, amountCents: amount }];
  const next = db.invoices.update(invoiceId, { credits, totalCents: inv.totalCents - amount });
  audit(db, actor, { action: "invoice.credit", resourceType: "invoice", resourceId: invoiceId, detail: { eventId, amountCents: amount } });
  return next;
}

export function approveInvoice(db: Db, actor: Actor, invoiceId: string): Invoice {
  assertCan(can(actor, "manage_fee_rules"));
  const inv = db.invoices.get(invoiceId);
  if (!inv) throw new Error("Invoice not found");
  if (inv.status !== "draft") throw new Error(`Invoice is ${inv.status}`);
  const next = db.invoices.update(invoiceId, { status: "approved", approvedBy: actor.userId });
  audit(db, actor, { action: "invoice.approve", resourceType: "invoice", resourceId: invoiceId });
  return next;
}
