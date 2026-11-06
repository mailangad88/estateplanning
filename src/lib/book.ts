/**
 * Direct booking (/book). Every "Book a consult" link on the site goes here, carrying where the
 * visitor came from and, when known, what they want to talk about. The page shows the calendar
 * right away, with no questionnaire in front of it.
 */

export interface BookTopic {
  id: string;
  label: string;
  /** Short line the attorney sees in the booking notes. */
  note: string;
  /** Someone has died or is very ill: gentler copy and the phone offered first. */
  urgent?: boolean;
}

export const BOOK_TOPICS: readonly BookTopic[] = [
  { id: "will", label: "A will", note: "Wants to talk about a will" },
  { id: "trust", label: "A living trust", note: "Wants to talk about a living trust" },
  { id: "will-or-trust", label: "Will or trust? Not sure", note: "Deciding between a will and a trust" },
  { id: "kids", label: "Guardians for my kids", note: "Naming guardians and money for children" },
  { id: "poa", label: "Powers of attorney", note: "Financial and healthcare powers of attorney" },
  { id: "review", label: "Review my existing plan", note: "Has documents and wants them reviewed" },
  { id: "parent", label: "Planning for a parent", note: "Helping a parent plan, or long-term care costs" },
  { id: "probate", label: "Someone has died", note: "Settling an estate after a death", urgent: true },
  { id: "other", label: "Something else", note: "Other question" },
];

const TOPIC_IDS = new Set(BOOK_TOPICS.map((t) => t.id));
const FROM_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;

export function bookTopic(id: string | null | undefined): BookTopic | null {
  return id && TOPIC_IDS.has(id) ? BOOK_TOPICS.find((t) => t.id === id)! : null;
}

/** Link to /book. `from` is a short placement slug (tool or page name); `topic` is a BOOK_TOPICS id. */
export function bookHref(from?: string, topic?: string): string {
  const q = new URLSearchParams();
  if (from && FROM_RE.test(from)) q.set("from", from);
  if (topic && TOPIC_IDS.has(topic)) q.set("topic", topic);
  const s = q.toString();
  return s ? `/book?${s}` : "/book";
}

/** Reads /book query params, dropping anything that is not a known topic or a plain slug. */
export function parseBookParams(search: string): { from: string | null; topic: string | null } {
  const q = new URLSearchParams(search);
  const from = q.get("from");
  const topic = q.get("topic");
  return {
    from: from && FROM_RE.test(from) ? from : null,
    topic: topic && TOPIC_IDS.has(topic) ? topic : null,
  };
}

/** Notes prefilled into the booking form so the attorney sees context before the call. */
export function bookingNotes(topic: string | null, from: string | null): string {
  const t = bookTopic(topic);
  const parts = [t ? t.note : null, from ? `Booked from: ${from}` : null].filter(Boolean);
  return parts.join(". ");
}

/**
 * Best-guess booking topic for a page, from its path. Used so a "Book a consult" link on an article or
 * tool opens /book with the right topic already picked. Order matters: the first match wins, so the
 * narrower patterns (will-vs-trust, after a death) sit above the broad ones (will, trust).
 */
const PATH_TOPICS: readonly [RegExp, string][] = [
  [/will-(vs|or)-(a-)?trust|trust-(vs|or)-(a-)?will/, "will-or-trust"],
  [/probate|after-a-death|executor|someone-died|death-of|settling|inherit|heir|trust-administration|small-estate/, "probate"],
  [/guardian|children|kids|minor|new-parent|parents-of|blended/, "kids"],
  [/medicaid|long-term-care|nursing|aging-parent|elder|caregiv|parent/, "parent"],
  [/power-of-attorney|poa|healthcare|health-care|living-will|advance-directive|hipaa/, "poa"],
  [/review|update|beneficiar|divorce|remarr/, "review"],
  [/trust/, "trust"],
  [/will/, "will"],
];

export function topicForPath(path: string): string | undefined {
  const p = path.toLowerCase();
  return PATH_TOPICS.find(([re]) => re.test(p))?.[1];
}

/** Short placement slug for a page: its first path segment, or "home". */
export function fromForPath(path: string): string {
  const first = path.split(/[?#]/)[0].split("/").filter(Boolean)[0] ?? "home";
  const slug = first.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
  return FROM_RE.test(slug) ? slug : "page";
}

/**
 * Booking topic and follow-up line for each free tool, shown in the booking card under the tool so
 * the next step after a result is a time on the calendar. Every tool in config/tools.ts needs a row
 * (tests/book.test.ts checks).
 */
export const TOOL_BOOKING: Record<string, { topic: string; title: string }> = {
  "plan-readiness-assessment": { topic: "review", title: "Have your score? Go over the gaps with an attorney" },
  "will-or-trust": { topic: "will-or-trust", title: "Still torn between a will and a trust?" },
  "estate-tax-estimator": { topic: "trust", title: "Want to talk through what the estimate means for you?" },
  "probate-cost-estimator": { topic: "trust", title: "Want to keep your family out of probate?" },
  "life-insurance-needs": { topic: "kids", title: "Make sure the money reaches the people you meant it for" },
  "guardian-fund-calculator": { topic: "kids", title: "Ready to name a guardian and set the money aside?" },
  "medicaid-lookback-date": { topic: "parent", title: "Planning around the look-back for a parent?" },
  "executor-workload": { topic: "probate", title: "Want help with the executor's list?" },
  "plan-review-reminder": { topic: "review", title: "Time for an update? Have an attorney look it over" },
  "state-death-tax-checker": { topic: "trust", title: "Want to talk through the tax picture?" },
  "small-estate-checker": { topic: "probate", title: "Not sure the small estate route fits?" },
  "medicaid-savings-runway": { topic: "parent", title: "Want to talk through care costs with an attorney?" },
  "beneficiary-audit": { topic: "review", title: "Found a mismatch? Get it fixed with an attorney" },
  "guardian-picker": { topic: "kids", title: "Picked your guardian? Put it in writing" },
  "who-inherits": { topic: "will", title: "Not happy with who would inherit? A will changes it" },
  "probate-asset-sorter": { topic: "trust", title: "Want fewer assets going through probate?" },
  "inheritance-timeline": { topic: "probate", title: "Waiting on an estate? Ask what can speed it up" },
};
