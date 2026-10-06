import { describe, expect, it } from "vitest";
import { ATTORNEY_ID, ORG_ID, articleLd, siteGraphLd } from "@/lib/seo";
import { firm } from "@/config/firm";

const crumbs = [{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }, { name: "Wills", path: "/guides/wills" }];
const base = { title: "Wills", description: "About wills.", path: "/guides/wills", updated: "2026-03-01", crumbs };

type Node = Record<string, unknown>;
const nodes = (g: { "@graph": unknown[] }) => g["@graph"] as Node[];
const byType = (g: { "@graph": unknown[] }, t: string) => nodes(g).find((n) => n["@type"] === t);

describe("articleLd", () => {
  it("builds a graph with WebPage, Article and BreadcrumbList", () => {
    const g = articleLd(base);
    expect(g["@context"]).toBe("https://schema.org");
    expect(nodes(g).map((n) => n["@type"])).toEqual(["WebPage", "Article", "BreadcrumbList"]);
    expect((byType(g, "BreadcrumbList")!.itemListElement as unknown[]).length).toBe(3);
  });

  it("uses the firm organization as author and never a person", () => {
    const art = byType(articleLd(base), "Article")!;
    expect(art.author).toEqual({ "@id": ORG_ID });
    expect(art.datePublished).toBe("2026-03-01");
    expect(art.dateModified).toBe("2026-03-01");
  });

  it("supports BlogPosting and an explicit publish date", () => {
    const g = articleLd({ ...base, type: "BlogPosting", published: "2026-01-05" });
    expect(byType(g, "BlogPosting")!.datePublished).toBe("2026-01-05");
  });

  it("adds reviewedBy and lastReviewed only when reviewed", () => {
    const unreviewed = byType(articleLd({ ...base, reviewed: false }), "WebPage")!;
    expect(unreviewed.reviewedBy).toBeUndefined();
    expect(unreviewed.lastReviewed).toBeUndefined();
    const reviewed = byType(articleLd({ ...base, reviewed: true }), "WebPage")!;
    expect(reviewed.reviewedBy).toEqual({ "@id": ATTORNEY_ID });
    expect(reviewed.lastReviewed).toBe("2026-03-01");
  });

  it("never emits AggregateRating or Review", () => {
    expect(JSON.stringify(articleLd({ ...base, reviewed: true }))).not.toMatch(/AggregateRating|"Review"/);
    expect(JSON.stringify(siteGraphLd())).not.toMatch(/AggregateRating|"Review"/);
  });
});

describe("siteGraphLd", () => {
  it("defines the firm and attorney once with stable ids", () => {
    const g = siteGraphLd();
    const org = nodes(g).find((n) => n["@id"] === ORG_ID)!;
    const person = nodes(g).find((n) => n["@id"] === ATTORNEY_ID)!;
    expect(org["@type"]).toEqual(["Organization", "LegalService"]);
    expect(person["@type"]).toBe("Person");
    expect(person.name).toBe(firm.attorneyName);
  });

  it("omits sameAs unless configured", () => {
    if (firm.sameAs.length === 0 && firm.attorneySameAs.length === 0) {
      expect(JSON.stringify(siteGraphLd())).not.toContain("sameAs");
    }
  });
});
