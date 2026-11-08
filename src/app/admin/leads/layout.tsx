import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { firm } from "@/config/firm";
import { can } from "@/server/auth/policy";
import { callList, decisions } from "@/server/services/leadDesk";
import { DeskNav, type NavGroup } from "./DeskNav";
import { loadDesk } from "./data";
import styles from "./desk.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads desk", robots: { index: false, follow: false } };

const ROLE_LABELS: Record<string, string> = { platform_admin: "Owner", firm_admin: "Office admin", intake: "Intake" };

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const desk = await loadDesk();
  if (!desk.ok) {
    return desk.reason === "signed_out"
      ? <p>Please <Link href="/portal">sign in</Link> to open the leads desk.</p>
      : <p>The leads desk is for the office and platform admins.</p>;
  }
  const { actor, db, rows, now } = desk;
  const user = await db.users.get(actor.userId);
  const items = decisions(rows, now);
  const needYou = items.length;
  const calls = callList(rows).length;
  const fresh = rows.filter((r) => r.status === "new").length;
  const initials = (user?.name ?? "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const groups: NavGroup[] = [
    {
      title: "Daily",
      items: [
        { href: "/admin/leads", label: "Today", icon: "Home" },
        { href: "/admin/leads/notifications", label: "Notifications", icon: "Bell", badge: needYou, tone: "alert" },
        { href: "/admin/leads/calls", label: "Call list", icon: "Phone", badge: calls, tone: "warn" },
        { href: "/admin/leads/new", label: "New phone call", icon: "PhoneIncoming" },
        { href: "/admin/leads/week", label: "This week", icon: "CalendarRange" },
        { href: "/admin/leads/calendar", label: "Calendar", icon: "CalendarDays" },
      ],
    },
    {
      title: "Clients",
      items: [
        ...(can(actor, "view_pipeline") ? [{ href: "/admin/pipeline", label: "Pipeline", icon: "KanbanSquare" as const }] : []),
        { href: "/admin/leads/all", label: "Leads", icon: "Users", badge: fresh, tone: "warn" },
        { href: "/admin/leads/all?status=retained", label: "Clients", icon: "UserCheck" },
        ...(can(actor, "view_referrals") ? [{ href: "/admin/referrals", label: "Referral log", icon: "Handshake" as const }] : []),
        { href: "/admin/leads/messages", label: "Messages", icon: "MessageSquare" },
      ],
    },
    {
      title: "Grow",
      items: [
        ...(can(actor, "view_reports") ? [{ href: "/admin/analytics", label: "Reports", icon: "BarChart3" as const }] : []),
        ...(can(actor, "approve_templates") ? [{ href: "/portal/templates", label: "Email schedule", icon: "Mail" as const }] : []),
        ...(can(actor, "view_lead_health") ? [{ href: "/admin/lead-health", label: "Lead health", icon: "Activity" as const }] : []),
      ],
    },
  ].filter((g) => g.items.length > 0) as NavGroup[];

  return (
    <div className={styles.shell}>
      <aside className={styles.side}>
        <Link href="/admin/leads" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">{firm.brandName.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
          <span><strong>{firm.brandName}</strong><small>Leads desk</small></span>
        </Link>
        <details className={styles.menu}>
          <summary>Menu</summary>
          <DeskNav groups={groups} className={styles.nav} linkClass={styles.navLink} activeClass={styles.navOn} badgeClass={styles.navBadge} groupClass={styles.navGroup} />
        </details>
        <DeskNav groups={groups} className={`${styles.nav} ${styles.navWide}`} linkClass={styles.navLink} activeClass={styles.navOn} badgeClass={styles.navBadge} groupClass={styles.navGroup} />
        <div className={styles.me}>
          <span className={styles.avatar} aria-hidden="true">{initials}</span>
          <span><strong>{user?.name ?? "Signed in"}</strong><small>{ROLE_LABELS[actor.role] ?? actor.role}</small></span>
          <form method="post" action="/api/auth/logout"><button className={styles.signOut} title="Sign out">Sign out</button></form>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.top}>
          <form action="/admin/leads/all" method="get" role="search" className={styles.search}>
            <Search size={16} aria-hidden="true" />
            <label className="sr-only" htmlFor="desk-q">Search leads</label>
            <input id="desk-q" name="q" type="search" placeholder="Search leads by name, email or phone" autoComplete="off" />
          </form>
          <Link href="/admin/leads/notifications" className={styles.bell} aria-label={`Notifications, ${needYou} need you`}>
            <Bell size={18} aria-hidden="true" />
            {needYou > 0 && <span className={styles.bellCount}>{needYou}</span>}
          </Link>
        </header>
        <div className={styles.page}>{children}</div>
      </div>
    </div>
  );
}
