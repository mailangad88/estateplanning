import type { Metadata } from "next";
import PlanFinder from "./PlanFinder";

export const metadata: Metadata = {
  title: "Plan finder | See what people in your situation discuss with an attorney",
};

export default function PlanFinderPage() {
  return <PlanFinder />;
}
