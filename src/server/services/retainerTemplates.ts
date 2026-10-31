/**
 * A receiving firm's own retainer templates.
 *
 * - Each save is a new version; a saved version's wording never changes (retainer_template_guard).
 * - A version is used only after an attorney of the same firm approves that exact version ("approved by me").
 *   Approving a new version supersedes the one before it and carries its default matter types forward.
 * - One default per matter type per firm. With no default, the most recently approved template for the
 *   matter type is used; with none at all, the platform's fallback letter (renderLetter) is used.
 * - An optional PDF of the firm's own standard agreement rides along with every letter from that version,
 *   shown to the client in full and bound into the signature by its sha256.
 *
 * The wording of a template is the receiving attorney's responsibility. Audit details hold ids, versions and
 * hashes only, never the wording.
 */
import { randomUUID } from "node:crypto";
import { fillTemplate, isMergeField, stateName, type MergeFieldKey, type MergeValues } from "@/lib/retainerTemplates";
import { money, type PackageSelection, type PaymentPlan } from "@/lib/retainerPlan";
import { audit } from "@/server/audit/log";
import { assertCan, can, canOnRetainerTemplate, ForbiddenError } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { isPdf, MAX_AGREEMENT_PDF_BYTES, putBlob, sha256Hex } from "@/server/storage/blobs";
import { organizerSummaryForLead } from "@/server/services/familyPlan";
import { MATTER_LABELS } from "@/server/services/leads";
import type { Actor, EngagementAttachment, Lead, MatterType, RetainerTemplate } from "@/server/types";

const MATTERS = Object.keys(MATTER_LABELS) as MatterType[];
const MAX_BODY = 60_000;

export class TemplateInputError extends Error {}

export interface SaveTemplateInput {
  /** Omit to start a new template; give it to save the next version of an existing one */
  templateKey?: string;
  name: string;
  matterTypes: string[];
  body: string;
  /** A PDF uploaded with uploadAgreementPdf. Omit to keep the previous version's; null to remove it. */
  pdf?: EngagementAttachment | null;
}

function firmOf(actor: Actor): string {
  if (!actor.firmId) throw new ForbiddenError("Retainer templates belong to a firm");
  return actor.firmId;
}

async function getTemplate(db: Db, id: string): Promise<RetainerTemplate> {
  const t = await db.retainerTemplates.get(id);
  if (!t) throw new Error("Template not found");
  return t;
}

/** Stores the firm's own agreement PDF. `db` must be the service-role store (stored_blobs has no user policy). */
export async function uploadAgreementPdf(db: Db, actor: Actor, input: { name: string; bytes: Uint8Array }, now = new Date()): Promise<EngagementAttachment> {
  assertCan(can(actor, "manage_retainer_templates"));
  const firmId = firmOf(actor);
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_AGREEMENT_PDF_BYTES) throw new TemplateInputError("The PDF must be under 5 MB");
  if (!isPdf(input.bytes)) throw new TemplateInputError("Upload a PDF file");
  const sha256 = sha256Hex(input.bytes);
  const key = `retainer-templates/${firmId}/${sha256}.pdf`;
  await putBlob(db, { key, bytes: input.bytes, contentType: "application/pdf", createdBy: actor.userId, firmId }, now);
  const name = (input.name.trim() || "Agreement.pdf").replace(/[^\w .()-]/g, "_").slice(0, 120);
  await audit(db, actor, { action: "retainer_template.pdf_upload", resourceType: "stored_blob", resourceId: key, detail: { sha256 }, at: now });
  return { name, storageKey: key, sha256, sizeBytes: input.bytes.byteLength };
}

