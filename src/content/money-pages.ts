import { fees, firm, packages, services, SERVED_AND, SERVED_OR } from "@/config/firm";
import { FIGURES } from "@/config/figures";

/**
 * Copy for the service ("money") pages. Facts about the attorney, fees and services come from
 * src/config/firm.ts (firm, fees, services). State rules are written for Illinois and New Jersey,
 * the only states the site serves, with the statute cited. Nothing here is invented.
 * Inline syntax: [text](/path) for links and **bold**.
 */
export type Block =
  | { p: string }
  | { ul: string[] }
  | { ol: string[] }
  | { note: string }
  | { table: { head: string[]; rows: string[][] } };

export interface MoneyPageData {
  path: string;
  crumb: string;
  /** <title> text (the site template adds the brand) */
  title: string;
  description: string;
  h1: string;
  answer: string;
  /** Which button leads. "call" for urgent pages. */
  cta?: "finder" | "call";
  serviceType?: string;
  schema?: "webpage" | "contact" | "profile";
  steps?: { name: string; text: string }[];
  jump?: { id: string; label: string }[];
  urgent?: { title: string; body: string };
  sections: { h: string; id?: string; blocks: Block[] }[];
  callbackForm?: string;
  emailCapture?: { interest: string; title: string; body: string };
  faqs: { q: string; a: string }[];
  ctaTitle?: string;
  ctaBody?: string;
  related: { href: string; title: string; kind: string }[];
}

const A = firm.attorneyName;
/** The attorney a visitor is matched with. The site is a referral network, not a law firm. */
const MATCHED = "the attorney you are matched with";
const essentials = packages.find((p) => p.id === "essentials");
/** Ends a firm.ts value as a sentence, whether or not the value carries its own full stop. */
const end = (v: string) => (/[.!?]$/.test(v.trim()) ? v.trim() : `${v.trim()}.`);

const wills: MoneyPageData = {
  path: "/wills",
  crumb: "Wills",
  title: "Wills: what they do, what they cannot do, and what they cost",
  description: "A will names who gets your property and who raises your children. How wills work, what they cannot do, and how flat fees for drafting one work.",
  h1: "Wills: what they do and what they cannot do",
  answer: "A will is a legal document that says who receives your property when you die, who raises your minor children, and who carries out your instructions. It takes effect only at death, and in most cases it goes through probate. A will must be signed and witnessed in the way your state requires to count.",
  serviceType: "Will drafting",
  sections: [
    {
      h: "What a will does",
      blocks: [
        { p: "A will does four jobs." },
        {
          ul: [
            "**Names your beneficiaries.** The people or charities who receive what you own.",
            "**Names your executor.** The person who files the will with the court, pays debts and distributes property. Some states call this a personal representative.",
            "**Names a guardian for minor children.** Courts usually honor your choice if it is in the child's interest. Without a will, a judge decides. See [guardianship for minor children](/guides/guardianship-for-minor-children) and the [guardian worksheet](/checklists/choosing-a-guardian-worksheet).",
            "**Handles what is left over.** Property that has no beneficiary named elsewhere.",
          ],
        },
      ],
    },
    {
      h: "What a will cannot do",
      blocks: [
        { p: "This is where many people get surprised." },
        {
          ul: [
            "**It does not avoid probate.** Property that passes under a will goes through the court process. How long and how costly that is depends on your state. See [how probate works](/guides/how-probate-works) and [how long probate takes](/learn/probate/how-long-does-probate-take).",
            "**It does not control accounts with a named beneficiary.** Life insurance, retirement accounts and payable-on-death accounts go to the person named on the form, whatever your will says. See [beneficiary designations](/guides/beneficiary-designations).",
            "**It does not control jointly owned property with survivorship.** The surviving owner takes it.",
            "**It does not help if you become incapacitated.** A will does nothing while you are alive. Many people use a [power of attorney](/power-of-attorney) and a [healthcare directive](/healthcare-directives) for that.",
          ],
        },
      ],
    },
    {
      h: "Who a will often works well for",
      blocks: [
        { p: "People commonly rely on a will when they:" },
        {
          ul: [
            "own little or no real estate, or own it jointly with a spouse",
            "have beneficiary designations on retirement accounts and insurance",
            "want to name guardians for young children",
            "live in a state where probate is simple or inexpensive",
          ],
        },
        { p: "A living trust is often considered in addition, or instead, for people who own real estate, own property in more than one state, want privacy, or are planning for a beneficiary with a disability. See [will vs trust](/learn/trusts/will-vs-trust), [pour-over will vs simple will](/compare/pour-over-will-vs-simple-will) and [living trusts](/living-trusts)." },
      ],
    },
    {
      h: "How a will is signed",
      blocks: [
        { p: `A will generally must be in writing, signed by you, and witnessed by adults who are not beneficiaries. In Illinois, a will needs at least two credible witnesses, and no notary is required (755 ILCS 5/4-3). Illinois does not accept an unwitnessed handwritten will. In New Jersey, a will needs two witnesses, or it can be handwritten if your signature and the important parts are in your own handwriting (N.J.S.A. 3B:3-2). A New Jersey will can be made self-proving with an affidavit before a notary or attorney (N.J.S.A. 3B:3-4). See [what makes a will valid](/guides/what-makes-a-will-valid).` },
      ],
    },
    {
      h: "What happens if you die without one",
      blocks: [
        { p: "Your state's intestacy law decides who inherits, in a fixed order that usually starts with a spouse and children. It may not match what you would have chosen, and it does not name a guardian for your children. See [what happens if you die without a will](/learn/wills/dying-without-a-will)." },
      ],
    },
    {
      h: "What the attorney does when drafting your will",
      blocks: [
        {
          ol: [
            "Asks about your family, property, accounts and who you trust.",
            `Drafts a will that fits ${SERVED_OR} law, with a guardian nomination if you have minor children, and a plan for property you leave to a minor.`,
            "Goes over it with you, oversees the signing with witnesses, and explains where to keep it.",
            "Points out which beneficiary forms to check, because those override the will.",
          ],
        },
        { p: "We match you with an estate planning attorney in our network. That attorney drafts your will and gives the legal advice." },
      ],
    },
    {
      h: "What it costs",
      blocks: [
        { p: `The will-based package is called Essentials. It starts at ${fees.essentialsOne} for one person and ${fees.essentialsCouple} for a couple. It includes: ${(essentials?.includes ?? []).join("; ").toLowerCase()}. It does not include probate or tax return preparation. See [pricing](/pricing).` },
      ],
    },
  ],
  faqs: [
    { q: "Do I need a lawyer to make a will?", a: "No law says you must use one. People with minor children, a home, a blended family or a business often choose to, because mistakes in a will tend to show up after the person is gone, when they cannot be fixed." },
    { q: "Is a will enough, or do I need a trust?", a: "For many people a will is enough. A trust adds value for some people who own real estate, want to skip probate, or have beneficiaries who cannot manage money. The [will or trust comparison](/tools/will-or-trust) shows which way your answers point." },
    { q: "Is a handwritten or online will valid?", a: "It can be, but validity depends on your state's signing rules. A missing witness or signature is a common reason courts reject a document. See [online will vs estate attorney](/compare/online-will-vs-estate-attorney)." },
    { q: "Can I change my will later?", a: "Yes, by signing a new will or a formal amendment called a codicil, as long as you have the mental capacity to do so. Marriage, divorce, a new child and a move to another state are common reasons to review it. See [updating your estate plan](/learn/basics/when-to-update-your-estate-plan)." },
    { q: "Where should I keep my will?", a: `Somewhere your executor can find it quickly and that is safe from fire and loss. Ask ${MATCHED} whether they keep originals in safekeeping. Many people avoid putting the only original in a bank box that nobody else can open.` },
    { q: "Who should I pick as executor?", a: "Someone organized, honest and willing, who lives close enough to manage things. They do not have to be a family member. See [choosing an executor](/learn/wills/choosing-an-executor) and the [executor worksheet](/checklists/choosing-an-executor-worksheet)." },
    { q: "Can someone contest my will?", a: "Family members can try. They need a legal reason, such as lack of capacity or undue influence, and there are deadlines that vary by state. Clear documentation and proper signing make a challenge harder." },
    { q: "What happens to a will after I die?", a: "Your executor files it with the probate court. The court confirms it, the executor pays debts, and property is distributed. See [how probate works](/guides/how-probate-works)." },
  ],
  related: [
    { href: "/guides/how-to-make-a-will", title: "How to make a will", kind: "Guide" },
    { href: "/learn/trusts/will-vs-trust", title: "Will vs trust", kind: "Compare" },
    { href: "/checklists/asset-and-account-inventory", title: "Asset and account inventory", kind: "Checklist" },
    { href: "/living-trusts", title: "Living trusts", kind: "Service" },
    { href: "/power-of-attorney", title: "Power of attorney", kind: "Service" },
  ],
};

