/**
 * Writers turn a topic into research notes and a script.
 *
 * - SiteDraftWriter (default, no cost): builds the script from the page on our site that
 *   answers the question. The words are our own reviewed copy, so nothing is invented; it
 *   only handles questions the site already answers.
 * - ClaudeWriter (STUDIO_WRITER=anthropic plus ANTHROPIC_API_KEY): researches with web
 *   search, writes a storyline and script, then runs a separate editor pass that checks
 *   every claim against the sources and cuts filler. Pay-as-you-go API cost.
 *
 * Both return the same shape; quality.ts then applies the same gates to either.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { factRegistry, type Fact } from "@/lib/facts";
import { LENGTH } from "./config";
import { BANNED_TERMS, SLOP_PHRASES } from "./wordlists";
import { pageText, type PageText } from "./pages";
import type { BeatRole, Research, Script, ScriptBeat, SourceRef, Topic, VideoFormat } from "./types";

export interface Draft {
  research: Research;
  script: Script;
  editorNotes: string[];
}

export interface Writer {
  name: string;
  /** Throws when it cannot write this topic (for example, no page answers it). */
  draft(topic: Topic, format: VideoFormat): Promise<Draft>;
}

/* ---------- shared helpers ---------- */

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const sentences = (s: string) => s.match(/[^.!?]+[.!?]+(\s|$)/g)?.map((x) => x.trim()) ?? [s.trim()];

/** First sentences of a paragraph up to a word budget, ending on a full sentence. */
export function clip(text: string, maxWords: number): string {
  const out: string[] = [];
  let n = 0;
  for (const s of sentences(text)) {
    const w = words(s);
    if (out.length && n + w > maxWords) break;
    out.push(s);
    n += w;
  }
  return out.join(" ");
}

/**
 * Short on-screen headline from a heading or sentence: the whole thing when it is short, else the
 * part before the first comma, colon or dash when that is short, else the fallback. Never cut mid-phrase.
 */
export function headline(text: string, max = 8, fallback = "The short answer"): string {
  const t = text.replace(/[?.!:]+$/, "").trim();
  const n = (s: string) => s.split(/\s+/).filter(Boolean).length;
  if (n(t) <= max) return t;
  const head = t.split(/[,:;](?=\s)|\s[\u2013\u2014-]\s/)[0].trim(); // not the comma in "$15,000,000"
  return n(head) >= 2 && n(head) <= max ? head : fallback;
}

function landingFor(topic: Topic): string {
  if (topic.coveredBy) return topic.coveredBy.split("#")[0];
  if (topic.resource) return `/free/${topic.resource}`;
  return "/contact";
}

/** Illinois and federal facts relevant to an Illinois topic, for the writer to cite. */
export function factsFor(topic: Topic): Fact[] {
  const all = factRegistry();
  const words = topic.question.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
  return all
    .filter((f) => (topic.state === "IL" ? f.state === "IL" || f.kind === "federal_figure" : f.kind === "federal_figure"))
    .filter((f) => words.some((w) => f.label.toLowerCase().includes(w)))
    .slice(0, 8);
}

/* ---------- site draft writer ---------- */

export class SiteDraftWriter implements Writer {
  name = "site-draft";

  async draft(topic: Topic, format: VideoFormat): Promise<Draft> {
    if (!topic.coveredBy) throw new Error("No page on the site answers this question yet");
    const page = pageText(topic.coveredBy);
    if (!page) throw new Error(`Could not read ${topic.coveredBy}`);
    const src: SourceRef = { id: "s1", kind: "site_page", title: page.title, url: page.url, quote: clip(page.answer, 40) };
    const sources: SourceRef[] = [src];
    const beats = format === "short" ? shortBeats(topic, page) : longBeats(topic, page);
    const landingPath = landingFor(topic);
    const script: Script = {
      title: format === "short" || (topic.state === "IL" && /illinois/i.test(topic.question)) ? topic.question : `${topic.question} ${topic.state === "IL" ? "(Illinois)" : "Explained in plain English"}`,
      description: `${page.answer}\n\nRead the full guide: ${page.url}`,
      hashtags: hashtagsFor(topic, format),
      beats,
      cta: { label: topic.resource ? "Get the free guide, or book a call" : "Book a call with our attorney", path: landingPath },
      chapters: format === "long" ? beats.filter((b) => b.role === "answer" || b.role === "steps").map((b) => ({ beatId: b.id, title: b.onScreen })) : undefined,
    };
    const notes = [
      `Drafted from our page ${page.url}${page.reviewed ? " (attorney-approved)" : " (page not yet attorney-approved)"}.`,
      "Wording is the site's own copy, trimmed for speech. Check the hook and the example read naturally out loud.",
    ];
    return {
      research: { summary: page.answer, sources, landingPath, writer: this.name },
      script,
      editorNotes: notes,
    };
  }
}

function beat(id: number, role: BeatRole, narration: string, onScreen: string, extra: Partial<ScriptBeat> = {}): ScriptBeat {
  return { id: `b${id}`, role, narration, onScreen, sourceIds: role === "hook" || role === "question" || role === "cta" ? [] : ["s1"], ...extra };
}

