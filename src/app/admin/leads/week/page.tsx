import Link from "next/link";
import { loadDesk, timeOnly } from "../data";
import styles from "../desk.module.css";

export const dynamic = "force-dynamic";
const DAY = 86_400_000;
const chicagoDay = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

export default async function ThisWeek() {
  const desk = await loadDesk();
  if (!desk.ok) return null;
  const { db, rows, now } = desk;
  const ids = new Set(rows.map((r) => r.id));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const consults = await db.consults.list((c) => ids.has(c.leadId) && c.status !== "cancelled");
  const tasks = await db.tasks.list((t) => ids.has(t.leadId) && !t.doneAt);
  const days = Array.from({ length: 7 }, (_, i) => new Date(now.getTime() + i * DAY));
  const today = chicagoDay(now);
  const overdue = tasks.filter((t) => chicagoDay(t.dueAt) < today);
  return (
    <>
      <p className={styles.kicker}>Daily</p>
      <h1>This week</h1>
      <p className={styles.sub} style={{ marginBottom: 16 }}>Consults and follow-up calls for the next seven days. Times are Central.</p>
      {overdue.length > 0 && <p className={styles.alert}>{overdue.length} follow-up{overdue.length === 1 ? " is" : "s are"} overdue: {overdue.slice(0, 4).map((t) => byId.get(t.leadId)?.name).join(", ")}</p>}
      <div className={styles.week}>
        {days.map((d) => {
          const key = chicagoDay(d);
          const dayConsults = consults.filter((c) => chicagoDay(c.at) === key).sort((a, b) => a.at.localeCompare(b.at));
          const dayTasks = tasks.filter((t) => chicagoDay(t.dueAt) === key);
          return (
            <section key={key} className={`${styles.dayCol} ${key === today ? styles.dayToday : ""}`}>
              <h3>{key === today ? "Today" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" })}</h3>
              {dayConsults.map((c) => (
                <Link key={c.id} href={`/admin/leads/${c.leadId}#booking`} className={styles.event}>
                  <strong>{timeOnly(c.at)} · {byId.get(c.leadId)?.name}</strong>{c.type} consult{c.status !== "booked" ? ` · ${c.status}` : ""}
                </Link>
              ))}
              {dayTasks.map((t) => (
                <Link key={t.id} href={`/admin/leads/${t.leadId}`} className={styles.event} data-kind="call">
                  <strong>{byId.get(t.leadId)?.name}</strong>{t.title}
                </Link>
              ))}
              {dayConsults.length + dayTasks.length === 0 && <p className={styles.muted}>Nothing booked</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}
