/**
 * Website chat ("Ask us"): a guided, rule-based assistant built in-house. No paid chat tool and no AI
 * model, so it costs nothing to run and never improvises legal answers. It does three things:
 *   1. learns what the visitor needs (a topic chip or a typed question) and their state,
 *   2. points them at the site's own pages for that topic (Pagefind search for typed questions),
 *   3. hands off to /book?from=chat&topic=<id>, or takes their details through the shared LeadForm,
 *      which posts to /api/leads (consent record, scoring, CRM delivery, portal ingest).
 *
 * Nothing typed in the chat is sent anywhere until the visitor submits the contact form. Analytics
 * events carry only the topic id and step, never the text.
 */
import { bookHref } from "@/lib/book";

/**
 * Shown at the top of every chat. Same wording as the sitewide referral disclaimer
 * (SITE_DISCLAIMER in src/config/firm.ts once the referral-network change lands).
 */
export const CHAT_DISCLAIMER =
  "All information on this website is for educational purposes only. It does not constitute legal advice, and it does not " +
  "create an attorney-client relationship. This is a referral website: we will match you with an appropriate attorney.";

export interface ChatLink {
  label: string;
  href: string;
}

export interface ChatTopic {
  /** Same id as BOOK_TOPICS in src/lib/book.ts, so the handoff link carries it. */
  id: string;
  /** Chip label, written as the visitor would say it. */
  chip: string;
  /** Our reply once the topic is picked. Plain, short, no advice. */
  reply: string;
  /** Pages on the site that cover it. */
  links: ChatLink[];
  /** Someone has died or is very ill: gentler copy, phone and booking offered without sales talk. */
  sensitive?: boolean;
  /** Words that point a typed question at this topic. Matched as whole words, lower case. */
  keywords: string[];
}

export const CHAT_TOPICS: readonly ChatTopic[] = [
  {
    id: "will",
    chip: "I need a will",
    reply: "A will names who gets what and who looks after young children. These pages walk through what goes in one and what it usually costs.",
    links: [
      { label: "Wills, explained", href: "/wills" },
      { label: "What happens if you die without a will", href: "/learn/wills/dying-without-a-will" },
      { label: "Flat-fee packages", href: "/pricing" },
    ],
    keywords: ["will", "wills", "testament", "executor"],
  },
  {
    id: "trust",
    chip: "I'm thinking about a trust",
    reply: "A living trust can keep a home and accounts out of probate. Whether it is worth it depends on what you own and where.",
    links: [
      { label: "Living trusts, explained", href: "/living-trusts" },
      { label: "Types of trusts, side by side", href: "/decide/types-of-trusts" },
      { label: "Will or trust? Quick check", href: "/tools/will-or-trust" },
    ],
    keywords: ["trust", "trusts", "revocable", "irrevocable", "living trust"],
  },
  {
    id: "will-or-trust",
    chip: "Will or trust? Not sure",
    reply: "That is the most common question we get. The quick check below asks a few questions and shows which way families like yours usually go.",
    links: [
      { label: "Will or trust? Quick check", href: "/tools/will-or-trust" },
      { label: "Plan finder", href: "/plan-finder" },
    ],
    keywords: ["which", "difference", "versus", "vs", "better"],
  },
  {
    id: "kids",
    chip: "Guardians for my kids",
    reply: "Naming a guardian, and someone to manage money for the children, is the part of a plan parents worry about most.",
    links: [
      { label: "Estate planning for parents", href: "/estate-planning-for-parents" },
      { label: "Guardian picker", href: "/tools/guardian-picker" },
    ],
    keywords: ["guardian", "guardianship", "kids", "children", "child", "minor", "minors", "baby"],
  },
  {
    id: "poa",
    chip: "Powers of attorney",
    reply: "Financial and healthcare powers of attorney let someone you trust act for you if you can't. These pages explain each one.",
    links: [
      { label: "Powers of attorney", href: "/power-of-attorney" },
      { label: "Healthcare directives", href: "/healthcare-directives" },
    ],
    keywords: ["poa", "power", "attorney-in-fact", "agent", "healthcare", "directive", "incapacity", "dementia"],
  },
  {
    id: "parent",
    chip: "Planning for a parent",
    reply: "Helping a parent plan, or getting ready for long-term care costs, usually starts with their powers of attorney and a look at what they own.",
    links: [
      { label: "Caring for an aging parent", href: "/life-events/caring-for-aging-parents" },
      { label: "Managing a parent's finances", href: "/decide/how-to-manage-a-parents-finances" },
      { label: "Medicaid savings runway", href: "/tools/medicaid-savings-runway" },
    ],
    keywords: ["parent", "parents", "mom", "mother", "dad", "father", "elderly", "medicaid", "nursing"],
  },
  {
    id: "probate",
    chip: "Someone has died",
    reply: "I'm sorry for your loss. There is no rush to read everything today. These pages cover the first few weeks, and you can talk to someone whenever you're ready.",
    links: [
      { label: "Probate, step by step", href: "/probate" },
      { label: "How long probate takes", href: "/learn/probate/how-long-does-probate-take" },
      { label: "Who inherits", href: "/tools/who-inherits" },
    ],
    sensitive: true,
    keywords: ["died", "die", "dies", "dying", "dead", "death", "passed", "probate", "inherit", "inheritance", "heir", "funeral"],
  },
  {
    id: "review",
    chip: "Review my existing plan",
    reply: "Plans go stale after a move, marriage, divorce or new child. An attorney can check whether yours still does what you expect.",
    links: [
      { label: "Common estate planning mistakes", href: "/mistakes" },
      { label: "My family plan organizer", href: "/my-plan" },
    ],
    keywords: ["update", "review", "existing", "old", "outdated", "divorce", "moved", "remarried"],
  },
];

