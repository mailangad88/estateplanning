/**
 * The pipeline board (/admin/pipeline): every lead the viewer may see, one row each, by stage, with the
 * assigned lawyer, days in stage, retainer status and last activity. Rows come from visibleLeads, so the
 * usual leadAccess rules decide who sees what: a platform admin sees every lead, a firm admin only their
 * firm's accepted leads plus open offers to their firm (shown without a name, as the offer card is).
 * Shows the first name only; the case page holds the rest.
 */
import { audit } from "@/server/audit/log";
import { assertCan, can } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { visibleLeads } from "@/server/portal/caseView";
import { MATTER_LABELS } from "@/server/services/leads";
import { RANK } from "@/server/services/engagementShared";
import type { Actor, Engagement, Lead, MatterType, Stage } from "@/server/types";

export const PIPELINE_COLUMNS = [
  { key: "new", label: "New" },
  { key: "offered", label: "Offered" },
  { key: "accepted", label: "Accepted by lawyer" },
  { key: "consult_booked", label: "Consult booked" },
  { key: "consult_held", label: "Consult held" },
  { key: "retainer_sent", label: "Retainer sent" },
  { key: "retainer_signed", label: "Retainer signed" },
  { key: "paid", label: "Paid" },
  { key: "lost", label: "Lost or declined" },
] as const;
export type PipelineColumn = (typeof PIPELINE_COLUMNS)[number]["key"];

export type RetainerStatus = "not_sent" | "draft" | "sent" | "viewed" | "signed" | "countersigned" | "voided";
export const RETAINER_LABELS: Record<RetainerStatus, string> = {
  not_sent: "Not sent",
  draft: "Being prepared",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  countersigned: "Countersigned",
  voided: "Withdrawn",
};

export function columnFor(lead: Lead): PipelineColumn {
  if (lead.exit) return "lost";
  switch (lead.stage) {
    case "new":
    case "contacted":
    case "qualified":
    case "conflict_check":
      return "new";
    case "offered":
      return "offered";
    case "accepted":
      return "accepted";
    case "consult_booked":
      return "consult_booked";
    case "consult_held":
      return "consult_held";
    case "proposal_sent":
      return "retainer_sent";
    case "retainer_signed":
      return "retainer_signed";
    default:
      return "paid"; // paid, drafting, signing, complete, annual review
  }
}

/** The retainer status from the newest engagement that is not withdrawn (or the newest one, if all are). */
export function retainerStatus(engagements: Engagement[]): RetainerStatus {
  if (engagements.length === 0) return "not_sent";
  const latest = (xs: Engagement[]) => [...xs].sort((a, b) => (b.history[0]?.at ?? "").localeCompare(a.history[0]?.at ?? ""))[0];
  const live = engagements.filter((e) => e.status !== "voided");
  if (live.length === 0) return "voided";
  const e = latest(live);
  if (e.status === "draft" || e.status === "approved") return "draft";
  if (e.status === "countersigned") return "countersigned";
  if (RANK[e.status] >= RANK.signed) return "signed"; // signed or paid
  return e.status === "viewed" ? "viewed" : "sent";
}

export interface PipelineRow {
  leadId: string;
  /** First name, or "Prospective client" for an open offer */
  label: string;
  matter: string;
  matterType: MatterType;
  state: string;
  urgent: boolean;
  lawyerId?: string;
  lawyerName?: string;
  firmName?: string;
  stage: Stage;
  column: PipelineColumn;
  exitReason?: string;
  daysInStage: number;
  retainer: RetainerStatus;
  lastActivityAt: string;
  createdAt: string;
  offerOnly: boolean;
}

export interface PipelineFilters {
  lawyerId?: string;
  column?: PipelineColumn;
  /** YYYY-MM-DD, on the lead's created date */
  from?: string;
  to?: string;
}

export interface PipelineBoard {
  rows: PipelineRow[];
  counts: Record<PipelineColumn, number>;
  lawyers: { id: string; name: string }[];
  total: number;
}

const DAY = 86_400_000;

export async function pipelineBoard(db: Db, actor: Actor, filters: PipelineFilters = {}, now = new Date()): Promise<PipelineBoard> {
  assertCan(can(actor, "view_pipeline"), "The pipeline is for platform and firm admins");
  const visible = await visibleLeads(db, actor, now);
  const engagements = await db.engagements.list();
  const activities = await db.activities.list();
  const lawyers = new Map((await db.lawyers.list()).map((l) => [l.id, l]));
  const firms = new Map((await db.firms.list()).map((f) => [f.id, f]));

  const rows: PipelineRow[] = [];
  for (const { lead, access } of visible) {
    const offerOnly = access === "conflict_card";
    const person = offerOnly ? undefined : await db.persons.get(lead.personId);
    const mine = offerOnly ? [] : engagements.filter((e) => e.leadId === lead.id);
    const lastStage = lead.stageHistory[lead.stageHistory.length - 1]?.at ?? lead.createdAt;
    const touched = [
      lead.createdAt,
      lastStage,
      ...(offerOnly ? [] : activities.filter((a) => a.leadId === lead.id).map((a) => a.at)),
      ...mine.flatMap((e) => e.history.map((h) => h.at)),
      lead.exit?.at ?? "",
    ].filter(Boolean).sort();
    const lawyer = lead.assignedLawyerId ? lawyers.get(lead.assignedLawyerId) : undefined;
    rows.push({
      leadId: lead.id,
      label: offerOnly ? "Prospective client" : (person?.firstName ?? "Client"),
      matter: MATTER_LABELS[lead.matterType],
      matterType: lead.matterType,
      state: lead.state,
      urgent: lead.urgent,
      lawyerId: lawyer?.id,
      lawyerName: lawyer?.name,
      firmName: lead.firmId ? firms.get(lead.firmId)?.name : undefined,
      stage: lead.stage,
      column: columnFor(lead),
      exitReason: lead.exit?.reason.replaceAll("_", " "),
      daysInStage: Math.max(0, Math.floor((now.getTime() - new Date(lead.exit?.at ?? lastStage).getTime()) / DAY)),
      retainer: retainerStatus(mine),
      lastActivityAt: touched[touched.length - 1],
      createdAt: lead.createdAt,
      offerOnly,
    });
  }

  const inDates = (r: PipelineRow) => (!filters.from || r.createdAt.slice(0, 10) >= filters.from) && (!filters.to || r.createdAt.slice(0, 10) <= filters.to);
  const byLawyer = (r: PipelineRow) => !filters.lawyerId || r.lawyerId === filters.lawyerId;
  const base = rows.filter((r) => inDates(r) && byLawyer(r));
  const counts = Object.fromEntries(PIPELINE_COLUMNS.map((c) => [c.key, base.filter((r) => r.column === c.key).length])) as Record<PipelineColumn, number>;
  const shown = base
    .filter((r) => !filters.column || r.column === filters.column)
    .sort((a, b) => PIPELINE_COLUMNS.findIndex((c) => c.key === a.column) - PIPELINE_COLUMNS.findIndex((c) => c.key === b.column) || b.lastActivityAt.localeCompare(a.lastActivityAt));
  const lawyerOptions = [...new Map(rows.filter((r) => r.lawyerId).map((r) => [r.lawyerId!, r.lawyerName ?? r.lawyerId!])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  await audit(db, actor, { action: "pipeline.view", resourceType: "pipeline", resourceId: actor.firmId ?? "all", detail: { rows: shown.length }, at: now });
  return { rows: shown, counts, lawyers: lawyerOptions, total: base.length };
}
