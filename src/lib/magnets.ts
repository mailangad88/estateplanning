import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { getPosts, render, type Heading } from "@/lib/content";

/**
 * Free resource library: gated checklists, worksheets, planners, templates, kits and
 * email courses in content/magnets. Landing page at /free/<slug>, full resource at
 * /free/<slug>/view after an email opt-in. See content/magnets/README.md for the format.
 */

export const MAGNET_FORMATS = {
  checklist: "Checklist",
  worksheet: "Worksheet",
  planner: "Planner",
  guide: "Guide",
  template: "Template",
  kit: "Kit",
  workbook: "Workbook",
  "email-course": "Email course",
} as const;
export type MagnetFormat = keyof typeof MAGNET_FORMATS;

export const MAGNET_CATEGORIES: Record<string, string> = {
  basics: "Getting started",
  wills: "Wills and guardians",
  trusts: "Trusts",
  property: "Property and beneficiaries",
  incapacity: "Incapacity and health care",
  family: "Family situations",
  tax: "Taxes",
  "elder-care": "Aging and long-term care",
  administration: "After a death",
  business: "Business owners",
};

export interface Lesson {
  day: number;
  subject: string;
  html: string;
}

export interface Magnet {
  slug: string;
  title: string;
  promise: string;
  description: string;
  format: MagnetFormat;
  category: string;
  audience: string;
  benefits: string[];
  pages: number;
  tag: string;
  /** "G" is the grief sequence: never marketing emails. */
  sequence: "B" | "G";
  /** Pages this resource is promoted on, as "guides/<slug>", "life-events/<slug>", etc. */
  related: string[];
  reviewed: boolean;
  updated: string;
  html: string;
  headings: Heading[];
  lessons: Lesson[];
  words: number;
  /** "en" or "es" */
  lang: string;
  /** For a translation, the slug of the English original */
  translationOf?: string;
  /** Raw markdown, used by link checks */
  body: string;
}

const DIR = path.join(process.cwd(), "content", "magnets");
let cache: Magnet[] | null = null;

function lessonsOf(body: string): Lesson[] {
  const parts = body.split(/^## Day (\d+):\s*(.+)$/m);
  const out: Lesson[] = [];
  for (let i = 1; i + 2 < parts.length; i += 3) {
    out.push({ day: Number(parts[i]), subject: parts[i + 1].trim(), html: render(parts[i + 2] ?? "").html });
  }
  return out;
}

export function getMagnets(): Magnet[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  if (!fs.existsSync(DIR)) return [];
  cache = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort()
    .map((f) => {
      const { data, content } = matter(fs.readFileSync(path.join(DIR, f), "utf8"));
      const format = (String(data.format ?? "guide") in MAGNET_FORMATS ? data.format : "guide") as MagnetFormat;
      const { html, headings } = render(content);
      return {
        slug: f.replace(/\.md$/, ""),
        title: String(data.title ?? f),
        promise: String(data.promise ?? ""),
        description: String(data.description ?? data.promise ?? ""),
        format,
        category: String(data.category ?? "basics"),
        audience: String(data.audience ?? ""),
        benefits: Array.isArray(data.benefits) ? data.benefits.map(String) : [],
        pages: Number(data.pages ?? 1),
        tag: String(data.tag ?? f.replace(/\.md$/, "").replace(/-/g, "_")),
        sequence: data.sequence === "G" ? "G" : "B",
        related: Array.isArray(data.related) ? data.related.map((r: unknown) => String(r).replace(/^\//, "")) : [],
        reviewed: data.reviewed === true,
        updated: data.updated instanceof Date ? data.updated.toISOString().slice(0, 10) : String(data.updated ?? ""),
        html,
        headings,
        lessons: format === "email-course" ? lessonsOf(content) : [],
        words: content.split(/\s+/).filter(Boolean).length,
        lang: String(data.lang ?? "en"),
        translationOf: data.translation_of ? String(data.translation_of) : undefined,
        body: content,
      } satisfies Magnet;
    });
  return cache;
}

export function getMagnet(slug: string): Magnet | undefined {
  return getMagnets().find((m) => m.slug === slug);
}

/**
 * Resources to promote on a page, best match first. Blog posts inherit the resources of
 * their pillar guide, so every article in a cluster offers the same lead magnets.
 */
export function magnetsFor(pagePath: string, limit = 3): Magnet[] {
  const key = pagePath.replace(/^\//, "").replace(/\/$/, "");
  const keys = [key];
  if (key.startsWith("blog/")) {
    const post = getPosts().find((p) => `blog/${p.slug}` === key);
    if (post?.pillar) keys.push(`guides/${post.pillar}`);
  }
  const scored = getMagnets()
    .filter((m) => m.lang === "en")
    .map((m) => ({ m, rank: keys.map((k) => m.related.indexOf(k)).filter((i) => i >= 0) }))
    .filter((x) => x.rank.length > 0)
    .sort((a, b) => Math.min(...a.rank) - Math.min(...b.rank) || (a.m.format === "email-course" ? 1 : 0) - (b.m.format === "email-course" ? 1 : 0));
  return scored.slice(0, limit).map((x) => x.m);
}

/** Opt-in "interest" value sent to /api/subscribe and the CRM. */
export function magnetInterest(m: Pick<Magnet, "slug">): string {
  return `magnet:${m.slug}`;
}

/** The other-language versions of a resource (English original and its translations). */
export function translationsOf(m: Magnet): Magnet[] {
  const root = m.translationOf ?? m.slug;
  return getMagnets().filter((x) => x.slug !== m.slug && (x.slug === root || x.translationOf === root));
}
