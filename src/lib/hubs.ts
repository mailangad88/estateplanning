import { TOOLS } from "@/config/tools";
import { EXPLAINERS } from "@/explainers/data";
import { videos } from "@/components/visuals/video";
import { getAudiences, getChecklists, getComparisons, getFaqs, getGlossary, getGuides, getLessons, getLifeEvents, getMistakes, getPosts } from "@/lib/content";
import { getAllArticles, getStateGuides } from "@/lib/library";
import { getMagnets } from "@/lib/magnets";

export interface Hub {
  href: string;
  label: string;
  count: number;
  body: string;
}

/** Every content hub on the site with its live item count. Read by /resources and the footer. */
export function getHubs(): Hub[] {
  return [
    { href: "/guides", label: "Guides", count: getGuides().length, body: "In-depth explanations of each part of a plan." },
    { href: "/learn", label: "Estate planning library", count: getAllArticles().length, body: "Topic clusters with a pillar article and supporting pages." },
    { href: "/blog", label: "Questions answered", count: getPosts().length, body: "Short answers to specific questions." },
    { href: "/compare", label: "Comparisons", count: getComparisons().length, body: "Side-by-side choices, factor by factor." },
    { href: "/life-events", label: "Life events", count: getLifeEvents().length, body: "What to do after a big change." },
    { href: "/estate-planning-for", label: "By situation", count: getAudiences().length, body: "Caregivers, new parents, executors, business owners and more." },
    { href: "/estate-planning", label: "Laws by state", count: getStateGuides().length, body: "State-by-state estate planning rules." },
    { href: "/tools", label: "Calculators and tools", count: TOOLS.length, body: "Run the numbers privately." },
    { href: "/free", label: "Free downloads and email courses", count: getMagnets().length, body: "Workbooks, planners, kits and templates to print and keep." },
    { href: "/checklists", label: "Checklists and worksheets", count: getChecklists().length, body: "Tick off on screen or print." },
    { href: "/explainers", label: "Animated explainers", count: EXPLAINERS.length, body: "Two-minute videos with transcripts." },
    { href: "/videos", label: "Videos", count: videos.length, body: "Short videos with transcripts." },
    { href: "/course", label: "7-day course", count: getLessons().length, body: "One lesson and one task a day." },
    { href: "/glossary", label: "Glossary", count: getGlossary().length, body: "Terms and acronyms in plain English." },
    { href: "/faq", label: "FAQ", count: getFaqs().length, body: "Answers to common questions." },
    { href: "/mistakes", label: "Mistakes to avoid", count: getMistakes().length, body: "What goes wrong and the fix." },
  ];
}
