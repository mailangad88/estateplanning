import type { ComponentType } from "react";
import type { DiagramProps } from "./types";
import { IntestacyLadder } from "./IntestacyLadder";
import { WillVsTrust } from "./WillVsTrust";
import { ProbateTimeline } from "./ProbateTimeline";
import { LivingTrustFlow } from "./LivingTrustFlow";
import { PoaHealthcareRoles } from "./PoaHealthcareRoles";
import { PlanningProcess } from "./PlanningProcess";
import { BeneficiaryBeatsWill } from "./BeneficiaryBeatsWill";
import { ExecutorTrusteeAgent } from "./ExecutorTrusteeAgent";
import { TrustFundingAssets } from "./TrustFundingAssets";
import { ProbateVsTrustComparison } from "./ProbateVsTrustComparison";
import { GuardianshipDecision } from "./GuardianshipDecision";
import { EstateTaxThresholds } from "./EstateTaxThresholds";
import { SpecialNeedsTrust } from "./SpecialNeedsTrust";
import { BlendedFamilyPlan } from "./BlendedFamilyPlan";

export type DiagramEntry = {
  name: string;
  component: ComponentType<DiagramProps>;
  title: string;
  /** Lowercase topic slugs, for finding a diagram by subject. */
  topics: string[];
};

export const diagramRegistry: DiagramEntry[] = [
  { name: "IntestacyLadder", component: IntestacyLadder, title: "Who inherits if you die without a will", topics: ["intestacy", "wills", "no-will", "heirs"] },
  { name: "WillVsTrust", component: WillVsTrust, title: "A will compared with a revocable living trust", topics: ["wills", "trusts", "probate", "privacy", "guardians"] },
  { name: "ProbateTimeline", component: ProbateTimeline, title: "Typical stages of probate", topics: ["probate", "executor", "timeline", "creditors"] },
  { name: "LivingTrustFlow", component: LivingTrustFlow, title: "How a revocable living trust works", topics: ["trusts", "living-trust", "funding", "incapacity", "probate"] },
  { name: "PoaHealthcareRoles", component: PoaHealthcareRoles, title: "Who decides if you cannot", topics: ["power-of-attorney", "healthcare", "incapacity", "living-will", "hipaa"] },
  { name: "PlanningProcess", component: PlanningProcess, title: "The planning process, step by step", topics: ["process", "getting-started", "plan-finder", "fees"] },
  { name: "BeneficiaryBeatsWill", component: BeneficiaryBeatsWill, title: "Why a beneficiary form can beat your will", topics: ["beneficiary", "life-insurance", "retirement", "pod-tod", "wills"] },
  { name: "ExecutorTrusteeAgent", component: ExecutorTrusteeAgent, title: "Executor, trustee and agent compared", topics: ["executor", "trustee", "power-of-attorney", "roles"] },
  { name: "TrustFundingAssets", component: TrustFundingAssets, title: "Funding your trust: six assets to retitle", topics: ["trusts", "funding", "real-estate", "retitling"] },
  { name: "ProbateVsTrustComparison", component: ProbateVsTrustComparison, title: "Probate compared with a living trust", topics: ["probate", "trusts", "cost", "privacy", "ancillary-probate", "avoid-probate"] },
  { name: "GuardianshipDecision", component: GuardianshipDecision, title: "Naming a guardian for minor children", topics: ["guardianship", "children", "wills", "minors"] },
  { name: "EstateTaxThresholds", component: EstateTaxThresholds, title: "2026 federal estate tax threshold", topics: ["estate-tax", "taxes", "portability", "gifting"] },
  { name: "SpecialNeedsTrust", component: SpecialNeedsTrust, title: "Direct gift compared with a special needs trust", topics: ["special-needs", "trusts", "ssi", "medicaid", "disability"] },
  { name: "BlendedFamilyPlan", component: BlendedFamilyPlan, title: "A blended family plan compared with all to spouse", topics: ["blended-family", "trusts", "spouse", "second-marriage"] },
];

/** Diagrams that cover a topic slug (case-insensitive). */
export const diagramsForTopic = (topic: string) => diagramRegistry.filter((d) => d.topics.includes(topic.toLowerCase()));
