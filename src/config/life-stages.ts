/**
 * Life-stage landing pages. Each stage points at an audience page in content/audiences and adds the
 * design layer on top of it: who it is for, the hero message, the three things that matter most at
 * that age, the picture, and the call to action that fits how people at that stage like to reach us.
 *
 * Copy here is advertising copy, so the launch-check word rules apply. Keep claims plain and true.
 */
export type StageTone = "accent" | "clay" | "sage" | "gold";
export type StageIllustration =
  | "newlyweds"
  | "guardianship"
  | "familyHome"
  | "blendedFamily"
  | "preRetirees"
  | "retirees"
  | "agingParents";

export interface LifeStage {
  /** Audience slug in content/audiences. The page lives at /estate-planning-for/{slug}. */
  slug: string;
  /** Short name for navigation and cards. */
  label: string;
  /** Who it is for, in a few words. */
  who: string;
  /** Rough age or timing, shown on the life cycle view. */
  when: string;
  /** Lucide icon name, see STAGE_ICONS in components/landing.tsx. */
  icon: "Heart" | "Baby" | "House" | "Users" | "Briefcase" | "Sun" | "HandHeart";
  tone: StageTone;
  illustration: StageIllustration;
  /** Hero headline. Speaks to this stage, not to everyone. */
  heroTitle: string;
  heroLead: string;
  /** The three things that matter most at this stage. */
  priorities: { icon: "ShieldCheck" | "FileText" | "Users" | "House" | "Stethoscope" | "PiggyBank" | "Scale" | "CalendarCheck" | "Phone" | "Heart" | "Baby" | "Landmark"; title: string; text: string }[];
  /** Main call to action. */
  cta: { label: string; href: string };
  /** A free resource written for this stage. */
  resource: { label: string; href: string };
  /**
   * Larger type, fewer choices and the phone number first. For readers 65 and up, who tell
   * call centres they would rather talk than fill in a form.
   */
  senior?: boolean;
}

