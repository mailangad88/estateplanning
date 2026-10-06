/**
 * Attorney advertising rules by state (B21). Source of truth for <Disclosures />, <Testimonials />
 * and the launch check. Built from research/attorney-advertising-rules-by-state.md (2026-10-06).
 *
 * NOTHING HERE IS ATTORNEY-VERIFIED. Every entry is `verified: false` until the responsible
 * attorney reads the primary rule text and flips it. `npm run launch-check` in strict mode
 * (production) fails while any served state is missing here or unverified.
 *
 * `evidence` is the weakest research tag behind the entry: V = read on an official or rule-mirror
 * page (via a summarizing fetch tool), S = secondary source only, U = could not be verified.
 *
 * Keep this file free of imports (the launch check loads it directly with Node type stripping).
 */

export type Evidence = "V" | "S" | "U";

export interface Label {
  text: string;
  placement: string;
}

export interface StateAdvertisingRules {
  code: string;
  name: string;
  /** What every ad, including a website, must identify. */
  identification: string;
  /** True when the city, town or county of a bona fide office must appear on every page or ad. */
  needsOfficeLocality: boolean;
  /** Label required on ordinary web pages and ads. Null when the rule text requires none. */
  webLabel: string | null;
  /** Label required on targeted email, text, mail or recorded solicitations. */
  solicitationLabel: Label | null;
  /** State-specific notices rendered on the site, in addition to the universal ones. */
  disclaimers: string[];
  testimonialRule: string;
  /** Text that must sit next to any testimonial shown to readers in this state. */
  testimonialDisclaimer: string | null;
  filing: { required: boolean; scope: string; fee: string | null };
  /** Years ad copies must be kept under the rule. Null when none found. Site policy keeps 4 years regardless. */
  retentionYears: number | null;
  evidence: Evidence;
  verified: boolean;
  verifiedBy: string | null;
  verifiedOn: string | null;
  sources: string[];
  asOf: string;
  notes: string;
}

/** Bumped whenever an entry changes; rendered as data-compliance-version. */
export const COMPLIANCE_VERSION = "2026-10-06";

/** Site policy: keep every page version, ad creative and email template this long (longest rule found: TX). */
export const SITE_RETENTION_YEARS = 4;

export const SITE_TESTIMONIAL_DISCLAIMER = "Every matter is different. Past experience does not guarantee a similar result.";

/** Universal label shown on every page, whatever the state rules say (research section 3.0, item 1). */
export const SITE_WEB_LABEL = "Attorney Advertising";

/** Conservative rules applied to any served state that has no entry below. */
export const DEFAULT_RULES: StateAdvertisingRules = {
  code: "default",
  name: "Unreviewed state",
  identification: "Name of a responsible attorney and firm, the office street address, city and state, and a phone number.",
  needsOfficeLocality: true,
  webLabel: "Attorney Advertising",
  solicitationLabel: { text: "ADVERTISEMENT", placement: "start and end of every targeted email, text, letter or recording; start of every email subject line" },
  disclaimers: [],
  testimonialRule: "Show no testimonials until this state's rule has been reviewed by the attorney.",
  testimonialDisclaimer: SITE_TESTIMONIAL_DISCLAIMER,
  filing: { required: true, scope: "Unknown. Treat every ad as needing filing review until checked.", fee: null },
  retentionYears: SITE_RETENTION_YEARS,
  evidence: "U",
  verified: false,
  verifiedBy: null,
  verifiedOn: null,
  sources: [],
  asOf: COMPLIANCE_VERSION,
  notes: "Fallback only. Add a researched entry for the state and have the attorney verify it.",
};

const ASOF = "2026-10-06";

