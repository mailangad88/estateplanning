import { z } from "zod";
import { readJson, withActor } from "@/server/http";
import { inviteSpouse } from "@/server/services/coSigner";

const Body = z.object({ email: z.string().max(200).optional() });

/** The office sends (or resends) the second client their own signing invite; an email given records or corrects it first. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const { email } = Body.parse(await readJson(request));
    return inviteSpouse(db, actor, id, email?.trim() || undefined);
  });
}
