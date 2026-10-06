import type { DecisionGuide } from "./types";
import { TYPES_OF_TRUSTS } from "./trusts";
import { HOUSE_TO_CHILDREN } from "./house-to-children";
import { TYPES_OF_POA } from "./power-of-attorney";
import { GUARDIANSHIP_VS_CONSERVATORSHIP } from "./guardianship";
import { WAYS_TO_AVOID_PROBATE } from "./avoid-probate";
import { MONEY_FOR_MINORS } from "./minor-children";
import { ADVANCE_DIRECTIVES } from "./advance-directives";

/** Every decision guide, in the order the /decide hub lists them. */
export const DECISIONS: DecisionGuide[] = [
  TYPES_OF_TRUSTS,
  HOUSE_TO_CHILDREN,
  TYPES_OF_POA,
  WAYS_TO_AVOID_PROBATE,
  MONEY_FOR_MINORS,
  ADVANCE_DIRECTIVES,
  GUARDIANSHIP_VS_CONSERVATORSHIP,
];

export const getDecision = (slug: string) => DECISIONS.find((d) => d.slug === slug);
export const decisionPath = (slug: string) => `/decide/${slug}`;
