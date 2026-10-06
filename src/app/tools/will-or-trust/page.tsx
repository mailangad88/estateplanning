import type { Metadata } from "next";
import WillOrTrust from "./WillOrTrust";

export const metadata: Metadata = {
  title: "Will or trust? A plain-English helper",
  description: "See the factors people weigh when choosing between a will and a living trust, and which way your answers point.",
};

export default function WillOrTrustPage() {
  return <WillOrTrust />;
}
