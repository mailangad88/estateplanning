/**
 * The visual kit: small interactive and picture blocks that any article can carry between its
 * sections. Writers place one with a marker in the markdown body, for example
 *
 *   <!-- visual: whatif id=unfunded-trust -->
 *   <!-- visual: picker id=will-or-trust -->
 *   <!-- visual: diagram name=ProbateTimeline -->
 *
 * or in frontmatter (`visuals: [{ section: "How probate works", type: timeline, id: after-a-death }]`).
 * Sections without one get a visual picked for them (lib/visual-sections.ts), so every article reads
 * as a run of pictures, not a wall of words.
 *
 * Copy here is advertising copy: launch-check word rules apply, claims stay general ("usually",
 * "in many states") and everything is a draft until the attorney reviews it.
 */

export type VisualSpec =
  | { type: "whatif"; id: string }
  | { type: "whatif-strip"; ids: string[] }
  | { type: "picker"; id: string }
  | { type: "timeline"; id: string }
  | { type: "slider"; id: "probate-cost" }
  | { type: "diagram"; name: string }
  | { type: "download"; slug: string }
  | { type: "related" }
  | { type: "tool"; slug: string }
  /** A free tool from /tools drawn inline, so the reader can try it without leaving the article. */
  | { type: "widget"; slug: WidgetSlug }
  /** A piece of a /decide guide: its picker, 2D map, table, option cards or shortcuts. */
  | { type: "decision"; slug: string; part: "picker" | "map" | "table" | "cards" | "shortcuts" };

export type VisualType = VisualSpec["type"];

/** Tools small enough to run inside an article. All three suit calm pages (no cost talk, no scoring). */
export const WIDGETS = ["who-inherits", "probate-asset-sorter", "inheritance-timeline"] as const;
export type WidgetSlug = (typeof WIDGETS)[number];
export const isWidget = (slug: string | undefined): slug is WidgetSlug => (WIDGETS as readonly string[]).includes(slug ?? "");

/* ---------- Mini decision pickers: one question, an instant answer, a next step ---------- */

export interface MiniPicker {
  id: string;
  question: string;
  options: { label: string; title: string; text: string; tone: "plan" | "wait" | "info" }[];
  next: { label: string; href: string };
  /** Words in a page's path or title that make this picker a fit. */
  match: RegExp;
}

export const PICKERS: MiniPicker[] = [
  {
    id: "will-or-trust",
    question: "Which sounds most like you?",
    options: [
      { label: "I rent and have modest savings", title: "A will is often enough", text: "A will, beneficiary forms and powers of attorney cover most of what matters. Small estates may qualify for a simpler process.", tone: "info" },
      { label: "I own a home", title: "A living trust is worth a look", text: "A home in your name alone usually goes through probate. A funded trust, or a transfer on death deed where allowed, can avoid that.", tone: "plan" },
      { label: "I own property in more than one state", title: "A trust usually saves a second court case", text: "Real estate in another state can need its own probate there. A trust can hold both.", tone: "plan" },
      { label: "I have children under 18", title: "You need a will either way", text: "Only a will names a guardian. A trust for the children decides who manages their money and until what age.", tone: "plan" },
    ],
    next: { label: "Get a will-or-trust recommendation", href: "/tools/will-or-trust" },
    match: /trust|will|probate|house|home/i,
  },
  {
    id: "who-decides",
    question: "If you could not speak for yourself tomorrow, who would decide for you?",
    options: [
      { label: "My spouse, automatically", title: "Not always", text: "A spouse often cannot sign for accounts or property in your name alone. A power of attorney names who can.", tone: "wait" },
      { label: "My adult children", title: "Only if they are named", text: "Without signed documents, family may need to ask a court for a guardianship, which takes time and money.", tone: "wait" },
      { label: "Someone I named in signed papers", title: "You are ahead of most people", text: "Check that you named a backup, and that the documents are recent enough for banks and hospitals to accept.", tone: "plan" },
    ],
    next: { label: "See what a power of attorney does", href: "/power-of-attorney" },
    match: /power-of-attorney|poa|incapac|health|living-will|hipaa|dementia|directive|guardianship-adult|agent/i,
  },
  {
    id: "house-title",
    question: "How is your house titled today?",
    options: [
      { label: "In my name alone", title: "Probate is likely", text: "A home in one person's name usually needs probate before it can be sold or transferred.", tone: "wait" },
      { label: "Jointly with my spouse", title: "Probate is often delayed, not avoided", text: "It usually passes to the surviving spouse, then faces probate when they die unless more planning is done.", tone: "info" },
      { label: "In a living trust", title: "It can skip probate", text: "As long as the deed was actually retitled to the trust. Check the recorded deed.", tone: "plan" },
      { label: "I'm not sure", title: "Worth checking this week", text: "Your recorded deed shows who owns the home. A short call can tell you what it means for your family.", tone: "info" },
    ],
    next: { label: "Estimate what probate could cost", href: "/tools/probate-cost-estimator" },
    match: /probate|house|home|deed|real-estate|property|transfer-on-death|joint/i,
  },
  {
    id: "beneficiary-check",
    question: "When did you last check your beneficiary forms?",
    options: [
      { label: "In the last year", title: "Good habit", text: "Keep a backup beneficiary named on each account, and check again after any big life change.", tone: "plan" },
      { label: "Before a marriage, divorce or new baby", title: "Time for a check", text: "Forms override your will. Old forms can send money to an ex or leave out a child.", tone: "wait" },
      { label: "Never, or I don't remember", title: "Start here", text: "Retirement accounts and life insurance follow the form, not the will. Ten minutes per account is usually enough.", tone: "wait" },
    ],
    next: { label: "Run the free beneficiary audit", href: "/tools/beneficiary-audit" },
    match: /beneficiar|401|ira|retirement|life-insurance|pod|payable/i,
  },
  {
    id: "guardian",
    question: "Have you named a guardian for your children?",
    options: [
      { label: "Yes, in a signed will", title: "Well done", text: "Make sure you named a backup, and that the money for the children has a manager too.", tone: "plan" },
      { label: "We talked about it, nothing signed", title: "It doesn't count yet", text: "A conversation is not a nomination. Until a will names someone, a judge decides.", tone: "wait" },
      { label: "Not yet", title: "The most important step for parents", text: "Only a parent's will can name a guardian. It can be done in a short appointment.", tone: "wait" },
    ],
    next: { label: "Use the guardian picker", href: "/tools/guardian-picker" },
    match: /guardian|minor|child|kid|parent|baby/i,
  },
];