function ctaLine(topic: Topic): string {
  const state = topic.state === "IL" ? "in Illinois " : "";
  return `If you want to talk through your own situation ${state}with an attorney, book a call using the link below.`;
}

function shortBeats(topic: Topic, page: PageText): ScriptBeat[] {
  const out: ScriptBeat[] = [];
  out.push(beat(1, "question", topic.question, topic.question));
  out.push(beat(2, "answer", clip(page.answer, 55), headline(page.takeaways[0] ?? page.title)));
  const points = page.takeaways.length >= 2 ? page.takeaways.slice(0, 3) : page.sections.flatMap((s) => s.bullets).slice(0, 3);
  if (points.length >= 2 && words(points.join(" ")) <= 50) {
    const said = points.map((p) => (/[.!?]$/.test(p) ? p : `${p}.`)).join(" ");
    out.push(beat(3, "steps", said, "Worth knowing", { points: points.map((p) => headline(p, 9, clip(p, 9))) }));
  }
  out.push(beat(out.length + 1, "cta", ctaLine(topic), "Book a call"));
  return out;
}

function longBeats(topic: Topic, page: PageText): ScriptBeat[] {
  const out: ScriptBeat[] = [];
  let n = 0;
  out.push(beat(++n, "hook", `${topic.question} Here is the short answer, then how it works, step by step.`, topic.question));
  out.push(beat(++n, "answer", page.answer, "The short answer"));
  for (const s of page.sections.slice(0, 9)) {
    const text = s.paragraphs.map((p) => clip(p, 90)).join(" ");
    if (s.bullets.length >= 2) {
      out.push(beat(++n, "steps", clip(text || s.heading, 120), headline(s.heading, 8, "How it works"), { points: s.bullets.slice(0, 5).map((b) => headline(b, 10, clip(b, 10))) }));
    } else if (text) {
      out.push(beat(++n, "answer", clip(text, 140), headline(s.heading, 8, "How it works")));
    }
  }
  for (const f of page.faqs.slice(0, 5)) out.push(beat(++n, "answer", `${f.q} ${clip(f.a, 70)}`, headline(f.q, 10, "A common question")));
  if (page.takeaways.length) out.push(beat(++n, "next_step", "To recap.", "Recap", { points: page.takeaways.slice(0, 5).map((t) => headline(t, 10, clip(t, 10))) }));
  out.push(beat(++n, "cta", ctaLine(topic), "Book a call"));
  return out;
}

function hashtagsFor(topic: Topic, format: VideoFormat): string[] {
  const base = ["estateplanning", topic.cluster.replace(/-/g, "")];
  if (topic.state === "IL") base.push("illinois");
  if (format === "short") base.push("Shorts");
  return base;
}

/* ---------- Claude writer ---------- */

const BeatSchema = z.object({
  id: z.string(),
  role: z.enum(["hook", "question", "answer", "example", "steps", "myth", "next_step", "cta"]),
  narration: z.string(),
  onScreen: z.string(),
  points: z.array(z.string()).optional(),
  sourceIds: z.array(z.string()),
  fictional: z.boolean().optional(),
});
const ScriptSchema = z.object({
  title: z.string(),
  description: z.string(),
  hashtags: z.array(z.string()),
  beats: z.array(BeatSchema),
  chapters: z.array(z.object({ beatId: z.string(), title: z.string() })).optional(),
});
const ResearchSchema = z.object({
  summary: z.string(),
  sources: z.array(z.object({ id: z.string(), kind: z.enum(["site_page", "fact", "web"]), title: z.string(), url: z.string().optional(), quote: z.string().optional(), factId: z.string().optional() })),
});
const EditSchema = z.object({ script: ScriptSchema, notes: z.array(z.string()) });

/** JSON Schema for output_config.format; every object closes with additionalProperties: false. */
function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const s = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

const STYLE = `House rules for every script:
- Plain spoken English at about an 8th grade reading level. Short sentences. Talk to one person ("you").
- General education only. Never tell a specific viewer what they should do in their case; say what usually happens and when to talk to an attorney.
- Every factual claim (rules, deadlines, dollar figures, statutes) must come from a listed source; put the source ids on the beat. If a fact is not in the sources, leave it out.
- Illinois first when the topic is about Illinois; otherwise say rules vary by state.
- Never use these words or phrases: ${BANNED_TERMS.join(", ")}. No "act now" or fear-based urgency.
- No filler or stock phrases such as: ${SLOP_PHRASES.slice(0, 14).join("; ")}.
- Any made-up family or scenario is a beat with role "example" and fictional: true. Never present it as a real client.
- End with one calm call to action to book a call or get the free resource. No pressure.`;

export class ClaudeWriter implements Writer {
  name: string;
  private client: Anthropic;
  private model: string;

  constructor(opts: { apiKey?: string; model?: string } = {}) {
    this.model = opts.model ?? process.env.STUDIO_MODEL ?? "claude-opus-5-5";
    this.name = `anthropic:${this.model}`;
    this.client = new Anthropic({ apiKey: opts.apiKey ?? process.env.ANTHROPIC_API_KEY });
  }

