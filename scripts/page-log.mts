/**
 * Site-wide page improvement log. Scores every indexable page on the built site against one checklist
 * (completeness, SEO, AEO, GEO, visuals, FAQs, links, booking CTA, trust) and records when the page was
 * last touched in git, so every thread works from the same scoreboard.
 *
 *   npm run build && npm run page-log          # writes content/page-log.json, docs/page-log.md, docs/page-log.csv
 *   npm run page-log -- --ci                   # same, plus a GitHub job summary; fails on hard rules only
 *   npm run page-log -- --top 50               # print the 50 biggest gaps to the terminal
 *
 * It reads the prerendered HTML in .next/server/app (what visitors and crawlers get), the page list from
 * src/lib/pages.ts (the sitemap's source), the attorney review queue (search value + approval) and the
 * question bank. Notes a person or thread wants on the log go in content/page-log-notes.json.
 *
 * Hard rules (fail CI): an indexable page without the "not legal advice" disclaimer, or any mention of the
 * attorney's other firm. Scores never fail CI; they rank the work.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { allPages, type SitePage } from "../src/lib/pages";
import { reviewQueue } from "../src/lib/review-queue";

const ROOT = process.cwd();
const BUILT = path.join(ROOT, ".next/server/app");
const OUT_JSON = path.join(ROOT, "content/page-log.json");
const OUT_MD = path.join(ROOT, "docs/page-log.md");
const OUT_CSV = path.join(ROOT, "docs/page-log.csv");
const NOTES = path.join(ROOT, "content/page-log-notes.json");
const args = process.argv.slice(2);
const CI = args.includes("--ci");
const TOP = Number(args[args.indexOf("--top") + 1]) || (args.includes("--top") ? 25 : 0);

if (!fs.existsSync(BUILT)) {
  console.error("page-log: .next/server/app not found. Run `npm run build` first.");
  process.exit(1);
}

/* ---------------- page value: how much a better page is worth in leads ---------------- */

/** 1 to 10. Pages that book consults or win local searches first. */
function sectionWeight(p: SitePage): number {
  const s = p.section;
  if (p.path === "/" || p.path === "/book" || p.path === "/pricing") return 10;
  if (s === "Services" || s === "Locations") return 9;
  if (s === "Library: Illinois") return 9;
  if (s === "Main") return /legal|privacy|terms|accessibility|editorial|unsubscribe/.test(p.path) ? 2 : 8;
  if (s === "Tools" || s === "By situation") return 8;
  if (["Guides", "Questions answered", "Comparisons", "Life events", "Decision guides", "Quizzes"].includes(s)) return 7;
  if (s === "Library: New Jersey") return 2; // not in the first launch
  if (s === "Laws by state") return /illinois/.test(p.path) ? 9 : 3;
  if (s.startsWith("Library")) return 6;
  if (["Free resources", "Checklists", "Explainers"].includes(s)) return 6;
  if (s === "7-day course" || s === "Videos") return 5;
  if (s === "Glossary terms") return 3;
  if (s === "About") return 4;
  return 5;
}

type Kind = "money" | "article" | "tool" | "hub" | "form" | "term" | "legal";
/** Pages whose job is the booking itself: judged on the CTA and trust, not on article depth. */
const FORM_PAGES = new Set(["/book", "/callback", "/intake", "/plan-finder", "/contact", "/my-plan"]);
function kindOf(p: SitePage): Kind {
  const s = p.section;
  if (/^\/(legal|privacy|terms|accessibility|editorial-policy|unsubscribe)/.test(p.path)) return "legal";
  if (FORM_PAGES.has(p.path)) return "form";
  if (s === "Glossary terms") return "term";
  if (["Tools", "Quizzes", "Checklists", "Free resources", "Decision guides", "Explainers"].includes(s)) return "tool";
  // Index pages list other pages; they need visuals, FAQs and links, not article depth.
  if (p.path.split("/").filter(Boolean).length <= 1 && !["Services", "About"].includes(s) && !/^\/(about|pricing|how-it-works|partners)/.test(p.path) && p.path !== "/") return "hub";
  if (s === "Main" || s === "Services" || s === "Locations" || s === "About") return "money";
  if (p.path.split("/").filter(Boolean).length <= 1) return "hub";
  return "article";
}

