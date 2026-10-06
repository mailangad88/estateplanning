/**
 * Estate plan readiness score. Measures how organized someone's planning is, not
 * whether their documents are legally sufficient. Wording must stay educational.
 */

export type ReadinessAnswer = "yes" | "no" | "not_sure" | "not_applicable";

export interface ReadinessItem {
  id: string;
  prompt: string;
  /** Points when answered "yes" */
  weight: number;
  /** Offer "Doesn't apply to me" (e.g. guardians for people without minor children) */
  canSkip?: boolean;
  /** Shown in the gap report when the answer is not "yes" */
  gap: string;
}

export const READINESS_ITEMS: ReadinessItem[] = [
  { id: "will", prompt: "Do you have a signed will or living trust?", weight: 20, gap: "Without a will or trust, state law decides who inherits and who is in charge." },
  { id: "financialPoa", prompt: "Have you named someone to handle your finances if you can't (a financial power of attorney)?", weight: 12, gap: "If you become unable to manage money, your family may need a court guardianship or conservatorship to step in." },
  { id: "healthcareDirective", prompt: "Have you named a healthcare agent and written down your medical wishes?", weight: 12, gap: "Without a healthcare directive, doctors and family may have to guess what you would want." },
  { id: "hipaa", prompt: "Have you signed a HIPAA authorization so loved ones can talk to your doctors?", weight: 5, gap: "Privacy rules can keep doctors from sharing information with family unless you have authorized it." },
  { id: "guardian", prompt: "If you have children under 18, have you named a guardian in writing?", weight: 15, canSkip: true, gap: "If no guardian is named, a court chooses who raises your children." },
  { id: "beneficiaries", prompt: "Have you checked the beneficiaries on your retirement accounts and life insurance in the last 3 years?", weight: 10, gap: "Beneficiary forms override your will, and out-of-date forms are a common source of family disputes." },
  { id: "trustFunded", prompt: "If you have a living trust, is your home and other property titled in the trust's name?", weight: 8, canSkip: true, gap: "A trust only avoids probate for property that is actually transferred into it." },
  { id: "recentReview", prompt: "Have you reviewed your plan since your last major life event (marriage, divorce, birth, move, death)?", weight: 8, gap: "Plans written before a big life change often no longer match what people want." },
  { id: "documentsLocated", prompt: "Does someone you trust know where your original documents are?", weight: 5, gap: "Documents that can't be found can't be used, and courts often need the signed original." },
  { id: "digitalAssets", prompt: "Have you made a plan for passwords, online accounts and digital assets?", weight: 5, gap: "Families are often locked out of accounts, photos and bill-pay without access instructions." },
];

export type ReadinessBand = "getting_started" | "partly_in_place" | "well_organized";

export interface ReadinessResult {
  score: number;
  band: ReadinessBand;
  bandLabel: string;
  gaps: { id: string; prompt: string; gap: string; unsure: boolean }[];
}

const BAND_LABELS: Record<ReadinessBand, string> = {
  getting_started: "Getting started",
  partly_in_place: "Partly in place",
  well_organized: "Well organized",
};

export function scoreReadiness(answers: Record<string, ReadinessAnswer | undefined>): ReadinessResult {
  let earned = 0;
  let possible = 0;
  const gaps: ReadinessResult["gaps"] = [];
  for (const item of READINESS_ITEMS) {
    const a = answers[item.id];
    if (a === "not_applicable" && item.canSkip) continue;
    possible += item.weight;
    if (a === "yes") earned += item.weight;
    else gaps.push({ id: item.id, prompt: item.prompt, gap: item.gap, unsure: a === "not_sure" });
  }
  const score = possible === 0 ? 0 : Math.round((earned / possible) * 100);
  const band: ReadinessBand = score >= 75 ? "well_organized" : score >= 40 ? "partly_in_place" : "getting_started";
  // Highest-weight gaps first, so the report leads with what matters most.
  const weightOf = (id: string) => READINESS_ITEMS.find((i) => i.id === id)?.weight ?? 0;
  gaps.sort((a, b) => weightOf(b.id) - weightOf(a.id));
  return { score, band, bandLabel: BAND_LABELS[band], gaps };
}
