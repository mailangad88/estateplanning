"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3, Briefcase, CalendarDays, ClipboardCheck, FileCheck2, FileText, Film, Gauge, HandCoins, HeartPulse, Home, Inbox,
  LayoutList, LogOut, Menu, MessageSquareText, Percent, Scale, Share2, Star, Target, Users, X, type LucideIcon,
} from "lucide-react";
import { activeHref } from "@/lib/navMatch";
import type { NavGroup, NavIcon } from "@/server/portal/staffNav";
import styles from "./shell.module.css";

const ICONS: Record<NavIcon, LucideIcon> = {
  home: Home, board: Briefcase, pipeline: LayoutList, queue: Inbox, referrals: Share2, partners: Users, health: HeartPulse,
  retainers: FileText, fees: Percent, commission: HandCoins, capacity: Gauge,
  analytics: BarChart3, conversions: Target, reviews: Star, seminars: CalendarDays, studio: Film,
  pages: FileCheck2, facts: Scale, templates: MessageSquareText, log: ClipboardCheck,
};

const initials = (name: string) => name.replace(/,?\s*Esq\.?$/i, "").split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

export default function ShellFrame({ groups, userName, roleLabel, children }: { groups: NavGroup[]; userName: string; roleLabel: string; children: React.ReactNode }) {
  const path = usePathname() ?? "/portal";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const active = activeHref(groups.flatMap((g) => g.items.map((i) => i.href)), path);
  const current = groups.flatMap((g) => g.items).find((i) => i.href === active);

  return (
    <div className={`staff-app ${styles.app}`}>
      <aside id="staff-nav" className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`} aria-label="Portal">
        <div className={styles.brand}>
          <Link href="/portal" className={styles.brandLink}>
            <svg className={styles.brandMark} viewBox="0 0 40 40" aria-hidden="true">
              <rect width="40" height="40" rx="11" fill="#17505b" />
              <path d="M9 21 L20 11 L31 21" fill="none" stroke="#e2ae45" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 31 C13 29 13 22 20 18 C27 22 27 29 20 31 Z" fill="#fbf8f3" />
            </svg>
            <span><strong>Family Future</strong><small>Staff portal</small></span>
          </Link>
          <button type="button" className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} aria-hidden /></button>
        </div>
        <nav className={styles.nav}>
          {groups.map((g, gi) => (
            <div key={g.label ?? gi} className={styles.group}>
              {g.label && <p className={styles.groupLabel}>{g.label}</p>}
              <ul>
                {g.items.map((item) => {
                  const Icon = ICONS[item.icon];
                  const on = item.href === active;
                  return (
                    <li key={item.href}>
                      <Link href={item.href} className={`${styles.navItem} ${on ? styles.navItemOn : ""}`} aria-current={on ? "page" : undefined}>
                        <Icon size={18} aria-hidden />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <form method="post" action="/api/auth/logout" className={styles.signOut}>
          <button type="submit"><LogOut size={16} aria-hidden /> Sign out</button>
        </form>
      </aside>
      {open && <button type="button" className={styles.scrim} aria-label="Close menu" onClick={() => setOpen(false)} />}

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button type="button" className={styles.menuBtn} onClick={() => setOpen(true)} aria-label="Open menu" aria-controls="staff-nav" aria-expanded={open}>
            <Menu size={20} aria-hidden />
          </button>
          <p className={styles.crumb}>{current?.label ?? "Portal"}</p>
          <div className={styles.who}>
            <span className={styles.role}>{roleLabel}</span>
            <span className={styles.avatar} aria-hidden>{initials(userName)}</span>
            <span className={styles.userName}>{userName}</span>
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