/* ---------------- reading built HTML ---------------- */

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, " ");
const textOf = (html: string) =>
  decode(html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
const words = (t: string) => (t ? t.split(" ").filter((w) => /[A-Za-z0-9]/.test(w)).length : 0);
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

function ldTypes(html: string): { types: Set<string>; dateModified: boolean; reviewedBy: boolean; ok: boolean } {
  const types = new Set<string>();
  let dateModified = false;
  let reviewedBy = false;
  let ok = true;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      for (const t of ([] as unknown[]).concat(o["@type"] ?? [])) types.add(String(t));
      if (o.dateModified) dateModified = true;
      if (o.reviewedBy || o.author) reviewedBy = true;
      Object.values(o).forEach(walk);
    }
  };
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      walk(JSON.parse(m[1]));
    } catch {
      ok = false;
    }
  }
  return { types, dateModified, reviewedBy, ok };
}

interface Facts {
  title: string;
  description: string;
  canonical: string;
  ogImage: boolean;
  noindex: boolean;
  h1: number;
  words: number;
  questionHeadings: number;
  h2: number;
  answerBox: boolean;
  takeaways: boolean;
  lists: number;
  tables: number;
  faqVisible: boolean;
  ld: ReturnType<typeof ldTypes>;
  visuals: number;
  interactive: number;
  imgNoAlt: number;
  internalLinks: string[];
  toolLink: boolean;
  bookLink: boolean;
  leadCapture: boolean;
  citations: number;
  figures: number;
  mentionsIllinois: boolean;
  mentionsNJ: boolean;
  disclaimer: boolean;
  referral: boolean;
  banned: string[];
}

