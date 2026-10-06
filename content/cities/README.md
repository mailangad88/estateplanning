# City landing pages

Add `content/cities/{state-slug}.json` (state slugs from `content/states.json`) once the launch state is
confirmed. A city page is published at `/estate-planning/{state-slug}/{city-slug}` only when:

1. the state's two-letter code is in `SERVED_STATES`, and
2. the city has at least one entry in `localNotes`.

`localNotes` must be verified, genuinely local information (the probate court and how its calendar runs,
county recording office practice for transfer-on-death deeds, local senior or veterans resources, the
neighborhoods the office serves). Pages that only swap the city name are doorway pages: search engines
penalize them, and they mislead readers. If there is nothing local to say about a city, leave it out.

```json
{
  "cities": [
    {
      "slug": "springfield",
      "name": "Springfield",
      "county": "Sangamon County",
      "probateCourt": { "name": "Sangamon County Circuit Court, Probate Division", "address": "...", "url": "https://..." },
      "localNotes": ["One or more verified paragraphs about planning or probate in this city."],
      "nearby": ["chatham", "rochester"],
      "updated": "2026-10-06"
    }
  ]
}
```
