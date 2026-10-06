import { describe, expect, it } from "vitest";
import { allPages } from "@/lib/pages";
import { SITEMAP_GROUPS, sitemapGroup, sitemapPages } from "@/lib/sitemaps";
import { getAllArticles } from "@/lib/library";
import { isSensitiveLibraryPage, magnetsForLibrary } from "@/lib/site-links";
import { articleSchema } from "@/lib/schema";
import { ATTORNEY_ID, ORG_ID } from "@/lib/seo";

describe("split sitemaps", () => {
  it("puts every page in exactly one sitemap (videos in the video sitemap)", () => {
    const pages = allPages();
    const grouped = SITEMAP_GROUPS.flatMap((g) => sitemapPages(g).map((p) => p.path));
    const videos = pages.filter((p) => sitemapGroup(p) === null);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped.length + videos.length).toBe(pages.length);
    expect(videos.every((p) => p.path.startsWith("/videos"))).toBe(true);
  });

  it("has no empty sitemap", () => {
    for (const g of SITEMAP_GROUPS) expect(sitemapPages(g).length, g).toBeGreaterThan(0);
  });

  it("lists the trust pages", () => {
    const paths = allPages().map((p) => p.path);
    expect(paths).toContain("/editorial-policy");
    expect(paths).toContain("/videos");
  });
});

describe("library page schema and offers", () => {
  const articles = getAllArticles();

  it("points Article author and publisher at the site-wide firm node, with a share image", () => {
    const s = articleSchema(articles[0]) as Record<string, any>;
    expect(s.author["@id"]).toBe(ORG_ID);
    expect(s.publisher["@id"]).toBe(ORG_ID);
    expect(s.image.url).toMatch(/\/opengraph-image$/);
  });

  it("adds reviewedBy only for attorney-approved pages", () => {
    const pending = articleSchema({ ...articles[0], review: "pending" }) as Record<string, any>;
    const approved = articleSchema({ ...articles[0], review: "approved" }) as Record<string, any>;
    expect(pending.mainEntityOfPage.reviewedBy).toBeUndefined();
    expect(approved.mainEntityOfPage.reviewedBy["@id"]).toBe(ATTORNEY_ID);
  });

  it("offers a free resource on nearly every article", () => {
    const withOffer = articles.filter((a) => magnetsForLibrary(a.url, a.cluster).length > 0);
    expect(withOffer.length / articles.length).toBeGreaterThan(0.9);
  }, 60_000);

  it("treats grief, health and disability topics as sensitive", () => {
    expect(isSensitiveLibraryPage("special-needs")).toBe(true);
    expect(isSensitiveLibraryPage("after-a-death")).toBe(true);
    expect(isSensitiveLibraryPage("life-stages", "estate-planning-after-a-serious-diagnosis")).toBe(true);
    expect(isSensitiveLibraryPage("wills", "how-to-make-a-valid-will")).toBe(false);
  });
});
