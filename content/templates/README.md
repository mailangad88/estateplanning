# Landing page templates

One template per search intent. Each says what the page must contain beyond the base format in
`content/LEARN-STYLE.md` (frontmatter, answer box, FAQs, links, voice). The daily pipeline
(`docs/content-pipeline.md`) picks the template from the queue item's `intent`.

| Intent | Use for | Template |
|---|---|---|
| question | A specific question people ask ("Can an executor take money out of the estate?") | question.md |
| explainer | A concept or process ("successor trustee checklist", "trust accounting") | explainer.md |
| comparison | X vs. Y | comparison.md |
| cost | "How much does X cost" | cost.md |
| scenario | "What happens if ..." when someone delays or skips a step ("What happens if my ex is still my beneficiary?") | scenario.md |
| situation | A reader's circumstance or audience ("estate planning for physicians") | situation.md |
| state-topic | A topic in one state ("probate in Ohio"). Blocked until the launch state is set and facts are attorney-verified | state-topic.md |
| city | A city the firm genuinely serves. Blocked until the firm confirms service areas | city.md |

Rules that apply to every template:

- Group related queue items into one page. A page that answers three closely related questions is better
  for readers and for search than three thin pages. Questions that need only a paragraph become FAQs on an
  existing page instead.
- Each page must say something no other page on the site says. Check the existing pages first
  (`grep -ril "<keyword>" content/`) and link to them rather than repeating them.
- Every page links to its pillar, two or more pages in other clusters, and a free tool or checklist, and ends
  with `## How we can help` pointing to the [plan finder](/plan-finder).
- Frontmatter adds `review: pending` and `intent: <intent>`. Only the attorney changes `review` to `approved`.

Visuals, tools and free resources (Angad, 2026-10-06: every page as visual as possible):

- The article visual kit (`src/config/visual-kit.ts`) gives every H2 section a picture automatically. Place
  the right one yourself where it helps most, with a marker on its own line in the body:
  `<!-- visual: whatif id=<scenario id> -->`, `<!-- visual: picker id=<picker id> -->`,
  `<!-- visual: timeline id=<timeline id> -->`, `<!-- visual: diagram name=<Diagram> -->`, or
  `<!-- visual: download slug=<free resource> -->`. A section with a table or numbered steps already counts
  as a visual.
- `npm run embeds -- <cluster>/<slug>` prints the what-if scenarios, `/decide` guide and free
  resource that fit a page (from `src/lib/page-embeds.ts`). Link the decision guide from the text where the
  reader is choosing between options, and name the free resource where the reader would use it.
- Link at least six other pages from the body text itself, not just the boxes around it.
  `tests/interlinking.test.ts` fails a library page with fewer.