export async function saveTemplateVersion(db: Db, actor: Actor, input: SaveTemplateInput, now = new Date(), blobs: Db = db): Promise<RetainerTemplate> {
  assertCan(can(actor, "manage_retainer_templates"));
  const firmId = firmOf(actor);
  const name = input.name.trim();
  if (!name || name.length > 120) throw new TemplateInputError("Give the template a name (up to 120 characters)");
  const body = input.body.replace(/\r\n/g, "\n");
  if (!body.trim() || body.length > MAX_BODY) throw new TemplateInputError("The template text is empty or too long");
  const matterTypes = [...new Set(input.matterTypes)].filter((m): m is MatterType => (MATTERS as string[]).includes(m));
  if (matterTypes.length === 0) throw new TemplateInputError("Pick at least one matter type");

  let templateKey = input.templateKey;
  let version = 1;
  let pdf = input.pdf ?? undefined;
  if (templateKey) {
    const versions = await db.retainerTemplates.list(undefined, { templateKey });
    if (versions.length === 0) throw new Error("Template not found");
    if (!versions.every((v) => canOnRetainerTemplate(actor, "manage", v))) throw new ForbiddenError("This template belongs to another firm");
    const latest = versions.sort((a, b) => b.version - a.version)[0];
    version = latest.version + 1;
    if (input.pdf === undefined) pdf = latest.pdf;
  } else {
    templateKey = `rt_${randomUUID()}`;
  }
  if (pdf && input.pdf) {
    // A newly attached PDF must be one this firm uploaded.
    const blob = await blobs.blobs.get(pdf.storageKey);
    if (!blob || blob.firmId !== firmId || blob.sha256 !== pdf.sha256) throw new ForbiddenError("Upload the PDF again");
  }
  const t: RetainerTemplate = {
    id: `${templateKey}@${version}`,
    firmId,
    templateKey,
    version,
    name,
    matterTypes,
    body,
    bodySha256: sha256Hex(body),
    pdf,
    status: "draft",
    defaultFor: [],
    createdBy: actor.userId,
    createdAt: now.toISOString(),
  };
  await db.retainerTemplates.insert(t);
  await audit(db, actor, {
    action: "retainer_template.save",
    resourceType: "retainer_template",
    resourceId: t.id,
    detail: { version, bodySha256: t.bodySha256, ...(pdf ? { pdfSha256: pdf.sha256 } : {}) },
    at: now,
  });
  return t;
}

/** "Approved by me": an attorney of the firm stands behind this exact version. Supersedes the previous approved version. */
export async function approveTemplate(db: Db, actor: Actor, id: string, now = new Date()): Promise<RetainerTemplate> {
  const t = await getTemplate(db, id);
  assertCan(canOnRetainerTemplate(actor, "approve", t), "Only an attorney of this firm can approve its retainer template");
  if (t.status !== "draft") throw new Error(`This version is already ${t.status}`);
  const check = fillTemplate(t.body, {});
  if (check.unknown.length) throw new TemplateInputError(`Fix the unknown fields first: ${check.unknown.map((u) => `{{${u}}}`).join(", ")}`);
  const user = await db.users.get(actor.userId);
  const previous = (await db.retainerTemplates.list(undefined, { templateKey: t.templateKey })).filter((v) => v.status === "approved");
  const at = now.toISOString();
  for (const p of previous) await db.retainerTemplates.update(p.id, { status: "superseded" });
  const carried = [...new Set(previous.flatMap((p) => p.defaultFor))].filter((m) => t.matterTypes.includes(m));
  const next = await db.retainerTemplates.update(t.id, {
    status: "approved",
    approvedBy: actor.userId,
    approvedByName: user?.name ?? actor.userId,
    approvedAt: at,
    defaultFor: carried,
  });
  await audit(db, actor, {
    action: "retainer_template.approve",
    resourceType: "retainer_template",
    resourceId: t.id,
    detail: { version: t.version, bodySha256: t.bodySha256, ...(t.pdf ? { pdfSha256: t.pdf.sha256 } : {}), superseded: previous.map((p) => p.id) },
    at: now,
  });
  return next;
}

