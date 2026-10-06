import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { Marked } from "marked";

const ROOT = path.join(process.cwd(), "content");

export interface Faq {
  q: string;
  a: string;
}

export interface Heading {
  id: string;
  text: string;
}

interface BaseDoc {
  slug: string;
  title: string;
  description: string;
  updated: string;
  reviewed: boolean;
  related: string[];
  html: string;
  headings: Heading[];
  words: number;
  answer: string;
}

export interface Guide extends BaseDoc {
  category: string;
  readingMinutes: number;
  faqs: Faq[];
}

export interface Comparison extends BaseDoc {
  optionA: string;
  optionB: string;
  verdict: string;
  faqs: Faq[];
}

export interface LifeEvent extends BaseDoc {
  event: string;
  checklist: string[];
}

export interface Lesson extends BaseDoc {
  day: number;
  task: string;
}

export interface BlogPost extends BaseDoc {
  pillar: string;
  date: string;
  faqs: Faq[];
}

export interface GlossaryEntry {
  term: string;
  slug: string;
  acronym: string | null;
  definition: string;
  related: string[];
}

export interface FaqEntry {
  category: string;
  q: string;
  a: string;
}

export interface Mistake {
  title: string;
  category: string;
  why: string;
  fix: string;
}

export interface Checklist {
  slug: string;
  title: string;
  description: string;
  intro: string;
  reviewed: boolean;
  updated: string;
  sections: { heading: string; items: string[] }[];
}

export const GUIDE_CATEGORIES: Record<string, string> = {
  basics: "Getting started",
  wills: "Wills and guardians",
  trusts: "Trusts",
  property: "Property and beneficiaries",
  incapacity: "Incapacity and health care",
  family: "Family situations",
  tax: "Taxes",
  "elder-care": "Long-term care",
  administration: "After a death",
  business: "Business owners",
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function render(markdown: string): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const id = slugify(text);
        if (depth === 2) headings.push({ id, text: text.replace(/<[^>]+>/g, "") });
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
      table(token) {
        const header = token.header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join("");
        const rows = token.rows
          .map((r) => `<tr>${r.map((c) => `<td>${this.parser.parseInline(c.tokens)}</td>`).join("")}</tr>`)
          .join("");
        return `<div class="table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
      },
    },
  });
  const html = marked.parse(markdown, { async: false }) as string;
  return { html, headings };
}

function readDir<T>(dir: string, build: (slug: string, data: Record<string, unknown>, body: string) => T): T[] {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const { data, content } = matter(fs.readFileSync(path.join(full, f), "utf8"));
      return build(f.replace(/\.md$/, ""), data, content);
    });
}

function base(slug: string, data: Record<string, unknown>, body: string): BaseDoc {
  const { html, headings } = render(body);
  return {
    slug,
    title: String(data.title ?? slug),
    description: String(data.description ?? ""),
    updated: data.updated instanceof Date ? data.updated.toISOString().slice(0, 10) : String(data.updated ?? ""),
    reviewed: data.reviewed === true,
    related: Array.isArray(data.related) ? data.related.map(String) : [],
    html,
    headings,
    words: body.split(/\s+/).filter(Boolean).length,
    answer: String(data.answer ?? ""),
  };
}

function faqs(data: Record<string, unknown>): Faq[] {
  return Array.isArray(data.faqs) ? (data.faqs as Faq[]).filter((f) => f && f.q && f.a) : [];
}

const cache = new Map<string, unknown>();
function cached<T>(key: string, load: () => T): T {
  if (process.env.NODE_ENV === "production" && cache.has(key)) return cache.get(key) as T;
  const value = load();
  cache.set(key, value);
  return value;
}

export function getGuides(): Guide[] {
  return cached("guides", () =>
    readDir("guides", (slug, data, body) => ({
      ...base(slug, data, body),
      category: String(data.category ?? "basics"),
      readingMinutes: Number(data.readingMinutes ?? Math.max(1, Math.round(body.split(/\s+/).length / 220))),
      faqs: faqs(data),
    })),
  );
}

export function getComparisons(): Comparison[] {
  return cached("compare", () =>
    readDir("compare", (slug, data, body) => ({
      ...base(slug, data, body),
      optionA: String(data.optionA ?? ""),
      optionB: String(data.optionB ?? ""),
      verdict: String(data.verdict ?? ""),
      faqs: faqs(data),
    })),
  );
}

export function getLifeEvents(): LifeEvent[] {
  return cached("life-events", () =>
    readDir("life-events", (slug, data, body) => ({
      ...base(slug, data, body),
      event: String(data.event ?? slug),
      checklist: Array.isArray(data.checklist) ? data.checklist.map(String) : [],
    })),
  );
}

export function getLessons(): Lesson[] {
  return cached("course", () =>
    readDir("course", (slug, data, body) => ({
      ...base(slug, data, body),
      day: Number(data.day ?? 0),
      task: String(data.task ?? ""),
    })).sort((a, b) => a.day - b.day),
  );
}

export function getPosts(): BlogPost[] {
  return cached("blog", () =>
    readDir("blog", (slug, data, body) => {
      const doc = base(slug, data, body);
      return {
        ...doc,
        pillar: String(data.pillar ?? ""),
        date: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date ?? doc.updated),
        faqs: faqs(data),
      };
    }).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title)),
  );
}

function readJson<T>(file: string, fallback: T): T {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return fallback;
  return JSON.parse(fs.readFileSync(full, "utf8")) as T;
}

export function getGlossary(): GlossaryEntry[] {
  return cached("glossary", () =>
    readJson<GlossaryEntry[]>("glossary.json", []).sort((a, b) => a.term.localeCompare(b.term)),
  );
}

export function getFaqs(): FaqEntry[] {
  return cached("faq", () => readJson<FaqEntry[]>("faq.json", []));
}

export function getMistakes(): Mistake[] {
  return cached("mistakes", () => readJson<Mistake[]>("mistakes.json", []));
}

export function getChecklists(): Checklist[] {
  return cached("checklists", () => {
    const dir = path.join(ROOT, "checklists");
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => ({ slug: f.replace(/\.json$/, ""), ...readJson<Omit<Checklist, "slug">>(`checklists/${f}`, {} as Omit<Checklist, "slug">) }));
  });
}

export function bySlug<T extends { slug: string }>(items: T[], slug: string): T | undefined {
  return items.find((i) => i.slug === slug);
}
