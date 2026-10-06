import glossaryRaw from "../../../content/glossary.json";
import faqRaw from "../../../content/faq.json";
import config from "../config.json";
import type { ColorName } from "../../../src/components/visuals/tokens";

/** Read straight from /content at build time: new entries render without code changes. */
export type GlossaryTerm = { term: string; slug: string; acronym: string | null; definition: string; related: string[] };
export type FaqItem = { category: string; q: string; a: string };

export const glossary = glossaryRaw as GlossaryTerm[];
export const faq = faqRaw as FaqItem[];
export const faqCategories: string[] = [...new Set(faq.map((f) => f.category))];

export const SITE = config.siteUrl.replace(/\/$/, "");
export const DOMAIN = SITE.replace(/^https?:\/\//, "");
export const FIRM = config.firmName;
export const DISCLAIMER = `General education, not legal advice. ${config.advertisingLabel}`;
export const KICKER = "Estate planning, explained";
export const FINDER_CTA = "Take the 3-minute plan finder";

export const getTerm = (slug: string) => glossary.find((g) => g.slug === slug) ?? glossary[0];
export const getFaq = (index: number) => faq[Math.max(0, Math.min(faq.length - 1, index | 0))];

import { shorten } from "./text.js";
export { shorten, wordCount, phrases, slugify } from "./text.js";

const iconRules: [RegExp, string][] = [
  [/power of attorney|attorney-in-fact/, "power-of-attorney"],
  [/health care|advance directive|living will|hipaa|resuscitat|life-sustaining|incapacity/, "health-directive"],
  [/medicaid|supplemental security|special needs|able account/, "shield"],
  [/pet/, "paw"],
  [/digital/, "lock"],
  [/tax|portability|step-up|marital deduction|gift/, "tax-form"],
  [/trust|trustee|grantor|settlor|fiduciary|crummey|spendthrift|qtip|dynasty|bypass/, "trust-box"],
  [/will|testat|codicil|bequest|lapse|abatement|witness|notariz|affidavit|no-contest|holographic|self-proving/, "will"],
  [/probate|executor|administrator|personal representative|letters|decedent|inventory|accounting|creditor|ancillary|estate$|^estate|intestate/, "courthouse"],
  [/guardian|conservator|custodian|minors|child/, "child"],
  [/beneficiar|heir|per stirpes|per capita|elective|inherit|remainder|residuary/, "family-tree"],
  [/property|deed|tenancy|joint|life estate|domicile|community|transfer on death|transfer-on-death/, "house"],
  [/insurance/, "life-insurance"],
  [/charit/, "charity"],
  [/prenuptial|spous|marital/, "partner"],
  [/payable|bank|account/, "bank"],
  [/instruction|memorandum|designation/, "document"],
];
export function iconForTerm(t: GlossaryTerm): string {
  const key = `${t.term} ${t.slug}`.toLowerCase();
  for (const [re, icon] of iconRules) if (re.test(key)) return icon;
  const d = t.definition.toLowerCase();
  for (const [re, icon] of iconRules) if (re.test(d)) return icon;
  return "scale";
}
const catIcons: Record<string, string> = {
  "Getting started": "sprout", Wills: "will", Trusts: "trust-box", Incapacity: "power-of-attorney",
  "After a death": "courthouse", "Cost and process": "dollar", "Working with us": "hand-heart",
};
export const iconForCategory = (c: string) => catIcons[c] ?? "document";

export type Palette = { main: ColorName; tint: ColorName; deep: ColorName };
const palettes: Palette[] = [
  { main: "accent", tint: "accentTint", deep: "accentDeep" },
  { main: "clay", tint: "clayTint", deep: "clay" },
  { main: "sage", tint: "sageTint", deep: "sage" },
  { main: "gold", tint: "goldTint", deep: "gold" },
];
export const paletteFor = (key: string): Palette => {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palettes[h % palettes.length];
};

export type CarouselSlide = { heading: string; body: string };
/** Cover + one slide per question (max 6) + closing CTA. */
export function buildCarousel(category: string, maxQuestions = 6): CarouselSlide[] {
  const items = faq.filter((f) => f.category === category).slice(0, maxQuestions);
  return [
    { heading: category, body: `${items.length} common questions, answered in plain language.` },
    ...items.map((f) => ({ heading: f.q, body: shorten(f.a, 280) })),
    { heading: FINDER_CTA, body: `Answers to more questions at ${DOMAIN}/faq` },
  ];
}
