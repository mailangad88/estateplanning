import { readJson, withActor } from "@/server/http";
import { saveSeries } from "@/server/studio/schedule";
import { getStudioStore } from "@/server/studio/store";
import type { Recurrence } from "@/server/studio/types";

/** Switch a series on or off, or change its recurrence: { enabled?, recurrence? }. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ actor }) => {
    const body = await readJson<{ enabled?: unknown; recurrence?: Partial<Recurrence> }>(request);
    const settings = await saveSeries(await getStudioStore(), actor, id, {
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      recurrence: body.recurrence && typeof body.recurrence === "object" ? body.recurrence : undefined,
    });
    return settings.series.find((s) => s.id === id);
  });
}
