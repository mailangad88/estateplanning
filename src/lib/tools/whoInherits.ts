/**
 * "If I die without a will, who gets what?" Pure logic and data, no React.
 * Illinois only (755 ILCS 5/2-1). Other states are NOT modelled and are never guessed.
 * Educational only. Real cases can turn on facts this tool does not ask about.
 */

export type RuleConfidence = "high" | "medium" | "unverified";

export interface Frac {
  n: number;
  d: number;
}

export interface Family {
  /** Legally married and not divorced at death. */
  married: boolean;
  /** Children who are alive (any relationship, adopted children count). */
  children: number;
  /** One entry per child who died before you and left living descendants; the value is how many grandchildren. */
  deceasedChildren: number[];
  parentsLiving: 0 | 1 | 2;
  /** Living brothers and sisters. */
  siblings: number;
  /** One entry per sibling who died before you and left living children; the value is how many nieces and nephews. */
  deceasedSiblings: number[];
}

export type Branch =
  | "spouse_and_descendants"
  | "descendants_only"
  | "spouse_only"
  | "parents_and_siblings"
  | "parents_only"
  | "siblings_only"
  | "remote_relatives";

export interface Heir {
  id: string;
  label: string;
  /** Living person who receives a share. */
  share: Frac;
  /** Id of a deceased placeholder this person takes through. */
  parentId?: string;
  group: "spouse" | "descendant" | "parent" | "sibling";
}

export interface Placeholder {
  id: string;
  label: string;
  group: "descendant" | "sibling";
  /** Total share passing down this branch. */
  share: Frac;
}

export interface InheritResult {
  branch: Branch;
  heirs: Heir[];
  placeholders: Placeholder[];
  headline: string;
  rule: string;
}

export const MAX_COUNT = 8;

export const ILLINOIS_RULE = {
  state: "IL",
  cite: "755 ILCS 5/2-1",
  source: "https://www.ilga.gov/legislation/ilcs/fulltext.asp?DocName=075500050K2-1",
  asOf: "2026-10-06",
  // verify: could not reach ilga.gov from the build environment. Rules below are from general knowledge of 2-1 and must be checked against the statute text.
  confidence: "unverified" as RuleConfidence,
};

export const WHO_INHERITS_DISCLAIMER = "General information, not legal advice. Laws differ by state.";

export const WILL_CHANGES: string[] = [
  "You choose who gets what, instead of the fixed order the law sets.",
  "You can leave something to a friend, a charity or a partner you are not married to. Without a will, none of them inherit.",
  "You can name the person who handles things (the executor) and a guardian for young children.",
  "You can leave a different split, for example more to one child or everything to a spouse.",
  "You can name someone to receive a specific item, such as a family heirloom.",
  "A will does not control accounts with a named beneficiary or jointly owned property. Those follow their own paperwork.",
];

export const BEYOND_THIS_TOOL: string[] = [
  "Only property in your name alone and without a beneficiary follows these rules. Joint property, accounts with a beneficiary, life insurance and trusts usually pass by their own terms.",
  "Estate debts and costs are paid before heirs receive anything.",
  "A spouse may have other rights, such as a homestead or a surviving spouse award. This tool does not cover them.",
  "Adopted children are generally treated as children. Stepchildren who were never adopted are generally not heirs.",
  "A person who is not an heir by law, such as an unmarried partner, a stepchild or a friend, gets nothing without a will.",
];

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

