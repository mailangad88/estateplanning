import { assertCan, can } from "@/server/auth/policy";
import { readJson, withActor } from "@/server/http";
import { getDb } from "@/server/runtime";
import { createPartner, listPartnersFor, partnerSummary } from "@/server/services/partners";

export async function GET(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    assertCan(can(actor, "view_partners"), "Only admins see referral partners");
    const service = await getDb(); // summaries read lead stages, which a firm admin's session may not see
    const partners = await listPartnersFor(db, actor);
    return { partners: await Promise.all(partners.map(async (p) => ({ ...p, summary: await partnerSummary(db, service, p.id) }))) };
  });
}

export async function POST(request: Request) {
  return withActor(request, async ({ db, actor }) => ({ partner: await createPartner(db, actor, await readJson(request)) }), { scopedWrites: true });
}
