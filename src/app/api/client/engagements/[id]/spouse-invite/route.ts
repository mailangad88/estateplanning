import { z } from "zod";
import { readJson, withActor } from "@/server/http";
import { inviteSpouse } from "@/server/services/coSigner";

const Body = z.object({ email: z.string().min(3).max(200) });

/**
 * The first client gives the second client's email from the signing page, and the second client gets their own
 * invite. The link itself never comes back here: only the masked address it went to.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const { email } = Body.parse(await readJson(request));
    const r = await inviteSpouse(db, actor, id, email);
    return { firstName: r.firstName, emailHint: r.emailHint, delivered: r.delivered };
  });
}
