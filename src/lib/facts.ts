/**
 * Fact registry, staleness rules and the publish gate (backlog C7).
 *
 * Every state fact and dollar figure the site can cite has a stable id, a current value, a source
 * and an as-of date. An attorney approves the exact value in the portal; the approval is stored
 * (FactVerification) and the fact is publishable only while the approved value still equals the
 * current one. Everything here is pure: callers pass the verification records and the clock.
 *
 * Sources: the federal figures in src/config/figures.ts and the 10-state data layer in
 * src/config/state-data-layer.json (research seed). Add a source by extending `buildRegistry`.
 */
import { FIGURE_DETAILS } from "@/config/figures";
import stateData from "@/config/state-data-layer.json";

export type FactConfidence = "high" | "medium" | "unverified";

export interface Fact {
  /** Stable id: `federal.<key>` or `state.<ABBR>.<key>`. Never reused for a different fact. */
  id: string;
  kind: "federal_figure" | "state_fact";
  state?: string;
  label: string;
  /** Current value as the site would render it, as text. Approval is tied to this exact text. */
  value: string;
  source: string;
  /** ISO date (YYYY-MM-DD) the value was last confirmed against the source. */
  asOf: string;
  confidence: FactConfidence;
  /** True when the value contains a dollar amount or is a numeric figure. */
  dollar: boolean;
  /** A known date on which the underlying law or figure changes (YYYY-MM-DD). */
  changeDate?: string;
  /** Re-indexed every January 1, so last year's value is wrong from that date. */
  annualIndexing?: boolean;
}

/** Approval of one fact's exact value. Append-only: a new approval is a new version. */
export interface FactVerification {
  /** `${factId}@${version}` */
  id: string;
  factId: string;
  version: number;
  approvedValue: string;
  approvedBy: string;
  approvedAt: string;
  note: string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** Known change dates, from the research notes. Add new ones here as they are found. */
export const CHANGE_DATES: Record<string, string> = {
  // California small estate threshold is indexed every 3 years (Prob. Code 13100).
  "state.CA.small_estate_threshold": "2028-04-01",
  // California revocable TOD deed statute sunset, per research notes (verify at publish).
  "state.CA.tod_deed": "2032-01-01",
};

/** Facts whose numbers are re-indexed every January 1. */
export const ANNUAL_INDEXING: ReadonlySet<string> = new Set([
  "federal.federalExemption",
  "federal.annualGiftExclusion",
  "federal.ableAnnualContributionLimit",
  "state.MI.small_estate_threshold",
  // Federal SSI-linked home-equity cap, re-published each year; every state's election follows it.
  ...Object.keys(stateData.states).map((abbr) => `state.${abbr}.medicaid_home_equity`),
]);

const FEDERAL_LABELS: Record<string, string> = {
  federalExemption: "Federal estate tax exemption per person",
  annualGiftExclusion: "Annual gift tax exclusion per recipient",
  medicaidLookbackMonths: "Medicaid look-back period (months)",
  portabilityDeadlineYears: "Portability election deadline (years)",
  ableAnnualContributionLimit: "ABLE account annual contribution limit",
};

function humanize(key: string): string {
  const s = key.replaceAll("_", " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "2026" (a tax year) becomes 2026-01-01; a full ISO date passes through. */
export function normalizeAsOf(asOf: string): string {
  return /^\d{4}$/.test(asOf) ? `${asOf}-01-01` : asOf.slice(0, 10);
}

const DOLLAR = /\$\s?\d/;

function buildRegistry(): Fact[] {
  const facts: Fact[] = [];
  for (const [key, f] of Object.entries(FIGURE_DETAILS)) {
    const id = `federal.${key}`;
    facts.push({
      id,
      kind: "federal_figure",
      label: FEDERAL_LABELS[key] ?? humanize(key),
      value: String(f.value),
      source: f.source,
      asOf: normalizeAsOf(f.asOf),
      confidence: "medium",
      dollar: true,
      changeDate: CHANGE_DATES[id],
      annualIndexing: ANNUAL_INDEXING.has(id) || undefined,
    });
  }
  const states = stateData.states as Record<string, Record<string, { value: string; source: string; as_of: string; confidence: string }>>;
  for (const [abbr, byKey] of Object.entries(states)) {
    for (const [key, f] of Object.entries(byKey)) {
      const id = `state.${abbr}.${key}`;
      facts.push({
        id,
        kind: "state_fact",
        state: abbr,
        label: humanize(key),
        value: f.value,
        source: f.source,
        asOf: normalizeAsOf(f.as_of),
        confidence: f.confidence === "high" || f.confidence === "medium" ? f.confidence : "unverified",
        dollar: DOLLAR.test(f.value),
        changeDate: CHANGE_DATES[id],
        annualIndexing: ANNUAL_INDEXING.has(id) || undefined,
      });
    }
  }
  const seen = new Set<string>();
  for (const f of facts) {
    if (seen.has(f.id)) throw new Error(`duplicate fact id ${f.id}`);
    seen.add(f.id);
  }
  return facts;
}

let registry: Fact[] | undefined;

export function factRegistry(): Fact[] {
  return (registry ??= buildRegistry());
}

export function getFact(id: string): Fact | undefined {
  return factRegistry().find((f) => f.id === id);
}

// ---------------------------------------------------------------------------
// Staleness
// ---------------------------------------------------------------------------

export const STALE_AFTER_MONTHS = 12;
export const CHANGE_WARNING_DAYS = 60;

export type FactAlertKind = "as_of_stale" | "change_date_passed" | "change_date_soon" | "indexing_due" | "indexing_soon";

export interface FactAlert {
  factId: string;
  kind: FactAlertKind;
  /** "expired": the number is probably wrong now and must not be published. "warning": act soon. */
  severity: "expired" | "warning";
  /** The date that triggered the alert. */
  dueOn: string;
  message: string;
}

function day(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return day(d);
}

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dom = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dom, last));
  return day(d);
}

