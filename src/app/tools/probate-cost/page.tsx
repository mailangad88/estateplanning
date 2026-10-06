import type { Metadata } from "next";
import ProbateCost from "./ProbateCost";

export const metadata: Metadata = {
  title: "Probate cost estimator",
  description: "A rough range of what probate can cost and how long it can take, using general figures for your state.",
};

export default function ProbateCostPage() {
  return <ProbateCost />;
}