const livingTrusts: MoneyPageData = {
  path: "/living-trusts",
  crumb: "Living trusts",
  title: "Living trusts: who often benefits",
  description: "A revocable living trust can let your family skip probate on your home and accounts. What it does, what it does not do, and how flat fees work.",
  h1: "Living trusts: what they do and who often benefits",
  answer: "A revocable living trust is a legal arrangement you create during your life. You put property into it, you stay in control as trustee, and when you die a successor trustee passes it to your beneficiaries without going through probate court. It can be changed any time, and it does not reduce your taxes.",
  serviceType: "Living trust preparation",
  sections: [
    {
      h: "How a living trust works",
      blocks: [
        { p: "Three roles, and often one person fills two of them at first." },
        {
          ul: [
            "**Grantor** (also called settlor or trustmaker). You, the person who creates and funds the trust.",
            "**Trustee.** You, while you are able. A successor trustee you name takes over if you become incapacitated or die.",
            "**Beneficiaries.** The people or charities who receive the property, on the terms you set.",
          ],
        },
        { p: "Because you can revoke or change a revocable trust, the IRS treats its assets as yours for income tax. You keep using your home and accounts as before. See [revocable living trust explained](/learn/trusts/revocable-living-trust)." },
      ],
    },
    {
      h: "What a trust can do",
      blocks: [
        {
          ul: [
            "**Skip probate for assets titled in the trust.** This can save time and fees and keeps the details out of the public court record. How much it saves depends on your state.",
            "**Handle incapacity without court.** Your successor trustee can step in if you cannot manage things, without a guardianship case.",
            "**Control timing.** Leave money to a young adult in stages, not all at once at 18. See [leaving money to minors](/learn/guardianship/leaving-money-to-minors).",
            "**Cover property in more than one state.** One trust can avoid opening probate in each state where you own real estate.",
            "**Provide for a beneficiary with a disability,** with the right terms, to avoid affecting benefits. See [special needs trusts](/guides/special-needs-trusts).",
          ],
        },
      ],
    },
    {
      h: "What a trust cannot do",
      blocks: [
        {
          ul: [
            "**It does nothing for assets that are not in it.** The most common failure is a trust that was signed but never funded. See [funding your trust](/guides/funding-your-trust) and the [trust funding checklist](/checklists/trust-funding-checklist).",
            `**It does not reduce federal or state estate tax.** The federal exemption is $${(FIGURES.federalExemption / 1_000_000).toFixed(0)} million per person as of ${FIGURES.year}, high enough that most families never owe it. See [estate and inheritance taxes](/guides/estate-and-inheritance-taxes).`,
            "**It does not protect assets from your own creditors** or from Medicaid look-back rules. Irrevocable trusts are a different tool. See [revocable vs irrevocable trust](/compare/revocable-vs-irrevocable-trust).",
            "**It is not always worth the cost.** If probate in your state is quick and cheap and you own few assets, a will plus beneficiary designations may do the job.",
          ],
        },
      ],
    },
    {
      h: "Will and trust, side by side",
      blocks: [
        {
          table: {
            head: ["", "Will", "Living trust"],
            rows: [
              ["Takes effect", "At death", "When signed"],
              ["Goes through probate", "Yes, usually", "No, for assets in the trust"],
              ["Public record", "Yes", "No"],
              ["Covers incapacity", "No", "Yes, through a successor trustee"],
              ["Needs funding after signing", "No", "Yes, retitle assets"],
              ["Typical upfront cost", "Lower", "Higher"],
              ["Can be changed", "Yes", "Yes"],
            ],
          },
        },
      ],
    },
    {
      h: "Who often benefits, and who often does not",
      blocks: [
        { p: "People commonly consider a trust when they are:" },
        {
          ul: [
            "homeowners in a state where probate is slow or costly",
            "owners of real estate in more than one state",
            "parents leaving property to minor children or a child with a disability",
            "in a blended family and want to provide for a spouse and for children from an earlier marriage",
            "people who want privacy",
          ],
        },
        { p: "A trust often adds little for:" },
        {
          ul: [
            "renters with few assets and named beneficiaries on their accounts",
            "people whose main assets are retirement accounts and life insurance, which pass by beneficiary form",
            "anyone whose state has a small-estate process that covers their situation",
          ],
        },
        { p: "See [should I put my house in a trust?](/blog/should-i-put-my-house-in-a-trust) and [transfer on death deed vs trust](/compare/transfer-on-death-deed-vs-trust)." },
      ],
    },
    {
      h: "What the attorney does",
      blocks: [
        {
          ol: [
            "Reviews your assets and family to decide whether a trust helps, and tells you if it does not.",
            "Drafts the trust and a pour-over will that sweeps stray assets into it.",
            "Prepares your durable power of attorney and healthcare documents so the plan covers incapacity.",
            "Prepares the deed for your home and gives you a funding checklist for bank, brokerage and beneficiary accounts. The [pricing](/pricing) page shows the funding help in each package.",
            `Holds a signing meeting, with witnesses and a notary as ${SERVED_OR} law requires.`,
          ],
        },
        { p: "The attorney you are matched with drafts your trust and includes funding instructions, because an unfunded trust does not work." },
      ],
    },
    {
      h: "What it costs",
      blocks: [
        { p: `The trust-based package is called Complete. It starts at ${fees.completeOne} for one person and ${fees.completeCouple} for a couple. A second property, a blended family, a business or a special needs provision moves the price. See [pricing](/pricing).` },
      ],
    },
  ],
  faqs: [
    { q: "What is the difference between a will and a living trust?", a: "A will takes effect at death and goes through probate. A living trust takes effect when you sign it and lets assets inside it pass without probate. A will is where guardians for children are named. See the table above and [will vs trust](/learn/trusts/will-vs-trust)." },
    { q: "Does a living trust avoid estate tax?", a: "No. A revocable trust is counted in your estate for tax purposes. Federal estate tax applies only above a high exemption, and some states have their own estate or inheritance tax. See [estate and inheritance taxes](/guides/estate-and-inheritance-taxes) and the [estate tax estimator](/tools/estate-tax-estimator)." },
    { q: "Do I lose control of my property?", a: "No. As trustee of a revocable trust you buy, sell and use property as you do now. You can change or cancel the trust whenever you have capacity." },
    { q: "Who should be my successor trustee?", a: "Someone trustworthy and organized who can handle paperwork and difficult family conversations. Many people name a child plus a backup, or a professional if no one fits. See [choosing a trustee](/learn/trusts/choosing-a-trustee) and [executor vs trustee](/compare/executor-vs-trustee)." },
    { q: "Do I have to put everything in the trust?", a: "No. Retirement accounts and life insurance usually stay out and pass by beneficiary form. Vehicles and small accounts often stay out too. The attorney tells you which assets people usually move." },
    { q: "What does it mean to fund a trust, and who does it?", a: "Funding means changing ownership of an asset to the trust, such as recording a new deed for your house or retitling a bank account. The attorney prepares the deed and instructions. Some steps, such as bank forms, you complete yourself." },
    { q: "Will my mortgage lender or insurer object if I move my home into a trust?", a: `Federal law generally prevents a lender from calling a home loan due when you move your home into a revocable trust and you stay a beneficiary and keep living there (12 U.S.C. 1701j-3(d)(8)). This applies in ${SERVED_AND}. People still usually tell their insurer and title company.` },
    { q: "What happens to the trust when I die?", a: "Your successor trustee gathers the assets, pays debts and taxes, and distributes what is left according to the trust. See [trust administration](/trust-administration)." },
  ],
  related: [
    { href: "/learn/trusts/revocable-living-trust", title: "Revocable living trust explained", kind: "Guide" },
    { href: "/guides/funding-your-trust", title: "Funding your trust", kind: "Guide" },
    { href: "/tools/will-or-trust", title: "Will or trust? A quick comparison", kind: "Tool" },
    { href: "/learn/trusts/will-vs-trust", title: "Will vs trust", kind: "Compare" },
    { href: "/trust-administration", title: "Trust administration", kind: "Service" },
  ],
};

