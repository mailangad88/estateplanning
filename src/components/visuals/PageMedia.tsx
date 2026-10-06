import type { ComponentType } from "react";
import type { DiagramProps } from "./diagrams/types";
import {
  BeneficiaryBeatsWill,
  BlendedFamilyPlan,
  EstateTaxThresholds,
  ExecutorTrusteeAgent,
  GuardianshipDecision,
  IntestacyLadder,
  LivingTrustFlow,
  PlanningProcess,
  PoaHealthcareRoles,
  ProbateTimeline,
  ProbateVsTrustComparison,
  SpecialNeedsTrust,
  TrustFundingAssets,
  WillVsTrust,
  MedicaidLookback,
  BusinessSuccession,
  DigitalAssets,
  RevocableVsIrrevocable,
  MoneyForMinors,
  TodPodTransfers,
  PlanReviewTriggers,
  WillValidity,
} from "./diagrams";
import { VideoExplainer } from "./video/VideoExplainer";

type Media = { diagram?: ComponentType<DiagramProps>; video?: string };

/**
 * Which diagram and video belong on which page. Add a row here to put a
 * visual on any article that renders through ArticlePage.
 */
export const PAGE_MEDIA: Record<string, Media> = {
  "/guides/what-happens-if-you-die-without-a-will": { diagram: IntestacyLadder, video: "what-happens-if-you-die-without-a-will" },
  "/guides/how-probate-works": { diagram: ProbateTimeline, video: "the-probate-timeline-animated" },
  "/guides/revocable-living-trust-explained": { diagram: LivingTrustFlow, video: "how-a-revocable-living-trust-works" },
  "/guides/funding-your-trust": { diagram: TrustFundingAssets, video: "funding-your-trust-the-six-assets-to-retitle" },
  "/guides/beneficiary-designations": { diagram: BeneficiaryBeatsWill, video: "why-your-beneficiary-form-beats-your-will" },
  "/guides/guardianship-for-minor-children": { diagram: GuardianshipDecision, video: "guardianship-for-minor-children-how-courts-decide" },
  "/guides/powers-of-attorney": { diagram: PoaHealthcareRoles, video: "what-a-power-of-attorney-can-and-cannot-do" },
  "/guides/healthcare-directives-and-living-wills": { diagram: PoaHealthcareRoles },
  "/guides/special-needs-trusts": { diagram: SpecialNeedsTrust, video: "special-needs-trust-how-a-gift-can-protect-benefits" },
  "/guides/medicaid-and-long-term-care-planning": { diagram: MedicaidLookback, video: "the-medicaid-five-year-look-back-explained" },
  "/guides/business-succession-planning": { diagram: BusinessSuccession },
  "/guides/digital-assets-estate-planning": { diagram: DigitalAssets },
  "/guides/irrevocable-trusts-explained": { diagram: RevocableVsIrrevocable },
  "/guides/leaving-money-to-minors": { diagram: MoneyForMinors },
  "/guides/transfer-on-death-and-payable-on-death": { diagram: TodPodTransfers },
  "/guides/updating-your-estate-plan": { diagram: PlanReviewTriggers },
  "/guides/what-makes-a-will-valid": { diagram: WillValidity },
  "/compare/revocable-vs-irrevocable-trust": { diagram: RevocableVsIrrevocable },
  "/compare/transfer-on-death-deed-vs-trust": { diagram: TodPodTransfers },
  "/guides/estate-and-inheritance-taxes": { diagram: EstateTaxThresholds, video: "estate-tax-thresholds-explained" },
  "/guides/estate-planning-for-blended-families": { diagram: BlendedFamilyPlan, video: "blended-family-estate-plan-protecting-spouse-and-children" },
  "/guides/settling-an-estate-step-by-step": { diagram: ProbateTimeline, video: "first-30-days-after-a-loved-one-dies" },
  "/guides/choosing-an-executor": { diagram: ExecutorTrusteeAgent, video: "executor-vs-trustee-vs-power-of-attorney" },
  "/guides/choosing-a-trustee": { diagram: ExecutorTrusteeAgent },
  "/guides/what-is-estate-planning": { diagram: PlanningProcess },
  "/guides/how-to-make-a-will": { diagram: PlanningProcess },
  "/compare/will-vs-trust": { diagram: WillVsTrust, video: "will-vs-trust-a-decision-tree" },
  "/compare/executor-vs-trustee": { diagram: ExecutorTrusteeAgent },
  "/compare/beneficiary-designation-vs-will": { diagram: BeneficiaryBeatsWill },
  "/compare/probate-vs-non-probate-assets": { diagram: ProbateVsTrustComparison, video: "probate-vs-trust-cost-and-time" },
  "/compare/living-will-vs-healthcare-power-of-attorney": { diagram: PoaHealthcareRoles },
  "/blog/how-long-does-probate-take": { diagram: ProbateTimeline },
  "/blog/should-i-put-my-house-in-a-trust": { diagram: TrustFundingAssets },
  "/blog/does-a-spouse-inherit-everything-if-there-is-no-will": { diagram: IntestacyLadder },
  "/blog/who-gets-the-house-if-theres-no-will-and-no-spouse": { diagram: IntestacyLadder },
  "/blog/do-retirement-accounts-go-through-probate": { diagram: BeneficiaryBeatsWill },
  "/blog/what-happens-to-a-power-of-attorney-when-you-die": { diagram: ExecutorTrusteeAgent },
  "/life-events/new-baby": { diagram: GuardianshipDecision },
  "/life-events/getting-married": { diagram: BeneficiaryBeatsWill },
  "/life-events/death-of-a-parent": { video: "first-30-days-after-a-loved-one-dies" },
};

/** The diagram and video for a page, placed after the short answer. Renders nothing for unmapped pages. */
export function PageMedia({ path }: { path: string }) {
  const m = PAGE_MEDIA[path];
  if (!m) return null;
  const D = m.diagram;
  return (
    <>
      {D ? <D /> : null}
      {m.video ? <VideoExplainer slug={m.video} pagePath={path} /> : null}
    </>
  );
}
