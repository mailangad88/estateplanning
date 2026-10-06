/**
 * Nurture message templates with attorney approval. The copy lives in templateCopy.ts; this file
 * hashes it, records approvals (append-only, like fact_verifications), renders it, and exposes
 * ApprovedTemplateSource for the sender. "No entry, no piece": render() returns null unless an
 * attorney approved the exact current copy.
 */
import { createHash } from "node:crypto";
import { audit } from "@/server/audit/log";
import { assertCan, can } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { SEQUENCES } from "@/server/nurture/sequences";
import { PLACEHOLDERS, TEMPLATE_COPY, getTemplateCopy, type TemplateCopy } from "@/server/nurture/templateCopy";
import type { TemplateApproval } from "@/server/nurture/types";
import type { Actor } from "@/server/types";

export interface TemplateVars {
  firstName: string;
  firmName: string;
  attorneyName?: string;
  bookingUrl?: string;
  unsubscribeUrl: string;
  resourceUrl?: string;
  reviewUrl?: string;
  portalUrl?: string;
}

export interface RenderedMessage {
  subject?: string;
  text: string;
  html?: string;
  templateKey: string;
  /** The id of the approval that cleared this copy, `${templateKey}@${approvalVersion}`. */
  templateVersion: string;
}

export interface TemplateSource {
  render(db: Db, templateKey: string, channel: "email" | "sms", vars: TemplateVars): Promise<RenderedMessage | null>;
}

// ---------- Hashing ----------

/** Hash of everything the recipient could see. Any edit to channel, subject or body changes it. */
export function contentHash(copy: Pick<TemplateCopy, "channel" | "subject" | "body">): string {
  return createHash("sha256").update(JSON.stringify([copy.channel, copy.subject ?? null, copy.body])).digest("hex");
}

// ---------- Rendering ----------

const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g;

function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_RE)].map((m) => m[1]);
}

/** Values go in on a single line: a value can never add lines, and is never itself re-expanded. */
function valueOf(vars: TemplateVars, name: string): string | undefined {
  if (!(PLACEHOLDERS as readonly string[]).includes(name)) return undefined;
  const raw = (vars as unknown as Record<string, string | undefined>)[name];
  const v = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  return v || undefined;
}

function fill(line: string, vars: TemplateVars): string {
  return line.replace(PLACEHOLDER_RE, (_, name: string) => valueOf(vars, name) ?? "");
}

/**
 * Fills placeholders. A line whose placeholder has no value is dropped whole, never left as `{{x}}`.
 * unsubscribeUrl is the exception: sending an email without a working unsubscribe link is not allowed,
 * so a missing one throws.
 */
