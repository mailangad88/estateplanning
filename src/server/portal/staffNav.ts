/**
 * The staff portal's sidebar: every admin page, grouped, and filtered to what the signed-in role may open.
 * One list so the sidebar and the home page's quick links never disagree. Icons are lucide names, resolved
 * in the shell component.
 */
import { can } from "@/server/auth/policy";
import { canStudio } from "@/server/studio/access";
import type { Actor } from "@/server/types";

export type NavIcon =
  | "home" | "board" | "pipeline" | "queue" | "referrals" | "partners" | "health"
  | "retainers" | "fees" | "commission" | "capacity"
  | "analytics" | "conversions" | "reviews" | "seminars" | "studio"
  | "pages" | "facts" | "templates" | "log";

export { activeHref } from "@/lib/navMatch";

export interface NavItem { href: string; label: string; icon: NavIcon }
export interface NavGroup { label?: string; items: NavItem[] }

export function staffNav(actor: Actor): NavGroup[] {
  const para = actor.role === "paralegal";
  const groups: { label?: string; items: [boolean, NavItem][] }[] = [
    { items: [[true, { href: "/portal", label: "Home", icon: "home" }]] },
    {
      label: para ? "Your work" : "Leads & cases",
      items: [
        [can(actor, "view_case_board"), { href: "/admin/cases", label: para ? "Your cases" : "Case board", icon: "board" }],
        [can(actor, "view_pipeline"), { href: "/admin/pipeline", label: "Lead pipeline", icon: "pipeline" }],
        [can(actor, "work_intake_queue"), { href: "/portal/queue", label: "Intake queue", icon: "queue" }],
        [can(actor, "view_referrals"), { href: "/admin/referrals", label: "Referrals", icon: "referrals" }],
        [can(actor, "view_partners"), { href: "/portal/partners", label: "Referral partners", icon: "partners" }],
        [can(actor, "view_lead_health"), { href: "/admin/lead-health", label: "Lead health", icon: "health" }],
      ],
    },
    {
      label: para ? undefined : "Fees & team",
      items: [
        [can(actor, "view_commissions"), { href: "/admin/commissions", label: para ? "Your commission" : "Commissions", icon: "commission" }],
        [can(actor, "view_retainer_templates"), { href: "/portal/retainers", label: "Retainer templates", icon: "retainers" }],
        [can(actor, "manage_fee_rules"), { href: "/admin/fees", label: "Fee rules", icon: "fees" }],
        [can(actor, "manage_firm_capacity"), { href: "/admin/capacity", label: "Capacity", icon: "capacity" }],
      ],
    },
    {
      label: "Marketing",
      items: [
        [can(actor, "view_reports"), { href: "/admin/analytics", label: "Analytics", icon: "analytics" }],
        [can(actor, "view_conversions"), { href: "/admin/conversions", label: "Ad conversions", icon: "conversions" }],
        [can(actor, "view_review_tracking"), { href: "/admin/reviews", label: "Review requests", icon: "reviews" }],
        [can(actor, "manage_seminars"), { href: "/admin/seminars", label: "Seminars", icon: "seminars" }],
        [canStudio(actor, "view_studio"), { href: "/admin/studio", label: "Video studio", icon: "studio" }],
      ],
    },
    {
      label: "Content review",
      items: [
        [can(actor, "approve_pages"), { href: "/portal/pages", label: "Page review", icon: "pages" }],
        [can(actor, "verify_facts"), { href: "/portal/facts", label: "Fact verification", icon: "facts" }],
        [can(actor, "approve_templates"), { href: "/portal/templates", label: "Message templates", icon: "templates" }],
        [can(actor, "view_reports"), { href: "/admin/page-log", label: "Page log", icon: "log" }],
      ],
    },
  ];
  return groups
    .map((g) => ({ label: g.label, items: g.items.filter(([ok]) => ok).map(([, item]) => item) }))
    .filter((g) => g.items.length > 0);
}

export const ROLE_LABEL: Record<Actor["role"], string> = {
  platform_admin: "Platform admin",
  intake: "Intake",
  marketing: "Marketing",
  firm_admin: "Office",
  attorney: "Attorney",
  paralegal: "Paralegal",
  client: "Client",
};
