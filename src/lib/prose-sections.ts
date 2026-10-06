/**
 * Wraps recognisable H2 sections of rendered article HTML in styled panels, so long guides read as a
 * series of visual blocks: worked examples become a story card, mistakes a warning panel, questions
 * for an attorney a checklist panel. Only the wrapper changes; the content is untouched.
 */
const KINDS: [RegExp, string][] = [
  [/example/i, "story"],
  [/mistake|pitfall|avoid/i, "warn"],
  [/questions to ask|what to bring|checklist/i, "ask"],
  [/^(the )?next step|what to do next/i, "next"],
];

export function decorateSections(html: string): string {
  const parts = html.split(/(?=<h2[\s>])/);
  return parts
    .map((part) => {
      const m = part.match(/^<h2[^>]*>([\s\S]*?)<\/h2>/);
      if (!m) return part;
      const text = m[1].replace(/<[^>]+>/g, "").trim();
      const kind = KINDS.find(([re]) => re.test(text))?.[1];
      return kind ? `<section class="prose-panel prose-panel--${kind}">${part}</section>` : part;
    })
    .join("");
}
