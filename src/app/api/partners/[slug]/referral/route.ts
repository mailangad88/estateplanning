import { NextResponse } from "next/server";
import { partnerReferralSchema } from "@/lib/partners";
import { deliverAndLog } from "@/server/leadDelivery";
import { getDb } from "@/server/runtime";
import { ConsentRequiredError, submitPartnerReferral } from "@/server/services/partners";

/**
 * Public referral form on a partner's co-branded page. The partner confirms the person agreed to be referred
 * (clientConsent); without that confirmation nothing is stored. The response never says anything about the person.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = partnerReferralSchema.safeParse(json);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]));
    return NextResponse.json({ error: "Please check the highlighted fields", fields }, { status: 422 });
  }
  // Honeypot filled: answer like a success so bots learn nothing, but drop it.
  if (parsed.data.website) return NextResponse.json({ ok: true });

  const db = await getDb();
  const partner = (await db.partners.list(undefined, { slug }))[0];
  if (!partner || partner.status !== "active") return NextResponse.json({ error: "This page is not accepting referrals" }, { status: 404 });
  try {
    const { record } = await submitPartnerReferral(db, partner, parsed.data, {
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: request.headers.get("user-agent"),
      pageUrl: request.headers.get("referer") ?? `/partners/${partner.slug}`,
    });
    // The CRM copy follows the same path as website leads. The portal already has the lead, so a failure here loses nothing.
    await deliverAndLog(getDb, record).catch((err) =>
      console.error("partner referral delivery failed", { id: record.id, error: err instanceof Error ? err.message : String(err) }),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ConsentRequiredError) return NextResponse.json({ error: err.message, fields: { clientConsent: err.message } }, { status: 422 });
    console.error("partner referral failed", { slug, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "We could not save the referral. Please call us." }, { status: 502 });
  }
}