  /** One request with refusal fallback; returns the text of the final answer. */
  private async ask(system: string, user: string, opts: { webSearch?: boolean; format?: Record<string, unknown>; effort?: "low" | "medium" | "high" } = {}): Promise<string> {
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: user }];
    for (let turn = 0; turn < 5; turn++) {
      const res = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 32000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        messages,
        output_config: { effort: opts.effort ?? "high", ...(opts.format ? { format: { type: "json_schema", schema: opts.format } } : {}) },
        ...(opts.webSearch ? { tools: [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 8 }] } : {}),
      });
      if (res.stop_reason === "refusal") throw new Error(`The writer declined this topic (${res.stop_details?.category ?? "no category"})`);
      if (res.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: res.content });
        continue;
      }
      return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
    }
    throw new Error("The writer did not finish its research");
  }

  async draft(topic: Topic, format: VideoFormat): Promise<Draft> {
    const page = topic.coveredBy ? pageText(topic.coveredBy) : null;
    const facts = factsFor(topic);
    const len = LENGTH[format];
    const brief = [
      `Question from the viewer: "${topic.question}"`,
      `Topic cluster: ${topic.cluster}. Risk: ${topic.risk}. ${topic.state === "IL" ? "Illinois-specific." : "General, not state-specific."}`,
      page ? `Our own page that answers it (${page.url}):\nANSWER: ${page.answer}\nKEY POINTS: ${page.takeaways.join(" | ")}\nSECTIONS:\n${page.sections.map((s) => `## ${s.heading}\n${s.paragraphs.join(" ")}\n${s.bullets.map((b) => `- ${b}`).join("\n")}`).join("\n").slice(0, 12000)}` : "Our site has no page on this yet.",
      facts.length ? `Fact registry entries you may cite (cite by factId):\n${facts.map((f) => `${f.id}: ${f.label} = ${f.value} (source: ${f.source}, as of ${f.asOf})`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n");

    // 1. Research: gather and list sources.
    const researchText = await this.ask(
      `You research estate planning questions for a law firm's educational videos. Prefer primary sources: Illinois Compiled Statutes (ilga.gov), Illinois courts, IRS, SSA, Medicaid/HFS, and our own page. ${STYLE}`,
      `${brief}\n\nResearch this question. Use web search to confirm anything not on our page. Return JSON: a short factual summary (what is true, with numbers and conditions), and the sources you relied on (id s1, s2...; kind site_page for our page, fact for registry entries, web for others; include a short quote for each).`,
      { webSearch: true, format: jsonSchema(ResearchSchema) },
    );
    const research = ResearchSchema.parse(JSON.parse(researchText));

    // 2. Storyline and script.
    const shape =
      format === "short"
        ? `A vertical short, ${len.minWords} to ${len.maxWords} spoken words in total (under 55 seconds). Beats: question (hook in the first 2 seconds), answer, optional steps or myth, cta. 4 to 6 beats.`
        : `A long YouTube video, ${len.minWords} to ${len.maxWords} spoken words in total (about 7 to 12 minutes). Storyline: hook, the question in the viewer's words, the short answer, 4 to 7 chapters that explain how it works (steps, myths, one clearly fictional example family), what to do next, cta. Give chapter titles for the main beats.`;
    const scriptText = await this.ask(
      `You write scripts for an estate planning law firm's educational videos. ${STYLE}`,
      `${brief}\n\nResearch notes:\n${JSON.stringify(research)}\n\nWrite the script. ${shape} onScreen is a short headline (under 8 words). A myth beat's points are exactly [the myth, the fact]. A steps beat's points are 2 to 5 short items. The description is 2 to 4 plain sentences for YouTube/Instagram. Up to 5 hashtags without #.`,
      { format: jsonSchema(ScriptSchema) },
    );
    const draft = ScriptSchema.parse(JSON.parse(scriptText));

    // 3. Editor and fact check, a separate pass with fresh eyes.
    const editText = await this.ask(
      `You are the editor and fact checker. You did not write this script. Cut filler, fix anything unsupported by the sources (remove it rather than guess), make every line sound like a calm attorney talking, and keep the length rules. ${STYLE}`,
      `Sources:\n${JSON.stringify(research.sources)}\n\nScript:\n${JSON.stringify(draft)}\n\nReturn the corrected script and a list of notes for the attorney: what you changed, and anything they should double-check (figures, deadlines, Illinois specifics).`,
      { format: jsonSchema(EditSchema), effort: "high" },
    );
    const edited = EditSchema.parse(JSON.parse(editText));
    const landingPath = landingFor(topic);
    return {
      research: { summary: research.summary, sources: research.sources, landingPath, writer: this.name },
      script: { ...edited.script, cta: { label: topic.resource ? "Get the free guide, or book a call" : "Book a call with our attorney", path: landingPath } },
      editorNotes: edited.notes,
    };
  }
}

export function writerFromEnv(env: NodeJS.ProcessEnv = process.env): Writer {
  return env.STUDIO_WRITER === "anthropic" && env.ANTHROPIC_API_KEY ? new ClaudeWriter() : new SiteDraftWriter();
}
