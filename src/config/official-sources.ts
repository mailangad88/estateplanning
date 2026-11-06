/**
 * Official places to check the law behind a library article, by cluster. Shown only on articles whose own
 * text links no government or statute source (see OfficialSources). Home pages of the agencies only, so the
 * links do not break when a page inside the site moves. Add deeper links in the article itself.
 */
export interface OfficialSource {
  name: string;
  url: string;
  what: string;
}

const ILGA: OfficialSource = { name: "Illinois General Assembly", url: "https://www.ilga.gov/", what: "the Illinois Compiled Statutes, including the Probate Act (755 ILCS 5) and the Trust Code (760 ILCS 3)" };
const COURTS: OfficialSource = { name: "Illinois Courts", url: "https://www.illinoiscourts.gov/", what: "statewide court forms and self-help for probate, guardianship and small estates" };
const IRS: OfficialSource = { name: "Internal Revenue Service", url: "https://www.irs.gov/", what: "federal estate, gift and income tax rules" };
const AG: OfficialSource = { name: "Illinois Attorney General", url: "https://illinoisattorneygeneral.gov/", what: "Illinois estate tax returns and consumer protection" };
const AGING: OfficialSource = { name: "Illinois Department on Aging", url: "https://ilaging.illinois.gov/", what: "services for older adults and caregivers in Illinois" };
const HFS: OfficialSource = { name: "Illinois Department of Healthcare and Family Services", url: "https://hfs.illinois.gov/", what: "Illinois Medicaid, long-term care eligibility and estate recovery" };
const SSA: OfficialSource = { name: "Social Security Administration", url: "https://www.ssa.gov/", what: "SSI, SSDI and survivor benefits" };
const CFPB: OfficialSource = { name: "Consumer Financial Protection Bureau", url: "https://www.consumerfinance.gov/", what: "bank accounts, debts and money management for someone else" };
const MEDICARE: OfficialSource = { name: "Medicare", url: "https://www.medicare.gov/", what: "what Medicare does and does not pay for long-term care" };

const BY_CLUSTER: Record<string, OfficialSource[]> = {
  "estate-tax": [IRS, AG, ILGA],
  "elder-care": [HFS, AGING, MEDICARE, ILGA],
  "special-needs": [SSA, HFS, ILGA],
  "beneficiary-designations": [CFPB, ILGA, IRS],
  "digital-assets": [ILGA, CFPB],
  "business-owners": [ILGA, IRS],
  "after-a-death": [COURTS, ILGA, SSA],
  probate: [COURTS, ILGA],
  guardianship: [COURTS, ILGA],
  "power-of-attorney": [ILGA, CFPB],
  "healthcare-directives": [ILGA, AGING],
};

/** Sources for a cluster. New Jersey pages get none here (they are hidden from the first launch). */
export function officialSourcesFor(cluster: string): OfficialSource[] {
  if (cluster === "new-jersey") return [];
  return BY_CLUSTER[cluster] ?? [ILGA, COURTS];
}

/** True when the article body already links a government or statute source. */
export function citesOfficialSource(html: string): boolean {
  return /href="https?:\/\/[^"]*(\.gov\b|ilga\.gov|law\.cornell\.edu|uscode\.house\.gov)/i.test(html);
}
