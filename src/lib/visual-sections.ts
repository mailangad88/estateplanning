/**
 * Splits rendered article HTML into its H2 sections and gives each section a visual from the kit
 * (config/visual-kit.ts): first any the writer placed with a marker or in frontmatter, otherwise one
 * picked from the section heading and the page topic. Sections that already carry a picture (a table,
 * or a numbered list, which is drawn as a timeline) are left alone. Nothing repeats on a page.
 */
import { decorateSections } from "@/lib/prose-sections";
import { diagramRegistry } from "@/components/visuals/diagrams/registry";
import { WHAT_IF_SCENARIOS } from "@/config/what-if-scenarios";
import { DECISIONS } from "@/config/decisions";
import { MARKER_RE, PICKERS, TIMELINES, isWidget, parseMarker, type VisualSpec } from "@/config/visual-kit";

export type Segment = { html: string } | { visual: VisualSpec };

export interface PlanInput {
  html: string;
  path: string;
  title: string;
  /** Grief, health or disability pages: no what-if cards or quizzes, only calm visuals. */
  sensitive?: boolean;
  /** Frontmatter visuals. `section` is matched against the H2 text; without it, the first free section. */
  explicit?: (VisualSpec & { section?: string })[];
  /** Free resources that fit the page, best first. */
  downloads?: string[];
  /** Tool or checklist URLs that fit the page. */
  tools?: string[];
  /** Whether the page has related links to show in a panel. */
  hasRelated?: boolean;
  /** Diagrams already on the page (by registry name), so they are not shown twice. */
  excludeDiagrams?: string[];
  /** The page's own tool (config/tools toolFor), drawn inline when it is one of the kit's widgets. */
  widget?: string;
  /**
   * Hand-tuned picks for this page from the SEO thread (lib/page-embeds suggestEmbeds). They go ahead of
   * topic matching: what-if ids first, the /decide guide first, and the free resource first.
   */
  suggested?: { whatIf: string[]; decide?: string; resource?: string };
}

const front = <T,>(first: (T | undefined)[], rest: T[]) => {
  const head = first.filter((x): x is T => x !== undefined);
  return [...head, ...rest.filter((x) => !head.includes(x))];
};

const SKIP = /faq|frequently|sources|references|bottom line|key takeaways|in short|summary|disclaimer|related/i;
const COST = /cost|fee|expens|how much|price|pay for|afford/i;
const CHOICE = /which|choos|\bvs\b|versus|should|right for|do (i|you) need|options|compare|differen/i;
const RISK = /what if|happens if|without|mistake|risk|wait|delay|too late|problem|wrong|avoid|pitfall|when .* (dies|die)/i;
const PROCESS = /step|process|timeline|how long|how (it|probate|a trust|this) works|what happens|in order/i;
const STOP = new Set(["what", "with", "your", "that", "this", "from", "have", "will", "when", "does", "into", "about", "estate", "planning", "plan", "learn", "guides", "blog", "compare"]);

const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w)));
const overlap = (a: Set<string>, b: Set<string>) => {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
};

const textOf = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

