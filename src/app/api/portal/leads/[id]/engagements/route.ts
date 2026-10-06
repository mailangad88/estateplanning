import { draftEngagement, type DraftInput } from "@/server/services/engagement";
import { readJson, withActor } from "@/server/http";

/** The assigned attorney or their paralegal drafts the engagement after the consult. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const input = await readJson<Omit<DraftInput, "leadId">>(request);
    const e = await draftEngagement(db, actor, { ...input, leadId: id });
    return { id: e.id, status: e.status, letter: e.letter };
  });
}