export const LIFE_STAGES: LifeStage[] = [
  {
    slug: "newlyweds-and-young-couples",
    when: "20s and 30s",
    label: "Newlyweds and young couples",
    who: "Just married or moving in together",
    icon: "Heart",
    tone: "clay",
    illustration: "newlyweds",
    heroTitle: "You just said yes to each other. Put it in writing for the rest of the world.",
    heroLead:
      "A starter plan for a couple is small and quick. It makes sure the person you chose can make medical calls, pay the bills and keep the accounts if something happens to you.",
    priorities: [
      { icon: "Stethoscope", title: "Medical decisions", text: "A healthcare proxy and HIPAA release so your partner is the one the hospital talks to." },
      { icon: "FileText", title: "Beneficiary forms", text: "Your 401(k) and life insurance follow their forms, not your will. Update them after the wedding." },
      { icon: "ShieldCheck", title: "A simple will", text: "Short and inexpensive now, and easy to build on when a home or children come along." },
    ],
    cta: { label: "Start our couples plan finder", href: "/plan-finder" },
    resource: { label: "Free newlyweds planning kit", href: "/free/newlyweds-estate-planning-kit" },
  },
  {
    slug: "new-parents",
    when: "Starting a family",
    label: "New parents",
    who: "A baby on the way or little ones at home",
    icon: "Baby",
    tone: "gold",
    illustration: "guardianship",
    heroTitle: "Decide who would raise your children, so a judge never has to guess.",
    heroLead:
      "Naming a guardian is the one thing only a parent's will can do. We help you choose the person, set up who manages the money, and write down how you want your kids raised.",
    priorities: [
      { icon: "Baby", title: "Name a guardian", text: "The person who would raise your children, plus a backup if they cannot." },
      { icon: "PiggyBank", title: "Protect the money", text: "A trust for the kids so life insurance is not handed to an 18-year-old in one check." },
      { icon: "FileText", title: "Fix the forms", text: "Children cannot be named directly on most beneficiary forms. We show you what to write instead." },
    ],
    cta: { label: "Find the right plan for our family", href: "/plan-finder" },
    resource: { label: "Free new parents kit", href: "/free/new-parents-kit" },
  },
  {
    slug: "homeowners-and-growing-families",
    when: "About 35 to 55",
    label: "Homeowners and growing families",
    who: "Mid-career, a house and kids in school",
    icon: "House",
    tone: "accent",
    illustration: "familyHome",
    heroTitle: "You have built a home and a life. Make sure it passes the way you intend.",
    heroLead:
      "Mid-career is when a plan earns its keep: a house, retirement savings, life insurance and children who still need you. We help you decide whether a will is enough or a living trust makes sense.",
    priorities: [
      { icon: "House", title: "The house", text: "How your home is titled decides whether it goes through probate. A trust can keep it out of court." },
      { icon: "Users", title: "Guardians and trustees", text: "Who raises the kids and who manages their money can be two different people." },
      { icon: "CalendarCheck", title: "Update an old plan", text: "A will signed before the second child or the new house may not say what you want now." },
    ],
    cta: { label: "Will or trust? Get a recommendation", href: "/tools/will-or-trust" },
    resource: { label: "Free life insurance review worksheet", href: "/free/life-insurance-review-worksheet" },
  },
  {
    slug: "blended-families",
    when: "At any age",
    label: "Blended families",
    who: "Remarried, stepchildren, kids from before",
    icon: "Users",
    tone: "clay",
    illustration: "blendedFamily",
    heroTitle: "Provide for your spouse and your children from before, in one plan.",
    heroLead:
      "Without a plan, state law can leave everything to a new spouse and nothing to your children, or the other way round. A clear plan lets you take care of everyone you mean to.",
    priorities: [
      { icon: "Heart", title: "Your spouse", text: "A home to live in and income for life, without cutting out your children." },
      { icon: "Users", title: "Your children", text: "What they receive, and when, written down so no one has to argue about it." },
      { icon: "FileText", title: "Old forms", text: "An ex-spouse may still be on a life insurance or retirement form. We check every one." },
    ],
    cta: { label: "Take the blended family check", href: "/quizzes/blended-family-check" },
    resource: { label: "Free blended family planning guide", href: "/free/blended-family-planning-guide" },
  },
  {
    slug: "pre-retirees",
    when: "About 55 to 65",
    label: "Pre-retirees",
    who: "About 55 to 65, retirement in sight",
    icon: "Briefcase",
    tone: "sage",
    illustration: "preRetirees",
    heroTitle: "Retirement is in sight. Get your plan ready before you need it.",
    heroLead:
      "Your children are grown, your savings are larger, and your own parents may need help. This is the time to choose who acts for you, check every beneficiary and make sure an older trust still works.",
    priorities: [
      { icon: "Scale", title: "Powers of attorney", text: "Name who handles money and medical decisions while you can still choose freely." },
      { icon: "Landmark", title: "Retirement accounts", text: "IRAs and 401(k)s pass by beneficiary form, and the tax rules for heirs changed. Review them." },
      { icon: "ShieldCheck", title: "Fund your trust", text: "A trust only covers what is titled in its name. Many older trusts were never finished." },
    ],
    cta: { label: "Check how ready your plan is", href: "/tools/plan-readiness-assessment" },
    resource: { label: "Free retirement estate checklist", href: "/free/retirement-estate-checklist" },
  },
  {
    slug: "retirees-and-snowbirds",
    when: "65 and over",
    label: "Retirees 65 and over",
    who: "Retired, or splitting the year in two states",
    icon: "Sun",
    tone: "gold",
    illustration: "retirees",
    heroTitle: "A plan that is simple for you and easy on your family.",
    heroLead:
      "We keep it plain. One phone call to start, a clear flat fee, and documents that tell your family exactly what to do.",
    priorities: [
      { icon: "Phone", title: "Talk to a person", text: "Call us and we will explain what you need in plain words. No forms to start." },
      { icon: "Stethoscope", title: "Healthcare wishes", text: "Say what care you want and who speaks for you if you cannot." },
      { icon: "House", title: "Keep it out of court", text: "Make sure your home and accounts pass to your family without a long probate." },
    ],
    cta: { label: "Request a call back", href: "/callback" },
    resource: { label: "Free long-term care planning primer", href: "/free/long-term-care-planning-primer" },
    senior: true,
  },
  {
    slug: "caregivers",
    when: "When parents need help",
    label: "Adult children of aging parents",
    who: "Helping a mom or dad who is getting older",
    icon: "HandHeart",
    tone: "sage",
    illustration: "agingParents",
    heroTitle: "Your parent is getting older. Here is how to help them plan, and how to start the talk.",
    heroLead:
      "The documents that matter most are the ones that let you help: a power of attorney and a healthcare proxy. They have to be signed while your parent can still sign, so sooner is kinder.",
    priorities: [
      { icon: "Scale", title: "Power of attorney", text: "Without one, you may need a court guardianship to pay your parent's bills." },
      { icon: "Heart", title: "The conversation", text: "Start with their wishes, not their money. Our free kit has the first questions." },
      { icon: "Stethoscope", title: "Medical decisions", text: "A healthcare proxy and HIPAA release so doctors can talk to you." },
    ],
    cta: { label: "Book a family consult", href: "/plan-finder" },
    resource: { label: "Free aging parent conversation kit", href: "/free/aging-parent-conversation-kit" },
  },
];

export const lifeStageFor = (slug: string) => LIFE_STAGES.find((s) => s.slug === slug);
