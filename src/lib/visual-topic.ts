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
  { key: "update", match: /update|review|life-event|moving|state/i, art: "SpotCalendarReview", icon: "CalendarCheck", tone: "accent" },
];

const DEFAULT: Topic = { key: "family", art: "HeroFamilyHome", icon: "FileText", tone: "accent" };

export function topicFor(...texts: (string | undefined)[]): Topic {
  const hay = texts.filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, "-");
  const t = TOPICS.find((x) => x.match.test(hay));
  return t ? { key: t.key, art: t.art, icon: t.icon, tone: t.tone } : DEFAULT;
}

export const illustrationSrc = (art: string) => `/media/illustrations/${art}.webp`;