export const QUESTION_CHIP = "Ask a question";

export function chatTopic(id: string | null | undefined): ChatTopic | null {
  return CHAT_TOPICS.find((t) => t.id === id) ?? null;
}

/**
 * Picks the topic a typed question is most likely about, or null. Death-related words win ties so a
 * grieving visitor never gets sales copy.
 */
export function topicForText(text: string): ChatTopic | null {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9' -]/g, " ")} `;
  let best: ChatTopic | null = null;
  let bestScore = 0;
  for (const t of CHAT_TOPICS) {
    let score = 0;
    for (const k of t.keywords) if (lower.includes(` ${k} `)) score += k.includes(" ") ? 2 : 1;
    if (t.sensitive && score > 0) score += 0.5;
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

/** Whether the visitor's state is one the network covers. */
export function isCovered(state: string | null | undefined, served: readonly string[]): boolean {
  return Boolean(state) && served.includes(state!.toUpperCase());
}

/** The booking handoff link, tagged so bookings from the chat can be counted. */
export function chatBookHref(topicId: string | null | undefined): string {
  return bookHref("chat", topicId ?? undefined);
}

export interface ChatSummary {
  topic: string | null;
  state: string | null;
  question: string | null;
  steps: number;
  page: string;
}

/**
 * Flat, small values sent as capture.result with the lead, so the attorney sees what the visitor asked.
 * Only sent when the visitor submits the contact form.
 */
export function chatCaptureResult(s: ChatSummary): Record<string, string | number> {
  const out: Record<string, string | number> = { steps: s.steps, page: s.page.slice(0, 200) };
  if (s.topic) out.topic = s.topic;
  // Same flag the heir tools set: keeps a grieving family on the grief_support track only.
  if (chatTopic(s.topic)?.sensitive) out.mode = "heir";
  if (s.state) out.state = s.state;
  if (s.question) out.question = s.question.trim().slice(0, 500);
  return out;
}

/** Routes where the chat stays hidden: staff and client areas, and pages that are already a booking or intake flow. */
const HIDDEN_PREFIXES = ["/portal", "/admin", "/client", "/book", "/intake", "/plan-finder", "/callback", "/raw", "/og", "/visuals"];

export function chatHiddenOn(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) || /\/view$/.test(pathname);
}

/** Strips Pagefind's <mark> markup and any other tags from a search excerpt. */
export function plainExcerpt(html: string, max = 160): string {
  const text = html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/** A typed state ("nj", "New Jersey", "I live in Illinois") to its code, or null. */
export function matchState(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (/^[a-z]{2}$/.test(t) && STATE_NAMES[t.toUpperCase()]) return t.toUpperCase();
  // Longest names first so "west virginia" is not read as "virginia".
  const byLength = Object.entries(STATE_NAMES).sort((a, b) => b[1].length - a[1].length);
  for (const [code, name] of byLength) if (` ${t} `.includes(` ${name.toLowerCase()} `)) return code;
  return null;
}

const STOPWORDS = new Set(
  "a an and are as at be but by can could did do does for from had has have how i if in is it its me my of on or our should so that the their them then there they this to was we what when where which who why with would you your about any need want".split(" "),
);

/** Turns a typed question into search keywords: "do we have to go through probate?" -> "go through probate". */
export function searchTerms(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .slice(0, 8)
    .join(" ");
}

export function stateName(code: string): string {
  return STATE_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

/** "Illinois and New Jersey", "Illinois, New Jersey and New York". */
export function coveredList(served: readonly string[]): string {
  const names = served.filter((s) => s !== "XX").map(stateName);
  if (names.length <= 1) return names[0] ?? "a few states";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

type MatterType = "new_plan" | "update_plan" | "after_death" | "elder_care" | "not_sure";

const TOPIC_MATTER: Record<string, MatterType> = {
  will: "new_plan",
  trust: "new_plan",
  "will-or-trust": "new_plan",
  kids: "new_plan",
  poa: "new_plan",
  parent: "elder_care",
  probate: "after_death",
  review: "update_plan",
};

/**
 * Quiz-style answers implied by the chat topic, so scoring, routing and the nurture tracks treat a chat
 * lead like any other. "Someone has died" maps to after_death, which puts the lead on the gentle grief
 * track only (no sales texts or emails).
 */
export function chatAnswers(topicId: string | null | undefined): { matterType: MatterType } {
  return { matterType: (topicId && TOPIC_MATTER[topicId]) || "not_sure" };
}
