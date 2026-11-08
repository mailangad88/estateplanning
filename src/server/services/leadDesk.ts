/**
 * The leads desk (/admin/leads): the office's daily view of website and phone leads. It reads the same
 * store as the rest of the portal (Postgres when DATABASE_URL is set, the demo memory store otherwise)
 * and adds no tables of its own. Rows come from visibleLeads, so leadAccess decides who sees what:
 * offer-only cards (no name) are left out, intake staff see their own and unclaimed leads.
 *
 * It answers three questions for the person answering the phone:
 * - Who is still waiting on a reply? ("Fix now")
 * - What needs a person's judgment? ("Your call": pick an attorney, a stalled retainer, a referral with no news)
 * - What happened on its own? (the banner and the "Updates" feed)
 *
 * Writes here are small and audited: status moves, logged calls, phone-call leads. Everything else
 * (referrals, retainers, conflict checks) stays on the case page, so there is one way to do each thing.
 */
import { randomUUID } from "node:crypto";
import { servedStates } from "@/config/firm";
import { buildConsentRecord } from "@/lib/consent";
import type { LeadRecord } from "@/lib/crm";
import type { QuizAnswers } from "@/lib/quiz";
import { scoreLead, segmentTags } from "@/lib/scoring";
import { audit } from "@/server/audit/log";
import { assertCan, can, canOnLead, ForbiddenError, requireMfa } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { visibleLeads } from "@/server/portal/caseView";
import { isHumanOutreach } from "@/server/services/contact";
import { exitLead, ingestLead, MATTER_LABELS, setStage } from "@/server/services/leads";
import { offerNext } from "@/server/services/routing";
import { SPEED_TO_LEAD_MINUTES } from "@/server/services/intakeQueue";
import { triageLead } from "@/server/services/triage";
import { STAGES, type Activity, type Actor, type ExitReason, type Lead, type Stage } from "@/server/types";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** The five buckets the office talks in. Stages are finer; these are what the donut and filters use. */
export const DESK_STATUSES = ["new", "talking", "consult", "retained", "closed"] as const;
export type DeskStatus = (typeof DESK_STATUSES)[number];
export const DESK_STATUS_LABELS: Record<DeskStatus, string> = {
  new: "New",
  talking: "Talking",
  consult: "Consult booked",
  retained: "Retained",
  closed: "Closed",
};

export const TOOL_LABELS: Record<string, string> = {
  plan_finder: "Plan finder",
  intake: "Intake form",
  readiness_score: "Readiness score",
  cost_calculator: "Cost calculator",
  will_vs_trust: "Will vs trust",
  guide: "Free guide",
  exit_offer: "Exit offer",
  callback: "Callback request",
  family_plan: "My family plan",
  chat: "Chat",
  phone_call: "Phone call",
  partner_form: "Partner referral",
};
export const toolLabel = (t?: string) => (t ? TOOL_LABELS[t] ?? t.replaceAll("_", " ").replaceAll("-", " ") : "Unknown");

export const EXIT_LABELS: Record<ExitReason, string> = {
  not_a_fit: "Not a fit",
  unresponsive: "No reply after follow-ups",
  chose_another_option: "Chose another option",
  conflict: "Conflict of interest",
  declined_by_all: "No attorney could take it",
  referred_out: "Referred to an outside attorney",
};
/** Reasons a person may close a lead with from the desk. Conflict and declined-by-all come from their own flows. */
export const MANUAL_EXITS: ExitReason[] = ["not_a_fit", "unresponsive", "chose_another_option"];

/** Answer keys and values in plain words, for the detail page and the CSV. */
export const ANSWER_LABELS: Record<string, string> = {
  matterType: "What they need",
  maritalStatus: "Relationship",
  children: "Children",
  specialNeeds: "Child with special needs",
  blendedFamily: "Blended family",
  ownsHome: "Owns a home",
  ownsBusiness: "Owns a business",
  outOfStateProperty: "Property in another state",
  assetRange: "Assets",
  existingDocuments: "Existing documents",
  urgency: "Timing",
};
const VALUE_LABELS: Record<string, string> = {
  new_plan: "A new plan",
  update_plan: "Update an existing plan",
  after_death: "Someone has died",
  elder_care: "Care for an older parent",
  not_sure: "Not sure",
  under_250k: "Under $250k",
  "250k_1m": "$250k to $1M",
  "1m_5m": "$1M to $5M",
  over_5m: "Over $5M",
  prefer_not: "Prefer not to say",
  will_only: "A will only",
  this_month: "This month",
  health_event: "Health event coming up",
  recent_death: "Recent death",
  exploring: "Just exploring",
};
export const answerValue = (v: unknown) => (typeof v === "string" ? VALUE_LABELS[v] ?? v.replaceAll("_", " ") : String(v));

