import { readJson, withActor } from "@/server/http";
import { approveTemplate } from "@/server/nurture/templates";

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return withActor(request, async ({ db, actor }) => {
    const body = await readJson<{ contentHash: string; note?: string }>(request);
    return await approveTemplate(db, actor, { templateKey: key, contentHash: String(body.contentHash ?? ""), note: body.note === undefined ? undefined : String(body.note) });
  }, { scopedWrites: true });
}