const poa: MoneyPageData = {
  path: "/power-of-attorney",
  crumb: "Power of attorney",
  title: "Durable power of attorney: how it works",
  description: "A durable power of attorney lets someone you trust handle your money if you cannot. What it covers, when it starts, and how to set one up.",
  h1: "Durable power of attorney: who handles your money if you cannot",
  answer: "A durable power of attorney is a document that lets a person you choose, called your agent, manage your finances and property if you cannot. \"Durable\" means it stays valid if you become incapacitated. Without one, your family may need to ask a court for permission to pay your bills, and that can take months.",
  serviceType: "Power of attorney preparation",
  urgent: { title: "Parent unwell right now?", body: "If this is urgent, call. We will match you with an attorney who can tell you what is possible." },
  sections: [
    {
      h: "What an agent can and cannot do",
      blocks: [
        { p: "An agent can pay bills, manage bank and brokerage accounts, file taxes, deal with insurance and Medicare paperwork, sell or manage property, and run a business, to the extent your document allows. The powers are listed in the document, and some, such as making gifts or changing beneficiaries, may need to be spelled out. In New Jersey, an agent cannot make gifts of your property unless the document expressly allows it (N.J.S.A. 46:2B-8.13a). Illinois uses a statutory short form with its own list of powers, including gifts (755 ILCS 45/3-3), and the attorney explains what it covers." },
        { p: "An agent cannot make a will for you, and the authority ends when you die. After death the executor or successor trustee takes over. An agent is a fiduciary, which means a legal duty to act in your interest and keep your money separate from theirs. See [powers of attorney](/guides/powers-of-attorney)." },
      ],
    },
    {
      h: "When does it start?",
      blocks: [
        {
          table: {
            head: ["Type", "Starts", "Trade-off"],
            rows: [
              ["Immediate", "When you sign", "Simple and quick to use; you must trust your agent from day one"],
              ["Springing", "Only when a doctor or doctors certify incapacity", "Feels safer, but can cause delay while certification is arranged, and banks may hesitate"],
            ],
          },
        },
        { p: `Many attorneys prefer immediate, with the original held until needed. The attorney you are matched with explains which type they recommend and how it works under ${SERVED_OR} law.` },
      ],
    },
    {
      h: "Choosing an agent",
      blocks: [
        { p: "People commonly pick someone honest, calm and good with paperwork, and name a backup. Talk to them first. Naming two agents who must act together can leave you without help if they disagree." },
      ],
    },
    {
      h: "Power of attorney vs guardianship",
      blocks: [
        { p: "If you have no power of attorney and lose capacity, a court may appoint a guardian or conservator. That process is public, slow, supervised and expensive. A power of attorney signed in advance usually avoids it. The catch: it has to be signed while you still have capacity. See [power of attorney vs guardianship](/learn/power-of-attorney/power-of-attorney-vs-guardianship) and [caring for aging parents](/life-events/caring-for-aging-parents)." },
      ],
    },
    {
      h: "Banks sometimes refuse a valid power of attorney",
      blocks: [
        { p: "It happens, and it is frustrating. A document written to your state's standards, notarized and shown to your bank ahead of time, reduces the chance. In Illinois, a person or bank that refuses a valid power of attorney without reasonable cause can be liable for the damages that causes (755 ILCS 45/2-8). In New Jersey, banks must generally accept a properly signed power of attorney, may refuse only in situations the law lists, and in many cases must give the agent the reason in writing (N.J.S.A. 46:2B-13)." },
      ],
    },
    {
      h: "What the attorney prepares",
      blocks: [
        {
          ul: [
            "Durable financial power of attorney with a successor agent",
            "Healthcare power of attorney and living will, in the same signing (see [healthcare directives](/healthcare-directives))",
            "HIPAA authorization",
            "A short letter to help your agent present the document to banks",
          ],
        },
        { p: `Included in the Essentials, Complete and Legacy packages. On its own: ${fees.powerOfAttorneyAlone}. See [pricing](/pricing). The attorney explains your agent's duties in the signing meeting.` },
      ],
    },
  ],
  faqs: [
    { q: "What is the difference between a power of attorney and a healthcare directive?", a: "A financial power of attorney is about money and property. A healthcare directive covers medical decisions. Most people sign both, often with different agents. See [living will vs healthcare power of attorney](/compare/living-will-vs-healthcare-power-of-attorney)." },
    { q: "When should I sign one?", a: "When you are healthy and clear-headed. Capacity is required to sign, and it can disappear suddenly through a stroke, an accident or dementia." },
    { q: "Can my agent take my money?", a: "They have a legal duty not to misuse it. You can add safeguards: a requirement to give accountings, a limit on gifts, or a second person who must approve large transactions. A trusted agent is still the main safeguard." },
    { q: "Does a power of attorney work after death?", a: "No. Authority ends at death. The executor named in your will, or your successor trustee, takes over. See [what happens to a power of attorney when you die](/blog/what-happens-to-a-power-of-attorney-when-you-die)." },
    { q: "Does my spouse automatically have this authority?", a: `Usually not, in ${SERVED_OR}. Marriage alone does not make your spouse your agent, so a spouse often cannot sell a solely owned asset or deal with accounts in your name without a power of attorney.` },
    { q: "Is a power of attorney from another state valid here?", a: `Many states recognize out-of-state powers of attorney that were valid where signed, but local institutions may balk. If you have moved to ${SERVED_OR}, it is common to have the attorney you are matched with review yours and confirm how the state treats it.` },
    { q: "My parent has dementia and no power of attorney. What now?", a: "A person with dementia may still be able to sign if they understand what the document does on that day. That is a legal question that depends on the person's capacity. If they cannot, the usual route is a guardianship or conservatorship. Call, and we will match you with an attorney who can tell you what applies." },
  ],
  related: [
    { href: "/guides/powers-of-attorney", title: "Powers of attorney", kind: "Guide" },
    { href: "/learn/power-of-attorney/power-of-attorney-vs-guardianship", title: "Power of attorney vs guardianship", kind: "Compare" },
    { href: "/blog/can-a-power-of-attorney-change-a-will", title: "Can a power of attorney change a will?", kind: "Article" },
    { href: "/healthcare-directives", title: "Healthcare directives", kind: "Service" },
    { href: "/estate-planning-for-parents", title: "Estate planning for parents", kind: "Service" },
  ],
};

