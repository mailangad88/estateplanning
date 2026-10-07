import { readJson, withActor } from "@/server/http";
import { generateDrafts } from "@/server/studio/pipeline";
import { getStudioStore } from "@/server/studio/store";

/** Marketing asks for new drafts: { format: "long" | "short", count }. */
export async function POST(request: Request) {
  return withActor(request, async ({ actor }) => {
    const body = await readJson<{ format?: unknown; count?: unknown }>(request);
    const format = body.format === "long" ? "long" : "short";
    const count = Math.min(10, Math.max(1, Number(body.count) || 1));
    const made = await generateDrafts(await getStudioStore(), actor, { format, count });
    return { made: made.map((v) => ({ id: v.id, stage: v.stage, question: v.topic.question })) };
  });
}
