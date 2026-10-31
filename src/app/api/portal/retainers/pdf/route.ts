import { withActor } from "@/server/http";
import { uploadAgreementPdf } from "@/server/services/retainerTemplates";
import { MAX_AGREEMENT_PDF_BYTES } from "@/server/storage/blobs";

/** Multipart upload of the firm's own standard agreement (PDF, up to 5 MB). Stored as the service role after the policy check. */
export async function POST(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    const len = Number(request.headers.get("content-length") ?? 0);
    if (len > MAX_AGREEMENT_PDF_BYTES + 64_000) throw new Error("The PDF must be under 5 MB");
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") throw new Error("Choose a PDF to upload");
    const bytes = new Uint8Array(await file.arrayBuffer());
    return await uploadAgreementPdf(db, actor, { name: file.name, bytes });
  });
}
