import { describe, expect, it } from "vitest";
import { getCities, moreCities, nearbyCities } from "@/lib/library";
import { ORG_ID, legalServiceLd, siteGraphLd } from "@/lib/seo";
import { cityServiceSchema } from "@/lib/schema";
import { firm } from "@/config/firm";

type Node = Record<string, unknown>;
const org = () => (siteGraphLd()["@graph"] as Node[]).find((n) => n["@id"] === ORG_ID)!;

describe("local business structured data", () => {
  it("never puts placeholder name, address or phone into schema", () => {
    const o = org();
    const values = [o.name, o.telephone, o.email, JSON.stringify(o.address ?? "")].map(String);
    for (const v of values) expect(v).not.toMatch(/\[[^\]"]*\]|000\) 000-0000|PLACEHOLDER/);
  });

  it("describes a referral network, not a law firm", () => {
    expect(org()["@type"]).toEqual(["Organization", "ProfessionalService"]);
    expect(String(org().description)).toMatch(/referral/i);
  });

  it("lists served states as State places", () => {
    const area = org().areaServed as Node[];
    expect(area.length).toBeGreaterThan(0);
    for (const a of area) expect(a["@type"]).toBe("State");
  });

  it("builds the one-line office address from the address parts", () => {
    const a = firm.address;
    expect(firm.officeAddress).toBe(`${a.streetAddress}, ${a.addressLocality}, ${a.addressRegion} ${a.postalCode}`);
  });

  it("standalone firm node shares the layout's @id and has no Attorney-typed employee", () => {
    const node = legalServiceLd() as Node;
    expect(node["@id"]).toBe(ORG_ID);
    expect(JSON.stringify(node)).not.toContain('"Attorney"');
  });
});

describe("Illinois city pages", () => {
  const cities = getCities("illinois");

  it("city service schema nests city in county and state", () => {
    const s = cityServiceSchema(cities[0]) as Node;
    const area = s.areaServed as Node;
    expect(area["@type"]).toBe("City");
    expect((area.containedInPlace as Node)["@type"]).toBe("AdministrativeArea");
  });

  it("every nearby slug in the data points at a real city", () => {
    const slugs = new Set(cities.map((c) => c.slug));
    for (const c of cities) for (const n of c.nearby) expect(slugs.has(n), `${c.slug} -> ${n}`).toBe(true);
  });

  it("every city page links to at least six other city pages and receives links from others", () => {
    const inbound = new Map<string, number>();
    for (const c of cities) {
      const near = nearbyCities(c, cities);
      const links = [...near, ...moreCities(c, cities, near)];
      expect(new Set(links.map((l) => l.slug)).size, c.slug).toBeGreaterThanOrEqual(Math.min(6, cities.length - 1));
      expect(links.some((l) => l.slug === c.slug)).toBe(false);
      for (const l of links) inbound.set(l.slug, (inbound.get(l.slug) ?? 0) + 1);
    }
    for (const c of cities) expect(inbound.get(c.slug) ?? 0, c.slug).toBeGreaterThanOrEqual(3);
  });

  it("nearby links run both ways", () => {
    for (const c of cities) for (const n of c.nearby) {
      const other = cities.find((x) => x.slug === n);
      if (other) expect(nearbyCities(other, cities, 99).map((x) => x.slug)).toContain(c.slug);
    }
  });
});
