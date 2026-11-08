import Link from "next/link";
import { Download } from "lucide-react";
import { can } from "@/server/auth/policy";
import { DESK_STATUS_LABELS, DESK_STATUSES, filterLeads, filterOptions, parseFilters, statusCounts, type DeskFilters } from "@/server/services/leadDesk";
import { agoShort, loadDesk, phoneDisplay, when } from "../data";
import { StatusPill } from "../widgets";
import styles from "../desk.module.css";

export const dynamic = "force-dynamic";

function qs(f: DeskFilters, patch: Partial<DeskFilters> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...patch })) if (v) q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const desk = await loadDesk();
  if (!desk.ok) return null;
  const { actor, rows, now } = desk;
  const f = parseFilters(await searchParams);
  const list = filterLeads(rows, f);
  const opts = filterOptions(rows);
  const counts = statusCounts(filterLeads(rows, { ...f, status: undefined }));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const title = f.status === "retained" ? "Clients" : "Leads";

  return (
    <>
      <p className={styles.kicker}>Clients</p>
      <div className={styles.toolbar}>
        <h1 style={{ margin: 0 }}>{title} <span className={styles.count}>{list.length}</span></h1>
        {can(actor, "export_leads") && (
          <a className={`${styles.btn} ${styles.btnGhost}`} href={`/api/admin/leads/export${qs(f)}`}><Download size={16} aria-hidden="true" /> Download CSV</a>
        )}
      </div>

      <nav className={styles.statusChips} aria-label="Status">
        <Link className={`${styles.chip} ${!f.status ? styles.chipOn : ""}`} href={`/admin/leads/all${qs(f, { status: undefined })}`}>All {total}</Link>
        <Link className={`${styles.chip} ${f.status === "open" ? styles.chipOn : ""}`} href={`/admin/leads/all${qs(f, { status: "open" })}`}>Open {total - counts.closed}</Link>
        {DESK_STATUSES.map((s) => (
          <Link key={s} className={`${styles.chip} ${f.status === s ? styles.chipOn : ""}`} href={`/admin/leads/all${qs(f, { status: s })}`}>{DESK_STATUS_LABELS[s]} {counts[s]}</Link>
        ))}
      </nav>

      <form className={styles.filters} method="get" action="/admin/leads/all">
        {f.status && <input type="hidden" name="status" value={f.status} />}
        <label>Search<input type="search" name="q" defaultValue={f.q} placeholder="Name, email or phone" /></label>
        <label>
          Came in through
          <select name="tool" defaultValue={f.tool ?? ""}>
            <option value="">Any tool or form</option>
            {opts.tools.map((t) => <option key={t.value} value={t.value}>{t.label} ({t.n})</option>)}
          </select>
        </label>
        <label>
          First page
          <select name="page" defaultValue={f.page ?? ""}>
            <option value="">Any page</option>
            {opts.pages.map((p) => <option key={p.value} value={p.value}>{p.value} ({p.n})</option>)}
          </select>
        </label>
        <label>From<input type="date" name="from" defaultValue={f.from} /></label>
        <label>To<input type="date" name="to" defaultValue={f.to} /></label>
        <div className={styles.filterActions}>
          <button className={styles.btn} type="submit">Filter</button>
          <Link href="/admin/leads/all" className={styles.muted}>Clear</Link>
        </div>
      </form>

      {list.length === 0 ? <p className={styles.empty}>No leads match. Try clearing a filter.</p> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Name</th><th>Status</th><th>What they need</th><th>Came in through</th><th>First page</th><th>Received</th><th>Last touch</th></tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/leads/${r.id}`}>{r.name}</Link>
                    {(r.urgent || r.afterDeath) && <span className={styles.urgent}> · urgent</span>}
                    <div className={styles.muted}>{r.phone ? phoneDisplay(r.phone) : r.email}</div>
                  </td>
                  <td>
                    <StatusPill status={r.status} />
                    {r.waitingMinutes !== null && <div className={styles.muted}>No reply yet</div>}
                  </td>
                  <td>{r.matter}<div className={styles.muted}>{r.county ? `${r.county} County, ` : ""}{r.state}</div></td>
                  <td>{r.toolLabel}{r.resource && <div className={styles.muted}>{r.resource}</div>}</td>
                  <td className={styles.muted}>{r.sourcePage || "unknown"}{r.utmSource && <div>via {r.utmSource}</div>}</td>
                  <td className={styles.muted}>{when(r.createdAt)}</td>
                  <td className={styles.muted}>{agoShort(r.lastActivityAt, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
