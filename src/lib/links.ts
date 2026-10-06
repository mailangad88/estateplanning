import { getAudiences, getComparisons, getGuides, getLifeEvents, getPosts, getChecklists } from "@/lib/content";
import type { RelatedLink } from "@/components/article";

/** Resolves a slug from any collection to a link, so related lists can mix types. */
export function resolveSlug(slug: string): RelatedLink | null {
  const g = getGuides().find((x) => x.slug === slug);
  if (g) return { href: `/guides/${g.slug}`, title: g.title, kind: "Guide" };
  const p = getPosts().find((x) => x.slug === slug);
  if (p) return { href: `/blog/${p.slug}`, title: p.title, kind: "Article" };
  const c = getComparisons().find((x) => x.slug === slug);
  if (c) return { href: `/compare/${c.slug}`, title: c.title, kind: "Comparison" };
  const l = getLifeEvents().find((x) => x.slug === slug);
  if (l) return { href: `/life-events/${l.slug}`, title: l.title, kind: "Life event" };
  const k = getChecklists().find((x) => x.slug === slug);
  if (k) return { href: `/checklists/${k.slug}`, title: k.title, kind: "Checklist" };
  const a = getAudiences().find((x) => x.slug === slug);
  if (a) return { href: `/estate-planning-for/${a.slug}`, title: a.title, kind: "Situation" };
  return null;
}

export function resolveAll(slugs: string[], exclude: string[] = []): RelatedLink[] {
  const seen = new Set<string>(exclude);
  const out: RelatedLink[] = [];
  for (const s of slugs) {
    const r = resolveSlug(s);
    if (r && !seen.has(r.href)) {
      seen.add(r.href);
      out.push(r);
    }
  }
  return out;
}

/** Comparisons and life events that point at a guide, for reverse links. */
export function backlinksTo(slug: string): RelatedLink[] {
  const out: RelatedLink[] = [];
  for (const c of getComparisons()) if (c.related.includes(slug)) out.push({ href: `/compare/${c.slug}`, title: c.title, kind: "Comparison" });
  for (const l of getLifeEvents()) if (l.related.includes(slug)) out.push({ href: `/life-events/${l.slug}`, title: l.title, kind: "Life event" });
  return out;
}