const healthcare: MoneyPageData = {
  path: "/healthcare-directives",
  crumb: "Healthcare directives",
  title: "Healthcare directives: proxy and living will",
  description: "Write down your medical wishes and name who decides for you if you cannot. Healthcare proxy, living will and HIPAA form explained.",
  h1: "Healthcare directives: who decides if you cannot",
  answer: "A healthcare directive is a set of documents that tells doctors what treatment you want and names a person to make medical decisions if you cannot speak for yourself. It usually includes a healthcare power of attorney (also called a healthcare proxy) and a living will. Without them, your family may disagree, or a hospital may follow default rules.",
  serviceType: "Healthcare directive preparation",
  sections: [
    {
      h: "The documents",
      blocks: [
        {
          table: {
            head: ["Document", "What it does"],
            rows: [
              ["Healthcare power of attorney (proxy, agent, surrogate)", "Names the person who decides medical matters if you cannot"],
              ["Living will", "States your wishes on life support, feeding tubes and comfort care"],
              ["HIPAA authorization", "Lets named people see your medical records, so they can do the job"],
              ["POLST form (in Illinois, the IDPH Uniform POLST form; in New Jersey, the POLST form)", "A medical order signed by a clinician for people with a serious illness. Not a replacement for an advance directive"],
            ],
          },
        },
        { p: "State terms vary. Illinois uses a statutory short form power of attorney for health care (755 ILCS 45/4-10) and a separate living will declaration (755 ILCS 35/3). New Jersey calls these documents an advance directive: a proxy directive names your health care representative, and an instruction directive states your wishes (N.J.S.A. 26:2H-55, 26:2H-58)." },
      ],
    },
    {
      h: "Choosing your healthcare agent",
      blocks: [
        { p: "People commonly choose someone who can stay calm, ask doctors questions, and carry out your wishes even if they would choose differently. Talk to them in advance and name a backup. They do not need to be the same person as your financial agent, and sometimes should not be." },
      ],
    },
    {
      h: "What to think about before you write a living will",
      blocks: [
        {
          ul: [
            "How do you feel about being kept alive on a ventilator if doctors expect no recovery?",
            "Would you want artificial nutrition and hydration?",
            "Do you want to donate organs?",
            "Where do you want to spend your last days, if there is a choice?",
            "Are there religious or cultural practices your family should know?",
          ],
        },
        { p: "There are no right answers. The point is that someone knows yours. See [healthcare directives and living wills](/guides/healthcare-directives-and-living-wills) and [what is a HIPAA release](/blog/what-is-a-hipaa-release-and-why-does-it-belong-in-your-plan)." },
      ],
    },
    {
      h: "Directive vs POLST",
      blocks: [
        { p: "An advance directive is for any adult. A POLST is for people who are seriously ill or frail, and it is an order that emergency crews and hospitals follow. Ask your doctor whether one fits your situation." },
      ],
    },
    {
      h: "Signing rules",
      blocks: [
        { p: "**Illinois.** The statutory health care power of attorney needs one adult witness and no notary. The witness cannot be your agent, a relative of you or your agent, your doctor or certain other health providers, or an owner or operator of the facility where you live (755 ILCS 45/4-10). A living will needs two adult witnesses who would not inherit from you and are not paying for your medical care (755 ILCS 35/3)." },
        { p: "**New Jersey.** You sign before two adult witnesses, or acknowledge the directive before a notary or attorney. The person you name as your health care representative cannot be a witness (N.J.S.A. 26:2H-56)." },
        { p: "The attorney you are matched with prepares the documents to meet these rules, and explains where to store copies and how to give them to your doctors." },
      ],
    },
    {
      h: "Cost",
      blocks: [
        { p: `Included in every package. On its own: ${fees.healthcareDirectiveAlone}. See [pricing](/pricing). Attorneys do not give medical advice. Talk to your doctor about your health, and the attorney helps put what you decide in writing.` },
      ],
    },
  ],
  faqs: [
    { q: "What is the difference between a living will and a healthcare power of attorney?", a: "A living will describes the treatment you do or do not want. A healthcare power of attorney names a person who decides when situations arise that the living will did not foresee. Together they often work better than either alone. See [living will vs healthcare power of attorney](/compare/living-will-vs-healthcare-power-of-attorney)." },
    { q: "Do I need both?", a: "Many attorneys suggest both. The agent covers situations you could not predict. The living will helps your agent know what you would say." },
    { q: "Does the document need to be notarized?", a: "In Illinois, no. The statutory health care power of attorney needs one witness, and a living will needs two (755 ILCS 45/4-10, 755 ILCS 35/3). In New Jersey, you can use two witnesses or a notary or attorney instead (N.J.S.A. 26:2H-56)." },
    { q: "What if my family disagrees with my choices?", a: "Your agent and your written wishes control, subject to the law. Writing it down can prevent arguments, because your family sees that the decision was yours." },
    { q: "Can doctors ignore my directive?", a: "A doctor may decline, but cannot simply walk away. In Illinois, a provider who will not follow your agent's decision must tell the agent promptly and keep caring for you while the agent arranges a transfer (755 ILCS 45/4-7). In New Jersey, a provider or institution that declines must take reasonable steps toward a timely, respectful transfer (N.J.S.A. 26:2H-65). Give your agent and your doctor copies." },
    { q: "I travel. Does my directive work in another state?", a: "Many states honor out-of-state directives that were valid where signed. Carry copies, and consider an update if you move." },
    { q: "What is a HIPAA authorization and why is it separate?", a: "Federal privacy law limits who can see your records. A HIPAA authorization names who may. Without it, your agent may struggle to get information. See [what is a HIPAA release](/blog/what-is-a-hipaa-release-and-why-does-it-belong-in-your-plan)." },
  ],
  related: [
    { href: "/guides/healthcare-directives-and-living-wills", title: "Healthcare directives and living wills", kind: "Guide" },
    { href: "/blog/who-makes-medical-decisions-if-you-have-no-healthcare-directive", title: "Who makes medical decisions with no directive?", kind: "Article" },
    { href: "/life-events/serious-diagnosis", title: "After a serious diagnosis", kind: "Life event" },
    { href: "/power-of-attorney", title: "Power of attorney", kind: "Service" },
    { href: "/estate-planning-for-parents", title: "Estate planning for parents", kind: "Service" },
  ],
};

