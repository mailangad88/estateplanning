/**
 * Splits an estate among three children and their children under the common distribution rules, for the
 * per stirpes family-tree widget. One fixed family: Ann (no children), Ben (two children) and Cara (one child).
 * Ann is always alive; Ben and Cara can die before the parent.
 */
export type Method = "stirpes" | "capita" | "generation";

export type Person = { id: string; name: string; parent?: string };

export const FAMILY: { children: Person[]; grandchildren: Person[] } = {
  children: [
    { id: "ann", name: "Ann" },
    { id: "ben", name: "Ben" },
    { id: "cara", name: "Cara" },
  ],
  grandchildren: [
    { id: "dev", name: "Dev", parent: "ben" },
    { id: "eli", name: "Eli", parent: "ben" },
    { id: "fay", name: "Fay", parent: "cara" },
  ],
};

/** Dollar share per person id. People who get nothing are left out. */
export function splitEstate(total: number, method: Method, died: Set<string>): Record<string, number> {
  const out: Record<string, number> = {};
  const living = FAMILY.children.filter((c) => !died.has(c.id));
  const kidsOf = (id: string) => FAMILY.grandchildren.filter((g) => g.parent === id);
  // A child who died first with no children of their own drops out of every method.
  const lines = FAMILY.children.filter((c) => !died.has(c.id) || kidsOf(c.id).length > 0);

  if (method === "capita") {
    for (const c of living) out[c.id] = total / living.length;
    return out;
  }
  const share = total / lines.length;
  if (method === "stirpes") {
    for (const c of lines) {
      if (!died.has(c.id)) out[c.id] = share;
      else for (const g of kidsOf(c.id)) out[g.id] = share / kidsOf(c.id).length;
    }
    return out;
  }
  // Per capita at each generation: living children take a share each; the rest is pooled and split
  // equally among the grandchildren whose parent died first.
  for (const c of living) out[c.id] = share;
  const heirs = lines.filter((c) => died.has(c.id)).flatMap((c) => kidsOf(c.id));
  const pool = total - share * living.length;
  for (const g of heirs) out[g.id] = pool / heirs.length;
  return out;
}
