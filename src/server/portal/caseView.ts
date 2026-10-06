/**
 * The lawyer portal's case view. Every case is laid out in the same order so
 * nothing has to be hunted for, and each section is filtered by the viewer's
 * access level before it leaves the server. A lawyer with an open offer gets the
 * conflict card and the non-confidential summary, nothing else.
 *
 * Opening a case is itself an audited event.
 */
import { audit } from "@/server/audit/log";
import { assertCan, canOnLead, leadAccess, readableVisibilities, requireMfa, type LeadAccess } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { clientSummary, summarizePayments, type PaymentStatusSummary } from "@/lib/retainerPlan";
import { MATTER_LABELS } from "@/server/services/leads";
import type {
  Activity,
  Actor,
  Assignment,
  AuditEvent,
  Comment,
  ConflictCard,
  Consult,
  DocumentRecord,
  Engagement,
  Intake,
  Lead,
  PaymentRecord,
  Task,
} from "@/server/types";

export const SECTION_ORDER = [
  "header",
  "summary",
  "redFlags",
  "conflict",
  "household",
  "assets",
  "documents",
  "answers",
  "timeline",
  "comments",
  "consult",
  "engagement",
  "tasks",
  "source",
  "audit",
] as const;
export type SectionKey = (typeof SECTION_ORDER)[number];

export interface CaseHeader {
  leadId: string;
  name: string;
  matterType: string;
  location: string;
  urgent: boolean;
  score: number;
  tier: string;
  /** A/B/C by score; `urgent` is separate */
  grade?: string;
  /** Why the lead scored what it did. Left out of the pre-acceptance view. */
  scoreComponents?: { label: string; points: number }[];
  stage: Lead["stage"];
  assignedLawyer?: string;
  /** For an open offer: when it expires */
  offerExpiresAt?: string;
  offerAssignmentId?: string;
  nextStep: string;
}

/** An engagement with its payments, status and the plain-language summary an attorney can share with the client. */
export interface EngagementView extends Engagement {
  payments: PaymentRecord[];
  paymentStatus: PaymentStatusSummary;
  clientSummary?: { headline: string; lines: string[] };
}

export interface CommentNode extends Comment {
  replies: CommentNode[];
}

export interface CaseView {
  access: LeadAccess;
  header: CaseHeader;
  /** Sections in SECTION_ORDER; a section the viewer may not see is absent, never empty-but-present */
  sections: Partial<{
    summary: { summary: string; goals?: string; offerSummary: string };
    redFlags: { redFlags: string[]; deadlines: Intake["deadlines"] };
    conflict: ConflictCard;
    household: Intake["household"];
    assets: Intake["assets"];
    documents: DocumentRecord[];
    answers: Intake["answers"];
    timeline: Activity[];
    comments: CommentNode[];
    consult: Consult[];
    engagement: EngagementView[];
    tasks: Task[];
    source: Lead["source"];
    audit: AuditEvent[];
  }>;
}

function nextStep(lead: Lead, access: LeadAccess): string {
  if (access === "conflict_card") return "Review the conflict card and accept or decline";
  if (lead.exit) return `Closed: ${lead.exit.reason.replaceAll("_", " ")}`;
  switch (lead.stage) {
    case "new":
    case "contacted":
      return "Intake call";
    case "qualified":
    case "conflict_check":
      return "Run the conflict check";
    case "offered":
      return "Waiting for an attorney to accept";
    case "accepted":
      return "Book the consult";
    case "consult_booked":
      return "Hold the consult";
    case "consult_held":
      return "Draft the engagement";
    case "proposal_sent":
      return "Follow up on the engagement";
    case "retainer_signed":
      return "Collect payment";
    case "paid":
      return "Countersign and start drafting";
    case "drafting":
      return "Finish drafting and schedule the signing";
    case "signing_scheduled":
      return "Hold the signing";
    case "plan_complete":
      return "Send the funding guide";
    case "annual_review":
      return "Offer the annual review";
  }
}

/**
 * Under Postgres row-level security a lawyer holding only an open offer cannot read
 * the lead row at all; the store exposes the offer card through a narrow view
 * instead. This turns that card into a minimal lead carrying nothing confidential,
 * so the same access logic and conflict-card rendering apply to both stores.
 */
type OfferCardRow = Pick<Lead, "id" | "offerSummary" | "conflictCard" | "matterType" | "state" | "county" | "urgent" | "score">;

function leadFromOfferCard(card: OfferCardRow): Lead {
  return {
    ...card,
    personId: "",
    createdAt: "",
    stage: "offered",
    stageHistory: [],
    segments: [],
    source: {},
    consent: { version: "", smsConsent: false, smsConsentText: null, acknowledgedNoRelationship: true, pageUrl: "", ip: null, userAgent: null, capturedAt: "" },
    intake: { summary: "", redFlags: [], deadlines: [], household: { members: [] }, assets: {}, answers: {} },
  };
}