const probate: MoneyPageData = {
  path: "/probate",
  crumb: "Probate",
  title: "Probate: steps, timeline and costs",
  description: "Someone died and you may be the executor. What probate is, how long it can take, what it costs, and when people commonly hire a lawyer.",
  h1: "Probate: what to do after someone dies",
  answer: "Probate is the court process that confirms a will, appoints someone to manage the estate, pays debts, and transfers property to heirs. How long it takes depends on your state and the estate. It is sometimes avoidable for small estates or assets that pass outside the will. You do not have to decide anything today. The first steps are simple, and we list them below.",
  cta: "call",
  callbackForm: "probate",
  urgent: { title: "Someone just died?", body: "Take the first week slowly. Below is what has a deadline and what does not." },
  emailCapture: { interest: "executor-checklist", title: "Email me the first-30-days checklist", body: "A printable list of what people commonly do first after a death." },
  sections: [
    {
      h: "What to do first (the first two weeks)",
      id: "first-steps",
      blocks: [
        {
          ol: [
            "**Get certified copies of the death certificate.** Banks, insurers and agencies each want one, so people often order more than they expect to use.",
            "**Find the will and any trust documents.** Check the home, a safe, the attorney who prepared it, and the county probate court.",
            "**Do not sell, give away or distribute property yet.** Debts come first, and acting without authority can create personal liability.",
            "**Notify the right agencies.** Social Security (funeral homes often report), banks, life insurers and employers.",
            "**Secure the home and valuables.** Change locks if needed, forward mail, keep insurance active.",
            "**Talk to a probate attorney before filing, not after.** One conversation can tell you whether probate is required at all.",
          ],
        },
        { p: "Full checklists: [first 30 days after a death](/checklists/first-30-days-after-a-death) and [when a parent dies](/life-events/death-of-a-parent)." },
      ],
    },
    {
      h: "Is probate required?",
      blocks: [
        { p: "Not always. Property passes outside probate when it has a named beneficiary, is held jointly with survivorship, or is in a living trust. Both states offer a simpler route for small estates. In Illinois, a small estate affidavit can be used when the personal property, not counting real estate or vehicles, is $150,000 or less, for deaths on or after August 15, 2025 (755 ILCS 5/25-1). In New Jersey, when there is no will, a surviving spouse or partner can use an affidavit if the whole estate is $50,000 or less, and other heirs if it is $20,000 or less (N.J.S.A. 3B:10-3, 3B:10-4). Figures as of 2026. See [probate vs non-probate assets](/learn/probate/probate-vs-non-probate-assets) and [can you skip probate for a small estate?](/blog/can-you-skip-probate-for-a-small-estate)" },
      ],
    },
    {
      h: "How probate works in five steps",
      blocks: [
        {
          ol: [
            "**File the will and petition** in the probate court in the county where the person lived.",
            "**The court appoints the executor** (the person named in the will) or an administrator if there is no will. They receive official authority papers.",
            "**Notify heirs and creditors.** Creditors have a limited window to make claims. In Illinois, the deadline is at least six months after the notice is first published, or three months after a known creditor is mailed notice, whichever is later (755 ILCS 5/18-3). In New Jersey, creditors present claims within nine months of the death (N.J.S.A. 3B:22-4).",
            "**Inventory, pay debts and taxes.** The executor values assets, pays bills and files final tax returns.",
            "**Distribute what is left** and close the estate with the court.",
          ],
        },
        { p: "See [how probate works](/guides/how-probate-works) and [settling an estate step by step](/guides/settling-an-estate-step-by-step)." },
      ],
    },
    {
      h: "How long does it take, and what does it cost?",
      blocks: [
        { p: "Delays usually come from missing documents, family disputes, real estate that must be sold, or creditor claims. Court filing fees vary by county. In Illinois, the creditor period means most estates stay open at least six months, and attorney fees are not a set percentage: they must be reasonable (755 ILCS 5/27-2). In New Jersey, many executors wait out the nine-month creditor period before the final distribution." },
        { p: "See [how long does probate take?](/learn/probate/how-long-does-probate-take) and try the [probate cost estimator](/tools/probate-cost-estimator) and the [executor workload tool](/tools/executor-workload) for a rough picture." },
      ],
    },
    {
      h: "Do people hire a probate lawyer?",
      blocks: [
        { p: "Often not for a very small, uncontested estate. Often yes when there is real estate, a business, debts that may exceed assets, a family dispute, or property in more than one state. Courts in some states let executors file on their own, but a mistake can make an executor personally responsible." },
      ],
    },
    {
      h: "If you are an heir, not the executor",
      blocks: [
        { p: "You usually do not need to hire anyone. You can usually ask the executor for an inventory and updates. If property seems mismanaged, an attorney can talk through your options with you. The executor's attorney cannot also represent you in a dispute." },
      ],
    },
    {
      h: "Inheriting a house",
      blocks: [
        { p: "A house that goes through probate generally cannot be sold until the executor has authority. Heirs who inherit together decide whether to sell, keep, or buy each other out. See [who gets the house if there's no will and no spouse](/blog/who-gets-the-house-if-theres-no-will-and-no-spouse) and [what happens to a mortgage when the owner dies](/blog/what-happens-to-a-mortgage-when-the-owner-dies)." },
      ],
    },
    {
      h: "Probate help and what it costs",
      blocks: [
        { p: `${end(services.probate)} The work begins with a short consult to say whether probate is needed and what it will likely take. Consult fee: ${firm.consultFee}. The engagement agreement states the scope and what is billed separately, such as court costs and appraisals. The attorney can also tell you if the estate is small enough that you can handle it yourself.` },
      ],
    },
  ],
  faqs: [
    { q: "How long do I have to open probate?", a: "In Illinois, whoever has the will must file it with the clerk of the circuit court as soon as they learn of the death, even if no probate is needed, and hiding a will for 30 days after learning of the death is a crime (755 ILCS 5/6-1). In New Jersey, wills are probated through the county surrogate's office. In either state, do not wait." },
    { q: "Can I pay the funeral bill from the person's bank account?", a: "Often the family pays first and is reimbursed by the estate, because accounts may be frozen. Keep every receipt. In both states, reasonable funeral expenses are among the first debts paid from the estate (755 ILCS 5/18-10; N.J.S.A. 3B:22-2)." },
    { q: "Am I personally responsible for the deceased's debts?", a: "Generally no, with exceptions such as a co-signer, a joint account holder, or community property in some states. Executors who distribute property before paying valid debts can become personally liable, so people commonly wait until the debts are known. See [what happens to debt when someone dies](/learn/probate/dealing-with-debts-in-probate)." },
    { q: "What if there is no will?", a: "The court appoints an administrator, usually a spouse or adult child, and state law decides who inherits. See [what happens if you die without a will](/learn/wills/dying-without-a-will)." },
    { q: "What if I think the will is invalid, or a sibling is hiding things?", a: "Talk to an attorney soon. Deadlines are short. In Illinois, a will contest must be filed within six months after the will is admitted to probate (755 ILCS 5/8-1). In New Jersey, it is four months after probate, or six months if you lived outside New Jersey at the time (N.J. Court Rule 4:85-1)." },
    { q: "Can I avoid probate now that the person has died?", a: "Sometimes. If assets have a beneficiary or are jointly owned, they pass automatically. If the estate qualifies for a small-estate procedure, that may be used. An attorney can help you check." },
    { q: "Do I have to hire the attorney who drafted the will?", a: "No. You choose the attorney. In Illinois, reasonable fees for the estate's attorney are paid from the estate (755 ILCS 5/27-2). In New Jersey, the estate also commonly pays the executor's legal fees as a cost of administration, and the attorney confirms what applies." },
    { q: "What does the first call cost, and what will you ask?", a: `Consult fee: ${firm.consultFee}. Expect questions about the date and county of death, whether there was a will, and a rough list of assets and debts. You do not need paperwork in hand.` },
  ],
  ctaTitle: "Prefer to talk first?",
  ctaBody: "Call, or leave your number above. If you would rather start online, the plan finder takes about two minutes.",
  related: [
    { href: "/guides/how-probate-works", title: "How probate works", kind: "Guide" },
    { href: "/checklists/first-30-days-after-a-death", title: "First 30 days after a death", kind: "Checklist" },
    { href: "/tools/probate-cost-estimator", title: "Probate cost estimator", kind: "Tool" },
    { href: "/learn/probate/probate-vs-non-probate-assets", title: "Probate vs non-probate assets", kind: "Compare" },
    { href: "/trust-administration", title: "Trust administration", kind: "Service" },
  ],
};

