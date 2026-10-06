import { absoluteUrl, site } from "@/config/site";
import { getGlossary as getShortDefinitions } from "@/lib/content";
import { getGlossary } from "@/lib/library";

export const dynamic = "force-static";

/** Machine-readable glossary for AI assistants and other tools (listed in llms.txt). */
export function GET() {
  const pages = getGlossary();
  const terms = [
    ...pages.map((g) => ({ term: g.term, definition: g.short, url: absoluteUrl(g.url), alsoKnownAs: g.also, seeAlso: g.seeAlso })),
    ...getShortDefinitions()
      .filter((t) => !pages.some((g) => g.slug === t.slug))
      .map((t) => ({ term: t.term, acronym: t.acronym ?? undefined, definition: t.definition, url: absoluteUrl(`/glossary#${t.slug}`), seeAlso: t.related ?? [] })),
  ].sort((a, b) => a.term.localeCompare(b.term));
  return Response.json({
    name: "Estate planning glossary",
    url: absoluteUrl("/glossary"),
    status: site.reviewStatus,
    note: "General information, not legal advice. Laws vary by state.",
    terms,
  });
}
