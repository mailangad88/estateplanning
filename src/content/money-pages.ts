import { firm } from "@/config/firm";
import { FIGURES } from "@/config/figures";

/**
 * Copy for the service ("money") pages. Facts about the attorney, fees and state rules come from
 * src/config/firm.ts or stay as visible [Attorney: ...] / [Flat fee] placeholders; nothing here is invented.
 * Inline syntax: [text](/path), **bold**, [Attorney: ...] placeholder.
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
const FEE = "[Flat fee]";
const STATE_RULE = (what: string) => `[Attorney: ${what} in your state]`;

const wills: MoneyPageData = {
  path: "/wills",
  crumb: "Wills",
  title: "Wills: what they do, what they cannot do, and what they cost",
  description: "A will names who gets your property and who raises your children. How wills work, what they cannot do, and how our flat fee for drafting one works.",
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
        { p: `A will generally must be in writing, signed by you, and witnessed by adults who are not beneficiaries. The number of witnesses and whether a self-proving affidavit before a notary is available vary by state. ${STATE_RULE("witness count, self-proving affidavit and handwritten will rules")}. See [what makes a will valid](/guides/what-makes-a-will-valid).` },
      ],
    },
    {
      h: "What happens if you die without one",
      blocks: [
        { p: "Your state's intestacy law decides who inherits, in a fixed order that usually starts with a spouse and children. It may not match what you would have chosen, and it does not name a guardian for your children. See [what happens if you die without a will](/learn/wills/dying-without-a-will)." },
      ],
    },
    {
      h: "What we do when we draft your will",
      blocks: [
        {
          ol: [
            "We ask about your family, property, accounts and who you trust.",
            "We draft a will that fits your state's law, with a guardian nomination if you have minor children, and a plan for property you leave to a minor.",
            "We go over it with you, sign it with witnesses and a notary, and explain where to keep it.",
            "We point out which beneficiary forms to check, because those override the will.",
          ],
        },
        { p: `${A} drafts and signs off on every will we prepare. ${firm.yearsInPractice}` },
      ],
    },
    {
      h: "What it costs",
      blocks: [
        { p: `Our will-based package is called Essentials. It starts at ${FEE} for one person and ${FEE} for a couple. It includes [Attorney: confirm list, for example will, durable power of attorney, healthcare directive, one review meeting]. It does not include probate or tax return preparation. See [pricing](/pricing).` },
      ],
    },
  ],
  faqs: [
    { q: "Do I need a lawyer to make a will?", a: "No law says you must use one. People with minor children, a home, a blended family or a business often choose to, because mistakes in a will tend to show up after the person is gone, when they cannot be fixed." },
    { q: "Is a will enough, or do I need a trust?", a: "For many people a will is enough. A trust adds value for some people who own real estate, want to skip probate, or have beneficiaries who cannot manage money. The [will or trust comparison](/tools/will-or-trust) shows which way your answers point." },
    { q: "Is a handwritten or online will valid?", a: "It can be, but validity depends on your state's signing rules. A missing witness or signature is a common reason courts reject a document. See [online will vs estate attorney](/compare/online-will-vs-estate-attorney)." },
    { q: "Can I change my will later?", a: "Yes, by signing a new will or a formal amendment called a codicil, as long as you have the mental capacity to do so. Marriage, divorce, a new child and a move to another state are common reasons to review it. See [updating your estate plan](/learn/basics/when-to-update-your-estate-plan)." },
    { q: "Where should I keep my will?", a: `Somewhere your executor can find it quickly and that is safe from fire and loss. [Attorney: whether the firm stores originals]. Many people avoid putting the only original in a bank box that nobody else can open.` },
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
  description: "A revocable living trust can let your family skip probate on your home and accounts. What it does, what it does not do, and how our flat fee works.",
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
      h: "What we do",
      blocks: [
        {
          ol: [
            "Review your assets and family to decide whether a trust helps. If it does not, we say so.",
            "Draft the trust and a pour-over will that sweeps stray assets into it.",
            "Prepare your durable power of attorney and healthcare documents so the plan covers incapacity.",
            "Prepare the deed for your home and give you a funding checklist for bank, brokerage and beneficiary accounts. [Attorney: what funding help is included at each package level]",
            "Hold a signing meeting, with witnesses and a notary as your state requires.",
          ],
        },
        { p: `${A} drafts every trust. [Attorney: a true, checkable statement about trust experience]. We include funding instructions because an unfunded trust does not work.` },
      ],
    },
    {
      h: "What it costs",
      blocks: [
        { p: `Our trust-based package is called Complete. It starts at ${FEE} for one person and ${FEE} for a couple. A second property, a blended family, a business or a special needs provision moves the price. See [pricing](/pricing).` },
      ],
    },
  ],
  faqs: [
    { q: "What is the difference between a will and a living trust?", a: "A will takes effect at death and goes through probate. A living trust takes effect when you sign it and lets assets inside it pass without probate. A will is where guardians for children are named. See the table above and [will vs trust](/learn/trusts/will-vs-trust)." },
    { q: "Does a living trust avoid estate tax?", a: "No. A revocable trust is counted in your estate for tax purposes. Federal estate tax applies only above a high exemption, and some states have their own estate or inheritance tax. See [estate and inheritance taxes](/guides/estate-and-inheritance-taxes) and the [estate tax estimator](/tools/estate-tax-estimator)." },
    { q: "Do I lose control of my property?", a: "No. As trustee of a revocable trust you buy, sell and use property as you do now. You can change or cancel the trust whenever you have capacity." },
    { q: "Who should be my successor trustee?", a: "Someone trustworthy and organized who can handle paperwork and difficult family conversations. Many people name a child plus a backup, or a professional if no one fits. See [choosing a trustee](/learn/trusts/choosing-a-trustee) and [executor vs trustee](/compare/executor-vs-trustee)." },
    { q: "Do I have to put everything in the trust?", a: "No. Retirement accounts and life insurance usually stay out and pass by beneficiary form. Vehicles and small accounts often stay out too. We tell you which assets people usually move." },
    { q: "What does it mean to fund a trust, and who does it?", a: "Funding means changing ownership of an asset to the trust, such as recording a new deed for your house or retitling a bank account. We prepare the deed and instructions. Some steps, such as bank forms, you complete yourself." },
    { q: "Will my mortgage lender or insurer object if I move my home into a trust?", a: "Federal law generally prevents a lender from calling a loan due when a home goes into your own revocable trust, but people usually tell their insurer and title company. [Attorney: confirm for your state]" },
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
  urgent: { title: "Parent unwell right now?", body: "If this is urgent, call. We will tell you what is possible." },
  sections: [
    {
      h: "What an agent can and cannot do",
      blocks: [
        { p: "An agent can pay bills, manage bank and brokerage accounts, file taxes, deal with insurance and Medicare paperwork, sell or manage property, and run a business, to the extent your document allows. The powers are listed in the document, and some, such as making gifts or changing beneficiaries, may need to be spelled out. [Attorney: state rule on special powers]" },
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
        { p: "Many attorneys prefer immediate, with the original held until needed. [Attorney: this firm's practice and your state's rules on springing powers]" },
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
        { p: "It happens, and it is frustrating. A document written to your state's standards, notarized and shown to your bank ahead of time, reduces the chance. Some states penalize institutions that unreasonably refuse. [Attorney: state rule]" },
      ],
    },
    {
      h: "What we prepare",
      blocks: [
        {
          ul: [
            "Durable financial power of attorney with a successor agent",
            "Healthcare power of attorney and living will, in the same signing (see [healthcare directives](/healthcare-directives))",
            "HIPAA authorization",
            "A short letter to help your agent present the document to banks",
          ],
        },
        { p: `Included in our Essentials, Complete and Legacy packages. On its own: ${FEE}. See [pricing](/pricing). ${A} explains your agent's duties in the signing meeting.` },
      ],
    },
  ],
  faqs: [
    { q: "What is the difference between a power of attorney and a healthcare directive?", a: "A financial power of attorney is about money and property. A healthcare directive covers medical decisions. Most people sign both, often with different agents. See [living will vs healthcare power of attorney](/compare/living-will-vs-healthcare-power-of-attorney)." },
    { q: "When should I sign one?", a: "When you are healthy and clear-headed. Capacity is required to sign, and it can disappear suddenly through a stroke, an accident or dementia." },
    { q: "Can my agent take my money?", a: "They have a legal duty not to misuse it. You can add safeguards: a requirement to give accountings, a limit on gifts, or a second person who must approve large transactions. A trusted agent is still the main safeguard." },
    { q: "Does a power of attorney work after death?", a: "No. Authority ends at death. The executor named in your will, or your successor trustee, takes over. See [what happens to a power of attorney when you die](/blog/what-happens-to-a-power-of-attorney-when-you-die)." },
    { q: "Does my spouse automatically have this authority?", a: "Usually not. Marriage alone often does not allow a spouse to sell a solely owned asset or deal with accounts in your name. [Attorney: state rule]" },
    { q: "Is a power of attorney from another state valid here?", a: "Many states recognize out-of-state powers of attorney that were valid where signed, but local institutions may balk. If you have moved, it is common to have yours reviewed. [Attorney: state rule]" },
    { q: "My parent has dementia and no power of attorney. What now?", a: "A person with dementia may still be able to sign if they understand what the document does on that day. That is a legal question that depends on the person's capacity. If they cannot, the usual route is a guardianship or conservatorship. Call us and we will tell you what applies." },
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
              ["POLST or similar medical order [Attorney: name and availability in your state]", "A medical order signed by a clinician for people with a serious illness. Not a replacement for an advance directive"],
            ],
          },
        },
        { p: "State terms vary. [Attorney: terminology and statutory form in your state]" },
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
        { p: "[Attorney: witnesses required, notary optional or required, who cannot witness, and whether a statutory form exists in your state]. We prepare the documents to meet your state's requirements, and explain where to store copies and how to give them to your doctors." },
      ],
    },
    {
      h: "Cost",
      blocks: [
        { p: `Included in every package. On its own: ${FEE}. See [pricing](/pricing). We do not give medical advice. Talk to your doctor about your health, and we will make sure what you decide is written down in a way hospitals will accept. [Attorney: your approach to the signing meeting, in one honest sentence]` },
      ],
    },
  ],
  faqs: [
    { q: "What is the difference between a living will and a healthcare power of attorney?", a: "A living will describes the treatment you do or do not want. A healthcare power of attorney names a person who decides when situations arise that the living will did not foresee. Together they often work better than either alone. See [living will vs healthcare power of attorney](/compare/living-will-vs-healthcare-power-of-attorney)." },
    { q: "Do I need both?", a: "Many attorneys suggest both. The agent covers situations you could not predict. The living will helps your agent know what you would say." },
    { q: "Does the document need to be notarized?", a: "It depends on your state. Some require two witnesses, some a notary, some either. [Attorney: state rule]" },
    { q: "What if my family disagrees with my choices?", a: "Your agent and your written wishes control, subject to the law. Writing it down can prevent arguments, because your family sees that the decision was yours." },
    { q: "Can doctors ignore my directive?", a: "A doctor may decline on conscience grounds but generally must transfer your care to someone who will follow it. [Attorney: state rule] Give your agent and your doctor copies." },
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
        { p: "Not always. Property passes outside probate when it has a named beneficiary, is held jointly with survivorship, or is in a living trust. Many states offer a simplified process for small estates. [Attorney: small-estate limit in your state, with an as-of date]. See [probate vs non-probate assets](/learn/probate/probate-vs-non-probate-assets) and [can you skip probate for a small estate?](/blog/can-you-skip-probate-for-a-small-estate)" },
      ],
    },
    {
      h: "How probate works in five steps",
      blocks: [
        {
          ol: [
            "**File the will and petition** in the probate court in the county where the person lived.",
            "**The court appoints the executor** (the person named in the will) or an administrator if there is no will. They receive official authority papers.",
            "**Notify heirs and creditors.** Creditors have a limited window to make claims. [Attorney: creditor period in your state]",
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
        { p: "Delays usually come from missing documents, family disputes, real estate that must be sold, or creditor claims. Court filing fees and attorney fees vary by state. [Attorney: typical timeline, filing fees and attorney fee rules in your state, with sources]" },
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
        { p: "You usually do not need to hire anyone. In many states you can ask the executor for an inventory and updates. [Attorney: state rule]. If property seems mismanaged, we can talk through your options. We cannot represent both you and the executor in a dispute." },
      ],
    },
    {
      h: "Inheriting a house",
      blocks: [
        { p: "A house that goes through probate generally cannot be sold until the executor has authority. Heirs who inherit together decide whether to sell, keep, or buy each other out. See [who gets the house if there's no will and no spouse](/blog/who-gets-the-house-if-theres-no-will-and-no-spouse) and [what happens to a mortgage when the owner dies](/blog/what-happens-to-a-mortgage-when-the-owner-dies)." },
      ],
    },
    {
      h: "What we do for probate and what it costs",
      blocks: [
        { p: `[Attorney: whether the firm handles probate, and how it is billed: flat fee, tiered by estate size, hourly, or a statutory schedule. Remove this section if the firm does not do probate.] We would begin with a short consult to say whether probate is needed and what it will likely take. Consult fee: ${firm.consultFee}. Our engagement agreement states the scope and what is billed separately, such as court costs and appraisals. ${A} will tell you if the estate is small enough that you can handle it yourself.` },
      ],
    },
  ],
  faqs: [
    { q: "How long do I have to open probate?", a: "Many states require filing a will with the court within a set time after death, even if no probate is needed. [Attorney: deadline and penalties in your state]. Do not wait." },
    { q: "Can I pay the funeral bill from the person's bank account?", a: "Often the family pays first and is reimbursed by the estate, because accounts may be frozen. Keep every receipt. [Attorney: state rule]" },
    { q: "Am I personally responsible for the deceased's debts?", a: "Generally no, with exceptions such as a co-signer, a joint account holder, or community property in some states. Executors who distribute property before paying valid debts can become personally liable, so people commonly wait until the debts are known. See [what happens to debt when someone dies](/learn/probate/dealing-with-debts-in-probate)." },
    { q: "What if there is no will?", a: "The court appoints an administrator, usually a spouse or adult child, and state law decides who inherits. See [what happens if you die without a will](/learn/wills/dying-without-a-will)." },
    { q: "What if I think the will is invalid, or a sibling is hiding things?", a: "Talk to an attorney soon. Deadlines to contest a will are short in many states. [Attorney: contest period in your state]" },
    { q: "Can I avoid probate now that the person has died?", a: "Sometimes. If assets have a beneficiary or are jointly owned, they pass automatically. If the estate qualifies for a small-estate procedure, that may be used. We can help you check." },
    { q: "Do I have to hire the attorney who drafted the will?", a: "No. You choose the attorney. [Attorney: whether the estate pays an executor's counsel fees in your state]" },
    { q: "What does the first call cost, and what will you ask?", a: `Consult fee: ${firm.consultFee}. We will ask the date and county of death, whether there was a will, and a rough list of assets and debts. You do not need paperwork in hand.` },
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
        { p: "A trustee is a fiduciary. The law holds you to a high standard: act for the beneficiaries, not yourself; keep trust money separate from yours; keep records; communicate. Trustees are generally allowed reasonable compensation and to hire professionals at the trust's expense. [Attorney: state rule]. See [choosing a trustee](/learn/trusts/choosing-a-trustee)." },
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
            "Notify beneficiaries and, where your state requires, heirs, in writing. [Attorney: notice deadline and content in your state]",
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
        { p: "These ranges are common, not promises. [Attorney: confirm and adjust]" },
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
      h: "What we offer and what it costs",
      blocks: [
        { p: `[Attorney: services offered, such as full administration, guided administration where the trustee does the legwork and the firm reviews, or an hourly consult. Fee model for each. Remove what is not offered.] ${A} also writes trusts, so knows which provisions cause trouble. [Attorney: experience administering trusts, only if accurate]` },
        {
          table: {
            head: ["Service", "What it covers", "Fee"],
            rows: [
              ["Trustee consult", "One hour, written next-steps plan", FEE],
              ["Guided administration", "You do the tasks; we review notices, accountings and distributions", FEE],
              ["Full administration", "We handle notices, tax coordination, distributions and closing", FEE],
            ],
          },
        },
      ],
    },
  ],
  faqs: [
    { q: "Do I need a lawyer to be a trustee?", a: "Not legally. Practically, many trustees get advice for any trust with real estate, tax issues or disagreement. An hour with an attorney often costs less than a trustee mistake." },
    { q: "Does a living trust avoid probate entirely?", a: "For assets properly titled in the trust, yes. Assets outside it may still need probate. See [probate](/probate) and [funding your trust](/guides/funding-your-trust)." },
    { q: "Do I have to tell the beneficiaries?", a: "Usually yes, within a time frame set by your state's law. [Attorney: state rule]" },
    { q: "Can I pay myself?", a: "Reasonable compensation is generally allowed unless the trust says otherwise, but trustees keep records and are prepared to justify it." },
    { q: "How long will this take?", a: "Simple trusts can finish in months. Real estate sales, taxes and disputes extend it. [Attorney: typical range]" },
    { q: "What if a beneficiary is upset or demands money?", a: "Respond in writing, share the trust terms they are entitled to see, and avoid early payments. If a dispute escalates, call us before you reply." },
    { q: "What taxes apply?", a: "The trust may owe income tax. Inherited property generally gets a step-up in basis to its date-of-death value, which can reduce capital gains on a later sale. [Attorney: confirm]. See [estate and inheritance taxes](/guides/estate-and-inheritance-taxes)." },
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
        { p: `**Long-term care costs.** Some families plan years ahead for nursing home costs. Medicaid has a look-back period for gifts (${FIGURES.medicaidLookbackMonths} months in most states, California differs), and moving a house without advice can cause a penalty. See [Medicaid and long-term care planning](/learn/elder-care/medicaid-planning) and the [Medicaid look-back date tool](/tools/medicaid-lookback-date). [Attorney: whether this firm advises on Medicaid planning]` },
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
        { p: `${A} [Attorney: a personal or professional connection to this topic, only if true and shared willingly]. We will meet with you and your parents together if that helps.` },
      ],
    },
  ],
  faqs: [
    { q: "My parents refuse to talk about this. What can I do?", a: "Start small. Ask where their documents are kept, not what is in them. Offer to attend one meeting. Frame it around their wishes. If they still refuse, there is little that can be done legally, so keep a note of what you have asked." },
    { q: "Can I sign for my parent?", a: "Only if they have named you as agent in a signed power of attorney, or you have been appointed guardian by a court. Being a child does not give you the right." },
    { q: "How do we do this if my parent has early dementia?", a: "Capacity is not all or nothing. A person may be able to sign on a good day, and attorneys will assess it. A note from the doctor can help." },
    { q: "Does a power of attorney cost a lot?", a: `It is among the less expensive documents. Our flat fee is ${FEE} on its own, and it is included in each package. See [pricing](/pricing).` },
    { q: "Who should be our children's guardian?", a: "Someone with the values, health, energy and finances to raise them, and who has said yes. It does not have to be the richest relative. See [can I name my sister as guardian if my husband disagrees?](/blog/can-i-name-my-sister-as-guardian-if-my-husband-disagrees)" },
    { q: "What if I am divorced or a single parent?", a: "Your plan may matter more. The other parent normally keeps custody if you die unless a court finds otherwise. [Attorney: state rule]. Many single parents name guardians for the case where both parents cannot serve." },
    { q: "How often should parents update a plan?", a: "Every few years, and after any marriage, divorce, birth, move or large change in assets. See [updating your estate plan](/learn/basics/when-to-update-your-estate-plan)." },
    { q: "What if my parent lives in a different state?", a: "Documents should fit the state where your parent lives. [Attorney: states where the firm is licensed]. If your parent lives elsewhere, we can point you to the state bar's referral service. We do not receive referral fees." },
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
  description: `What happens when you hire ${firm.brandName} for estate planning: the questionnaire, the consultation, drafting, signing, and what to have ready.`,
  h1: `How estate planning works with ${firm.brandName}`,
  answer: `You start with a short questionnaire, then a call with a team member to book a consultation with ${A}. At the consultation the attorney recommends a plan and quotes a flat fee. If you hire us, we draft the documents, you review them, and you sign them with witnesses and a notary. Most clients finish in [Attorney: typical weeks from first call to signing].`,
  steps: [
    { name: "Questionnaire", text: "Answer questions about your family, property and goals on the plan finder." },
    { name: "Intake call", text: "A team member confirms the basics, checks for conflicts and books your consultation." },
    { name: "Consultation", text: "You talk with the attorney, who recommends a plan and gives a flat fee." },
    { name: "Engagement", text: "You sign an engagement agreement. This is when the attorney-client relationship begins." },
    { name: "Information gathering", text: "You complete a short questionnaire and share names, accounts and existing documents." },
    { name: "Drafting", text: "The attorney drafts your documents." },
    { name: "Review meeting", text: "You read the drafts and ask questions, and changes are made." },
    { name: "Signing", text: "Documents are signed in front of witnesses and a notary." },
    { name: "After signing", text: "You get copies and instructions to fund the trust, update beneficiaries and tell your agents." },
  ],
  urgent: { title: "Hospital, diagnosis or surgery coming up?", body: "Tell us on the first call. [Attorney: the firm's urgent process and turnaround]" },
  sections: [
    {
      h: "Step by step",
      blocks: [
        {
          table: {
            head: ["Step", "What happens", "Who", "How long"],
            rows: [
              ["1. Questionnaire", "You answer questions about your family, property and goals on the [plan finder](/plan-finder)", "You", "About 2 minutes"],
              ["2. Intake call", "A team member confirms the basics, checks for conflicts and books your consultation. They are not lawyers and do not give legal advice", "Our team", `[Attorney: call length], within ${firm.responseTime}`],
              ["3. Consultation", `You talk with ${A}: your family, what you own, what worries you. You get a recommendation and a flat fee`, A, `${firm.consultLength}, ${firm.consultFormat}`],
              ["4. Engagement", "You sign an engagement agreement and pay a deposit if one applies. This is when the attorney-client relationship begins", "You", "Same day if you decide then"],
              ["5. Information gathering", "A short questionnaire and document upload: names, account list, existing documents", "You", "[Attorney: time to complete]"],
              ["6. Drafting", `${A} drafts your documents`, A, firm.draftingTime],
              ["7. Review meeting", "You read the drafts and ask questions. Changes are made", `You and ${A}`, "[Attorney: meeting length]"],
              ["8. Signing", "Documents are signed in front of witnesses and a notary, as your state requires", "You, our team, a notary", "[Attorney: signing length]"],
              ["9. After signing", "You get copies and instructions: fund the trust, update beneficiaries, tell your agents", "You, with our help", "Varies"],
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
        { p: "It is a short conversation to check that we can help and book a time. It is not legal advice, and no attorney-client relationship begins until you sign an engagement agreement. Please do not send Social Security numbers, account numbers or medical details through the website or by text. We will tell you how to share documents safely later." },
      ],
    },
    {
      h: "How your information is used",
      blocks: [
        { p: "We use what you tell us to contact you and to prepare for your consultation. We do not sell your information. We contact you by phone, email or text only as you have agreed. Text messages are optional, and you can opt out any time by replying STOP. See [privacy](/legal/privacy), [text message terms](/legal/sms-terms) and [how we work](/legal/how-we-work)." },
      ],
    },
    {
      h: "What happens after you sign",
      blocks: [
        { p: "[Attorney: follow-up the firm offers, for example a check-up call after 12 months]. A baby, a move, a divorce or a diagnosis are common reasons to call. See [updating your estate plan](/learn/basics/when-to-update-your-estate-plan) and the [plan review reminder](/tools/plan-review-reminder)." },
        { p: `Everything is done by or under the supervision of ${A}. Team members schedule and organize. They do not give legal advice or draft documents without the attorney's review. [Attorney: confirm staffing description]` },
      ],
    },
  ],
  faqs: [
    { q: "Do I have to come to the office?", a: `Consultations are by ${firm.consultFormat}. Signing may be in person or by remote notarization where your state allows it. [Attorney: confirm]` },
    { q: "How long from first call to signing?", a: "[Attorney: usual range]. A faster schedule is possible when there is a real reason, such as a hospital stay." },
    { q: "What if I need to change something after signing?", a: "[Attorney: how many days of small changes are included]. After that, amendments are quoted separately." },
    { q: "Can my spouse come to the consult?", a: "Yes, and many couples attend together. Spouses who both sign an engagement agreement become joint clients, and we explain what that means for confidentiality. [Attorney: conflict language]" },
    { q: "Is what I tell you confidential?", a: "Information shared while seeking legal help is protected in most situations, even before you hire us. [Attorney: confirm for your state]. Share only what is needed on the first call." },
    { q: "What if I decide not to hire you?", a: "That is fine. You keep the recommendation. We will not pressure you. A team member may follow up once or twice at most. [Attorney: confirm cadence]" },
    { q: "What if I live outside the state you practice in?", a: "We can only advise on the law of the state where the attorney is licensed. [Attorney: licensed states]. Otherwise the state bar's referral service can help you find someone." },
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
  description: `${A} is an estate planning attorney (Bar No. ${firm.barNumber}). Background, education, how the attorney works with clients, and how to reach them.`,
  h1: `${A}, estate planning attorney`,
  schema: "profile",
  answer: `${A} is an attorney who [Attorney: practice focus, for example wills, living trusts, powers of attorney and the probate and trust administration that follow]. Has practiced since ${firm.yearsInPractice}, is licensed in ${firm.licensedState} (Bar No. ${firm.barNumber}), and personally reviews every plan this firm prepares. [Attorney: confirm every fact in this paragraph]`,
  sections: [
    {
      h: "Why this work",
      blocks: [{ p: "[Attorney: 80 to 150 words in your own words. What made you choose estate planning? What did you see early in your career that stays with you?]" }],
    },
    {
      h: "How I work with clients",
      blocks: [
        { p: "[Attorney: 80 to 150 words. What happens in the first meeting? How do you explain things to non-lawyers? What do you decline to do?]" },
        { p: "[Attorney: optional honest structure, for example: I say so if a trust is not needed; I quote a flat fee before you pay; I answer questions after signing for a stated period]" },
      ],
    },
    {
      h: "What I see go wrong",
      blocks: [{ p: "[Attorney: three to five real, anonymized patterns, for example the most common mistake, a plan that failed because of funding or beneficiary forms, a family disagreement a document could have prevented. No client-identifying detail.]" }],
    },
    {
      h: "Education and admission",
      blocks: [
        {
          table: {
            head: ["Item", "Detail"],
            rows: [
              ["Law school", firm.lawSchool],
              ["Undergraduate", "[Attorney: school]"],
              ["Admitted", `${firm.licensedState} Bar, ${firm.yearsInPractice}, Bar No. ${firm.barNumber}`],
              ["Other bars and courts", "[Attorney: list, or none]"],
              ["Memberships", "[Attorney: current bar sections and associations only]"],
              ["Publications or speaking", "[Attorney: list, or remove this row]"],
              ["Disciplinary record", "[Attorney: confirm before publishing anything here]"],
            ],
          },
        },
        ...(firm.barLookupUrl ? [{ p: `[Verify the license on the state bar website](${firm.barLookupUrl})` }] : [{ p: "[Attorney: link to the state bar's lawyer lookup, so visitors can verify the license]" }]),
      ],
    },
    {
      h: "Practice areas",
      blocks: [
        { p: "[Attorney: confirm this list and remove anything not offered]" },
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
      h: "Where I practice",
      blocks: [
        { p: `[Attorney: counties and courts]. Office: ${firm.officeAddress}. Consults by ${firm.consultFormat}. States where licensed: ${firm.licensedState} only, unless the attorney says otherwise.` },
      ],
    },
    {
      h: "Outside the office",
      blocks: [{ p: "[Attorney: optional, two sentences of personal detail you are comfortable sharing]" }],
    },
    {
      h: "Our team",
      blocks: [{ p: "[Attorney: names and roles of staff who speak to clients. They are not attorneys and work under the attorney's supervision.]" }],
    },
    {
      h: "What this site is",
      blocks: [
        { p: `This site is the marketing and intake arm of ${firm.firmLegalName}. Everyone who contacts us through it is speaking to the practice of ${A}. We do not pay for referrals or share fees with non-lawyers. [Attorney: confirm this is accurate for the launch structure]. See [how we work](/legal/how-we-work), the [disclaimer](/legal/disclaimer) and our [editorial policy](/editorial-policy).` },
      ],
    },
    {
      h: "Reviews",
      blocks: [{ p: "[Attorney: link to an independent profile, such as a Google Business Profile or Avvo, only if one exists and is in good standing. We show no star ratings on this site, and use testimonials only where state rules allow, with written consent.]" }],
    },
  ],
  faqs: [
    { q: `Does ${A} handle every case personally?`, a: "[Attorney: your honest answer, for example that you draft and review every document and staff schedule and assist]" },
    { q: "What areas of law do you not handle?", a: "[Attorney: for example divorce, criminal defense, personal injury]. We can point you to the state bar's referral service, and we receive no fee for referrals." },
    { q: "Are you licensed outside your home state?", a: "[Attorney: answer]. We do not give legal advice about other states' laws." },
    { q: "Can I meet before deciding?", a: `Yes. Consult fee: ${firm.consultFee}. See [how it works](/how-it-works).` },
    { q: "How do you keep my information private?", a: "[Attorney: your systems, for example encrypted upload and no sensitive data by email]. See [privacy](/legal/privacy)." },
  ],
  ctaTitle: `Meet ${A}`,
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
