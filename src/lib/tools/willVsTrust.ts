/**
 * "Will or trust?" decision helper. It shows which factors people commonly weigh,
 * and which way each of the visitor's answers usually points. It never recommends.
 */

export interface WillVsTrustQuestion {
  id: string;
  prompt: string;
  /** Points toward a trust when "yes", with the reason shown to the visitor */
  trustReason?: string;
  /** Points toward a will when "yes" */
  willReason?: string;
  /** Weight of the factor */
  weight: number;
}

export const WILL_VS_TRUST_QUESTIONS: WillVsTrustQuestion[] = [
  { id: "ownsHome", prompt: "Do you own a home or other real estate?", weight: 2, trustReason: "Real estate usually goes through probate unless it is held in a trust or has a transfer-on-death deed where allowed." },
  { id: "multiState", prompt: "Do you own real estate in more than one state?", weight: 3, trustReason: "Property in several states can mean a separate probate in each one. A trust can avoid that." },
  { id: "privacy", prompt: "Is keeping your estate private important to you?", weight: 2, trustReason: "A will becomes a public court record in probate. A trust usually stays private." },
  { id: "incapacity", prompt: "Are you concerned about who manages your money if you become ill or unable to?", weight: 2, trustReason: "A successor trustee can step in to manage trust property without going to court." },
  { id: "controlOverTime", prompt: "Do you want money for children or others paid out over time, not all at once?", weight: 2, trustReason: "A trust can spell out ages, milestones or a trustee's discretion for distributions." },
  { id: "blended", prompt: "Do you have a blended family or children from a previous relationship?", weight: 2, trustReason: "Trusts are often used to provide for a spouse while protecting what children from an earlier relationship receive." },
  { id: "specialNeeds", prompt: "Does someone you want to provide for receive disability benefits?", weight: 3, trustReason: "A supplemental needs trust can help protect a loved one's eligibility for benefits." },
  { id: "simpleEstate", prompt: "Are most of your assets in accounts that already have beneficiaries named (retirement, life insurance)?", weight: 2, willReason: "Accounts with named beneficiaries pass outside probate, so a will may cover what is left." },
  { id: "budgetFirst", prompt: "Is keeping the upfront cost as low as possible your top priority right now?", weight: 2, willReason: "A will-based plan usually costs less to set up. A trust costs more upfront but can save time and cost later." },
  { id: "youngNoHome", prompt: "Are you under 40, without a home, mainly wanting to name a guardian for your children?", weight: 2, willReason: "A will is where parents name a guardian, and many young families start there and add a trust later." },
];

export type WillVsTrustLean = "will" | "trust" | "either";

export interface WillVsTrustResult {
  lean: WillVsTrustLean;
  headline: string;
  trustPoints: number;
  willPoints: number;
  trustReasons: string[];
  willReasons: string[];
}

export function weighWillVsTrust(answers: Record<string, "yes" | "no" | undefined>): WillVsTrustResult {
  let trustPoints = 0;
  let willPoints = 0;
  const trustReasons: string[] = [];
  const willReasons: string[] = [];
  for (const q of WILL_VS_TRUST_QUESTIONS) {
    if (answers[q.id] !== "yes") continue;
    if (q.trustReason) {
      trustPoints += q.weight;
      trustReasons.push(q.trustReason);
    }
    if (q.willReason) {
      willPoints += q.weight;
      willReasons.push(q.willReason);
    }
  }
  const diff = trustPoints - willPoints;
  const lean: WillVsTrustLean = diff >= 3 ? "trust" : diff <= -2 ? "will" : "either";
  const headline = {
    trust: "Several of your answers are reasons people often choose a living trust.",
    will: "Your answers look like situations where many people start with a will.",
    either: "Your answers point both ways. This is a good question to talk through with an attorney.",
  }[lean];
  return { lean, headline, trustPoints, willPoints, trustReasons, willReasons };
}
