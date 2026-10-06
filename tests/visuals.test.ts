import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PAGE_MEDIA } from "@/components/visuals/PageMedia";
import { EXPLAINER_VIDEO } from "@/components/visuals/video/explainerMap";
import { videos } from "@/components/visuals/video/videos";
import { allPages } from "@/lib/pages";

const pub = (p: string) => join(process.cwd(), "public", p);

describe("visual media", () => {
  it("every manifest video has its files in public/", () => {
    expect(videos.length).toBe(15);
    for (const v of videos) {
      for (const f of [v.src, v.poster, v.captions, v.verticalSrc].filter(Boolean) as string[]) {
        expect(existsSync(pub(f)), f).toBe(true);
      }
    }
  });

  it("page media points at real pages and real videos", () => {
    const paths = new Set(allPages().map((p) => p.path));
    const slugs = new Set(videos.map((v) => v.slug));
    for (const [path, m] of Object.entries(PAGE_MEDIA)) {
      expect(paths.has(path), path).toBe(true);
      if (m.video) expect(slugs.has(m.video), m.video).toBe(true);
    }
    for (const v of Object.values(EXPLAINER_VIDEO)) expect(slugs.has(v), v).toBe(true);
  });
});
