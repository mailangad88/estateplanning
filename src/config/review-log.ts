/**
 * AI content review log (B4). Describes how drafts become published, attorney-reviewed pages,
 * and records each attorney sign-off. Rendered at /editorial-policy/review-log.
 *
 * Per-page review status ("Draft pending attorney review" vs reviewed) comes from each page's
 * `reviewed` and `updated` frontmatter. A page is only marked `reviewed: true` after a sign-off
 * is recorded below.
 */

export interface ReviewStep {
  step: string;
  who: string;
  detail: string;
}

export const REVIEW_PROCESS: ReviewStep[] = [
  { step: "Research", who: "Editor", detail: "Collect primary sources (statutes, court and bar pages, agency guidance) and the attorney's recorded answers. Every claim gets a source or is marked unverified." },
  { step: "Draft", who: "Editor, with AI writing tools", detail: "Drafts may be written or restructured with AI tools from the research notes. The draft is marked reviewed: false and shows \"Draft pending attorney review\" on the page." },
  { step: "Automated checks", who: "Build", detail: "Every build runs the launch check for restricted advertising words and unfilled placeholders, and tests every internal link." },
  { step: "Attorney review", who: "Responsible attorney", detail: "Reads the page against the sources and the law of the states served, corrects or removes anything inaccurate, and approves the final wording." },
  { step: "Sign-off", who: "Responsible attorney", detail: "A sign-off is recorded below (page, date, version) and the page's reviewed flag and review date are set. Only then does the page say it was reviewed." },
  { step: "Re-review", who: "Responsible attorney", detail: "Pages citing dollar figures, deadlines or state rules are re-checked every January, when the law changes, and after any substantive edit." },
];

export interface ReviewSignoff {
  /** Site path, e.g. /guides/how-probate-works */
  path: string;
  reviewedBy: string;
  /** ISO date of the sign-off. */
  date: string;
  /** Git commit or content version that was approved. */
  version: string;
  notes?: string;
}

/** Attorney sign-offs. Empty until the attorney reviews pages. Never add an entry the attorney did not make. */
export const REVIEW_SIGNOFFS: ReviewSignoff[] = [];
