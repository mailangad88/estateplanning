import type { MetadataRoute } from "next";
import { siteUrl, videos } from "@/components/visuals/video";

/** Video sitemap served at /videos/sitemap.xml. Reference it from robots.txt or the sitemap index. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl().replace(/\/$/, "");
  return [
    { url: `${base}/videos`, changeFrequency: "monthly", priority: 0.6 },
    ...videos.map((v) => ({
      url: `${base}/videos/${v.slug}`,
      lastModified: v.uploadDate,
      changeFrequency: "yearly" as const,
      priority: 0.5,
      videos: [
        {
          title: v.title,
          description: v.description,
          thumbnail_loc: `${base}${v.poster}`,
          content_loc: `${base}${v.src}`,
          duration: Math.round(v.durationSec),
          publication_date: v.uploadDate,
          family_friendly: "yes" as const,
          tag: v.topics[0],
        },
      ],
    })),
  ];
}
