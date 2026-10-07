/**
 * Who may do what in the studio. Uses the portal's roles and sign-in (with its 2FA), so the
 * marketing area is the same login as the lead pipeline. Kept here rather than in
 * src/server/auth/policy.ts so the portal's policy table is untouched.
 */
import { ForbiddenError, requireMfa } from "@/server/auth/policy";
import type { Actor, Role } from "@/server/types";

export type StudioAction =
  | "view_studio" // see the board, scripts, previews and schedule
  | "make_videos" // generate drafts, edit scripts, send to review
  | "review_videos" // approve, request changes or reject (attorney approval is what counts)
  | "manage_channels"; // connect YouTube and Instagram, change slots

const RULES: Record<StudioAction, Role[]> = {
  view_studio: ["platform_admin", "marketing", "attorney", "firm_admin"],
  make_videos: ["platform_admin", "marketing"],
  review_videos: ["attorney", "platform_admin"],
  manage_channels: ["platform_admin"],
};

export function canStudio(actor: Actor, action: StudioAction): boolean {
  return RULES[action].includes(actor.role);
}

export function assertStudio(actor: Actor, action: StudioAction): void {
  if (!canStudio(actor, action)) throw new ForbiddenError("Your role cannot do that in the studio");
  requireMfa(actor);
}

/** Only an attorney's approval clears a video to publish; a platform admin's is recorded but does not count. */
export function approvalCounts(role: string): boolean {
  return role === "attorney";
}
