import Link from "next/link";
import { can } from "@/server/auth/policy";
import { devLoginEnabled } from "@/server/auth/session";
import { lawyerDashboard, visibleLeads } from "@/server/portal/caseView";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import { MATTER_LABELS } from "@/server/services/leads";
import type { Actor } from "@/server/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portal", robots: { index: false, follow: false } };

async function SignIn() {
  const db = await getDb();
  return (
    <>
      <h1>Portal sign-in</h1>
      {devLoginEnabled() ? (
        <form method="post" action="/api/auth/dev-login" className="card">
          <p className="notice">Development sign-in. Turned off in production, where sign-in goes through the identity provider with two-step verification.</p>
          <label className="field">
            Sign in as
            <select name="userId">
              {(await db.users.list((u) => u.active)).map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role.replace("_", " ")})</option>
              ))}
            </select>
          </label>
          <button className="button">Sign in</button>
        </form>
      ) : (
        <p><Link className="button" href="/portal/login">Sign in with your email</Link> Sign-in requires two-step verification.</p>
      )}
    </>
  );
}

function minutesLeft(iso: string) {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
}

export default async function PortalHome() {
  const actor = await currentActor();
  if (!actor) return <SignIn />;
  const db = scopedDb(await getDb(), actor);
  const user = await db.users.get(actor.userId);

  if (actor.role === "marketing") {
    const leads = await db.leads.list();
    const byStage = new Map<string, number>();
    for (const l of leads) byStage.set(l.stage, (byStage.get(l.stage) ?? 0) + 1);
    return (
      <>
        <h1>Funnel</h1>
        <p className="notice">Marketing sees totals only, never individual intake details.</p>
        <table><tbody>{[...byStage].map(([s, n]) => <tr key={s}><td>{s.replaceAll("_", " ")}</td><td>{n}</td></tr>)}</tbody></table>
        <p><Link href="/admin/analytics">Funnel analytics by source and tool</Link> · <Link href="/admin/seminars">Seminars and webinars</Link></p>
        <SignOut />
      </>
    );
  }

  const dash = actor.role === "attorney" ? await lawyerDashboard(db, actor) : null;
  const leads = (await visibleLeads(db, actor)).sort((a, b) => Number(b.lead.urgent) - Number(a.lead.urgent) || b.lead.createdAt.localeCompare(a.lead.createdAt));

  return (
    <>
      <h1>Hello, {user?.name}</h1>
      <Nav actor={actor} />
      {dash && (
        <>
          <h2>New offers</h2>
          {dash.offers.length === 0 ? <p>No open offers.</p> : (
            <ul>
              {dash.offers.map((o) => (
                <li key={o.assignmentId}>
                  <Link href={`/portal/leads/${o.leadId}`}>{o.offerSummary}</Link> · {minutesLeft(o.expiresAt)} min left to respond
                </li>
              ))}
            </ul>
          )}
          <h2>Today</h2>
          <p>
            {dash.todaysConsults.length} consults today · {dash.awaitingSignature.length} engagements awaiting signature · {dash.drafting.length} in drafting · {dash.overdueTasks.length} overdue tasks
          </p>
          <p className="notice">
            Accept speed {dash.metrics.avgAcceptMinutes ?? "n/a"} min · Show rate {dash.metrics.showRate === null ? "n/a" : `${Math.round(dash.metrics.showRate * 100)}%`} · Signed rate {dash.metrics.signedRate === null ? "n/a" : `${Math.round(dash.metrics.signedRate * 100)}%`}
          </p>
        </>
      )}
      <h2>{actor.role === "attorney" ? "Your cases" : "Leads"}</h2>
      {leads.length === 0 ? <p>Nothing here yet.</p> : (
        <table>
          <thead><tr><th>Lead</th><th>Matter</th><th>Stage</th><th>Access</th></tr></thead>
          <tbody>
            {leads.map(({ lead, access }) => (
              <tr key={lead.id}>
                <td><Link href={`/portal/leads/${lead.id}`}>{lead.urgent ? "Urgent · " : ""}{lead.id.slice(0, 8)}</Link></td>
                <td>{MATTER_LABELS[lead.matterType]}, {lead.state}</td>
                <td>{lead.exit ? `Closed (${lead.exit.reason.replaceAll("_", " ")})` : lead.stage.replaceAll("_", " ")}</td>
                <td>{access === "conflict_card" ? "Offer: conflict card only" : access}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <SignOut />
    </>
  );
}

function Nav({ actor }: { actor: Actor }) {
  const links: [string, string][] = [];
  if (can(actor, "work_intake_queue")) links.push(["/portal/queue", "Intake queue"]);
  if (can(actor, "view_reports")) links.push(["/admin/analytics", "Analytics"]);
  if (can(actor, "view_lead_health")) links.push(["/admin/lead-health", "Lead health"]);
  if (can(actor, "manage_firm_capacity")) links.push(["/admin/capacity", "Capacity"]);
  if (can(actor, "manage_seminars")) links.push(["/admin/seminars", "Seminars"]);
  if (can(actor, "manage_fee_rules")) links.push(["/admin/fees", "Fee rules"]);
  if (can(actor, "verify_facts")) links.push(["/portal/facts", "Fact verification"]);
  if (can(actor, "view_partners")) links.push(["/portal/partners", "Referral partners"]);
  if (!links.length) return null;
  return <p>{links.map(([href, text], i) => <span key={href}>{i > 0 && " · "}<Link href={href}>{text}</Link></span>)}</p>;
}

function SignOut() {
  return (
    <form method="post" action="/api/auth/logout"><button className="button secondary">Sign out</button></form>
  );
}
