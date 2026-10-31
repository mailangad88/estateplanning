import { withActor } from "@/server/http";
import { getDb } from "@/server/runtime";
import { signingView } from "@/server/services/signing";
import { getBlob } from "@/server/storage/blobs";

/** The firm's agreement PDF attached to this engagement, for the client on the case (and staff with full access). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ actor }) => {
    const service = await getDb();
    await signingView(service, actor, id); // access check: the client on this case, or full-access staff
    const e = await service.engagements.get(id);
    if (!e?.attachment) throw new Error("No attached agreement");
    const stored = await getBlob(service, e.attachment.storageKey);
    if (!stored || stored.blob.sha256 !== e.attachment.sha256) throw new Error("The attached agreement could not be verified");
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(new Uint8Array(stored.bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `${download ? "attachment" : "inline"}; filename="${e.attachment.name.replace(/"/g, "")}"`,
        "cache-control": "private, no-store",
      },
    });
  });
}