export function frac(n: number, d: number): Frac {
  if (d === 0) throw new Error("zero denominator");
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

export function mulFrac(a: Frac, b: Frac): Frac {
  return frac(a.n * b.n, a.d * b.d);
}

export function addFrac(a: Frac, b: Frac): Frac {
  return frac(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function fracText(f: Frac): string {
  return f.d === 1 ? String(f.n) : `${f.n}/${f.d}`;
}

export function fracPercent(f: Frac): number {
  return (f.n / f.d) * 100;
}

function clampCount(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(MAX_COUNT, Math.floor(n))) : 0;
}

export function normalizeFamily(f: Family): Family {
  return {
    married: !!f.married,
    children: clampCount(f.children),
    deceasedChildren: f.deceasedChildren.slice(0, MAX_COUNT).map((g) => Math.max(1, clampCount(g))),
    parentsLiving: f.parentsLiving === 2 ? 2 : f.parentsLiving === 1 ? 1 : 0,
    siblings: clampCount(f.siblings),
    deceasedSiblings: f.deceasedSiblings.slice(0, MAX_COUNT).map((g) => Math.max(1, clampCount(g))),
  };
}

/** Split `total` equally among the lines (living people and deceased-line placeholders), per stirpes. */
function lineShares(
  total: Frac,
  living: number,
  deceased: number[],
  group: "descendant" | "sibling",
  noun: { one: string; kid: string },
): { heirs: Heir[]; placeholders: Placeholder[] } {
  const lines = living + deceased.length;
  const each = mulFrac(total, frac(1, lines));
  const heirs: Heir[] = [];
  const placeholders: Placeholder[] = [];
  for (let i = 0; i < living; i++) {
    heirs.push({ id: `${group}-live-${i}`, label: `${noun.one} ${i + 1}`, share: each, group });
  }
  deceased.forEach((kids, i) => {
    const pid = `${group}-gone-${i}`;
    placeholders.push({ id: pid, label: `${noun.one} who died ${i + 1}`, group, share: each });
    const per = mulFrac(each, frac(1, kids));
    for (let k = 0; k < kids; k++) {
      heirs.push({ id: `${pid}-kid-${k}`, label: `${noun.kid} ${k + 1}`, share: per, parentId: pid, group });
    }
  });
  return { heirs, placeholders };
}

const CHILD = { one: "Child", kid: "Grandchild" };
const SIB = { one: "Sibling", kid: "Niece or nephew" };

/**
 * Illinois intestate shares, 755 ILCS 5/2-1 (see ILLINOIS_RULE confidence).
 * Ladder: spouse and descendants split half and half; descendants alone take all; spouse alone takes all;
 * otherwise parents, siblings and sibling descendants share in equal parts with a double portion to a
 * surviving parent when the other parent is dead; further out, grandparents and other relatives, then the county.
 * Descendants and sibling lines share per stirpes (one level of grandchildren is modelled).
 */
export function whoInherits(input: Family): InheritResult {
  const f = normalizeFamily(input);
  const descLines = f.children + f.deceasedChildren.length;
  const hasDesc = descLines > 0;
  const heirs: Heir[] = [];
  const placeholders: Placeholder[] = [];

  if (f.married && hasDesc) {
    heirs.push({ id: "spouse", label: "Spouse", share: frac(1, 2), group: "spouse" });
    const d = lineShares(frac(1, 2), f.children, f.deceasedChildren, "descendant", CHILD);
    return {
      branch: "spouse_and_descendants",
      heirs: [...heirs, ...d.heirs],
      placeholders: d.placeholders,
      headline: "Your spouse gets half. Your descendants share the other half.",
      rule: "With a spouse and descendants, the spouse takes one half and the descendants take the other half. Descendants share equally by branch.",
    };
  }
  if (hasDesc) {
    const d = lineShares(frac(1, 1), f.children, f.deceasedChildren, "descendant", CHILD);
    return {
      branch: "descendants_only",
      heirs: d.heirs,
      placeholders: d.placeholders,
      headline: "Your descendants share everything equally by branch.",
      rule: "With no spouse, your children and the descendants of any child who died take everything. A grandchild takes the share their parent would have received.",
    };
  }
  if (f.married) {
    return {
      branch: "spouse_only",
      heirs: [{ id: "spouse", label: "Spouse", share: frac(1, 1), group: "spouse" }],
      placeholders: [],
      headline: "Your spouse gets everything.",
      rule: "With a spouse and no descendants, the spouse takes the entire estate. Your parents and siblings get nothing.",
    };
  }

  const sibLines = f.siblings + f.deceasedSiblings.length;
  const parentUnits = f.parentsLiving === 2 ? 2 : f.parentsLiving === 1 ? 2 : 0;
  const totalUnits = parentUnits + sibLines;
  if (totalUnits > 0) {
    const unit = frac(1, totalUnits);
    if (f.parentsLiving === 2) {
      heirs.push({ id: "parent-0", label: "Parent 1", share: unit, group: "parent" });
      heirs.push({ id: "parent-1", label: "Parent 2", share: unit, group: "parent" });
    } else if (f.parentsLiving === 1) {
      heirs.push({ id: "parent-0", label: "Surviving parent", share: mulFrac(unit, frac(2, 1)), group: "parent" });
    }
    let sibs: { heirs: Heir[]; placeholders: Placeholder[] } = { heirs: [], placeholders: [] };
    if (sibLines > 0) sibs = lineShares(mulFrac(unit, frac(sibLines, 1)), f.siblings, f.deceasedSiblings, "sibling", SIB);
    const branch: Branch = sibLines === 0 ? "parents_only" : f.parentsLiving === 0 ? "siblings_only" : "parents_and_siblings";
    return {
      branch,
      heirs: [...heirs, ...sibs.heirs],
      placeholders: sibs.placeholders,
      headline:
        branch === "parents_only"
          ? "Your parents get everything."
          : branch === "siblings_only"
            ? "Your siblings, and the children of any who died, share everything."
            : "Your parents and siblings share in equal parts.",
      rule:
        "With no spouse and no descendants, parents, siblings and the descendants of deceased siblings share in equal parts. If only one parent is living, that parent receives a double portion. A niece or nephew takes the share their parent would have received.",
    };
  }
  return {
    branch: "remote_relatives",
    heirs: [],
    placeholders: [],
    headline: "The estate would pass to more distant relatives.",
    rule: "With no spouse, descendants, parents or siblings (or their descendants), Illinois looks next to grandparents, then aunts, uncles and cousins, and so on. If no relative can be found, the property goes to the county. This tool does not work out those shares.",
  };
}

export function totalShare(r: InheritResult): Frac {
  return r.heirs.reduce((acc, h) => (h.parentId ? acc : addFrac(acc, h.share)), { n: 0, d: 1 });
}

/** Sum of every living heir's share. Should always be 1 unless the branch is remote_relatives. */
export function sumLivingShares(r: InheritResult): Frac {
  return r.heirs.reduce((acc, h) => addFrac(acc, h.share), { n: 0, d: 1 });
}

export const GUIDE_PATH = "/learn/wills/dying-without-a-will";

export const SUPPORTED_STATE = "IL";

export function isSupported(state: string): boolean {
  return state.toUpperCase() === SUPPORTED_STATE;
}
