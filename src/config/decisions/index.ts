import type { DecisionGuide } from "./types";
import { TYPES_OF_TRUSTS } from "./trusts";
import { HOUSE_TO_CHILDREN } from "./house-to-children";
import { TYPES_OF_POA } from "./power-of-attorney";
import { GUARDIANSHIP_VS_CONSERVATORSHIP } from "./guardianship";
import { WAYS_TO_AVOID_PROBATE } from "./avoid-probate";
import { MONEY_FOR_MINORS } from "./minor-children";
import { ADVANCE_DIRECTIVES } from "./advance-directives";
import { TYPES_OF_PROBATE } from "./probate-types";
import { TYPES_OF_SPECIAL_NEEDS_TRUSTS } from "./special-needs-trusts";
import { WAYS_TO_HOLD_TITLE } from "./hold-title";
import { LLC_VS_TRUST_RENTAL } from "./llc-vs-trust-rental";
import { PER_STIRPES_VS_PER_CAPITA } from "./per-stirpes";
import { SECOND_MARRIAGE_OPTIONS } from "./second-marriage";
import { MANAGING_PARENT_FINANCES } from "./parent-finances";
import { ALTERNATIVES_TO_GUARDIANSHIP } from "./guardianship-alternatives";

/** Every decision guide, in the order the /decide hub lists them. */
export const DECISIONS: DecisionGuide[] = [
  TYPES_OF_TRUSTS,
  HOUSE_TO_CHILDREN,
  TYPES_OF_POA,
  WAYS_TO_AVOID_PROBATE,
  MONEY_FOR_MINORS,
  ADVANCE_DIRECTIVES,
  GUARDIANSHIP_VS_CONSERVATORSHIP,
  TYPES_OF_PROBATE,
  TYPES_OF_SPECIAL_NEEDS_TRUSTS,
  WAYS_TO_HOLD_TITLE,
  LLC_VS_TRUST_RENTAL,
  PER_STIRPES_VS_PER_CAPITA,
  SECOND_MARRIAGE_OPTIONS,
  MANAGING_PARENT_FINANCES,
  ALTERNATIVES_TO_GUARDIANSHIP,
];

export const getDecision = (slug: string) => DECISIONS.find((d) => d.slug === slug);
export const decisionPath = (slug: string) => `/decide/${slug}`;
