import { z } from "zod";
import { readJson, withActor } from "@/server/http";
import { bookConsult } from "@/server/services/caseWork";

const Body = z.object({
  at: z.string().datetime({ offset: true }),
  type: z.enum(["video", "phone", "office"]),
});

/** Put a consult on the case (for example one booked on Cal.com or over the phone). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const body = Body.parse(await readJson(request));
    const consult = await bookConsult(db, actor, { leadId: id, ...body });
    return { ok: true, consultId: consult.id };
  });
}