async function readLead(db: Db, leadId: string): Promise<Lead | undefined> {
  const lead = await db.leads.get(leadId);
  if (lead) return lead;
  const pg = db as Db & { leadOfferCard?: (id: string) => Promise<OfferCardRow | undefined> };
  const card = pg.leadOfferCard ? await pg.leadOfferCard(leadId) : undefined;
  return card ? leadFromOfferCard(card) : undefined;
}

async function readOfferCards(db: Db): Promise<Lead[]> {
  const pg = db as Db & { leadOfferCards?: () => Promise<OfferCardRow[]> };
  return pg.leadOfferCards ? (await pg.leadOfferCards()).map(leadFromOfferCard) : [];
}

export function threadComments(comments: Comment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>(comments.map((c) => [c.id, { ...c, replies: [] }]));
  const roots: CommentNode[] = [];
  for (const c of [...nodes.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const parent = c.parentId ? nodes.get(c.parentId) : undefined;
    if (parent) parent.replies.push(c);
    else roots.push(c);
  }
  return roots;
}

export async function buildCaseView(db: Db, actor: Actor, leadId: string, now = new Date()): Promise<CaseView> {
  requireMfa(actor);
  const lead = await readLead(db, leadId);
  if (!lead) throw new Error("Lead not found");
  const assignments = await db.assignments.list(undefined, { leadId });
  const access = leadAccess(actor, lead, assignments, now);
  assertCan(access !== "none");
  await audit(db, actor, { action: "lead.view", resourceType: "lead", resourceId: leadId, leadId, detail: { access }, at: now });

  const person = await db.persons.get(lead.personId);
  const lawyer = lead.assignedLawyerId ? await db.lawyers.get(lead.assignedLawyerId) : undefined;
  const openOffer: Assignment | undefined = assignments.find(
    (a) => a.status === "offered" && a.lawyerId === actor.lawyerId && new Date(a.expiresAt) > now,
  );

  const header: CaseHeader = {
    leadId,
    // Before acceptance the name appears only inside the conflict card, which exists to be checked.
    name: access === "conflict_card" ? "Prospective client" : `${person?.firstName ?? ""} ${person?.lastName ?? ""}`.trim(),
    matterType: MATTER_LABELS[lead.matterType],
    location: lead.county ? `${lead.county} County, ${lead.state}` : lead.state,
    urgent: lead.urgent,
    score: lead.score.score,
    tier: lead.score.tier,
    grade: lead.score.grade,
    scoreComponents: access === "conflict_card" ? undefined : lead.score.components?.map((c) => ({ label: c.label, points: c.points })),
    stage: lead.stage,
    assignedLawyer: lawyer?.name,
    offerExpiresAt: openOffer?.expiresAt,
    offerAssignmentId: openOffer?.id,
    nextStep: nextStep(lead, access),
  };

  const view: CaseView = { access, header, sections: {} };
  const s = view.sections;

  if (access === "conflict_card") {
    s.summary = { summary: "", offerSummary: lead.offerSummary };
    s.conflict = lead.conflictCard;
    return view;
  }

  const client = access === "client";
  const can = (a: Parameters<typeof canOnLead>[1]) => canOnLead(actor, a, lead, assignments, now);

  s.summary = { summary: lead.intake.summary, goals: lead.intake.goals, offerSummary: lead.offerSummary };
  if (!client) {
    s.redFlags = { redFlags: lead.intake.redFlags, deadlines: lead.intake.deadlines };
    s.conflict = lead.conflictCard;
    s.household = lead.intake.household;
    s.assets = lead.intake.assets;
  }
  if (can("view_documents")) {
    const visible = client ? ["client"] : ["internal", "firm", "client"];
    s.documents = (await db.documents.list((d) => d.leadId === leadId && visible.includes(d.visibility) && d.scanStatus !== "infected", { leadId }))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }
  if (!client) s.answers = lead.intake.answers;
  if (!client) s.timeline = (await db.activities.list(undefined, { leadId })).sort((a, b) => a.at.localeCompare(b.at));
  const readable = readableVisibilities(actor);
  s.comments = threadComments(await db.comments.list((c) => c.leadId === leadId && readable.includes(c.visibility)));
  s.consult = (await db.consults.list(undefined, { leadId })).sort((a, b) => a.at.localeCompare(b.at));
  if (client) s.consult = s.consult.map(({ notes: _n, ...c }) => c);
  if (can("view_engagement")) {
    const engagements = await db.engagements.list(undefined, { leadId });
    // Clients see what was sent to them, not drafts the attorney has not approved.
    const shown = client ? engagements.filter((e) => !["draft", "approved"].includes(e.status)) : engagements;
    s.engagement = await Promise.all(
      shown.map(async (e): Promise<EngagementView> => {
        const payments = (await db.payments.list(undefined, { engagementId: e.id })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return {
          ...e,
          payments,
          paymentStatus: summarizePayments(e.paymentPlan, payments),
          clientSummary: e.packageSelection && e.paymentPlan ? clientSummary(e.packageSelection, e.paymentPlan) : undefined,
        };
      }),
    );
  }
  if (!client) s.tasks = (await db.tasks.list(undefined, { leadId })).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  if (!client) {
    s.source = {
      ...lead.source,
      captureTool: lead.capture?.tool,
      captureResource: lead.capture?.resource,
      priorTools: lead.priorTools?.length ? lead.priorTools.join(", ") : undefined,
    };
  }
  if (can("view_audit")) s.audit = await db.audit.list(undefined, { leadId });
  return view;
}

/** Leads an actor can see, for the portal dashboard and queues. */
export async function visibleLeads(db: Db, actor: Actor, now = new Date()): Promise<{ lead: Lead; access: LeadAccess }[]> {
  requireMfa(actor);
  const assignments = await db.assignments.list();
  const leads = await db.leads.list();
  const seen = new Set(leads.map((l) => l.id));
  const cards = (await readOfferCards(db)).filter((c) => !seen.has(c.id));
  return [...leads, ...cards]
    .map((lead) => ({ lead, access: leadAccess(actor, lead, assignments.filter((a) => a.leadId === lead.id), now) }))
    .filter((x) => x.access !== "none");
}

export interface Dashboard {
  offers: { assignmentId: string; leadId: string; offerSummary: string; expiresAt: string; urgent: boolean }[];
  todaysConsults: Consult[];
  awaitingSignature: Engagement[];
  drafting: { leadId: string; name: string }[];
  overdueTasks: Task[];
  metrics: { acceptedOffers: number; avgAcceptMinutes: number | null; showRate: number | null; signedRate: number | null };
}

/** The attorney's home screen: offers with countdowns, today's consults, open signatures, drafting, overdue tasks. */
export async function lawyerDashboard(db: Db, actor: Actor, now = new Date()): Promise<Dashboard> {
  requireMfa(actor);
  assertCan(actor.role === "attorney" && !!actor.lawyerId, "The dashboard is for attorneys");
  const lawyerId = actor.lawyerId!;
  const mine = await db.assignments.list(undefined, { lawyerId });
  const offers = (
    await Promise.all(
      mine
        .filter((a) => a.status === "offered" && new Date(a.expiresAt) > now)
        .map(async (a) => {
          const lead = (await readLead(db, a.leadId))!;
          return { assignmentId: a.id, leadId: a.leadId, offerSummary: lead.offerSummary, expiresAt: a.expiresAt, urgent: lead.urgent };
        }),
    )
  ).sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.expiresAt.localeCompare(b.expiresAt));
  const day = now.toISOString().slice(0, 10);
  const consults = await db.consults.list(undefined, { lawyerId });
  const todaysConsults = consults.filter((c) => c.at.slice(0, 10) === day && c.status === "booked");
  const engagements = await db.engagements.list(undefined, { lawyerId });
  const awaitingSignature = engagements.filter((e) => e.status === "sent" || e.status === "viewed");
  const myLeads = await db.leads.list(undefined, { assignedLawyerId: lawyerId });
  const drafting = await Promise.all(
    myLeads
      .filter((l) => l.stage === "drafting")
      .map(async (l) => {
        const p = await db.persons.get(l.personId);
        return { leadId: l.id, name: `${p?.firstName ?? ""} ${p?.lastName ?? ""}`.trim() };
      }),
  );
  const myLeadIds = new Set(myLeads.map((l) => l.id));
  const overdueTasks = await db.tasks.list((t) => myLeadIds.has(t.leadId) && !t.doneAt && new Date(t.dueAt) < now);

  const accepted = mine.filter((a) => a.status === "accepted" && a.respondedAt);
  const avgAcceptMinutes = accepted.length
    ? Math.round(accepted.reduce((s, a) => s + (new Date(a.respondedAt!).getTime() - new Date(a.offeredAt).getTime()) / 60_000, 0) / accepted.length)
    : null;
  const finished = consults.filter((c) => c.status === "held" || c.status === "no_show");
  const showRate = finished.length ? finished.filter((c) => c.status === "held").length / finished.length : null;
  const signed = engagements.filter((e) => ["signed", "paid", "countersigned"].includes(e.status)).length;
  const signedRate = accepted.length ? signed / accepted.length : null;
  await audit(db, actor, { action: "dashboard.view", resourceType: "lawyer", resourceId: lawyerId, at: now });
  return { offers, todaysConsults, awaitingSignature, drafting, overdueTasks, metrics: { acceptedOffers: accepted.length, avgAcceptMinutes, showRate, signedRate } };
}
