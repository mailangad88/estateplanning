import { readJson, withActor } from "@/server/http";
import { MATTER_LABELS } from "@/server/services/leads";
import { setTemplateDefault } from "@/server/services/retainerTemplates";
import type { MatterType } from "@/server/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(
    request,
    async ({ db, actor }) => {
      const b = await readJson<{ matterType?: string; on?: boolean }>(request);
      if (!b.matterType || !(b.matterType in MATTER_LABELS)) throw new Error("Pick a matter type");
      const t = await setTemplateDefault(db, actor, decodeURIComponent(id), b.matterType as MatterType, b.on !== false);
      return { id: t.id, defaultFor: t.defaultFor };
    },
    { scopedWrites: true },
  );
}