const trustAdmin: MoneyPageData = {
  path: "/trust-administration",
  crumb: "Trust administration",
  title: "Trust administration: what a trustee does",
  description: "If you are the trustee of a living trust, here is what trustees commonly do, in what order, and when to get help.",
  h1: "Trust administration: what a successor trustee does",
  answer: "Trust administration is the work a successor trustee does after the person who created the trust dies or becomes incapacitated. It involves locating assets, notifying beneficiaries, paying debts and taxes, and distributing what is left under the trust's terms. It usually does not require court involvement, but it comes with legal duties and deadlines.",
  cta: "call",
  callbackForm: "trust-administration",
  emailCapture: { interest: "trustee-checklist", title: "Email me the trustee checklist", body: "A printable list of the first steps a successor trustee commonly takes." },
  sections: [
    {
      h: "Your role in plain terms",
      blocks: [
        { p: "A trustee is a fiduciary. The law holds you to a high standard: act for the beneficiaries, not yourself; keep trust money separate from yours; keep records; communicate. Trustees are generally allowed to be paid and to hire professionals at the trust's expense. Illinois allows reasonable compensation (760 ILCS 3/708). New Jersey sets commission rates for fiduciaries by statute (N.J.S.A. 3B:18-25). See [choosing a trustee](/learn/trusts/choosing-a-trustee)." },
      ],
    },
    {
      h: "The first 30 days",
      blocks: [
        {
          ol: [
            "Get certified death certificates.",
            "Find the trust document and all amendments. Read the sections on successor trustees, distributions and special instructions.",
            "Obtain an EIN for the trust, which becomes irrevocable at death, and open a trust account.",
            "Notify beneficiaries in writing. In Illinois, the trustee sends notice within 90 days after the trust becomes irrevocable (760 ILCS 3/813.1). New Jersey sets no fixed deadline, but the trustee must keep beneficiaries reasonably informed (N.J.S.A. 3B:31-67).",
            "Secure assets: home, vehicles, accounts, digital access.",
            "Hold off on distributions until debts, taxes and claims are understood.",
          ],
        },
        { p: "The [first 30 days checklist](/checklists/first-30-days-after-a-death) and the [important contacts list](/checklists/important-contacts-list) help with the paperwork." },
      ],
    },
    {
      h: "The typical timeline",
      blocks: [
        {
          table: {
            head: ["Phase", "Typical length", "What happens"],
            rows: [
              ["Months 0 to 1", "1 month", "Notice, EIN, asset search, secure property"],
              ["Months 1 to 6", "Up to 6 months", "Inventory and valuation, creditor and tax issues, accountings"],
              ["Months 6 to 12", "6 months", "Sell or transfer property, final tax returns, distributions"],
              ["After 12 months", "Varies", "Complex or contested trusts, estate tax issues"],
            ],
          },
        },
        { p: "These ranges are common, not promises. Your trust may move faster or slower." },
      ],
    },
    {
      h: "Trustee duties and traps",
      blocks: [
        {
          ul: [
            "**Duty to inform.** Beneficiaries are entitled to certain information and often periodic accountings.",
            "**Duty of impartiality.** With several beneficiaries, a trustee cannot favor one.",
            `**Taxes.** The trust files its own income tax returns, and a final return is needed for the person who died. Some trusts owe estate tax, though the federal exemption is $${(FIGURES.federalExemption / 1_000_000).toFixed(0)} million per person as of ${FIGURES.year}.`,
            "**Personal liability.** A trustee who distributes too early or invests carelessly can be personally liable.",
            "**Real estate.** Selling a home involves title, an appraisal at date-of-death value (important for taxes), and sometimes sibling disagreement.",
          ],
        },
        { p: "See [executor vs trustee](/compare/executor-vs-trustee) and [what does a trustee actually do each year?](/blog/what-does-a-trustee-actually-do-each-year)" },
      ],
    },
    {
      h: "When people do it themselves and when they call",
      blocks: [
        { p: "Trustees commonly handle it themselves when the trust is simple, has one or two beneficiaries who get along, and has few assets. They commonly get an attorney when there is real estate to sell, a business, a beneficiary who is a minor or has a disability, a family dispute, or estate tax. A one-hour consult is often enough to set the plan." },
      ],
    },
    {
      h: "Trustee help and what it costs",
      blocks: [
        { p: "Attorneys in our network offer some or all of the services below. The attorney you are matched with confirms what they offer, and the fee, before you commit." },
        {
          table: {
            head: ["Service", "What it covers", "Fee"],
            rows: [
              ["Trustee consult", "A consult and a written next-steps plan", fees.trusteeConsult],
              ["Guided administration", "You do the tasks; the attorney reviews notices, accountings and distributions", fees.guidedTrustAdministration],
              ["Full administration", "The attorney handles notices, tax coordination, distributions and closing", fees.fullTrustAdministration],
            ],
          },
        },
      ],
    },
  ],
  faqs: [
    { q: "Do I need a lawyer to be a trustee?", a: "Not legally. Practically, many trustees get advice for any trust with real estate, tax issues or disagreement. An hour with an attorney often costs less than a trustee mistake." },
    { q: "Does a living trust avoid probate entirely?", a: "For assets properly titled in the trust, yes. Assets outside it may still need probate. See [probate](/probate) and [funding your trust](/guides/funding-your-trust)." },
    { q: "Do I have to tell the beneficiaries?", a: "Usually yes. In Illinois, notice is due within 90 days after the trust becomes irrevocable (760 ILCS 3/813.1). In New Jersey, the trustee must keep beneficiaries reasonably informed and answer their requests promptly (N.J.S.A. 3B:31-67)." },
    { q: "Can I pay myself?", a: "Reasonable compensation is generally allowed unless the trust says otherwise, but trustees keep records and are prepared to justify it." },
    { q: "How long will this take?", a: "Simple trusts can finish in months. Real estate sales, taxes and disputes extend it. The timeline above shows a common pattern." },
    { q: "What if a beneficiary is upset or demands money?", a: "Respond in writing, share the trust terms they are entitled to see, and avoid early payments. If a dispute escalates, talk to an attorney before you reply." },
    { q: "What taxes apply?", a: "The trust may owe income tax. Inherited property generally gets a step-up in basis to its date-of-death value, which can reduce capital gains on a later sale (26 U.S.C. 1014). See [estate and inheritance taxes](/guides/estate-and-inheritance-taxes)." },
    { q: "What if I do not want to be trustee?", a: "You can usually decline or resign, and the trust names the next person. People commonly avoid actions that look like acceptance until they decide." },
  ],
  ctaTitle: "Prefer to talk first?",
  ctaBody: "Call, or leave your number above. If you would rather start online, the plan finder takes about two minutes.",
  related: [
    { href: "/learn/trusts/choosing-a-trustee", title: "Choosing a trustee", kind: "Guide" },
    { href: "/blog/what-does-a-trustee-actually-do-each-year", title: "What a trustee does each year", kind: "Article" },
    { href: "/checklists/first-30-days-after-a-death", title: "First 30 days after a death", kind: "Checklist" },
    { href: "/probate", title: "Probate", kind: "Service" },
    { href: "/living-trusts", title: "Living trusts", kind: "Service" },
  ],
};

