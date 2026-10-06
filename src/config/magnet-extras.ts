/**
 * What each free resource page shows around the download: a diagram and the
 * interactive tools, quizzes and decision guides on the same subject.
 * A resource can pick its own diagram with frontmatter `diagram`; otherwise
 * its category's diagram is used.
 */
export interface MagnetExtras {
  diagram: string;
  tools: string[];
  quizzes: string[];
  decide: string[];
}

export const MAGNET_EXTRAS: Record<string, MagnetExtras> = {
  basics: { diagram: "PlanningProcess", tools: ["plan-readiness-assessment", "will-or-trust"], quizzes: ["estate-planning-iq", "parent-protection-check"], decide: ["types-of-trusts"] },
  wills: { diagram: "WillValidity", tools: ["who-inherits", "will-or-trust", "guardian-picker"], quizzes: ["parent-protection-check", "heirs-probate-check"], decide: ["leaving-money-to-minor-children"] },
  trusts: { diagram: "LivingTrustFlow", tools: ["will-or-trust", "probate-asset-sorter"], quizzes: ["probate-risk-check"], decide: ["types-of-trusts", "ways-to-avoid-probate"] },
  property: { diagram: "TodPodTransfers", tools: ["probate-asset-sorter", "beneficiary-audit", "small-estate-checker"], quizzes: ["add-child-to-deed-check", "probate-risk-check"], decide: ["how-to-leave-your-house-to-your-children", "ways-to-avoid-probate"] },
  incapacity: { diagram: "PoaHealthcareRoles", tools: ["plan-readiness-assessment"], quizzes: ["incapacity-readiness-quiz"], decide: ["types-of-power-of-attorney", "types-of-advance-directives"] },
  family: { diagram: "BlendedFamilyPlan", tools: ["guardian-picker", "guardian-fund-calculator"], quizzes: ["blended-family-check", "parent-protection-check"], decide: ["leaving-money-to-minor-children", "guardianship-vs-conservatorship"] },
  tax: { diagram: "EstateTaxThresholds", tools: ["state-death-tax-checker", "estate-tax-estimator"], quizzes: ["estate-planning-iq"], decide: ["types-of-trusts"] },
  "elder-care": { diagram: "MedicaidLookback", tools: ["medicaid-savings-runway", "medicaid-lookback-date"], quizzes: ["incapacity-readiness-quiz"], decide: ["guardianship-vs-conservatorship", "types-of-power-of-attorney"] },
  administration: { diagram: "ProbateTimeline", tools: ["inheritance-timeline", "small-estate-checker", "executor-workload"], quizzes: ["executor-readiness-quiz", "illinois-probate-check"], decide: ["ways-to-avoid-probate"] },
  business: { diagram: "BusinessSuccession", tools: ["plan-readiness-assessment"], quizzes: ["estate-planning-iq"], decide: ["types-of-trusts"] },
};

export const extrasFor = (category: string): MagnetExtras => MAGNET_EXTRAS[category] ?? MAGNET_EXTRAS.basics;
