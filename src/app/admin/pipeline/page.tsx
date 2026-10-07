import Link from "next/link";
import { can, ForbiddenError } from "@/server/auth/policy";
import { PIPELINE_COLUMNS, pipelineBoard, RETAINER_LABELS, type PipelineColumn, type PipelineFilters } from "@/server/portal/pipeline";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import styles from "./pipeline.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pipeline", robots: { index: false, follow: false } };

const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const ago = (iso: string, now: Date) => {
  const d = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

type Search = { lawyer?: string; column?: string; from?: string; to?: string };

function hrefWith(sp: Search, patch: Partial<Search>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `/admin/pipeline?${s}` : "/admin/pipeline";
}

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "view_pipeline")) return <p>The pipeline is for platform and firm admins.</p>;
  const sp = await searchParams;
  const column = PIPELINE_COLUMNS.some((c) => c.key === sp.column) ? (sp.column as PipelineColumn) : undefined;
  const filters: PipelineFilters = {
    lawyerId: sp.lawyer || undefined,
    column,
    from: sp.from && DAY_RE.test(sp.from) ? sp.from : undefined,
    to: sp.to && DAY_RE.test(sp.to) ? sp.to : undefined,
  };
  const now = new Date();
  let board;
  try {
    board = await pipelineBoard(scopedDb(await getDb(), actor), actor, filters, now);
  } catch (err) {
    if (err instanceof ForbiddenError) return <p>{err.message}</p>;
    throw err;
  }
  const signed = board.counts.retainer_signed + board.counts.paid;

  return (
    <div className={styles.board}>
      <p><Link href="/portal">← Portal</Link></p>
      <div className={styles.head}>
        <h1>Pipeline</h1>
        <p className="notice">
          {board.total} leads · {signed} with a signed retainer{actor.role === "firm_admin" ? " · your firm's leads only" : ""}
        </p>
      </div>

      <ul className={styles.counts} aria-label="Leads by stage">
        {PIPELINE_COLUMNS.map((c) => (
          <li key={c.key}>
            <Link className={`${styles.count} ${column === c.key ? styles.countOn : ""}`} href={hrefWith(sp, { column: column === c.key ? undefined : c.key })} aria-current={column === c.key ? "true" : undefined}>
              <span className={styles.countNum}>{board.counts[c.key]}</span>
              <span className={styles.countLabel}>{c.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <form className={styles.filters} method="get" action="/admin/pipeline">
        <label>
          Lawyer
          <select name="lawyer" defaultValue={filters.lawyerId ?? ""}>
            <option value="">All lawyers</option>
            {board.lawyers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label>
          Stage
          <select name="column" defaultValue={column ?? ""}>
            <option value="">All stages</option>
            {PIPELINE_COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <label>
          Came in from
          <input type="date" name="from" defaultValue={filters.from ?? ""} />
        </label>
        <label>
          to
          <input type="date" name="to" defaultValue={filters.to ?? ""} />
        </label>
        <div className={styles.filterActions}>
          <button className="button small" type="submit">Filter</button>
          <Link href="/admin/pipeline">Clear</Link>
        </div>
      </form>

      <table className={styles.table}>
        <thead>
          <tr><th>Lead</th><th>Lawyer</th><th>Stage</th><th>Days in stage</th><th>Retainer</th><th>Last activity</th></tr>
        </thead>
        <tbody>
          {board.rows.length === 0 && <tr><td className={styles.empty} colSpan={6}>No leads match these filters.</td></tr>}
          {board.rows.map((r) => (
            <tr key={r.leadId}>
              <td className={styles.who}>
                <Link href={`/portal/leads/${r.leadId}`}>{r.urgent && <span className={styles.urgent}>Urgent · </span>}{r.label}</Link>
                <span className={styles.sub}>{r.matter} · {r.state}{r.offerOnly ? " · offer card only" : ""}</span>
              </td>
              <td data-label="Lawyer">{r.lawyerName ?? <span className={styles.sub}>Not assigned</span>}{r.firmName && actor.role === "platform_admin" && <span className={styles.sub}>{r.firmName}</span>}</td>
              <td data-label="Stage">
                <span className={styles.stage}>{PIPELINE_COLUMNS.find((c) => c.key === r.column)!.label}</span>
                {r.exitReason && <span className={styles.sub}>{r.exitReason}</span>}
              </td>
              <td data-label="Days in stage"><span className={r.daysInStage >= 7 && r.column !== "lost" && r.column !== "paid" ? styles.stale : undefined}>{r.daysInStage}</span></td>
              <td data-label="Retainer"><span className={`${styles.badge} ${styles[`b_${r.retainer}`]}`}>{RETAINER_LABELS[r.retainer]}</span>{r.waitingFor && <span className={styles.sub}>Waiting for {r.waitingFor}</span>}</td>
              <td data-label="Last activity">{ago(r.lastActivityAt, now)}<span className={styles.sub}>{date(r.lastActivityAt)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="notice">First names only. Open a lead for the full case. Every view of this page is recorded in the audit log.</p>
    </div>
  );
}
