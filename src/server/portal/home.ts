/**
 * The staff portal home: today's counts, the work waiting on the signed-in person, and recent leads by name.
 * Role-aware by construction: everything comes from visibleLeads / caseCards, so a paralegal only ever
 * sees the cases assigned to them and an attorney only their own. Records one "portal.home" audit entry.
 */
import { CASE_PHASES } from "@/lib/caseJourney";
import { commissionFor, money } from "@/lib/commission";
import { audit } from "@/server/audit/log";
import { can, requireMfa } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { lawyerDashboard, visibleLeads } from "@/server/portal/caseView";
import { caseCards, shortName, type CaseCard } from "@/server/services/caseBoard";
import { retainerFee } from "@/server/services/commissions";
import { MATTER_LABELS } from "@/server/services/leads";
import type { Actor, Lead, Stage } from "@/server/types";

export type Tone = "neutral" | "info" | "good" | "warn" | "danger";

export interface Kpi { key: string; label: string; value: string; tone: Tone; href?: string; hint?: string }

export interface WorkItem {
  key: string;
  title: string;
  detail: string;
  chip?: { label: string; tone: Tone };
  href: string;
  cta: string;
  /** lower sorts first */
  rank: number;
}

export interface LeadRow {
  leadId: string;
  name: string;
  matter: string;
  stage: string;
  tone: Tone;
  urgent: boolean;
  ageDays: number;
  href: string;
}

export interface PortalHome {
  headline: string;
  summary: string;
  kpis: Kpi[];
  work: WorkItem[];
  workTitle: string;
  leads: LeadRow[];
  leadsTitle: string;
  leadsHref?: string;
  actions: { href: string; label: string; primary?: boolean }[];
}

export const STAGE_LABEL: Record<Stage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  conflict_check: "Conflict check",
  offered: "Offered to attorney",
  accepted: "Attorney accepted",
  consult_booked: "Consult booked",
  consult_held: "Consult held",
  proposal_sent: "Retainer sent",
  retainer_signed: "Retainer signed",
  paid: "Fee paid",
  drafting: "Drafting",
  signing_scheduled: "Signing",
  plan_complete: "Closed",
  annual_review: "Annual review",
};

export function stageTone(lead: Pick<Lead, "stage" | "exit">): Tone {
  if (lead.exit) return "neutral";
  if (lead.stage === "new") return "warn";
  if (lead.stage === "plan_complete" || lead.stage === "annual_review") return "good";
  if (["paid", "drafting", "signing_scheduled", "retainer_signed"].includes(lead.stage)) return "info";
  return "neutral";
}

const DAY = 86_400_000;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function caseWork(cards: CaseCard[], actor: Actor): WorkItem[] {
  const items: WorkItem[] = [];
  for (const c of cards) {
    const j = c.journey;
    if (j.closed || j.exited) continue;
    const href = `/admin/cases/${c.leadId}`;
    const stuck = j.stale ? { label: `Stuck ${j.daysInStep}d`, tone: "danger" as Tone } : undefined;
    const phase = CASE_PHASES.find((p) => p.key === j.phase)?.label ?? "";
    const detail = `${c.matter} · ${phase} · ${j.daysInStep === 0 ? "moved today" : `${plural(j.daysInStep, "day")} on this step`}`;
    if (actor.role === "paralegal") {
      if (c.questionnaire === "paralegal") {
        items.push({ key: `q-${c.leadId}`, title: `${c.name}: finish the intake questionnaire`, detail, chip: stuck ?? { label: "With you", tone: "info" }, href: `${href}/intake`, cta: "Continue", rank: j.stale ? 0 : 1 });
      } else if (j.current?.legal && !j.current.attorneyOnly) {
        items.push({ key: c.leadId, title: `${c.name}: ${c.nextAction}`, detail, chip: stuck, href, cta: "Start", rank: j.stale ? 0 : 2 });
      }
    } else if (actor.role === "attorney") {
      if (!c.mine) continue;
      if (c.questionnaire === "ready_for_review" || j.current?.attorneyOnly) {
        items.push({ key: c.leadId, title: `${c.name}: ${c.questionnaire === "ready_for_review" ? "questionnaire ready for your review" : c.nextAction}`, detail, chip: stuck ?? { label: "Needs you", tone: "warn" }, href: c.questionnaire === "ready_for_review" ? `${href}/intake` : href, cta: "Review", rank: 1 });
      } else if (c.questionnaire === "attorney" && j.current?.key === "documents_gathered") {
        items.push({ key: c.leadId, title: `${c.name}: finish the questionnaire and send it to the paralegal`, detail, chip: stuck, href: `${href}/intake`, cta: "Continue", rank: 2 });
      } else if (j.stale) {
        items.push({ key: c.leadId, title: `${c.name}: ${c.nextAction}`, detail, chip: stuck, href, cta: "Open", rank: 3 });
      }
    } else {
      if (!c.paralegalId && j.current?.legal) {
        items.push({ key: `p-${c.leadId}`, title: `${c.name}: assign a paralegal`, detail, chip: { label: "No paralegal", tone: "warn" }, href: `${href}#paralegal`, cta: "Assign", rank: 2 });
      } else if (j.stale) {
        items.push({ key: c.leadId, title: `${c.name}: ${c.nextAction}`, detail, chip: stuck, href, cta: "Open", rank: 3 });
      }
    }
  }
  return items;
}