/** Makes an approved version the firm's default for a matter type (or stops it being one). */
export async function setTemplateDefault(db: Db, actor: Actor, id: string, matterType: MatterType, on: boolean, now = new Date()): Promise<RetainerTemplate> {
  const t = await getTemplate(db, id);
  assertCan(canOnRetainerTemplate(actor, "manage", t));
  if (t.status !== "approved") throw new Error("Approve this version before making it the default");
  if (!t.matterTypes.includes(matterType)) throw new TemplateInputError("This template does not cover that matter type");
  if (on) {
    for (const other of await db.retainerTemplates.list((x) => x.id !== t.id && x.defaultFor.includes(matterType), { firmId: t.firmId })) {
      await db.retainerTemplates.update(other.id, { defaultFor: other.defaultFor.filter((m) => m !== matterType) });
    }
  }
  const defaultFor = on ? [...new Set([...t.defaultFor, matterType])] : t.defaultFor.filter((m) => m !== matterType);
  const next = await db.retainerTemplates.update(t.id, { defaultFor });
  await audit(db, actor, { action: "retainer_template.default", resourceType: "retainer_template", resourceId: t.id, detail: { matterType, on }, at: now });
  return next;
}

export async function retireTemplate(db: Db, actor: Actor, id: string, now = new Date()): Promise<RetainerTemplate> {
  const t = await getTemplate(db, id);
  assertCan(canOnRetainerTemplate(actor, "manage", t));
  if (t.status !== "draft" && t.status !== "approved") throw new Error(`This version is already ${t.status}`);
  const next = await db.retainerTemplates.update(t.id, { status: "retired", defaultFor: [] });
  await audit(db, actor, { action: "retainer_template.retire", resourceType: "retainer_template", resourceId: t.id, at: now });
  return next;
}

export interface TemplateSummary {
  templateKey: string;
  name: string;
  /** Newest version, whatever its status */
  latest: RetainerTemplate;
  /** The version in use, if one is approved */
  approved?: RetainerTemplate;
  versions: { id: string; version: number; status: RetainerTemplate["status"]; createdAt: string; approvedByName?: string; approvedAt?: string }[];
}

