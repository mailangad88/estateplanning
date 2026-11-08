"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Bell, BarChart3, CalendarDays, CalendarRange, ExternalLink, FileText, Handshake, Home, KanbanSquare, Mail, MessageSquare, Phone, PhoneIncoming, Users, UserCheck, Activity,
} from "lucide-react";

const ICONS = { Bell, BarChart3, CalendarDays, CalendarRange, FileText, Handshake, Home, KanbanSquare, Mail, MessageSquare, Phone, PhoneIncoming, Users, UserCheck, Activity };
export type IconName = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: IconName; badge?: number; tone?: "alert" | "warn" };
export type NavGroup = { title: string; items: NavItem[] };

export function DeskNav({ groups, className, linkClass, activeClass, badgeClass, groupClass }: {
  groups: NavGroup[];
  className: string;
  linkClass: string;
  activeClass: string;
  badgeClass: string;
  groupClass: string;
}) {
  const path = usePathname();
  const search = useSearchParams();
  // "Leads" and "Clients" share a path; Clients is the list filtered to retained.
  const isActive = (href: string) => {
    const [base, query] = href.split("?");
    if (base === "/admin/leads") return path === base;
    if (!(path === base || path.startsWith(`${base}/`))) return false;
    const want = new URLSearchParams(query ?? "").get("status");
    const have = search.get("status");
    return want ? have === want : base !== "/admin/leads/all" || have !== "retained";
  };
  return (
    <nav className={className} aria-label="Leads desk">
      {groups.map((g) => (
        <div key={g.title}>
          <p className={groupClass}>{g.title}</p>
          <ul>
            {g.items.map((i) => {
              const Icon = ICONS[i.icon];
              const on = isActive(i.href);
              return (
                <li key={i.href}>
                  <Link href={i.href} className={`${linkClass} ${on ? activeClass : ""}`} aria-current={on ? "page" : undefined}>
                    <Icon size={17} aria-hidden="true" />
                    <span>{i.label}</span>
                    {!!i.badge && <span className={badgeClass} data-tone={i.tone}>{i.badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <a href="/" className={linkClass}><ExternalLink size={17} aria-hidden="true" /><span>View website</span></a>
    </nav>
  );
}
