/**
 * Booking offers per audience, from the client pain-point research (2026-10-31,
 * /mnt/project-files/research/client-pain-points/README.md). The booking card on a page picks the
 * first offer whose path pattern matches, so the call it offers fits the worry that brought the
 * visitor there: an executor gets an estate call, a new parent gets a guardian call.
 *
 * Offers marked `needsOk` make a promise only the attorney can make (that a call is free, how long it
 * runs, a turnaround or evening slots). Until Sargun approves one and its id is added to
 * NEXT_PUBLIC_APPROVED_OFFERS (comma separated), the page shows the offer's neutral wording, which
 * promises nothing beyond a call. The Spanish-language call is left out until a network attorney who
 * speaks Spanish is confirmed.
 */

export interface BookingOffer {
  id: string;
  /** Matched against the page path, lower-cased. First match wins. */
  match: RegExp;
  /** /book?topic= id (see BOOK_TOPICS in lib/book.ts). */
  topic: string;
  /** True when the approved wording promises something the attorney must confirm. */
  needsOk: boolean;
  title: string;
  body: string;
  /** Wording used until the offer is approved. Required when needsOk is true. */
  neutral?: { title: string; body: string };
  /** Crisis audiences: phone and call-back come before the calendar (research: fastest to convert). */
  callFirst?: boolean;
}

export const BOOKING_OFFERS: readonly BookingOffer[] = [
  {
    id: "urgent-callback",
    match: /hospital|discharge|dementia|alzheimer|serious-diagnosis|after-a-diagnosis|incapacit/,
    topic: "parent",
    needsOk: true,
    callFirst: true,
    title: "Need help this week? Ask for a same-day call back",
    body: "Hospital discharge, a dementia diagnosis, papers that need signing soon: call us or leave your number and we will call back the same day.",
    neutral: {
      title: "Something urgent? Call us, or ask for a call back",
      body: "Hospital discharge, a dementia diagnosis, papers that need signing soon: call us or leave your number, and we will set up a call with an estate planning attorney in our network as soon as we can.",
    },
  },
  {
    id: "executor-first-call",
    match: /probate|after-a-death|executor|heir|someone-died|death-of|inherit|small-estate|trust-administration|widow|spouse-died|surviving-spouse/,
    topic: "probate",
    needsOk: true,
    callFirst: true,
    title: "Settling an estate? Book an executor call this week",
    body: "Talk through the house, the accounts and whether probate is needed with an estate planning attorney in our network, usually within the same week.",
    neutral: {
      title: "Settling an estate? Talk it through with an attorney",
      body: "We are sorry for your loss. Talk through the house, the accounts and whether probate is needed with an estate planning attorney in our network. Call if there is a deadline.",
    },
  },
  {
    id: "parent-planning-call",
    match: /aging-parent|caring-for|caregiv|elder|medicaid|nursing|long-term-care|parent-with|for-a-parent|planning-for-parents/,
    topic: "parent",
    needsOk: true,
    title: "Book a parent planning call, with your parent on the line",
    body: "Bring your parent to the call. An estate planning attorney in our network explains powers of attorney, care costs and what can still be signed.",
    neutral: {
      title: "Planning for a parent? Talk it through with an attorney",
      body: "An estate planning attorney in our network can explain powers of attorney, care costs and what your parent can still sign. You can both join the call.",
    },
  },
  {
    id: "custom-strategy-call",
    match: /estate-tax|death-tax|farm|business-owner|business-succession|high-net|4-million/,
    topic: "trust",
    needsOk: false,
    title: "Close to the Illinois $4 million line? Book a strategy call",
    body: "A house, a 401(k) and life insurance can add up faster than people expect. Talk through the Illinois estate tax with an estate planning attorney in our network and get a custom quote.",
  },
  {
    id: "couples-call",
    match: /blended|stepchild|step-child|remarr|second-marriage|unmarried|domestic-partner|cohabit|living-together/,
    topic: "trust",
    needsOk: false,
    title: "Book a call for both of you",
    body: "Blended families and unmarried couples need the plan to say what Illinois law will not assume. Both partners can join the call with an estate planning attorney in our network.",
  },
  {
    id: "new-parent-guardian",
    match: /guardian|new-parent|new-baby|expecting|young-famil|children|kids|minor/,
    topic: "kids",
    needsOk: true,
    title: "Name a guardian: book an evening or video call",
    body: "Pick the people who would raise your kids and put it in writing. Evening and video times are open, so both parents can join after bedtime.",
    neutral: {
      title: "Ready to name a guardian for your kids?",
      body: "Pick the people who would raise your kids and put it in writing, with an estate planning attorney in our network. Both parents can join the call.",
    },
  },
  {
    id: "plan-check",
    match: /review|update|diy|online-will|handwritten|old-will|divorc|moving|moved|beneficiar/,
    topic: "review",
    needsOk: true,
    title: "Send us your current will for a plan check",
    body: "Have a DIY will, an old plan or a divorce since you signed? Book a plan check and an estate planning attorney in our network will tell you what still works.",
    neutral: {
      title: "Have a plan already? Have it looked over",
      body: "A DIY will, an old plan or a divorce since you signed can leave gaps. Book a call and an estate planning attorney in our network will go over what you have.",
    },
  },
  {
    id: "fit-call",
    match: /.*/,
    topic: "will-or-trust",
    needsOk: true,
    title: "Start with a free 15-minute fit call",
    body: "Not sure what you need? Pick a time for a short call. We match you with an estate planning attorney in our network, and you see the flat fee before anything is signed.",
    neutral: {
      title: "Talk it through with an attorney",
      body: "Pick a time that suits you and we match you with an estate planning attorney in our network. No questionnaire first, and you see the flat fee before anything is signed.",
    },
  },
];

/** Offer ids Sargun has approved, from NEXT_PUBLIC_APPROVED_OFFERS. Empty until he says yes. */
export function approvedOffers(raw: string | undefined = process.env.NEXT_PUBLIC_APPROVED_OFFERS): Set<string> {
  return new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}

export interface ResolvedOffer {
  id: string;
  topic: string;
  title: string;
  body: string;
  callFirst: boolean;
  approved: boolean;
}

/** The offer for a page, with the wording it may show today. */
export function offerForPath(path: string, approved: Set<string> = approvedOffers()): ResolvedOffer {
  const p = path.toLowerCase();
  const o = BOOKING_OFFERS.find((x) => x.match.test(p)) ?? BOOKING_OFFERS[BOOKING_OFFERS.length - 1];
  const ok = !o.needsOk || approved.has(o.id);
  const copy = ok || !o.neutral ? { title: o.title, body: o.body } : o.neutral;
  return { id: o.id, topic: o.topic, ...copy, callFirst: Boolean(o.callFirst), approved: ok };
}
