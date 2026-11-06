import { assertCan, canOnRetainerTemplate } from "@/server/auth/policy";
import { withActor } from "@/server/http";
import { getDb } from "@/server/runtime";
import { getBlob } from "@/server/storage/blobs";

/** The firm's attached agreement PDF, for its own staff. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const t = await db.retainerTemplates.get(decodeURIComponent(id));
    if (!t?.pdf) throw new Error("No PDF on this template");
    assertCan(canOnRetainerTemplate(actor, "view", t));
    const stored = await getBlob(await getDb(), t.pdf.storageKey);
    if (!stored) throw new Error("The PDF could not be found");
    return new Response(new Uint8Array(stored.bytes), {
      headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${t.pdf.name.replace(/"/g, "")}"`, "cache-control": "private, no-store" },
    });
  });
}
