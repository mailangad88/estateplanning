import { withActor } from "@/server/http";
import { retireTemplate } from "@/server/services/retainerTemplates";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(
    request,
    async ({ db, actor }) => {
      const t = await retireTemplate(db, actor, decodeURIComponent(id));
      return { id: t.id, status: t.status };
    },
    { scopedWrites: true },
  );
}
