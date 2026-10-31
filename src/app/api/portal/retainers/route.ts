import { z } from "zod";
import { readJson, withActor } from "@/server/http";
import { getDb } from "@/server/runtime";
import { listFirmTemplates, saveTemplateVersion } from "@/server/services/retainerTemplates";

const Attachment = z.object({ name: z.string().min(1).max(200), storageKey: z.string().min(1).max(300), sha256: z.string().regex(/^[0-9a-f]{64}$/), sizeBytes: z.number().int().positive() });
const Save = z.object({
  templateKey: z.string().min(1).max(80).optional(),
  name: z.string().max(200),
  matterTypes: z.array(z.string()).max(10),
  body: z.string().max(60_000),
  pdf: Attachment.nullable().optional(),
});

export async function GET(request: Request) {
  return withActor(request, async ({ db, actor }) => ({ templates: await listFirmTemplates(db, actor) }));
}

/** Saves a new version (a draft). Runs in the user's RLS session so the database also keeps it to their firm. */
export async function POST(request: Request) {
  return withActor(
    request,
    async ({ db, actor }) => {
      const input = Save.parse(await readJson(request));
      const t = await saveTemplateVersion(db, actor, input, new Date(), await getDb());
      return { id: t.id, version: t.version, status: t.status };
    },
    { scopedWrites: true },
  );
}
