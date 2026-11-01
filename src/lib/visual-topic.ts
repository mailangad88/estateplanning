/**
 * Picks a picture, an icon and a colour for any page or card from its path and title, so every
 * part of the site gets a visual without each page choosing one by hand. Illustration names match
 * the static exports in public/media/illustrations (regenerate with `npm run visuals:export`).
 */
export type Tone = "accent" | "clay" | "sage" | "gold";

export interface Topic {
  key: string;
  /** Hero illustration name (component in components/visuals, file in /media/illustrations). */
  art: string;
  /** lucide-react icon name, mapped in components/visual-card.tsx. */
  icon: string;
  tone: Tone;
}

const TOPICS: (Topic & { match: RegExp })[] = [
  { key: "after-death", match: /after-a-death|executor|settl|died|death|grief|first-30|surviving|inherit|heir/i, art: "HeroEstateSettlement", icon: "Flower2", tone: "sage" },
  { key: "probate", match: /probate|court|intesta|without-a-will|die-without/i, art: "HeroProbate", icon: "Landmark", tone: "clay" },
  { key: "trust-admin", match: /trustee|trust-admin/i, art: "HeroEstateSettlement", icon: "ClipboardList", tone: "sage" },
  { key: "special-needs", match: /special-needs|disab|able-account|ssi|medicaid/i, art: "HeroSpecialNeeds", icon: "HandHeart", tone: "sage" },
  { key: "aging", match: /aging|parent|elder|dementia|caregiv|nursing|long-term-care|incapac|diagnosis/i, art: "HeroAgingParents", icon: "HandHeart", tone: "sage" },
  { key: "guardian", match: /guardian|minor|new-parent|baby|child|kids/i, art: "HeroGuardianship", icon: "Baby", tone: "gold" },
  { key: "blended", match: /blended|stepchild|second-marriage|remarr|divorce/i, art: "HeroBlendedFamily", icon: "Users", tone: "clay" },
  { key: "business", match: /business|succession|llc|farm|ranch|physician|investor|rental|landlord/i, art: "HeroBusinessSuccession", icon: "Briefcase", tone: "accent" },
  { key: "poa", match: /power-of-attorney|powers-of-attorney|poa|agent|financial-power/i, art: "HeroPowersOfAttorney", icon: "Scale", tone: "clay" },
  { key: "health", match: /health|medical|living-will|hipaa|polst|advance-directive|surgery/i, art: "HeroPowersOfAttorney", icon: "Stethoscope", tone: "gold" },
  { key: "newlyweds", match: /newlywed|married|marriage|couple|wedding|unmarried|lgbtq/i, art: "HeroNewlyweds", icon: "Heart", tone: "clay" },
  { key: "retire", match: /retire|snowbird|65|senior|ira|401|pension/i, art: "HeroRetirees", icon: "Sun", tone: "gold" },
  { key: "trusts", match: /trust|fund/i, art: "HeroTrusts", icon: "ShieldCheck", tone: "accent" },
  { key: "wills", match: /will|testament|pour-over|executor/i, art: "HeroWills", icon: "ScrollText", tone: "accent" },
  { key: "tax", match: /tax|estate-tax|gift/i, art: "HeroTrusts", icon: "Receipt", tone: "gold" },
  { key: "home", match: /home|house|deed|real-estate|mortgage|homeowner/i, art: "HeroFamilyHome", icon: "House", tone: "accent" },
  { key: "cost", match: /cost|price|pricing|fee/i, art: "SpotCalendarReview", icon: "Receipt", tone: "gold" },
  { key: "checklist", match: /checklist|worksheet|workbook|locator|planner|inventory/i, art: "SpotChecklist", icon: "ClipboardCheck", tone: "sage" },
  { key: "questions", match: /question|faq|glossary|mistake|quiz/i, art: "SpotQuestions", icon: "CircleHelp", tone: "accent" },
  { key: "update", match: /update|review|life-event|moving|(^|[^e])state/i, art: "SpotCalendarReview", icon: "CalendarCheck", tone: "accent" },
];

const DEFAULT: Topic = { key: "family", art: "HeroFamilyHome", icon: "FileText", tone: "accent" };

export function topicFor(...texts: (string | undefined)[]): Topic {
  const hay = texts.filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, "-");
  const t = TOPICS.find((x) => x.match.test(hay));
  return t ? { key: t.key, art: t.art, icon: t.icon, tone: t.tone } : DEFAULT;
}

export const illustrationSrc = (art: string) => `/media/illustrations/${art}.webp`;

/**
 * Alt text for every illustration, describing what the picture shows. Search engines and AI answer
 * engines read alt text, and screen reader users hear it, so no illustration goes out with an empty alt.
 */
export const ILLUSTRATION_ALT: Record<string, string> = {
  HeroAgingParents: "Illustration of an older couple at home beside a window, with a signed planning document",
  HeroBlendedFamily: "Illustration of a blended family: two households with their children joined around one home",
  HeroBusinessSuccession: "Illustration of a family business storefront with a key passing from the owner to the next generation",
  HeroEstateSettlement: "Illustration of two family members at a table with a document box, settling a loved one's estate",
  HeroFamilyHome: "Illustration of a family in front of their house, with a will and a shield for protection",
  HeroGuardianship: "Illustration of parents and the guardians they chose, with children under a rainbow labeled cared for, whatever happens",
  HeroNewlyweds: "Illustration of a newly married couple with wedding rings and their signed plan",
  HeroPowersOfAttorney: "Illustration of a power of attorney document branching into health care decisions and money and bills",
  HeroPreRetirees: "Illustration of a family under a tree with a checklist and savings jar, planning ahead for retirement",
  HeroProbate: "Illustration of a winding path from a stack of court papers to a family home, showing the probate process",
  HeroRetirees: "Illustration of a retired couple in front of their home with a phone and a checked document",
  HeroSpecialNeeds: "Illustration of parents and a protected loved one surrounded by housing, care, benefits and savings",
  HeroTrusts: "Illustration of a home, bank account and documents flowing into a trust shield and on to the family",
  HeroWills: "Illustration of a last will directing the home, savings and keepsakes to the people named in it",
  SpotCalendarReview: "Illustration of a calendar with a checked date and a clock, a reminder to review your plan",
  SpotChecklist: "Illustration of a checklist on a clipboard with three items checked and a pencil",
  SpotDocumentsSigned: "Illustration of signed documents with a pen and a check mark",
  SpotQuestions: "Illustration of a person with questions and a check mark answer",
  SpotSafeStorage: "Illustration of a locked tablet, a key and a document, showing safe storage of estate papers",
  SpotVideoCall: "Illustration of a laptop video call with a planner and a family",
};

/** Alt text for an illustration; adds the page or card subject when given so each picture is described in context. */
export function illustrationAlt(art: string, subject?: string): string {
  const base = ILLUSTRATION_ALT[art] ?? "Illustration for this estate planning topic";
  return subject ? `${base}. Topic: ${subject}` : base;
}
