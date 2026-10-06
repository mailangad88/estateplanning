import Link from "next/link";
import { FEEDBACK_LABELS, PARTNER_TYPE_LABELS, giftLimits, usd } from "@/lib/partners";
import { SITE_URL } from "@/lib/seo";
import { can } from "@/server/auth/policy";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import { getPartnerFor, partnerFeedback, partnerSummary } from "@/server/services/partners";
import { GiftForm, PartnerStatus, ReferralControls } from "../Controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Referral partner", robots: { index: false, follow: false } };

export default async function PartnerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "view_partners")) return <p>Referral partners are for platform and firm admins.</p>;
  const service = await getDb();
  const db = scopedDb(service, actor);
  const partner = await getPartnerFor(db, actor, id);
  if (!partner) return <p>That partner was not found. <Link href="/portal/partners">Back to partners</Link></p>;
  const [summary, referrals, gifts, feedback] = await Promise.all([
    partnerSummary(db, service, id),
    db.partnerReferrals.list(undefined, { partnerId: id }),
    db.partnerGifts.list(undefined, { partnerId: id }),
    partnerFeedback(service, id),
  ]);
  const feedbackById = new Map(feedback.map((f) => [f.referralId, f]));
  const limits = giftLimits();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <p><Link href="/portal/partners">All partners</Link></p>
      <h1>{partner.org}</h1>
      <p className="lead">{partner.name} · {PARTNER_TYPE_LABELS[partner.type]}</p>
      <p>
        Co-branded page: <code>{SITE_URL}/partners/{partner.slug}</code> (live while status is active)<br />
        Ref link: <code>{SITE_URL}/?ref={partner.refCode}</code>
      </p>
      {(!partner.policySignedDate || !partner.reciprocalAgreementOnFile) && (
        <p className="notice">
          {!partner.policySignedDate && "No signed referral partner policy on file. "}
          {!partner.reciprocalAgreementOnFile && "No reciprocal referral agreement on file; if there is one, record it and confirm it is non-exclusive."}
        </p>
      )}
      <PartnerStatus id={partner.id} status={partner.status} reciprocal={partner.reciprocalAgreementOnFile} nonexclusive={partner.agreementNonexclusive} />
      <p>
        {summary.referralsReceived} referrals · {summary.releasesGranted} releases granted · gifts this year {usd(summary.giftsYtdCents)} · {summary.disclosureMissing} referrals without the client disclosure recorded
      </p>

      <h2>Referrals</h2>
      <p className="notice">
        The partner may be told contacted, consult booked or engaged, only while the release is granted, and never anything else about the client.
        The last column is exactly what may be shared today.
      </p>
      {referrals.length === 0 ? <p>No referrals yet.</p> : (
        <table>
          <thead><tr><th>Received</th><th>Lead</th><th>How</th><th>Client agreed to referral</th><th>Disclosure, release, value question</th><th>Release status</th><th>May tell the partner</th></tr></thead>
          <tbody>
            {referrals.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((r) => {
              const f = feedbackById.get(r.id);
              return (
                <tr key={r.id}>
                  <td>{r.createdAt.slice(0, 10)}</td>
                  <td>{r.leadId ? <Link href={`/portal/leads/${r.leadId}`}>{r.leadId.slice(0, 8)}</Link> : "No lead"}</td>
                  <td>{r.origin === "partner_form" ? "Partner form" : "Link visit"}</td>
                  <td>{r.clientConsent ? "Yes" : "Not applicable"}</td>
                  <td>
                    <ReferralControls id={r.id} releaseStatus={r.releaseStatus} disclosureGiven={r.disclosureGiven} valueLinked={r.valueLinked} />
                    {r.valueLinked === "yes" && <p className="error">Value linked: attorney review needed. {r.valueNote}</p>}
                  </td>
                  <td>{r.releaseStatus}</td>
                  <td>{f?.released ? (f.status ? FEEDBACK_LABELS[f.status] : "Referral received") : "Nothing (thank-you only)"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h2>Gift log</h2>
      <p className="notice">
        Limits: {usd(limits.perGiftCents)} per gift and {usd(limits.annualCents)} per partner per year (set by PARTNER_GIFT_LIMIT_USD and PARTNER_GIFT_ANNUAL_LIMIT_USD). These are the firm&apos;s own ceilings, not legal thresholds.
      </p>
      {gifts.length === 0 ? <p>No gifts logged.</p> : (
        <table>
          <thead><tr><th>Date</th><th>Gift</th><th>Value</th><th>Status</th></tr></thead>
          <tbody>
            {gifts.sort((a, b) => b.date.localeCompare(a.date)).map((g) => (
              <tr key={g.id}>
                <td>{g.date}</td>
                <td>{g.description}{g.reviewNote && <><br /><span className="notice">{g.reviewNote}</span></>}</td>
                <td>{usd(g.valueCents)}</td>
                <td>{g.status === "flagged" ? <><strong>Flagged for attorney review</strong><ul>{g.flags.map((f) => <li key={f}>{f}</li>)}</ul></> : "OK"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <GiftForm partnerId={partner.id} today={today} />
    </>
  );
}
