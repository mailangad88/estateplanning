/**
 * Sensitive pages (B10). Visiting one of these can reveal a health condition, disability,
 * sexual orientation or gender identity, or financial hardship. Google and Meta ad policies
 * bar building audiences from that, and readers expect us not to.
 *
 * On these paths `track()` drops every non-essential parameter and skips remarketing-type
 * events entirely. Tag managers must also block ad pixels on these paths (see the
 * `ads_restricted` flag pushed with each event) and the paths must never seed remarketing
 * lists, customer match or lookalike audiences.
 *
 * Match is by path prefix, so a prefix covers every page under it. Add new audience pages
 * and guides here when they are written.
 */
export const SENSITIVE_PATH_PREFIXES: readonly string[] = [
  // Audience pages (planned)
  "/estate-planning-for/special-needs",
  "/estate-planning-for/new-diagnosis",
  "/estate-planning-for/after-a-diagnosis",
  "/estate-planning-for/after-a-death",
  "/estate-planning-for/serious-illness",
  "/estate-planning-for/lgbtq",
  "/estate-planning-for/same-sex-couples",
  "/estate-planning-for/caregivers",
  "/estate-planning-for/aging-parents",
  "/estate-planning-for/medicaid",
  "/estate-planning-for/elder-care",
  // Existing content
  "/guides/special-needs-trusts",
  "/learn/elder-care/medicaid-planning",
  "/compare/special-needs-trust-vs-able-account",
  "/life-events/serious-diagnosis",
  "/life-events/caring-for-aging-parents",
  // Planned briefs
  "/life-events/estate-planning-after-a-serious-diagnosis",
];

/**
 * Words that must never appear in an analytics event parameter value on any page,
 * because they describe health, disability, orientation, or benefits eligibility.
 */
export const SENSITIVE_TERMS =
  /special[\s_-]*needs|diagnos|dementia|alzheimer|cancer|terminal|hospice|illness|disab|medicaid|\bssi\b|long[\s_-]*term[\s_-]*care|nursing[\s_-]*home|elder[\s_-]*care|caregiv|aging[\s_-]*parent|lgbt|gay|lesbian|bisexual|transgender|queer|same[\s_-]*sex|\bhiv\b/i;

export function isSensitivePath(pathname: string): boolean {
  const p = (pathname.split(/[?#]/)[0] || "/").replace(/\/+$/, "").toLowerCase() || "/";
  return SENSITIVE_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`) || p.startsWith(`${prefix}-`));
}
