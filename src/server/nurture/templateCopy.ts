/**
 * Seed copy for nurture message templates, one per step templateKey that has written copy.
 * Source: research/nurture-sequences.md (drafted for attorney review). Nothing here is sendable until
 * an attorney approves the exact text (see templates.ts); editing any word changes the content hash and
 * needs a new approval.
 *
 * Placeholders are limited to PLACEHOLDERS. Merge fields the research uses that have no placeholder
 * (consult date and time, firm phone, state, fee statement, quiz link) were removed or reworded, and
 * state-specific [STATE] sentences were left out for the attorney to add.
 */
import { firm } from "@/config/firm";
import { EDUCATIONAL_DISCLAIMER } from "@/server/nurture/compliance";

export const PLACEHOLDERS = [
  "firstName",
  "firmName",
  "attorneyName",
  "bookingUrl",
  "unsubscribeUrl",
  "resourceUrl",
  "reviewUrl",
  "portalUrl",
] as const;
export type PlaceholderName = (typeof PLACEHOLDERS)[number];

export interface TemplateCopy {
  /** The step templateKey in src/server/nurture/sequences.ts */
  key: string;
  channel: "email" | "sms";
  /** Email only */
  subject?: string;
  /** Plain text. Lines holding a placeholder with no value are dropped at render time. */
  body: string;
  /** Where the copy came from, shown to the approving attorney. */
  source: string;
}

export const OPT_OUT = "Reply STOP to opt out.";

/** CAN-SPAM footer: postal address, unsubscribe link and why the person is receiving it. */
const MARKETING_FOOTER = [
  "{{firmName}}, " + firm.officeAddress,
  "You are receiving this because you asked for information on our website. Unsubscribe: {{unsubscribeUrl}}",
  EDUCATIONAL_DISCLAIMER,
].join("\n");

const CLIENT_FOOTER = [
  "{{firmName}}, " + firm.officeAddress,
  "You are receiving this because of your relationship with {{firmName}}. Unsubscribe: {{unsubscribeUrl}}",
  EDUCATIONAL_DISCLAIMER,
].join("\n");

const SIGN = "{{attorneyName}}\n{{firmName}}";

function email(key: string, subject: string, body: string, source: string, kind: "marketing" | "client" = "marketing"): TemplateCopy {
  return { key, channel: "email", subject, body: `${body.trim()}\n\n--\n${kind === "client" ? CLIENT_FOOTER : MARKETING_FOOTER}`, source };
}
function sms(key: string, body: string, source: string): TemplateCopy {
  return { key, channel: "sms", body: body.trim(), source };
}

const SRC = "nurture-sequences.md";

