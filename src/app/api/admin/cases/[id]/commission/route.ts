import { markCommissionPaid, setCommissionRule } from "@/server/services/commissions";
import { caseFormPost } from "../../caseForm";

/**
 * POST (form or JSON). `intent`:
 * - "rule": { mode: "percent" | "flat" | "default", percent?, flat? (dollars), note? }
 * - "paid" / "unpaid": the office records a payout, or takes it back
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return caseFormPost(request, `/admin/cases/${encodeURIComponent(id)}#commission`, async ({ db, actor }, body) => {
    const intent = body.intent || "rule";
    if (intent === "paid" || intent === "unpaid") {
      await markCommissionPaid(db, actor, id, intent === "unpaid");
    } else if (intent === "rule") {
      const mode = body.mode as "percent" | "flat" | "default";
      const flat = body.flat ? Math.round(Number(String(body.flat).replace(/[$,\s]/g, "")) * 100) : undefined;
      await setCommissionRule(db, actor, id, { mode, percent: body.percent ? Number(body.percent) : undefined, flatCents: flat, note: body.note });
    } else {
      throw new Error("intent must be rule, paid or unpaid");
    }
    return [`commission_${intent}`, { ok: true }];
  });
}