/** The firm's templates, grouped by template with the newest version first. */
export async function listFirmTemplates(db: Db, actor: Actor, firmId = actor.firmId): Promise<TemplateSummary[]> {
  assertCan(can(actor, "view_retainer_templates"));
  if (!firmId) return [];
  if (actor.role !== "platform_admin" && firmId !== actor.firmId) throw new ForbiddenError();
  const rows = await db.retainerTemplates.list(undefined, { firmId });
  const byKey = new Map<string, RetainerTemplate[]>();
  for (const r of rows) byKey.set(r.templateKey, [...(byKey.get(r.templateKey) ?? []), r]);
  return [...byKey.values()]
    .map((vs) => {
      const sorted = vs.sort((a, b) => b.version - a.version);
      return {
        templateKey: sorted[0].templateKey,
        name: sorted[0].name,
        latest: sorted[0],
        approved: sorted.find((v) => v.status === "approved"),
        versions: sorted.map((v) => ({ id: v.id, version: v.version, status: v.status, createdAt: v.createdAt, approvedByName: v.approvedByName, approvedAt: v.approvedAt })),
      };
    })
    .filter((s) => s.latest.status !== "retired" || s.approved)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The approved template a firm uses for a matter type: its default, else the most recently approved. */
export async function pickTemplate(db: Db, firmId: string, matterType: MatterType): Promise<RetainerTemplate | undefined> {
  const usable = await db.retainerTemplates.list((t) => t.matterTypes.includes(matterType), { firmId, status: "approved" });
  return usable.find((t) => t.defaultFor.includes(matterType)) ?? usable.sort((a, b) => (b.approvedAt ?? "").localeCompare(a.approvedAt ?? ""))[0];
}

/** A template chosen by id for a lead: it must be this firm's, approved, and cover the lead's matter type. */
export async function templateForLead(db: Db, templateId: string, firmId: string, matterType: MatterType): Promise<RetainerTemplate> {
  const t = await db.retainerTemplates.get(templateId);
  if (!t || t.firmId !== firmId) throw new ForbiddenError("That template belongs to another firm");
  if (t.status !== "approved") throw new Error("That template version is not approved by an attorney of the firm");
  if (!t.matterTypes.includes(matterType)) throw new Error("That template does not cover this matter type");
  return t;
}

export function planText(plan: PaymentPlan | undefined): string | undefined {
  if (!plan) return undefined;
  if (plan.mode === "full") return `${money(plan.totalCents)} in one payment when you sign`;
  const [dep, ...rest] = plan.installments;
  const first = rest[0].amountCents;
  const last = rest[rest.length - 1].amountCents;
  return `${money(dep.amountCents)} deposit when you sign, then ${rest.length} monthly payment${rest.length === 1 ? "" : "s"} of ${money(first)}${last !== first ? ` (the last is ${money(last)})` : ""}, with no interest`;
}

export interface MergeContext {
  packageName: string;
  feeCents: number;
  selection?: PackageSelection;
  plan?: PaymentPlan;
  spouseName?: string;
  /** Values the lawyer typed in for missing fields; they override anything filled from the record */
  overrides?: Record<string, string>;
}

/**
 * Everything the client already told us, as merge values: contact details, matter, package and fee, payment
 * plan, the intake summary and the organizer summary (counts and gaps only). Address is not collected at
 * intake, so a template that uses it asks the lawyer to fill it in.
 */
export async function mergeValuesForLead(db: Db, actor: Actor, lead: Lead, ctx: MergeContext, now = new Date()): Promise<MergeValues> {
  const person = await db.persons.get(lead.personId);
  const lawyer = lead.assignedLawyerId ? await db.lawyers.get(lead.assignedLawyerId) : undefined;
  const firmRow = lead.firmId ? await db.firms.get(lead.firmId) : undefined;
  const organizer = await organizerSummaryForLead(db, actor, lead, await db.assignments.list(undefined, { leadId: lead.id }), now);
  const name = person ? `${person.firstName} ${person.lastName}`.trim() : "";
  const addOns = ctx.selection?.addOns.length ? ` (add-on${ctx.selection.addOns.length > 1 ? "s" : ""}: ${ctx.selection.addOns.map((a) => a.name).join(", ")})` : "";
  const intakeSummary = [lead.intake.summary?.trim(), lead.intake.goals ? `In their words: "${lead.intake.goals.trim()}"` : ""].filter(Boolean).join("\n");
  const values: MergeValues = {
    client_names: ctx.spouseName?.trim() ? `${name} and ${ctx.spouseName.trim()}` : name,
    client_email: person?.email,
    client_phone: person?.phone,
    client_state: stateName(lead.state),
    matter_type: MATTER_LABELS[lead.matterType],
    package: `${ctx.packageName}${addOns}`,
    flat_fee: money(ctx.feeCents),
    payment_plan: planText(ctx.plan) ?? "paid in full through the payment link sent with this agreement",
    intake_summary: intakeSummary || undefined,
    organizer_summary: organizer
      ? `Organizer: ${organizer.summary.sectionsDone} of ${organizer.summary.sectionsTotal} sections done; ${organizer.summary.gaps.length} gap${organizer.summary.gaps.length === 1 ? "" : "s"} flagged${organizer.summary.gaps.length ? ` (${organizer.summary.gaps.map((g) => g.text).join("; ")})` : ""}.`
      : "The client has not shared a family plan organizer.",
    date: now.toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" }),
    attorney_name: lawyer?.name,
    firm_name: firmRow?.name,
  };
  for (const [k, v] of Object.entries(ctx.overrides ?? {})) {
    if (isMergeField(k) && typeof v === "string" && v.trim()) values[k as MergeFieldKey] = v.trim().slice(0, 2000);
  }
  return values;
}
