# Content style guide (for every page on the site)

Everything here is DRAFT educational content, written before the attorney's brain-file interviews.
Every file carries `reviewed: false` until the attorney approves it, and the site shows a
"pending attorney review" note on unreviewed pages.

## Voice
- Plain English, about an 8th-grade reading level. Short sentences (under 25 words). Short paragraphs (3 sentences max).
- Talk to the reader as "you". Warm, calm, direct. Like a good lawyer explaining things to a neighbour.
- Specific over vague: concrete examples ("If you leave your house to your two kids..."), real mechanics, real steps.
- Educational, never individual advice. Say what people commonly do or consider, never "you need X".
- Laws vary by state. When a rule differs by state, say so plainly and suggest asking an attorney licensed in the reader's state. Do not state a specific state's rule as if universal.
- No invented statistics, studies or percentages. Only use well-established federal figures, write "as of 2026", and add an HTML comment `<!-- verify -->` right after the figure.
  Known figures you may use: federal estate tax exemption $15 million per person for 2026 (indexed for inflation after), annual gift tax exclusion $19,000 per recipient (2025 figure), Medicaid look-back period 60 months (California differs), ABLE account annual contribution limit equals the gift exclusion.
- No em dashes. Use commas, colons or separate sentences.
- Banned phrases: "navigate the complexities", "peace of mind" (unless followed by a concrete reason), "in today's world", "it's important to note", "when it comes to", "delve", "crucial", "robust", "seamless", "unlock", "embark", "journey", "landscape", "tapestry", "ever-changing", "game-changer", "comprehensive guide", "in conclusion", "at the end of the day".
- No headings that are questions repeated in the first sentence. Lead each section with the answer.
- End each guide with a short "Next step" section pointing to a relevant tool, checklist, or booking a consult at /plan-finder.

## Internal links (use these paths)
- Guides: /guides/<slug>     Comparisons: /compare/<slug>     Life events: /life-events/<slug>
- Checklists: /checklists/<slug>     Glossary: /glossary#<term-slug>     Tools: /tools/<slug>
- Plan finder (book a consult): /plan-finder
Tool slugs that exist: estate-tax-estimator, probate-cost-estimator, life-insurance-needs, guardian-fund-calculator, medicaid-lookback-date, plan-readiness-assessment, executor-workload, plan-review-reminder.

## Markdown
- Body is GitHub-flavored markdown. No H1 (the title comes from frontmatter). Use `##` and `###`.
- Tables allowed. Keep lists parallel. No HTML except the verify comment.
