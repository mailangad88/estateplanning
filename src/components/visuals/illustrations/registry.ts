import type { ComponentType, ReactNode } from "react";
import {
  HeroAgingParents,
  HeroBlendedFamily,
  HeroBusinessSuccession,
  HeroEstateSettlement,
  HeroFamilyHome,
  HeroGuardianship,
  HeroPowersOfAttorney,
  HeroProbate,
  HeroSpecialNeeds,
  HeroTrusts,
  HeroWills,
} from "./heroes";
import {
  SpotCalendarReview,
  SpotChecklist,
  SpotDocumentsSigned,
  SpotQuestions,
  SpotSafeStorage,
  SpotVideoCall,
} from "./spots";

export type IllustrationEntry = {
  name: string;
  component: ComponentType<{ bare?: boolean; caption?: ReactNode }>;
  kind: "hero" | "spot";
  topics: string[];
};

export const illustrations: IllustrationEntry[] = [
  { name: "HeroFamilyHome", component: HeroFamilyHome, kind: "hero", topics: ["home", "estate-planning", "family"] },
  { name: "HeroWills", component: HeroWills, kind: "hero", topics: ["wills", "last-will", "intestacy"] },
  { name: "HeroTrusts", component: HeroTrusts, kind: "hero", topics: ["trusts", "living-trust", "trust-funding"] },
  { name: "HeroProbate", component: HeroProbate, kind: "hero", topics: ["probate", "avoiding-probate"] },
  { name: "HeroPowersOfAttorney", component: HeroPowersOfAttorney, kind: "hero", topics: ["powers-of-attorney", "healthcare-directive", "incapacity"] },
  { name: "HeroGuardianship", component: HeroGuardianship, kind: "hero", topics: ["guardianship", "guardian", "minor-children", "parents"] },
  { name: "HeroBusinessSuccession", component: HeroBusinessSuccession, kind: "hero", topics: ["business-succession", "business-owners"] },
  { name: "HeroAgingParents", component: HeroAgingParents, kind: "hero", topics: ["aging-parents", "elder-law", "caregiving"] },
  { name: "HeroBlendedFamily", component: HeroBlendedFamily, kind: "hero", topics: ["blended-family", "second-marriage", "stepchildren"] },
  { name: "HeroSpecialNeeds", component: HeroSpecialNeeds, kind: "hero", topics: ["special-needs", "disability", "benefits"] },
  { name: "HeroEstateSettlement", component: HeroEstateSettlement, kind: "hero", topics: ["estate-settlement", "executor", "after-a-death", "grief"] },
  { name: "SpotChecklist", component: SpotChecklist, kind: "spot", topics: ["checklist", "getting-started"] },
  { name: "SpotDocumentsSigned", component: SpotDocumentsSigned, kind: "spot", topics: ["signing", "documents", "execution"] },
  { name: "SpotVideoCall", component: SpotVideoCall, kind: "spot", topics: ["consultation", "remote", "contact"] },
  { name: "SpotSafeStorage", component: SpotSafeStorage, kind: "spot", topics: ["storage", "safekeeping", "document-locator"] },
  { name: "SpotQuestions", component: SpotQuestions, kind: "spot", topics: ["faq", "questions", "choosing-an-attorney"] },
  { name: "SpotCalendarReview", component: SpotCalendarReview, kind: "spot", topics: ["review", "updates", "life-events"] },
];
