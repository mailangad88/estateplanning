import { readJson, withActor } from "@/server/http";
import { saveSettings } from "@/server/studio/schedule";
import { getStudioStore } from "@/server/studio/store";

/** Studio-wide settings: { bufferDays }. Series times live under /api/admin/studio/series/[id]. */
export async function PUT(request: Request) {
  return withActor(request, async ({ actor }) => {
    const body = await readJson<{ bufferDays?: unknown }>(request);
    return saveSettings(await getStudioStore(), actor, { bufferDays: body.bufferDays === undefined ? undefined : Number(body.bufferDays) });
  });
}
