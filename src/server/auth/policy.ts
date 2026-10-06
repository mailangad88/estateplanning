/**
 * Who can see and do what. This is the single place access rules live; every
 * service and API route calls it, and db/schema.sql repeats the same rules as
 * row-level security so a bug here cannot leak data on its own.
 *
 * Roles follow the "Lawyer portal and permissions" table in the plan.
 */
import type { Actor, Assignment, Lead, Partner, Role, Visibility } from "@/server/types";

export class ForbiddenError extends Error {
  constructor(message = "You do not have access to this") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * How much of a lead an actor may see.
 * - full: the whole case
 * - intake: intake fields, comments and timeline, but not engagement fees or documents
 * - conflict_card: conflict card and non-confidential summary only (an open offer)
 * - client: the client's own matter, without internal comments
 * - none
 */
export type LeadAccess = "none" | "conflict_card" | "intake" | "full" | "client";

function openOfferFor(assignments: Assignment[], leadId: string, pick: (a: Assignment) => boolean, now: Date) {
  return assignments.some(
    (a) => a.leadId === leadId && a.status === "offered" && new Date(a.expiresAt) > now && pick(a),
  );
}

export function leadAccess(actor: Actor, lead: Lead, assignments: Assignment[], now = new Date()): LeadAccess {
  switch (actor.role) {
    case "platform_admin":
      return "full";
    case "intake":
      // Intake works leads in their queue: their own, or ones nobody has claimed yet.
      return !lead.intakeOwnerId || lead.intakeOwnerId === actor.userId ? "intake" : "none";
    case "marketing":
      return "none";
    case "firm_admin":
      if (actor.firmId && lead.firmId === actor.firmId && lead.assignedLawyerId) return "full";
      if (actor.firmId && openOfferFor(assignments, lead.id, (a) => a.firmId === actor.firmId, now)) return "conflict_card";
      return "none";
    case "attorney":
      if (actor.lawyerId && lead.assignedLawyerId === actor.lawyerId) return "full";
      if (actor.lawyerId && openOfferFor(assignments, lead.id, (a) => a.lawyerId === actor.lawyerId, now)) return "conflict_card";
      return "none";
    case "paralegal":
      return lead.assignedLawyerId && actor.supportsLawyerIds?.includes(lead.assignedLawyerId) ? "full" : "none";
    case "client":
      return actor.personId && lead.personId === actor.personId ? "client" : "none";
  }
}

/**
 * A visitor's "My family plan" organizer, once linked to their lead. Staff who can work the lead's
 * intake or the whole case see its summary (counts, ranges, gaps), never the answers themselves.
 * Clients, marketing and offer-stage lawyers do not. The visitor's own access is not an Actor at
 * all: it is a separate plan session (src/server/services/familyPlan.ts) that reaches nothing else.
 * Mirrors family_plans_staff_select in db/schema.sql.
 */
export function canViewFamilyPlanSummary(actor: Actor, lead: Lead, assignments: Assignment[], now = new Date()): boolean {
  const access = leadAccess(actor, lead, assignments, now);
  return access === "full" || access === "intake";
}

export type LeadAction =
  | "view"
  | "respond_to_offer"
  | "comment"
  | "edit_intake"
  | "book_consult"
  | "upload_document"
  | "view_documents"
  | "draft_engagement"
  | "approve_engagement"
  | "view_engagement"
  | "manage_tasks"
  | "view_audit"
  | "export";

export function canOnLead(actor: Actor, action: LeadAction, lead: Lead, assignments: Assignment[], now = new Date()): boolean {
  const access = leadAccess(actor, lead, assignments, now);
  if (access === "none") return false;
  switch (action) {
    case "view":
      return true;
    case "respond_to_offer":
      return actor.role === "attorney" && access === "conflict_card";
    case "comment":
      return access !== "conflict_card";
    case "edit_intake":
      return access === "intake" || actor.role === "platform_admin";
    case "book_consult":
      return access === "intake" || (access === "full" && actor.role !== "firm_admin");
    case "upload_document":
      return access === "full" || access === "client" || (access === "intake" && !lead.assignedLawyerId);
    case "view_documents":
      return access === "full" || access === "client";
    case "draft_engagement":
      return access === "full" && (actor.role === "attorney" || actor.role === "paralegal");
    case "approve_engagement":
      // Only the assigned attorney approves the engagement and its fee. Never a paralegal, never automatic.
      return actor.role === "attorney" && access === "full";
    case "view_engagement":
      // Also covers the engagement's payments and plan (payments_select in db/schema.sql). Refunds and
      // pricing use approve_engagement: only the assigned attorney moves client money or sets a fee.
      return access === "full" || access === "client";
    case "manage_tasks":
      return access === "full" || access === "intake";
    case "view_audit":
      return actor.role === "platform_admin" || (actor.role === "firm_admin" && access === "full");
    case "export":
      return actor.role === "platform_admin" && process.env.PORTAL_EXPORT_ENABLED === "true";
  }
}

export type GlobalAction =
  | "configure_routing"
  | "manage_fee_rules"
  | "approve_fee_rule"
  | "manage_users"
  | "view_reports"
  | "view_lead_health"
  | "view_conversions"
  | "manage_conversions"
  | "view_review_tracking"
  | "manage_reviews"
  | "manage_content"
  | "view_invoices"
  | "manage_firm_capacity"
  | "work_intake_queue"
  | "verify_facts"
  | "approve_templates"
  | "manage_seminars"
  | "view_partners"
  | "manage_partners";

const GLOBAL: Record<GlobalAction, Role[]> = {
  configure_routing: ["platform_admin"],
  manage_fee_rules: ["platform_admin"],
  approve_fee_rule: ["platform_admin"],
  manage_users: ["platform_admin", "firm_admin"],
  view_reports: ["platform_admin", "marketing", "firm_admin"],
  view_lead_health: ["platform_admin", "firm_admin"],
  // Ad-platform conversions carry ids, times and fee values: marketing reads, only platform admins export or retry.
  view_conversions: ["platform_admin", "marketing"],
  manage_conversions: ["platform_admin"],
  // The "asked everyone" proof is an audit view. Recording "I posted" or a review opt-out follows a client's own word.
  view_review_tracking: ["platform_admin", "firm_admin"],
  manage_reviews: ["platform_admin", "intake", "firm_admin"],
  manage_content: ["platform_admin", "marketing"],
  view_invoices: ["platform_admin", "firm_admin"],
  manage_firm_capacity: ["platform_admin", "firm_admin"],
  work_intake_queue: ["platform_admin", "intake"],
  // Approving a state fact or dollar figure for publication is a legal judgment: attorneys and platform admins only.
  verify_facts: ["platform_admin", "attorney"],
  // Approving client-facing nurture copy is a legal judgment too. Mirrors the template_approvals RLS policies.
  approve_templates: ["platform_admin", "attorney"],
  // Seminar costs and counts are marketing data; readouts are totals only.
  manage_seminars: ["platform_admin", "marketing"],
  // Referral partners, their gift log and release status. Mirrors the partners RLS policies.
  view_partners: ["platform_admin", "firm_admin"],
  manage_partners: ["platform_admin", "firm_admin"],
};

export function can(actor: Actor, action: GlobalAction): boolean {
  return GLOBAL[action].includes(actor.role);
}

/**
 * One partner record. Platform admins see every partner; firm admins only those of their own firm
 * (a partner with no firm is platform-only). Mirrors partners_admin in db/schema.sql.
 */
export function canOnPartner(actor: Actor, action: "view" | "manage", partner: Pick<Partner, "firmId">): boolean {
  if (!can(actor, action === "view" ? "view_partners" : "manage_partners")) return false;
  if (actor.role === "platform_admin") return true;
  return !!actor.firmId && partner.firmId === actor.firmId;
}

export function assertCan(ok: boolean, message?: string): void {
  if (!ok) throw new ForbiddenError(message);
}

/** Comment visibilities an actor may read. */
export function readableVisibilities(actor: Actor): Visibility[] {
  switch (actor.role) {
    case "platform_admin":
    case "intake":
      return ["internal", "firm", "client"];
    case "client":
      return ["client"];
    case "marketing":
      return [];
    default:
      return ["firm", "client"];
  }
}

/** Comment visibilities an actor may write. Intake comments default to "firm" so they travel with the lead. */
export function writableVisibilities(actor: Actor): Visibility[] {
  return actor.role === "client" ? ["client"] : readableVisibilities(actor);
}

export function defaultVisibility(actor: Actor): Visibility {
  return actor.role === "client" ? "client" : "firm";
}

/** Portal sessions must pass a second factor outside development. */
export function requireMfa(actor: Actor): void {
  if (!actor.mfa && process.env.NODE_ENV === "production") throw new ForbiddenError("Two-step sign-in is required");
}
