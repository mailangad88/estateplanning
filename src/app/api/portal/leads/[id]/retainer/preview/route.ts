import { readJson, withActor } from "@/server/http";
import { prepareDraft } from "@/server/services/engagement";
import { planText } from "@/server/services/retainerTemplates";
import { draftInput } from "../shared";

/** The filled letter for the lead page preview: nothing is saved. Missing fields come back for the lawyer to fill. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const p = await prepareDraft(db, actor, draftInput(id, await readJson(request)));
    return {
      template: p.template ? { id: p.template.id, name: p.template.name, version: p.template.version, pdf: p.template.pdf ? { name: p.template.pdf.name, sizeBytes: p.template.pdf.sizeBytes } : null } : null,
      segments: p.segments,
      missing: p.missing,
      feeCents: p.feeCents,
      packageName: p.pkg.name,
      payment: planText(p.terms?.plan) ?? null,
    };
  });
}
