import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Plain-language and structure checks on published prose. Answer engines quote short, self-contained
 * passages, and LEARN-STYLE.md asks for an eighth-grade reading level, so the gate is set where a page has
 * clearly drifted, not at the target:
 *   - Flesch-Kincaid grade at most 12.5 for the page (the site median is about 8)
 *   - no sentence longer than 50 words
 *   - no H1 in the body (the title is the H1) and no skipped heading levels (## then ####)
 */

const DIRS = ["learn", "glossary", "states", "guides", "blog", "compare", "life-events", "audiences"];
const MAX_GRADE = 12.5;
const MAX_SENTENCE_WORDS = 50;

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith(".md") && !/^(README|_)/.test(e.name)) out.push(full);
  }
  return out;
}

const files = DIRS.flatMap((d) => walk(path.join(process.cwd(), "content", d)));

function body(raw: string): string {
  return raw.replace(/^---[\s\S]*?\n---/, "");
}

/** Body prose only: no headings, tables, code, HTML; link text kept, URLs dropped. */
function prose(md: string): string {
  return md
    .split("\n")
    .filter((l) => !/^\s*(\||#|```|<)/.test(l))
    .join("\n")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>]/g, "");
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.?!]["')\]]?)\s+|\n\s*\n|\n\s*(?:[-*]|\d+[.)])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 3);
}

function syllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  return Math.max(1, w.match(/[aeiouy]{1,2}/g)?.length ?? 1);
}

export function fleschKincaidGrade(text: string): number {
  const sents = sentences(text);
  const words = sents.flatMap((s) => s.split(/\s+/).filter((w) => /[a-z]/i.test(w)));
  if (!sents.length || !words.length) return 0;
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  return 0.39 * (words.length / sents.length) + 11.8 * (syl / words.length) - 15.59;
}

describe("plain language", () => {
  it("finds the content", () => {
    expect(files.length).toBeGreaterThan(300);
  });

  it(`keeps every page at or below grade ${MAX_GRADE}`, () => {
    const bad = files
      .map((f) => ({ f: path.relative(process.cwd(), f), text: prose(body(fs.readFileSync(f, "utf8"))) }))
      .filter((x) => x.text.split(/\s+/).length >= 200)
      .map((x) => ({ ...x, grade: fleschKincaidGrade(x.text) }))
      .filter((x) => x.grade > MAX_GRADE)
      .map((x) => `${x.f}: grade ${x.grade.toFixed(1)}`);
    expect(bad).toEqual([]);
  });

  it(`has no sentence over ${MAX_SENTENCE_WORDS} words`, () => {
    const bad: string[] = [];
    for (const f of files) {
      for (const s of sentences(prose(body(fs.readFileSync(f, "utf8"))))) {
        const n = s.split(/\s+/).length;
        if (n > MAX_SENTENCE_WORDS) bad.push(`${path.relative(process.cwd(), f)} (${n} words): ${s.slice(0, 80)}...`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("heading structure", () => {
  it("has no H1 in the body and never skips a heading level", () => {
    const bad: string[] = [];
    for (const f of files) {
      let prev = 1;
      let inCode = false;
      for (const line of body(fs.readFileSync(f, "utf8")).split("\n")) {
        if (line.startsWith("```")) inCode = !inCode;
        const m = !inCode && /^(#{1,6})\s/.exec(line);
        if (!m) continue;
        const level = m[1].length;
        const rel = path.relative(process.cwd(), f);
        if (level === 1) bad.push(`${rel}: H1 in body ("${line.slice(0, 60)}")`);
        else if (level > prev + 1) bad.push(`${rel}: H${level} after H${prev} ("${line.slice(0, 60)}")`);
        prev = level;
      }
    }
    expect(bad).toEqual([]);
  });
});