const parents: MoneyPageData = {
  path: "/estate-planning-for-parents",
  crumb: "Estate planning for parents",
  title: "Estate planning for parents: kids and aging parents",
  description: "Two kinds of parents need a plan: those raising kids and those caring for aging parents. Which documents matter first and what it costs.",
  h1: "Estate planning for parents: for your kids and for your own parents",
  answer: "If you are a parent, two estate plans matter to you. One is yours: who raises your children and manages their money if you die. The other is your own parents': who handles their finances and health decisions if they cannot. Both start with a few short documents, and both are much easier to do before a crisis.",
  jump: [{ id: "young-children", label: "I have young children" }, { id: "aging-parents", label: "I am helping my parents" }],
  urgent: { title: "A parent in the hospital, or a recent diagnosis?", body: "Tell us on the first call. Some documents can only be signed while a person has capacity." },
  sections: [
    {
      h: "Part A: You have young children",
      id: "young-children",
      blocks: [
        { p: "**The first thing to settle is a guardian.** If both parents die without a named guardian, a judge picks, and the family may have to fight it out in court. Naming a guardian in your will is the step many young parents put first. See [guardianship for minor children](/guides/guardianship-for-minor-children), the [guardian worksheet](/checklists/choosing-a-guardian-worksheet), and [can you name a guardian who lives in another state?](/blog/can-you-name-a-guardian-who-lives-in-another-state)" },
        { p: "**The second is who manages the money.** A minor cannot own much property outright. Without a plan, a court may supervise an account until the child turns 18, and the child then receives all of it at once. A trust lets you pick a manager and release money at ages you choose. See [leaving money to minors](/learn/guardianship/leaving-money-to-minors) and the [guardian fund calculator](/tools/guardian-fund-calculator)." },
        { p: "A common minimum plan for parents of minors:" },
        {
          ol: [
            "Wills for both parents naming a guardian and a backup",
            "A trust (in the will, or a living trust) to hold money for the children",
            "Beneficiary designations on life insurance and retirement accounts that fit the plan. Naming a minor child directly can lead to a court-supervised account",
            "Durable powers of attorney and healthcare directives, because incapacity of a parent is more common than death",
            "Life insurance sized to the family's needs. We do not sell insurance or advise on products; a licensed agent can. The [life insurance needs tool](/tools/life-insurance-needs) gives a rough starting point",
          ],
        },
        { p: "See [estate planning when you have a new baby](/life-events/new-baby) and [wills](/wills)." },
      ],
    },
    {
      h: "Part B: You are helping aging parents",
      id: "aging-parents",
      blocks: [
        { p: "**Start with the conversation, not the paperwork.** Many parents resist because they think it is about money or about giving up control. A common opener: \"I want to make sure we do what you want if something happens.\" Ask where the documents are, who they have named, and who they trust. See [how to talk to your parents about their estate plan](/blog/how-to-talk-to-your-parents-about-their-estate-plan)." },
        { p: "What families commonly look for, in order:" },
        {
          ol: [
            "A durable power of attorney for finances. Without it, a court may be needed if your parent loses capacity. See [power of attorney](/power-of-attorney)",
            "A healthcare power of attorney, living will and HIPAA release. See [healthcare directives](/healthcare-directives)",
            "A will or trust that matches current wishes, current family and property",
            "A list of accounts and contacts. The [asset and account inventory](/checklists/asset-and-account-inventory) and [important contacts list](/checklists/important-contacts-list) help",
            "Beneficiary designations on retirement accounts and insurance, which override a will",
          ],
        },
        { p: "**If your parent has already lost capacity.** A power of attorney cannot be signed after capacity is gone. A guardianship or conservatorship may be the only option. See [power of attorney vs guardianship](/learn/power-of-attorney/power-of-attorney-vs-guardianship)." },
        { p: `**Long-term care costs.** Some families plan years ahead for nursing home costs. Medicaid has a look-back period for gifts (${FIGURES.medicaidLookbackMonths} months in most states, California differs), and moving a house without advice can cause a penalty. Ask the attorney you are matched with whether they advise on Medicaid planning. See [Medicaid and long-term care planning](/learn/elder-care/medicaid-planning) and the [Medicaid look-back date tool](/tools/medicaid-lookback-date).` },
        { p: "**Do not put your name on your parent's deed as a shortcut.** It can cause gift tax, capital gains tax, creditor exposure and loss of the stepped-up basis. Ask first. See [caring for aging parents](/life-events/caring-for-aging-parents)." },
      ],
    },
    {
      h: "What people commonly do this month",
      blocks: [
        {
          table: {
            head: ["If this describes you", "Common first step"],
            rows: [
              ["Young children, no will", "Sign wills with a guardian, then fix beneficiaries"],
              ["Parents with no power of attorney, still sharp", "Have the conversation and book a power of attorney signing"],
              ["Parent recently diagnosed", "Call us: there may be a short window to sign"],
              ["Parent already incapacitated", "Call us: the route is likely a guardianship"],
            ],
          },
        },
        { p: "Many attorneys will meet with you and your parents together, if your parents agree. Ask when you book." },
      ],
    },
  ],
  faqs: [
    { q: "My parents refuse to talk about this. What can I do?", a: "Start small. Ask where their documents are kept, not what is in them. Offer to attend one meeting. Frame it around their wishes. If they still refuse, there is little that can be done legally, so keep a note of what you have asked." },
    { q: "Can I sign for my parent?", a: "Only if they have named you as agent in a signed power of attorney, or you have been appointed guardian by a court. Being a child does not give you the right." },
    { q: "How do we do this if my parent has early dementia?", a: "Capacity is not all or nothing. A person may be able to sign on a good day, and attorneys will assess it. A note from the doctor can help." },
    { q: "Does a power of attorney cost a lot?", a: `It is among the less expensive documents. The flat fee is ${fees.powerOfAttorneyAlone} on its own, and it is included in each package. See [pricing](/pricing).` },
    { q: "Who should be our children's guardian?", a: "Someone with the values, health, energy and finances to raise them, and who has said yes. It does not have to be the richest relative. See [can I name my sister as guardian if my husband disagrees?](/blog/can-i-name-my-sister-as-guardian-if-my-husband-disagrees)" },
    { q: "What if I am divorced or a single parent?", a: `Your plan may matter more. In ${SERVED_AND}, as in most states, the other parent usually keeps custody if you die unless a court finds otherwise. The attorney you are matched with explains how this works for your family. Many single parents name guardians for the case where both parents cannot serve.` },
    { q: "How often should parents update a plan?", a: "Every few years, and after any marriage, divorce, birth, move or large change in assets. See [updating your estate plan](/learn/basics/when-to-update-your-estate-plan)." },
    { q: "What if my parent lives in a different state?", a: `Documents should fit the state where your parent lives. Attorneys in our network practice in ${SERVED_AND}. If your parent lives elsewhere, the state bar's lawyer referral service in that state can help.` },
  ],
  related: [
    { href: "/life-events/caring-for-aging-parents", title: "Caring for aging parents", kind: "Life event" },
    { href: "/guides/guardianship-for-minor-children", title: "Guardianship for minor children", kind: "Guide" },
    { href: "/checklists/choosing-a-guardian-worksheet", title: "Choosing a guardian worksheet", kind: "Checklist" },
    { href: "/power-of-attorney", title: "Power of attorney", kind: "Service" },
    { href: "/healthcare-directives", title: "Healthcare directives", kind: "Service" },
  ],
};

const howItWorks: MoneyPageData = {
  path: "/how-it-works",
  crumb: "How it works",
  title: "How estate planning works: our process and timeline",
  description: `What happens when you use ${firm.brandName} to find an estate planning attorney: the questionnaire, the consultation, drafting, signing, and what to have ready.`,
  h1: `How estate planning works with ${firm.brandName}`,
  answer: `You start with a short questionnaire, then a call with a team member who matches you with an estate planning attorney in our network and books your consultation. At the consultation the attorney recommends a plan and quotes a flat fee. If you hire the attorney, they draft the documents, you review them, and you sign them with witnesses and a notary. Typical turnaround: ${end(services.turnaround)}`,
  steps: [
    { name: "Questionnaire", text: "Answer questions about your family, property and goals on the plan finder." },
    { name: "Intake call", text: "A team member confirms the basics, matches you with an attorney and books your consultation." },
    { name: "Consultation", text: "You talk with the attorney, who recommends a plan and gives a flat fee." },
    { name: "Engagement", text: "You sign an engagement agreement. This is when the attorney-client relationship begins." },
    { name: "Information gathering", text: "You complete a short questionnaire and share names, accounts and existing documents." },
    { name: "Drafting", text: "The attorney drafts your documents." },
    { name: "Review meeting", text: "You read the drafts and ask questions, and changes are made." },
    { name: "Signing", text: "Documents are signed in front of witnesses and a notary." },
    { name: "After signing", text: "You get copies and instructions to fund the trust, update beneficiaries and tell your agents." },
  ],
  urgent: { title: "Hospital, diagnosis or surgery coming up?", body: `Tell us on the first call. When documents are urgent: ${end(services.urgentTurnaround)}` },
  sections: [
    {
      h: "Step by step",
      blocks: [
        {
          table: {
            head: ["Step", "What happens", "Who", "How long"],
            rows: [
              ["1. Questionnaire", "You answer questions about your family, property and goals on the [plan finder](/plan-finder)", "You", "About 2 minutes"],
              ["2. Intake call", "A team member confirms the basics, matches you with an attorney in our network and books your consultation. They are not lawyers and do not give legal advice", "Our team", `A short call, within ${firm.responseTime}`],
              ["3. Consultation", "You talk with the attorney: your family, what you own, what worries you. You get a recommendation and a flat fee", "The attorney", `${firm.consultLength}, ${firm.consultFormat}`],
              ["4. Engagement", "You sign an engagement agreement and pay a deposit if one applies. This is when the attorney-client relationship begins", "You", "Same day if you decide then"],
              ["5. Information gathering", "A short questionnaire and document upload: names, account list, existing documents", "You", "Varies"],
              ["6. Drafting", "The attorney drafts your documents", "The attorney", firm.draftingTime],
              ["7. Review meeting", "You read the drafts and ask questions. Changes are made", "You and the attorney", "Varies"],
              ["8. Signing", `Documents are signed in front of witnesses and a notary, as ${SERVED_OR} law requires`, "You, the attorney, witnesses and a notary", "Varies"],
              ["9. After signing", "You get copies and instructions: fund the trust, update beneficiaries, tell your agents", "You, with the attorney's help", "Varies"],
            ],
          },
        },
      ],
    },
    {
      h: "What to have ready",
      blocks: [
        { p: "A rough idea is enough for the consultation. Nobody expects every number." },
        {
          ul: [
            "Full names of family members, including children's birthdates",
            "Whether you own a home, its approximate value, and whether there is a mortgage",
            "A list of main accounts (banks, retirement, brokerage, insurance) with approximate values",
            "Any business interests",
            "Existing wills, trusts or powers of attorney",
            "A divorce decree or prenup if there is one",
            "Who you would trust as guardian, executor, trustee and agents. A rough shortlist is fine",
            "Questions. Write them down, because people forget them in the meeting",
          ],
        },
        { p: "The [asset and account inventory](/checklists/asset-and-account-inventory) and [documents to gather before your consult](/checklists/documents-to-gather-before-your-consult) help." },
      ],
    },
    {
      h: "What the first call is and is not",
      blocks: [
        { p: "It is a short conversation to check that we can help, match you with an attorney and book a time. It is not legal advice, and no attorney-client relationship begins until you sign an engagement agreement. Please do not send Social Security numbers, account numbers or medical details through the website or by text. We will tell you how to share documents safely later." },
      ],
    },
    {
      h: "How your information is used",
      blocks: [
        { p: "We use what you tell us to contact you, match you with an attorney and prepare for your consultation. We do not sell your information. We contact you by phone, email or text only as you have agreed. Text messages are optional, and you can opt out any time by replying STOP. See [privacy](/legal/privacy), [text message terms](/legal/sms-terms) and [how we work](/legal/how-we-work)." },
      ],
    },
    {
      h: "What happens after you sign",
      blocks: [
        { p: `${end(services.afterSigning)} A baby, a move, a divorce or a diagnosis are common reasons to call. See [updating your estate plan](/learn/basics/when-to-update-your-estate-plan) and the [plan review reminder](/tools/plan-review-reminder).` },
        { p: "Legal work is done by the attorney you are matched with, or under their supervision. Our team schedules and organizes. Team members are not lawyers and do not give legal advice." },
      ],
    },
  ],
  faqs: [
    { q: "Do I have to come to the office?", a: `Consultations are by ${firm.consultFormat}. Signing may be in person, or remote where ${SERVED_OR} law allows it for your documents. The attorney confirms which applies.` },
    { q: "How long from first call to signing?", a: `${end(services.turnaround)} When there is a real reason, such as a hospital stay: ${end(services.urgentTurnaround)}` },
    { q: "What if I need to change something after signing?", a: `Every package includes one round of revisions before signing. After signing: ${end(services.afterSigning)} Later amendments are quoted separately.` },
    { q: "Can my spouse come to the consult?", a: "Yes, and many couples attend together. Spouses who both sign an engagement agreement become joint clients, and the attorney explains what that means for confidentiality before you sign." },
    { q: "Is what I tell you confidential?", a: `Information you share with an attorney while seeking legal help is generally protected, even before you hire them. ${SERVED_AND} both cover this in Rule 1.18 of their Rules of Professional Conduct. Our intake team are not lawyers, so share only what is needed on the first call.` },
    { q: "What if I decide not to hire you?", a: "That is fine. You keep the recommendation, and nobody will pressure you. A team member may follow up once or twice at most." },
    { q: `What if I live outside ${SERVED_OR}?`, a: `Attorneys in our network advise on ${SERVED_AND} law only. If you live elsewhere, your state bar's lawyer referral service can help you find someone.` },
  ],
  related: [
    { href: "/pricing", title: "Pricing", kind: "Page" },
    { href: "/about-the-attorney", title: "About the attorney", kind: "Page" },
    { href: "/checklists/documents-to-gather-before-your-consult", title: "Documents to gather before your consult", kind: "Checklist" },
    { href: "/learn/basics/what-is-estate-planning", title: "What is estate planning?", kind: "Guide" },
    { href: "/contact", title: "Contact", kind: "Page" },
  ],
};

