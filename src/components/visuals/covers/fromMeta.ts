import type { CoverPalette, ResourceCoverProps } from "./ResourceCover";
import type { CoverFormat } from "./motifs";
import { getMagnet } from "./magnets";

export type MagnetMeta = {
  slug: string;
  title: string;
  promise?: string;
  format: string;
  category: string;
  sequence?: string;
};

const kickers: Record<string, string> = {
  checklist: "Free checklist",
  worksheet: "Free worksheet",
  planner: "Free planner",
  guide: "Free guide",
  template: "Free template",
  kit: "Free kit",
  workbook: "Free workbook",
  "email-course": "Free 5-day email course",
};

const categories: Record<string, { palette: CoverPalette; icon: string }> = {
  basics: { palette: "accent", icon: "list" },
  wills: { palette: "clay", icon: "will" },
  trusts: { palette: "gold", icon: "trust" },
  property: { palette: "gold", icon: "house" },
  incapacity: { palette: "accent", icon: "health-directive" },
  family: { palette: "clay", icon: "family" },
  tax: { palette: "gold", icon: "scale" },
  "elder-care": { palette: "sage", icon: "hand-heart" },
  administration: { palette: "accent", icon: "folder" },
  business: { palette: "accent", icon: "briefcase" },
};

const formats = new Set<string>(["checklist", "worksheet", "planner", "guide", "template", "kit", "workbook", "email-course"]);

/** The promise's first sentence if it fits the subtitle lines, else "" (no subtitle). */
export function shorten(text: string, max = 66): string {
  const t = text.replace(/\s+/g, " ").trim();
  const first = t.split(/(?<=[.!?])\s/)[0];
  const dangling = /\s(and|or|to|with|the|a|an|of|for|in|on|at|by|as|if|but|from|into|my|your|their|so|then|plus|that|who|whom|which|what|when|how|help|after|before|is|are|can)$/i;
  const clean = (x: string) => {
    let out = x.replace(/[\s.,;:\-]+$/, "");
    while (dangling.test(out)) out = out.replace(dangling, "").replace(/[\s.,;:\-]+$/, "");
    return out;
  };
  // A clipped promise reads as broken copy, so a long one is dropped and the title carries the cover.
  return first.length <= max ? clean(first) : "";
}

/** Cover props for any magnet from its frontmatter. Hand-made configs in magnets.ts win. */
export function coverPropsFromMagnet(meta: MagnetMeta): Omit<ResourceCoverProps, "bare" | "caption"> {
  const hand = getMagnet(meta.slug);
  if (hand) {
    const { slug: _slug, ...rest } = hand;
    return rest;
  }
  const cat = categories[meta.category] ?? categories.basics;
  const grief = meta.sequence === "G";
  return {
    title: meta.title,
    subtitle: (meta.promise && shorten(meta.promise)) || undefined,
    kicker: kickers[meta.format] ?? "Free resource",
    icon: grief ? (cat.icon === "folder" ? "sprout" : cat.icon) : cat.icon,
    palette: grief ? "sage" : cat.palette,
    calm: grief || undefined,
    format: (formats.has(meta.format) ? meta.format : "default") as CoverFormat,
  };
}
