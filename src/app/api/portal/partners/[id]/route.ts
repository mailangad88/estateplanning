import { assertCan, can } from "@/server/auth/policy";
import { readJson, withActor } from "@/server/http";
import { getDb } from "@/server/runtime";
import { getPartnerFor, partnerFeedback, partnerSummary, updatePartner, type PartnerPatch } from "@/server/services/partners";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    assertCan(can(actor, "view_partners"), "Only admins see referral partners");
    const partner = await getPartnerFor(db, actor, id);
    assertCan(!!partner, "You do not have access to this partner");
    const service = await getDb(); // feedback reads lead stages, which a firm admin's session may not see
    return {
      partner,
      summary: await partnerSummary(db, service, id),
      referrals: await db.partnerReferrals.list(undefined, { partnerId: id }),
      gifts: await db.partnerGifts.list(undefined, { partnerId: id }),
      feedback: await partnerFeedback(service, id),
    };
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const body = await readJson<Record<string, unknown>>(request);
    const patch: PartnerPatch = {};
    if (typeof body.status === "string") patch.status = body.status as PartnerPatch["status"];
    if (typeof body.ownerId === "string") patch.ownerId = body.ownerId;
    if (typeof body.policySignedDate === "string") patch.policySignedDate = body.policySignedDate;
    if (typeof body.reciprocalAgreementOnFile === "boolean") patch.reciprocalAgreementOnFile = body.reciprocalAgreementOnFile;
    if (typeof body.agreementNonexclusive === "boolean") patch.agreementNonexclusive = body.agreementNonexclusive;
    if (typeof body.notes === "string") patch.notes = body.notes;
    return { partner: await updatePartner(db, actor, id, patch) };
  }, { scopedWrites: true });
}
