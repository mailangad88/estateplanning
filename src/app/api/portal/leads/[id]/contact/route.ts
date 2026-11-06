import { z } from "zod";
import { readJson, withActor } from "@/server/http";
import { CONTACT_CHANNELS, CONTACT_RESULTS, logContact } from "@/server/services/leadWork";

const Body = z.object({
  channel: z.enum(CONTACT_CHANNELS),
  direction: z.enum(["outbound", "inbound"]),
  result: z.enum(CONTACT_RESULTS),
  note: z.string().max(2000).optional(),
});

/** Log a call, voicemail, text or email with a lead. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const body = Body.parse(await readJson(request));
    const { attempts, lead } = await logContact(db, actor, id, body);
    return { ok: true, attempts, stage: lead.stage };
  });
}
