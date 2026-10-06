import Link from "next/link";
import { can } from "@/server/auth/policy";
import { leadHealthReport } from "@/server/leadHealth";
import { currentSession } from "@/server/runtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lead health", robots: { index: false, follow: false } };

const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);
const num = (n: number | null, unit = "") => (n === null ? "n/a" : `${Math.round(n * 10) / 10}${unit}`);
const when = (iso: string) => `${iso.replace("T", " ").slice(0, 16)} UTC`;

export default async function LeadHealthPage() {
  const session = await currentSession();
  if (!session) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  const { actor, db } = session;
  if (!can(actor, "view_lead_health")) return <p>Lead health is for platform and firm admins.</p>;
  const r = await leadHealthReport(db, actor);
  const s = r.speedToLead;

  return (
    <>
      <h1>Lead health</h1>
      <p className="notice">
        Whether new leads reach the CRM middleware, and how fast they get a first contact. Ids and counts only, no client details.
        Rates and speed figures are hidden under 5 deliveries or leads.
      </p>

      <h2>Webhook delivery</h2>
      <table>
        <thead><tr><th>Window</th><th>Deliveries</th><th>Delivered</th><th>Retrying</th><th>Abandoned</th><th>Failure rate</th></tr></thead>
        <tbody>{r.windows.map((w) => <tr key={w.label}><td>Last {w.label}</td><td>{w.total}</td><td>{w.delivered}</td><td>{w.failed}</td><td>{w.abandoned}</td><td>{pct(w.failureRate)}</td></tr>)}</tbody>
      </table>
      <p>
        {r.openFailures.failed + r.openFailures.abandoned === 0
          ? "No open failures."
          : `Open now, any age: ${r.openFailures.failed} retrying, ${r.openFailures.abandoned} abandoned and needing a person.`}
      </p>

      <h2>Recent failures</h2>
      {r.recentFailures.length === 0 ? (
        <p>None.</p>
      ) : (
        <table>
          <thead><tr><th>Last attempt</th><th>Lead</th><th>Event</th><th>Status</th><th>HTTP</th><th>Attempts</th><th>Error</th></tr></thead>
          <tbody>
            {r.recentFailures.map((f) => (
              <tr key={f.id}>
                <td>{when(f.lastAttemptAt)}</td>
                <td>{f.leadId}</td>
                <td>{f.event}</td>
                <td>{f.status}</td>
                <td>{f.httpStatus ?? "none"}</td>
                <td>{f.attempts}</td>
                <td>{f.error ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Speed to lead</h2>
      <p>
        Last {s.windowDays} days · {s.leads} leads · median {num(s.medianMinutes, " min")} · 90th percentile {num(s.p90Minutes, " min")} · {s.uncontacted} not yet contacted
        {s.suppressed ? " · too few contacted leads to show a median" : ""}
      </p>
      <p className="notice">Minutes from the lead arriving to the first outbound call, text or email, or the contacted stage, whichever came first.</p>
    </>
  );
}