export function renderText(body: string, vars: TemplateVars): string {
  const out: string[] = [];
  for (const line of body.split("\n")) {
    const names = placeholdersIn(line);
    if (names.includes("unsubscribeUrl") && !valueOf(vars, "unsubscribeUrl")) {
      throw new Error("unsubscribeUrl is required to render this template");
    }
    if (names.some((n) => !valueOf(vars, n))) continue;
    out.push(fill(line, vars));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function renderSubject(subject: string, vars: TemplateVars): string {
  return fill(subject, vars).replace(/\s+/g, " ").replace(/[,:\s]+$/, "").trim();
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

/** Paragraphs split on blank lines, single newlines become <br>. Everything is escaped. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>\n")}</p>`)
    .join("\n");
}

/** Renders copy without any approval check. Used for the portal preview and by the approved source. */
export function renderCopy(copy: TemplateCopy, vars: TemplateVars): Omit<RenderedMessage, "templateVersion"> {
  const text = renderText(copy.body, vars);
  if (copy.channel === "sms") return { text, templateKey: copy.key };
  return { subject: renderSubject(copy.subject ?? "", vars), text, html: textToHtml(text), templateKey: copy.key };
}

export const SAMPLE_VARS: TemplateVars = {
  firstName: "Sam",
  firmName: "Example Family Law",
  attorneyName: "Alex Attorney",
  bookingUrl: "https://example.test/book",
  unsubscribeUrl: "https://example.test/unsubscribe",
  resourceUrl: "https://example.test/guide",
  reviewUrl: "https://example.test/review",
  portalUrl: "https://example.test/portal",
};

// ---------- Approval state ----------

export type TemplateStatus = "approved" | "changed" | "pending";

/** The approval that covers the copy as it reads now: the newest one whose hash matches. */
export function currentApproval(approvals: TemplateApproval[], copy: TemplateCopy): TemplateApproval | undefined {
  const hash = contentHash(copy);
  let best: TemplateApproval | undefined;
  for (const a of approvals) {
    if (a.templateKey === copy.key && a.contentHash === hash && (!best || a.version > best.version)) best = a;
  }
  return best;
}

export function latestApproval(approvals: TemplateApproval[], key: string): TemplateApproval | undefined {
  let best: TemplateApproval | undefined;
  for (const a of approvals) if (a.templateKey === key && (!best || a.version > best.version)) best = a;
  return best;
}

export function templateStatus(approvals: TemplateApproval[], copy: TemplateCopy): TemplateStatus {
  if (currentApproval(approvals, copy)) return "approved";
  return latestApproval(approvals, copy.key) ? "changed" : "pending";
}

export class ApprovedTemplateSource implements TemplateSource {
  async render(db: Db, templateKey: string, channel: "email" | "sms", vars: TemplateVars): Promise<RenderedMessage | null> {
    const copy = getTemplateCopy(templateKey);
    if (!copy || copy.channel !== channel) return null;
    const approval = currentApproval(await db.templateApprovals.list(undefined, { templateKey }), copy);
    if (!approval) return null;
    return { ...renderCopy(copy, vars), templateVersion: approval.id };
  }
}

// ---------- Portal queue ----------

export interface TemplateRow {
  copy: TemplateCopy;
  hash: string;
  status: TemplateStatus;
  approval?: TemplateApproval;
  latest?: TemplateApproval;
  preview: Omit<RenderedMessage, "templateVersion">;
}

const ORDER: Record<TemplateStatus, number> = { changed: 0, pending: 1, approved: 2 };

/** Every template with its status and a rendered preview. Attorneys and platform admins only. */
export async function listTemplateRows(db: Db, actor: Actor): Promise<TemplateRow[]> {
  assertCan(can(actor, "approve_templates"), "Only attorneys and platform admins can review templates");
  const approvals = await db.templateApprovals.list();
  return TEMPLATE_COPY.map((copy) => ({
    copy,
    hash: contentHash(copy),
    status: templateStatus(approvals, copy),
    approval: currentApproval(approvals, copy),
    latest: latestApproval(approvals, copy.key),
    preview: renderCopy(copy, SAMPLE_VARS),
  })).sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.copy.key.localeCompare(b.copy.key));
}

export interface ApproveTemplateInput {
  templateKey: string;
  /** The content hash the approver was shown. Rejected if the copy has changed since. */
  contentHash: string;
  note?: string;
}

export async function approveTemplate(db: Db, actor: Actor, input: ApproveTemplateInput, now = new Date()): Promise<TemplateApproval> {
  assertCan(can(actor, "approve_templates"), "Only attorneys and platform admins can approve templates");
  const copy = getTemplateCopy(String(input.templateKey));
  if (!copy) throw new Error("Unknown template");
  const hash = contentHash(copy);
  if (input.contentHash !== hash) throw new Error("This template changed while you were reviewing it. Reload and review the new copy.");
  const approvals = await db.templateApprovals.list(undefined, { templateKey: copy.key });
  if (currentApproval(approvals, copy)) throw new Error("This copy is already approved");
  const previous = latestApproval(approvals, copy.key);
  const version = (previous?.version ?? 0) + 1;
  const record: TemplateApproval = {
    id: `${copy.key}@${version}`,
    templateKey: copy.key,
    version,
    contentHash: hash,
    approvedBy: actor.userId,
    approvedAt: now.toISOString(),
    note: (input.note ?? "").trim(),
  };
  // A concurrent approval of the same version fails on the unique id (and the schema's unique key).
  await db.templateApprovals.insert(record);
  await audit(db, actor, {
    action: "template.approve",
    resourceType: "template",
    resourceId: copy.key,
    detail: { version, previousVersion: previous?.version ?? null, channel: copy.channel, contentHash: hash },
    at: now,
  });
  return record;
}

// ---------- Coverage ----------

/** Step templateKeys in the sequences that have no written copy yet (call tasks use scripts, not templates). */
export function stepsWithoutCopy(): { templateKey: string; channel: string; sequenceId: string }[] {
  const out: { templateKey: string; channel: string; sequenceId: string }[] = [];
  for (const seq of SEQUENCES) {
    for (const s of seq.steps) if (!getTemplateCopy(s.templateKey)) out.push({ templateKey: s.templateKey, channel: s.channel, sequenceId: seq.id });
  }
  return out;
}
