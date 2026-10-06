import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

/**
 * Loads the Markdown content in /content: topic-cluster pillars and articles, glossary entries,
 * state guides and city pages. Everything is read at build time and cached per process.
 * See content/STYLE.md for the file format.
 */

const ROOT = path.join(process.cwd(), "content");

export interface Faq {
  q: string;
  a: string;
}

export interface Heading {
  id: string;
  text: string;
}

interface Rendered {
  /** Markdown body without frontmatter. */
  markdown: string;
  html: string;
  headings: Heading[];
  wordCount: number;
  /** Root-relative internal links found in the body, without hash or query. */
  links: string[];
}

export interface Article extends Rendered {
  kind: "pillar" | "article";
  cluster: string;
  slug: string;
  url: string;
  title: string;
  description: string;
  updated: string;
  answer: string;
  takeaways: string[];
  faqs: Faq[];
  related: string[];
  glossary: string[];
}

export interface Cluster {
  slug: string;
  name: string;
  pillarTitle: string;
  url: string;
  articleSlugs: string[];
}

export interface GlossaryEntry extends Rendered {
  slug: string;
  url: string;
  term: string;
  short: string;
  also: string[];
  seeAlso: string[];
  related: string[];
}

export interface StateInfo {
  abbr: string;
  name: string;
  slug: string;
}

export interface StateFacts {
  willSigning?: string;
  selfProving?: string;
  holographicWills?: string;
  maritalProperty?: string;
  spousalRights?: string;
  estateTax?: string;
  inheritanceTax?: string;
  smallEstate?: string;
  todDeed?: string;
  probateCourt?: string;
  uniformLaws?: string;
  intestacy?: string;
}

export interface StateGuide extends Rendered, StateInfo {
  url: string;
  title: string;
  description: string;
  updated: string;
  answer: string;
  facts: StateFacts;
  faqs: Faq[];
  related: string[];
}

export interface City {
  slug: string;
  name: string;
  state: StateInfo;
  url: string;
  county: string;
  probateCourt?: { name: string; address?: string; url?: string };
  /** Genuinely local, verified detail. City pages without it are not published. */
  localNotes: string[];
  nearby: string[];
  updated: string;
}

/* ------------------------------------------------------------------ helpers */

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8")) as T;
}

function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

function asFaqs(v: unknown): Faq[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((f): f is { q: unknown; a: unknown } => typeof f === "object" && f !== null && "q" in f && "a" in f)
    .map((f) => ({ q: String(f.q), a: String(f.a) }));
}

function asDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v ? String(v) : "";
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&[a-z]+;/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Turns a related reference ("wills" or "wills/choosing-an-executor") into a URL. */
export function refToUrl(ref: string): string {
  return ref.startsWith("/") ? ref : `/learn/${ref}`;
}

