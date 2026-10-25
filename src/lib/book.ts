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
