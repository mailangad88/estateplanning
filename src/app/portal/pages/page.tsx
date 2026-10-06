import Link from "next/link";
import { can } from "@/server/auth/policy";
import { BATCH_SIZE, listPageQueue, type PageRow } from "@/server/content/pageApprovals";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import { BatchApprove, SingleApprove, type PageItem } from "./PageApprove";

export const dynamic = "force-dynamic";
export const metadata = { title: "Page review", robots: { index: false, follow: false } };

/** How many batches (or high-risk pages) to show at once. The rest wait below the fold. */
const SHOW = { low: 3, medium: 10, high: 10 };

function item(r: PageRow): PageItem {
  return {
    path: r.path,
    title: r.title,
    hash: r.hash ?? "",
    words: r.words,
    reasons: r.reasons,
    aiFlag: r.aiFlag,
    changedSince: r.status === "changed" ? r.latest?.approvedAt.slice(0, 10) : undefined,
  };
}

export default async function PageReview() {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "approve_pages")) return <p>Only attorneys can approve site pages for publication.</p>;
  const db = scopedDb(await getDb(), actor);
  const { rows, counts, batches, opensPullRequests } = await listPageQueue(db, actor);
  const waiting = rows.filter((r) => r.status === "approved");
  const remaining = (n: number, shown: number, unit: string) => (n > shown ? <p className="notice">{n - shown} more {unit} after these. They appear here as you approve the ones above.</p> : null);

  return (
    <>
      <h1>Page review</h1>
      <p className="lead">Approve site pages for publication. Nothing is indexed until you approve it.</p>
      <p className="notice">
        An approval covers the page exactly as it reads now. If the page is edited afterwards, it shows as changed and needs a new approval.
        The risk tier only suggests how carefully to read; you decide. Every approval is recorded with your name and the date.
      </p>
      {actor.role !== "attorney" && (
        <p className="error" role="note">You are signed in as a platform admin. Your approvals are recorded, but only an attorney&apos;s approval is written into a page and published.</p>
      )}

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Summary</h2>
        <table>
          <thead>
            <tr><th scope="col">To review</th><th scope="col">Pages</th><th scope="col">How</th></tr>
          </thead>
          <tbody>
            <tr><td>Low risk</td><td>{counts.tiers.low}</td><td>Batches of {BATCH_SIZE.low}: skim each page, untick any you are unsure of</td></tr>
            <tr><td>Medium risk</td><td>{counts.tiers.medium}</td><td>One at a time: check the steps and the hedges</td></tr>
            <tr><td>High risk</td><td>{counts.tiers.high}</td><td>One at a time: check each figure and statute</td></tr>
          </tbody>
        </table>
        <p>
          <strong>{counts.status.pending}</strong> pending · <strong>{counts.status.changed}</strong> changed since you approved them ·{" "}
          <strong>{counts.status.approved}</strong> approved, waiting to go live · <strong>{counts.status.published}</strong> live
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Low risk ({counts.tiers.low})</h2>
        <p className="notice">Definitions, plain comparisons and basics. Open each page, read it, then approve the batch.</p>
        {batches.low.length === 0 && <p>Nothing to review.</p>}
        {batches.low.slice(0, SHOW.low).map((b, i) => (
          <BatchApprove key={b.map((r) => r.path).join("|")} label={`Low-risk batch ${i + 1}`} pages={b.map(item)} />
        ))}
        {remaining(batches.low.length, SHOW.low, "batches")}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Medium risk ({counts.tiers.medium})</h2>
        <p className="notice">How a process usually works, with state variation flagged. One page at a time.</p>
        {batches.medium.length === 0 && <p>Nothing to review.</p>}
        {batches.medium.slice(0, SHOW.medium).map(([r]) => <SingleApprove key={r.path} page={item(r)} canEdit={opensPullRequests} />)}
        {remaining(batches.medium.length, SHOW.medium, "pages")}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>High risk ({counts.tiers.high})</h2>
        <p className="notice">Costs, tax, Medicaid, disputes, capacity and every state guide. One page at a time; there is no batch approval here.</p>
        {batches.high.length === 0 && <p>Nothing to review.</p>}
        {batches.high.slice(0, SHOW.high).map(([r]) => <SingleApprove key={r.path} page={item(r)} canEdit={opensPullRequests} />)}
        {remaining(batches.high.length, SHOW.high, "pages")}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Approved, waiting to go live ({waiting.length})</h2>
        {opensPullRequests ? (
          <p className="notice">
            Each approval opens a pull request that sets the page&apos;s review flag (with your edits, if you made any). The page goes live once the
            checks pass and the pull request is merged. Nothing is merged automatically.
          </p>
        ) : (
          <>
            <p className="notice">
              Will be applied by <code>npm run review:apply</code>: the site reads its content from the code repository, so someone downloads the
              approvals and runs <code>npm run review:apply -- --from &lt;file&gt;</code>, then commits the result. The script skips any page that
              changed after you approved it. Editing pages here needs GitHub publishing to be set up.
            </p>
            <p><a className="button secondary" href="/api/portal/page-approvals/export">Download approvals (JSON)</a></p>
          </>
        )}
        {waiting.length > 0 && (
          <details>
            <summary>Show {waiting.length} approved pages</summary>
            <ul>
              {waiting.map((r) => (
                <li key={r.path}>
                  <a href={r.path} target="_blank" rel="noreferrer">{r.title}</a> · {r.tier} · approved {r.approval?.approvedAt.slice(0, 10)} by {r.approval?.approverName}
                  {r.approval?.editedFromHash ? " · with your edits" : ""}
                  {r.approval?.note ? ` · ${r.approval.note}` : ""}
                  {" · "}
                  {r.approval?.prUrl ? <a href={r.approval.prUrl} target="_blank" rel="noreferrer">pull request</a> : r.approval?.approverRole === "attorney" ? "will be applied by npm run review:apply" : "recorded only (not an attorney approval)"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <p><Link href="/portal">Back to the portal</Link></p>
    </>
  );
}
