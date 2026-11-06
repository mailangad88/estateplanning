/**
 * Social magnet pages (/tips/<slug>). Each page is where a short video sends people from Instagram,
 * Facebook and YouTube Shorts: the fear in their own words, a straight answer, a quick check they can
 * tap through, what to do this week, the free resource, and the booking link.
 *
 * Rules for this file:
 * - Illinois only for the first launch. Every fact carries the statute or agency it comes from, and the
 *   site's learn pages hold the longer, sourced version.
 * - No outcome promises. Results in the quick check say what usually happens and who decides.
 * - Offers the attorney has not approved (free call, call length, response times) stay neutral:
 *   "Book a consult", never "free 15-minute call".
 * - reviewed stays false until the attorney signs off. Unreviewed pages are noindex.
 */

import type { BookTopic } from "@/lib/book";

export interface TipFact {
  text: string;
  /** Statute, rule or agency the fact comes from. */
  cite: string;
}

export interface TipCheckOption {
  label: string;
  /** What usually happens in this situation. Plain, no promises. */
  result: string;
  /** Page that explains this branch in full. */
  next: { href: string; label: string };
}

export interface SocialTip {
  slug: string;
  /** Short label for the hub card and on-screen end card. */
  label: string;
  title: string;
  /** The worry, the way people say it. Shown as the opening line. */
  hook: string;
  /** Two to four sentences that answer it. */
  answer: string;
  facts: TipFact[];
  check: { question: string; options: TipCheckOption[] };
  thisWeek: string[];
  faqs: { q: string; a: string }[];
  /** Free resource slug in content/magnets. */
  magnet: string;
  /** Interactive tool slug in src/config/tools.ts, when one fits. */
  tool?: string;
  related: { href: string; label: string }[];
  bookTopic: BookTopic["id"];
  /** Someone has died or is very ill: gentler copy, no urgency language. */
  sensitive?: boolean;
  /** Audience tag used by the content calendar. */
  audience: "heirs" | "widowed" | "caregivers" | "parents" | "homeowners" | "everyone" | "blended" | "couples";
  reviewed: boolean;
  updated: string;
}