export const STATE_RULES: Record<string, StateAdvertisingRules> = {
  CA: {
    code: "CA",
    name: "California",
    identification: "Name of at least one California-licensed lawyer or the firm, and the city, town or county of at least one bona fide office (Bus. & Prof. Code 6157.2(b), eff. 2026-01-01); name and address of a lawyer responsible for content (RPC 7.2(c)).",
    needsOfficeLocality: true,
    webLabel: null,
    solicitationLabel: { text: "Advertisement", placement: "beginning and end of written, recorded or electronic solicitations to people known to need legal services (RPC 7.3(c))" },
    disclaimers: [],
    testimonialRule: "May be misleading if it creates an unjustified expectation (RPC 7.1 cmt. 4). No dramatization without disclosure; no awards sold for a fee (6157.2(a)). Use the legacy disclaimer.",
    testimonialDisclaimer: "This testimonial or endorsement does not constitute a guarantee, warranty, or prediction regarding the outcome of your legal matter.",
    filing: { required: false, scope: "None found.", fee: null },
    retentionYears: null,
    evidence: "V",
    verified: false,
    verifiedBy: null,
    verifiedOn: null,
    sources: [
      "https://www.calbar.ca.gov/legal-professionals/rules/rules-professional-conduct/current-rules-professional-conduct/chapter-7-information-about-legal-services",
      "https://california.public.law/codes/business_and_professions_code_section_6157.2",
      "https://codes.findlaw.com/ca/business-and-professions-code/bpc-sect-6158-3/",
    ],
    asOf: ASOF,
    notes: "SB 37: private right of action and firm liability for vendor-written ads. Virtual-only addresses do not count as a bona fide office. Confirm the State Bar standards under RPC 7.1(b) for the testimonial wording.",
  },
  TX: {
    code: "TX",
    name: "Texas",
    identification: "Name of a responsible lawyer and the primary practice location (Rule 7.02).",
    needsOfficeLocality: true,
    webLabel: null,
    solicitationLabel: { text: "ADVERTISEMENT", placement: "first word of email subject lines and text or social messages; bold capitals on envelopes and letters (Rule 7.03)" },
    disclaimers: [],
    testimonialRule: "No testimonial-specific rule beyond false or misleading (7.01). Ethics Op. 685: may ask for reviews; must not encourage false ones and must correct a false review once known.",
    testimonialDisclaimer: null,
    filing: { required: true, scope: "Homepage, paid public-media ads and written solicitations: file with the Advertising Review Committee within 10 days after first use, or pre-clear 30 days before (7.04). Inner website pages exempt (7.05).", fee: "$100 per submission" },
    retentionYears: 4,
    evidence: "U",
    verified: false,
    verifiedBy: null,
    verifiedOn: null,
    sources: [
      "https://www.legalethicstexas.com/resources/rules/texas-disciplinary-rules-of-professional-conduct/advertisements",
      "https://www.legalethicstexas.com/resources/rules/texas-disciplinary-rules-of-professional-conduct/filing-requirements-for-advertisements-and-solicitation-communications/",
      "https://www.texasbar.com/Content/NavigationMenu/ForLawyers/AdvertisingReview/default.htm",
    ],
    asOf: ASOF,
    notes: "4-year retention is from pre-2021 text; current retention is unverified. Re-file the homepage on substantive change.",
  },
  FL: {
    code: "FL",
    name: "Florida",
    identification: "Name of at least one responsible lawyer or the firm, and the city, town or county of one or more bona fide offices; required text clear, conspicuous and in the language of the ad (Rule 4-7.12).",
    needsOfficeLocality: true,
    webLabel: null,
    solicitationLabel: { text: "Advertisement", placement: "face of envelope and each enclosure; first word of email subject lines; attachments marked (Rule 4-7.18(b)(2))" },
    disclaimers: [],
    testimonialRule: "Must carry the disclaimer that prospective clients may not obtain the same or similar results, may not be given for anything of value, and must reflect what clients generally experience (4-7.13(b)).",
    testimonialDisclaimer: "Prospective clients may not obtain the same or similar results.",
    filing: { required: true, scope: "Website exempt (4-7.20). Paid social, display, video, radio, unsolicited email and mail: file 20 days before first use (4-7.19). Any change is a new ad.", fee: "$250 timely, $750 late" },
    retentionYears: 3,
    evidence: "V",
    verified: false,
    verifiedBy: null,
    verifiedOn: null,
    sources: [
      "https://floridajustice.com/rule/4-7-12/",
      "https://floridajustice.com/rule/4-7-13/",
      "https://www.floridabar.org/ethics/etad/advertising-filing-requirements/",
    ],
    asOf: ASOF,
    notes: "Rules reach lawyers who target Florida residents whether or not admitted (4-7.11(b)). Chatbots must disclose they are AI (Op. 24-1). Read the Chapter 4 PDF directly.",
  },
  NY: {
    code: "NY",
    name: "New York",
    identification: "Name and contact information of at least one responsible lawyer or firm (new Rule 7.1, eff. 2026-06-01).",
    needsOfficeLocality: false,
    webLabel: null,
    solicitationLabel: null,
    disclaimers: [],
    testimonialRule: "Old mandatory results disclaimer and pending-matter consent rule eliminated 2026-06-01; general false-or-misleading standard. Keeping a disclaimer is still permitted and recommended.",
    testimonialDisclaimer: SITE_TESTIMONIAL_DISCLAIMER,
    filing: { required: false, scope: "None since 2026-06-01.", fee: null },
    retentionYears: null,
    evidence: "V",
    verified: false,
    verifiedBy: null,
    verifiedOn: null,
    sources: [
      "https://nysba.org/amendments-adopted-to-advertising-rules/",
      "https://www.nycourts.gov/rules/requests-public-comment",
    ],
    asOf: ASOF,
    notes: "Voluntary: keep the Attorney Advertising footer while the new regime is untested. Rule 7.2 (payment for referrals) unchanged; per-lead vendors need ethics review.",
  },
  PA: {
    code: "PA",
    name: "Pennsylvania",
    identification: "Name and contact information of at least one responsible lawyer or firm, and the city or town of the office where the lawyers who will do the work principally practice (Rule 7.2).",
    needsOfficeLocality: true,
    webLabel: null,
    solicitationLabel: null,
    disclaimers: [],
    testimonialRule: "General 7.1 standard; achievements may mislead if they create an unjustified expectation. Paid endorsements disclose compensation (2016 chart, secondary).",
    testimonialDisclaimer: SITE_TESTIMONIAL_DISCLAIMER,
    filing: { required: false, scope: "None found.", fee: null },
    retentionYears: null,
    evidence: "V",
    verified: false,
    verifiedBy: null,
    verifiedOn: null,
    sources: [
      "https://regulations.justia.com/states/pennsylvania/title-204/part-v/subpart-a/chapter-81/subchapter-a/information-about-legal-services/rule-7-2",
      "https://regulations.justia.com/states/pennsylvania/title-204/part-v/subpart-a/chapter-81/subchapter-a/information-about-legal-services/rule-7-3",
    ],
    asOf: ASOF,
    notes: "Justia mirror may lag. Confirm the uncertified-lawyer disclaimer wording and the 2024 text-message language in the Board's compiled rules.",
  },
  IL: {
    code: "IL",
    name: "Illinois",
    identification: "Name and office address of at least one responsible lawyer or firm (Rule 7.2(a)).",
    needsOfficeLocality: true,
    webLabel: null,
    solicitationLabel: { text: "Advertising Material", placement: "envelope, and beginning and end of recorded or electronic targeted solicitations (Rule 7.3(c)); \"promotional\" is not enough" },
    disclaimers: [],
    testimonialRule: "General 7.1 standard; an appropriate disclaimer may prevent a misleading finding.",
    testimonialDisclaimer: SITE_TESTIMONIAL_DISCLAIMER,
    filing: { required: false, scope: "None found.", fee: null },
    retentionYears: null,
    evidence: "V",
    verified: false,
    verifiedBy: null,
    verifiedOn: null,
    sources: [
      "https://www.courtrules.net/illinois/illinois-professional-conduct/rule-7-2",
      "https://ruledex.com/illinois/article-viii-illinois-rules-of-professional-conduct-of-2010/rule-7-3-solicitation-of-clients/",
    ],
    asOf: ASOF,
    notes: "Rule 7.4 restricts certification claims; citing any certificate needs the statement that Illinois does not recognize certification of lawyers in a field (confirm exact text).",
  },
  OH: {
    code: "OH",
    name: "Ohio",
    identification: "Name and office address of at least one responsible lawyer or firm (Rule 7.2(c)).",
    needsOfficeLocality: true,
    webLabel: null,
    solicitationLabel: { text: "ADVERTISING MATERIAL", placement: "beginning and end of targeted solicitations (or ADVERTISEMENT ONLY), with how the recipient was identified and a no-merits-evaluation statement (Rule 7.3)" },
    disclaimers: [],
    testimonialRule: "Rule 7.1 bars false, misleading or nonverifiable communications; unverifiable praise is the main exposure.",
    testimonialDisclaimer: SITE_TESTIMONIAL_DISCLAIMER,
    filing: { required: false, scope: "None found.", fee: null },
    retentionYears: null,
    evidence: "S",
    verified: false,
    verifiedBy: null,
    verifiedOn: null,
    sources: [
      "https://ruledex.com/ohio/prof-cond-rule/vii-information-about-legal-services/rule-7-1-communications-concerning-a-lawyers-services/",
      "https://ruledex.com/ohio/prof-cond-rule/vii-information-about-legal-services/rule-7-3-solicitation-of-clients/",
    ],
    asOf: ASOF,
    notes: "No fee adjectives such as discount, special, cut-rate or lowest. Solicitation label text is secondary-sourced; read 7.3 on the Supreme Court site.",
  },
  GA: {
    code: "GA",
    name: "Georgia",
    identification: "Pre-2026 text: name, physical location and phone of the responsible lawyer, displayed prominently. Rules amended 2026-03-01; current text unread.",
    needsOfficeLocality: true,
    webLabel: null,
    solicitationLabel: { text: "Advertisement", placement: "direct mail envelope and top of each page; email subject (pre-2026 text)" },
    disclaimers: [],
    testimonialRule: "Pre-2026: paid testimonials, spokespersons and portrayals need prominent disclosure. Current rule unverified.",
    testimonialDisclaimer: SITE_TESTIMONIAL_DISCLAIMER,
    filing: { required: false, scope: "None required pre-2026; current rule unverified.", fee: null },
    retentionYears: 2,
    evidence: "U",
    verified: false,
    verifiedBy: null,
    verifiedOn: null,
    sources: [
      "https://www.gabar.org/home/2025/11/20/supreme-court-of-georgia-approves-amendments-to-the-rules-and-regulations-of-the-state-bar-of-georgia",
      "https://www.gasupreme.us/wp-content/uploads/2025/11/S24U0172.pdf",
    ],
    asOf: ASOF,
    notes: "Open task: read Supreme Court order S24U0172. Apply the prescriptive pre-2026 regime until then.",
  },
  NC: {
    code: "NC",
    name: "North Carolina",
    identification: "Name and contact information of at least one responsible lawyer or firm (Rule 7.2(d)).",
    needsOfficeLocality: false,
    webLabel: null,
    solicitationLabel: null,
    disclaimers: [],
    testimonialRule: "General 7.1 standard; no testimonial-specific rule found.",
    testimonialDisclaimer: SITE_TESTIMONIAL_DISCLAIMER,
    filing: { required: false, scope: "None found.", fee: null },
    retentionYears: null,
    evidence: "V",
    verified: false,
    verifiedBy: null,
    verifiedOn: null,
    sources: [
      "https://www.ncbar.gov/for-lawyers/ethics-and-governing-rules/rules-of-professional-conduct/71-76-information-about-legal-services/72-communications-concerning-a-lawyers-services-specific-rules/",
      "https://www.ncbar.gov/for-lawyers/ethics-and-governing-rules/ethics-opinions/opinions/2017-formal-ethics-opinion-1/",
    ],
    asOf: ASOF,
    notes: "Text advertising allowed; texts must carry the lawyer's name and office address (2017 FEO 1).",
  },
  MI: {
    code: "MI",
    name: "Michigan",
    identification: "Name and office address of at least one responsible lawyer or firm (Rule 7.2(c)); media ads under a phone number, URL or trade name identify a responsible lawyer on the ad or the website homepage (7.2(d)).",
    needsOfficeLocality: true,
    webLabel: null,
    solicitationLabel: null,
    disclaimers: [],
    testimonialRule: "General 7.1 false, misleading or deceptive standard; no testimonial-specific rule found.",
    testimonialDisclaimer: SITE_TESTIMONIAL_DISCLAIMER,
    filing: { required: false, scope: "None.", fee: null },
    retentionYears: 2,
    evidence: "S",
    verified: false,
    verifiedBy: null,
    verifiedOn: null,
    sources: [
      "https://www.courts.michigan.gov/siteassets/rules-instructions-administrative-orders/rules-of-professional-conduct/michigan-rules-of-professional-conduct.pdf?r=1",
    ],
    asOf: ASOF,
    notes: "2-year retention is from a vendor summary only.",
  },
};

