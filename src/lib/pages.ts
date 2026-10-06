import { MONEY_PAGES } from "@/content/money-pages";
import { TOOLS } from "@/config/tools";
import { EXPLAINERS } from "@/explainers/data";
import { getAudiences, getChecklists, getComparisons, getGuides, getLessons, getLifeEvents, getPosts } from "@/lib/content";
import { getStates } from "@/lib/states";
import { getAllArticles, getCluster, getGlossary as getTermPages, getStateGuides, isIndexable } from "@/lib/library";

export interface SitePage {
  path: string;
  title: string;
  description: string;
  updated: string;
  section: string;
}

const TODAY = "2026-10-06";

/** Every indexable page on the site. Feeds the sitemap and llms.txt. */
export function allPages(): SitePage[] {
  const pages: SitePage[] = [
    { path: "/", title: "Estate planning with a real attorney", description: "Wills, trusts and powers of attorney, explained plainly.", updated: TODAY, section: "Main" },
    { path: "/plan-finder", title: "Plan finder", description: "Answer a few questions and book a consult.", updated: TODAY, section: "Main" },
    { path: "/intake", title: "Book a consult", description: "Full intake form for an estate planning consult.", updated: TODAY, section: "Main" },
    { path: "/callback", title: "Request a call back", description: "Leave your number and pick a time for our intake team to call.", updated: TODAY, section: "Main" },
    { path: "/resources", title: "All resources", description: "Every guide, tool, checklist and explainer.", updated: TODAY, section: "Main" },
    { path: "/pricing", title: "Pricing", description: "Flat-fee estate planning packages.", updated: TODAY, section: "Main" },
    { path: "/about", title: "About the firm", description: "Who we are and how we work.", updated: TODAY, section: "Main" },
    { path: "/contact", title: "Contact", description: "Call, text, request a call back or book a consult.", updated: TODAY, section: "Main" },
    { path: "/guides", title: "Guides", description: "Estate planning guides.", updated: TODAY, section: "Main" },
    { path: "/blog", title: "Questions, answered", description: "Short answers to specific questions.", updated: TODAY, section: "Main" },
    { path: "/compare", title: "Comparisons", description: "Side-by-side comparisons.", updated: TODAY, section: "Main" },
    { path: "/estate-planning-for", title: "Estate planning by situation", description: "Planning pages for caregivers, new parents, executors, business owners, families and more.", updated: TODAY, section: "Main" },
    { path: "/life-events", title: "Life events", description: "Planning for life's big moments.", updated: TODAY, section: "Main" },
    { path: "/tools", title: "Tools", description: "Free calculators and tools.", updated: TODAY, section: "Main" },
    { path: "/checklists", title: "Checklists", description: "Printable checklists and worksheets.", updated: TODAY, section: "Main" },
    { path: "/explainers", title: "Explainers", description: "Animated explainers.", updated: TODAY, section: "Main" },
    { path: "/course", title: "7-day course", description: "Your estate plan in 7 days.", updated: TODAY, section: "Main" },
    { path: "/glossary", title: "Glossary", description: "Estate planning terms explained.", updated: TODAY, section: "Main" },
    { path: "/faq", title: "FAQ", description: "Frequently asked questions.", updated: TODAY, section: "Main" },
    { path: "/mistakes", title: "Mistakes to avoid", description: "Common estate planning mistakes.", updated: TODAY, section: "Main" },
  ];
  for (const m of Object.values(MONEY_PAGES)) pages.push({ path: m.path, title: m.h1, description: m.description, updated: TODAY, section: "Services" });
  for (const g of getGuides()) pages.push({ path: `/guides/${g.slug}`, title: g.title, description: g.description, updated: g.updated, section: "Guides" });
  for (const p of getPosts()) pages.push({ path: `/blog/${p.slug}`, title: p.title, description: p.description, updated: p.updated, section: "Questions answered" });
  for (const c of getComparisons()) pages.push({ path: `/compare/${c.slug}`, title: c.title, description: c.description, updated: c.updated, section: "Comparisons" });
  for (const l of getLifeEvents()) pages.push({ path: `/life-events/${l.slug}`, title: l.title, description: l.description, updated: l.updated, section: "Life events" });
  for (const a of getAudiences()) pages.push({ path: `/estate-planning-for/${a.slug}`, title: a.title, description: a.description, updated: a.updated, section: "By situation" });
  for (const k of getChecklists()) pages.push({ path: `/checklists/${k.slug}`, title: k.title, description: k.description, updated: k.updated, section: "Checklists" });
  for (const t of TOOLS) pages.push({ path: `/tools/${t.slug}`, title: t.title, description: t.description, updated: TODAY, section: "Tools" });
  for (const e of EXPLAINERS) pages.push({ path: `/explainers/${e.slug}`, title: e.title, description: e.description, updated: TODAY, section: "Explainers" });
  for (const l of getLessons()) pages.push({ path: `/course/${l.day}`, title: l.title, description: l.description, updated: l.updated, section: "7-day course" });
  for (const s of getStates().filter((x) => x.indexable)) pages.push({ path: `/estate-planning/${s.slug}`, title: s.title, description: s.description, updated: s.updated, section: "Locations" });

  // Estate planning library: topic-cluster pillars and articles, state law guides, glossary term pages.
  pages.push({ path: "/learn", title: "Estate planning library", description: "Every guide in the library, organized by topic.", updated: TODAY, section: "Main" });
  pages.push({ path: "/estate-planning", title: "Estate planning laws by state", description: "Will signing rules, probate, small estate limits and state taxes for all 50 states and DC.", updated: TODAY, section: "Main" });
  for (const a of getAllArticles().filter(isIndexable)) {
    pages.push({ path: a.url, title: a.title, description: a.description, updated: a.updated || TODAY, section: `Library: ${getCluster(a.cluster)?.name ?? a.cluster}` });
  }
  for (const s of getStateGuides().filter(isIndexable)) {
    pages.push({ path: s.url, title: s.title, description: s.description, updated: s.updated || TODAY, section: "Laws by state" });
  }
  for (const g of getTermPages()) {
    pages.push({ path: g.url, title: `${g.term}: definition`, description: g.short, updated: TODAY, section: "Glossary terms" });
  }
  const seen = new Set<string>();
  return pages.filter((p) => (seen.has(p.path) ? false : (seen.add(p.path), true)));
}
