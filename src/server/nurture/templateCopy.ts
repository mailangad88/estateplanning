/**
 * Seed copy for nurture message templates, one per step templateKey that has written copy.
 * Source: research/nurture-sequences.md (drafted for attorney review). Nothing here is sendable until
 * an attorney approves the exact text (see templates.ts); editing any word changes the content hash and
 * needs a new approval.
 *
 * Placeholders are limited to PLACEHOLDERS. Merge fields the research uses that have no placeholder
 * (consult date and time, firm phone, state, fee statement, quiz link) were removed or reworded, and
 * state-specific sentences were left out for the attorney to add.
 */
import { SERVED_AND, SERVED_OR, firm } from "@/config/firm";
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
/** Copy drafted in the Brevo setup work (2026-10-31); attorney approval pending like every template. */
const DRAFT = "draft 2026-10-31";
const NET_SIGN = "The {{firmName}} team";

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
  // ---- Drafted 2026-10-31 for attorney review: booking, after-consult, welcome, calculator ----
  email("cb_questionnaire", "A short questionnaire before your call", `
Hi {{firstName}},

Before your consultation, please fill in the short questionnaire in your secure portal. It asks about the people in your family, what you own in broad terms, and any documents you already have. It takes about 15 minutes, and you can save and come back.

Your answers let the attorney spend the call on your questions instead of on basics.

Questionnaire: {{portalUrl}}

If anything in it is unclear, leave it blank. We will go over it together.

${SIGN}`, `${DRAFT} C questionnaire`, "client"),

  email("ch_objection_timing", "Is now the wrong time, {{firstName}}?", `
Hi {{firstName}},

When people tell me "not now," it usually means one of three things: a busy season, a family conversation that has not happened yet, or a feeling that the plan can wait until life settles.

All three are fair. Two things are worth knowing. You can sign the most important documents first, such as powers of attorney and a will, and add the rest later. And nothing you decide now is fixed: plans are updated as life changes.

If you would like to pick a later date to revisit this, reply with the month and I will hold onto your notes until then. Or book a short call: {{bookingUrl}}

${SIGN}`, `${DRAFT} D3`),

  email("ch_close", "Closing the loop on your plan", `
Hi {{firstName}},

I have not heard back, so I will stop following up about the proposal after this note.

Some people decide to use online forms instead, and for a simple situation that can work. If you go that way, check that the will is signed with the witnesses your state requires, that your beneficiary forms match what the will says, and that someone you trust knows where the documents are kept.

If you change your mind, my calendar is here: {{bookingUrl}}
You will still get an occasional newsletter. You can unsubscribe at any time with the link below.

${SIGN}`, `${DRAFT} D4`),

  email("wl_1_how_it_works", "How {{firmName}} works", `
Hi {{firstName}},

Thanks for reaching out. Here is how we work, so you know what to expect.

{{firmName}} is an estate planning referral network for ${SERVED_AND}. We do not give legal advice ourselves. We learn a little about your situation and match you with an estate planning attorney licensed in your state who handles that kind of work.

What happens next:
1. We review what you sent us.
2. We suggest an attorney and set up a first call.
3. You decide whether to work with them. There is no obligation.

If you would rather pick a time now: {{bookingUrl}}

The {{firmName}} team`, `${DRAFT} welcome 1`),

  email("wl_2_core_documents", "The documents most plans start with", `
Hi {{firstName}},

Most estate plans start with the same few documents. Here they are in plain words.

- A will says who receives what you own and, if you have young children, who you would want to raise them.
- A financial power of attorney names someone to handle money and paperwork if you cannot.
- A healthcare power of attorney names someone to make medical decisions if you cannot speak for yourself.
- A living trust is optional. Some families use one to keep assets out of probate court or to manage what young beneficiaries receive.

Which of these you need depends on your family and on ${SERVED_OR} law. That is what the first call with an attorney is for.

Read more: {{resourceUrl}}

The {{firmName}} team`, `${DRAFT} welcome 2`),

  email("wl_3_free_tools", "Free tools to get organized first", `
Hi {{firstName}},

If you are not ready to talk to an attorney yet, you can still make progress on your own. Our free tools take a few minutes each:

- The plan finder asks a few questions and lists the documents people in a similar situation usually discuss.
- The will or trust tool compares the two side by side for your state.
- The checklists help you list accounts, policies and the people you would name.

Start here: {{resourceUrl}}

Whatever you put together will make your first call shorter and more useful.

The {{firmName}} team`, `${DRAFT} welcome 3`),

  email("wl_4_book", "What a first call covers", `
Hi {{firstName}},

A first call with an attorney in our network usually covers three things:

1. Your family and what you want to happen.
2. Which documents fit, and why.
3. The attorney's fee for that work, in writing, before you decide.

You do not need to bring anything. If you have an old will or beneficiary forms, they help, but they are not required.

Pick a time: {{bookingUrl}}

The {{firmName}} team`, `${DRAFT} welcome 4`),

  email("calc_1_result", "About your result, {{firstName}}", `
Hi {{firstName}},

Thanks for using the tool on our site. A quick word on what your result means.

The tool works from a few answers and general rules for your state. It is a starting point, not a review of your situation. Real answers depend on how your accounts are titled, who is named on beneficiary forms, and family details a short form cannot see.

If you want an attorney licensed in your state to look at the real picture, we can set that up: {{bookingUrl}}

Over the next two weeks we will send a few short notes on what usually changes the answer.

The {{firmName}} team`, `${DRAFT} calculator 1`),

  email("calc_2_what_moves_it", "What changes the answer most", `
Hi {{firstName}},

When people run the numbers on a plan, a few facts tend to change the result more than anything else:

- How each asset is titled. Accounts with a named beneficiary or a joint owner often pass outside probate.
- Real estate in more than one state, which can mean a second court process.
- Whether the beneficiary forms on retirement accounts and life insurance are up to date.
- Young children or adult children who would need help managing an inheritance.

Checking these takes an afternoon and is often the most useful thing you can do this month.

Checklist: {{resourceUrl}}

The {{firmName}} team`, `${DRAFT} calculator 2`),

  email("calc_3_plan_finder", "Try the plan finder next", `
Hi {{firstName}},

The tool you used looks at one question. The plan finder looks at the whole picture: family, home, accounts and what you want to happen. It takes about three minutes and lists the topics people in a similar situation usually discuss with an attorney.

Plan finder: {{resourceUrl}}

The {{firmName}} team`, `${DRAFT} calculator 3`),

  email("calc_4_book", "Want an attorney to check it?", `
Hi {{firstName}},

Online tools are good for a first look. An attorney can tell you what actually applies to your family under ${SERVED_OR} law.

A first call usually covers what you want to happen, which documents fit, and the fee for that work in writing before you decide. There is no obligation.

Pick a time: {{bookingUrl}}

The {{firmName}} team`, `${DRAFT} calculator 4`),


  // ---- Drafted 2026-10-31: life-event tracks, guide and quiz gaps, onboarding, reactivation ----
  email("stl_email_confirm", "We got your request, {{firstName}}", `
Hi {{firstName}},

Thanks for reaching out. We have your request and someone from our team will call you soon, usually within one business day.

Here is what happens next:
1. We call to learn a little about your family and what you want to get done.
2. We match you with an estate planning attorney licensed in your state who handles that kind of work.
3. You meet with the attorney and decide whether to go ahead. There is no obligation.

If you would rather pick a time yourself, the calendar is here: {{bookingUrl}}

Please do not send documents or sensitive details by email. The attorney will give you a secure way to share them.

The {{firmName}} team`, `${DRAFT} speed to lead email`),

  email("qz_2_guardianship", "Who would raise your children?", `
Hi {{firstName}},

You told us you have young children. For most parents, the most important line in a will is the one that names a guardian.

If both parents die without naming one, a judge decides who raises the children. The court will listen to family members, but it does not know what you would have wanted unless it is written down.

A few things parents usually think through:

- Who would raise the children day to day, and who is the backup?
- Should the same person manage the money, or someone else?
- At what age should the children get control of what you leave them?

You do not need to have perfect answers. A first draft you can change later is far better than no plan.

Guardian checklist: {{resourceUrl}}
Book a call: {{bookingUrl}}

The {{firmName}} team`, `${DRAFT} quiz A2 guardianship`),

  email("mg_2_one_thing", "The one item to do this week", `
Hi {{firstName}},

The guide you downloaded has a lot in it. If you only do one thing this week, make it this: check the beneficiary forms on your retirement accounts and life insurance.

Those forms usually decide who receives the money, even if your will says something different. People often find an ex-spouse, a parent who has passed, or no one at all listed.

It takes about 20 minutes. Log in to each account or call the plan, look at who is named as primary and contingent beneficiary, and write it down next to the account.

If what you find does not match what you want, that is a good thing to bring to a first call with an attorney.

Your guide: {{resourceUrl}}
Book a call: {{bookingUrl}}

The {{firmName}} team`, `${DRAFT} guide B2`),

  email("mg_3_quiz", "Three minutes to see what fits your family", `
Hi {{firstName}},

Guides are general. The plan finder is about you.

It asks a few questions about your family, your home and your accounts, then lists the documents people in a similar situation usually discuss with an attorney. It takes about three minutes and you do not need any paperwork.

Plan finder: {{resourceUrl}}

When you are done, you can book a call from the results page, or just keep the list for later.

The {{firmName}} team`, `${DRAFT} guide B3`),

  email("so_portal_invite", "Your secure portal is ready", `
Hi {{firstName}},

Your secure client portal is ready. This is where you will fill in the planning questionnaire, upload documents and see where things stand.

Open your portal: {{portalUrl}}

The first time you sign in, you will set up a second sign-in step with an authenticator app. It keeps your family's information private.

If you have trouble getting in, reply to this email and we will help.

${SIGN}`, `${DRAFT} onboarding E3`, "client"),

  email("so_timeline", "What happens next, and when", `
Hi {{firstName}},

Here is the usual order of things, so you know what to expect:

1. You finish the questionnaire in your portal. Most people need one or two sittings.
2. The attorney drafts your documents.
3. You review the drafts together and ask for changes. Your package includes one round of revisions.
4. You sign, with the witnesses and notary the documents need.
5. If you have a trust, you move accounts and property into it. We will send a checklist.

The step that most often slows things down is the questionnaire, so the sooner it is in, the sooner your drafts are ready.

Your portal: {{portalUrl}}

${SIGN}`, `${DRAFT} onboarding E4`, "client"),

  email("rr_reminder_email_t21", "A quick reminder about a review", `
Hi {{firstName}},

A short follow-up to our note last week. If you have a minute and want to share how the process went, you can leave a review here: {{reviewUrl}}

It is completely optional, and there is nothing in it for you or for us beyond helping other families find help. This is the last time we will ask.

Thank you for trusting us with your plan.

${SIGN}`, `${DRAFT} review reminder F3`, "client"),

  email("ra_1_still_on_list", "Is this still on your list, {{firstName}}?", `
Hi {{firstName}},

A while ago you looked into getting an estate plan in place. Life gets busy, and this is one of the easiest things to put off.

One question: is it still on your list?

You can just reply with one word.
- "Yes" and we will help you find a time.
- "Later" and we will check back in a few months.
- "Done" if you took care of it elsewhere, and we will stop asking.

Or pick a time now: {{bookingUrl}}

The {{firmName}} team`, `${DRAFT} reactivation 1`),

  email("ra_2_one_small_step", "A 20 minute start", `
Hi {{firstName}},

If a full estate plan feels like a big project, start smaller. Here is a 20 minute version:

1. Write down your accounts, your home and any life insurance on one page.
2. Next to each, write who you would want to receive it.
3. Write the name of the person you would trust to handle things if you could not.

That page makes a first call with an attorney faster and cheaper, because the hard thinking is already done.

Free checklist: {{resourceUrl}}
Book a call: {{bookingUrl}}

The {{firmName}} team`, `${DRAFT} reactivation 2`),

  email("ra_3_last_check", "Our last personal note", `
Hi {{firstName}},

This is the last personal follow-up from us. After this you will get a short monthly newsletter with one useful idea each month, and you can unsubscribe at any time.

If you ever want help, a first call with an attorney licensed in your state covers what you want to happen, which documents fit, and the fee in writing before you decide.

Book whenever you are ready: {{bookingUrl}}

The {{firmName}} team`, `${DRAFT} reactivation 3`),
  email("le_new_parent_1", "Who would raise your child if something happened to you", `
Hi {{firstName}},

Most new parents have thought about this at 3 a.m., then pushed it away. It is a hard question, and it is also one of the most useful ones to answer.

If both parents were gone and no guardian was named, a court would decide who raises your child. A judge would look at relatives and make a choice, and it may not be the person you would have picked.

A will is the usual place to name a guardian. That is a short document, and in both Illinois and New Jersey the rules for it come from state law, so an attorney licensed in your state should draft it.

Naming a guardian does not take long. The harder part is the decision itself, and we will spend the next few emails on how to make it.

For now, one small step: write down the two or three people you would trust most with your child. You do not have to be sure yet.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} new_parent 1`),

  email("le_new_parent_2", "What happens to your children without a plan", `
Hi {{firstName}},

Let us walk through what actually happens, because it is less dramatic and more practical than people fear.

If both parents were unable to care for the children and there were no will naming a guardian, a relative would usually ask a court to appoint one. The court decides based on what it believes serves the child. During that time, the children may stay with whoever can step in quickly.

Separately, money is a question. Without a plan, assets left to a minor child generally cannot just go to the child. A court can end up supervising the funds until the child reaches a certain age set by state law, which differs between Illinois and New Jersey.

A plan can cover both pieces:

- A named guardian for the children
- A way to hold and manage money for them

Neither is complicated to set up once you know your wishes. An attorney can explain how it works in your state.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} new_parent 2`),

  email("le_new_parent_3", "How to choose a guardian for your children", `
Hi {{firstName}},

Many parents get stuck on this because a close friend, a favorite sibling, and the grandparents all seem like partial answers. There is rarely a perfect choice. There is usually a good one.

Questions that tend to help:

- Do they share your values about how children should be raised?
- Do they have the energy and health to take this on?
- Do they live somewhere your child could thrive, and would you be comfortable with a move?
- Would they say yes if you asked?

That last one matters. Ask the person before you name them. Some people find out about their role only after the fact, and some would have declined.

Also name a backup. Circumstances change, and a second choice costs nothing.

If you and your partner disagree, that is normal. Write down your top picks separately, then compare. The conversation is often more useful than the final answer.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} new_parent 3`),

  email("le_new_parent_4", "Leaving money to a child: why a trust is often used", `
Hi {{firstName}},

A guardian cares for your child. Money is a separate question, and it deserves its own plan.

A young child cannot manage an inheritance. If money is left to a minor with no structure, state law decides how it is handled, and many families do not like the result. In some cases the child gets full control at a young adult age, whether or not they are ready.

A trust for minors lets you set the terms. You can choose:

- Who manages the money while your child is young
- What it can be used for, such as education, health, and living costs
- The ages at which your child receives the money, in stages if you prefer

Trust rules and tax treatment are set by state law, so Illinois and New Jersey families may see differences in the details. An attorney licensed in your state can explain which structure fits your family.

A trust is not for everyone. It is one tool, worth understanding before you decide.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} new_parent 4`),

  email("le_new_parent_5", "Choosing who manages the money for your children", `
Hi {{firstName}},

If you set up a trust for your children, someone has to run it. That person is the trustee, and the choice is different from choosing a guardian.

Sometimes the guardian and the trustee are the same person. Often they are not, and there are good reasons to split the roles:

- The person who would raise a child well may not be the right one to manage money.
- Separating the roles gives each person a clear job.
- A trustee who is not also the guardian can offer a check on spending.

Think about who is organized, honest, and willing to keep records. A professional trustee, such as a bank or trust company, is another option, usually with fees.

Also consider a backup trustee, and what happens if the first choice cannot serve.

None of this has to be perfect today. It is a good topic to talk through with an attorney, who can explain how trustee duties work under ${SERVED_OR} law.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} new_parent 5`),

  email("le_new_parent_6", "The forms that can undo your plan", `
Hi {{firstName}},

Here is something that surprises many parents. A will does not control everything you own.

Life insurance, retirement accounts, and some bank accounts pass to whoever is named on the beneficiary form. That form wins, even if your will says something different.

Two common problems for new parents:

- The form still lists a parent, a sibling, or an old name, not your spouse or your children's trust.
- The form names your minor child directly, which can create the court-supervised money situation we talked about earlier.

The fix is usually simple. Pull out your forms, look at who is listed, and ask whether that still matches what you want. Your plan and your forms should tell the same story.

If you are unsure how to name a trust as a beneficiary, or how it interacts with your accounts, that is a good question for an attorney in your state.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} new_parent 6`),

  email("le_new_parent_7", "A first call to put a plan in place for your family", `
Hi {{firstName}},

Over the past few weeks we have covered guardians, trusts for children, trustees, and beneficiary forms. The next step is to talk with someone who can put it together for your family.

Here is what a first call covers:

- Your goals, including who you would want to raise your children and who should manage money for them
- Which documents fit your situation, such as a will, a trust, or both
- How the process works in ${SERVED_OR}, with an attorney licensed in your state
- The attorney's fee in writing, before you decide anything

There is no obligation. If you decide not to move forward, that is fine. Many parents tell us the hardest part was simply starting the conversation.

You do not need to have answers ready. A rough idea of who you would pick is plenty.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} new_parent 7`),

  email("le_homeowner_1", "What happens to your house without a plan", `
Hi {{firstName}},

For most families, the house is the biggest asset. It is also where a missing plan causes the most trouble.

If you own a home in your own name and have no will or trust, it usually goes through probate when you pass away. Probate is the court process that confirms who gets what and settles debts. It takes time, it is public, and it has costs. How long and how much depends on whether you are in ${SERVED_OR}.

Without a will, state law decides who inherits. That might match your wishes. It might not, especially if you have a partner you are not married to, children from more than one relationship, or a child you would like to treat differently.

A plan lets you decide who gets the house and how smoothly it happens. An attorney can explain the options for your state.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} homeowner 1`),

  email("le_homeowner_2", "Putting a home in a trust: what it does", `
Hi {{firstName}},

One common way to keep a house out of probate is to place it in a living trust. You can still live in it, sell it, or refinance it. The difference is what happens afterward.

When the home is owned by your trust, the person you name as successor trustee can transfer it to your beneficiaries without going through probate court. That can mean less delay and less cost for your family.

To do this, the deed has to be changed so the trust actually owns the house. A trust document alone is not enough. This is one of the most common mistakes: people sign the trust and never retitle the property.

Also worth asking an attorney:

- How your mortgage lender and insurance company treat a trust
- Whether the change affects property taxes in your area
- Whether a trust fits your family better than other options

The answers depend on ${SERVED_OR} law and on your own situation.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} homeowner 2`),

  email("le_homeowner_3", "Transfer on death deeds: a simpler option for some", `
Hi {{firstName}},

A trust is not the only way to pass a house outside probate. Some states allow a transfer on death deed, sometimes called a beneficiary deed. You sign a deed naming who receives the home, and it takes effect only when you pass away. Until then, it is still yours.

Whether this tool is available, and how it works, depends on state law. Illinois has a version of it. New Jersey has taken a different approach, so you should ask an attorney licensed in New Jersey what applies there.

Where it is allowed, the appeal is that it can be simpler than a trust. The tradeoffs include:

- It handles only that one property
- It does not help if the named person dies first, unless you name a backup
- It does not manage the house if you become unable to make decisions

So it can be a good fit for some families and a poor one for others. The right choice depends on your goals and your state.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} homeowner 3`),

  email("le_homeowner_4", "How property taxes can change when a home is passed on", `
Hi {{firstName}},

Many homeowners worry about taxes, and some of those worries are not quite accurate. Here is a plain way to look at it.

Property tax is set locally. When a house changes hands, the value used for tax purposes can sometimes be reassessed, and exemptions you have now, such as for seniors or primary residence, may not carry over automatically to the next owner. The rules differ between Illinois and New Jersey, and between counties and towns.

There are also separate tax topics, such as capital gains if the house is later sold. How the home is passed on can affect that calculation.

Because the numbers depend so much on where you live and how you transfer the home, it is better to ask than to guess. A few questions to bring to an attorney:

- Will the transfer trigger a reassessment?
- Will anyone lose an exemption?
- What would the heirs owe if they sold?

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} homeowner 4`),

  email("le_homeowner_5", "Owning property in more than one state", `
Hi {{firstName}},

A vacation cabin, a rental, a condo near family. Many homeowners own something outside the state where they live.

Real estate is generally handled under the law of the state where it sits. If you live in Illinois and own a lake house in Wisconsin, your estate may need a second court process there, on top of the one at home. That is called ancillary probate. It adds time, cost, and paperwork for your family, and often means hiring a second attorney.

Many people avoid this by placing the out-of-state property in a trust, or by using a deed option that the other state allows. Which one works depends on the state, and an attorney licensed in the state where the property sits may need to be involved.

If you have property in more than one state, make a simple list: where it is, how it is titled, and who is on the deed. That list is a good starting point for a first call.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} homeowner 5`),

  email("le_homeowner_6", "Keeping the family home in the family", `
Hi {{firstName}},

Some homes carry more than market value. A parent's house, a place with decades of holidays, a property you hope stays with your kids.

Leaving it to several children can get complicated. One may want to live there, one may want to sell, and one may not be able to afford their share of taxes and upkeep. Without clear instructions, disagreements are common.

A few ways families plan ahead:

- Leave the house to one child and balance it with other assets for the others
- Set up a trust with rules about use, costs, and who can buy out whom
- Agree in writing on what happens if someone wants to sell

None of these is the right answer for everyone. The goal is to decide on purpose, so your children are not left to guess what you wanted.

An attorney can help you weigh the options under ${SERVED_OR} law and write them down clearly.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} homeowner 6`),

  email("le_homeowner_7", "A first call about protecting your home and your family", `
Hi {{firstName}},

We have looked at probate, trusts, transfer on death deeds, taxes, out-of-state property, and keeping a home in the family. If one of those sounded like your situation, the next step is a conversation.

Here is what a first call covers:

- Your goals for the house and the rest of your estate
- Which documents fit, such as a will, a trust, a deed, or a combination
- How things work in ${SERVED_OR}, with an attorney licensed in your state
- The attorney's fee in writing, before you decide anything

There is no obligation. You can take what you learn and think it over, or decide a plan is not needed right now.

It helps to have your deed handy if you can find it, but it is not required. Many people start with just an address and a few questions.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} homeowner 7`),
  email("le_blended_family_2", "Your spouse or your children: who comes first?", `
Hi {{firstName}},

Many blended families hit the same question: how do you take care of your spouse and still protect what you want your children to receive?

The two goals can pull against each other. If everything goes to your spouse, your children depend on your spouse's later choices. If everything goes to your children, your spouse may lose the home or the income they counted on.

Some questions to think about:

- Should your spouse be able to stay in the home for life, even if it eventually passes to your children?
- Does your spouse need income from savings, or just access to the house?
- How old are your children, and how well do they know your spouse?

There is no standard answer. Illinois and New Jersey each have rules about what a surviving spouse is entitled to, so an attorney licensed in your state can explain how those rules interact with your wishes.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} blended_family 2`),

  email("le_blended_family_3", "How a trust can serve both your spouse and your kids", `
Hi {{firstName}},

In a blended family, a trust is often the tool that lets you say, "my spouse is looked after now, and my children receive the rest later."

Here is the basic idea. You put certain assets in a trust. While your spouse is living, they can use the home or receive income from the trust. When your spouse passes, whatever remains goes to the people you named, such as your children from an earlier marriage.

Because the trust document sets the rules, your spouse cannot change where the remainder goes. That is the point for many families: the plan holds even if circumstances change later.

A few things worth knowing:

- Trusts take some setup, including retitling accounts or property.
- Someone has to run the trust, which is why the choice of trustee matters.
- Whether this fits depends on your assets, your family, and ${SERVED_OR} law.

The short video below walks through the idea in plain language.

Watch and read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} blended_family 3`),

  email("le_blended_family_4", "Choosing who runs the trust", `
Hi {{firstName}},

If you set up a trust for a blended family, someone has to carry it out. That person is the trustee, and the choice matters more than people expect.

Picture the situation. Your spouse is living in the home. Your children will receive the remainder one day. The trustee pays the bills, keeps records, and makes decisions that affect both sides. If the trustee is your spouse, your children may worry. If the trustee is one of your children, your spouse may feel watched.

Some families choose a neutral person, such as a trusted friend, a relative outside the immediate family, or a professional trustee. Others name co-trustees so each side has a voice.

Questions to ask yourself:

- Who is organized and fair, even when emotions run high?
- Will this person still be willing and able in twenty years?
- Who should step in if the first choice cannot serve?

An attorney can explain what a trustee is allowed to do under ${SERVED_OR} law, and how to write clear instructions so the trustee is not guessing.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} blended_family 4`),

  email("le_blended_family_5", "Keeping your plan from straining family ties", `
Hi {{firstName}},

Most families do not plan to disagree about an estate. It happens when people are surprised, or when a plan leaves room for different readings.

In blended families, a few things tend to cause hurt feelings:

- Children learn about the plan only after a parent has passed.
- A stepparent and stepchildren have never talked openly about the house or keepsakes.
- Documents say one thing, but an old account says another.

You cannot control how everyone feels, but you can lower the odds of confusion. Some people write clear instructions in the plan itself. Some tell family members the broad outline while they are still here to answer questions. Some leave a short letter explaining why they made their choices, which often matters more to loved ones than the numbers.

What you share, and with whom, is your decision. An attorney can help you think through what to put in writing and how to word it so it is hard to misread.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} blended_family 5`),

  email("le_blended_family_6", "The forms that can override your will", `
Hi {{firstName}},

Here is something that surprises many people: some of your accounts do not follow your will at all.

Life insurance, retirement accounts, and many bank accounts pass to whoever is named on the beneficiary form. If you remarried and never updated an old form, the money may go to a former partner. If you named your current spouse everywhere, your children from an earlier marriage may receive nothing from those accounts, even if your will says otherwise.

A quick check can help:

- List each account that has a beneficiary form.
- Look at who is named and whether a backup is listed.
- Ask whether each choice still matches what you want today.

Changing a form is usually simple, but it can have tax and planning effects, so it is worth lining up with the rest of your plan first. Rules for some property, such as jointly owned homes, also depend on ${SERVED_OR} law.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} blended_family 6`),

  email("le_blended_family_7", "What a first call covers for blended families", `
Hi {{firstName}},

Over the past few weeks we have covered how a blended family's plan can leave people out by accident, how a trust can balance a spouse and children, who should run it, and why beneficiary forms matter.

If one of those points sounded like your situation, a first call is a simple way to get answers.

On a first call with an attorney licensed in your state, you can expect to:

- Talk through your family and what you want to happen.
- Hear which documents might fit, such as a will, a trust, or both.
- Get the attorney's fee in writing before you decide anything.

There is no obligation. You can ask questions, take time to think, and decide later or not at all. This site is educational and does not give legal advice, so the attorney is the right person to say what works under ${SERVED_OR} law.

Pick a time that suits you: {{bookingUrl}}

More background anytime: {{resourceUrl}}

${NET_SIGN}`, `${DRAFT} blended_family 7`),

  email("le_widowed_1", "Updating your plan, when you are ready", `
Hi {{firstName}},

We are sorry for what you have been through. This note is not asking you to do anything today.

When you are ready, there will come a point where your own estate plan needs a fresh look. If your documents were written as a couple, they may name your spouse as the person to make decisions, manage your property, or receive your assets. Those choices no longer work as written.

Nothing here is urgent in a way that should add to your stress. Many people wait weeks or months, and that is normal. When the time feels right, the usual first steps are small:

- Find your current will, trust, and power of attorney documents.
- Note who is named in each one.
- Write down any questions that come to mind.

An attorney licensed in ${SERVED_OR} can go through them with you at your pace. Until then, keep this somewhere easy to find.

Read more, whenever you like: {{resourceUrl}}
If you would like to talk, there is no hurry: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} widowed 1`),

  email("le_widowed_2", "Account forms that may still name your spouse", `
Hi {{firstName}},

Some accounts pass to a named beneficiary rather than through a will. If your spouse is listed on one of those forms, and you are now the account owner, it may be worth looking at again when you are ready.

Common examples include:

- Retirement accounts and IRAs
- Life insurance policies
- Bank or investment accounts with payable-on-death designations

If the form still names your late spouse and no backup, the money may end up in probate, or go somewhere you did not intend. Updating the form is usually a short task with the company that holds the account.

There is no deadline attached to reading this email. Take it one account at a time, or hand the list to someone you trust. If you inherited accounts from your spouse, there can be special rules about how they are handled, and those can depend on ${SERVED_OR} law and on tax rules. An attorney or tax professional can help sort that out.

Read more: {{resourceUrl}}
Whenever you want to talk: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} widowed 2`),

  email("le_widowed_3", "Who should make decisions for you now?", `
Hi {{firstName}},

A power of attorney names someone to handle your money and paperwork if you cannot. A healthcare directive names someone to speak for you about medical care. Many couples name each other for both.

If that is your situation, those documents may need a new person, and it helps to choose one before you need it. That does not have to be a big decision tonight. It can be a quiet conversation with someone you trust.

Think about:

- Who is calm and dependable, and lives nearby or can travel?
- Whether one person should handle money and another handle medical choices.
- Who should be the backup if the first person is unavailable.

Each state has its own forms and rules, and Illinois and New Jersey differ, so it helps to use documents written for your state.

The short video below explains these two documents in plain terms.

Watch and read more: {{resourceUrl}}
Book a call when it feels right: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} widowed 3`),

  email("le_widowed_4", "Do you still need a trust, or just a will?", `
Hi {{firstName}},

Couples often set up their plan around two people. On your own, the right setup may look different.

Some people find that a will is enough. Others want a trust, for example to avoid probate, to keep matters private, or to manage money for children or grandchildren over time. And if you and your spouse already had a trust, it may need to be updated now that you are the one in charge of it.

A few things that shape the answer:

- What you own, and how it is titled
- Whether you have children, minor or adult, and how they are doing
- Whether you own a home or other property
- How much work you want your family to take on later

None of these questions need answers today. A good attorney will start by listening, then explain the options in plain language. What fits depends on ${SERVED_OR} law and on your circumstances.

Read more: {{resourceUrl}}
If you would like to talk it through: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} widowed 4`),

  email("le_widowed_5", "Choosing who will carry out your wishes", `
Hi {{firstName}},

Your plan names people to act for you: an executor to settle your estate, a trustee if you have a trust, and agents under your power of attorney and healthcare directive. If your spouse held any of those roles, those spots are now open.

Choosing people can feel heavy. A few ideas that help:

- Pick someone who is organized and honest rather than someone who simply feels obligated.
- Name a backup for each role.
- Ask the person first. Not everyone wants the job.
- You can name different people for different roles.

If you have adult children, you may feel torn between them. Some families name one child as the executor and make sure everyone is treated fairly in the plan itself. Others choose a trusted friend or a professional.

You can take your time. Rules about who may serve as an executor or trustee depend on ${SERVED_OR} law, and an attorney can tell you what applies.

Read more: {{resourceUrl}}
Book a call, no rush: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} widowed 5`),

  email("le_widowed_6", "Talking with your children about your plan", `
Hi {{firstName}},

After losing a spouse, many people start thinking about what their children will face one day. It can be hard to bring up, and you may not know how.

You do not have to share every detail. Some people simply tell their children where the documents are kept and who is named to help. Others explain their reasoning, especially if the plan treats children differently.

A few gentle ways to begin:

- Choose a calm moment, not a holiday or a hard anniversary.
- Start with why: "I want to make things easier for you."
- Share where documents are, and who to call.
- Listen. Your children may have feelings of their own to work through.

If the conversation feels too tender right now, it can wait. A written note or a meeting with an attorney, with or without your children there, is another option.

What you share is entirely up to you.

Read more: {{resourceUrl}}
Book a call when you are ready: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} widowed 6`),

  email("le_widowed_7", "When you would like help, here is what a first call is", `
Hi {{firstName}},

This is the last note in this short series, and there is still no pressure. We wanted to explain what a first call is, in case it ever feels useful.

It is a free conversation with an attorney licensed in ${SERVED_OR}. On the call, you can expect to:

- Share what has changed and what you want your plan to do.
- Hear which documents may fit, such as a will, a trust, or updated powers of attorney.
- See the attorney's fee in writing before you decide anything.

You do not need to bring paperwork or have answers. You can ask questions, stop at any point, and take as long as you need afterward. There is no obligation.

This site is educational and does not give legal advice, so the attorney is the person who can speak to your situation under state law.

If now is not the time, that is fine. These emails and our guides will be here whenever you want them.

Book a call whenever you like: {{bookingUrl}}
Read more: {{resourceUrl}}

${NET_SIGN}`, `${DRAFT} widowed 7`),
  email("le_business_owner_1", "What happens to your business if you are not there to run it", `
Hi {{firstName}},

Most business owners have a plan for next quarter. Fewer have a plan for the day they cannot run the company.

If you own the business and nothing is in writing, the ownership interest usually passes through your estate, and your estate may need court approval before anyone can act on it. In the meantime, someone has to sign checks, pay staff, and talk to the bank. Who has the legal authority to do that is often unclear.

Questions worth asking yourself:

- Who could step in tomorrow, and do they have the authority to do it?
- Do your partners or co-owners have rights that affect your share?
- Would your family want to keep the business, or sell it?

The answers depend on how the business is organized and on ${SERVED_OR} law, which is why a licensed attorney in your state should look at it. A first call is a good place to sort out where you stand.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} business_owner 1`),

  email("le_business_owner_2", "Buy-sell agreements, in plain terms", `
Hi {{firstName}},

If you share ownership with a partner, a buy-sell agreement is one of the most useful documents you can have.

It is a contract that says what happens to an owner's share when something changes: an owner dies, becomes unable to work, retires, or wants out. It usually sets who can buy the share, how the price is decided, and how it gets paid for.

Without one, a surviving partner may end up in business with your spouse or your children, and neither side may want that. Or your family may be left holding a share they cannot easily sell.

A few things an attorney will typically ask about:

- Who is allowed to buy a departing owner's share
- How the business will be valued when that day comes
- Whether insurance or another source will fund the purchase

There is no single right design. It depends on your business and on the law in your state.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} business_owner 2`),

  email("le_business_owner_3", "Who takes over, and have you told them", `
Hi {{firstName}},

Naming a successor sounds simple. In practice it is the step many owners put off, because it means having a few awkward conversations.

A successor can be a family member, a partner, a key employee, or an outside buyer. Whoever it is, the plan works better when the person knows about it. Surprises tend to cause friction, especially if more than one person assumed they would take over.

An attorney can help you put the choice into the right documents, whether that is an operating agreement, a trust, or your will, so the successor has real authority when it matters.

Things to think about before you talk to anyone:

- Do they want the role, and can they do it?
- Should ownership and control go to the same person?
- What should the others in the family receive instead?

The short video below walks through the basics.

Watch and read: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} business_owner 3`),

  email("le_business_owner_4", "Should your business be held in a trust", `
Hi {{firstName}},

Many owners ask whether their business should go into a living trust. The honest answer is that it depends.

A trust can let a successor trustee take over management without waiting for a court, which can help a business keep running. It can also keep the details of your estate out of the public record. In some cases it makes sense to hold the ownership interest in the trust, and in others a different arrangement fits better.

Some things can get in the way. Your operating agreement or shareholder agreement may limit who can own an interest. A lender may need to approve a transfer. Those details differ from business to business.

What a trust cannot do is fix a business that has no plan for who leads it. It works as one piece of a larger plan.

An attorney licensed in ${SERVED_OR} can review your business documents and tell you what fits.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} business_owner 4`),

  email("le_business_owner_5", "How a business gets valued for a plan", `
Hi {{firstName}},

When a plan involves a business, someone eventually has to say what it is worth. That number affects a buyout, the split among your heirs, and sometimes taxes.

There is more than one way to value a company. Some methods look at earnings, some at assets, and some at what similar businesses have sold for. A small company that depends on its owner is often worth less to a buyer than the owner expects, because the owner's work leaves with the owner.

Two practical points:

- A valuation is a snapshot. It can change as the business grows or slows down.
- Agreeing on a method in advance, in a buy-sell agreement for example, can prevent disagreements later.

You do not need a formal appraisal to start planning. You do need to know who would decide the value and how.

Your attorney can explain the options and, if needed, point you to a qualified appraiser. The rules that apply depend on your state.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} business_owner 5`),

  email("le_business_owner_6", "What if the business depends on one person", `
Hi {{firstName}},

In many small companies, one person holds the relationships, the know-how, and the signing authority. Often that person is the owner.

That is sometimes called key person risk. If the person is out for a few weeks or permanently, customers may leave, a lender may get nervous, and employees may not know who is in charge.

Some ways owners reduce the risk:

- A durable power of attorney that names someone to act for you in business matters
- Written notes on accounts, passwords, vendors, and key contacts
- Naming a second person on bank accounts or contracts where appropriate
- Cross-training one or two trusted people

None of this requires you to step back from the business. It just means the business can keep going if you are not there for a while.

An attorney can help you set up the legal side so the people you pick can act without delay. Details depend on ${SERVED_OR} law.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} business_owner 6`),

  email("le_business_owner_7", "A first call about your business and your plan", `
Hi {{firstName}},

Over the past few weeks we have talked about what happens to a business without a plan, buy-sell agreements, successors, trusts, valuation, and key person risk. If any of it sounded like your situation, the next step is a conversation.

A first call with a licensed attorney in your state is free and carries no obligation. Here is what it usually covers:

- Your goals for the business and for your family
- Which documents fit your situation, and which do not
- What the work would involve and how long it takes
- The attorney's fee, in writing, before you decide anything

You do not need to prepare much. A rough idea of how the business is set up and who owns it is enough. The attorney can ask for the rest.

If you are not ready, that is fine. The information above is yours to keep.

Book a call: {{bookingUrl}}
Read more: {{resourceUrl}}

${NET_SIGN}`, `${DRAFT} business_owner 7`),

  email("le_retiring_1", "Why the months before retirement are a good time to update your plan", `
Hi {{firstName}},

Retirement changes how your money works. A paycheck stops, savings start to be drawn down, and your plans for the next twenty or thirty years take shape.

It is also a natural point to look at your estate plan. Documents written when the kids were small or when you were still building a career may no longer match your life.

A quick check:

- Do your will or trust name the right people as guardians, trustees, and agents?
- Do your beneficiary forms still say what you want?
- Have you moved, remarried, or had a change in your family since you signed anything?
- Do you have a power of attorney and a healthcare directive?

If you answered no, or are not sure, you are in good company. Most people have never reviewed their plan after signing it.

What fits you depends on your situation and on ${SERVED_OR} law. A licensed attorney can look at the whole picture with you.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} retiring 1`),

  email("le_retiring_2", "The form that can override your will", `
Hi {{firstName}},

Many people are surprised to learn that a beneficiary form often decides who receives a retirement account, regardless of what the will says.

Your 401(k), IRA, and similar accounts pass to whoever is named on the form with the plan or the financial company. If the form is outdated, the money can go to a former spouse, a relative who has passed away, or no one in particular, which can lead to delays.

Things worth checking:

- Is a primary beneficiary named on every account?
- Is there a backup in case the first person cannot receive it?
- Does the form match what your will or trust is trying to do?
- Is a trust named, and if so, was it written with that in mind?

Naming a trust as beneficiary has real consequences for how the account is paid out, so it is a question for an attorney.

Rules for spouses and for children differ, and some depend on your state. A short review now can prevent a lot of trouble later.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} retiring 2`),

  email("le_retiring_3", "Who handles your affairs if you cannot", `
Hi {{firstName}},

A power of attorney is a document that lets someone you trust handle your finances if you are unable to. That might mean paying bills, managing accounts, or filing taxes.

Without one, your family may have to ask a court to appoint someone, which takes time and is public. A durable power of attorney avoids that, because it stays in effect even if you lose the ability to make decisions yourself.

Choosing the person takes thought:

- Pick someone organized and honest, not just the oldest child
- Consider naming a backup
- Decide how much power to give, and whether it starts now or only when needed
- Tell them where the document is kept

Illinois and New Jersey each have their own rules for how these documents must be signed and what they can say, so the form matters. The short video below explains the basics.

Watch and read: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} retiring 3`),

  email("le_retiring_4", "Putting your medical wishes in writing", `
Hi {{firstName}},

A healthcare directive lets you name someone to make medical decisions for you if you cannot, and it can record what kind of care you would or would not want.

Doctors and hospitals have to follow a process when a patient cannot speak for themselves. Without your wishes on paper, that decision may fall to relatives who disagree, or who are guessing.

A good directive usually does a few things:

- Names an agent, and a backup
- Describes your values and wishes in plain language
- Gives your agent access to your medical information
- Is shared with your doctor and your family

The exact forms and the way they must be signed differ between Illinois and New Jersey, so a form from the internet may not work where you live.

This conversation is easier when you are well and not under pressure. Many people find that writing it down also gives their family relief, since they know what you wanted.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} retiring 4`),

  email("le_retiring_5", "Keeping your family out of probate", `
Hi {{firstName}},

Probate is the court process that settles an estate. It can mean filings, notices, waiting periods, and fees. How long it takes and how much it costs depends on the state and on the estate.

Some assets skip probate. Retirement accounts with named beneficiaries do. So do accounts with a payable-on-death designation, and property held in a trust. Others do not, such as a home in your sole name with no deed planning.

Ways people often reduce what goes through probate:

- Keeping beneficiary forms current
- Using a living trust for the home and larger accounts
- Reviewing how property is titled

Avoiding probate is not the only goal, and for some families it is not worth much effort. For others it saves real time and stress.

An attorney in ${SERVED_OR} can tell you whether it matters in your case and what the simplest fix would be.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} retiring 5`),

  email("le_retiring_6", "Required withdrawals and what your heirs inherit", `
Hi {{firstName}},

Once you reach a certain age, the government requires you to start taking money out of most traditional retirement accounts each year. These are called required minimum distributions. The starting age has changed in recent years, so check the current rule with your advisor or attorney.

This matters for your heirs too. When someone inherits a retirement account, they usually have to follow their own payout rules, and those rules differ depending on whether the heir is a spouse, a child, or a trust. In many cases, children must empty the account within a set number of years.

That affects their taxes, and it is a reason to think about who you name as beneficiary and how.

Questions to bring to a first call:

- Who should inherit each account?
- Would a trust help, or complicate things?
- Should some accounts go to charity?

Your tax advisor and your attorney should work from the same picture.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} retiring 6`),

  email("le_retiring_7", "A first call before you retire", `
Hi {{firstName}},

We have covered a lot over the past month: updating your plan, beneficiary forms, powers of attorney, healthcare directives, probate, and withdrawals from retirement accounts. You do not have to settle all of it at once.

The next step is a first call with a licensed attorney in your state. There is no obligation. A call usually covers:

- Your goals for retirement and for your family
- Which documents fit your situation
- What each step involves and how long it takes
- The attorney's fee, in writing, before you decide

Bring whatever you have: an old will, a list of accounts, or just questions. If you have nothing, that is fine too.

If now is not the right time, that is fine. You can come back to this whenever you like.

Book a call: {{bookingUrl}}
Read more: {{resourceUrl}}

${NET_SIGN}`, `${DRAFT} retiring 7`),
  email("le_caregiver_1", "Who can sign for your parent if they cannot?", `
Hi {{firstName}},

If you are helping a parent or relative manage their affairs, one question comes up before most others: who is allowed to act for them if they cannot act for themselves?

A durable power of attorney is the document that answers it. The person who signs it (the principal) names an agent to handle money matters such as paying bills, dealing with the bank, filing taxes or selling a house. Without one, the family may have to ask a court to appoint a guardian, which takes time, costs money and is public.

A few points worth knowing:

- The principal must still understand what they are signing. If that window is closing, it matters to act sooner.
- Banks sometimes push back on forms they do not recognize.
- The agent has a legal duty to act for the principal, not for themselves.

The rules and forms depend on ${SERVED_OR} law, and an attorney licensed in your state can explain which fits your situation.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} caregiver 1`),

  email("le_caregiver_2", "Putting their health wishes in writing", `
Hi {{firstName}},

Last time we talked about who can handle money. This email is about medical decisions.

When someone cannot speak for themselves, doctors turn to whatever is written down. If nothing is, they usually look to family, and family members do not always agree. That is a hard place to be while you are already worried.

Two documents usually cover this:

- A healthcare power of attorney names the person who makes medical decisions if your parent cannot.
- A living will or similar directive says what kind of treatment they would or would not want near the end of life.

The most useful part is often the conversation, not the paper. Ask what matters to them. Staying at home? Avoiding certain treatments? Who do they trust to decide? Write down what you hear, even before the formal documents exist.

Names and wording differ between Illinois and New Jersey, so the forms should come from an attorney licensed in the state where your parent lives.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} caregiver 2`),

  email("le_caregiver_4", "Medicaid basics for families paying for care", `
Hi {{firstName}},

Many families first hear the word Medicaid when a parent needs more care than the family can give at home, and by then they are short on time.

Here is the plain version. Medicaid is a joint federal and state program, and it can help cover long-term care for people who meet its financial limits. Each state runs its own program, so the details in Illinois are not the details in New Jersey.

Things people often ask about:

- What counts as an asset, and what does not (the family home is often treated differently from savings).
- What happens to the spouse who stays at home.
- How gifts to children in the past few years can affect eligibility.
- Whether a trust has a role.

Please do not move money or retitle property on your own. Steps that seem sensible can cause a delay in coverage later.

An attorney licensed in your state can look at your actual situation and tell you what options exist. This is general education, not advice about your case.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} caregiver 4`),

  email("le_caregiver_5", "When you are the one doing the caregiving", `
Hi {{firstName}},

You may already be driving to appointments, sorting pills, talking to insurers and paying bills, all without any official title. Many caregivers find out the hard way that being the helpful child does not give them legal authority.

Without paperwork, a pharmacy, a bank or a hospital may only talk to you in limited ways. They are protecting your parent's privacy, and that is not unreasonable, but it can leave you stuck at the worst moment.

Some things to look at:

- Is there a power of attorney for money, and does it name you or a sibling?
- Is there a healthcare agent, and have they agreed to serve?
- Has your parent signed a privacy release so providers can speak with you?
- If you are paid for caregiving or spend your own money, is it written down?

If siblings are involved, clear roles on paper can head off disagreements later. Talk to your family before a crisis, not during one.

What is allowed depends on ${SERVED_OR} law.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} caregiver 5`),

  email("le_caregiver_6", "A simple list to gather before you meet an attorney", `
Hi {{firstName}},

One thing that makes a first meeting with an attorney much more useful is having the basics on one page. It does not need to be perfect. A rough list is fine.

If you are helping a parent, try to collect:

- Existing documents: will, trust, powers of attorney, healthcare directive
- A list of bank, retirement and investment accounts, with where the statements go
- Life insurance policies and who is named as beneficiary
- Deed or property details for any real estate
- Recent tax returns
- Medicare, supplemental and any long-term care insurance information
- Names and contact details for their doctors, accountant and financial advisor
- Any debts, such as a mortgage or credit cards

Keep it in a folder, paper or digital, and tell one trusted person where it is. Do not email account numbers or passwords to us; we only need a general picture for a first conversation.

If some items are missing, that is normal. Start with what you have.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} caregiver 6`),

  email("le_caregiver_7", "If you would like to talk it through", `
Hi {{firstName}},

Over these emails we have touched on powers of attorney, healthcare directives, paying for care and getting your paperwork together. You do not have to sort all of it out at once, and you do not have to do it alone.

If you would like to talk with an attorney, here is what a first call usually covers:

- Your goals and your parent's wishes, as far as you know them
- Which documents fit your situation, and which can wait
- Questions about care and costs under ${SERVED_OR} law
- The attorney's fee for any work, given in writing before you decide anything

There is no obligation. Some people book a call and decide to wait, and that is a fine outcome. You can bring a sibling or your parent along if that helps.

If now is not the right time, just keep these emails for later. We will be here when you are ready.

Book a call: {{bookingUrl}}
Read more: {{resourceUrl}}

${NET_SIGN}`, `${DRAFT} caregiver 7`),

  email("le_special_needs_1", "Planning for the years ahead for someone you love", `
Hi {{firstName}},

If you have a family member who will need support throughout their life, you probably think about the future more than most people do. Who will help when you are no longer able? How will they pay for what they need?

A good plan usually starts with a few honest questions:

- What does daily life look like now, and what help does it take?
- Which people and services are involved today?
- Who could step in if you were unwell or gone?
- What should stay the same, no matter what?

Many families leave everything to the person directly in their will. That seems natural, but it can interfere with public benefits that the person may rely on. There are other ways to leave support, and they are worth learning about before you sign anything.

You do not need a finished plan today. Write down your answers, even roughly, and bring them to a conversation with an attorney licensed in ${SERVED_OR}.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} special_needs 1`),

  email("le_special_needs_2", "How a gift can affect benefits", `
Hi {{firstName}},

Some programs that support people with long-term needs, such as Supplemental Security Income and Medicaid, look at the person's own income and resources. If they have too much in their own name, benefits can be reduced or stopped.

That is why a direct inheritance, even a well-meant one from a grandparent, can cause trouble. It might be a modest sum, and it can still lead to a gap in coverage while things are sorted out.

This does not mean you cannot leave anything. It means how you leave it matters. Families often ask:

- Can relatives give gifts without affecting benefits?
- What about life insurance or retirement accounts with the person named as beneficiary?
- Who should we tell relatives to name instead?

Check beneficiary forms as well as wills. Those forms often override what a will says.

The details depend on the program and on ${SERVED_OR} rules, so an attorney should look at your specific facts.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} special_needs 2`),

  email("le_special_needs_3", "A trust that can support without replacing benefits", `
Hi {{firstName}},

One of the most common tools for families in your position is a supplemental needs trust. The name varies, and you may also hear third-party trust or special needs trust.

The idea is simple. Instead of leaving money to your family member directly, you leave it to a trust. A trustee manages the money and uses it for extras that benefits do not cover: things like dental care, transportation, a computer, recreation, or a trip to see family.

Because the person does not own the trust assets, the money is generally not counted against their benefit eligibility. The trustee has to follow the rules, though, so payments are made with care.

There are different kinds. A trust you set up with your own money for your child is not the same as one funded with the person's own funds, and the payback rules differ. An attorney licensed in your state can explain which applies.

Here is a short overview with the main terms: {{resourceUrl}}

Questions are welcome on a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} special_needs 3`),

  email("le_special_needs_4", "Who will manage the money later?", `
Hi {{firstName}},

Once you have a trust in mind, the next question is a hard one: who will run it?

A trustee has to be organized, honest and willing to keep records. They also need to understand your family member as a person, not only as a beneficiary. That mix is rare in a single individual, so many families split the roles.

Options you may hear about:

- A trusted relative or friend as trustee
- A professional or corporate trustee, who charges a fee
- A co-trustee arrangement, pairing a family member with a professional
- A separate person who advises the trustee but does not hold the money

Think about backups too. Ask what happens if the first choice moves away, becomes ill or says no. Naming at least one successor is standard.

You can also ask the trustee candidates ahead of time. Better to learn now that someone is not comfortable with the role.

What is permitted and customary can depend on ${SERVED_OR} law.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} special_needs 4`),

  email("le_special_needs_5", "A letter only you can write", `
Hi {{firstName}},

Legal documents say who is in charge and where money goes. They do not say that your daughter hates loud restaurants, or that your son sleeps better with the hallway light on.

A letter of intent fills that gap. It is not a binding legal document, but it can be a great help to the next person who takes care of your family member. You write it in your own voice, and you can update it whenever you like.

Things many parents include:

- Daily routines, favorite foods, and what calms or upsets them
- Medical history, medications, doctors and therapists
- Education, work or day program details
- Friends, family and activities that matter
- Your hopes for where and how they live

You do not have to write it in one sitting. Start with one page and add to it over time. Keep a copy with your other estate papers and tell your trustee and backup caregivers where it is.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} special_needs 5`),

  email("le_special_needs_6", "What changes when your child turns 18", `
Hi {{firstName}},

For many parents, the 18th birthday brings a surprise. In most cases the law treats an 18-year-old as an adult. That means you may no longer be able to see medical records, talk with doctors or make decisions about money, even if you always have.

If your son or daughter can make some decisions with help, there are options short of full guardianship:

- A healthcare power of attorney and a financial power of attorney, if they have capacity to sign
- Supported decision-making agreements, in places that recognize them
- A limited or full guardianship, which a court has to approve

Which of these fits depends on the person's abilities, and on ${SERVED_OR} law. Courts generally prefer the least restrictive choice that works.

It is better to plan this a few months before the birthday than after. An attorney can explain the steps and what a court would expect to see.

Read more: {{resourceUrl}}
Book a call: {{bookingUrl}}

${NET_SIGN}`, `${DRAFT} special_needs 6`),

  email("le_special_needs_7", "A first conversation, whenever you are ready", `
Hi {{firstName}},

Planning for a family member who will need lifelong support can feel like a lot. We have covered benefits, trusts, trustees, a letter of intent and decisions at 18. You do not need to act on all of it today.

If you would like to talk it through, a first call with an attorney licensed in ${SERVED_OR} usually covers:

- Your family member's situation and your goals
- Which documents might fit, and in what order
- How your plan could work alongside current benefits
- The attorney's fee in writing before you decide anything

There is no obligation, and you can bring a spouse, a sibling or anyone else who helps care for your family member.

If it helps, write down three questions before the call. That is plenty.

Whenever you are ready, here is the link. And if the timing is not right, that is fine too.

Book a call: {{bookingUrl}}
Read more: {{resourceUrl}}

${NET_SIGN}`, `${DRAFT} special_needs 7`),

];

const BY_KEY = new Map(TEMPLATE_COPY.map((t) => [t.key, t]));

export function getTemplateCopy(key: string): TemplateCopy | undefined {
  return BY_KEY.get(key);
}
