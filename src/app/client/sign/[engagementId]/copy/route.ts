import { ForbiddenError, requireMfa } from "@/server/auth/policy";
import { signedCopyInput } from "@/server/esign/builtin";
import { renderSignedCopyHtml } from "@/server/esign/signedCopy";
import { currentActor, getDb } from "@/server/runtime";
import { signingView } from "@/server/services/signing";

/** "Download your copy": the signed agreement and signature certificate as a printable page. */
export async function GET(request: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = await params;
  const actor = await currentActor();
  if (!actor) return new Response("Please sign in to see your agreement.", { status: 401 });
  try {
    requireMfa(actor);
    const service = await getDb();
    const view = await signingView(service, actor, engagementId);
    if (view.state !== "signed" && view.state !== "partly_signed") return new Response("This agreement has not been signed yet.", { status: 404 });
    const e = (await service.engagements.get(engagementId))!;
    const html = renderSignedCopyHtml(await signedCopyInput(service, e), {
      printBar: true,
      attachmentUrl: e.attachment ? `/api/client/engagements/${e.id}/attachment` : undefined,
    });
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
        ...(download ? { "content-disposition": `attachment; filename="signed-engagement-agreement.html"` } : {}),
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) return new Response("You do not have access to this agreement.", { status: 403 });
    return new Response("We could not find this agreement.", { status: 404 });
  }
}