export const SOCIAL_TIPS: readonly SocialTip[] = [
  {
    slug: "house-still-in-moms-name",
    label: "The house is still in Mom's name",
    title: "Mom died and the house is still in her name. Now what?",
    hook: "\"We can't sell it, we can't refinance it, and the bank won't talk to us.\"",
    answer:
      "In Illinois, a house only skips the court if the paperwork moved it: a living trust, a transfer on death instrument, or a deed that held it jointly with a survivor. If none of those exist, the house usually goes through probate before anyone can sell it, whether or not there is a will. The small estate affidavit does not cover real estate.",
    facts: [
      { text: "With no will, the house passes to the heirs set by Illinois law: half to a surviving spouse and half to the children, or all to the children if there is no spouse.", cite: "755 ILCS 5/2-1" },
      { text: "The Illinois small estate affidavit covers personal property up to $150,000. It cannot transfer real estate.", cite: "755 ILCS 5/25-1" },
      { text: "A recorded transfer on death instrument passes the house to the named beneficiary without probate.", cite: "755 ILCS 27 (Real Property Transfer on Death Instrument Act)" },
    ],
    check: {
      question: "How was the house titled when your parent died?",
      options: [
        {
          label: "In a living trust",
          result: "The successor trustee named in the trust can usually sell or transfer the house without opening probate. Find the trust document and the trustee's certification.",
          next: { href: "/learn/illinois/illinois-living-trusts", label: "How Illinois living trusts work" },
        },
        {
          label: "Joint with a spouse or someone still living",
          result: "If the deed says joint tenancy or tenancy by the entirety, the survivor usually owns it now. A death certificate and an affidavit are typically recorded to clear the title.",
          next: { href: "/learn/illinois/illinois-joint-tenancy-and-tenancy-by-the-entirety", label: "Joint tenancy in Illinois" },
        },
        {
          label: "Her name only, and there is a TODI on record",
          result: "The beneficiary named in the transfer on death instrument usually takes the house without probate, after a notice of death affidavit is recorded.",
          next: { href: "/learn/illinois/illinois-transfer-on-death-instrument", label: "Illinois transfer on death instruments" },
        },
        {
          label: "Her name only, nothing else",
          result: "This usually means probate before the house can be sold or refinanced, even with a will. An attorney can tell you whether independent administration fits, which is usually faster.",
          next: { href: "/learn/illinois/illinois-probate-process", label: "The Illinois probate process, step by step" },
        },
      ],
    },
    thisWeek: [
      "Get a copy of the deed from the county recorder (most counties have it online).",
      "Order several certified death certificates.",
      "Look for a will or trust in papers, a safe deposit box, or with the attorney who drafted it.",
      "Keep paying insurance, utilities and property tax so the house stays protected.",
      "Do not sign a listing agreement until you know who has authority to sell.",
    ],
    faqs: [
      { q: "Can we sell the house without probate if all the siblings agree?", a: "Agreement helps, but it does not replace legal authority. A title company needs proof of who owns the house, which usually means a court order, a trust, or a transfer on death instrument." },
      { q: "Who pays the mortgage while this is sorted out?", a: "The loan does not go away. Keep paying if you can, and tell the lender about the death. Federal rules generally stop a lender from calling the loan just because the house passed to a relative." },
    ],
    magnet: "illinois-inherited-property-clear-title-guide",
    tool: "probate-asset-sorter",
    related: [
      { href: "/learn/illinois/illinois-small-estate-affidavit", label: "What the small estate affidavit can and cannot do" },
      { href: "/learn/illinois/how-long-does-probate-take-in-illinois", label: "How long probate takes in Illinois" },
      { href: "/free/illinois-heirship-affidavit-worksheet", label: "Heirship affidavit worksheet" },
    ],
    bookTopic: "probate",
    sensitive: true,
    audience: "heirs",
    reviewed: false,
    updated: "2026-10-31",
  },
  {
    slug: "how-long-probate-takes-illinois",
    label: "How long probate takes",
    title: "How long does probate take in Illinois?",
    hook: "\"The lawyer said probate. Does that mean years?\"",
    answer:
      "Most Illinois estates that go through probate take at least six months, because creditors get six months from the first published notice to file claims. Simple estates under independent administration often close in about nine to twelve months. Disputes, a house that is hard to sell, or missing heirs push it longer.",
    facts: [
      { text: "Creditors have at least six months from the first publication of the notice to file a claim.", cite: "755 ILCS 5/18-3" },
      { text: "Independent administration lets the executor act without asking the court to approve each step, which is why it is usually faster.", cite: "755 ILCS 5/28-1" },
      { text: "A will contest must be filed within six months after the will is admitted to probate.", cite: "755 ILCS 5/8-1" },
    ],
    check: {
      question: "What does the estate look like right now?",
      options: [
        {
          label: "Bank accounts and a car, no house",
          result: "If the personal property is $150,000 or less and there is no real estate, the small estate affidavit may avoid probate entirely.",
          next: { href: "/learn/illinois/illinois-small-estate-affidavit", label: "The Illinois small estate affidavit" },
        },
        {
          label: "A house, family gets along",
          result: "Independent administration is common here. Plan on the six-month claims period plus time to sell or transfer the house.",
          next: { href: "/learn/illinois/illinois-probate-process", label: "Illinois probate, step by step" },
        },
        {
          label: "A house, and the family disagrees",
          result: "Disagreements are the biggest reason probate runs long. Talking to an attorney early, and sometimes mediation, can keep it from reaching a courtroom fight.",
          next: { href: "/free/when-heirs-disagree-guide", label: "When heirs disagree (free guide)" },
        },
      ],
    },
    thisWeek: [
      "Find the original will. Illinois requires it to be filed with the clerk of the circuit court after the death.",
      "Write a rough list of what the person owned and how each item was titled.",
      "Hold off on paying debts out of your own pocket until you know the estate's order of payment.",
    ],
    faqs: [
      { q: "Can we speed it up?", a: "The six-month claims period is fixed. What you can control is getting the inventory, house and tax returns ready while that clock runs." },
      { q: "Does every estate go through probate?", a: "No. Assets with a named beneficiary, joint accounts with a survivor, trust assets, and small estates under $150,000 of personal property often skip it." },
    ],
    magnet: "cook-county-probate-guide",
    tool: "inheritance-timeline",
    related: [
      { href: "/learn/illinois/how-long-does-probate-take-in-illinois", label: "How long probate takes in Illinois (full guide)" },
      { href: "/learn/illinois/illinois-probate-costs", label: "What Illinois probate costs" },
      { href: "/free/illinois-probate-checklist", label: "Illinois probate checklist" },
    ],
    bookTopic: "probate",
    sensitive: true,
    audience: "heirs",
    reviewed: false,
    updated: "2026-10-31",
  },
  {
    slug: "spouse-died-accounts-frozen",
    label: "My spouse died and the accounts are frozen",
    title: "My spouse died and the bank froze the accounts. How do I pay the bills?",
    hook: "\"Everything was in his name. The mortgage is due and I can't touch the money.\"",
    answer:
      "Joint accounts usually pass straight to you. Accounts in your spouse's name alone are often frozen until someone has legal authority. Illinois gives a surviving spouse a separate right to support from the estate, called the spouse's award, and accounts with a payable on death name go to that person without court.",
    facts: [
      { text: "The spouse's award is at least $20,000, plus $10,000 for each minor child living with the spouse, for nine months of support.", cite: "755 ILCS 5/15-1" },
      { text: "A spouse can collect up to $150,000 of personal property with a small estate affidavit when no probate is opened.", cite: "755 ILCS 5/25-1" },
      { text: "A surviving spouse can renounce the will and take one-third of the estate if there are descendants, or one-half if not.", cite: "755 ILCS 5/2-8" },
    ],
    check: {
      question: "Whose name is on the account the bank froze?",
      options: [
        {
          label: "Both our names",
          result: "Most joint accounts belong to the survivor. Bring a certified death certificate and ask the bank to retitle it to you.",
          next: { href: "/learn/illinois/illinois-payable-on-death-and-joint-bank-accounts", label: "Joint and payable on death accounts" },
        },
        {
          label: "Just my spouse, with me as POD beneficiary",
          result: "A payable on death account usually goes to the named person after the bank sees the death certificate and your ID.",
          next: { href: "/learn/illinois/illinois-payable-on-death-and-joint-bank-accounts", label: "Payable on death accounts in Illinois" },
        },
        {
          label: "Just my spouse, no beneficiary",
          result: "The bank will usually want a small estate affidavit or letters from the probate court. The spouse's award is a separate claim you can make on the estate.",
          next: { href: "/learn/illinois/illinois-spouse-rights-at-death", label: "A spouse's rights in Illinois" },
        },
      ],
    },
    thisWeek: [
      "Call Social Security about survivor benefits.",
      "List every bill and when it is due. Many lenders will pause payments for a short time if you call.",
      "Check work benefits: life insurance through an employer is often forgotten.",
      "Do not close your spouse's accounts yet. Some are needed to receive final paychecks or refunds.",
    ],
    faqs: [
      { q: "Am I responsible for my spouse's credit card debt?", a: "Usually not for a card in your spouse's name alone, unless it was joint or you co-signed. Illinois can make a spouse responsible for some family expenses, such as medical bills (750 ILCS 65/15). The estate pays valid debts first, so ask before paying anything out of your own money." },
      { q: "Is there a deadline?", a: "There is no rush to file anything this week. If you want to renounce the will, that has a seven-month deadline after the will is admitted to probate." },
    ],
    magnet: "illinois-spousal-rights-guide",
    related: [
      { href: "/learn/illinois/illinois-spouse-rights-at-death", label: "A surviving spouse's rights in Illinois" },
      { href: "/learn/illinois/illinois-property-tax-exemptions-after-a-spouse-dies", label: "Property tax exemptions after a spouse dies" },
      { href: "/free/illinois-staying-in-the-house-after-a-death-guide", label: "Staying in the house after a death" },
    ],
    bookTopic: "probate",
    sensitive: true,
    audience: "widowed",
    reviewed: false,
    updated: "2026-10-31",
  },
  {
    slug: "parent-dementia-no-power-of-attorney",
    label: "Mom has dementia and no power of attorney",
    title: "Mom has dementia and never signed a power of attorney. Is it too late?",
    hook: "\"The doctor says it's getting worse. Can she still sign anything?\"",
    answer:
      "A diagnosis does not by itself mean she cannot sign. If she still understands what the document does and who she is choosing, she may be able to sign powers of attorney now. If she cannot, the family usually needs a court guardianship, which takes longer and costs more. That is why timing matters.",
    facts: [
      { text: "Illinois uses statutory forms for the power of attorney for property and for health care.", cite: "755 ILCS 45 (Illinois Power of Attorney Act)" },
      { text: "Without a health care agent, Illinois law lists who can make medical decisions in order: guardian, spouse or civil union partner, adult children, parents, siblings, and others.", cite: "755 ILCS 40/25 (Health Care Surrogate Act)" },
      { text: "If a person can no longer manage their affairs and has no agent, a court can appoint a guardian of the person, the estate, or both.", cite: "755 ILCS 5/11a" },
    ],
    check: {
      question: "Right now, can she follow a conversation about who should handle her money?",
      options: [
        {
          label: "Yes, most days",
          result: "This is the window to sign. An attorney meets with her, checks that she understands, and often notes it in writing. Do it soon.",
          next: { href: "/learn/illinois/illinois-power-of-attorney-for-property", label: "Illinois power of attorney for property" },
        },
        {
          label: "Some days, not others",
          result: "Many families schedule the signing for a good time of day. The attorney decides whether she can sign; a note from her doctor can help.",
          next: { href: "/free/dementia-diagnosis-legal-checklist", label: "Dementia diagnosis legal checklist (free)" },
        },
        {
          label: "No",
          result: "A guardianship through the circuit court is usually the path. For medical decisions in the meantime, the Health Care Surrogate Act lets family decide in a set order.",
          next: { href: "/learn/illinois/illinois-guardianship", label: "Guardianship in Illinois" },
        },
      ],
    },
    thisWeek: [
      "Write down what she owns and where the statements come from.",
      "Ask her doctor to note her current ability to make decisions at the next visit.",
      "Find out whether she signed anything years ago. An old power of attorney may still be valid.",
      "Talk with siblings now about who will be the agent, before a crisis forces it.",
    ],
    faqs: [
      { q: "Can I just sign for her?", a: "No. Signing her name without authority can be treated as fraud, even with good intentions." },
      { q: "Does a joint bank account solve it?", a: "It can help with bills, but it also makes you a co-owner, which can cause problems with Medicaid, creditors and siblings. Ask before adding names." },
    ],
    magnet: "dementia-planning-guide",
    related: [
      { href: "/learn/illinois/illinois-health-care-surrogate-act-who-decides", label: "Who decides when there is no health care agent" },
      { href: "/learn/illinois/illinois-healthcare-power-of-attorney", label: "Illinois health care power of attorney" },
      { href: "/free/illinois-adult-guardianship-process-guide", label: "Illinois adult guardianship guide" },
    ],
    bookTopic: "parent",
    sensitive: true,
    audience: "caregivers",
    reviewed: false,
    updated: "2026-10-31",
  },
  {
    slug: "will-medicaid-take-the-house",
    label: "Will Medicaid take Mom's house?",
    title: "Will the state take Mom's house to pay for the nursing home?",
    hook: "\"Everyone keeps telling me the state takes the house.\"",
    answer:
      "Illinois can file a claim against a Medicaid recipient's probate estate after death, but not while a spouse, a child under 21, or a blind or disabled child survives. For deaths on or after July 1, 2022, the first $25,000 is protected. What passes outside probate is generally out of reach. Moving the house close to applying can trigger the five-year look-back, so get advice before changing any deed.",
    facts: [
      { text: "Recovery is deferred while a surviving spouse, a child under 21, or a blind or disabled child is living.", cite: "Illinois HFS estate recovery rules; 305 ILCS 5/5-13" },
      { text: "For deaths on or after July 1, 2022, the first $25,000 of the estate is protected from recovery.", cite: "305 ILCS 5/5-13" },
      { text: "Gifts and transfers made in the five years before applying for long-term care Medicaid can delay eligibility.", cite: "42 U.S.C. 1396p(c)" },
    ],
    check: {
      question: "Where are you in the process?",
      options: [
        {
          label: "Planning ahead, no care needed yet",
          result: "This is when there are the most choices. Changes made more than five years before applying are outside the look-back.",
          next: { href: "/learn/illinois/illinois-medicaid-nursing-home-eligibility-and-planning", label: "Planning for Illinois Medicaid" },
        },
        {
          label: "Care needed within a year or two",
          result: "Do not move the house or give money away yet. Some transfers are allowed (for example to a spouse), and others delay coverage.",
          next: { href: "/tools/medicaid-lookback-date", label: "Find your look-back date" },
        },
        {
          label: "Already on Medicaid",
          result: "The question is what happens after death. Recovery reaches the probate estate, and a hardship waiver exists for some heirs.",
          next: { href: "/learn/illinois/illinois-medicaid-estate-recovery", label: "Illinois Medicaid estate recovery" },
        },
      ],
    },
    thisWeek: [
      "Find out how the house is titled today.",
      "Gather five years of bank statements. Medicaid will ask for them.",
      "Write down any gifts or loans made to family in the last five years.",
    ],
    faqs: [
      { q: "Should Mom just put the house in my name?", a: "Often that is the worst move. It can start the five-year penalty clock, and you lose the tax benefit of inheriting the house. Ask an attorney first." },
      { q: "Does a living trust protect the house from Medicaid?", a: "A revocable living trust does not protect assets for Medicaid eligibility. Some irrevocable trusts can, if set up well before care is needed." },
    ],
    magnet: "illinois-medicaid-estate-recovery-guide",
    tool: "medicaid-lookback-date",
    related: [
      { href: "/learn/illinois/illinois-medicaid-estate-recovery", label: "Illinois Medicaid estate recovery" },
      { href: "/tools/medicaid-savings-runway", label: "How long savings last in a nursing home" },
      { href: "/free/illinois-medicaid-long-term-care-guide", label: "Illinois Medicaid long-term care guide" },
    ],
    bookTopic: "parent",
    audience: "caregivers",
    reviewed: false,
    updated: "2026-10-31",
  },
  {
    slug: "who-gets-my-kids",
    label: "Who gets my kids?",
    title: "If something happens to both of us, who raises our kids?",
    hook: "\"We can't agree on a guardian, so we haven't done anything.\"",
    answer:
      "If you do not name a guardian, an Illinois judge picks one, and relatives can ask the court for the job. Naming a guardian in your will tells the court who you want. It also helps to leave money in a way the guardian can actually use, because money left directly to a minor ends up under court supervision until the child turns 18.",
    facts: [
      { text: "Parents can name a guardian for their minor children in a will. The court gives that choice great weight.", cite: "755 ILCS 5/11-5" },
      { text: "Illinois also lets parents name a standby or short-term guardian who can step in right away.", cite: "755 ILCS 5/11-5.3, 5/11-5.4" },
      { text: "Money left outright to a child is usually held by a court-supervised guardian of the estate until age 18.", cite: "755 ILCS 5/11-13" },
    ],
    check: {
      question: "What is holding you back?",
      options: [
        {
          label: "We disagree on who",
          result: "Very common. Score each person on values, location, age, and how they handle money. Many couples name one person to raise the kids and another to manage the money.",
          next: { href: "/tools/guardian-picker", label: "Guardian picker tool" },
        },
        {
          label: "Our first choice lives out of state",
          result: "An out-of-state guardian can be named. The court weighs what is best for the children, including moving them.",
          next: { href: "/learn/illinois/illinois-guardianship", label: "Guardianship in Illinois" },
        },
        {
          label: "We just haven't gotten to it",
          result: "A short-term guardian form is a quick first step, and the will makes it lasting. Both are usually part of a basic plan.",
          next: { href: "/learn/illinois/illinois-standby-and-short-term-guardians-for-children", label: "Standby and short-term guardians" },
        },
      ],
    },
    thisWeek: [
      "Each of you write your top two guardian choices separately, then compare.",
      "Ask your first choice if they are willing, before you put them in writing.",
      "Check who is named as beneficiary on your life insurance. Naming a minor child directly creates court involvement.",
    ],
    faqs: [
      { q: "Can we name a couple as guardians?", a: "You can, but think about what happens if they split up. Many parents name one person and say what they want if that person is no longer married." },
      { q: "Do grandparents automatically get the kids?", a: "No. Nobody gets them automatically. Without a will, family members can ask the court, and the judge decides." },
    ],
    magnet: "guardian-for-your-kids-worksheet",
    tool: "guardian-picker",
    related: [
      { href: "/learn/illinois/illinois-standby-and-short-term-guardians-for-children", label: "Short-term and standby guardians in Illinois" },
      { href: "/tools/guardian-fund-calculator", label: "How much money a guardian needs" },
      { href: "/free/illinois-guardianship-for-minors-guide", label: "Illinois guardianship for minors guide" },
    ],
    bookTopic: "kids",
    audience: "parents",
    reviewed: false,
    updated: "2026-10-31",
  },
  {
    slug: "illinois-estate-tax-4-million",
    label: "The Illinois $4 million estate tax",
    title: "Illinois has its own estate tax at $4 million. Are you closer than you think?",
    hook: "\"Estate tax is for millionaires. That's not us.\"",
    answer:
      "Illinois taxes estates over $4 million, far below the federal line. Add the house, retirement accounts and life insurance, and many suburban couples get close. The $4 million is a threshold, not a credit, so going even slightly over can bring a sizable tax bill. A spouse cannot use the other's unused $4 million unless the plan is set up for it.",
    facts: [
      { text: "Estates worth more than $4 million must file an Illinois estate tax return, and the tax is due nine months after death.", cite: "35 ILCS 405 (Illinois Estate and Generation-Skipping Transfer Tax Act)" },
      { text: "Illinois does not allow portability between spouses.", cite: "35 ILCS 405" },
      { text: "Life insurance owned by the person who died counts toward the estate's value.", cite: "26 U.S.C. 2042, used by the Illinois computation" },
    ],
    check: {
      question: "Roughly what would your estate be worth, counting life insurance?",
      options: [
        {
          label: "Under $3 million",
          result: "Illinois estate tax is unlikely to apply today, but growth in the house and retirement accounts can change that. Recheck every few years.",
          next: { href: "/tools/estate-tax-estimator", label: "Estimate your estate tax" },
        },
        {
          label: "$3 to $5 million",
          result: "This is the range where planning matters most. Married couples often use a trust to keep the first spouse's $4 million from going to waste.",
          next: { href: "/learn/illinois/illinois-estate-tax", label: "Illinois estate tax explained" },
        },
        {
          label: "Over $5 million",
          result: "Expect Illinois tax without planning. A custom plan can include credit shelter trusts, life insurance trusts and gifting.",
          next: { href: "/free/estate-tax-trust-strategies-comparison", label: "Estate tax trust strategies (free)" },
        },
      ],
    },
    thisWeek: [
      "Add up the house, retirement accounts, brokerage, business interests and life insurance death benefits.",
      "Check who owns each life insurance policy.",
      "If you are married, check whether your current plan splits assets between you or leaves everything outright.",
    ],
    faqs: [
      { q: "Does the federal exemption protect us?", a: "No. The federal exemption is much higher, but Illinois sets its own $4 million line." },
      { q: "Do we pay it, or do our kids?", a: "The estate pays it before the heirs receive their shares, so it comes out of what your children inherit." },
    ],
    magnet: "illinois-estate-tax-guide",
    tool: "estate-tax-estimator",
    related: [
      { href: "/learn/illinois/illinois-estate-tax", label: "Illinois estate tax explained" },
      { href: "/tools/state-death-tax-checker", label: "State death tax checker" },
      { href: "/free/estate-tax-planning-worksheet", label: "Estate tax planning worksheet" },
    ],
    bookTopic: "trust",
    audience: "homeowners",
    reviewed: false,
    updated: "2026-10-31",
  },
  {
    slug: "not-enough-to-need-a-will",
    label: "\"I don't have enough to need a will\"",
    title: "\"I don't have enough to need a will.\" Here is what Illinois does without one.",
    hook: "\"It's just a car and a 401(k). Why would I need a will?\"",
    answer:
      "A will is less about how much you own and more about who decides. Without one, Illinois law picks your heirs, a judge picks the guardian for your kids, and a court picks who handles the estate. Retirement accounts and life insurance go to whoever is on the beneficiary form, which may be out of date.",
    facts: [
      { text: "With a spouse and children, Illinois gives half to the spouse and half to the children. Unmarried partners get nothing.", cite: "755 ILCS 5/2-1" },
      { text: "Beneficiary designations on retirement accounts and life insurance override a will.", cite: "Plan and policy terms; 755 ILCS 5/2-1 applies only to the probate estate" },
      { text: "Illinois does not recognize common-law marriage.", cite: "750 ILCS 5/214" },
    ],
    check: {
      question: "Which of these is true for you?",
      options: [
        {
          label: "I have kids under 18",
          result: "Then the guardian question alone is reason enough. Only a will (or a guardian designation) tells the court who you want.",
          next: { href: "/tips/who-gets-my-kids", label: "Who gets my kids?" },
        },
        {
          label: "I live with a partner but we are not married",
          result: "Without a will or beneficiary forms, your partner inherits nothing from you in Illinois.",
          next: { href: "/learn/wills/leaving-property-to-a-partner-friend-or-non-citizen-in-a-will", label: "Leaving property to a partner" },
        },
        {
          label: "Single, no kids",
          result: "Your parents or siblings would inherit. A will lets you choose, and powers of attorney matter even more when there is no spouse.",
          next: { href: "/tools/who-inherits", label: "See who inherits from you" },
        },
      ],
    },
    thisWeek: [
      "Log in to your 401(k), IRA and work life insurance and check the beneficiary on each.",
      "Try the who-inherits tool to see what Illinois would do today.",
      "Write down who you would want to make medical decisions if you could not.",
    ],
    faqs: [
      { q: "Is a free online will good enough?", a: "It can be, if it is signed in front of two witnesses who inherit nothing under it. Many are not, and the mistakes show up after death." },
      { q: "What does a basic plan include?", a: "Usually a will, a power of attorney for property and one for health care. See our pricing page for what each package includes." },
    ],
    magnet: "illinois-intestacy-chart",
    tool: "who-inherits",
    related: [
      { href: "/learn/wills/dying-without-a-will", label: "What happens if you die without a will" },
      { href: "/tools/beneficiary-audit", label: "Beneficiary form check" },
      { href: "/pricing", label: "What a plan costs" },
    ],
    bookTopic: "will",
    audience: "everyone",
    reviewed: false,
    updated: "2026-10-31",
  },
  {
    slug: "is-my-online-will-valid",
    label: "Is my online will valid?",
    title: "Is my online or handwritten will valid in Illinois?",
    hook: "\"I printed a will from a website and signed it. Are we good?\"",
    answer:
      "In Illinois, a will must be in writing, signed by you, and signed by two credible witnesses who watched you sign. A handwritten will with no witnesses is not valid here. If a witness also inherits under the will, that gift can be cut unless two other witnesses signed. Electronic wills are allowed, but they have their own rules.",
    facts: [
      { text: "A will must be signed by the testator and attested by two or more credible witnesses.", cite: "755 ILCS 5/4-3" },
      { text: "A gift to a witness is void unless the will is also attested by two other credible witnesses.", cite: "755 ILCS 5/4-6" },
      { text: "Illinois allows electronic wills and remote witnessing under specific procedures.", cite: "755 ILCS 6 (Electronic Wills and Remote Witnesses Act)" },
    ],
    check: {
      question: "How was your will signed?",
      options: [
        {
          label: "Two witnesses watched me sign",
          result: "That meets the basic rule. Check that neither witness inherits anything, and consider having it reviewed if your family has changed.",
          next: { href: "/learn/wills/how-to-make-a-valid-will", label: "How to make a valid will" },
        },
        {
          label: "Only a notary",
          result: "A notary alone is not enough for a will in Illinois. You likely need to sign again in front of two witnesses.",
          next: { href: "/free/illinois-signing-requirements-cheat-sheet", label: "Illinois signing requirements (free)" },
        },
        {
          label: "Handwritten, no witnesses",
          result: "Illinois does not accept unwitnessed handwritten wills. Your estate would likely pass as if you had no will.",
          next: { href: "/learn/wills/handwritten-and-diy-wills", label: "Handwritten and DIY wills" },
        },
      ],
    },
    thisWeek: [
      "Find the original signed will and check the witness signatures.",
      "Make sure no witness is someone who inherits under it.",
      "Store the original somewhere your executor can find it.",
    ],
    faqs: [
      { q: "Does a will need to be notarized in Illinois?", a: "No. Notarizing an attached affidavit can make it self-proving, which helps later, but the witnesses are what make it valid." },
      { q: "Can I fix it myself?", a: "You can sign a new will properly. Writing changes on the old one can cause more problems than it solves." },
    ],
    magnet: "diy-will-red-flags-checklist",
    related: [
      { href: "/learn/wills/handwritten-and-diy-wills", label: "Handwritten and DIY wills" },
      { href: "/learn/wills/are-free-templates-for-a-will-legal", label: "Are online will templates legal?" },
      { href: "/free/illinois-handwritten-oral-and-emergency-wills-guide", label: "Handwritten and emergency wills in Illinois" },
    ],
    bookTopic: "review",
    audience: "everyone",
    reviewed: false,
    updated: "2026-10-31",
  },
  {
    slug: "blended-family-kids-inherit",
    label: "Will my kids from my first marriage inherit?",
    title: "Will my kids from my first marriage get anything, or will it all go to my new spouse?",
    hook: "\"I want my wife taken care of, but I want my kids to get the house eventually.\"",
    answer:
      "Under Illinois law with no will, your spouse and your children split your probate estate. But whatever goes to your spouse is theirs, and when they die it goes to their heirs, which may not include your children. Stepchildren inherit nothing from a stepparent by default. A trust can provide for your spouse during their life and then pass to your children.",
    facts: [
      { text: "With no will, a spouse and descendants split the estate half and half.", cite: "755 ILCS 5/2-1" },
      { text: "Stepchildren are not heirs of a stepparent unless they were adopted.", cite: "755 ILCS 5/2-1, 5/2-4" },
      { text: "A surviving spouse can renounce a will and take one-third of the estate when there are descendants.", cite: "755 ILCS 5/2-8" },
    ],
    check: {
      question: "What matters most to you?",
      options: [
        {
          label: "My spouse can stay in the house for life",
          result: "A trust can let your spouse live in the house and then pass it to your children. A simple will cannot easily do both.",
          next: { href: "/learn/illinois/illinois-living-trusts", label: "Illinois living trusts" },
        },
        {
          label: "My kids get something right away",
          result: "Life insurance or retirement accounts with your children named can go to them at death, while the rest provides for your spouse.",
          next: { href: "/tools/beneficiary-audit", label: "Check your beneficiary forms" },
        },
        {
          label: "We both have kids and want to treat them equally",
          result: "Couples often sign matching plans, but either spouse can change theirs later. A trust that becomes fixed at the first death can prevent that.",
          next: { href: "/free/blended-family-planning-guide", label: "Blended family planning guide" },
        },
      ],
    },
    thisWeek: [
      "List what you brought into the marriage and what you own together.",
      "Check the beneficiary on retirement accounts. An ex-spouse may still be named.",
      "Talk with your spouse about what each of you wants for your own children.",
    ],
    faqs: [
      { q: "Can my spouse change our joint plan after I die?", a: "If everything goes to your spouse outright, yes. A trust that becomes irrevocable at your death can lock in your wishes." },
      { q: "Does a prenup handle this?", a: "A prenup can waive inheritance rights, but it does not by itself say who gets what. You still need a will or trust." },
    ],
    magnet: "blended-family-planning-guide",
    related: [
      { href: "/learn/illinois/illinois-spouse-rights-at-death", label: "A spouse's rights in Illinois" },
      { href: "/learn/illinois/illinois-prenup-and-inheritance-rights", label: "Prenups and inheritance rights" },
      { href: "/free/illinois-blended-family-contest-proofing-kit", label: "Blended family contest-proofing kit" },
    ],
    bookTopic: "trust",
    audience: "blended",
    reviewed: false,
    updated: "2026-10-31",
  },
  {
    slug: "unmarried-partner-rights",
    label: "My partner and I aren't married",
    title: "We aren't married. What happens to my partner if I die or end up in the hospital?",
    hook: "\"We've been together 12 years. Doesn't that count?\"",
    answer:
      "Not in Illinois. There is no common-law marriage, so with no paperwork your partner inherits nothing and comes near the end of the list of people who can make medical decisions. A will, beneficiary forms, a deed that names your partner, and powers of attorney fix most of this.",
    facts: [
      { text: "Illinois does not recognize common-law marriages entered into in Illinois.", cite: "750 ILCS 5/214" },
      { text: "Without a will, an unmarried partner is not an heir.", cite: "755 ILCS 5/2-1" },
      { text: "Without a health care agent, a close friend (which can include a partner) comes after relatives in the surrogate order.", cite: "755 ILCS 40/25" },
    ],
    check: {
      question: "Which worries you most?",
      options: [
        {
          label: "The hospital won't let my partner decide",
          result: "A health care power of attorney naming your partner puts them first. It is one of the simplest documents to sign.",
          next: { href: "/learn/illinois/illinois-healthcare-power-of-attorney", label: "Illinois health care power of attorney" },
        },
        {
          label: "My partner could lose our home",
          result: "If the deed is in your name only, your heirs, not your partner, inherit it. Joint ownership, a TODI or a trust can change that.",
          next: { href: "/learn/illinois/illinois-transfer-on-death-instrument", label: "Transfer on death instruments" },
        },
        {
          label: "My family would fight my partner",
          result: "A clear will, and sometimes a trust, makes your wishes harder to challenge.",
          next: { href: "/learn/wills/contesting-a-will", label: "How will contests work" },
        },
      ],
    },
    thisWeek: [
      "Check how your home is titled.",
      "Update beneficiaries on retirement accounts and life insurance.",
      "Sign health care powers of attorney for each other.",
    ],
    faqs: [
      { q: "Does a civil union help?", a: "Yes. Illinois civil union partners have the same inheritance rights as spouses." },
      { q: "If we have a child together, does my partner inherit through the child?", a: "Your child inherits from you. Your partner would only manage that money if named or appointed, and only for the child." },
    ],
    magnet: "estate-planning-for-unmarried-parents",
    related: [
      { href: "/learn/illinois/civil-union-partners-and-illinois-estate-law", label: "Civil union partners and Illinois estate law" },
      { href: "/learn/illinois/illinois-health-care-surrogate-act-who-decides", label: "Who decides without a health care agent" },
      { href: "/tips/not-enough-to-need-a-will", label: "What Illinois does without a will" },
    ],
    bookTopic: "will",
    audience: "couples",
    reviewed: false,
    updated: "2026-10-31",
  },
  {
    slug: "what-does-estate-planning-cost",
    label: "What does a plan cost?",
    title: "What does an estate plan cost in Illinois, and what changes the price?",
    hook: "\"I'm scared of a lawyer bill that never ends.\"",
    answer:
      "Many estate planning attorneys charge a flat fee for a set package, so you know the price before you start. What moves the price is how much you own, whether you need a trust, and how complicated the family is. Our pricing page lists the packages offered through our network and what each one includes.",
    facts: [
      { text: "A basic plan usually includes a will and powers of attorney for property and health care.", cite: "Common Illinois practice; documents under 755 ILCS 5 and 755 ILCS 45" },
      { text: "A living trust also needs the house and accounts retitled into it, which is part of the work.", cite: "Common practice" },
      { text: "Probate costs, which a plan can often reduce, include court fees, publication, bond and attorney fees.", cite: "Illinois circuit court fee schedules" },
    ],
    check: {
      question: "Which sounds most like you?",
      options: [
        {
          label: "Simple: a will and the basics",
          result: "A basic package is usually the fit. Compare what is included, not just the price.",
          next: { href: "/pricing", label: "See packages and prices" },
        },
        {
          label: "I own a house and want to avoid probate",
          result: "A trust package or a transfer on death instrument may fit. An attorney can tell you which is enough.",
          next: { href: "/tools/will-or-trust", label: "Will or trust?" },
        },
        {
          label: "A business, a farm, or over $4 million",
          result: "These plans are usually quoted after a first conversation, because the work varies a lot.",
          next: { href: "/tips/illinois-estate-tax-4-million", label: "The Illinois $4 million estate tax" },
        },
      ],
    },
    thisWeek: [
      "List what you own and roughly what it is worth.",
      "Write down the two or three questions you most want answered.",
      "Ask any attorney what is included and how revisions are handled before you sign.",
    ],
    faqs: [
      { q: "Is DIY cheaper?", a: "Up front, yes. The cost of a mistake shows up later, in probate or a family fight." },
      { q: "How many revisions are included?", a: "Our pricing page lists what each package includes. Ask the attorney about anything beyond that before you start." },
    ],
    magnet: "estate-plan-cost-guide",
    tool: "probate-cost-estimator",
    related: [
      { href: "/pricing", label: "Packages and prices" },
      { href: "/learn/wills/how-much-does-a-will-cost", label: "How much does a will cost?" },
      { href: "/free/estate-planning-cost-saving-checklist", label: "Cost-saving checklist" },
    ],
    bookTopic: "will-or-trust",
    audience: "everyone",
    reviewed: false,
    updated: "2026-10-31",
  },
];

export function getSocialTip(slug: string): SocialTip | undefined {
  return SOCIAL_TIPS.find((t) => t.slug === slug);
}
