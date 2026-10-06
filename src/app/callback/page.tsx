import type { Metadata } from "next";
import Callback from "./Callback";

export const metadata: Metadata = {
  title: "Request a call back",
  description: "Leave your number and a member of our intake team will call you during office hours.",
};

export default function CallbackPage() {
  return <Callback />;
}
