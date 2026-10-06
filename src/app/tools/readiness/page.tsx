import type { Metadata } from "next";
import Readiness from "./Readiness";

export const metadata: Metadata = {
  title: "Estate plan readiness score",
  description: "Ten quick questions to see how organized your estate planning is and where the common gaps are.",
};

export default function ReadinessPage() {
  return <Readiness />;
}
