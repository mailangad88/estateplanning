import fs from "node:fs";
import path from "node:path";

/**
 * State landing pages. Each state page exists only when a file in content/states/
 * holds real, attorney-checked local detail, so the site never publishes thin
 * near-duplicate location pages. Pages stay noindex until `indexable` is true.
 */
export interface StatePage {
  slug: string;
  code: string;
  name: string;
  title: string;
  description: string;
  answer: string;
  updated: string;
  reviewed: boolean;
  indexable: boolean;
  facts: { label: string; value: string }[];
  sections: { heading: string; body: string }[];
  counties: { name: string; court: string; notes?: string }[];
  faqs: { q: string; a: string }[];
}

export function getStates(): StatePage[] {
  const dir = path.join(process.cwd(), "content", "states");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => ({ slug: f.replace(/\.json$/, ""), ...(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Omit<StatePage, "slug">) }));
}
