import { ForbiddenError } from "@/server/auth/policy";
import { buildCaseView } from "@/server/portal/caseView";
import { leadSnapshot } from "@/server/portal/leadSnapshot";
import { getDb, scopedDb } from "@/server/runtime";
import type { Actor } from "@/server/types";
import { LeadPanel } from "./LeadParts";

/** Renders the lead slide-over for `?lead=<id>` on a list page, or nothing when the viewer may not see it. */
export default async function LeadPanelSlot({ actor, leadId, closeHref }: { actor: Actor; leadId?: string; closeHref: string }) {
  if (!leadId) return null;
  const raw = await getDb();
  const db = scopedDb(raw, actor);
  try {
    const view = await buildCaseView(db, actor, leadId);
    const snap = await leadSnapshot(db, view, await raw.leads.get(leadId));
    return <LeadPanel view={view} snap={snap} closeHref={closeHref} />;
  } catch (err) {
    if (err instanceof ForbiddenError) return null;
    return null;
  }
}
