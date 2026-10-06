import { readJson, withActor } from "@/server/http";
import { previewPageEdit } from "@/server/content/pageApprovals";

/** Renders edited markdown with the site's own renderer. Writes nothing. */
export async function POST(request: Request) {
  return withActor(request, async ({ actor }) => {
    const body = await readJson<{ path?: unknown; body?: unknown }>(request);
    return await previewPageEdit(actor, String(body.path ?? ""), String(body.body ?? ""));
  });
}
