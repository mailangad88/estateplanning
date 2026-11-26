/**
 * Older /guides, /compare and /blog pages that duplicated a library article and were folded into it
 * (2026-10-06). Each old path 301-redirects to its /learn page (next.config.ts), and related-link slugs
 * that named the old page resolve to the library article instead. Keep this list: the redirects must
 * stay live for as long as anyone links to the old URLs.
 */
export const MERGED_PAGES: [from: string, to: string][] = [
  ["/guides/business-succession-planning", "/learn/business-owners/business-succession-planning"],
  ["/guides/choosing-a-trustee", "/learn/trusts/choosing-a-trustee"],
  ["/guides/choosing-an-executor", "/learn/wills/choosing-an-executor"],
  ["/guides/leaving-money-to-minors", "/learn/guardianship/leaving-money-to-minors"],
  ["/guides/what-is-estate-planning", "/learn/basics/what-is-estate-planning"],
  ["/compare/power-of-attorney-vs-guardianship", "/learn/power-of-attorney/power-of-attorney-vs-guardianship"],
  ["/compare/probate-vs-non-probate-assets", "/learn/probate/probate-vs-non-probate-assets"],
  ["/compare/will-vs-trust", "/learn/trusts/will-vs-trust"],
  ["/blog/estate-planning-for-unmarried-couples", "/learn/life-stages/estate-planning-for-unmarried-couples"],
  ["/blog/how-long-does-probate-take", "/learn/probate/how-long-does-probate-take"],
  ["/guides/what-happens-if-you-die-without-a-will", "/learn/wills/dying-without-a-will"],
  ["/guides/updating-your-estate-plan", "/learn/basics/when-to-update-your-estate-plan"],
  ["/guides/transfer-on-death-and-payable-on-death", "/learn/beneficiary-designations/payable-on-death-and-transfer-on-death-accounts"],
  ["/guides/revocable-living-trust-explained", "/learn/trusts/revocable-living-trust"],
  ["/guides/digital-assets-estate-planning", "/learn/digital-assets/digital-assets-in-your-estate-plan"],
  ["/guides/medicaid-and-long-term-care-planning", "/learn/elder-care/medicaid-planning"],
  ["/blog/what-happens-to-debt-when-someone-dies", "/learn/probate/dealing-with-debts-in-probate"],
  // Illinois-only launch (2026-11-26): articles that named New Jersey in their URL were renamed.
  ["/learn/basics/what-is-community-property-and-does-it-apply-in-illinois-or-new-jersey", "/learn/basics/what-is-community-property-and-does-it-apply-in-illinois"],
  ["/learn/wills/who-can-witness-a-will-in-illinois-and-new-jersey", "/learn/wills/who-can-witness-a-will-in-illinois"],
  ["/learn/probate/cheapest-way-to-settle-an-estate-in-illinois-or-new-jersey", "/learn/probate/cheapest-way-to-settle-an-estate-in-illinois"],
  ["/learn/probate/how-long-do-you-have-to-file-probate-in-illinois-or-new-jersey", "/learn/probate/how-long-do-you-have-to-file-probate-in-illinois"],
  ["/learn/business-owners/illinois-estate-tax-and-new-jersey-inheritance-tax-on-a-family-business", "/learn/business-owners/illinois-estate-tax-on-a-family-business"],
  // The two-state probate comparison now sits in the New Jersey section (hidden until NJ is served).
  ["/learn/probate/illinois-and-new-jersey-probate-compared", "/learn/illinois/how-to-open-a-probate-estate-in-illinois"],
];