/** The date the fact was last confirmed: its as-of date, or a later approval (the attorney re-checked the source). */
export function confirmedOn(fact: Fact, v?: FactVerification): string {
  const approved = v && v.approvedValue === fact.value ? v.approvedAt.slice(0, 10) : undefined;
  return approved && approved > fact.asOf ? approved : fact.asOf;
}

/**
 * Staleness rules:
 * - as_of (or the latest approval of the current value) is older than 12 months: warning
 * - a known change date has passed since the last confirmation: expired; within 60 days: warning
 * - annual-indexing facts: expired once January 1 has passed since the last confirmation; warning in the 60 days before
 */
export function stalenessAlerts(fact: Fact, v: FactVerification | undefined, now: Date): FactAlert[] {
  const today = day(now);
  const confirmed = confirmedOn(fact, v);
  const alerts: FactAlert[] = [];
  const add = (kind: FactAlertKind, severity: FactAlert["severity"], dueOn: string, message: string) =>
    alerts.push({ factId: fact.id, kind, severity, dueOn, message });

  const staleOn = addMonths(confirmed, STALE_AFTER_MONTHS);
  if (staleOn < today) add("as_of_stale", "warning", staleOn, `Last confirmed ${confirmed}, more than ${STALE_AFTER_MONTHS} months ago`);

  if (fact.changeDate) {
    if (fact.changeDate <= today) {
      if (confirmed < fact.changeDate) add("change_date_passed", "expired", fact.changeDate, `Changed on ${fact.changeDate}; last confirmed ${confirmed}`);
    } else if (fact.changeDate <= addDays(today, CHANGE_WARNING_DAYS)) {
      add("change_date_soon", "warning", fact.changeDate, `Changes on ${fact.changeDate}`);
    }
  }

  if (fact.annualIndexing) {
    const jan1 = `${today.slice(0, 4)}-01-01`;
    const nextJan1 = `${Number(today.slice(0, 4)) + 1}-01-01`;
    if (confirmed < jan1) add("indexing_due", "expired", jan1, `Re-indexed on ${jan1}; last confirmed ${confirmed}`);
    else if (nextJan1 <= addDays(today, CHANGE_WARNING_DAYS)) add("indexing_soon", "warning", nextJan1, `Re-indexed on ${nextJan1}`);
  }
  return alerts;
}

// ---------------------------------------------------------------------------
// Status and publish gate
// ---------------------------------------------------------------------------

export type FactStatus = "pending" | "approved" | "changed" | "stale";

export function latestVerification(verifications: FactVerification[], factId: string): FactVerification | undefined {
  let best: FactVerification | undefined;
  for (const v of verifications) if (v.factId === factId && (!best || v.version > best.version)) best = v;
  return best;
}

/**
 * - pending: never approved
 * - changed: approved before, but the current value is not the approved one
 * - stale: approved and unchanged, but a staleness rule fires (expired, or over 12 months)
 * - approved: approved, unchanged and current
 */
export function factStatus(fact: Fact, v: FactVerification | undefined, now: Date): FactStatus {
  if (!v) return "pending";
  if (v.approvedValue !== fact.value) return "changed";
  const alerts = stalenessAlerts(fact, v, now);
  return alerts.some((a) => a.severity === "expired" || a.kind === "as_of_stale") ? "stale" : "approved";
}

/**
 * Whether a fact may go on a public page: an attorney approved exactly this value, and no
 * known change date or annual re-indexing has passed since it was last confirmed.
 * (A merely old as_of date raises an alert but does not unpublish.)
 */
export function isPublishable(fact: Fact, v: FactVerification | undefined, now: Date = new Date()): boolean {
  if (!v || v.approvedValue !== fact.value) return false;
  return !stalenessAlerts(fact, v, now).some((a) => a.severity === "expired");
}

/** The gate is opt-in so nothing disappears from the site until the attorney starts approving. */
export function publishGateOn(env: Record<string, string | undefined> = process.env): boolean {
  return env.REQUIRE_ATTORNEY_REVIEW === "true";
}

/**
 * The value to render for a fact id, or undefined to leave it out. With the gate off (the default)
 * the current value always renders; with REQUIRE_ATTORNEY_REVIEW=true only publishable facts do.
 */
export function gatedFactValue(
  factId: string,
  verifications: FactVerification[],
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const fact = getFact(factId);
  if (!fact) return undefined;
  if (!publishGateOn(env)) return fact.value;
  return isPublishable(fact, latestVerification(verifications, factId), now) ? fact.value : undefined;
}

export interface FactRow {
  fact: Fact;
  status: FactStatus;
  verification?: FactVerification;
  alerts: FactAlert[];
  publishable: boolean;
}

export function factRows(verifications: FactVerification[], now: Date): FactRow[] {
  return factRegistry().map((fact) => {
    const verification = latestVerification(verifications, fact.id);
    return {
      fact,
      verification,
      status: factStatus(fact, verification, now),
      alerts: stalenessAlerts(fact, verification, now),
      publishable: isPublishable(fact, verification, now),
    };
  });
}
