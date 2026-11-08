import Link from "next/link";
import { decisions, updates } from "@/server/services/leadDesk";
import { loadDesk } from "../data";
import { ItemRow } from "../widgets";
import styles from "../desk.module.css";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "all", label: "All" },
  { key: "fix", label: "Fix now" },
  { key: "yours", label: "Your call" },
  { key: "update", label: "Updates" },
] as const;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const desk = await loadDesk();
  if (!desk.ok) return null;
  const { db, rows, now } = desk;
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "all";
  const feed = [...decisions(rows, now), ...(await updates(db, rows, now, 14))];
  const shown = tab === "all" ? feed : feed.filter((i) => i.kind === tab);
  const n = (k: string) => (k === "all" ? feed.length : feed.filter((i) => i.kind === k).length);
  return (
    <>
      <p className={styles.kicker}>Daily</p>
      <h1>Notifications</h1>
      <section className={styles.card}>
        <p className={styles.sub}>
          <strong>Fix now</strong>: someone is waiting, or a consult has no outcome. <strong>Your call</strong>: a decision only a person can make.{" "}
          <strong>Updates</strong>: what happened in the last two weeks. Fix now and Your call items clear themselves once they&apos;re done.
        </p>
        <nav className={styles.tabs} aria-label="Filter notifications">
          {TABS.map((t) => (
            <Link key={t.key} href={t.key === "all" ? "/admin/leads/notifications" : `/admin/leads/notifications?tab=${t.key}`} className={`${styles.tab} ${tab === t.key ? styles.tabOn : ""}`} aria-current={tab === t.key ? "true" : undefined}>
              {t.label} {n(t.key) > 0 && <span className={styles.count}>{n(t.key)}</span>}
            </Link>
          ))}
        </nav>
        {shown.length === 0 ? <p className={styles.empty}>Nothing here.</p> : <ul className={styles.items}>{shown.map((i) => <ItemRow key={i.key} item={i} now={now} />)}</ul>}
      </section>
    </>
  );
}
