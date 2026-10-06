/**
 * Probate asset sorter. Pure logic and data, no React.
 * Sorts a person's assets into "goes through probate" and "passes outside probate" by how each is held,
 * then (Illinois) compares the probate bucket with the small estate affidavit using the data in smallEstate.ts.
 * Educational only. Nothing here is legal advice.
 */
import { SMALL_ESTATE_RULES, capForDeath, factUsable, type SmallEstateRule } from "./smallEstate";

export type AssetKind =
  | "house" | "second_property" | "checking" | "savings" | "brokerage" | "retirement"
  | "life_insurance" | "vehicle" | "business" | "crypto" | "belongings";

export type Holding = "sole" | "jtwros" | "beneficiary" | "trust" | "tod_deed" | "tbe";
export type BeneficiaryStatus = "person" | "estate" | "deceased" | "unsure";
export type JointPurpose = "co_owner" | "convenience";
export type Bucket = "probate" | "outside";
export type TrapCode =
  | "estate_beneficiary" | "dead_beneficiary" | "unsure_beneficiary" | "convenience_joint"
  | "trust_not_retitled" | "tod_deed_recorded";

export interface AssetKindInfo {
  label: string;
  real: boolean;
  /** Holdings that can apply to this kind of asset. */
  holdings: Holding[];
  /** What the "beneficiary" holding is called for this kind. */
  beneficiaryLabel: string;
  soleLabel: string;
}

const RE: Holding[] = ["sole", "jtwros", "tbe", "trust", "tod_deed"];

export const ASSET_KINDS: Record<AssetKind, AssetKindInfo> = {
  house: { label: "Home", real: true, holdings: RE, beneficiaryLabel: "", soleLabel: "My name only" },
  second_property: { label: "Second property", real: true, holdings: RE, beneficiaryLabel: "", soleLabel: "My name only" },
  checking: { label: "Checking account", real: false, holdings: ["sole", "jtwros", "beneficiary", "trust"], beneficiaryLabel: "Payable on death (POD) beneficiary named", soleLabel: "My name only, no POD" },
  savings: { label: "Savings account", real: false, holdings: ["sole", "jtwros", "beneficiary", "trust"], beneficiaryLabel: "Payable on death (POD) beneficiary named", soleLabel: "My name only, no POD" },
  brokerage: { label: "Brokerage account", real: false, holdings: ["sole", "jtwros", "beneficiary", "trust"], beneficiaryLabel: "Transfer on death (TOD) beneficiary named", soleLabel: "My name only, no TOD" },
  retirement: { label: "401(k) or IRA", real: false, holdings: ["beneficiary", "sole", "trust"], beneficiaryLabel: "Beneficiary named on the account", soleLabel: "No beneficiary on file" },
  life_insurance: { label: "Life insurance", real: false, holdings: ["beneficiary", "sole", "trust"], beneficiaryLabel: "Beneficiary named on the policy", soleLabel: "No beneficiary on file" },
  vehicle: { label: "Car or vehicle", real: false, holdings: ["sole", "jtwros", "trust"], beneficiaryLabel: "", soleLabel: "My name only" },
  business: { label: "Business interest", real: false, holdings: ["sole", "beneficiary", "trust"], beneficiaryLabel: "Successor named in the operating or buy-sell agreement", soleLabel: "My name only" },
  crypto: { label: "Crypto", real: false, holdings: ["sole", "jtwros", "trust"], beneficiaryLabel: "", soleLabel: "My name only" },
  belongings: { label: "Personal belongings", real: false, holdings: ["sole", "trust"], beneficiaryLabel: "", soleLabel: "My name only" },
};

export const HOLDING_LABEL: Record<Holding, string> = {
  sole: "My name only",
  jtwros: "Joint with right of survivorship",
  beneficiary: "Beneficiary named",
  trust: "Held in my living trust",
  tod_deed: "Transfer on death instrument",
  tbe: "Tenancy by the entirety",
};

export function holdingLabel(kind: AssetKind, h: Holding): string {
  const k = ASSET_KINDS[kind];
  if (h === "sole") return k.soleLabel;
  if (h === "beneficiary" && k.beneficiaryLabel) return k.beneficiaryLabel;
  return HOLDING_LABEL[h];
}

