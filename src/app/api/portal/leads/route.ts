import { MATTER_LABELS } from "@/server/services/leads";
import { visibleLeads } from "@/server/portal/caseView";
import { withActor } from "@/server/http";

/** Leads the signed-in user can see. Open offers list only non-confidential fields. */
export async function GET(request: Request) {
  return withActor(request, ({ db, actor }) => ({
    leads: visibleLeads(db, actor).map(({ lead, access }) => ({
      id: lead.id,
      access,
      matterType: MATTER_LABELS[lead.matterType],
      state: lead.state,
      urgent: lead.urgent,
      stage: lead.stage,
      summary: lead.offerSummary,
      createdAt: lead.createdAt,
    })),
  }));
}
