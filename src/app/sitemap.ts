import type { MetadataRoute } from "next";
import { allPages } from "@/lib/pages";
import { abs } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return allPages().map((p) => ({ url: abs(p.path), lastModified: p.updated, changeFrequency: "monthly", priority: p.path === "/" ? 1 : p.section === "Main" ? 0.8 : 0.6 }));
}
