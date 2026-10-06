/**
 * "When will I get my inheritance?" timeline. Pure logic and data, no React.
 * Educational only. Most steps have no fixed length, so those are shown as
 * plain-language ranges, not dates. Calendar dates appear only where a statute
 * fixes a period AND we have confirmed the period against ilga.gov (rule R4).
 */

export type Route =
  | "beneficiary"
  | "joint"
  | "trust"
  | "small_estate"
  | "probate_independent"
  | "probate_supervised";

export type Confidence = "high" | "medium" | "unverified";
export type PhaseKind = "statute" | "typical";
export type Pace = "weeks" | "months" | "year_plus";

export interface StatuteFact {
  cite: string;
  source: string;
  months: number;
  confidence: Confidence;
  asOf: string;
}

// verify: ilga.gov was not reachable when this was written (HTTP 403 through the proxy), so
// neither period was read from the primary source. The repo's county guides state both as six
// months, but that is a secondary source. Flip `confidence` to "high" only after reading
// 755 ILCS 5/18-3 and 755 ILCS 5/8-1 on ilga.gov; calendar dates then appear automatically.
export const CLAIMS_PERIOD: StatuteFact = {
  cite: "755 ILCS 5/18-3",
  source: "https://ilga.gov/legislation/ilcs/documents/075500050K18-3.htm",
  months: 6,
  confidence: "unverified",
  asOf: "2026-10-06",
};
export const CONTEST_PERIOD: StatuteFact = {
  cite: "755 ILCS 5/8-1",
  source: "https://ilga.gov/legislation/ilcs/documents/075500050K8-1.htm",
  months: 6,
  confidence: "unverified",
  asOf: "2026-10-06",
};

export interface TimelineInput {
  deathDate: string;
  route: Route;
  disputes: boolean;
  estateTax: boolean;
  /** Optional: date the will was admitted to probate. */
  admissionDate?: string;
  /** Optional: date the claims notice was first published. */
  publicationDate?: string;
}

export interface Phase {
  id: string;
  label: string;
  kind: PhaseKind;
  pace: Pace;
  /** Plain label, such as "Often a few weeks". Never a promise. */
  range: string;
  note: string;
  /** Illustrative layout only (0 to 100 of the bar width). Not a prediction. */
  start: number;
  len: number;
  /** Set only when a verified statute fixes the period. */
  endDate?: string;
  /** True when the date is the earliest possible, because the start date is not known yet. */
  endIsEarliest?: boolean;
  cite?: string;
  source?: string;
  /** Statute fixes a period but we have not confirmed its length, so no number is shown. */
  unverifiedStatute?: boolean;
}

export interface TimelineResult {
  route: Route;
  routeLabel: string;
  phases: Phase[];
  overall: Pace;
  overallText: string;
  /** Plain statement about when money usually first reaches people. */
  firstMoney: string;
  caveats: string[];
}

export const ROUTE_LABELS: Record<Route, string> = {
  beneficiary: "Beneficiary designation or POD/TOD account",
  joint: "Joint ownership with survivorship",
  trust: "Living trust",
  small_estate: "Small estate affidavit",
  probate_independent: "Probate in Illinois, independent administration",
  probate_supervised: "Probate in Illinois, supervised administration",
};

export const DISCLAIMER = "General information, not legal advice. Laws differ by state.";

export function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

/** Adds calendar months in UTC, clamping to the last day (Aug 31 + 6 months = Feb 28/29). */
export function addMonths(iso: string, months: number): string {
  const d = parseDate(iso);
  if (!d) return iso;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last))).toISOString().slice(0, 10);
}

export function validateDeathDate(iso: string, today: Date): string | null {
  const d = parseDate(iso);
  if (!d) return "Please enter a valid date.";
  if (d.getTime() > today.getTime()) return "That date is in the future.";
  if (d.getUTCFullYear() < 1990) return "Please check the year.";
  return null;
}

