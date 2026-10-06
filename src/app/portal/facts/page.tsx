import Link from "next/link";
import { can } from "@/server/auth/policy";
import { factAlerts, listFactRows } from "@/server/facts/verify";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import type { FactStatus } from "@/lib/facts";
import { FactApprove } from "./FactApprove";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fact verification", robots: { index: false, follow: false } };

const SECTIONS: { status: FactStatus; title: string; blurb: string }[] = [
  { status: "changed", title: "Changed since approval", blurb: "The value on the site changed after you approved it. It stays off the site until you approve the new value." },
  { status: "stale", title: "Stale", blurb: "Approved, but a change date or January re-indexing has passed, or it was last confirmed over 12 months ago." },
  { status: "pending", title: "Pending", blurb: "Never approved. Open the source, confirm the value, then approve." },
  { status: "approved", title: "Approved", blurb: "Approved and current." },
];

export default async function FactQueue() {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "verify_facts")) return <p>Only attorneys and platform admins can verify facts.</p>;
  const db = scopedDb(await getDb(), actor);
  const now = new Date();
  const rows = await listFactRows(db, actor, now);
  const alerts = await factAlerts(db, now);

  return (
    <>
      <h1>Fact verification</h1>
      <p className="lead">Approve each state fact and dollar figure against its source before it can be published.</p>
      <p className="notice">
        An approval covers the exact value shown. If the value changes, it needs a new approval. Every approval is recorded with your name and the date.
      </p>
      {alerts.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Alerts ({alerts.length})</h2>
          <ul>
            {alerts.slice(0, 40).map((a, i) => (
              <li key={`${a.factId}-${a.kind}-${i}`}><strong>{a.severity === "expired" ? "Expired" : "Heads up"}</strong> · {a.factId}: {a.message}</li>
            ))}
          </ul>
        </section>
      )}
      {SECTIONS.map(({ status, title, blurb }) => {
        const list = rows.filter((r) => r.status === status);
        return (
          <section key={status} style={{ marginBottom: 24 }}>
            <h2>{title} ({list.length})</h2>
            <p className="notice">{blurb}</p>
            {status === "approved" ? (
              <details>
                <summary>Show {list.length} approved facts</summary>
                <ul>{list.map((r) => <li key={r.fact.id}>{r.fact.id} · approved {r.verification?.approvedAt.slice(0, 10)} by {r.verification?.approvedBy}</li>)}</ul>
              </details>
            ) : (
              list.map((r) => (
                <article key={r.fact.id} className="card" style={{ marginBottom: 12 }}>
                  <h3 style={{ marginTop: 0 }}>{r.fact.label}{r.fact.state ? ` (${r.fact.state})` : ""} <span className="notice">{r.fact.id}</span></h3>
                  <p>{r.fact.value}</p>
                  {status === "changed" && r.verification && <p><strong>Approved value (v{r.verification.version}):</strong> {r.verification.approvedValue}</p>}
                  <p className="notice">
                    As of {r.fact.asOf} · confidence: {r.fact.confidence}{r.fact.dollar ? " · dollar figure" : ""} · <a href={r.fact.source} target="_blank" rel="noreferrer noopener">source</a>
                    {r.fact.changeDate ? ` · changes ${r.fact.changeDate}` : ""}{r.fact.annualIndexing ? " · indexed every January" : ""}
                  </p>
                  {r.alerts.length > 0 && <ul>{r.alerts.map((a) => <li key={a.kind}>{a.message}</li>)}</ul>}
                  <FactApprove factId={r.fact.id} value={r.fact.value} needsNote={r.fact.confidence === "unverified"} label={r.fact.label} />
                </article>
              ))
            )}
          </section>
        );
      })}
    </>
  );
}
