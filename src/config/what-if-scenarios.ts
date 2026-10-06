/**
 * "What if" scenarios: the things that can go wrong when a plan is put off, each tied to the
 * document that prevents it. One shared source for the life game on the stage pages, the homepage
 * board and the service pages, and for search pages built by the content pipeline.
 *
 * Rules for this file:
 * - Plain, concrete and true in most US states. Say "usually", "can" or "in many states" where state
 *   law differs. No scare numbers, no invented statistics, no promises about outcomes.
 * - Every scenario names what the delay was, what usually happens, what a plan changes, and the
 *   document that fixes it.
 * - Advertising copy, so the launch-check word rules apply.
 * - Draft until the attorney reviews it: keep `reviewed: false` until they sign off.
 */
import type { LifeStage } from "./life-stages";

export type StageSlug = LifeStage["slug"];

/** The documents a scenario can point to. Labels and links shared by every scenario. */
export const PLAN_DOCS = {
  will: { label: "Will", icon: "FileText", href: "/wills" },
  trust: { label: "Living trust", icon: "Landmark", href: "/living-trusts" },
  financialPoa: { label: "Financial power of attorney", icon: "PiggyBank", href: "/power-of-attorney" },
  healthcareProxy: { label: "Healthcare proxy", icon: "Stethoscope", href: "/healthcare-directives" },
  livingWill: { label: "Living will", icon: "Heart", href: "/guides/healthcare-directives-and-living-wills" },
  hipaa: { label: "HIPAA release", icon: "ShieldCheck", href: "/healthcare-directives" },
  guardian: { label: "Guardian nomination", icon: "Baby", href: "/guides/guardianship-for-minor-children" },
  childrensTrust: { label: "Trust for your children", icon: "PiggyBank", href: "/guides/leaving-money-to-minors" },
  beneficiaries: { label: "Beneficiary updates", icon: "Users", href: "/guides/beneficiary-designations" },
  specialNeedsTrust: { label: "Supplemental needs trust", icon: "HandHeart", href: "/guides/special-needs-trusts" },
  digital: { label: "Digital assets plan", icon: "Lock", href: "/guides/digital-assets-estate-planning" },
  transferOnDeath: { label: "Transfer on death designations", icon: "House", href: "/guides/transfer-on-death-and-payable-on-death" },
  longTermCare: { label: "Long-term care plan", icon: "CalendarCheck", href: "/guides/medicaid-and-long-term-care-planning" },
  business: { label: "Business succession plan", icon: "Briefcase", href: "/guides/business-succession-planning" },
  review: { label: "Plan review", icon: "CalendarCheck", href: "/life-events" },
} as const;

export type PlanDocKey = keyof typeof PLAN_DOCS;

export interface WhatIfScenario {
  id: string;
  /** The question, as the visitor would ask it. */
  title: string;
  /** What was put off, in the visitor's own words. */
  delay: string;
  /** What usually happens without the document. */
  without: string;
  /** What the document changes. */
  withPlan: string;
  /** The documents that prevent it. The first is the main one. */
  fix: PlanDocKey[];
  /** Life stages where this comes up. Empty means every stage. */
  stages: StageSlug[];
  /** Picture used on the card, a file in public/media/illustrations. */
  art: string;
  /**
   * The "learn more" page for this scenario, written by the SEO content pipeline. Shown only once the
   * page exists in content/ (see learnHrefFor in life-game.ts), so queued pages never become dead links.
   */
  learn?: string;
  /** False until the attorney has reviewed the wording. */
  reviewed: false;
}