const usable = (f: StatuteFact) => f.confidence === "high";

function claimsPhase(inp: TimelineInput, start: number, len: number): Phase {
  const base: Phase = {
    id: "claims",
    label: "Creditor claims period",
    kind: "statute",
    pace: "months",
    range: "Set by Illinois law",
    note: "Creditors get a set time to make claims after the notice is first published. The notice goes out after the executor is appointed, so the clock starts weeks after the death, not on the date of death.",
    start,
    len,
    cite: CLAIMS_PERIOD.cite,
    source: CLAIMS_PERIOD.source,
  };
  if (!usable(CLAIMS_PERIOD)) return { ...base, unverifiedStatute: true };
  const pub = inp.publicationDate && parseDate(inp.publicationDate) ? inp.publicationDate : null;
  return {
    ...base,
    endDate: addMonths(pub ?? inp.deathDate, CLAIMS_PERIOD.months),
    endIsEarliest: !pub,
  };
}

function contestPhase(inp: TimelineInput, start: number, len: number): Phase {
  const base: Phase = {
    id: "contest",
    label: "Window to contest the will",
    kind: "statute",
    pace: "months",
    range: "Set by Illinois law",
    note: "After a will is admitted to probate, interested people have a limited time to challenge it. Distributions are often held back until this window has passed, if anyone is likely to object.",
    start,
    len,
    cite: CONTEST_PERIOD.cite,
    source: CONTEST_PERIOD.source,
  };
  if (!usable(CONTEST_PERIOD)) return { ...base, unverifiedStatute: true };
  const adm = inp.admissionDate && parseDate(inp.admissionDate) ? inp.admissionDate : null;
  return {
    ...base,
    endDate: addMonths(adm ?? inp.deathDate, CONTEST_PERIOD.months),
    endIsEarliest: !adm,
  };
}

const typical = (id: string, label: string, pace: Pace, range: string, note: string, start: number, len: number): Phase => ({
  id, label, kind: "typical", pace, range, note, start, len,
});

const DOCS = typical("docs", "Gather death certificates and paperwork", "weeks", "Often days to weeks",
  "Certified copies of the death certificate are usually ordered first. Banks and insurers ask for them.", 0, 8);

