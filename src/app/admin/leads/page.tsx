import Link from "next/link";
import { Sparkles } from "lucide-react";
import { bookings, decisions, requestsByDay, statusCounts, todaySummary, updates } from "@/server/services/leadDesk";
import { loadDesk } from "./data";
import { Donut, ItemRow } from "./widgets";
import styles from "./desk.module.css";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "all", label: "All" },
  { key: "fix", label: "Fix now" },
  { key: "yours", label: "Your call" },
  { key: "update", label: "Updates" },
] as const;

function greeting(now: Date) {
  const h = Number(now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Chicago" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function waitText(min: number | null) {
  if (min === null) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h} hours` : `${Math.floor(h / 24)} days`;
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const desk = await loadDesk();
  if (!desk.ok) return null;
  const { db, rows, now, actor } = desk;
  const user = await db.users.get(actor.userId);
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "all";
  const needs = decisions(rows, now);
  const news = await updates(db, rows, now);
  const s = await todaySummary(db, rows, needs, now);
  const days = requestsByDay(rows, now);
  const weekTotal = days.reduce((t, d) => t + d.n, 0);
  const maxDay = Math.max(1, ...days.map((d) => d.n));
  const counts = statusCounts(rows);
  const b = await bookings(db, rows, now);
  const maxWeek = Math.max(1, ...b.weeks.map((w) => w.n));
  const feed = [...needs, ...news];
  const shown = tab === "all" ? feed : feed.filter((i) => i.kind === tab);
  const n = (k: string) => (k === "all" ? feed.length : feed.filter((i) => i.kind === k).length);
  const firstName = user?.name.split(" ")[0];

  return (
    <>
      <p className={styles.kicker}>{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Chicago" })}</p>
      <h1>{greeting(now)}{firstName ? `, ${firstName}` : ""}</h1>

      <section className={styles.banner} aria-labelledby="today-head">
        <p className={styles.kicker}><Sparkles size={14} aria-hidden="true" /> Last 24 hours</p>
        <p id="today-head" className={styles.bannerHead}>
          {s.automatic} {s.automatic === 1 ? "thing" : "things"} went through on their own. <em>{s.needYou} need{s.needYou === 1 ? "s" : ""} you.</em>
        </p>
        <ul className={styles.bannerStats}>
          <li>{s.newLast24h} new request{s.newLast24h === 1 ? "" : "s"}</li>
          <li>{s.bookedLast24h} consult{s.bookedLast24h === 1 ? "" : "s"} booked, {s.consultsToday} on today</li>
          <li>{s.callsToMake} call{s.callsToMake === 1 ? "" : "s"} to make</li>
          {s.waiting > 0 && <li className={styles.hot}>{s.waiting} {s.waiting === 1 ? "person" : "people"} waiting for a reply, longest {waitText(s.longestWaitMinutes)}</li>}
        </ul>
      </section>

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="needs">
          <div className={styles.cardHead}>
            <h2 id="needs">Needs your decision <span className={styles.count}>{needs.length}</span></h2>
            <Link href="/admin/leads/notifications">View all →</Link>
          </div>
          <p className={styles.sub}>Problems first, then the calls only you can make. Each one clears itself once it&apos;s done.</p>
          {needs.length === 0 ? <p className={styles.empty}>Nothing needs you right now.</p> : (
            <ul className={styles.items}>{needs.slice(0, 7).map((i) => <ItemRow key={i.key} item={i} now={now} />)}</ul>
          )}
        </section>

        <section className={styles.card} aria-labelledby="notes">
          <div className={styles.cardHead}>
            <h2 id="notes">Notifications</h2>
            <Link href={`/admin/leads/notifications?tab=${tab}`}>All →</Link>
          </div>
          <nav className={styles.tabs} aria-label="Filter notifications">
            {TABS.map((t) => (
              <Link key={t.key} href={t.key === "all" ? "/admin/leads" : `/admin/leads?tab=${t.key}`} className={`${styles.tab} ${tab === t.key ? styles.tabOn : ""}`} aria-current={tab === t.key ? "true" : undefined} scroll={false}>
                {t.label} {n(t.key) > 0 && <span className={styles.count}>{n(t.key)}</span>}
              </Link>
            ))}
          </nav>
          {shown.length === 0 ? <p className={styles.empty}>Nothing here.</p> : (
            <ul className={styles.items}>{shown.slice(0, 6).map((i) => <ItemRow key={i.key} item={i} now={now} compact />)}</ul>
          )}
        </section>
      </div>

      <div className={styles.cards3}>
        <section className={styles.card} aria-labelledby="requests">
          <div className={styles.cardHead}><h2 id="requests">New requests · last 7 days</h2><Link href="/admin/leads/all">Leads →</Link></div>
          <p className={styles.big}>{weekTotal}</p>
          <div className={styles.bars} role="img" aria-label={days.map((d) => `${d.label}: ${d.n}`).join(", ")}>
            {days.map((d, i) => (
              <div key={d.day} className={styles.barCol}>
                <span className={styles.barN}>{d.n || ""}</span>
                <span className={`${styles.bar} ${i === days.length - 1 ? styles.barToday : ""}`} style={{ height: `${(d.n / maxDay) * 80}%` }} />
                <span className={styles.barLabel}>{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.card} aria-labelledby="pipeline">
          <div className={styles.cardHead}><h2 id="pipeline">Open pipeline</h2><Link href="/admin/leads/all?status=open">Board →</Link></div>
          <Donut counts={counts} />
          <p className={styles.foot}>{counts.closed} closed or referred out. Every lead is matched with an attorney in the network after the first call.</p>
        </section>

        <section className={styles.card} aria-labelledby="bookings">
          <div className={styles.cardHead}><h2 id="bookings">Bookings · this month</h2><Link href="/admin/leads/calendar">Calendar →</Link></div>
          <p className={`${styles.big} ${styles.good}`}>{b.consultsThisMonth} <span className={styles.muted}>consults</span></p>
          <p className={styles.sub}>{b.retainedThisMonth} became clients this month</p>
          <svg className={styles.spark} viewBox="0 0 280 56" preserveAspectRatio="none" role="img" aria-label={`Consults booked per week, last 8 weeks: ${b.weeks.map((w) => w.n).join(", ")}`}>
            <polyline fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
              points={b.weeks.map((w, i) => `${(i / (b.weeks.length - 1)) * 272 + 4},${52 - (w.n / maxWeek) * 44}`).join(" ")} />
            <circle cx="276" cy={52 - (b.weeks.at(-1)!.n / maxWeek) * 44} r="4" fill="currentColor" />
          </svg>
          <p className={styles.foot}>Consults booked per week, last 8 weeks</p>
        </section>
      </div>
    </>
  );
}