export const TEMPLATE_COPY: TemplateCopy[] = [
  // ---- Quiz follow-up (Sequence A) ----
  email("qz_1_results", "Your plan finder results, {{firstName}}", `
Hi {{firstName}},

Thank you for taking the plan finder. I am {{attorneyName}}, and I read these results myself, or our team does and brings anything urgent to me.

Your results list the topics people in a similar situation commonly discuss with an estate planning attorney. This is general information based on a few multiple-choice answers. It is not advice about your family, and the right plan depends on facts the quiz cannot see and on your state's law.

If you would like to talk it through, you can pick a time here: {{bookingUrl}}
There is no obligation, and you do not need paperwork in hand.

If you would rather read first, the next few emails explain the basics, one at a time.

${SIGN}`, `${SRC} A1`),

  email("qz_2_home", "Will or living trust? A fair comparison", `
Hi {{firstName}},

You said you own a home, or property in more than one state, or have meaningful assets. People in that position often ask whether they need a living trust.

Honest answer: sometimes. A revocable living trust can let your family avoid probate for assets held in it, keep things private, and set up management if you become incapacitated. It also costs more to set up, and it only works for assets that are actually moved into it. Some families are well served by a will plus beneficiary designations. Whether probate is slow or costly depends heavily on your state's rules and the size of your estate.

Owning real estate in another state can mean a second probate there, which is one reason owners of such property ask about trusts.

Comparison guide: {{resourceUrl}}
Want to talk through which fits? {{bookingUrl}}

${SIGN}`, `${SRC} A2-LIVING-TRUST (homeowner track)`),

  email("qz_2_business", "What happens to your business if you cannot run it", `
Hi {{firstName}},

Owners often have a good business plan and an incomplete personal one. If you were suddenly unable to work, who could sign, pay employees, or talk to the bank? If you died, what does your operating agreement or partnership agreement say, and does it match your will or trust?

People often discuss successor management and powers of attorney that cover business interests, buy-sell terms with partners, how ownership is titled, and whether a trust should hold the business interest.

Tax and valuation questions are worth coordinating with your CPA, and I am glad to do that with you.

Overview: {{resourceUrl}}
To talk: {{bookingUrl}}

${SIGN}`, `${SRC} A2-BUSINESS`),

  email("qz_2_general", "A will, a power of attorney, and a healthcare directive", `
Hi {{firstName}},

For most adults, the starting set is three documents:

1. A will: who receives your property, who handles your estate, and, if you have minor children, who you would want as guardian.
2. A financial power of attorney: who can pay bills and manage accounts if you cannot.
3. A healthcare directive: who speaks for you on medical decisions, and what you would want.

If you already have a will, a common question is whether an older one still fits your situation, especially after a move, marriage, divorce, birth, or a change in what you own. That is worth a short review.

The plain-English guide: {{resourceUrl}}
Ready to talk? {{bookingUrl}}

${SIGN}`, `${SRC} A2-WILL (general track)`),

  email("qz_3_cost", "How our process works, and what it costs", `
Hi {{firstName}},

One reason people put this off is not knowing what the process looks like or what it costs. Here is how it works at our office:

1. A first conversation. We listen, ask questions, and explain the options that fit your situation.
2. A written fee quote before you decide.
3. We draft your documents. You review them and ask questions.
4. A signing meeting, with the witnesses and notary your state requires.
5. We send you instructions for storing the documents and, if you have a trust, for moving assets into it.

If you want a number for your situation, the first conversation is the way to get it: {{bookingUrl}}

${SIGN}`, `${SRC} A4 (fee and timeline statements left out until the attorney supplies them)`),

  email("qz_4_mistakes", "Four things people get wrong with beneficiary forms", `
Hi {{firstName}},

The most common surprise I see: people assume their will controls everything they own. It does not.

- Retirement accounts and life insurance go to whoever is named on the beneficiary form, whatever the will says.
- Jointly owned property usually passes to the surviving owner.
- Property held in a trust follows the trust.
- A will only controls what is in your name alone, and it usually goes through probate.

The practical takeaway is that the documents, the beneficiary forms, and how things are titled should agree with each other.

We put together a one-page checklist that walks through this: {{resourceUrl}}

${SIGN}`, `${SRC} A5`),

  email("qz_5_book", "A short conversation can save a long headache", `
Hi {{firstName}},

Here is what a first meeting looks like. We ask about your family, what you own, and what you want to happen. I explain the options in plain language and answer your questions. You do not need to decide anything on the call.

It helps to have, but do not delay the meeting if you do not: a rough list of assets and debts, any existing will, trust or powers of attorney, beneficiary forms for retirement accounts and life insurance, and the names of people you are considering as guardian, executor or trustee.

If you would like to book, here is the link: {{bookingUrl}}

${SIGN}`, `${SRC} B5 and C1 "what to expect"`),

  // ---- Life-event tracks ----
  email("le_blended_family_1", "Planning when your family spans more than one marriage", `
Hi {{firstName}},

With children from earlier relationships, a simple "everything to my spouse" plan can leave kids from a prior marriage with nothing, depending on what the spouse later decides. People often want something more specific.

Common topics: using a trust so a spouse can live in the home or receive income for life while the remainder goes to your children, naming a trustee who is neutral, deciding what happens if the surviving spouse remarries, and making sure beneficiary forms match the plan.

None of that is right for everyone. It is about making choices on purpose.

Overview: {{resourceUrl}}
To talk about your situation: {{bookingUrl}}

${SIGN}`, `${SRC} A2-BLENDED`),

  email("le_caregiver_3", "Planning ahead for long-term care costs", `
Hi {{firstName}},

Long-term care is expensive, and the rules about paying for it are confusing. A few facts to start from:

- Medicare generally does not pay for long-term custodial care.
- Medicaid does, but it has income and asset limits and a look-back period, five years in most states, so recent transfers can cause a penalty.
- Because of the look-back, planning earlier usually gives more options than planning in a crisis.

Families commonly ask about powers of attorney that allow gifting, certain trusts, protecting a spouse who stays at home, and what to do if a parent needs care soon.

Do not move assets or change titles before you talk to an attorney. Doing it wrong can make things worse.

Overview: {{resourceUrl}}
To talk: {{bookingUrl}}

${SIGN}`, `${SRC} A2-ELDER (state specifics left out until the attorney supplies them)`),

  // ---- Consult booked (Sequence C) ----
  email("cb_confirm_email", "You are booked: here is what to expect", `
Hi {{firstName}},

Your consultation with {{attorneyName}} is booked. The date, time and how to join are in your calendar invitation.

What to expect: we will ask about your family, what you own, and what you want to happen. I will explain options in plain language and answer your questions. You do not need to decide anything on the call.

Helpful to have, but do not delay the meeting if you do not: a rough list of assets and debts, any existing will, trust or powers of attorney, beneficiary forms for retirement accounts and life insurance, and the names of people you are considering as guardian, executor or trustee.

Need to reschedule? {{bookingUrl}}

Nothing said in scheduling messages creates an attorney-client relationship. That begins when we sign an engagement agreement. Please do not send confidential details by text or by replying to this email.

${SIGN}`, `${SRC} C1 (date, time and phone omitted: no placeholder for them)`, "client"),

  sms("cb_confirm_sms", `Hi {{firstName}}, you are booked with {{firmName}}. Your date and time are in your confirmation email. Need to change it? {{bookingUrl}} ${OPT_OUT}`, `${SRC} C1 SMS`),

  email("cb_prep_checklist", "Five-minute prep for your consultation", `
Hi {{firstName}},

A little preparation makes the first conversation more useful. None of it is required.

- A rough list of assets and debts.
- Any existing will, trust or powers of attorney.
- Beneficiary forms for retirement accounts and life insurance.
- The names of people you are considering as guardian, executor or trustee. We need the names of the key people to run a standard conflict check.

Please use the secure form rather than email attachments: {{portalUrl}}

${SIGN}`, `${SRC} C2`, "client"),

  email("cb_remind_24h_email", "Tomorrow: your consultation", `
Hi {{firstName}},

A reminder that your consultation is tomorrow. The time and how to join are in your calendar invitation.

Need to reschedule? {{bookingUrl}}

${SIGN}`, `${SRC} C3 email`, "client"),

  sms("cb_remind_24h_sms", `Reminder from {{firmName}}: your consultation is tomorrow. Details are in your calendar invitation. Reschedule: {{bookingUrl}} ${OPT_OUT}`, `${SRC} C3 SMS`),

  sms("cb_remind_2h_sms", `{{firstName}}, see you at your consultation today. Reply here if you are running late. ${OPT_OUT}`, `${SRC} C4`),

  // ---- No-show recovery ----
  sms("ns_sms_same_day", `Hi {{firstName}}, we missed you just now. No problem at all. Want to reschedule? {{bookingUrl}} ${OPT_OUT}`, `${SRC} C6`),

  email("ns_email_d1", "We missed you today. Here is an easy way to rebook", `
Hi {{firstName}},

We had you down for your consultation today and did not connect. Things come up, and there is nothing to apologize for. If you still want to talk, you can pick a new time here: {{bookingUrl}}

If something has changed, such as a family situation or a health event, reply to this email and we will find time sooner.

${SIGN}`, `${SRC} C7`),

  email("ns_email_d7", "I will stop reaching out for now", `
Hi {{firstName}},

I will not keep following up. If you would like to pick this back up, the link below always works: {{bookingUrl}}

${SIGN}`, `${SRC} C10`),

  // ---- Consult held, not signed (Sequence D) ----
  email("ch_objection_cost", "How are you feeling about the plan, {{firstName}}?", `
Hi {{firstName}},

It has been a little while since we talked. Most people who meet with me are somewhere between "I want this done" and "I am not sure about the cost or the details." Both are normal.

If cost is the hold-up, tell me. There are sometimes ways to phase the work, for example power of attorney and healthcare documents first and a trust later. If you are unsure about the design, I am happy to do a short follow-up call.

Reply with a word or two, or book a 15-minute check-in: {{bookingUrl}}

${SIGN}`, `${SRC} D1`),

  // ---- Onboarding (Sequence E) ----
  email("so_welcome", "Welcome to {{firmName}}, {{firstName}}", `
Hi {{firstName}},

Thank you for trusting us with this. Here is what to expect:

1. Within a day, you will get a link to a short questionnaire. It covers family, assets and your wishes. You can save and return.
2. We draft your documents.
3. We go through the drafts together, by call or meeting.
4. We schedule a signing, with the witnesses and notary your state requires.

Your portal: {{portalUrl}}

A request: please do not email sensitive details such as Social Security or account numbers. Use the portal.

Thank you,
${SIGN}`, `${SRC} E1 (turnaround times and staff contact omitted until the firm supplies true figures)`, "client"),

  email("so_doc_checklist", "Your questionnaire is ready", `
Hi {{firstName}},

Your questionnaire is in your portal: {{portalUrl}}

To fill it in, it helps to gather the types of accounts you hold, approximate values, how each is titled, and your beneficiary forms. Approximate numbers are fine. Your choices can be changed when you review the drafts.

${SIGN}`, `${SRC} E2`, "client"),

  sms("so_docs_nudge", `Hi {{firstName}}, {{firmName}} here. Your questionnaire is waiting in your portal: {{portalUrl}} Want to do it by phone instead? Reply YES. ${OPT_OUT}`, `${SRC} E3 SMS`),

  // ---- Plan complete (Sequence F) ----
  email("pc_funding_guide", "Your trust only works if it holds your assets. Here is your checklist", `
Hi {{firstName}},

Signing the trust is step one. Step two is funding it, which means retitling assets into the trust's name. A signed trust with nothing in it will often not do what you hoped.

This first note covers what to do first:

- Real estate: we prepare and record the deed for your home, if it is included in our engagement.
- Bank and brokerage accounts: call your institution and ask for their trust funding or retitling process. They usually need a certification of trust, which we have given you.
- Do not retitle retirement accounts (IRA, 401(k)) into the trust without advice. These usually stay as they are, with beneficiary designations reviewed.
- Life insurance: beneficiary changes are common, but check with us first.

Full checklist: {{resourceUrl}}
Need hands-on help? {{bookingUrl}}

${SIGN}`, `${SRC} F4`, "client"),

  email("pc_referral_ask", "If someone you know is putting this off", `
Hi {{firstName}},

One thing I have learned: people often put off estate planning until something forces the issue. If a friend, parent or sibling comes to mind, you are welcome to share my contact information. There is no reward and no obligation either way.

I appreciate you reading, and thank you again for trusting us with your plan.

${SIGN}`, `${SRC} F11 (no incentive, by rule)`, "client"),

  // ---- Review request (Sequence F2/F3) ----
  email("rr_email_t14", "A small favor, only if you feel like it", `
Hi {{firstName}},

If you were comfortable with how we worked together, you are welcome to share your experience on Google: {{reviewUrl}}

It helps other families who are looking for an estate planning attorney. It is completely optional, and we do not offer anything in return. Please do not include personal or confidential details in your review. Whatever you decide, thank you for letting us help.

${SIGN}`, `${SRC} F2 (same email to every client; no incentive, no gating)`, "client"),

  sms("rr_reminder_sms_t21", `Hi {{firstName}}, {{firmName}}. If you would like to leave a review, it is optional and appreciated: {{reviewUrl}} Please do not share confidential details. ${OPT_OUT}`, `${SRC} F3`),

  // ---- Long term ----
  email("lt_life_changed", "Life changes. Plans should too.", `
Hi {{firstName}},

Here is a short list of events that usually mean it is time to revisit an estate plan: a birth, a marriage or divorce, a move, a new home, a business sale, a new diagnosis, or the death of someone you named as executor.

If any of these have happened since we talked, it may be time. If nothing has changed, no action is needed.

To book a 15-minute update call: {{bookingUrl}}

${SIGN}`, `${SRC} D3 and F12`),

  // ---- Annual review ----
  email("ar_offer", "A yearly check-in on your plan", `
Hi {{firstName}},

It has been about a year since you signed. Plans usually need small updates, not big ones. Things worth checking: births, marriages, divorces and deaths, a move to a new state, new real estate, a business started or sold, a change in health, whether your trustee, executor and guardian choices still feel right, and whether new accounts were funded or named correctly.

If nothing has changed, no action is needed. If something has, book a short review: {{bookingUrl}}

${SIGN}`, `${SRC} F9/F10 (fee statement left out until the attorney supplies it)`, "client"),

  // ---- After a death (Sequence G) ----
  email("g1_condolence", "I am sorry for your loss", `
Dear {{firstName}},

I am very sorry for your loss. I know this is a hard time, and that there is probably a lot of paperwork on top of it.

You do not need to rush into any decisions today. If it would help, I would be glad to talk. You are welcome to bring any documents you have: a will, trust or other papers. If there is a deadline that is close, we can look at that first.

Reply here and I will call you at a time that suits you, or you can pick a time: {{bookingUrl}}

With sympathy,
${SIGN}`, `${SRC} G1 (fee statement and phone omitted)`, "client"),

  sms("g_sms_1", `Hi {{firstName}}, this is {{attorneyName}} at {{firmName}}. I am sorry for your loss. When you are ready, I am glad to talk. Reply here or use {{bookingUrl}} No rush. ${OPT_OUT}`, `${SRC} G-SMS-1`),

  email("g2_first_weeks", "A short list for the first few weeks", `
Dear {{firstName}},

I want to share a short list people often find helpful. It is general. Details depend on your state and on how things were owned.

- Get several certified copies of the death certificate. Banks and agencies usually ask for them.
- Locate the original will or trust. Do not throw away papers, and do not remove items from the home without noting them.
- Keep paying critical bills such as the mortgage, insurance and utilities, if you can.
- If there is a will, it generally has to be filed with the court, and some states set a short period to do that. If you are named as the executor or trustee, you can ask for help to understand your duties.
- Avoid moving large sums or paying out inheritances before you understand creditor and tax obligations.
- If you are worried about timing, reach out. Some deadlines, such as notifying the court or an insurer, can be short.

If you would rather not do this alone, I am here. Reply to this email.

${SIGN}`, `${SRC} G2`, "client"),

  email("g3_probate", "What probate is, and how long it usually takes", `
Dear {{firstName}},

Probate is the court process that confirms who is in charge of someone's estate and who receives what. Whether it is needed depends on what the person owned, how each asset was titled, and whether there was a trust. The executor, sometimes called the personal representative, carries out the process, and the usual costs are court fees, attorney fees and appraisals. How long it takes varies by state and by estate.

If you would like me to look at the actual documents and tell you what applies, reply to this email.

${SIGN}`, `${SRC} G3 (state timeline left out until real data is chosen)`, "client"),

  email("g4_trust_vs_probate", "Probate or trust administration: what is the difference?", `
Dear {{firstName}},

If the person had a trust, a trustee manages and distributes what the trust holds, often without a court process. A trustee has legal duties: notifying beneficiaries, keeping records, getting tax identification numbers, and giving an accounting. Trust administration is often, but not always, quicker and more private than probate.

An attorney can help you understand those duties. If you would like to talk, reply to this email.

${SIGN}`, `${SRC} G4`, "client"),

  email("g5_check_in", "Checking in", `
Dear {{firstName}},

I wanted to check in, with no agenda. If you have questions about where things stand, or if anything is stuck, I am glad to talk. If you have already found help, I am glad of that too.

${SIGN}`, `${SRC} G5`, "client"),

  email("g6_deadlines", "Taxes and creditor notices: when to ask a professional", `
Dear {{firstName}},

Some questions are worth asking a professional, such as an attorney or CPA: the estate's income tax return, the person's final personal income tax return, and notices to creditors. The IRS publishes Form 56 to tell it who is acting for an estate.

I am glad to coordinate with your CPA. Reply to this email if you would like to talk.

${SIGN}`, `${SRC} G6`, "client"),

  email("g7_last_note", "One last note", `
Dear {{firstName}},

I will not keep writing. My door is open whenever you want to talk: {{bookingUrl}}

${SIGN}`, `${SRC} G7`, "client"),

  // ---- Guide download follow-up (Sequence B) ----
  email("mg_1_delivery", "Your guide is ready (download inside)", `
Hi {{firstName}},

Here is your guide: {{resourceUrl}}

A tip for using it: print it, grab a pen, and fill in what you can in 20 minutes. The blanks you cannot fill in are usually the useful ones to bring to an attorney.

${SIGN}`, `${SRC} B1 (guide name and quiz link omitted: no placeholder for them)`),

  email("mg_4_explainer", "The difference between probate and a trust, in one minute", `
Hi {{firstName}},

Here is a short video with no jargon: {{resourceUrl}}

- Probate is the court process that applies to property in your name alone.
- A trust holds property it has been funded with, and it follows the trust's terms.
- Which fits depends on your family, your property and your state.

${SIGN}`, `${SRC} B4`),

  email("mg_5_consult", "A short conversation can save a long headache", `
Hi {{firstName}},

Here is what a first meeting looks like. We ask about your family, what you own and what you want to happen. I explain the options in plain language and answer your questions. You do not need to decide anything on the call.

It helps to have a list of assets, beneficiary forms, any existing documents and the names of people you are thinking about naming. To book: {{bookingUrl}}

${SIGN}`, `${SRC} B5`),
];

const BY_KEY = new Map(TEMPLATE_COPY.map((t) => [t.key, t]));

export function getTemplateCopy(key: string): TemplateCopy | undefined {
  return BY_KEY.get(key);
}
