import Link from "next/link";
import { can } from "@/server/auth/policy";
import { funnelReport } from "@/server/analytics";
import { currentActor, getDb } from "@/server/runtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics", robots: { index: false, follow: false } };

const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);
const num = (n: number | null, unit = "") => (n === null ? "n/a" : `${Math.round(n * 10) / 10}${unit}`);
const usd = (c: number | null) => (c === null ? "n/a" : `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
const label = (s: string) => s.replaceAll("_", " ");

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "view_reports")) return <p>Reports are for marketing and admins.</p>;
  const sp = await searchParams;
  const to = sp.to ? new Date(sp.to) : new Date();
  const from = sp.from ? new Date(sp.from) : new Date(to.getTime() - 30 * 86_400_000);
  const db = await getDb();
  const r = await funnelReport(db, actor, { from, to });

  return (
    <>
      <h1>Analytics</h1>
      <p className="notice">{r.period.from.slice(0, 10)} to {r.period.to.slice(0, 10)} · {r.totalLeads} leads. Totals only, no client details. Rates are hidden for rows under 5 leads.</p>

      <h2>Funnel</h2>
      <table>
        <thead><tr><th>Stage</th><th>Reached</th><th>From previous</th></tr></thead>
        <tbody>{r.stages.map((s) => <tr key={s.stage}><td>{label(s.stage)}</td><td>{s.reached}</td><td>{pct(s.stepConversion)}</td></tr>)}</tbody>
      </table>
      <p>Exits: {Object.keys(r.exits).length ? Object.entries(r.exits).map(([k, v]) => `${label(k)} ${v}`).join(", ") : "none"}</p>

      <h2>By source</h2>
      <table>
        <thead><tr><th>Source</th><th>Campaign</th><th>Leads</th><th>Qualified</th><th>Consults</th><th>Signed</th><th>Paid</th><th>Qualified %</th><th>Signed %</th></tr></thead>
        <tbody>{r.bySource.map((s) => <tr key={`${s.source}/${s.campaign}`}><td>{s.source}</td><td>{s.campaign}</td><td>{s.leads}</td><td>{s.qualified}</td><td>{s.consultsBooked}</td><td>{s.retainersSigned}</td><td>{s.paid}</td><td>{pct(s.qualifiedRate)}</td><td>{pct(s.signedRate)}</td></tr>)}</tbody>
      </table>

      <h2>Return on ad spend</h2>
      <table>
        <tbody>
          <tr><td>Ad spend</td><td>{usd(r.roi.adSpendCents)}</td></tr>
          <tr><td>Fees collected</td><td>{usd(r.roi.revenueCents)}</td></tr>
          <tr><td>Cost per lead</td><td>{usd(r.roi.costPerLeadCents)}</td></tr>
          <tr><td>Cost per signed client</td><td>{usd(r.roi.costPerSignedClientCents)}</td></tr>
        </tbody>
      </table>

      <h2>By capture tool</h2>
      <table>
        <thead><tr><th>Tool</th><th>Leads</th><th>Signed</th><th>Signed %</th></tr></thead>
        <tbody>{r.byTool.map((t) => <tr key={t.tool}><td>{t.tool}</td><td>{t.leads}</td><td>{t.signed}</td><td>{pct(t.signedRate)}</td></tr>)}</tbody>
      </table>

      <h2>Speed to lead</h2>
      <p>Median {num(r.speedToLead.medianMinutes, " min")} · 90th percentile {num(r.speedToLead.p90Minutes, " min")} · within 5 minutes {pct(r.speedToLead.within5MinRate)} · {r.speedToLead.uncontacted} not yet contacted</p>

      <h2>Offers</h2>
      <p>{r.offers.total} offers · median accept {num(r.offers.medianAcceptMinutes, " min")} · SLA met {pct(r.offers.slaMetRate)} · {r.offers.timeouts} timeouts · declines: {Object.keys(r.offers.declinesByReason).length ? Object.entries(r.offers.declinesByReason).map(([k, v]) => `${label(k)} ${v}`).join(", ") : "none"}</p>
      <table>
        <thead><tr><th>Lawyer</th><th>Offered</th><th>Accepted</th><th>Declined</th><th>Expired</th><th>Median accept</th><th>SLA met</th></tr></thead>
        <tbody>{r.offers.perLawyer.map((l) => <tr key={l.lawyerId}><td>{l.lawyerName}</td><td>{l.offered}</td><td>{l.accepted}</td><td>{l.declined}</td><td>{l.expired}</td><td>{num(l.medianAcceptMinutes, " min")}</td><td>{pct(l.slaMetRate)}</td></tr>)}</tbody>
      </table>

      <h2>Consults</h2>
      <p>{r.consults.held} held · show rate {pct(r.consults.showRate)} · signed after consult {pct(r.consults.signedAfterConsultRate)}</p>
    </>
  );
}
