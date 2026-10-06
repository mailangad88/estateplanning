import { LIFE_STAGES } from "./life-stages";

/** Main navigation. Icons are lucide-react names, mapped in components/SiteHeader.tsx. */
export interface NavLink {
  href: string;
  label: string;
  desc?: string;
  icon?: string;
}
export interface NavGroup {
  label: string;
  links: NavLink[];
  /** Promo panel on the right of the mega menu. */
  feature?: { title: string; text: string; href: string; cta: string };
  footer?: NavLink;
}

export const NAV: NavGroup[] = [
  {
    label: "Your life stage",
    links: LIFE_STAGES.map((s) => ({ href: `/estate-planning-for/${s.slug}`, label: s.label, desc: s.who, icon: s.icon })),
    feature: {
      title: "Not sure where you fit?",
      text: "Answer a few questions and we suggest the documents that fit your family. It takes about two minutes.",
      href: "/plan-finder",
      cta: "Start the plan finder",
    },
    footer: { href: "/estate-planning-for", label: "Every situation we plan for" },
  },
  {
    label: "Services",
    links: [
      { href: "/wills", label: "Wills", desc: "Who inherits and who raises your kids", icon: "ScrollText" },
      { href: "/living-trusts", label: "Living trusts", desc: "Pass property without probate court", icon: "ShieldCheck" },
      { href: "/power-of-attorney", label: "Power of attorney", desc: "Someone you trust handles money", icon: "Scale" },
      { href: "/healthcare-directives", label: "Healthcare directives", desc: "Your medical wishes in writing", icon: "Stethoscope" },
      { href: "/probate", label: "Probate help", desc: "For executors and heirs", icon: "Landmark" },
      { href: "/trust-administration", label: "Trust administration", desc: "For successor trustees", icon: "ClipboardList" },
    ],
    feature: {
      title: "Flat fees, quoted first",
      text: "You see the fee before you sign anything. No hourly billing surprises.",
      href: "/pricing",
      cta: "See pricing",
    },
    footer: { href: "/how-it-works", label: "How working with us works" },
  },
  {
    label: "Learn",
    links: [
      { href: "/guides", label: "Guides", desc: "Plain-English explainers", icon: "BookOpen" },
      { href: "/learn", label: "Library", desc: "Every topic, organized", icon: "Library" },
      { href: "/videos", label: "Videos", desc: "Two-minute animated explainers", icon: "Video" },
      { href: "/blog", label: "Questions answered", desc: "Short answers to real questions", icon: "Newspaper" },
      { href: "/compare", label: "Comparisons", desc: "Will or trust, and more", icon: "Scale" },
      { href: "/estate-planning", label: "Rules by state", desc: "What changes where you live", icon: "MapPin" },
      { href: "/glossary", label: "Glossary", desc: "Legal words, explained", icon: "FileText" },
      { href: "/faq", label: "FAQ", desc: "Cost, process and timing", icon: "CircleHelp" },
    ],
    footer: { href: "/resources", label: "Everything in one place" },
  },
  {
    label: "Free tools",
    links: [
      { href: "/my-plan", label: "My family plan", desc: "Your people, assets and documents in one place", icon: "ClipboardList" },
      { href: "/tools", label: "Calculators", desc: "Will or trust, probate cost and more", icon: "Calculator" },
      { href: "/quizzes", label: "Quizzes", desc: "Two minutes, honest results", icon: "ListChecks" },
      { href: "/free", label: "Free downloads", desc: "Worksheets, kits and guides", icon: "Download" },
      { href: "/checklists", label: "Checklists", desc: "Printable, step by step", icon: "ClipboardCheck" },
      { href: "/course", label: "7-day email course", desc: "One small step a day", icon: "GraduationCap" },
    ],
    feature: {
      title: "How ready is your plan?",
      text: "Ten questions, a score out of 100 and the next step for your family.",
      href: "/tools/plan-readiness-assessment",
      cta: "Get my score",
    },
  },
];
