import Link from "next/link";
import { PARTNER_TYPE_LABELS, usd } from "@/lib/partners";
import { can } from "@/server/auth/policy";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import { listPartnersFor, partnerSummary } from "@/server/services/partners";
import { PartnerCreate } from "./Controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Referral partners", robots: { index: false, follow: false } };

export default async function PartnersPage() {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "view_partners")) return <p>Referral partners are for platform and firm admins.</p>;
  const service = await getDb();
  const db = scopedDb(service, actor);
  const partners = await listPartnersFor(db, actor);
  const rows = await Promise.all(partners.map(async (p) => ({ p, s: await partnerSummary(db, service, p.id) })));

  return (
    <>
      <h1>Referral partners</h1>
      <p className="lead">Who refers to the firm, what the firm has logged for them, and what each client has allowed us to tell them.</p>
      <p className="notice">
        The firm pays nothing for referrals, in either direction (Rule 7.2(b)). Partners are told only that we thank them, unless the client has
        signed a release. Consult and engaged counts include released referrals only.
      </p>
      {rows.length === 0 ? <p>No partners yet.</p> : (
        <table>
          <thead>
            <tr><th>Partner</th><th>Type</th><th>Status</th><th>Ref code</th><th>Referrals</th><th>Releases granted</th><th>Consults (released)</th><th>Engaged (released)</th><th>Gifts this year</th></tr>
          </thead>
          <tbody>
            {rows.map(({ p, s }) => (
              <tr key={p.id}>
                <td><Link href={`/portal/partners/${p.id}`}>{p.org}</Link><br /><span className="notice">{p.name}</span></td>
                <td>{PARTNER_TYPE_LABELS[p.type]}</td>
                <td>{p.status.replaceAll("_", " ")}</td>
                <td><code>{p.refCode}</code></td>
                <td>{s.referralsReceived}{s.disclosureMissing > 0 && <><br /><span className="notice">{s.disclosureMissing} without disclosure</span></>}</td>
                <td>{s.releasesGranted}</td>
                <td>{s.consultsBooked}</td>
                <td>{s.engaged}</td>
                <td>{usd(s.giftsYtdCents)}{s.flaggedGifts > 0 && <><br /><strong>{s.flaggedGifts} flagged</strong></>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <PartnerCreate firmId={actor.role === "firm_admin" ? actor.firmId : undefined} />
    </>
  );
}
