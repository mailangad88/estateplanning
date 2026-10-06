import { withActor, readJson } from "@/server/http";
import { holdReview, markReviewPosted, optOutOfReviews, releaseReviewHold, reviewTrackingReport } from "@/server/nurture/reviews";

/** GET /api/admin/reviews: the review-request tracking report (matter ids only, no client details). */
export async function GET(request: Request) {
  return withActor(request, ({ db, actor }) => reviewTrackingReport(db, actor));
}

/**
 * POST { leadId, action: "posted" | "opt_out" | "hold" | "release", code?, note? }
 * "posted" records a client's own "I posted" and stops the reminder. "opt_out" records a "do not ask me about reviews".
 * "hold" (GUARDIANSHIP or DISPUTE_HOLD, with a written note) and "release" are for the attorney's office. Every call is audited.
 */
export async function POST(request: Request) {
  return withActor(request, async ({ db, actor, request }) => {
    const b = await readJson<{ leadId?: string; action?: string; code?: string; note?: string }>(request);
    if (!b.leadId) throw new Error("leadId is required");
    const now = new Date();
    switch (b.action) {
      case "posted":
        return markReviewPosted(db, actor, b.leadId, now, "staff");
      case "opt_out":
        return optOutOfReviews(db, actor, b.leadId, now, "staff");
      case "hold":
        if (b.code !== "GUARDIANSHIP" && b.code !== "DISPUTE_HOLD") throw new Error("code must be GUARDIANSHIP or DISPUTE_HOLD");
        return holdReview(db, actor, b.leadId, b.code, b.note ?? "", now);
      case "release":
        return releaseReviewHold(db, actor, b.leadId, now);
      default:
        throw new Error("action must be posted, opt_out, hold or release");
    }
  });
}