const RETAINED_FROM = STAGES.indexOf("retainer_signed");
const CONSULT_FROM = STAGES.indexOf("consult_booked");

export function deskStatus(lead: Pick<Lead, "stage" | "exit">, contacted: boolean): DeskStatus {
  if (lead.exit) return "closed";
  const i = STAGES.indexOf(lead.stage);
  if (i >= RETAINED_FROM) return "retained";
  if (i >= CONSULT_FROM) return "consult";
  if (lead.stage === "new" && !contacted) return "new";
  return "talking";
}

/** Path of a landing page URL, without host or query: "/probate/illinois". */
export function pagePath(url?: string): string {
  if (!url) return "";
  return url.replace(/^https?:\/\/[^/]+/, "").split(/[?#]/)[0] || "/";
}

export interface DeskLead {
  id: string;
  name: string;
  firstName: string;
  email: string;
  phone: string;
  state: string;
  county?: string;
  createdAt: string;
  matter: string;
  status: DeskStatus;
  stage: Stage;
  exitReason?: ExitReason;
  urgent: boolean;
  /** "hot", "warm" or "not_a_fit" */
  tier: string;
  grade?: string;
  afterDeath: boolean;
  tool: string;
  toolLabel: string;
  resource?: string;
  sourcePage: string;
  utmSource?: string;
  heardFrom?: string;
  contacted: boolean;
  firstContactAt?: string;
  attempts: number;
  lastActivityAt: string;
  /** Minutes since the lead came in, while nobody has replied */
  waitingMinutes: number | null;
  nextConsultAt?: string;
  pastConsultUnrecorded: boolean;
  hasAttorney: boolean;
  openOffer: boolean;
  conflictClear: boolean;
  referrals: number;
  referralNoNewsDays: number | null;
  retainerSentDays: number | null;
  smsConsent: boolean;
}

/** Every lead the actor may see on the desk, newest first. */
export async function deskLeads(db: Db, actor: Actor, now = new Date()): Promise<DeskLead[]> {
  requireMfa(actor);
  assertCan(can(actor, "view_lead_desk"), "The leads desk is for the office and platform admins.");
  const visible = (await visibleLeads(db, actor, now)).filter((x) => x.access === "full" || x.access === "intake");
  if (visible.length === 0) return [];
  const ids = new Set(visible.map((x) => x.lead.id));
  const [persons, activities, consults, assignments, referrals, engagements] = await Promise.all([
    db.persons.list(),
    db.activities.list((a) => ids.has(a.leadId)),
    db.consults.list((c) => ids.has(c.leadId)),
    db.assignments.list((a) => ids.has(a.leadId)),
    db.leadReferrals.list((r) => ids.has(r.leadId)),
    db.engagements.list((e) => ids.has(e.leadId)),
  ]);
  const personById = new Map(persons.map((p) => [p.id, p]));
  const group = <T extends { leadId: string }>(xs: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of xs) m.set(x.leadId, [...(m.get(x.leadId) ?? []), x]);
    return m;
  };
  const acts = group(activities);
  const cons = group(consults);
  const asg = group(assignments);
  const refs = group(referrals);
  const engs = group(engagements);

  return visible
    .map(({ lead }) => {
      const p = personById.get(lead.personId);
      const created = new Date(lead.createdAt).getTime();
      const outreach = (acts.get(lead.id) ?? []).filter((a) => isHumanOutreach(a) && new Date(a.at).getTime() >= created);
      const contactTimes = [...outreach.map((a) => a.at), ...lead.stageHistory.filter((h) => h.stage === "contacted").map((h) => h.at)].sort();
      const contacted = contactTimes.length > 0 || STAGES.indexOf(lead.stage) > STAGES.indexOf("new");
      const allActs = acts.get(lead.id) ?? [];
      const lastActivityAt = [lead.createdAt, ...allActs.map((a) => a.at), ...lead.stageHistory.map((h) => h.at)].sort().at(-1)!;
      const leadConsults = cons.get(lead.id) ?? [];
      const upcoming = leadConsults.filter((c) => c.status === "booked" && new Date(c.at).getTime() >= now.getTime()).sort((a, b) => a.at.localeCompare(b.at))[0];
      const pastUnrecorded = leadConsults.some((c) => c.status === "booked" && new Date(c.at).getTime() < now.getTime() - 2 * HOUR);
      const leadAsg = asg.get(lead.id) ?? [];
      const openOffer = leadAsg.some((a) => a.status === "offered" && new Date(a.expiresAt) > now);
      const leadRefs = refs.get(lead.id) ?? [];
      const outsideOpen = leadRefs.filter((r) => !r.toLawyerId && r.outcome === "pending");
      const oldestOutside = outsideOpen.map((r) => r.referredAt).sort()[0];
      const sent = (engs.get(lead.id) ?? []).filter((e) => e.status === "sent" || e.status === "viewed");
      const sentAt = sent.flatMap((e) => e.history.filter((h) => h.status === "sent").map((h) => h.at)).sort()[0];
      const status = deskStatus(lead, contacted);
      const name = p ? `${p.firstName} ${p.lastName}`.trim() : lead.conflictCard.clientName;
      return {
        id: lead.id,
        name: name || "Unnamed lead",
        firstName: p?.firstName || name.split(" ")[0] || "Lead",
        email: p?.email ?? "",
        phone: p?.phone ?? "",
        state: lead.state,
        county: lead.county,
        createdAt: lead.createdAt,
        matter: MATTER_LABELS[lead.matterType],
        status,
        stage: lead.stage,
        exitReason: lead.exit?.reason,
        urgent: lead.urgent,
        tier: lead.score.tier,
        grade: lead.score.grade,
        afterDeath: triageLead(lead).lane === "after_death",
        tool: lead.capture?.tool ?? "unknown",
        toolLabel: toolLabel(lead.capture?.tool),
        resource: lead.capture?.resource,
        sourcePage: pagePath(lead.source.landingPage),
        utmSource: lead.source.utmSource,
        heardFrom: lead.source.heardFrom,
        contacted,
        firstContactAt: contactTimes[0],
        attempts: outreach.length,
        lastActivityAt,
        waitingMinutes: contacted || lead.exit ? null : Math.max(0, Math.floor((now.getTime() - created) / MIN)),
        nextConsultAt: upcoming?.at,
        pastConsultUnrecorded: pastUnrecorded && !lead.exit,
        hasAttorney: !!lead.assignedLawyerId,
        openOffer,
        conflictClear: lead.conflictCard.clearance === "clear",
        referrals: leadRefs.length,
        referralNoNewsDays: oldestOutside ? Math.floor((now.getTime() - new Date(oldestOutside).getTime()) / DAY) : null,
        retainerSentDays: sentAt ? Math.floor((now.getTime() - new Date(sentAt).getTime()) / DAY) : null,
        smsConsent: lead.consent.smsConsent,
      } satisfies DeskLead;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------------------------------------------------------------------------------------------------------
// Filters, search and CSV

export interface DeskFilters {
  q?: string;
  status?: DeskStatus | "open";
  tool?: string;
  page?: string;
  from?: string;
  to?: string;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFilters(sp: Record<string, string | string[] | undefined>): DeskFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const status = one("status");
  return {
    q: one("q")?.slice(0, 120),
    status: status === "open" || (DESK_STATUSES as readonly string[]).includes(status ?? "") ? (status as DeskFilters["status"]) : undefined,
    tool: one("tool")?.slice(0, 60),
    page: one("page")?.slice(0, 300),
    from: DAY_RE.test(one("from") ?? "") ? one("from") : undefined,
    to: DAY_RE.test(one("to") ?? "") ? one("to") : undefined,
  };
}

const digits = (s: string) => s.replace(/\D/g, "");

export function filterLeads(rows: DeskLead[], f: DeskFilters): DeskLead[] {
  const q = f.q?.toLowerCase();
  const qDigits = q ? digits(q) : "";
  return rows.filter((r) => {
    if (q) {
      const hit =
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && digits(r.phone).includes(qDigits)) ||
        r.id.startsWith(q);
      if (!hit) return false;
    }
    if (f.status === "open" ? r.status === "closed" : f.status && r.status !== f.status) return false;
    if (f.tool && r.tool !== f.tool) return false;
    if (f.page && r.sourcePage !== f.page) return false;
    if (f.from && r.createdAt.slice(0, 10) < f.from) return false;
    if (f.to && r.createdAt.slice(0, 10) > f.to) return false;
    return true;
  });
}

/** Distinct values for the filter dropdowns, most used first. */
export function filterOptions(rows: DeskLead[]): { tools: { value: string; label: string; n: number }[]; pages: { value: string; n: number }[] } {
  const count = (vals: string[]) => [...vals.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  return {
    tools: count(rows.map((r) => r.tool)).map(([value, n]) => ({ value, label: toolLabel(value), n })),
    pages: count(rows.map((r) => r.sourcePage).filter(Boolean)).map(([value, n]) => ({ value, n })),
  };
}

function csvCell(v: unknown): string {
  let s = v === undefined || v === null ? "" : String(v);
  // Spreadsheet formula injection: a cell starting with = + - @ runs as a formula in Excel and Sheets.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export const CSV_COLUMNS: [string, (r: DeskLead) => unknown][] = [
  ["Received", (r) => r.createdAt],
  ["Name", (r) => r.name],
  ["Email", (r) => r.email],
  ["Phone", (r) => r.phone],
  ["State", (r) => r.state],
  ["County", (r) => r.county],
  ["Matter", (r) => r.matter],
  ["Status", (r) => DESK_STATUS_LABELS[r.status]],
  ["Stage", (r) => r.stage],
  ["Closed reason", (r) => (r.exitReason ? EXIT_LABELS[r.exitReason] : "")],
  ["Hot or warm", (r) => r.tier],
  ["Urgent", (r) => (r.urgent ? "yes" : "no")],
  ["Came in through", (r) => r.toolLabel],
  ["Resource", (r) => r.resource],
  ["First page", (r) => r.sourcePage],
  ["UTM source", (r) => r.utmSource],
  ["Heard about us", (r) => r.heardFrom],
  ["First reply", (r) => r.firstContactAt],
  ["Calls, texts and emails", (r) => r.attempts],
  ["Next consult", (r) => r.nextConsultAt],
  ["Referrals", (r) => r.referrals],
  ["Text consent", (r) => (r.smsConsent ? "yes" : "no")],
  ["Lead id", (r) => r.id],
];

export function leadsCsv(rows: DeskLead[]): string {
  const lines = [CSV_COLUMNS.map(([h]) => csvCell(h)).join(",")];
  for (const r of rows) lines.push(CSV_COLUMNS.map(([, get]) => csvCell(get(r))).join(","));
  return lines.join("\r\n") + "\r\n";
}

/** The CSV, checked and audited. Only ids and counts go in the audit log, never the rows. */
export async function exportLeads(db: Db, actor: Actor, filters: DeskFilters, now = new Date()): Promise<{ csv: string; count: number }> {
  assertCan(can(actor, "export_leads"), "Only owners and office admins can download leads.");
  const rows = filterLeads(await deskLeads(db, actor, now), filters);
  await audit(db, actor, { action: "lead.export", resourceType: "lead", resourceId: "csv", detail: { count: rows.length, filters: { ...filters, q: filters.q ? "(search)" : undefined } }, at: now });
  return { csv: leadsCsv(rows), count: rows.length };
}

// ---------------------------------------------------------------------------------------------------------
// Today: the banner, "needs your decision", notifications and the three cards

export type DeskItemKind = "fix" | "yours" | "update";

export interface DeskItem {
  key: string;
  kind: DeskItemKind;
  leadId: string;
  title: string;
  detail: string;
  at: string;
  action?: { label: string; href: string; tel?: boolean };
}

const ago = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  return h < 48 ? `${h} hours` : `${Math.floor(h / 24)} days`;
};

function where(r: DeskLead) {
  return r.county ? `${r.county} County, ${r.state}` : r.state;
}

/** Problems first (people waiting on a reply, consults with no outcome), then the calls only a person can make. */
export function decisions(rows: DeskLead[], now = new Date()): DeskItem[] {
  const fix: (DeskItem & { rank: number })[] = [];
  const yours: (DeskItem & { rank: number })[] = [];
  for (const r of rows) {
    if (r.status === "closed") continue;
    const open = `/admin/leads/${r.id}`;
    if (r.waitingMinutes !== null && r.waitingMinutes > SPEED_TO_LEAD_MINUTES) {
      fix.push({
        key: `wait:${r.id}`,
        kind: "fix",
        leadId: r.id,
        title: r.afterDeath ? `${r.name} lost someone and is waiting on a call` : `${r.name} is still waiting on a reply`,
        detail: `${r.matter} · ${r.toolLabel} · ${where(r)}. Came in ${ago(r.waitingMinutes)} ago.${r.afterDeath ? " Call within the hour, listen first." : ""}`,
        at: r.createdAt,
        action: r.phone ? { label: "Call", href: `tel:+1${r.phone}`, tel: true } : { label: "Email", href: `mailto:${r.email}` },
        rank: (r.urgent || r.afterDeath ? 0 : 1) * 1e9 - r.waitingMinutes,
      });
    }
    if (r.pastConsultUnrecorded) {
      fix.push({
        key: `consult:${r.id}`,
        kind: "fix",
        leadId: r.id,
        title: `Record how ${r.firstName}'s consult went`,
        detail: `${r.matter}. The consult time has passed and nobody has marked it held or missed.`,
        at: r.lastActivityAt,
        action: { label: "Open", href: `${open}#booking` },
        rank: 2e9,
      });
    }
    if (r.contacted && !r.hasAttorney && !r.openOffer && r.conflictClear && STAGES.indexOf(r.stage) < STAGES.indexOf("accepted")) {
      yours.push({
        key: `assign:${r.id}`,
        kind: "yours",
        leadId: r.id,
        title: `Match ${r.name} with an attorney`,
        detail: `${r.matter} · ${where(r)}. Conflict check is clear and no attorney has the lead yet.`,
        at: r.lastActivityAt,
        action: { label: "Assign", href: `${open}#match` },
        rank: 0,
      });
    } else if (r.contacted && r.stage === "contacted" && now.getTime() - new Date(r.lastActivityAt).getTime() > 2 * DAY) {
      yours.push({
        key: `stalled:${r.id}`,
        kind: "yours",
        leadId: r.id,
        title: `Decide what's next for ${r.name}`,
        detail: `${r.matter}. Talked ${r.attempts ? `${r.attempts} time${r.attempts > 1 ? "s" : ""}` : "once"}, nothing since. Qualify them, book a consult or close the lead.`,
        at: r.lastActivityAt,
        action: { label: "Open", href: open },
        rank: 1,
      });
    }
    if (r.retainerSentDays !== null && r.retainerSentDays >= 3) {
      yours.push({
        key: `retainer:${r.id}`,
        kind: "yours",
        leadId: r.id,
        title: `${r.firstName} hasn't signed the engagement letter`,
        detail: `Sent ${r.retainerSentDays} days ago. A short check-in call usually settles it.`,
        at: r.lastActivityAt,
        action: { label: "Open", href: open },
        rank: 2,
      });
    }
    if (r.referralNoNewsDays !== null && r.referralNoNewsDays >= 14) {
      yours.push({
        key: `referral:${r.id}`,
        kind: "yours",
        leadId: r.id,
        title: `Check how ${r.firstName}'s referral went`,
        detail: `Referred to an outside attorney ${r.referralNoNewsDays} days ago with no outcome logged.`,
        at: r.lastActivityAt,
        action: { label: "Update", href: `${open}#referrals` },
        rank: 3,
      });
    }
  }
  const strip = ({ rank: _r, ...i }: DeskItem & { rank: number }) => i;
  return [...fix.sort((a, b) => a.rank - b.rank).map(strip), ...yours.sort((a, b) => a.rank - b.rank).map(strip)];
}

const STAGE_UPDATES: Partial<Record<Stage, (name: string) => string>> = {
  consult_booked: (n) => `${n} booked a consult`,
  consult_held: (n) => `${n}'s consult was held`,
  proposal_sent: (n) => `${n} was sent an engagement letter`,
  retainer_signed: (n) => `${n} signed and is now a client`,
  accepted: (n) => `An attorney accepted ${n}'s matter`,
};

/** What happened in the last week, newest first: new requests, bookings, new clients, closed leads. */
export async function updates(db: Db, rows: DeskLead[], now = new Date(), days = 7): Promise<DeskItem[]> {
  const since = now.getTime() - days * DAY;
  const items: DeskItem[] = [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const r of rows) {
    if (new Date(r.createdAt).getTime() >= since) {
      items.push({ key: `new:${r.id}`, kind: "update", leadId: r.id, title: `New request from ${r.name}`, detail: `${r.matter} · ${r.toolLabel}${r.sourcePage ? ` on ${r.sourcePage}` : ""}`, at: r.createdAt });
    }
  }
  const leads = await db.leads.list((l) => byId.has(l.id));
  for (const l of leads) {
    const r = byId.get(l.id)!;
    for (const h of l.stageHistory) {
      const say = STAGE_UPDATES[h.stage];
      if (say && new Date(h.at).getTime() >= since) items.push({ key: `stage:${l.id}:${h.stage}:${h.at}`, kind: "update", leadId: l.id, title: say(r.name), detail: r.matter, at: h.at });
    }
    if (l.exit && new Date(l.exit.at).getTime() >= since) {
      items.push({ key: `exit:${l.id}`, kind: "update", leadId: l.id, title: `${r.name}'s lead was closed`, detail: EXIT_LABELS[l.exit.reason], at: l.exit.at });
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

export interface TodaySummary {
  /** Things the system did by itself in the last 24 hours: alerts, routing, automatic emails */
  automatic: number;
  needYou: number;
  newLast24h: number;
  bookedLast24h: number;
  waiting: number;
  longestWaitMinutes: number | null;
  callsToMake: number;
  consultsToday: number;
}

export async function todaySummary(db: Db, rows: DeskLead[], items: DeskItem[], now = new Date()): Promise<TodaySummary> {
  const since = new Date(now.getTime() - DAY).toISOString();
  const ids = new Set(rows.map((r) => r.id));
  const auto = await db.audit.list((e) => e.actorRole === "system" && e.at >= since && (!e.leadId || ids.has(e.leadId)));
  const waiting = rows.filter((r) => r.waitingMinutes !== null);
  const today = now.toISOString().slice(0, 10);
  const leads = await db.leads.list((l) => ids.has(l.id));
  return {
    automatic: auto.length,
    needYou: items.filter((i) => i.kind !== "update").length,
    newLast24h: rows.filter((r) => r.createdAt >= since).length,
    bookedLast24h: leads.filter((l) => l.stageHistory.some((h) => h.stage === "consult_booked" && h.at >= since)).length,
    waiting: waiting.length,
    longestWaitMinutes: waiting.length ? Math.max(...waiting.map((r) => r.waitingMinutes!)) : null,
    callsToMake: callList(rows).length,
    consultsToday: rows.filter((r) => r.nextConsultAt?.slice(0, 10) === today).length,
  };
}

/** New requests per day for the last 7 days, oldest first; the last entry is today. */
export function requestsByDay(rows: DeskLead[], now = new Date(), days = 7): { day: string; label: string; n: number }[] {
  const out: { day: string; label: string; n: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY);
    const day = d.toISOString().slice(0, 10);
    out.push({ day, label: i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }), n: rows.filter((r) => r.createdAt.slice(0, 10) === day).length });
  }
  return out;
}

export function statusCounts(rows: DeskLead[]): Record<DeskStatus, number> {
  const c = { new: 0, talking: 0, consult: 0, retained: 0, closed: 0 } as Record<DeskStatus, number>;
  for (const r of rows) c[r.status]++;
  return c;
}

/** Consults booked and new clients this month, plus consults booked per week for the last 8 weeks. */
export async function bookings(db: Db, rows: DeskLead[], now = new Date()) {
  const ids = new Set(rows.map((r) => r.id));
  const leads = await db.leads.list((l) => ids.has(l.id));
  const month = now.toISOString().slice(0, 7);
  const firstAt = (l: Lead, s: Stage) => l.stageHistory.find((h) => h.stage === s)?.at;
  const booked = leads.map((l) => firstAt(l, "consult_booked")).filter((x): x is string => !!x);
  const retained = leads.map((l) => firstAt(l, "retainer_signed")).filter((x): x is string => !!x);
  const weeks: { start: string; n: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const end = now.getTime() - i * 7 * DAY;
    const start = end - 7 * DAY;
    weeks.push({ start: new Date(start).toISOString().slice(0, 10), n: booked.filter((b) => { const t = new Date(b).getTime(); return t > start && t <= end; }).length });
  }
  return {
    consultsThisMonth: booked.filter((b) => b.startsWith(month)).length,
    retainedThisMonth: retained.filter((b) => b.startsWith(month)).length,
    weeks,
  };
}

/** People to call now: nobody has replied yet, or the first call didn't reach them. Oldest wait first. */
export function callList(rows: DeskLead[]): DeskLead[] {
  return rows
    .filter((r) => r.status !== "closed" && (r.waitingMinutes !== null || (r.stage === "contacted" && r.attempts < 6 && !r.hasAttorney)))
    .filter((r) => !!r.phone)
    .sort((a, b) => Number(b.urgent || b.afterDeath) - Number(a.urgent || a.afterDeath) || (b.waitingMinutes ?? -1) - (a.waitingMinutes ?? -1) || a.createdAt.localeCompare(b.createdAt));
}

// ---------------------------------------------------------------------------------------------------------
// Writes

async function loadForWrite(db: Db, actor: Actor, leadId: string, now: Date): Promise<Lead> {
  requireMfa(actor);
  assertCan(can(actor, "view_lead_desk"), "The leads desk is for the office and platform admins.");
  const lead = await db.leads.get(leadId);
  if (!lead) throw new Error("Lead not found");
  const assignments = await db.assignments.list(undefined, { leadId });
  // Moving a lead along is intake work, or the case holder's firm (full access) for later stages.
  if (!canOnLead(actor, "manage_tasks", lead, assignments, now)) throw new ForbiddenError("You do not have access to this lead");
  return lead;
}

/** Status a person can pick on the desk, and the stage it sets. Later stages come from their own flows (consults, retainers). */
export const STATUS_MOVES: { value: Stage; label: string }[] = [
  { value: "contacted", label: "Talking: reached them" },
  { value: "qualified", label: "Qualified: a fit, ready for an attorney" },
  { value: "consult_booked", label: "Consult booked" },
  { value: "consult_held", label: "Consult held" },
  { value: "retainer_signed", label: "Retained: signed with the attorney" },
];

export async function moveLead(db: Db, actor: Actor, leadId: string, stage: Stage, now = new Date()): Promise<Lead> {
  const lead = await loadForWrite(db, actor, leadId, now);
  if (!STATUS_MOVES.some((m) => m.value === stage)) throw new Error("Pick a status from the list");
  if (lead.exit) throw new Error("Reopen the lead before changing its status");
  return setStage(db, actor, leadId, stage, now);
}

export async function closeLead(db: Db, actor: Actor, leadId: string, reason: ExitReason, note: string | undefined, now = new Date()): Promise<Lead> {
  const lead = await loadForWrite(db, actor, leadId, now);
  if (!MANUAL_EXITS.includes(reason)) throw new Error("Pick a reason from the list");
  if (lead.exit) return lead;
  return exitLead(db, actor, leadId, reason, note?.trim().slice(0, 500) || undefined, now);
}

export async function reopenLead(db: Db, actor: Actor, leadId: string, now = new Date()): Promise<Lead> {
  const lead = await loadForWrite(db, actor, leadId, now);
  if (!lead.exit) return lead;
  if (!MANUAL_EXITS.includes(lead.exit.reason)) throw new Error("This lead was closed by a conflict or referral; reopen it from the case page");
  const next = await db.leads.update(leadId, { exit: undefined });
  await audit(db, actor, { action: "lead.reopen", resourceType: "lead", resourceId: leadId, leadId, detail: { was: lead.exit.reason }, at: now });
  return next;
}

export const CONTACT_KINDS = ["call", "sms", "email"] as const;
export const CONTACT_RESULTS = { reached: "Reached them", voicemail: "Left a voicemail", no_answer: "No answer", sent: "Sent" } as const;
export type ContactResult = keyof typeof CONTACT_RESULTS;

/** A call, text or email someone on the team made. Stops the speed-to-lead clock; "reached" also moves a new lead to Talking. */
export async function logContact(
  db: Db,
  actor: Actor,
  leadId: string,
  input: { kind: (typeof CONTACT_KINDS)[number]; result: ContactResult; note?: string },
  now = new Date(),
): Promise<Activity> {
  const lead = await loadForWrite(db, actor, leadId, now);
  if (!CONTACT_KINDS.includes(input.kind)) throw new Error("Pick call, text or email");
  if (!(input.result in CONTACT_RESULTS)) throw new Error("Pick what happened");
  const note = input.note?.trim().slice(0, 1000);
  const kindWord = input.kind === "sms" ? "Text" : input.kind === "call" ? "Call" : "Email";
  const activity = await db.activities.insert({
    id: randomUUID(),
    leadId,
    kind: input.kind,
    direction: "outbound",
    at: now.toISOString(),
    summary: `${kindWord}: ${CONTACT_RESULTS[input.result].toLowerCase()}${note ? `. ${note}` : ""}`,
    byUserId: actor.userId,
  });
  await audit(db, actor, { action: "lead.contact", resourceType: "activity", resourceId: activity.id, leadId, detail: { kind: input.kind, result: input.result }, at: now });
  if (input.result === "reached" && lead.stage === "new" && !lead.exit) await setStage(db, actor, leadId, "contacted", now);
  return activity;
}

/** Hands a conflict-cleared lead to routing, which offers it to the primary intake attorney first. */
export async function matchLead(db: Db, actor: Actor, leadId: string, now = new Date()) {
  const lead = await loadForWrite(db, actor, leadId, now);
  assertCan(actor.role !== "firm_admin" || !!lead.firmId, "Routing a new lead is done by intake or the platform admin");
  if (lead.conflictCard.clearance !== "clear") throw new Error("Run the conflict check on the case page first");
  return offerNext(db, leadId, now);
}

// ---------------------------------------------------------------------------------------------------------
// New phone call: a lead that came in by phone, typed in by whoever answered

export interface PhoneLeadInput {
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  state: string;
  county?: string;
  matterType?: QuizAnswers["matterType"];
  urgency?: QuizAnswers["urgency"];
  maritalStatus?: QuizAnswers["maritalStatus"];
  children?: QuizAnswers["children"];
  ownsHome?: "yes" | "no";
  notes?: string;
  heardFrom?: string;
  /** The caller said yes to texts on the call */
  smsConsent?: boolean;
}

const MATTERS = ["new_plan", "update_plan", "after_death", "elder_care", "not_sure"] as const;
const URGENCIES = ["exploring", "this_month", "health_event", "recent_death"] as const;

export async function createPhoneLead(db: Db, actor: Actor, input: PhoneLeadInput, now = new Date()): Promise<Lead> {
  requireMfa(actor);
  assertCan(can(actor, "view_lead_desk"), "Only the office can add a phone lead");
  const firstName = input.firstName.trim().slice(0, 80);
  if (!firstName) throw new Error("Enter the caller's first name");
  const phone = input.phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (!/^\d{10}$/.test(phone)) throw new Error("Enter a 10-digit phone number");
  const email = (input.email ?? "").trim().toLowerCase().slice(0, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That email address doesn't look right");
  const state = input.state.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) throw new Error("Pick the caller's state");
  const answers: Partial<QuizAnswers> = {};
  if (input.matterType && (MATTERS as readonly string[]).includes(input.matterType)) answers.matterType = input.matterType;
  if (input.urgency && (URGENCIES as readonly string[]).includes(input.urgency)) answers.urgency = input.urgency;
  if (input.maritalStatus) answers.maritalStatus = input.maritalStatus;
  if (input.children) answers.children = input.children;
  if (input.ownsHome) answers.ownsHome = input.ownsHome;
  const capture = { tool: "phone_call" as const };
  const record: LeadRecord = {
    id: randomUUID(),
    receivedAt: now.toISOString(),
    contact: { firstName, lastName: (input.lastName ?? "").trim().slice(0, 80), email, phone, state: state as LeadRecord["contact"]["state"], county: input.county?.trim().slice(0, 80) || undefined, language: "English" },
    contactMethod: "phone",
    goals: input.notes?.trim().slice(0, 2000) || undefined,
    answers,
    score: scoreLead({ state, servedStates: servedStates(), answers, goals: input.notes, smsConsent: !!input.smsConsent }),
    segments: segmentTags(answers),
    source: { landingPage: "phone", heardFrom: input.heardFrom as LeadRecord["source"]["heardFrom"] },
    capture: capture as unknown as LeadRecord["capture"],
    priorTools: [],
    consent: buildConsentRecord({ smsConsent: !!input.smsConsent, acknowledgedNoRelationship: false, pageUrl: "phone call", ip: null, userAgent: null, now }),
  };
  const lead = await ingestLead(db, record, now);
  // The person who took the call already spoke to them: the lead starts as Talking, not waiting on a reply.
  await db.activities.insert({ id: randomUUID(), leadId: lead.id, kind: "call", direction: "inbound", at: now.toISOString(), summary: "Called in. Taken on the leads desk.", byUserId: actor.userId });
  await setStage(db, actor, lead.id, "contacted", now);
  await db.leads.update(lead.id, { intakeOwnerId: actor.role === "intake" ? actor.userId : lead.intakeOwnerId });
  await audit(db, actor, { action: "lead.phone_create", resourceType: "lead", resourceId: lead.id, leadId: lead.id, at: now });
  return (await db.leads.get(lead.id))!;
}
