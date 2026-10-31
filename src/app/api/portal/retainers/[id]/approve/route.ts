import { withActor } from "@/server/http";
import { approveTemplate } from "@/server/services/retainerTemplates";

/** "Approved by me": an attorney of the firm approves this exact version, as themselves. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(
    request,
    async ({ db, actor }) => {
      const t = await approveTemplate(db, actor, decodeURIComponent(id));
      return { id: t.id, status: t.status };
    },
    { scopedWrites: true },
  );
}