export const WHAT_IF_SCENARIOS: WhatIfScenario[] = [
  {
    id: "die-without-a-will",
    learn: "/learn/wills/dying-without-a-will",
    title: "What if you die without a will?",
    delay: "We'll write one when we have more to leave.",
    without:
      "State law picks who inherits, in a fixed order. In many states a spouse shares with children or parents, and an unmarried partner usually gets nothing. A court appoints someone to run the estate.",
    withPlan: "You choose who inherits, who is in charge, and what happens to the things that matter to you.",
    fix: ["will"],
    stages: [],
    art: "HeroWills",
    reviewed: false,
  },
  {
    id: "unmarried-partner-no-will",
    learn: "/learn/what-if/unmarried-partner-no-will",
    title: "What if you live together but are not married?",
    delay: "We're basically married. The paperwork can wait.",
    without:
      "State inheritance rules usually leave out unmarried partners. Your parents or siblings could inherit instead, and your partner may have no say at the hospital.",
    withPlan: "A will and a healthcare proxy put your partner first, on paper, where it counts.",
    fix: ["will", "healthcareProxy"],
    stages: ["newlyweds-and-young-couples", "blended-families"],
    art: "HeroNewlyweds",
    reviewed: false,
  },
  {
    id: "hospital-wont-talk",
    learn: "/learn/healthcare-directives/hipaa-authorization",
    title: "What if you are in an accident and the hospital won't talk to your partner?",
    delay: "We're young and healthy. Nothing is going to happen.",
    without:
      "Privacy rules limit what doctors can share. Without a HIPAA release and a healthcare proxy, your partner can wait for updates while staff look for next of kin.",
    withPlan: "Your partner is named as the person doctors talk to and the person who decides if you cannot.",
    fix: ["healthcareProxy", "hipaa"],
    stages: ["newlyweds-and-young-couples", "new-parents", "homeowners-and-growing-families"],
    art: "HeroPowersOfAttorney",
    reviewed: false,
  },
  {
    id: "incapacitated-without-power-of-attorney",
    learn: "/learn/what-if/incapacitated-without-power-of-attorney",
    title: "What if you can't manage your own money for a while?",
    delay: "My spouse can just sign for me.",
    without:
      "A spouse usually cannot sign for accounts or property in your name alone. Without a power of attorney, the family may need to ask a court to appoint a guardian or conservator, which takes time and costs money.",
    withPlan: "The person you trust can pay bills, talk to the bank and keep things running, without going to court.",
    fix: ["financialPoa"],
    stages: [],
    art: "HeroPowersOfAttorney",
    reviewed: false,
  },
  {
    id: "end-of-life-wishes-unknown",
    title: "What if your family has to guess your end-of-life wishes?",
    delay: "They know what I'd want. We don't need to write it down.",
    without:
      "In a crisis, people who love you can disagree. Doctors follow whoever has authority under state law, and the family carries the weight of guessing.",
    withPlan: "A living will says what you want in your own words, so no one has to decide alone.",
    fix: ["livingWill", "healthcareProxy"],
    stages: ["pre-retirees", "retirees-and-snowbirds", "caregivers", "newlyweds-and-young-couples"],
    art: "HeroAgingParents",
    reviewed: false,
  },
  {
    id: "no-guardian-named",
    learn: "/learn/guardianship/what-if-no-guardian-named",
    title: "What if both parents die and no guardian is named?",
    delay: "We can't agree on who, so we'll decide later.",
    without:
      "A judge chooses who raises your children. Relatives can ask the court, and the children wait while it decides. The person chosen may not be the one you would have picked.",
    withPlan: "You name the guardian and a backup. Courts usually follow a parent's choice.",
    fix: ["guardian", "will"],
    stages: ["new-parents", "homeowners-and-growing-families", "blended-families"],
    art: "HeroGuardianship",
    reviewed: false,
  },
  {
    id: "minor-inherits-without-trust",
    learn: "/learn/what-if/minor-inherits-without-trust",
    title: "What if your child inherits everything at 18?",
    delay: "The life insurance goes to the kids. That's enough.",
    without:
      "Minors cannot own large sums directly, so a court may supervise the money. In many states it is handed over in full at 18 or 21, often with no one guiding how it is spent.",
    withPlan: "A trust for your children holds the money, pays for school and needs, and releases it at ages you choose.",
    fix: ["childrensTrust", "beneficiaries"],
    stages: ["new-parents", "homeowners-and-growing-families", "blended-families"],
    art: "HeroTrusts",
    reviewed: false,
  },
  {
    id: "ex-spouse-still-beneficiary",
    learn: "/learn/what-if/ex-spouse-still-beneficiary",
    title: "What if your ex is still the beneficiary?",
    delay: "I'll update the forms when things settle down.",
    without:
      "Retirement accounts and life insurance follow the beneficiary form, not your will. Some states revoke an ex-spouse after divorce, but federal rules for many employer plans can override that, so the ex may still be paid.",
    withPlan: "Updated forms send the money where you mean it to go today.",
    fix: ["beneficiaries"],
    stages: ["newlyweds-and-young-couples", "blended-families", "pre-retirees"],
    art: "HeroBlendedFamily",
    reviewed: false,
  },
  {
    id: "beneficiary-form-overrides-will",
    learn: "/learn/wills/what-a-will-cannot-do",
    title: "What if your beneficiary forms say something different from your will?",
    delay: "My will covers everything.",
    without:
      "Accounts with a named beneficiary skip the will. If the forms are old or blank, money can go to the wrong person or end up in probate.",
    withPlan: "A plan review lines up your forms with your will, so everything points the same way.",
    fix: ["beneficiaries", "review"],
    stages: ["newlyweds-and-young-couples", "new-parents", "pre-retirees", "retirees-and-snowbirds"],
    art: "SpotChecklist",
    reviewed: false,
  },
  {
    id: "probate-delay",
    learn: "/learn/probate/how-long-does-probate-take",
    title: "What if your family has to go through probate?",
    delay: "Probate is for rich people.",
    without:
      "Property in your name alone usually goes through probate, a court process that can take months or longer. Court and legal costs come out of the estate, and filings are generally public.",
    withPlan: "A living trust or transfer on death designations can let property pass without probate.",
    fix: ["trust", "transferOnDeath"],
    stages: ["homeowners-and-growing-families", "pre-retirees", "retirees-and-snowbirds"],
    art: "HeroProbate",
    reviewed: false,
  },
  {
    id: "house-stuck-in-probate",
    title: "What if the house is stuck in probate?",
    delay: "The house will just go to the kids.",
    without:
      "A home titled in your name alone often cannot be sold or refinanced until the court gives someone authority. Mortgage, tax and upkeep bills keep coming in the meantime.",
    withPlan: "A trust or, in states that allow it, a transfer on death deed lets the home pass to the people you name.",
    fix: ["trust", "transferOnDeath"],
    stages: ["homeowners-and-growing-families", "retirees-and-snowbirds", "pre-retirees"],
    art: "HeroFamilyHome",
    reviewed: false,
  },
  {
    id: "property-in-two-states",
    learn: "/learn/probate/ancillary-probate",
    title: "What if you own a home in two states?",
    delay: "Our will is from the old state. It still works.",
    without:
      "Real estate in another state can need its own probate there, called ancillary probate. That can mean a second court, a second lawyer and a second set of fees.",
    withPlan: "Putting both homes in a living trust usually avoids a second court case.",
    fix: ["trust", "review"],
    stages: ["retirees-and-snowbirds", "pre-retirees"],
    art: "HeroRetirees",
    reviewed: false,
  },
  {
    id: "moved-states-plan-not-updated",
    learn: "/learn/what-if/moved-states-plan-not-updated",
    title: "What if you moved and your documents are from another state?",
    delay: "We signed all that years ago in our old state.",
    without:
      "Most states accept a will signed elsewhere, but powers of attorney and healthcare forms can be questioned, and rules on spouses' rights differ. Banks and hospitals may ask for their state's forms.",
    withPlan: "A review updates the documents so the people and places you deal with now accept them.",
    fix: ["review", "financialPoa", "healthcareProxy"],
    stages: ["retirees-and-snowbirds", "pre-retirees", "homeowners-and-growing-families"],
    art: "SpotCalendarReview",
    reviewed: false,
  },
  {
    id: "stepchildren-no-will",
    learn: "/learn/what-if/stepchildren-no-will",
    title: "What if your stepchildren are left out without you meaning to?",
    delay: "Everyone knows I love the kids the same.",
    without:
      "Inheritance rules usually only count children you are related to by birth or adoption. Without a plan, stepchildren you raised can receive nothing.",
    withPlan: "Your will or trust names every child you want included, in your words.",
    fix: ["will", "trust"],
    stages: ["blended-families"],
    art: "HeroBlendedFamily",
    reviewed: false,
  },
  {
    id: "new-spouse-takes-all",
    title: "What if everything goes to your spouse and never reaches your children?",
    delay: "My spouse will take care of my kids from before.",
    without:
      "If everything passes to a surviving spouse outright, they can later change their own will. Your children from an earlier marriage may receive nothing, even if no one intended it.",
    withPlan: "A trust can support your spouse for life and then pass what is left to your children.",
    fix: ["trust", "beneficiaries"],
    stages: ["blended-families", "pre-retirees"],
    art: "HeroBlendedFamily",
    reviewed: false,
  },
  {
    id: "family-dispute",
    title: "What if your family ends up arguing over what you wanted?",
    delay: "My kids get along. They'll sort it out.",
    without:
      "Grief and money can strain close families. Unclear wishes and old documents are common starting points for disputes, and court fights can cost the estate and the relationships.",
    withPlan: "Clear, current documents and a named person in charge leave less to argue about.",
    fix: ["will", "trust"],
    stages: ["blended-families", "pre-retirees", "retirees-and-snowbirds", "caregivers"],
    art: "HeroEstateSettlement",
    reviewed: false,
  },
  {
    id: "parent-with-dementia-no-power-of-attorney",
    learn: "/learn/power-of-attorney/parent-with-dementia-no-power-of-attorney",
    title: "What if your parent can't manage their money and nothing is signed?",
    delay: "We'll talk to Mom and Dad about it at the holidays.",
    without:
      "Once a parent cannot understand what they are signing, it is too late for them to sign a power of attorney. The family may need a court guardianship to pay their bills.",
    withPlan: "While your parent can still sign, they name who helps, and you can act when the time comes.",
    fix: ["financialPoa", "healthcareProxy"],
    stages: ["caregivers"],
    art: "HeroAgingParents",
    reviewed: false,
  },
  {
    id: "caregiver-cant-access-records",
    title: "What if you are caring for a parent but can't see their medical records?",
    delay: "The doctors know me. It'll be fine.",
    without:
      "Without a HIPAA release, offices can decline to share records or test results with an adult child, even one doing the driving and the caring.",
    withPlan: "A HIPAA release and healthcare proxy let you get the information you need to help.",
    fix: ["hipaa", "healthcareProxy"],
    stages: ["caregivers"],
    art: "HeroAgingParents",
    reviewed: false,
  },
  {
    id: "long-term-care-costs",
    learn: "/learn/elder-care/medicaid-planning",
    title: "What if you need years of nursing home care?",
    delay: "We'll worry about long-term care if it happens.",
    without:
      "Long-term care is expensive and Medicare covers little of it. Medicaid has strict asset rules and a look-back on gifts, so planning that starts after the need can have fewer options.",
    withPlan: "Planning ahead lays out how care would be paid for and what can be protected under your state's rules.",
    fix: ["longTermCare", "financialPoa"],
    stages: ["pre-retirees", "retirees-and-snowbirds", "caregivers"],
    art: "HeroRetirees",
    reviewed: false,
  },
  {
    id: "too-late-for-a-will",
    learn: "/learn/what-if/too-late-for-a-will",
    title: "What if a diagnosis comes before the paperwork?",
    delay: "I'm still sharp. There's plenty of time.",
    without:
      "To sign a will or power of attorney you must understand what you are signing. After a diagnosis that affects memory, the window can close sooner than families expect.",
    withPlan: "Signing while you are well means your choices are already in place, whatever comes.",
    fix: ["financialPoa", "healthcareProxy", "will"],
    stages: ["pre-retirees", "retirees-and-snowbirds", "caregivers"],
    art: "HeroPowersOfAttorney",
    reviewed: false,
  },
  {
    id: "disabled-heir-inherits-directly",
    learn: "/learn/what-if/disabled-heir-inherits-directly",
    title: "What if an inheritance cuts off a disabled child's benefits?",
    delay: "We'll leave our son the same as his sisters.",
    without:
      "Programs like SSI and Medicaid have asset limits. An inheritance left outright can push a person with a disability over the limit until it is spent down.",
    withPlan: "A supplemental needs trust holds the money for extras without counting against benefits.",
    fix: ["specialNeedsTrust", "beneficiaries"],
    stages: ["new-parents", "homeowners-and-growing-families", "caregivers"],
    art: "HeroSpecialNeeds",
    reviewed: false,
  },
  {
    id: "digital-accounts-locked",
    learn: "/learn/digital-assets/digital-assets-in-your-estate-plan",
    title: "What if no one can get into your online accounts?",
    delay: "My passwords are in my head.",
    without:
      "Banks, email and photo accounts can be locked to family. Bills on autopay keep charging, and photos can be lost.",
    withPlan: "A digital assets plan names who can access accounts and tells them where to find what they need.",
    fix: ["digital", "financialPoa"],
    stages: [],
    art: "SpotSafeStorage",
    reviewed: false,
  },
  {
    id: "lost-original-will",
    learn: "/learn/what-if/lost-original-will",
    title: "What if your family can't find your documents?",
    delay: "It's all in a folder somewhere.",
    without:
      "An original will that cannot be found may be treated as if it was never signed. Families can spend weeks searching for accounts and policies.",
    withPlan: "A plan includes where the originals are kept and a list of accounts for the people you name.",
    fix: ["will", "digital"],
    stages: [],
    art: "SpotSafeStorage",
    reviewed: false,
  },
  {
    id: "outdated-will",
    learn: "/learn/what-if/outdated-will",
    title: "What if your plan still names people from ten years ago?",
    delay: "We did our wills when the kids were born.",
    without:
      "Old documents can name an executor who has passed away, a guardian for children who are now adults, or leave out a grandchild. The plan does what it says, not what you meant.",
    withPlan: "A review every few years, or after a big life change, keeps it pointed at your family today.",
    fix: ["review"],
    stages: ["pre-retirees", "retirees-and-snowbirds", "homeowners-and-growing-families"],
    art: "SpotCalendarReview",
    reviewed: false,
  },
  {
    id: "business-has-no-plan",
    learn: "/learn/business-owners/business-succession-planning",
    title: "What if you can't run your business tomorrow?",
    delay: "My partner and I will figure it out.",
    without:
      "Without a buy-sell agreement or succession plan, your share can pass to family who cannot run it, and the business can stall while that is sorted out.",
    withPlan: "A succession plan names who steps in and how your family is paid for your share.",
    fix: ["business", "financialPoa"],
    stages: ["pre-retirees", "homeowners-and-growing-families"],
    art: "HeroBusinessSuccession",
    reviewed: false,
  },
  {
    id: "executor-burden",
    title: "What if the person you'd pick to settle things doesn't know it's them?",
    delay: "My oldest will handle it.",
    without:
      "Without a will, a court appoints the administrator, and it may be someone you would not choose. Even with one, an executor who is surprised can lose weeks working out where to start.",
    withPlan: "You name your executor and a backup, and you can tell them now.",
    fix: ["will"],
    stages: ["pre-retirees", "retirees-and-snowbirds"],
    art: "HeroEstateSettlement",
    reviewed: false,
  },
  {
    id: "joint-account-surprise",
    learn: "/learn/property-and-assets/joint-tenancy-risks",
    title: "What if adding a child to your account backfires?",
    delay: "I'll just put my daughter on the account. Simpler.",
    without:
      "A joint account usually passes to the co-owner alone, not shared among your children. It can also be exposed to the co-owner's debts or divorce.",
    withPlan: "A trust or payable on death designation can let a child help now and share fairly later.",
    fix: ["trust", "transferOnDeath", "financialPoa"],
    stages: ["retirees-and-snowbirds", "caregivers"],
    art: "HeroRetirees",
    reviewed: false,
  },
  {
    id: "pets-left-behind",
    learn: "/learn/property-and-assets/pet-trusts",
    title: "What if no one is named to look after your pets?",
    delay: "Someone in the family will take the dog.",
    without:
      "Pets are treated as property. Without instructions, they go wherever the estate sends them, and some end up in shelters.",
    withPlan: "Your will or a pet trust names a caregiver and can leave money for care.",
    fix: ["will", "trust"],
    stages: ["newlyweds-and-young-couples", "retirees-and-snowbirds"],
    art: "HeroFamilyHome",
    reviewed: false,
  },
  {
    id: "unfunded-trust",
    learn: "/learn/what-if/unfunded-trust",
    title: "What if you signed a trust but never moved anything into it?",
    delay: "We signed the trust. The retitling can wait.",
    without:
      "A trust only controls what is titled in its name. A home or account left in your own name usually goes through probate anyway, which is what the trust was meant to avoid.",
    withPlan: "Funding the trust, with deeds and account titles changed, lets it do its job.",
    fix: ["trust", "review"],
    stages: ["homeowners-and-growing-families", "pre-retirees", "retirees-and-snowbirds"],
    art: "HeroTrusts",
    reviewed: false,
  },
  {
    id: "no-beneficiary-named",
    learn: "/learn/what-if/no-beneficiary-named",
    title: "What if an account has no beneficiary named?",
    delay: "I'll fill in the beneficiary when HR sends the form again.",
    without:
      "With no beneficiary, many accounts and policies pay to your estate. That usually means probate, delay, and for retirement accounts it can mean less flexible tax timing for your heirs.",
    withPlan: "Naming a beneficiary and a backup lets the money go straight to the people you choose.",
    fix: ["beneficiaries"],
    stages: ["newlyweds-and-young-couples", "new-parents", "pre-retirees"],
    art: "SpotChecklist",
    reviewed: false,
  },
  {
    id: "estate-as-beneficiary",
    learn: "/learn/what-if/estate-as-beneficiary",
    title: "What if you named \"my estate\" as the beneficiary?",
    delay: "I just wrote \"my estate\". The will sorts it out.",
    without:
      "Money paid to your estate usually goes through probate and can be reached by the estate's creditors. Retirement accounts paid to an estate may have to be paid out faster.",
    withPlan: "Naming people, or a trust, as beneficiaries keeps the money out of probate.",
    fix: ["beneficiaries", "trust"],
    stages: ["pre-retirees", "retirees-and-snowbirds"],
    art: "SpotChecklist",
    reviewed: false,
  },
  {
    id: "heirs-property",
    learn: "/learn/property-and-assets/heirs-property",
    title: "What if family land passes down with no will, again and again?",
    delay: "The land has always just stayed in the family.",
    without:
      "Each generation without a will can split ownership among more relatives. Heirs' property can be hard to sell, borrow against or insure, and in some states one co-owner can ask a court to force a sale.",
    withPlan: "A will or trust names who owns the land next, so the title stays clear.",
    fix: ["will", "trust"],
    stages: ["pre-retirees", "retirees-and-snowbirds", "caregivers"],
    art: "HeroFamilyHome",
    reviewed: false,
  },
  {
    id: "siblings-inherit-house-disagree",
    learn: "/learn/what-if/siblings-inherit-house-disagree",
    title: "What if your children inherit the house together and disagree?",
    delay: "They'll each get a share of the house. Fair is fair.",
    without:
      "Co-owners must agree to sell, rent or keep the house. If they cannot, one can usually ask a court to order a sale, which costs money and can split the family.",
    withPlan: "Your plan can say who may keep the house, how the others are paid, or that it is sold.",
    fix: ["trust", "will"],
    stages: ["pre-retirees", "retirees-and-snowbirds", "blended-families"],
    art: "HeroFamilyHome",
    reviewed: false,
  },
  {
    id: "house-in-late-spouses-name",
    learn: "/learn/what-if/house-in-late-spouses-name",
    title: "What if the house was only in your late spouse's name?",
    delay: "It's our house. Whose name is on the deed doesn't matter.",
    without:
      "If the deed names only the spouse who died, the survivor may need probate before they can sell or refinance, even though they live there.",
    withPlan: "Checking the deed now, and using a trust or joint title, lets the home pass smoothly.",
    fix: ["trust", "transferOnDeath"],
    stages: ["retirees-and-snowbirds", "pre-retirees", "homeowners-and-growing-families"],
    art: "HeroFamilyHome",
    reviewed: false,
  },
  {
    id: "both-parents-die-no-will",
    learn: "/learn/what-if/both-parents-die-no-will",
    title: "What if both parents die without wills?",
    delay: "We'll do wills once the kids are a bit older.",
    without:
      "A court picks the guardian, and the children's inheritance is usually managed under court supervision and handed over at 18 or 21.",
    withPlan: "Your wills name the guardian, and a trust says who manages the money and until what age.",
    fix: ["will", "guardian", "childrensTrust"],
    stages: ["new-parents", "homeowners-and-growing-families"],
    art: "HeroGuardianship",
    reviewed: false,
  },
  {
    id: "spouse-died-plan-not-updated",
    learn: "/learn/what-if/spouse-died-plan-not-updated",
    title: "What if your spouse dies and your plan still names them?",
    delay: "I can't face the paperwork right now.",
    without:
      "If your will, trust or forms name a spouse who has died and no backup, parts of your plan can fail, and state law may decide who gets that share or who is in charge.",
    withPlan: "An update names new people, so your plan still works for your family.",
    fix: ["review", "beneficiaries", "financialPoa"],
    stages: ["retirees-and-snowbirds", "pre-retirees"],
    art: "SpotCalendarReview",
    reviewed: false,
  },
  {
    id: "death-during-divorce",
    learn: "/learn/what-if/death-during-divorce",
    title: "What if you die while the divorce is still going through?",
    delay: "Once the divorce is final, I'll redo everything.",
    without:
      "In many states you are still married until the judge signs the decree. A spouse you are divorcing may still inherit, stay the beneficiary and make medical decisions.",
    withPlan: "Some changes can be made during a divorce. A plan review shows which are allowed in your state.",
    fix: ["review", "will", "healthcareProxy"],
    stages: ["blended-families"],
    art: "HeroBlendedFamily",
    reviewed: false,
  },
  {
    id: "power-of-attorney-agent-unavailable",
    learn: "/learn/what-if/power-of-attorney-agent-unavailable",
    title: "What if the person you named can't serve when the time comes?",
    delay: "My brother is my agent. That's settled.",
    without:
      "If your only named agent has died, moved away or is unwell, the document may not help. The family can be back to asking a court.",
    withPlan: "Naming a backup agent, and checking in now and then, keeps the plan working.",
    fix: ["financialPoa", "healthcareProxy", "review"],
    stages: ["pre-retirees", "retirees-and-snowbirds", "caregivers"],
    art: "HeroPowersOfAttorney",
    reviewed: false,
  },
  {
    id: "unsigned-will",
    learn: "/learn/what-if/unsigned-will",
    title: "What if your will is written but never properly signed?",
    delay: "I typed it up. I'll find witnesses later.",
    without:
      "Most states require a will to be signed with witnesses, and sometimes a notary. A draft on your computer usually does not count, so state law decides instead.",
    withPlan: "A signing done the right way for your state makes the will count.",
    fix: ["will"],
    stages: [],
    art: "SpotDocumentsSigned",
    reviewed: false,
  },
  {
    id: "adult-child-emergency-no-hipaa",
    learn: "/learn/what-if/adult-child-emergency-no-hipaa",
    title: "What if your 18-year-old is in the hospital and you can't get answers?",
    delay: "They're my kid. Of course the doctors will talk to me.",
    without:
      "At 18 your child is a legal adult. Without their signed forms, doctors and colleges can decline to share information with you or let you decide for them.",
    withPlan: "A healthcare proxy, HIPAA release and power of attorney signed by your adult child let you help.",
    fix: ["healthcareProxy", "hipaa", "financialPoa"],
    stages: ["homeowners-and-growing-families", "pre-retirees"],
    art: "HeroPowersOfAttorney",
    reviewed: false,
  },
];

/** Scenarios that come up at a life stage, most relevant first (stage-specific, then general). */
export function scenariosForStage(slug: StageSlug): WhatIfScenario[] {
  const specific = WHAT_IF_SCENARIOS.filter((s) => s.stages.includes(slug));
  const general = WHAT_IF_SCENARIOS.filter((s) => s.stages.length === 0);
  return [...specific, ...general];
}

export const whatIfFor = (id: string) => WHAT_IF_SCENARIOS.find((s) => s.id === id);
