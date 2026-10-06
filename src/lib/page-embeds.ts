import { DECISIONS, decisionPath } from "@/config/decisions";
import { WHAT_IF_SCENARIOS, type PlanDocKey, type WhatIfScenario } from "@/config/what-if-scenarios";
import { magnetsForLibrary } from "@/lib/site-links";

/**
 * What a page should carry besides its text (Angad, 2026-10-06: every page as visual as possible, with
 * tools and a free resource for every question, all interlinked). The article visual kit
 * (src/config/visual-kit.ts) draws the visuals; this file only suggests which what-if scenarios, /decide
 * guide and free resource fit a topic, for the question bank, the page templates and retrofits. Writers place
 * them with kit markers such as <!-- visual: whatif id=die-without-a-will -->.
 */

export interface EmbedSuggestion {
  whatIf: string[];
  decide?: string;
  resource?: string;
}

/** The documents each cluster is about, used to pick what-if scenarios that end in the same fix. */
const CLUSTER_DOCS: Record<string, PlanDocKey[]> = {
  basics: ["will", "trust", "financialPoa"],
  wills: ["will", "guardian"],
  trusts: ["trust", "transferOnDeath"],
  probate: ["trust", "transferOnDeath", "will"],
  "power-of-attorney": ["financialPoa", "healthcareProxy"],
  "healthcare-directives": ["healthcareProxy", "livingWill", "hipaa"],
  guardianship: ["guardian", "childrensTrust"],
  "beneficiary-designations": ["beneficiaries", "transferOnDeath"],
  "digital-assets": ["digital"],
  "elder-care": ["longTermCare", "financialPoa", "healthcareProxy"],
  "special-needs": ["specialNeedsTrust", "guardian"],
  "business-owners": ["business"],
  "blended-families": ["will", "trust", "beneficiaries"],
  "life-stages": ["will", "guardian", "beneficiaries"],
  "property-and-assets": ["transferOnDeath", "trust"],
  "after-a-death": ["will", "trust", "beneficiaries"],
  "estate-tax": ["trust", "beneficiaries"],
  "what-if": ["will", "trust", "financialPoa", "healthcareProxy"],
  illinois: ["will", "trust", "financialPoa", "healthcareProxy", "transferOnDeath", "guardian"],
};

/** The /decide guide that answers "which one should I pick?" for a cluster, refined by slug words. */
const CLUSTER_DECIDE: Record<string, string> = {
  basics: "types-of-trusts",
  wills: "ways-to-avoid-probate",
  trusts: "types-of-trusts",
  probate: "ways-to-avoid-probate",
  "power-of-attorney": "types-of-power-of-attorney",
  "healthcare-directives": "types-of-advance-directives",
  guardianship: "leaving-money-to-minor-children",
  "beneficiary-designations": "ways-to-avoid-probate",
  "elder-care": "guardianship-vs-conservatorship",
  "special-needs": "guardianship-vs-conservatorship",
  "blended-families": "types-of-trusts",
  "life-stages": "leaving-money-to-minor-children",
  "property-and-assets": "how-to-leave-your-house-to-your-children",
  "after-a-death": "ways-to-avoid-probate",
  "estate-tax": "types-of-trusts",
  "what-if": "ways-to-avoid-probate",
  illinois: "ways-to-avoid-probate",
};
const SLUG_DECIDE: [RegExp, string][] = [
  [/house|home|deed|real-estate|transfer-on-death-instrument/, "how-to-leave-your-house-to-your-children"],
  [/power-of-attorney|poa|agent/, "types-of-power-of-attorney"],
  [/healthcare|living-will|advance|polst|hipaa|end-of-life/, "types-of-advance-directives"],
  [/guardian|conservator|incapac|dementia|capacity/, "guardianship-vs-conservatorship"],
  [/minor|child|ugma|utma|529/, "leaving-money-to-minor-children"],
  [/trust/, "types-of-trusts"],
  [/probate|small-estate|payable-on-death|tod|joint/, "ways-to-avoid-probate"],
];

/** Slug words that name a document more precisely than the cluster does. */
const SLUG_DOCS: [RegExp, PlanDocKey[]][] = [
  [/healthcare|living-will|advance|polst|end-of-life/, ["healthcareProxy", "livingWill", "hipaa"]],
  [/power-of-attorney|poa/, ["financialPoa", "healthcareProxy"]],
  [/guardian/, ["guardian", "childrensTrust", "financialPoa"]],
  [/transfer-on-death|tod|payable-on-death|deed/, ["transferOnDeath", "trust"]],
  [/beneficiar/, ["beneficiaries"]],
  [/trust/, ["trust"]],
  [/medicaid|nursing|long-term/, ["longTermCare"]],
  [/spouse|without-a-will|inherits|intesta/, ["will", "beneficiaries"]],
  [/probate|small-estate/, ["trust", "transferOnDeath", "will"]],
  [/will/, ["will"]],
];

function pickWhatIf(url: string, cluster: string, slug: string, limit: number): WhatIfScenario[] {
  const docs = SLUG_DOCS.find(([re]) => re.test(slug))?.[1] ?? CLUSTER_DOCS[cluster] ?? [];
  const byDoc = WHAT_IF_SCENARIOS.filter((s) => s.learn !== url && docs.includes(s.fix[0]));
  // Spread the picks across a cluster's pages so neighbours don't all show the same three cards.
  const offset = byDoc.length ? [...url].reduce((n, c) => n + c.charCodeAt(0), 0) % byDoc.length : 0;
  const rotated = [...byDoc.slice(offset), ...byDoc.slice(0, offset)];
  return rotated.slice(0, limit);
}

/** Suggested what-if scenarios, decision guide and free resource for a page or question. */
export function suggestEmbeds(page: { url: string; cluster: string; slug: string }, limit = 2): EmbedSuggestion {
  const decide = SLUG_DECIDE.find(([re]) => re.test(page.slug))?.[1] ?? CLUSTER_DECIDE[page.cluster];
  return {
    whatIf: pickWhatIf(page.url, page.cluster, page.slug, limit).map((s) => s.id),
    decide: DECISIONS.some((d) => d.slug === decide && decisionPath(d.slug) !== page.url) ? decide : undefined,
    resource: magnetsForLibrary(page.url, page.cluster, 1)[0]?.slug,
  };
}

/** Links inside the body text to other pages on the site (not the boxes around it). */
export function contextualLinks(markdown: string): string[] {
  const body = markdown.replace(/^---[\s\S]*?\n---/, "");
  return [...body.matchAll(/\]\((\/[^)\s#]*)/g)].map((m) => m[1]);
}
