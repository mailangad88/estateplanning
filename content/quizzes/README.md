# Quizzes

Each JSON file is one quiz at `/quizzes/<slug>`. The visitor sees their score and band for free; the
detailed answer review (or report) is emailed and unlocked with an email opt-in, and the quiz offers one
resource from `content/magnets`. Follow `content/STYLE.md`. Keep `reviewed: false` until the attorney approves.

```json
{
  "title": "Estate Planning IQ Quiz",
  "promise": "Ten questions. See how much of what people believe about wills and trusts is actually true.",
  "description": "Meta description, 140 to 160 characters.",
  "kind": "knowledge",            // "knowledge" (one correct answer each) or "assessment" (points add up)
  "category": "basics",           // same keys as content/magnets
  "magnet": "estate-planning-checklist",   // a slug in content/magnets offered with the result
  "related": ["guides/what-is-estate-planning"],
  "reviewed": false,
  "updated": "2026-10-06",
  "questions": [
    {
      "id": "q1",
      "prompt": "If you die without a will, everything goes to the state.",
      "options": [
        { "label": "True", "points": 0 },
        { "label": "False", "points": 1 }
      ],
      "explanation": "Almost never. State law names heirs, usually a spouse, children, parents or siblings..."
    }
  ],
  "bands": [
    { "min": 0, "max": 4, "label": "Lots of surprises", "summary": "Two or three sentences..." },
    { "min": 5, "max": 7, "label": "Good instincts", "summary": "..." },
    { "min": 8, "max": 10, "label": "Well informed", "summary": "..." }
  ]
}
```

Bands must cover every possible total from 0 to the maximum points with no gaps or overlaps.