export interface AssetInput {
  id: string;
  kind: AssetKind;
  /** Approximate value in dollars. */
  value: number;
  holding: Holding;
  /** Only used when holding is "beneficiary". Defaults to "person". */
  beneficiary?: BeneficiaryStatus;
  /** Only used when holding is "jtwros" or "tbe". Defaults to "co_owner". */
  jointPurpose?: JointPurpose;
}

export interface SortedAsset extends AssetInput {
  bucket: Bucket;
  label: string;
  why: string;
  flags: TrapCode[];
}

export interface TrapNote { title: string; text: string }

export const TRAPS: Record<TrapCode, TrapNote> = {
  estate_beneficiary: {
    title: "Beneficiary is \"my estate\"",
    text: "Naming your estate as the beneficiary sends the money into probate, which defeats the point of a beneficiary form. It can also expose it to your creditors and, for retirement accounts, shorten the payout period.",
  },
  dead_beneficiary: {
    title: "Beneficiary has already died",
    text: "If the only beneficiary died first and there is no backup (contingent) beneficiary, many forms default to your estate. Add a living beneficiary and a backup, and read each form to see what it says.",
  },
  unsure_beneficiary: {
    title: "Not sure who is on the form",
    text: "A beneficiary form you cannot remember is worth checking. Old forms often name an ex-spouse, a person who has died, or nobody. Until you check, treat this asset as possibly probate.",
  },
  convenience_joint: {
    title: "Joint account added for convenience",
    text: "A joint owner usually takes the whole account when you die, even if you only added them to pay bills. That can leave out your other children and cause family disputes. A durable power of attorney or a POD beneficiary does the same job without making someone a co-owner.",
  },
  trust_not_retitled: {
    title: "Is the trust really the owner?",
    text: "A trust only avoids probate for assets that are actually titled in its name or that name it as beneficiary. Check the deed, the account title, or the beneficiary form. Unfunded assets can still go through probate.",
  },
  tod_deed_recorded: {
    title: "Transfer on death deed must be recorded",
    text: "A transfer on death instrument for real estate generally works only if it was signed, witnessed or notarized as the state requires, and recorded before death. Check the county record. See the guide on transfer on death and payable on death.",
  },
};

function beneficiaryOutcome(a: AssetInput, name: string): Pick<SortedAsset, "bucket" | "why" | "flags"> {
  const st = a.beneficiary ?? "person";
  if (st === "estate") {
    return { bucket: "probate", why: `Your ${name} names your estate as beneficiary, so it is paid to the estate and goes through probate.`, flags: ["estate_beneficiary"] };
  }
  if (st === "deceased") {
    return { bucket: "probate", why: `The named beneficiary has died. Without a living backup beneficiary, the ${name} often defaults to your estate and goes through probate.`, flags: ["dead_beneficiary"] };
  }
  if (st === "unsure") {
    return { bucket: "probate", why: `You are not sure who is named on the ${name}. If no valid living beneficiary is on file, it goes to your estate. Check the form.`, flags: ["unsure_beneficiary"] };
  }
  return { bucket: "outside", why: `A living beneficiary is named, so the ${name} is paid directly to that person by contract and skips probate.`, flags: [] };
}

export function sortAsset(a: AssetInput): SortedAsset {
  const info = ASSET_KINDS[a.kind];
  const name = info.label.toLowerCase();
  const label = info.label;
  const done = (bucket: Bucket, why: string, flags: TrapCode[] = []): SortedAsset => ({ ...a, bucket, label, why, flags });

  switch (a.holding) {
    case "sole":
      if (a.kind === "retirement" || a.kind === "life_insurance") {
        return done("probate", `No beneficiary is on file for your ${name}, so it is paid to your estate (or per the plan's default rules) and may go through probate.`);
      }
      return done("probate", `Held in your name alone with no survivor or beneficiary named, your ${name} is part of your probate estate.`);
    case "jtwros":
    case "tbe": {
      const tbe = a.holding === "tbe";
      const flags: TrapCode[] = a.jointPurpose === "convenience" ? ["convenience_joint"] : [];
      const how = tbe
        ? `Tenancy by the entirety passes to the surviving spouse automatically.`
        : `Joint with right of survivorship passes to the surviving co-owner automatically.`;
      return done("outside", `${how} Your ${name} skips probate at the first death. If the co-owner dies first, it becomes yours alone and is back in your probate estate unless you re-title it.`, flags);
    }
    case "beneficiary": {
      const o = beneficiaryOutcome(a, name);
      return done(o.bucket, o.why, o.flags);
    }
    case "trust":
      return done("outside", `Titled in your living trust, your ${name} is managed by the successor trustee under the trust, not by the probate court.`, ["trust_not_retitled"]);
    case "tod_deed":
      return done("outside", `A transfer on death instrument names who receives the ${name} at your death, so it skips probate if it is valid and recorded.`, ["tod_deed_recorded"]);
  }
}

