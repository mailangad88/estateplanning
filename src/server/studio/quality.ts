/**
 * Quality gates every script passes before the attorney sees it. Blocking checks send the
 * video back for a rewrite; warnings are shown on the review screen.
 */
import { LENGTH } from "./config";
import { planSeconds } from "./director";
import type { QualityCheck, QualityReport, Research, Script, VideoFormat, VideoPlan } from "./types";
import { BANNED_PATTERNS, PERSONAL_ADVICE, SLOP_PHRASES } from "./wordlists";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function scriptText(script: Script): string {
  return [script.title, script.description, ...script.beats.flatMap((b) => [b.narration, b.onScreen, ...(b.points ?? [])])].join("\n");
}

export function checkScript(input: { format: VideoFormat; script: Script; research: Research; plan?: VideoPlan; editorNotes?: string[]; otherTitles?: string[] }): QualityReport {
  const { format, script, research, plan } = input;
  const checks: QualityCheck[] = [];
  const add = (id: string, ok: boolean, level: "block" | "warn", detail: string) => checks.push({ id, ok, level, detail });
  const text = scriptText(script);
  const narration = script.beats.map((b) => b.narration).join(" ");

  const banned = BANNED_PATTERNS.filter((b) => b.re.test(text)).map((b) => b.why);
  add("advertising_words", banned.length === 0, "block", banned.length ? `Remove: ${banned.join("; ")}` : "No banned advertising words");

  const lower = text.toLowerCase().replace(/[’]/g, "'");
  const slop = SLOP_PHRASES.filter((p) => lower.includes(p));
  add("filler_phrases", slop.length === 0, "block", slop.length ? `Filler phrases: ${slop.join(", ")}` : "No stock filler phrases");

  const advice = PERSONAL_ADVICE.filter((re) => re.test(text)).map((re) => re.source);
  add("general_education", advice.length === 0, "block", advice.length ? "Reads as advice to one person's case; rephrase as what usually happens" : "Stays general education");

  const n = words(narration);
  const len = LENGTH[format];
  add("length", n >= len.minWords && n <= len.maxWords, "block", `${n} spoken words (target ${len.minWords} to ${len.maxWords})`);

  add("has_sources", research.sources.length > 0, "block", `${research.sources.length} source(s)`);
  const ids = new Set(research.sources.map((s) => s.id));
  const unsourced = script.beats.filter((b) => ["answer", "steps", "myth"].includes(b.role) && !b.sourceIds.some((id) => ids.has(id)));
  add("claims_sourced", unsourced.length === 0, "block", unsourced.length ? `Beats with no valid source: ${unsourced.map((b) => b.id).join(", ")}` : "Every factual beat cites a source");
  const badRefs = script.beats.flatMap((b) => b.sourceIds.filter((id) => !ids.has(id)));
  add("source_ids_valid", badRefs.length === 0, "block", badRefs.length ? `Unknown source ids: ${[...new Set(badRefs)].join(", ")}` : "Source ids match the research");

  const unlabelled = script.beats.filter((b) => b.role === "example" && !b.fictional);
  add("fictional_labelled", unlabelled.length === 0, "block", unlabelled.length ? "Example beats must be marked fictional" : "Examples are labelled fictional");

  const last = script.beats[script.beats.length - 1];
  add("call_to_action", last?.role === "cta" && Boolean(script.cta.path), "block", last?.role === "cta" ? `Ends with a call to action to ${script.cta.path}` : "The last beat must be the call to action");

  const hook = script.beats[0];
  add("hook_short", Boolean(hook) && words(hook.narration) <= 28, "warn", hook ? `Opening line is ${words(hook.narration)} words; under 28 keeps people watching` : "No opening beat");

  const long = narration.match(/[^.!?]+[.!?]/g)?.filter((s) => words(s) > 35) ?? [];
  add("sentence_length", long.length === 0, "warn", long.length ? `${long.length} sentence(s) over 35 words; split them for speech` : "Sentences are short enough to say aloud");

  const headlines = script.beats.filter((b) => words(b.onScreen) > (b.role === "question" || b.role === "hook" ? 18 : 9));
  add("on_screen_short", headlines.length === 0, "warn", headlines.length ? `Long on-screen headlines: ${headlines.map((b) => b.id).join(", ")}` : "On-screen headlines are short");

  if (input.otherTitles) {
    const dup = input.otherTitles.some((t) => t.trim().toLowerCase() === script.title.trim().toLowerCase());
    add("unique_title", !dup, "warn", dup ? "Another video already has this title" : "Title is unique");
  }

  if (plan) {
    const secs = planSeconds(plan);
    if (format === "short") add("short_duration", secs <= 58, "block", `${Math.round(secs)} seconds (Shorts and Reels: 58 or less)`);
    add("disclaimer", Boolean(plan.disclaimer), "block", plan.disclaimer ? "Disclaimer on screen" : "Missing on-screen disclaimer");
    const placeholder = /\[[^\]]+\]|PLACEHOLDER/.test(`${plan.endCard.firmName} ${plan.endCard.officeAddress}`);
    add("firm_details", !placeholder, "warn", placeholder ? "End card still has placeholder firm name or office address (Illinois Rule 7.2(a) needs name and office address on ads)" : "End card has firm name and office address");
  }

  const pageNote = input.editorNotes?.some((n) => n.includes("not yet attorney-approved"));
  if (pageNote) add("source_page_reviewed", false, "warn", "The site page this was drafted from has not been attorney-approved yet");

  return { passed: checks.every((c) => c.ok || c.level === "warn"), checks, editorNotes: input.editorNotes ?? [] };
}
