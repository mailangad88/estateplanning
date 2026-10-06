import type { Activity } from "@/server/types";

const OUTBOUND = ["call", "sms", "email"];

/**
 * A call, text or email a person on the team sent to the lead. Automated nurture
 * sends (activities summarised "nurture-marketing:" or "nurture-service:") do not
 * count: an automatic text is not first contact, so it must not stop the
 * speed-to-lead clock or make a lead look contacted.
 */
export function isHumanOutreach(a: Pick<Activity, "kind" | "direction" | "summary">): boolean {
  return a.direction === "outbound" && OUTBOUND.includes(a.kind) && !a.summary.startsWith("nurture-");
}
