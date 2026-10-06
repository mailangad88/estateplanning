/**
 * Lead health: is the website's webhook feed to the CRM middleware actually delivering, and how fast
 * does a new lead get a first contact? Aggregates and ids only, no client names or contact details.
 * Delivery counts are never suppressed. Rates, and the speed-to-lead median and p90, follow the
 * analytics rule: with fewer than MIN_CELL leads or deliveries they are null (a tiny sample is noise
 * and can single out one person's outcome).
 *
 * Firm admins see only deliveries and leads belonging to their firm; platform admins see everything.
 */
import { assertCan, can, ForbiddenError } from "@/server/auth/policy";
import { MIN_CELL, percentile } from "@/server/analytics";
import type { Db } from "@/server/db";
import type { Actor, CrmDelivery } from "@/server/types";
import { isHumanOutreach } from "@/server/services/contact";

const HOUR = 3_600_000;
const MIN = 60_000;

export interface DeliveryWindow {
  label: "24h" | "7d";
  total: number;
  delivered: number;
  /** Still being retried */
  failed: number;
  /** Given up or rejected by the middleware: needs a person */
  abandoned: number;
  /** Null under MIN_CELL deliveries */
  failureRate: number | null;
}

export interface FailureRow {
  id: string;
  leadId: string;
  event: string;
  status: CrmDelivery["status"];
  httpStatus?: number;
  attempts: number;
  error?: string;
  firstAttemptAt: string;
  lastAttemptAt: string;
}

export interface LeadHealthReport {
  generatedAt: string;
  firmId?: string;
  windows: DeliveryWindow[];
  /** Every delivery that is not delivered, whatever its age, so nothing silently ages out of view */
  openFailures: { failed: number; abandoned: number };
  recentFailures: FailureRow[];
  speedToLead: {
    windowDays: number;
    leads: number;
    contacted: number;
    uncontacted: number;
    /** Null when fewer than MIN_CELL leads were contacted */
    medianMinutes: number | null;
    p90Minutes: number | null;
    suppressed: boolean;
  };
}

export interface LeadHealthOptions {
  now?: Date;
  /** Speed-to-lead lookback. Default 30. */
  speedDays?: number;
  /** Rows in recentFailures. Default 20. */
  failureLimit?: number;
}

function windowFor(label: DeliveryWindow["label"], hours: number, rows: CrmDelivery[], now: number): DeliveryWindow {
  const inWin = rows.filter((r) => now - new Date(r.createdAt).getTime() < hours * HOUR);
  const count = (s: CrmDelivery["status"]) => inWin.filter((r) => r.status === s).length;
  const failed = count("failed");
  const abandoned = count("abandoned");
  return {
    label,
    total: inWin.length,
    delivered: count("delivered"),
    failed,
    abandoned,
    failureRate: inWin.length < MIN_CELL ? null : (failed + abandoned) / inWin.length,
  };
}

export async function leadHealthReport(db: Db, actor: Actor, opts: LeadHealthOptions = {}): Promise<LeadHealthReport> {
  assertCan(can(actor, "view_lead_health"));
  let firmId: string | undefined;
  if (actor.role === "firm_admin") {
    if (!actor.firmId) throw new ForbiddenError();
    firmId = actor.firmId;
  }
  const now = (opts.now ?? new Date()).getTime();
  const speedDays = opts.speedDays ?? 30;

  const firmLeads = firmId ? await db.leads.list(undefined, { firmId }) : undefined;
  const firmLeadIds = firmLeads ? new Set(firmLeads.map((l) => l.id)) : undefined;
  const deliveries = (await db.crmDeliveries.list((d) => !firmLeadIds || firmLeadIds.has(d.leadId))).sort((a, b) =>
    b.lastAttemptAt.localeCompare(a.lastAttemptAt),
  );

  const open = deliveries.filter((d) => d.status !== "delivered");
  const recentFailures: FailureRow[] = open.slice(0, opts.failureLimit ?? 20).map((d) => ({
    id: d.id,
    leadId: d.leadId,
    event: d.event,
    status: d.status,
    httpStatus: d.httpStatus,
    attempts: d.attempts,
    error: d.error,
    firstAttemptAt: d.createdAt,
    lastAttemptAt: d.lastAttemptAt,
  }));

  // Speed to lead: earliest outbound call, text or email, or the "contacted" stage, whichever is first.
  const since = now - speedDays * 24 * HOUR;
  const leads = (firmLeads ?? (await db.leads.list())).filter((l) => {
    const t = new Date(l.createdAt).getTime();
    return t >= since && t <= now;
  });
  const leadIds = new Set(leads.map((l) => l.id));
  const activities = await db.activities.list((a) => leadIds.has(a.leadId) && isHumanOutreach(a));
  const firstOut = new Map<string, number>();
  for (const a of activities) {
    const t = new Date(a.at).getTime();
    firstOut.set(a.leadId, Math.min(t, firstOut.get(a.leadId) ?? Infinity));
  }
  const waits: number[] = [];
  for (const l of leads) {
    const created = new Date(l.createdAt).getTime();
    const times = [firstOut.get(l.id), ...l.stageHistory.filter((h) => h.stage === "contacted").map((h) => new Date(h.at).getTime())].filter(
      (t): t is number => t !== undefined && t >= created,
    );
    if (times.length) waits.push((Math.min(...times) - created) / MIN);
  }
  const suppressed = waits.length < MIN_CELL;

  return {
    generatedAt: new Date(now).toISOString(),
    firmId,
    windows: [windowFor("24h", 24, deliveries, now), windowFor("7d", 24 * 7, deliveries, now)],
    openFailures: { failed: open.filter((d) => d.status === "failed").length, abandoned: open.filter((d) => d.status === "abandoned").length },
    recentFailures,
    speedToLead: {
      windowDays: speedDays,
      leads: leads.length,
      contacted: waits.length,
      uncontacted: leads.length - waits.length,
      medianMinutes: suppressed ? null : percentile(waits, 50),
      p90Minutes: suppressed ? null : percentile(waits, 90),
      suppressed,
    },
  };
}
