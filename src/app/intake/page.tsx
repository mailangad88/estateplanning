import type { Metadata } from "next";
import Intake from "./Intake";

export const metadata: Metadata = {
  title: "Book a consult | Estate planning intake",
  description: "Tell us a little about your family and goals, and we'll set up a consult with an estate planning attorney.",
};

export default function IntakePage() {
  return <Intake />;
}
