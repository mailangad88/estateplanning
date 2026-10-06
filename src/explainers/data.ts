export interface ExplainerStep {
  title: string;
  body: string;
}

export interface Explainer {
  slug: string;
  title: string;
  description: string;
  intro: string;
  steps: ExplainerStep[];
  outro: string;
  related: string[];
}

/** Each explainer is a short animated video plus a full text transcript (also read by search engines). */
export const EXPLAINERS: Explainer[] = [
  {
    slug: "how-probate-works",
    title: "How probate works, in 8 steps",
    description: "An animated walkthrough of the court process that settles an estate when assets are in the person's name alone.",
    intro: "Probate is the court process that settles an estate when someone dies owning things in their name alone.",
    steps: [
      { title: "A death certificate is ordered", body: "The family orders certified copies. Banks, courts and agencies each ask for one." },
      { title: "The will is filed with the court", body: "The executor named in the will, or a family member if there is no will, asks the court to open the estate." },
      { title: "The court appoints the executor", body: "The court issues papers that give the executor legal authority to act." },
      { title: "Creditors are notified", body: "Notice is given so creditors can make claims within a deadline set by state law." },
      { title: "Assets are listed and valued", body: "The executor finds and values everything that goes through probate." },
      { title: "Debts, taxes and expenses are paid", body: "Valid bills, final taxes and the costs of the estate are paid from estate funds." },
      { title: "What remains is distributed", body: "Heirs receive their shares under the will, or under state law if there is no will." },
      { title: "The court closes the estate", body: "The executor reports to the court and is released." },
    ],
    outro: "Assets with a named beneficiary, joint owner or trust usually skip this process.",
    related: ["/guides/how-probate-works", "/compare/probate-vs-non-probate-assets", "/tools/probate-cost-estimator"],
  },
  {
    slug: "how-a-revocable-trust-works",
    title: "How a revocable living trust works",
    description: "A short animation showing how a living trust holds your assets, keeps you in control and avoids probate.",
    intro: "A revocable living trust is a legal container for your assets that you control while you are alive.",
    steps: [
      { title: "You create the trust", body: "You sign a trust document. You are usually the first trustee, so you stay in charge." },
      { title: "You move assets into it", body: "Your home is deeded to the trust and accounts are retitled. This step is called funding." },
      { title: "Life goes on as before", body: "You buy, sell and spend as usual. You can change or cancel the trust at any time." },
      { title: "If you become unable to manage", body: "Your chosen successor trustee steps in without a court guardianship." },
      { title: "When you die", body: "The successor trustee pays final bills and distributes to your beneficiaries privately, usually without probate." },
    ],
    outro: "A trust only controls what is titled in it, so funding is the step that makes it work.",
    related: ["/guides/revocable-living-trust-explained", "/guides/funding-your-trust", "/compare/will-vs-trust"],
  },
  {
    slug: "what-happens-without-a-will",
    title: "What happens if you die without a will",
    description: "See who decides who inherits, who manages the estate and who raises your children when there is no will.",
    intro: "If you die without a will, your state's law writes one for you.",
    steps: [
      { title: "State law picks your heirs", body: "A fixed formula, often spouse first, then children, parents and siblings, decides who inherits." },
      { title: "A court picks the administrator", body: "Someone has to ask the court to be appointed. It may not be who you would have chosen." },
      { title: "A court picks a guardian", body: "If your children are minors, a judge decides who raises them." },
      { title: "Money for children may be court supervised", body: "Children may receive their share outright at 18 or under court supervision." },
      { title: "Unmarried partners and friends get nothing", body: "Intestacy laws generally do not provide for people you are not related to by blood, marriage or adoption." },
    ],
    outro: "A simple will lets you make each of these choices yourself.",
    related: ["/guides/what-happens-if-you-die-without-a-will", "/guides/how-to-make-a-will", "/guides/guardianship-for-minor-children"],
  },
  {
    slug: "what-a-complete-estate-plan-includes",
    title: "What a complete estate plan includes",
    description: "The documents most families put in place, and what each one does, in under two minutes.",
    intro: "An estate plan is a small set of documents that work together.",
    steps: [
      { title: "Will", body: "Says who receives your property and names an executor and guardians for minor children." },
      { title: "Revocable living trust (for many families)", body: "Holds assets so they pass privately and usually skip probate." },
      { title: "Financial power of attorney", body: "Lets someone you trust handle money and paperwork if you cannot." },
      { title: "Healthcare power of attorney", body: "Names who makes medical decisions for you if you cannot speak for yourself." },
      { title: "Living will and HIPAA release", body: "Records your wishes for end-of-life care and lets doctors talk to your family." },
      { title: "Beneficiary designations", body: "Retirement accounts and life insurance pass by their own forms, so they must match the plan." },
    ],
    outro: "Review the whole set every few years and after big life changes.",
    related: ["/guides/what-is-estate-planning", "/tools/plan-readiness-assessment", "/checklists/documents-to-gather-before-your-consult"],
  },
  {
    slug: "funding-your-trust",
    title: "Funding your trust: the step people skip",
    description: "Why a trust only works for the assets titled in it, and how each type of asset is moved in.",
    intro: "Signing a trust is half the job. Funding it is the other half.",
    steps: [
      { title: "Your home", body: "A new deed transfers the home from you to you as trustee, then it is recorded with the county." },
      { title: "Bank and brokerage accounts", body: "The bank retitles the account into the trust, or names the trust as payable-on-death beneficiary." },
      { title: "Retirement accounts", body: "Usually stay in your name. The beneficiary form is updated instead, often with tax advice." },
      { title: "Life insurance", body: "The trust can be named as beneficiary so money for children is managed by your trustee." },
      { title: "Everything else", body: "A pour-over will catches anything left out, though those items may still need probate." },
    ],
    outro: "Keep a funding checklist and update it whenever you open an account or buy property.",
    related: ["/guides/funding-your-trust", "/checklists/trust-funding-checklist", "/compare/pour-over-will-vs-simple-will"],
  },
];
