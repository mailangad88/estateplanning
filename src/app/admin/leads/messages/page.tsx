import Link from "next/link";
import { Mail, MessageSquare, Phone, Sparkles } from "lucide-react";
import { agoShort, loadDesk } from "../data";
import styles from "../desk.module.css";

export const dynamic = "force-dynamic";
const ICON = { call: Phone, sms: MessageSquare, email: Mail, meeting: Phone, system: Sparkles } as const;

export default async function Messages({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const desk = await loadDesk();
  if (!desk.ok) return null;
  const { db, rows, now } = desk;
  const showAuto = (await searchParams).show === "all";
  const ids = new Set(rows.map((r) => r.id));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const users = new Map((await db.users.list()).map((u) => [u.id, u.name]));
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const acts = (await db.activities.list((a) => ids.has(a.leadId) && a.at >= since))
    .filter((a) => (showAuto ? !a.summary.startsWith("sla-") : a.kind !== "system"))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 200);
  return (
    <>
      <p className={styles.kicker}>Clients</p>
      <div className={styles.toolbar}>
        <h1 style={{ margin: 0 }}>Messages</h1>
        <nav className={styles.tabs} aria-label="Show">
          <Link className={`${styles.tab} ${!showAuto ? styles.tabOn : ""}`} href="/admin/leads/messages">Calls, texts and emails</Link>
          <Link className={`${styles.tab} ${showAuto ? styles.tabOn : ""}`} href="/admin/leads/messages?show=all">Include automatic</Link>
        </nav>
      </div>
      <p className={styles.sub} style={{ marginBottom: 16 }}>Every logged call, text and email in the last 30 days, newest first. Automatic emails are the nurture sequences and alerts.</p>
      <section className={styles.card}>
        {acts.length === 0 ? <p className={styles.empty}>Nothing logged yet. Log calls from a lead&apos;s page or the call list.</p> : (
          <ul className={styles.items}>
            {acts.map((a) => {
              const Icon = ICON[a.kind];
              const r = byId.get(a.leadId)!;
              return (
                <li key={a.id} className={styles.item}>
                  <span className={styles.itemIcon} data-kind={a.kind === "system" ? "update" : a.direction === "inbound" ? "yours" : "fix"}><Icon size={17} aria-hidden="true" /></span>
                  <div>
                    <Link className={styles.itemTitle} href={`/admin/leads/${a.leadId}`}>{r.name}</Link>
                    <p className={styles.itemDetail}>{a.direction === "inbound" ? "From them · " : ""}{a.summary.replace(/^nurture-(marketing|service):/, "Automatic email: ")}</p>
                  </div>
                  <div className={styles.itemSide}>{a.byUserId ? `${users.get(a.byUserId) ?? ""} · ` : ""}{agoShort(a.at, now)}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
