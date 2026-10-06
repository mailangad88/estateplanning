import { withActor, readJson } from "@/server/http";
import { registerDocument } from "@/server/services/caseWork";
import { clientLeadId } from "@/server/services/clientPortal";
import type { DocumentKind } from "@/server/types";

const KINDS: DocumentKind[] = ["existing_will", "trust", "deed", "beneficiary_form", "other"];

export async function POST(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    const b = await readJson<{ name?: string; kind?: string; contentType?: string; sizeBytes?: number }>(request);
    const leadId = await clientLeadId(db, actor);
    if (!leadId) throw new Error("No case found");
    const kind = KINDS.find((k) => k === b.kind) ?? "other";
    const doc = await registerDocument(db, actor, { leadId, name: String(b.name ?? "Document"), kind, contentType: String(b.contentType ?? ""), sizeBytes: Number(b.sizeBytes) });
    // TODO: return a signed upload URL for doc.storageKey so the browser can send the file bytes to storage.
    return { id: doc.id };
  });
}