const aboutAttorney: MoneyPageData = {
  path: "/about-the-attorney",
  crumb: "About the attorney",
  title: `${A}, estate planning attorney`,
  description: `${A} is the estate planning attorney responsible for ${firm.brandName} (Bar No. ${firm.barNumber}). Background, education, how the referral network works, and how to reach us.`,
  h1: `${A}, estate planning attorney`,
  schema: "profile",
  answer: `${A} is the estate planning attorney responsible for ${firm.brandName}, a referral website that matches visitors with an appropriate estate planning attorney in ${SERVED_OR}. ${firm.attorneyShortBio}`,
  sections: [
    {
      h: "Education and admission",
      blocks: [
        {
          table: {
            head: ["Item", "Detail"],
            rows: [
              ["Admitted to practice", firm.attorneyBio.licensedIn],
              ["Bar number", firm.barNumber],
              ["Education", firm.attorneyBio.education],
              ["Practice", firm.attorneyBio.practiceFocus],
              ...(firm.attorneyBio.certification ? [["Certification", firm.attorneyBio.certification]] : []),
              ...firm.attorneyBio.awards.map((a) => ["Recognition", a]),
            ],
          },
        },
        firm.barLookupUrl
          ? { p: `[Verify the license on the state bar website](${firm.barLookupUrl})` }
          : { p: "You can check any attorney's license yourself: in Illinois through the Attorney Registration and Disciplinary Commission (ARDC) lawyer search, and in New Jersey through the New Jersey Courts attorney search." },
      ],
    },
    {
      h: "What the network helps with",
      blocks: [
        { p: "Attorneys in our network handle estate planning matters like these. The attorney you are matched with confirms which they take on before you book." },
        {
          ul: [
            "[Wills](/wills)",
            "[Living trusts](/living-trusts)",
            "[Powers of attorney](/power-of-attorney)",
            "[Healthcare directives](/healthcare-directives)",
            "[Probate](/probate)",
            "[Trust administration](/trust-administration)",
          ],
        },
      ],
    },
    {
      h: "Where we serve",
      blocks: [
        { p: `${SERVED_AND} only. Office: ${firm.officeAddress}. Consults by ${firm.consultFormat}.` },
      ],
    },
    {
      h: "What this site is",
      blocks: [
        { p: `${firm.brandName} is a referral website, not a law firm. When you contact us, we match you with an appropriate estate planning attorney in our network. That attorney gives the legal advice, and you decide whether to hire them. ${A} is the attorney responsible for this site. See [how we work](/legal/how-we-work), the [disclaimer](/legal/disclaimer) and our [editorial policy](/editorial-policy).` },
      ],
    },
  ],
  faqs: [
    { q: "Who will handle my matter?", a: `The attorney you are matched with. That may be ${A} or another estate planning attorney in our network. You know who it is before you sign an engagement agreement.` },
    { q: "What areas of law does this site not cover?", a: "This site covers estate planning only: wills, trusts, powers of attorney, healthcare directives, probate and trust administration. For other matters, such as divorce, criminal defense or personal injury, the state bar's lawyer referral service can help." },
    { q: "Which states does this site serve?", a: `${SERVED_AND} only. Attorneys in our network advise on the law of the state where they are licensed. We do not give legal advice about other states' laws.` },
    { q: "Can I meet before deciding?", a: `Yes. Consult fee: ${firm.consultFee}. See [how it works](/how-it-works).` },
    { q: "How do you keep my information private?", a: "Please do not send Social Security numbers, account numbers or medical details through the website or by text. The attorney you are matched with explains how to share documents safely. See [privacy](/legal/privacy)." },
  ],
  ctaTitle: "Talk to an attorney",
  ctaBody: "Take the two-minute questionnaire, or call and ask us. You get a flat-fee quote before anything is signed.",
  related: [
    { href: "/how-it-works", title: "How it works", kind: "Page" },
    { href: "/pricing", title: "Pricing", kind: "Page" },
    { href: "/editorial-policy", title: "How we review content", kind: "Page" },
    { href: "/learn/basics/what-is-estate-planning", title: "What is estate planning?", kind: "Guide" },
    { href: "/contact", title: "Contact", kind: "Page" },
  ],
};

export const MONEY_PAGES: Record<string, MoneyPageData> = {
  wills,
  "living-trusts": livingTrusts,
  "power-of-attorney": poa,
  "healthcare-directives": healthcare,
  probate,
  "trust-administration": trustAdmin,
  "estate-planning-for-parents": parents,
  "how-it-works": howItWorks,
  "about-the-attorney": aboutAttorney,
};
