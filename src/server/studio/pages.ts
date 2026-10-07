/**
 * Our own pages as research material: the answer, key points, sections and FAQs of the
 * page the question bank says answers a topic. The site-draft writer builds scripts from
 * these, and the Claude writer is given them as its first source.
 */
import { getComparisons, getGuides, getLifeEvents, getPosts } from "@/lib/content";
import { findByUrl } from "@/lib/library";

export interface PageText {
  url: string;
  title: string;
  answer: string;
  takeaways: string[];
  sections: { heading: string; paragraphs: string[]; bullets: string[] }[];
  faqs: { q: string; a: string }[];
  reviewed: boolean;
}

const stripMd = (s: string) =>
  s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function sectionsFromMarkdown(md: string): PageText["sections"] {
  const out: PageText["sections"] = [];
  let cur: PageText["sections"][number] | null = null;
  let para: string[] = [];
  const flush = () => {
    if (cur && para.length) cur.paragraphs.push(stripMd(para.join(" ")));
    para = [];
  };
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    const h = /^(#{2,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      if (h[1] === "##" || !cur) {
        cur = { heading: stripMd(h[2]), paragraphs: [], bullets: [] };
        out.push(cur);
      } else {
        cur.bullets.push(stripMd(h[2]).replace(/^\d+\.\s*/, ""));
      }
      continue;
    }
    if (!cur) continue;
    if (/^([-*]|\d+\.)\s+/.test(line)) {
      flush();
      cur.bullets.push(stripMd(line.replace(/^([-*]|\d+\.)\s+/, "")));
    } else if (!line || line.startsWith("<") || line.startsWith("|") || line.startsWith("{")) {
      flush();
    } else {
      para.push(line);
    }
  }
  flush();
  return out.filter((s) => s.paragraphs.length || s.bullets.length);
}

function sectionsFromHtml(html: string): PageText["sections"] {
  return html
    .split(/<h2[^>]*>/i)
    .slice(1)
    .map((chunk) => {
      const [head, rest = ""] = chunk.split(/<\/h2>/i);
      const paragraphs = [...rest.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripHtml(m[1])).filter(Boolean);
      const bullets = [...rest.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => stripHtml(m[1])).filter(Boolean);
      return { heading: stripHtml(head), paragraphs, bullets };
    })
    .filter((s) => s.paragraphs.length || s.bullets.length);
}

/** The page at a site path, or null when it is not one we can read as text. */
export function pageText(url: string): PageText | null {
  const path = url.split("#")[0].replace(/\/$/, "");
  const lib = findByUrl(path);
  if (lib && "markdown" in lib && "answer" in lib) {
    const a = lib as typeof lib & { title: string; answer: string; takeaways?: string[]; faqs?: { q: string; a: string }[]; review?: string };
    return {
      url: path,
      title: a.title,
      answer: stripMd(a.answer),
      takeaways: (a.takeaways ?? []).map(stripMd),
      sections: sectionsFromMarkdown(a.markdown),
      faqs: a.faqs ?? [],
      reviewed: a.review === "approved",
    };
  }
  const [, kind, slug] = path.split("/");
  const lists: Record<string, () => { slug: string; title: string; answer: string; html: string; reviewed: boolean; faqs?: { q: string; a: string }[] }[]> = {
    guides: getGuides,
    blog: getPosts,
    compare: getComparisons,
    "life-events": getLifeEvents,
  };
  const doc = lists[kind]?.().find((d) => d.slug === slug);
  if (!doc) return null;
  return {
    url: path,
    title: doc.title,
    answer: stripMd(doc.answer),
    takeaways: [],
    sections: sectionsFromHtml(doc.html),
    faqs: doc.faqs ?? [],
    reviewed: doc.reviewed,
  };
}