export async function portalHome(db: Db, actor: Actor, now = new Date()): Promise<PortalHome> {
  requireMfa(actor);
  const user = await db.users.get(actor.userId);
  const first = user?.name?.split(/\s+/)[0] ?? "there";
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Chicago" }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const headline = `${greeting}, ${first}`;
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Chicago" }).format(now);

  const visible = await visibleLeads(db, actor, now);
  const persons = new Map<string, { firstName?: string; lastName?: string } | undefined>();
  const nameOf = async (lead: Lead) => {
    if (!persons.has(lead.personId)) persons.set(lead.personId, await db.persons.get(lead.personId));
    const p = persons.get(lead.personId);
    return shortName(p?.firstName, p?.lastName);
  };

  const cards = can(actor, "view_case_board") ? await caseCards(db, actor, now) : [];
  const openCards = cards.filter((c) => !c.journey.closed && !c.journey.exited);
  const stuck = openCards.filter((c) => c.journey.stale);
  const work: WorkItem[] = caseWork(cards, actor);
  const kpis: Kpi[] = [];
  const actions: PortalHome["actions"] = [];
  const parts: string[] = [];

  // Leads waiting for first contact: everyone but paralegals and attorneys works these.
  const fresh = visible.filter(({ lead, access }) => (access === "full" || access === "intake") && lead.stage === "new" && !lead.exit);
  const freshWork = async () => {
    for (const { lead } of fresh) {
      const age = Math.floor((now.getTime() - new Date(lead.createdAt).getTime()) / DAY);
      work.push({
        key: `n-${lead.id}`,
        title: `${await nameOf(lead)}: make first contact`,
        detail: `${MATTER_LABELS[lead.matterType]}, ${lead.state} · came in ${age === 0 ? "today" : `${plural(age, "day")} ago`}`,
        chip: lead.urgent ? { label: "Urgent", tone: "danger" } : age >= 1 ? { label: "Overdue", tone: "danger" } : { label: "New", tone: "warn" },
        href: `/portal/leads/${lead.id}`,
        cta: "Start",
        rank: lead.urgent || age >= 1 ? 0 : 1,
      });
    }
  };

  if (actor.role === "attorney" && actor.lawyerId) {
    const dash = await lawyerDashboard(db, actor, now);
    const mine = openCards.filter((c) => c.mine);
    const review = work.filter((w) => w.cta === "Review").length;
    for (const o of dash.offers) {
      const mins = Math.max(0, Math.round((new Date(o.expiresAt).getTime() - now.getTime()) / 60_000));
      work.push({ key: `o-${o.assignmentId}`, title: o.offerSummary, detail: "New case offer · accept or pass", chip: { label: `${mins} min left`, tone: mins < 60 ? "danger" : "warn" }, href: `/portal/leads/${o.leadId}`, cta: "Respond", rank: -1 });
    }
    kpis.push(
      { key: "offers", label: "New offers to answer", value: String(dash.offers.length), tone: dash.offers.length ? "danger" : "neutral", href: "#work" },
      { key: "consults", label: "Consults today", value: String(dash.todaysConsults.length), tone: "info" },
      { key: "review", label: "Waiting for your review", value: String(review), tone: review ? "warn" : "neutral", href: "#work" },
      { key: "stuck", label: "Your cases stuck too long", value: String(mine.filter((c) => c.journey.stale).length), tone: mine.some((c) => c.journey.stale) ? "danger" : "good", href: "/admin/cases?stuck=1" },
    );
    parts.push(plural(dash.offers.length, "new offer"), plural(dash.todaysConsults.length, "consult") + " today", `${review} waiting for your review`);
    actions.push({ href: "/admin/cases", label: "Open my cases", primary: true }, { href: "/admin/pipeline", label: "Lead pipeline" });
  } else if (actor.role === "paralegal") {
    const withMe = openCards.filter((c) => c.questionnaire === "paralegal").length;
    let earned = 0;
    for (const c of cards) {
      const lead = visible.find((v) => v.lead.id === c.leadId)?.lead;
      if (!lead || (lead.commission?.paidTo ?? lead.assignedParalegalId) !== actor.userId) continue;
      const line = commissionFor(lead, retainerFee(await db.engagements.list(undefined, { leadId: lead.id })));
      if (line.status === "earned") earned += line.amountCents;
    }
    kpis.push(
      { key: "open", label: "Your open cases", value: String(openCards.length), tone: "info", href: "/admin/cases" },
      { key: "q", label: "Questionnaires with you", value: String(withMe), tone: withMe ? "warn" : "neutral", href: "#work" },
      { key: "stuck", label: "Stuck too long", value: String(stuck.length), tone: stuck.length ? "danger" : "good", href: "/admin/cases?stuck=1" },
      { key: "earned", label: "Commission earned, not yet paid", value: money(earned), tone: earned ? "good" : "neutral", href: "/admin/commissions" },
    );
    parts.push(plural(openCards.length, "open case"), `${withMe} questionnaire${withMe === 1 ? "" : "s"} with you`, `${stuck.length} stuck`);
    actions.push({ href: "/admin/cases", label: "Open my cases", primary: true });
    if (can(actor, "view_commissions")) actions.push({ href: "/admin/commissions", label: "My commission" });
  } else {
    await freshWork();
    const unassigned = openCards.filter((c) => !c.paralegalId).length;
    kpis.push({ key: "new", label: "New leads to contact", value: String(fresh.length), tone: fresh.length ? "danger" : "good", href: "#work" });
    if (cards.length || can(actor, "view_case_board")) {
      kpis.push(
        { key: "open", label: "Open cases", value: String(openCards.length), tone: "info", href: "/admin/cases" },
        { key: "stuck", label: "Stuck too long", value: String(stuck.length), tone: stuck.length ? "danger" : "good", href: "/admin/cases?stuck=1" },
        { key: "unassigned", label: "No paralegal yet", value: String(unassigned), tone: unassigned ? "warn" : "good", href: "/admin/cases?paralegal=none" },
      );
    } else {
      const inProgress = visible.filter(({ lead }) => !lead.exit && ["contacted", "qualified", "conflict_check"].includes(lead.stage)).length;
      const offered = visible.filter(({ lead }) => !lead.exit && lead.stage === "offered").length;
      kpis.push(
        { key: "progress", label: "Being qualified", value: String(inProgress), tone: "info" },
        { key: "offered", label: "Waiting on an attorney", value: String(offered), tone: offered ? "warn" : "neutral" },
      );
    }
    parts.push(plural(fresh.length, "new lead") + " to contact");
    if (can(actor, "view_case_board")) parts.push(`${stuck.length} case${stuck.length === 1 ? "" : "s"} stuck`);
    if (can(actor, "work_intake_queue")) actions.push({ href: "/portal/queue", label: "Work the intake queue", primary: true });
    if (can(actor, "view_case_board")) actions.push({ href: "/admin/cases", label: "Case board", primary: !actions.length });
    if (can(actor, "view_pipeline")) actions.push({ href: "/admin/pipeline", label: "Lead pipeline" });
  }

  work.sort((a, b) => a.rank - b.rank);

  // The list under the work: the paralegal's own cases, everyone else's newest leads, by name.
  let leads: LeadRow[];
  if (actor.role === "paralegal") {
    leads = openCards.slice(0, 12).map((c) => ({
      leadId: c.leadId, name: c.name, matter: `${c.matter}, ${c.state}`, stage: CASE_PHASES.find((p) => p.key === c.journey.phase)?.label ?? "", tone: c.journey.stale ? "danger" : "info", urgent: c.urgent,
      ageDays: c.journey.daysInStep, href: `/admin/cases/${c.leadId}`,
    }));
  } else {
    const rows = visible
      .filter(({ access }) => access === "full" || access === "intake")
      .filter(({ lead }) => actor.role !== "attorney" || lead.assignedLawyerId === actor.lawyerId)
      .sort((a, b) => Number(b.lead.urgent) - Number(a.lead.urgent) || b.lead.createdAt.localeCompare(a.lead.createdAt))
      .slice(0, 12);
    leads = [];
    for (const { lead } of rows) {
      leads.push({
        leadId: lead.id, name: await nameOf(lead), matter: `${MATTER_LABELS[lead.matterType]}, ${lead.state}`,
        stage: lead.exit ? "Closed early" : STAGE_LABEL[lead.stage], tone: stageTone(lead), urgent: lead.urgent,
        ageDays: Math.floor((now.getTime() - new Date(lead.createdAt).getTime()) / DAY), href: `/portal/leads/${lead.id}`,
      });
    }
  }

  await audit(db, actor, { action: "portal.home", resourceType: "portal", resourceId: actor.firmId ?? "all", detail: { work: work.length, leads: leads.length }, at: now });
  return {
    headline,
    summary: `${today}. ${parts.length ? `${parts.join(", ")}.` : ""}`,
    kpis,
    work: work.slice(0, 10),
    workTitle: actor.role === "paralegal" ? "Your next steps" : "Needs you now",
    leads,
    leadsTitle: actor.role === "paralegal" ? "Your cases" : actor.role === "attorney" ? "Your clients" : "Newest leads",
    leadsHref: actor.role === "paralegal" ? "/admin/cases" : can(actor, "view_pipeline") ? "/admin/pipeline" : undefined,
    actions,
  };
}
