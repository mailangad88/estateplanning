/**
 * Brevo campaign templates that are not sequence steps. The monthly newsletter goes to every contact who
 * opted in and is not suppressed, grief-track or do-not-market (build the Brevo segment on EP_DO_NOT_MARKET
 * = "false" and EP_GRIEF_TRACK = "false"). Each issue answers one real question and ends with one booking link.
 * The ALL CAPS lines are slots the editor replaces each month. Uploaded as an inactive draft by
 * `npm run brevo:setup -- --apply --templates`; every issue needs attorney approval before it goes out.
 */
import { firm } from "@/config/firm";
import { EDUCATIONAL_DISCLAIMER } from "@/server/nurture/compliance";
import type { TemplateCopy } from "@/server/nurture/templateCopy";

export const NEWSLETTER_TEMPLATE: TemplateCopy = {
  key: "newsletter_monthly",
  channel: "email",
  subject: "ISSUE SUBJECT: the question this month answers",
  source: "draft 2026-10-31 monthly newsletter",
  body: `Hi {{firstName}},

THIS MONTH'S QUESTION: one question a real family asked, in their words.

THE SHORT ANSWER: two or three sentences in plain language, with what depends on state law said plainly.

ONE THING TO DO THIS MONTH: a single step that takes under 30 minutes, such as checking a beneficiary form.

FREE TOOL OR GUIDE: one line on a tool or checklist from the site, then the link.
{{resourceUrl}}

If you want an attorney licensed in your state to look at your situation, a first call covers your goals, which documents fit, and the fee in writing before you decide.
Book a call: {{bookingUrl}}

The {{firmName}} team

--
{{firmName}}, ${firm.officeAddress}
You are receiving this because you asked for information on our website. Unsubscribe: {{unsubscribeUrl}}
${EDUCATIONAL_DISCLAIMER}`,
};