const LINK_RE = /\]\((\/[^)\s#?]*)[^)]*\)/g;

export function render(markdown: string): Rendered {
  const headings: Heading[] = [];
  const seen = new Map<string, number>();
  let html = marked.parse(markdown, { async: false, gfm: true }) as string;
  html = html.replace(/<h([23])>(.*?)<\/h\1>/g, (_m, level: string, inner: string) => {
    let id = slugify(inner) || "section";
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n) id = `${id}-${n + 1}`;
    if (level === "2") headings.push({ id, text: inner.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"') });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  // Wrap tables so they scroll on small screens instead of widening the page.
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>");
  const links = Array.from(markdown.matchAll(LINK_RE), (m) => m[1].replace(/\/$/, "") || "/");
  const wordCount = markdown.replace(/[#>*_`|\-[\]()]/g, " ").split(/\s+/).filter(Boolean).length;
  return { markdown, html, headings, wordCount, links };
}

/* ------------------------------------------------------------------ clusters and articles */

interface TopicMap {
  clusters: { slug: string; name: string; pillar: string; articles: [string, string][] }[];
}

let clusterCache: Cluster[] | null = null;
export function getClusters(): Cluster[] {
  if (!clusterCache) {
    clusterCache = readJson<TopicMap>("topic-map.json").clusters.map((c) => ({
      slug: c.slug,
      name: c.name,
      pillarTitle: c.pillar,
      url: `/learn/${c.slug}`,
      articleSlugs: c.articles.map(([s]) => s),
    }));
  }
  return clusterCache;
}

export function getCluster(slug: string): Cluster | undefined {
  return getClusters().find((c) => c.slug === slug);
}

function loadArticle(cluster: string, slug: string | null): Article | null {
  const file = path.join(ROOT, "learn", cluster, `${slug ?? "index"}.md`);
  if (!fs.existsSync(file)) return null;
  const { data, content } = matter(fs.readFileSync(file, "utf8"));
  return {
    kind: slug ? "article" : "pillar",
    cluster,
    slug: slug ?? "",
    url: slug ? `/learn/${cluster}/${slug}` : `/learn/${cluster}`,
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    updated: asDate(data.updated),
    answer: String(data.answer ?? "").trim(),
    takeaways: asStrings(data.takeaways),
    faqs: asFaqs(data.faqs),
    related: asStrings(data.related),
    glossary: asStrings(data.glossary),
    ...render(content),
  };
}

let articleCache: Article[] | null = null;
/** Every published pillar and article, in topic-map order. Missing files are skipped. */
export function getAllArticles(): Article[] {
  if (!articleCache) {
    articleCache = [];
    for (const c of getClusters()) {
      const pillar = loadArticle(c.slug, null);
      if (pillar) articleCache.push(pillar);
      for (const s of c.articleSlugs) {
        const a = loadArticle(c.slug, s);
        if (a) articleCache.push(a);
      }
    }
  }
  return articleCache;
}

export function getPillar(cluster: string): Article | undefined {
  return getAllArticles().find((a) => a.kind === "pillar" && a.cluster === cluster);
}

export function getArticle(cluster: string, slug: string): Article | undefined {
  return getAllArticles().find((a) => a.kind === "article" && a.cluster === cluster && a.slug === slug);
}

export function getClusterArticles(cluster: string): Article[] {
  return getAllArticles().filter((a) => a.kind === "article" && a.cluster === cluster);
}

export function findByUrl(url: string): Article | GlossaryEntry | StateGuide | undefined {
  return (
    getAllArticles().find((a) => a.url === url) ??
    getGlossary().find((g) => g.url === url) ??
    getStateGuides().find((s) => s.url === url)
  );
}

/**
 * Related reading for an article: its frontmatter picks first, then cluster siblings,
 * then pages that link to it, de-duplicated and capped.
 */
export function getRelated(article: Article, limit = 6): Article[] {
  const out: Article[] = [];
  const add = (a: Article | undefined) => {
    if (a && a.url !== article.url && !out.some((o) => o.url === a.url)) out.push(a);
  };
  for (const ref of article.related) add(getAllArticles().find((a) => a.url === refToUrl(ref)));
  for (const a of getClusterArticles(article.cluster)) add(a);
  for (const a of getBacklinks(article.url)) if ("cluster" in a) add(a as Article);
  return out.slice(0, limit);
}

/** Pages whose body links to the given URL. */
export function getBacklinks(url: string): (Article | StateGuide)[] {
  return [...getAllArticles(), ...getStateGuides()].filter((a) => a.url !== url && a.links.includes(url));
}

/* ------------------------------------------------------------------ glossary */

let glossaryCache: GlossaryEntry[] | null = null;
export function getGlossary(): GlossaryEntry[] {
  if (!glossaryCache) {
    const terms = readJson<{ terms: [string, string][] }>("glossary-terms.json").terms;
    glossaryCache = terms
      .map(([slug, name]): GlossaryEntry | null => {
        const file = path.join(ROOT, "glossary", `${slug}.md`);
        if (!fs.existsSync(file)) return null;
        const { data, content } = matter(fs.readFileSync(file, "utf8"));
        return {
          slug,
          url: `/glossary/${slug}`,
          term: String(data.term ?? name),
          short: String(data.short ?? "").trim(),
          also: asStrings(data.also),
          seeAlso: asStrings(data.seeAlso),
          related: asStrings(data.related),
          ...render(content),
        };
      })
      .filter((g): g is GlossaryEntry => g !== null)
      .sort((a, b) => a.term.localeCompare(b.term));
  }
  return glossaryCache;
}

export function getGlossaryEntry(slug: string): GlossaryEntry | undefined {
  return getGlossary().find((g) => g.slug === slug);
}

/* ------------------------------------------------------------------ states and cities */

export function getStates(): StateInfo[] {
  return readJson<{ states: StateInfo[] }>("states.json").states;
}

let stateCache: StateGuide[] | null = null;
export function getStateGuides(): StateGuide[] {
  if (!stateCache) {
    stateCache = getStates()
      .map((s): StateGuide | null => {
        const file = path.join(ROOT, "states", `${s.slug}.md`);
        if (!fs.existsSync(file)) return null;
        const { data, content } = matter(fs.readFileSync(file, "utf8"));
        return {
          ...s,
          url: `/estate-planning/${s.slug}`,
          title: String(data.title ?? `Estate planning in ${s.name}`),
          description: String(data.description ?? ""),
          updated: asDate(data.updated),
          answer: String(data.answer ?? "").trim(),
          facts: (data.facts ?? {}) as StateFacts,
          faqs: asFaqs(data.faqs),
          related: asStrings(data.related),
          ...render(content),
        };
      })
      .filter((g): g is StateGuide => g !== null);
  }
  return stateCache;
}

export function getStateGuide(slug: string): StateGuide | undefined {
  return getStateGuides().find((s) => s.slug === slug);
}

/**
 * City pages come from content/cities/{state-slug}.json. A city is published only when it has
 * verified local notes, so the site never ships templated doorway pages.
 */
export function getCities(stateSlug?: string): City[] {
  const dir = path.join(ROOT, "cities");
  if (!fs.existsSync(dir)) return [];
  const states = getStates();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && (!stateSlug || f === `${stateSlug}.json`));
  return files.flatMap((f) => {
    const state = states.find((s) => `${s.slug}.json` === f);
    if (!state) return [];
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as {
      cities: Omit<City, "state" | "url">[];
    };
    return raw.cities
      .filter((c) => c.localNotes?.length)
      .map((c) => ({ ...c, nearby: c.nearby ?? [], state, url: `/estate-planning/${state.slug}/${c.slug}` }));
  });
}

/** Raw Markdown for a page, with a title line, for llms-full.txt and the /raw/ endpoints. */
export function toPlainMarkdown(page: Article | GlossaryEntry | StateGuide): string {
  const title = "term" in page ? page.term : page.title;
  const lead = "short" in page ? page.short : page.answer;
  const faqs = "faqs" in page && page.faqs.length
    ? `\n\n## Frequently asked questions\n\n${page.faqs.map((f) => `### ${f.q}\n\n${f.a}`).join("\n\n")}`
    : "";
  return `# ${title}\n\n> ${lead}\n\n${page.markdown.trim()}${faqs}\n`;
}