/** Ranked candidates of each kind for this page. */
function candidates(input: PlanInput) {
  const hay = `${input.path} ${input.title}`.toLowerCase();
  const hayHyphen = hay.replace(/\s+/g, "-");
  const pageWords = words(hay);
  const scenarios = WHAT_IF_SCENARIOS.filter((s) => s.learn !== input.path)
    .map((s) => ({ id: s.id, score: overlap(pageWords, words(`${s.id} ${s.title} ${s.learn ?? ""}`)) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.id);
  const diagrams = diagramRegistry
    .filter((d) => !input.excludeDiagrams?.includes(d.name))
    .map((d) => ({ name: d.name, score: d.topics.filter((t) => hayHyphen.includes(t)).length + overlap(pageWords, words(d.title)) / 2 }))
    .filter((d) => d.score >= 1)
    .sort((a, b) => b.score - a.score)
    .map((d) => d.name);
  const pickers = PICKERS.filter((p) => p.match.test(hay)).map((p) => p.id);
  const timelines = TIMELINES.filter((t) => t.match.test(hay)).map((t) => t.id);
  // Decision guides that list this page as related, then ones whose title shares two or more words.
  const decisions = DECISIONS.filter((d) => !input.path.startsWith(`/decide/${d.slug}`))
    .map((d) => ({ slug: d.slug, score: (d.related.some((r) => r.href === input.path) ? 3 : 0) + overlap(pageWords, words(`${d.slug} ${d.title}`)) }))
    .filter((d) => d.score >= 2)
    .sort((a, b) => b.score - a.score)
    .map((d) => d.slug);
  const sug = input.suggested;
  const known = new Set(WHAT_IF_SCENARIOS.map((s) => s.id));
  const decideKnown = DECISIONS.some((d) => d.slug === sug?.decide) && !input.path.startsWith(`/decide/${sug?.decide}`);
  return {
    scenarios: front((sug?.whatIf ?? []).filter((id) => known.has(id)), scenarios),
    decisions: front([decideKnown ? sug?.decide : undefined], decisions),
    downloads: front([sug?.resource && input.downloads?.includes(sug.resource) ? sug.resource : undefined], input.downloads ?? []),
    widget: isWidget(input.widget) ? input.widget : undefined,
    diagrams, pickers, timelines, probateTopic: /probate|trust|will|house|home|estate|executor|deed/.test(hay) };
}

/** Plans the article: HTML segments with a visual after each section that needs one. */
export function planVisuals(input: PlanInput): Segment[] {
  const c = candidates(input);
  const used = new Set<string>();
  const key = (v: VisualSpec) => JSON.stringify(v);
  const take = (v: VisualSpec | null | undefined): VisualSpec | null => {
    if (!v || used.has(key(v))) return null;
    used.add(key(v));
    if (v.type === "whatif-strip") v.ids.forEach((id) => used.add(key({ type: "whatif", id })));
    if (v.type === "whatif") used.add(`whatif:${v.id}`);
    if (v.type === "widget") used.add(`widget:${v.slug}`);
    return v;
  };
  const firstUnused = <T,>(list: T[], make: (x: T) => VisualSpec) => {
    for (const x of list) {
      const v = make(x);
      if (!used.has(key(v)) && !(v.type === "whatif" && used.has(`whatif:${v.id}`))) return v;
    }
    return null;
  };
  const calm = Boolean(input.sensitive);
  // Most of each kind a page gets from auto-picking, so pages mix visuals instead of repeating one.
  const CAP: Partial<Record<VisualSpec["type"], number>> = { diagram: 2, whatif: 2, download: 1, tool: 1, picker: 1, timeline: 1, decision: 1, widget: 1 };
  const count: Partial<Record<VisualSpec["type"], number>> = {};
  const capped = (t: VisualSpec["type"]) => (count[t] ?? 0) >= (CAP[t] ?? 1);

  const pick = {
    whatif: () => (calm ? null : firstUnused(c.scenarios, (id) => ({ type: "whatif", id }))),
    strip: () => {
      if (calm || used.has("strip")) return null;
      const ids = c.scenarios.filter((id) => !used.has(`whatif:${id}`)).slice(0, 3);
      if (ids.length < 3) return null;
      used.add("strip");
      return { type: "whatif-strip", ids } as VisualSpec;
    },
    picker: () => (calm ? null : firstUnused(c.pickers, (id) => ({ type: "picker", id }))),
    decision: () => firstUnused(c.decisions, (slug) => ({ type: "decision", slug, part: "map" })),
    timeline: () => firstUnused(c.timelines, (id) => ({ type: "timeline", id })),
    diagram: () => firstUnused(c.diagrams, (name) => ({ type: "diagram", name })),
    slider: () => (calm || !c.probateTopic ? null : firstUnused(["probate-cost"] as const, (id) => ({ type: "slider", id }))),
    download: () => firstUnused(c.downloads, (slug) => ({ type: "download", slug })),
    // The page's tool as a link card, unless it is already drawn inline.
    tool: () => firstUnused((input.tools ?? []).filter((t) => !(c.widget && used.has(`widget:${c.widget}`) && t.endsWith(`/${c.widget}`))), (slug) => ({ type: "tool", slug })),
    widget: () => (c.widget ? firstUnused([c.widget], (slug) => ({ type: "widget", slug })) : null),
    related: () => (input.hasRelated ? firstUnused([0], () => ({ type: "related" })) : null),
  };
  const rotation = [pick.decision, pick.diagram, pick.whatif, pick.download, pick.picker, pick.timeline, pick.tool, pick.strip, pick.slider, pick.related];

  // The rotation starts one step further on for each section, so a page mixes kinds of visual.
  let turn = 0;
  function auto(heading: string): VisualSpec | null {
    const byHeading = [
      COST.test(heading) ? pick.slider : null,
      CHOICE.test(heading) ? pick.decision : null,
      CHOICE.test(heading) ? pick.picker : null,
      RISK.test(heading) ? pick.whatif : null,
      PROCESS.test(heading) ? pick.timeline : null,
      PROCESS.test(heading) ? pick.diagram : null,
    ];
    const turned = [...rotation.slice(turn % rotation.length), ...rotation.slice(0, turn % rotation.length)];
    turn++;
    // The page's own inline tool comes first, so an early section gets something to try.
    for (const f of [pick.widget, ...byHeading, ...turned]) {
      const cand = f ? f() : null;
      if (!cand || capped(cand.type)) continue;
      const v = take(cand);
      if (v) {
        count[v.type] = (count[v.type] ?? 0) + 1;
        return v;
      }
    }
    return null;
  }

  const explicit = [...(input.explicit ?? [])];
  const parts = input.html.split(/(?=<h2[\s>])/);
  const out: Segment[] = [];

  parts.forEach((raw) => {
    const hm = raw.match(/^<h2[^>]*>([\s\S]*?)<\/h2>/);
    const heading = hm ? textOf(hm[1]) : "";
    const part = raw;
    let has = false;

    // Writer-placed markers, in place.
    const pieces: Segment[] = [];
    let last = 0;
    for (const m of part.matchAll(MARKER_RE)) {
      const v = take(parseMarker(m[1], m[2] ?? ""));
      pieces.push({ html: part.slice(last, m.index) });
      if (v) {
        pieces.push({ visual: v });
        has = true;
      }
      last = (m.index ?? 0) + m[0].length;
    }
    pieces.push({ html: part.slice(last) });
    if (!hm) {
      out.push(...pieces.filter((p) => !("html" in p) || p.html));
      return;
    }

    // A numbered list is drawn as a timeline; a table is already a picture.
    if (/<table/.test(part)) has = true;
    const olItems = part.match(/<ol>([\s\S]*?)<\/ol>/)?.[1].match(/<li>/g)?.length ?? 0;
    if (olItems >= 3) {
      has = true;
      const at = pieces.findIndex((p) => "html" in p && p.html.includes("<ol>"));
      const p = pieces[at] as { html: string };
      pieces[at] = { html: p.html.replace("<ol>", '<ol class="is-timeline">') };
    }

    // Frontmatter visuals for this section.
    const fm = explicit.findIndex((e) => e.section && heading.toLowerCase().includes(e.section.toLowerCase()));
    const fmFree = !has && fm < 0 ? explicit.findIndex((e) => !e.section) : -1;
    const at = fm >= 0 ? fm : fmFree;
    let after: VisualSpec | null = null;
    if (at >= 0) {
      const { section: _s, ...spec } = explicit.splice(at, 1)[0];
      after = take(spec as VisualSpec);
    }
    if (!after && !has && !SKIP.test(heading)) after = auto(heading);

    if (pieces.length === 1) {
      // Panels wrap a whole section, so only sections without markers get one.
      out.push({ html: decorateSections((pieces[0] as { html: string }).html) });
    } else {
      out.push(...pieces.filter((p) => !("html" in p) || p.html));
    }
    if (after) out.push({ visual: after });
  });
  return out;
}
