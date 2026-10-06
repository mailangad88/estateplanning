import { readJson, withActor } from "@/server/http";
import { approvePages } from "@/server/content/pageApprovals";

/** The attorney approves one page (optionally with edits), or one batch of low-risk pages, exactly as shown. */
export async function POST(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    const body = await readJson<{
      pages?: { path?: unknown; contentHash?: unknown }[];
      confirmed?: unknown;
      note?: unknown;
      edits?: { title?: unknown; description?: unknown; body?: unknown } | null;
    }>(request);
    const pages = Array.isArray(body.pages) ? body.pages.map((p) => ({ path: String(p?.path ?? ""), contentHash: String(p?.contentHash ?? "") })) : [];
    const edits = body.edits && typeof body.edits === "object"
      ? { title: String(body.edits.title ?? ""), description: String(body.edits.description ?? ""), body: String(body.edits.body ?? "") }
      : undefined;
    return await approvePages(db, actor, {
      pages,
      confirmed: body.confirmed === true,
      note: body.note === undefined ? undefined : String(body.note),
      edits,
    });
  }, { scopedWrites: true });
}