/* ---------- Timelines: what happens, in order ---------- */

export interface Timeline {
  id: string;
  title: string;
  steps: { when: string; title: string; text: string }[];
  match: RegExp;
}

export const TIMELINES: Timeline[] = [
  {
    id: "making-a-plan",
    title: "How a plan usually comes together",
    steps: [
      { when: "Day 1", title: "Answer a few questions", text: "Who matters, what you own, and what worries you." },
      { when: "Week 1", title: "Talk it through", text: "A consult turns your answers into a list of documents and a flat fee." },
      { when: "Weeks 2 to 4", title: "Review your drafts", text: "Read them in plain language and ask for changes." },
      { when: "Signing day", title: "Sign with witnesses", text: "Done the way your state requires, so the documents count." },
      { when: "After", title: "Fund and store", text: "Retitle accounts into any trust, store originals, tell the people you named." },
    ],
    match: /how-to-make|make-a-will|getting-started|what-is-estate-planning|how-it-works|pricing/i,
  },
  {
    id: "after-a-death",
    title: "The first months after a death, in order",
    steps: [
      { when: "First days", title: "Care for the family", text: "Funeral plans, notify close family, secure the home and car." },
      { when: "First weeks", title: "Gather paperwork", text: "Death certificates, the will or trust, and a list of accounts and bills." },
      { when: "Month 1 to 2", title: "Start the process", text: "File the will with the court if probate is needed, or the trustee begins work." },
      { when: "The following months", title: "Notify, collect, pay", text: "Creditors are notified, assets collected, bills and taxes paid." },
      { when: "At the end", title: "Distribute", text: "What is left goes to the people named, and the estate is closed." },
    ],
    match: /after-a-death|settl|executor|probate|trustee|administration|died|death/i,
  },
  {
    id: "trust-funding",
    title: "Funding a trust, step by step",
    steps: [
      { when: "Step 1", title: "List what you own", text: "Home, bank and brokerage accounts, business interests, valuables." },
      { when: "Step 2", title: "Retitle the home", text: "A new deed puts the home in the trust's name." },
      { when: "Step 3", title: "Move the accounts", text: "Banks retitle accounts to the trust or add it as payable on death." },
      { when: "Step 4", title: "Line up beneficiaries", text: "Retirement accounts usually stay in your name and name beneficiaries instead." },
      { when: "Ongoing", title: "Keep it funded", text: "New accounts and property go into the trust too." },
    ],
    match: /trust|fund/i,
  },
];

/** Per-type labels for the picker eyebrow above each visual. */
export const VISUAL_LABELS: Record<VisualType, string> = {
  whatif: "What if?",
  "whatif-strip": "What could go wrong",
  picker: "Quick check",
  timeline: "Step by step",
  slider: "Try the numbers",
  diagram: "See it",
  download: "Free resource",
  related: "Keep exploring",
  tool: "Free tool",
  decision: "Compare your options",
  widget: "Try it here",
};

const MARKER = /<!--\s*visual:\s*([a-z-]+)((?:\s+[a-z]+=[^\s>]+)*)\s*-->/gi;

/** Reads `<!-- visual: type key=value -->` into a spec, or null when it is not a valid marker. */
export function parseMarker(type: string, args: string): VisualSpec | null {
  const kv = Object.fromEntries(Array.from(args.matchAll(/([a-z]+)=([^\s>]+)/gi), (m) => [m[1].toLowerCase(), m[2]]));
  switch (type.toLowerCase()) {
    case "whatif": return kv.id ? { type: "whatif", id: kv.id } : null;
    case "whatif-strip": return kv.ids ? { type: "whatif-strip", ids: kv.ids.split(",") } : null;
    case "picker": return kv.id ? { type: "picker", id: kv.id } : null;
    case "timeline": return kv.id ? { type: "timeline", id: kv.id } : null;
    case "slider": return kv.id === "probate-cost" ? { type: "slider", id: "probate-cost" } : null;
    case "diagram": return kv.name ? { type: "diagram", name: kv.name } : null;
    case "download": return kv.slug ? { type: "download", slug: kv.slug } : null;
    case "related": return { type: "related" };
    case "tool": return kv.slug ? { type: "tool", slug: kv.slug } : null;
    case "widget": return isWidget(kv.slug) ? { type: "widget", slug: kv.slug } : null;
    case "decision": {
      const part = (kv.part ?? "map") as Extract<VisualSpec, { type: "decision" }>["part"];
      return kv.slug && ["picker", "map", "table", "cards", "shortcuts"].includes(part) ? { type: "decision", slug: kv.slug, part } : null;
    }
    default: return null;
  }
}

export const MARKER_RE = MARKER;
