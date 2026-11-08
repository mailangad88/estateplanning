import Link from "next/link";
import { loadDesk, timeOnly } from "../data";
import styles from "../desk.module.css";

export const dynamic = "force-dynamic";
const chicagoDay = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

export default async function Calendar({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const desk = await loadDesk();
  if (!desk.ok) return null;
  const { db, rows, now } = desk;
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : chicagoDay(now).slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const shift = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  const ids = new Set(rows.map((r) => r.id));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const consults = await db.consults.list((c) => ids.has(c.leadId) && c.status !== "cancelled");
  const today = chicagoDay(now);
  const cells = Array.from({ length: Math.ceil((lead + daysIn) / 7) * 7 }, (_, i) => i - lead + 1);
  const label = first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <>
      <p className={styles.kicker}>Daily</p>
      <div className={styles.toolbar}>
        <h1 style={{ margin: 0 }}>{label}</h1>
        <div className={styles.filterActions}>
          <Link className={`${styles.btn} ${styles.btnGhost}`} href={`/admin/leads/calendar?m=${shift(-1)}`}>← Previous</Link>
          <Link className={`${styles.btn} ${styles.btnGhost}`} href="/admin/leads/calendar">This month</Link>
          <Link className={`${styles.btn} ${styles.btnGhost}`} href={`/admin/leads/calendar?m=${shift(1)}`}>Next →</Link>
        </div>
      </div>
      <p className={styles.sub} style={{ marginBottom: 12 }}>Consults in gold, new requests as a count. Times are Central.</p>
      <div className={styles.month} role="grid" aria-label={`Consults and new requests in ${label}`}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className={styles.dow} role="columnheader">{d}</div>)}
        {cells.map((n, i) => {
          if (n < 1 || n > daysIn) return <div key={`x${i}`} className={styles.out} />;
          const key = `${month}-${String(n).padStart(2, "0")}`;
          const dayConsults = consults.filter((c) => chicagoDay(c.at) === key);
          const fresh = rows.filter((r) => chicagoDay(r.createdAt) === key).length;
          return (
            <div key={key} className={key === today ? styles.today : undefined} role="gridcell">
              <span className={styles.dateNum}>{n}</span>
              {dayConsults.map((c) => (
                <Link key={c.id} href={`/admin/leads/${c.leadId}#booking`} className={styles.event}>{timeOnly(c.at)} {byId.get(c.leadId)?.firstName}</Link>
              ))}
              {fresh > 0 && <Link href={`/admin/leads/all?from=${key}&to=${key}`} className={styles.event} data-kind="new">{fresh} new</Link>}
            </div>
          );
        })}
      </div>
    </>
  );
}
