import Link from "next/link";
import { can } from "@/server/auth/policy";
import { conversionsReport } from "@/server/conversions/sweep";
import { currentSession } from "@/server/runtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ad conversions", robots: { index: false, follow: false } };

const when = (iso?: string) => (iso ? `${iso.replace("T", " ").slice(0, 16)} UTC` : "");
const NAMES = { google_ads: "Google Ads", meta: "Meta" } as const;

export default async function ConversionsPage() {
  const session = await currentSession();
  if (!session) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  const { actor, db } = session;
  if (!can(actor, "view_conversions")) return <p>Ad conversions are for platform admins and marketing.</p>;
  const r = await conversionsReport(db, actor);
  const reasons = Object.entries(r.skippedReasons);

  return (
    <>
      <h1>Ad conversions</h1>
      <p className="notice">
        CRM stage changes sent back to Google Ads and Meta: qualified lead, consult booked, consult held and retainer signed (with the fee when known).
        Each event is sent once. Leads who declined ad measurement and anyone on a sensitive track are never sent. Ids and values only, no client details.
      </p>

      <table>
        <thead><tr><th>Platform</th><th>Pending</th><th>Sent</th><th>Retrying</th><th>Abandoned</th><th>Skipped</th><th>Manual upload</th></tr></thead>
        <tbody>
          {(Object.keys(NAMES) as (keyof typeof NAMES)[]).map((p) => {
            const c = r.byProvider[p];
            return (
              <tr key={p}>
                <td>{NAMES[p]}</td><td>{c.pending}</td><td>{c.sent}</td><td>{c.failed}</td><td>{c.abandoned}</td><td>{c.skipped}</td>
                <td><a href={`/api/admin/conversions/export?provider=${p}`}>Download CSV</a></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="notice">
        The download is a preview and changes nothing. To record the rows as uploaded by hand, a platform admin posts to the same address
        (POST /api/admin/conversions/export with the provider), which marks them sent so the sweep never sends them again.
        Google wants one click-id type per file: add idKind=gbraid or idKind=wbraid for those.
      </p>
      {reasons.length > 0 && <p>Skipped because: {reasons.map(([k, n]) => `${k.replace(/_/g, " ")} (${n})`).join(", ")}.</p>}

      <h2>Recent</h2>
      {r.recent.length === 0 ? (
        <p>No conversions yet.</p>
      ) : (
        <table>
          <thead><tr><th>When</th><th>Lead</th><th>Platform</th><th>Conversion</th><th>Value</th><th>Status</th><th>Detail</th></tr></thead>
          <tbody>
            {r.recent.map((e) => (
              <tr key={e.id}>
                <td>{when(e.sentAt ?? e.occurredAt)}</td>
                <td>{e.leadId}</td>
                <td>{NAMES[e.provider]}</td>
                <td>{e.type.replace(/_/g, " ")}</td>
                <td>{e.valueCents === undefined ? "" : `$${(e.valueCents / 100).toLocaleString("en-US")}`}</td>
                <td>{e.status}{e.channel ? ` (${e.channel.replace("_", " ")})` : ""}</td>
                <td>{e.reason ?? ""}{e.attempts ? ` · ${e.attempts} attempts` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
