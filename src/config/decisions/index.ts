import type { DecisionGuide } from "./types";
import { TYPES_OF_TRUSTS } from "./trusts";

/** Every decision guide, in the order the /decide hub lists them. */
export const DECISIONS: DecisionGuide[] = [TYPES_OF_TRUSTS];

export const getDecision = (slug: string) => DECISIONS.find((d) => d.slug === slug);
export const decisionPath = (slug: string) => `/decide/${slug}`;
