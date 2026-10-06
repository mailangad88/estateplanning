import { isSensitivePath, SENSITIVE_TERMS } from "@/config/sensitive";

/**
 * Event filtering for `track()` (B10). Pure, so it is unit tested without a browser.
 *
 * Everywhere: parameter values that name a health condition, disability, orientation or
 * benefits program are dropped, and only strings and numbers pass.
 * On sensitive paths: remarketing-type events are skipped, every parameter except the few
 * essential UI ones is dropped, and `ads_restricted: 1` is added so the tag manager can
 * block ad pixels on that event.
 */

/** Events that exist to build audiences or measure engagement for ad targeting. Never sent from sensitive pages. */
export const REMARKETING_EVENTS: ReadonlySet<string> = new Set([
  "exit_intent_shown",
  "cta_view",
  "scroll_depth",
  "page_engaged",
  "tool_view",
  "content_view",
  "view_item",
  "lead_form_view",
  "remarketing",
]);
const REMARKETING_PREFIXES = ["remarketing_", "audience_", "retarget"];

/** Parameters kept on sensitive pages: UI placement only, never content or answers. */
export const ESSENTIAL_PARAMS: ReadonlySet<string> = new Set(["from", "location", "cta_id"]);

export function isRemarketingEvent(event: string): boolean {
  return REMARKETING_EVENTS.has(event) || REMARKETING_PREFIXES.some((p) => event.startsWith(p));
}

export type EventProps = Record<string, string | number>;

/** Returns the object to push to the dataLayer, or null when the event must not be sent at all. */
export function filterEvent(event: string, props: EventProps, pathname: string): ({ event: string } & Record<string, string | number>) | null {
  const sensitive = isSensitivePath(pathname);
  if (sensitive && isRemarketingEvent(event)) return null;
  const out: { event: string } & Record<string, string | number> = { event };
  for (const [k, v] of Object.entries(props)) {
    if (typeof v !== "string" && typeof v !== "number") continue;
    if (k === "event") continue;
    if (sensitive && !ESSENTIAL_PARAMS.has(k)) continue;
    if (typeof v === "string" && SENSITIVE_TERMS.test(v)) continue;
    if (SENSITIVE_TERMS.test(k)) continue;
    out[k] = v;
  }
  if (sensitive) out.ads_restricted = 1;
  return out;
}