export interface MergedRules {
  states: string[];
  /** Served states with no entry; the conservative default was applied for them. */
  missing: string[];
  /** Served states whose entry is not attorney-verified (missing states included). */
  unverified: string[];
  entries: StateAdvertisingRules[];
  webLabels: string[];
  disclaimers: string[];
  testimonialDisclaimers: string[];
  needsOfficeLocality: boolean;
  filingRequired: string[];
  retentionYears: number;
}

/** Strictest merge across states: union of text, max retention, any filing flag. */
export function rulesFor(states: string[]): MergedRules {
  const codes = [...new Set(states.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const missing = codes.filter((c) => !STATE_RULES[c]);
  const entries = codes.map((c) => STATE_RULES[c] ?? { ...DEFAULT_RULES, code: c });
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => Boolean(x)))];
  const webLabels = uniq([SITE_WEB_LABEL, ...entries.map((e) => e.webLabel)]);
  return {
    states: codes,
    missing,
    unverified: entries.filter((e) => !e.verified).map((e) => e.code),
    entries,
    webLabels,
    disclaimers: uniq(entries.flatMap((e) => e.disclaimers)),
    testimonialDisclaimers: uniq([SITE_TESTIMONIAL_DISCLAIMER, ...entries.map((e) => e.testimonialDisclaimer)]),
    needsOfficeLocality: entries.length === 0 || entries.some((e) => e.needsOfficeLocality),
    filingRequired: entries.filter((e) => e.filing.required).map((e) => e.code),
    retentionYears: Math.max(SITE_RETENTION_YEARS, ...entries.map((e) => e.retentionYears ?? 0)),
  };
}

export function stateName(code: string): string {
  return STATE_RULES[code]?.name ?? code;
}
