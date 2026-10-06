import { firm } from "@/config/firm";
import { recordCounselApproval } from "@/server/fees/admin";
import { readJson, withActor } from "@/server/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const body = await readJson<{ name: string; opinionRef: string; approvedOn: string }>(request);
    return await recordCounselApproval(db, actor, id, { name: String(body.name ?? ""), opinionRef: String(body.opinionRef ?? ""), approvedOn: String(body.approvedOn ?? "") }, firm.structure);
  }, { scopedWrites: true });
}
