import { readJson, withActor } from "@/server/http";
import { saveSettings } from "@/server/studio/schedule";
import { getStudioStore } from "@/server/studio/store";

/** Publish slots: { longSlots: ["10:00"], shortSlots: [...], bufferDays }. */
export async function PUT(request: Request) {
  return withActor(request, async ({ actor }) => {
    const body = await readJson<{ longSlots?: unknown; shortSlots?: unknown; bufferDays?: unknown }>(request);
    const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : String(v ?? "").split(/[\s,]+/));
    return saveSettings(await getStudioStore(), actor, { longSlots: list(body.longSlots), shortSlots: list(body.shortSlots), bufferDays: body.bufferDays === undefined ? undefined : Number(body.bufferDays) });
  });
}