export interface SortResult {
  probate: SortedAsset[];
  outside: SortedAsset[];
  probateTotal: number;
  outsideTotal: number;
  total: number;
  /** 0 to 100, rounded. 0 when there is no value. */
  probateShare: number;
  outsideShare: number;
  traps: { code: TrapCode; assetIds: string[] }[];
}

export function sortAssets(assets: AssetInput[]): SortResult {
  const sorted = assets.map(sortAsset);
  const probate = sorted.filter((s) => s.bucket === "probate");
  const outside = sorted.filter((s) => s.bucket === "outside");
  const sum = (xs: SortedAsset[]) => xs.reduce((t, x) => t + Math.max(0, x.value || 0), 0);
  const probateTotal = sum(probate);
  const outsideTotal = sum(outside);
  const total = probateTotal + outsideTotal;
  const probateShare = total > 0 ? Math.round((probateTotal / total) * 100) : 0;
  const trapMap = new Map<TrapCode, string[]>();
  for (const s of sorted) for (const f of s.flags) trapMap.set(f, [...(trapMap.get(f) ?? []), s.id]);
  const order: TrapCode[] = ["estate_beneficiary", "dead_beneficiary", "unsure_beneficiary", "convenience_joint", "trust_not_retitled", "tod_deed_recorded"];
  const traps = order.filter((c) => trapMap.has(c)).map((code) => ({ code, assetIds: trapMap.get(code)! }));
  return { probate, outside, probateTotal, outsideTotal, total, probateShare, outsideShare: total > 0 ? 100 - probateShare : 0, traps };
}

export type AffidavitVerdict =
  | "under_cap"
  | "over_cap"
  | "real_estate_needs_other_route"
  | "nothing_in_probate"
  | "number_hidden";

export interface AffidavitComparison {
  verdict: AffidavitVerdict;
  rule: SmallEstateRule;
  /** Probate personal property that counts toward the cap (vehicles and real estate left out). */
  counted: number;
  vehiclesLeftOut: number;
  realEstateInProbate: number;
  /** null when the number cannot be shown (R4). */
  cap: number | null;
  asOf: string;
  statuteCite: string;
  source: string;
}

/**
 * Illinois only. Compares the probate bucket with the small estate affidavit using the shared rule data.
 * The cap shown is the one for a death today (the tool cannot know the future date of death).
 * Returns null for any other state.
 */
export function compareIllinoisAffidavit(result: SortResult, state: string, today: Date): AffidavitComparison | null {
  if (state !== "IL") return null;
  const rule = SMALL_ESTATE_RULES.IL;
  if (!rule) return null;
  let counted = 0;
  let vehiclesLeftOut = 0;
  let realEstateInProbate = 0;
  for (const a of result.probate) {
    const v = Math.max(0, a.value || 0);
    if (ASSET_KINDS[a.kind].real) realEstateInProbate += v;
    else if (a.kind === "vehicle" && rule.vehiclesExcluded) vehiclesLeftOut += v;
    else counted += v;
  }
  const base = { rule, counted, vehiclesLeftOut, realEstateInProbate, asOf: rule.asOf, statuteCite: rule.statuteCite, source: rule.source };
  const iso = today.toISOString().slice(0, 10);
  const cap = capForDeath(rule, iso, false, today);
  if (!factUsable(rule, today) || typeof cap !== "number") return { ...base, cap: null, verdict: "number_hidden" };
  if (result.probate.length === 0) return { ...base, cap, verdict: "nothing_in_probate" };
  if (counted > cap) return { ...base, cap, verdict: "over_cap" };
  if (realEstateInProbate > 0) return { ...base, cap, verdict: "real_estate_needs_other_route" };
  return { ...base, cap, verdict: "under_cap" };
}

export const ASSET_SORTER_DISCLAIMER = "General information, not legal advice. Laws differ by state.";