export function inheritanceTimeline(inp: TimelineInput): TimelineResult {
  const phases: Phase[] = [];
  let overall: Pace;
  let firstMoney: string;
  const caveats = [
    "These are patterns, not predictions. Every estate moves at its own speed.",
    "Bar lengths are only a rough picture of order and relative length. They are not a schedule.",
  ];

  switch (inp.route) {
    case "beneficiary":
      phases.push(
        DOCS,
        typical("claim", "File the claim with the bank, insurer or plan", "weeks", "Often a few weeks",
          "You send the claim form and a death certificate. Some companies are quicker, and retirement accounts can have extra choices to make.", 6, 22),
        typical("pay", "Payment or transfer", "weeks", "Often weeks after a complete claim",
          "A missing form or a question about the beneficiary can slow it down.", 26, 18),
      );
      overall = "weeks";
      firstMoney = "Assets with a named beneficiary usually skip probate, so they are often the first to be paid out.";
      break;
    case "joint":
      phases.push(
        DOCS,
        typical("title", "Record the death and update the title or account", "weeks", "Often weeks",
          "For a home, a death certificate and an affidavit are commonly recorded with the county. For a bank account, the bank updates the name.", 6, 26),
      );
      overall = "weeks";
      firstMoney = "Joint property with survivorship passes to the surviving owner outside probate, so the wait is mostly paperwork.";
      break;
    case "small_estate":
      phases.push(
        DOCS,
        typical("affidavit", "Complete the small estate affidavit", "weeks", "Often weeks",
          "You sign a sworn statement. Whether you qualify depends on the estate's size and what it holds.", 6, 22),
        typical("present", "Banks and others accept the affidavit", "weeks", "Often weeks",
          "Each institution reviews it on its own timeline and may ask questions.", 26, 22),
      );
      overall = "weeks";
      firstMoney = "When the small estate route fits, it is generally much quicker than a full probate case. Each holder of an asset decides when it accepts the affidavit.";
      break;
    case "trust":
      phases.push(
        DOCS,
        typical("notice", "Trustee takes over and notifies beneficiaries", "weeks", "Often weeks",
          "The trustee finds the assets, gets a tax ID for the trust and tells the beneficiaries.", 4, 14),
        typical("settle", "Pay final bills and file final tax returns", "months", "Often several months",
          "No court case is needed, so the pace is set by the trustee and the tax calendar.", 16, 36),
        typical("distribute", "Distribution to beneficiaries", "months", "Often a few months to a year",
          "Some trusts pay out right away. Others pay over time or at set ages, as the trust says.", 50, 36),
      );
      overall = "months";
      firstMoney = "A living trust usually avoids probate, so it is often faster than probate, though trustees often hold back money until debts and taxes are clear.";
      break;
    case "probate_independent":
    case "probate_supervised": {
      const sup = inp.route === "probate_supervised";
      phases.push(
        DOCS,
        typical("open", "File the will and open the estate", "weeks", "Often a few weeks",
          "The executor or administrator is appointed by the court. Court calendars vary by county.", 4, 14),
        typical("inventory", "Inventory assets and send notices", "months", "Often one to a few months",
          "Illinois sets a deadline for the inventory, and notice goes to heirs and known creditors.", 16, 22),
        claimsPhase(inp, 22, 38),
        contestPhase(inp, 18, 38),
        typical("pay", "Pay claims, taxes and expenses", "months", "Often a few months",
          "Valid claims are paid from the estate before beneficiaries are.", 58, 16),
        typical("distribute", sup ? "Court approves the accounting, then distribution" : "Distribute and close the estate", "months",
          sup ? "Often longer than independent administration" : "Often a few months after claims are resolved",
          sup
            ? "Under supervised administration the court reviews steps along the way, which usually adds time and cost."
            : "Under independent administration the executor can act with less court involvement, so the final steps are usually quicker.",
          74, sup ? 26 : 20),
      );
      overall = sup ? "year_plus" : "months";
      firstMoney = "Beneficiaries under a will usually wait until the claims period ends. In independent administration an executor may sometimes make partial distributions earlier, if it is safe to do so.";
      break;
    }
  }

  if (inp.estateTax) {
    const probate = inp.route.startsWith("probate");
    phases.push(
      typical("estate_tax", "Estate tax return and payment", "months", "Due on a fixed date after death",
        "Large estates may owe Illinois and federal estate tax. The return has its own due date, and the executor or trustee often keeps some money back until it is filed and paid. See the Illinois estate tax guide.",
        probe(probate), 40),
    );
    if (overall === "weeks") overall = "months";
    caveats.push("Because estate tax may be owed, the final distribution often waits for the return to be filed and any tax paid.");
  }

  if (inp.disputes) {
    const probate = inp.route.startsWith("probate");
    phases.push(
      typical("dispute", "Dispute or will contest, if one is filed", "year_plus", "Can add many months, sometimes years",
        "If someone challenges a will, a trust or a payment, a court may need to decide. Settlements are common and can be quicker than a full trial.",
        probe(probate) + 10, 50),
    );
    overall = "year_plus";
    firstMoney = "When a dispute is likely, executors and trustees often hold back distributions until it is resolved.";
    caveats.push("A dispute is the biggest single reason an inheritance takes longer than planned.");
  }

  const overallText: Record<Pace, string> = {
    weeks: "Often weeks to a few months",
    months: "Often several months to about a year",
    year_plus: "Often a year or more",
  };

  return { route: inp.route, routeLabel: ROUTE_LABELS[inp.route], phases, overall, overallText: overallText[overall], firstMoney, caveats };
}

function probe(probate: boolean): number {
  return probate ? 30 : 20;
}