function readFacts(html: string): Facts {
  const head = html.slice(0, html.indexOf("<body") > 0 ? html.indexOf("<body") : 20000);
  const mainM = html.match(/<main\b[^>]*>([\s\S]*)<\/main>/);
  const main = mainM ? mainM[1] : html;
  const text = textOf(main);
  const meta = (name: string) => decode(head.match(new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`))?.[1] ?? "");
  const headings = [...main.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => textOf(m[2]));
  const svgs = [...main.matchAll(/<svg\b([^>]*)>/g)].filter((m) => !/lucide/.test(m[1])).length;
  // The hero illustration is one picture; body visuals are what break up the reading.
  const heroArt = /class="art-frame/.test(main) ? 1 : 0;
  const visuals =
    Math.max(0, svgs - heroArt) +
    count(main, /<img\b/g) +
    count(main, /<video\b/g) +
    count(main, /<iframe\b/g) +
    count(main, /<canvas\b/g) +
    count(main, /<table\b/g) +
    count(main, /class="v-figure/g) +
    count(main, /class="v-video/g) +
    count(main, /class="vcards?\b/g);
  const interactive =
    count(main, /<form\b/g) +
    count(main, /class="vk vk--/g) +
    count(main, /class="dg-(picker|map|table|cards|shortcuts)\b/g) +
    count(main, /<input\b[^>]*type="(range|radio|checkbox|number)"/g) +
    count(main, /<select\b/g) +
    // Quizzes, calculators and the life game render their first step server side.
    Math.min(1, count(main, /class="(tool|quiz-option|question|life-game|lg-)\b/g));
  const internalLinks = [...new Set([...main.matchAll(/<a\b[^>]*\shref="(\/[^"#?]*)/g)].map((m) => m[1].replace(/\/$/, "") || "/"))];
  const external = [...main.matchAll(/<a\b[^>]*\shref="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  const citations = external.filter((u) => /\.gov\b|\.us\/|ilga\.gov|uscode|law\.cornell|courts|irs\.gov|ssa\.gov|illinoiscourts|\.state\./i.test(u)).length + count(main, /<cite\b/g);
  return {
    title: decode(head.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""),
    description: meta("description"),
    canonical: head.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? "",
    ogImage: /<meta property="og:image"/.test(head),
    noindex: /<meta name="robots" content="[^"]*noindex/.test(head),
    h1: count(main, /<h1\b/g),
    words: words(text),
    questionHeadings: headings.filter((h) => /\?\s*$/.test(h)).length,
    h2: count(main, /<h2\b/g),
    answerBox: /class="answer-box|class="[^"]*\bshort-answer|class="[^"]*\bquick-answer/.test(main),
    takeaways: /class="takeaways|Key takeaways/i.test(main),
    lists: count(main, /<(ol|ul)\b/g),
    tables: count(main, /<table\b/g),
    faqVisible: /Frequently asked|Common questions|Questions people ask|class="faq/i.test(main) || count(main, /<details\b/g) >= 3,
    ld: ldTypes(html),
    visuals,
    interactive,
    imgNoAlt: [...main.matchAll(/<img\b([^>]*)>/g)].filter((m) => !/\balt="/.test(m[1])).length,
    internalLinks,
    toolLink: internalLinks.some((h) => /^\/(tools|free|resources|decide|quizzes|checklists|plan-finder|my-plan|explainers)(\/|$)/.test(h)),
    bookLink: /href="\/(book|plan-finder|callback|intake|contact)\b/.test(main),
    leadCapture: /<form\b/.test(html) || internalLinks.some((h) => /^\/(free|resources|tools|quizzes|checklists|plan-finder)(\/|$)/.test(h)),
    citations,
    figures: count(text, /\$\s?\d|\d+(\.\d+)?\s?%|\b\d+\s(days?|weeks?|months?|years?)\b|\b(19|20)\d\d\b|\bsection \d|\b\d+\s?ILCS\b/gi),
    mentionsIllinois: /Illinois|\bIL\b|Chicago|Cook County/.test(text),
    mentionsNJ: /New Jersey/.test(text),
    disclaimer: /not (constitute )?legal advice|does not constitute legal advice/i.test(html),
    referral: /referral/i.test(html),
    banned: [/witherite/i.test(html) ? "mentions the attorney's other firm" : ""].filter(Boolean),
  };
}

/* ---------------- the checklist ---------------- */

type Group = "complete" | "seo" | "aeo" | "geo" | "visuals" | "faq" | "links" | "cta" | "trust";
export const GROUP_LABEL: Record<Group, string> = {
  complete: "Completeness", seo: "SEO", aeo: "AEO", geo: "GEO", visuals: "Visuals", faq: "FAQs", links: "Links", cta: "Booking CTA", trust: "Trust",
};
/** Which thread fixes a failing group, so the log doubles as a work queue. */
const OWNER: Record<Group, string> = {
  complete: "SEO content engine", seo: "SEO content engine", aeo: "SEO content engine", geo: "SEO content engine",
  visuals: "Visual redesign", faq: "SEO content engine", links: "SEO content engine", cta: "Lead capture tools", trust: "Launch",
};

interface Ctx { p: SitePage; k: Kind; f: Facts; inbound: number; reviewed: boolean | null }
interface Check { id: string; group: Group; label: string; weight: number; applies?: (c: Ctx) => boolean; pass: (c: Ctx) => boolean }

const MIN_WORDS: Record<Kind, number> = { article: 900, money: 450, tool: 250, hub: 200, form: 0, term: 150, legal: 0 };
/** Pages that answer a question and should read well to search and answer engines. */
const content = (c: Ctx) => c.k === "article" || c.k === "money";
const notLegal = (c: Ctx) => c.k !== "legal";
const page = (c: Ctx) => c.k !== "legal" && c.k !== "form";

export const CHECKS: Check[] = [
  { id: "words", group: "complete", label: "Enough depth for its type", weight: 3, applies: page, pass: (c) => c.f.words >= MIN_WORDS[c.k] },
  { id: "sections", group: "complete", label: "At least 3 sections (H2)", weight: 1, applies: (c) => c.k === "article" || c.k === "money", pass: (c) => c.f.h2 >= 3 },
  { id: "reviewed", group: "complete", label: "Attorney approved", weight: 3, applies: (c) => c.reviewed !== null, pass: (c) => c.reviewed === true },

  { id: "title", group: "seo", label: "Title 25 to 65 characters", weight: 1, pass: (c) => { const n = c.f.title.replace(/ \| Family Future Planning$/, "").length; return n >= 25 && n <= 65; } },
  { id: "description", group: "seo", label: "Meta description 70 to 165 characters", weight: 2, pass: (c) => c.f.description.length >= 70 && c.f.description.length <= 165 },
  { id: "canonical", group: "seo", label: "Canonical URL", weight: 1, pass: (c) => !!c.f.canonical },
  { id: "h1", group: "seo", label: "Exactly one H1", weight: 1, pass: (c) => c.f.h1 === 1 },
  { id: "og", group: "seo", label: "Share image", weight: 1, pass: (c) => c.f.ogImage },
  { id: "schema", group: "seo", label: "Page-level schema", weight: 2, pass: (c) => c.f.ld.ok && [...c.f.ld.types].some((t) => !["WebSite", "Organization", "LegalService", "Person"].includes(t)) },
  { id: "breadcrumbs", group: "seo", label: "Breadcrumb schema", weight: 1, applies: (c) => c.p.path !== "/", pass: (c) => c.f.ld.types.has("BreadcrumbList") },
  { id: "alt", group: "seo", label: "Every image has alt text", weight: 1, pass: (c) => c.f.imgNoAlt === 0 },

  { id: "answer", group: "aeo", label: "Short answer up top", weight: 3, applies: content, pass: (c) => c.f.answerBox },
  { id: "questions", group: "aeo", label: "2+ headings phrased as questions", weight: 2, applies: content, pass: (c) => c.f.questionHeadings >= 2 },
  { id: "lists", group: "aeo", label: "Lists or tables answer engines can lift", weight: 1, applies: page, pass: (c) => c.f.lists + c.f.tables >= 2 },
  { id: "speakable", group: "aeo", label: "Takeaways or speakable summary", weight: 1, applies: (c) => c.k === "article", pass: (c) => c.f.takeaways || c.f.ld.types.has("SpeakableSpecification") },

  { id: "citations", group: "geo", label: "Cites official sources (.gov, statutes)", weight: 2, applies: (c) => c.k === "article", pass: (c) => c.f.citations >= 1 },
  { id: "figures", group: "geo", label: "Concrete figures (costs, time, dates)", weight: 1, applies: content, pass: (c) => c.f.figures >= 3 },
  { id: "local", group: "geo", label: "Illinois relevance stated", weight: 2, applies: (c) => page(c) && c.k !== "term", pass: (c) => c.f.mentionsIllinois },
  { id: "fresh", group: "geo", label: "dateModified in schema", weight: 1, applies: (c) => c.k === "article", pass: (c) => c.f.ld.dateModified },
  { id: "byline", group: "geo", label: "Author or reviewer in schema", weight: 1, applies: (c) => c.k === "article", pass: (c) => c.f.ld.reviewedBy },

  { id: "visual", group: "visuals", label: "Not text only (1+ visual)", weight: 3, applies: notLegal, pass: (c) => c.f.visuals + c.f.interactive >= 1 },
  { id: "interactive", group: "visuals", label: "Interactive tool or what-if on the page", weight: 3, applies: (c) => page(c) && c.k !== "term", pass: (c) => c.f.interactive >= 1 },
  { id: "density", group: "visuals", label: "A visual every 400 words", weight: 2, applies: (c) => c.f.words > 400 && c.k !== "legal", pass: (c) => c.f.words / Math.max(1, c.f.visuals + c.f.interactive) <= 400 },

  { id: "faq", group: "faq", label: "Visible FAQ section", weight: 2, applies: (c) => content(c) || c.k === "tool" || c.k === "hub", pass: (c) => c.f.faqVisible },
  { id: "faqschema", group: "faq", label: "FAQPage schema", weight: 2, applies: (c) => content(c) || c.k === "tool" || c.k === "hub", pass: (c) => c.f.ld.types.has("FAQPage") },

  { id: "outlinks", group: "links", label: "5+ internal links in the body", weight: 2, applies: page, pass: (c) => c.f.internalLinks.length >= 5 },
  { id: "toollink", group: "links", label: "Links a free tool or resource", weight: 2, applies: page, pass: (c) => c.f.toolLink },
  { id: "inbound", group: "links", label: "3+ pages link here (not orphaned)", weight: 2, applies: (c) => c.p.path !== "/", pass: (c) => c.inbound >= 3 },

  { id: "book", group: "cta", label: "Book-a-consult link in the body", weight: 3, applies: (c) => page(c) && c.p.path !== "/book", pass: (c) => c.f.bookLink },
  { id: "capture", group: "cta", label: "Lead capture (form or free resource)", weight: 2, applies: notLegal, pass: (c) => c.f.leadCapture },

  { id: "disclaimer", group: "trust", label: "\"Not legal advice\" disclaimer", weight: 3, pass: (c) => c.f.disclaimer },
  { id: "referral", group: "trust", label: "Referral-network wording", weight: 1, pass: (c) => c.f.referral },
  { id: "banned", group: "trust", label: "No banned references", weight: 3, pass: (c) => c.f.banned.length === 0 },
  { id: "launchstate", group: "trust", label: "Not a New Jersey page (held from first launch)", weight: 2, applies: (c) => c.p.section === "Library: New Jersey" || /new-jersey/.test(c.p.path), pass: () => false },
];

/* ---------------- git: last touched ---------------- */

function gitDates(): { dates: Map<string, string>; shallow: boolean } {
  const dates = new Map<string, string>();
  let shallow = false;
  try {
    shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"], { encoding: "utf8" }).trim() === "true";
    const log = execFileSync("git", ["log", "--format=@@%cI", "--name-only", "--no-renames", "--", "content", "src/app", "src/config", "src/components"], {
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024,
    });
    let when = "";
    for (const line of log.split("\n")) {
      if (line.startsWith("@@")) when = line.slice(2, 12);
      else if (line && !dates.has(line)) dates.set(line, when);
    }
  } catch {
    /* not a git checkout */
  }
  return { dates, shallow };
}

function listFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(full, out);
    else out.push(path.relative(ROOT, full).replace(/\\/g, "/"));
  }
  return out;
}

const contentFiles = listFiles(path.join(ROOT, "content")).filter((f) => /\.(md|mdx|json)$/.test(f) && !/page-log/.test(f));
const bySlug = new Map<string, string[]>();
for (const f of contentFiles) {
  const slug = path.basename(f).replace(/\.(md|mdx|json)$/, "");
  bySlug.set(slug, [...(bySlug.get(slug) ?? []), f]);
}
const pageFiles = listFiles(path.join(ROOT, "src/app")).filter((f) => /\/page\.tsx?$/.test(f));
const routePatterns = pageFiles
  .map((f) => {
    const route = ("/" + f.replace(/^src\/app\//, "").replace(/(^|\/)page\.tsx?$/, "")).replace(/\/\([^)]+\)/g, "").replace(/\/$/, "") || "/";
    const re = new RegExp(
      "^" + route.split("/").map((s) => (s.startsWith("[...") ? ".+" : s.startsWith("[") ? "[^/]+" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("/") + "$",
    );
    return { file: f, re, dynamic: route.includes("[") };
  })
  .sort((a, b) => Number(a.dynamic) - Number(b.dynamic));

function sourcesFor(route: string): { template?: string; content?: string } {
  const template = routePatterns.find((r) => r.re.test(route))?.file;
  const segs = route.split("/").filter(Boolean);
  const last = segs.at(-1) ?? "";
  const cands = bySlug.get(last) ?? [];
  const tail = segs.join("/");
  const exact = cands.find((f) => f.replace(/\.(md|mdx|json)$/, "").endsWith(tail));
  const inDir = cands.find((f) => segs.slice(0, -1).some((s) => f.includes(`/${s}/`)));
  return { template, content: exact ?? inDir ?? (cands.length === 1 ? cands[0] : undefined) };
}

/* ---------------- run ---------------- */

const htmlPath = (route: string) => path.join(BUILT, route === "/" ? "index.html" : `${route.slice(1)}.html`);
const pages = allPages().filter((p) => !p.path.startsWith("http"));
const queue = new Map(reviewQueue({ includeReviewed: true }).map((i) => [i.path, i]));
const { dates, shallow } = gitDates();
let notes: Record<string, { note?: string; owner?: string; date?: string }> = {};
try {
  notes = JSON.parse(fs.readFileSync(NOTES, "utf8")).pages ?? {};
} catch {
  /* optional */
}

const facts = new Map<string, Facts>();
const missing: string[] = [];
for (const p of pages) {
  const file = htmlPath(p.path);
  if (!fs.existsSync(file)) {
    missing.push(p.path);
    continue;
  }
  facts.set(p.path, readFacts(fs.readFileSync(file, "utf8")));
}
const inbound = new Map<string, number>();
for (const [from, f] of facts) for (const to of f.internalLinks) if (to !== from) inbound.set(to, (inbound.get(to) ?? 0) + 1);

export interface LogRow {
  path: string;
  title: string;
  section: string;
  kind: Kind;
  value: number;
  score: number;
  groups: Partial<Record<Group, number>>;
  priority: number;
  words: number;
  visuals: number;
  interactive: number;
  faqs: boolean;
  inbound: number;
  reviewed: boolean | null;
  lastTouched: string;
  contentTouched: string;
  templateTouched: string;
  source: string;
  remaining: string[];
  owners: string[];
  note?: string;
}

const rows: LogRow[] = [];
const hardFails: string[] = [];
for (const p of pages) {
  const f = facts.get(p.path);
  if (!f) continue;
  const k = kindOf(p);
  const q = queue.get(p.path);
  const ctx: Ctx = { p, k, f, inbound: inbound.get(p.path) ?? 0, reviewed: q ? q.reviewed : null };
  const applicable = CHECKS.filter((c) => !c.applies || c.applies(ctx));
  const failing = applicable.filter((c) => !c.pass(ctx));
  const total = applicable.reduce((n, c) => n + c.weight, 0);
  const got = total - failing.reduce((n, c) => n + c.weight, 0);
  const groups: Partial<Record<Group, number>> = {};
  for (const g of Object.keys(GROUP_LABEL) as Group[]) {
    const gs = applicable.filter((c) => c.group === g);
    if (!gs.length) continue;
    const gt = gs.reduce((n, c) => n + c.weight, 0);
    groups[g] = Math.round((100 * gs.filter((c) => c.pass(ctx)).reduce((n, c) => n + c.weight, 0)) / gt);
  }
  const score = Math.round((100 * got) / Math.max(1, total));
  // Value: section weight (leads and local intent) plus the review queue's search-value score.
  const value = Math.min(100, sectionWeight(p) * 8 + Math.round((q?.score ?? 0) / 7));
  const src = sourcesFor(p.path);
  const contentTouched = src.content ? dates.get(src.content) ?? "" : "";
  const templateTouched = src.template ? dates.get(src.template) ?? "" : "";
  if (!f.noindex && !f.disclaimer) hardFails.push(`${p.path}: no "not legal advice" disclaimer`);
  for (const b of f.banned) hardFails.push(`${p.path}: ${b}`);
  rows.push({
    path: p.path,
    title: f.title.replace(/ \| Family Future Planning$/, "") || p.title,
    section: p.section,
    kind: k,
    value,
    score,
    groups,
    priority: Math.round((value * (100 - score)) / 100),
    words: f.words,
    visuals: f.visuals,
    interactive: f.interactive,
    faqs: f.faqVisible || f.ld.types.has("FAQPage"),
    inbound: ctx.inbound,
    reviewed: ctx.reviewed,
    lastTouched: [contentTouched, templateTouched].sort().at(-1) ?? "",
    contentTouched,
    templateTouched,
    source: src.content ?? src.template ?? "",
    remaining: failing.sort((a, b) => b.weight - a.weight).map((c) => c.label),
    owners: [...new Set(failing.map((c) => OWNER[c.group]))],
    ...(notes[p.path]?.note ? { note: `${notes[p.path].date ?? ""} ${notes[p.path].owner ?? ""}: ${notes[p.path].note}`.trim() } : {}),
  });
}
rows.sort((a, b) => b.priority - a.priority || a.path.localeCompare(b.path));

/* ---------------- summary ---------------- */

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const groupAvg = Object.fromEntries((Object.keys(GROUP_LABEL) as Group[]).map((g) => [g, avg(rows.flatMap((r) => (r.groups[g] === undefined ? [] : [r.groups[g]!])))]));
const checkFails = CHECKS.map((c) => ({
  id: c.id,
  group: c.group,
  label: c.label,
  failing: rows.filter((r) => r.remaining.includes(c.label)).length,
})).sort((a, b) => b.failing - a.failing);
const sections = [...new Set(rows.map((r) => r.section))]
  .map((s) => {
    const rs = rows.filter((r) => r.section === s);
    return {
      section: s,
      pages: rs.length,
      score: avg(rs.map((r) => r.score)),
      textOnly: rs.filter((r) => r.visuals + r.interactive === 0).length,
      noFaq: rs.filter((r) => !r.faqs).length,
      unreviewed: rs.filter((r) => r.reviewed === false).length,
      lastTouched: rs.map((r) => r.lastTouched).sort().at(-1) ?? "",
      priority: rs.reduce((n, r) => n + r.priority, 0),
    };
  })
  .sort((a, b) => b.priority - a.priority);

// Questions people ask that no page answers yet, by cluster: the content queue.
let openQuestions: { cluster: string; open: number; examples: string[] }[] = [];
try {
  const qb = JSON.parse(fs.readFileSync(path.join(ROOT, "content/questions.json"), "utf8")).items as { q: string; cluster: string; coverage: string; state?: unknown }[];
  const by = new Map<string, string[]>();
  for (const i of qb) if (i.coverage === "none") by.set(i.cluster, [...(by.get(i.cluster) ?? []), i.q]);
  openQuestions = [...by].map(([cluster, qs]) => ({ cluster, open: qs.length, examples: qs.slice(0, 3) })).sort((a, b) => b.open - a.open);
} catch {
  /* optional */
}

const generated = new Date().toISOString().slice(0, 10);
const summary = {
  generated,
  pages: rows.length,
  score: avg(rows.map((r) => r.score)),
  groups: groupAvg,
  textOnly: rows.filter((r) => r.visuals + r.interactive === 0).length,
  noInteractive: rows.filter((r) => r.interactive === 0).length,
  noFaq: rows.filter((r) => !r.faqs).length,
  noBook: checkFails.find((c) => c.id === "book")?.failing ?? 0,
  orphans: checkFails.find((c) => c.id === "inbound")?.failing ?? 0,
  unreviewed: rows.filter((r) => r.reviewed === false).length,
  heldNJ: rows.filter((r) => r.remaining.includes(CHECKS.find((c) => c.id === "launchstate")!.label)).length,
  notBuilt: missing,
  shallowGit: shallow,
  openQuestions: openQuestions.reduce((n, c) => n + c.open, 0),
};

/* ---------------- write ---------------- */

fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
// One row per line so concurrent threads get small, mergeable diffs. Re-run the script to resolve conflicts.
fs.writeFileSync(
  OUT_JSON,
  `{\n"_note": "Generated by npm run page-log from the built site. Do not edit by hand: add notes in content/page-log-notes.json and re-run.",\n"summary": ${JSON.stringify(summary)},\n"checks": ${JSON.stringify(checkFails)},\n"sections": [\n${sections.map((s) => JSON.stringify(s)).join(",\n")}\n],\n"openQuestions": ${JSON.stringify(openQuestions)},\n"rows": [\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]\n}\n`,
);

const csvCell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join("; ") : v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const G = Object.keys(GROUP_LABEL) as Group[];
fs.writeFileSync(
  OUT_CSV,
  [
    ["priority", "path", "title", "section", "kind", "value", "score", ...G.map((g) => GROUP_LABEL[g]), "words", "visuals", "interactive", "faqs", "inbound_links", "attorney_approved", "last_touched", "content_touched", "template_touched", "source", "remaining", "owners", "note"].join(","),
    ...rows.map((r) =>
      [r.priority, r.path, r.title, r.section, r.kind, r.value, r.score, ...G.map((g) => r.groups[g] ?? ""), r.words, r.visuals, r.interactive, r.faqs ? "yes" : "no", r.inbound, r.reviewed === null ? "n/a" : r.reviewed ? "yes" : "no", r.lastTouched, r.contentTouched, r.templateTouched, r.source, r.remaining, r.owners, r.note ?? ""]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n") + "\n",
);

const md: string[] = [];
md.push(
  "# Page improvement log",
  "",
  `Generated ${generated} by \`npm run page-log\` from the built site. ${rows.length} indexable pages, average score **${summary.score}/100**. ` +
    "Every page is scored on the same checklist; priority is page value times the gap, so the top rows are where an hour of work wins the most leads. " +
    "The full list is in [page-log.csv](page-log.csv) and on `/admin/page-log`. Add a note for a page in `content/page-log-notes.json`.",
  "",
  "## Scoreboard",
  "",
  "| Area | Average |",
  "|---|---|",
  ...G.map((g) => `| ${GROUP_LABEL[g]} | ${groupAvg[g]} |`),
  "",
  `- Text-only pages (no visual or tool): **${summary.textOnly}**`,
  `- Pages without an interactive tool or what-if: **${summary.noInteractive}**`,
  `- Pages without FAQs: **${summary.noFaq}**`,
  `- Pages without a booking link in the body: **${summary.noBook}**`,
  `- Pages fewer than 3 others link to: **${summary.orphans}**`,
  `- Pages waiting for attorney approval: **${summary.unreviewed}**`,
  `- New Jersey pages held from the first launch: **${summary.heldNJ}**`,
  `- Questions in the question bank no page answers yet: **${summary.openQuestions}**`,
  ...(missing.length ? [`- In the page list but not built: ${missing.length} (${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", ..." : ""})`] : []),
  ...(shallow ? ["", "> Git history was shallow when this ran, so last-touched dates are not reliable. Fetch full history (`fetch-depth: 0`)."] : []),
  "",
  "## Most common gaps",
  "",
  "| Check | Area | Pages failing |",
  "|---|---|---|",
  ...checkFails.filter((c) => c.failing).map((c) => `| ${c.label} | ${GROUP_LABEL[c.group as Group]} | ${c.failing} |`),
  "",
  "## By section",
  "",
  "| Section | Pages | Score | Text only | No FAQ | Unapproved | Last touched |",
  "|---|---|---|---|---|---|---|",
  ...sections.map((s) => `| ${s.section} | ${s.pages} | ${s.score} | ${s.textOnly} | ${s.noFaq} | ${s.unreviewed} | ${s.lastTouched} |`),
  "",
  "## Biggest gaps first (top 100)",
  "",
  "| # | Page | Score | Value | Last touched | Still to do |",
  "|---|---|---|---|---|---|",
  ...rows.slice(0, 100).map((r, i) => `| ${i + 1} | [${r.path}](${r.path}) | ${r.score} | ${r.value} | ${r.lastTouched || "?"} | ${r.remaining.slice(0, 4).join("; ")}${r.remaining.length > 4 ? ` (+${r.remaining.length - 4})` : ""} |`),
  "",
  "## Open questions by cluster",
  "",
  "| Cluster | Unanswered | Examples |",
  "|---|---|---|",
  ...openQuestions.slice(0, 25).map((c) => `| ${c.cluster} | ${c.open} | ${c.examples.join(" / ")} |`),
  "",
  "## The checklist",
  "",
  ...G.map((g) => `- **${GROUP_LABEL[g]}** (${OWNER[g]}): ${CHECKS.filter((c) => c.group === g).map((c) => c.label).join("; ")}`),
  "",
);
fs.writeFileSync(OUT_MD, md.join("\n"));

console.log(`page-log: ${rows.length} pages, average ${summary.score}/100. Text only ${summary.textOnly}, no FAQ ${summary.noFaq}, no booking link ${summary.noBook}.`);
console.log(`page-log: wrote ${path.relative(ROOT, OUT_JSON)}, ${path.relative(ROOT, OUT_MD)}, ${path.relative(ROOT, OUT_CSV)}`);
if (TOP) for (const r of rows.slice(0, TOP)) console.log(`${String(r.priority).padStart(3)}  ${String(r.score).padStart(3)}  ${r.path}  ${r.remaining.slice(0, 3).join("; ")}`);

if (CI && process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.slice(0, md.indexOf("## By section")).join("\n") + "\n");
}
if (hardFails.length) {
  console.error(`\npage-log: ${hardFails.length} hard-rule problem(s)`);
  for (const h of hardFails.slice(0, 50)) console.error(`  ${h}`);
  if (CI) process.exit(1);
}
