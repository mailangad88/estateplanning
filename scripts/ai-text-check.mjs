#!/usr/bin/env node
/**
 * AI-text check with Pangram Labs (https://pangram.readthedocs.io/en/latest/api/rest.html).
 *
 * Why: the site's pages start as AI-assisted drafts (see /editorial-policy). Google does not penalize that
 * as such, but readers and AI engines skip text that reads like generic AI output, and the attorney's own
 * voice and experience is what makes a page worth citing. A high score sends the page back for the attorney
 * to rewrite in his own words with real examples. It is a signal for a human rewrite: never paraphrase text
 * just to lower the score.
 *
 * Usage:
 *   node scripts/ai-text-check.mjs                     # content files changed against origin/main
 *   node scripts/ai-text-check.mjs content/learn/wills/dying-without-a-will.md [...]
 *
 * Env:
 *   PANGRAM_API_KEY   required; without it the check prints a notice and exits 0 (nothing is sent anywhere)
 *   PANGRAM_MAX_AI    highest allowed fraction_ai, default 0.5
 *   PANGRAM_ENFORCE   "true" makes a page over the limit fail the run (CI); otherwise it only reports
 *
 * Results are saved to content/ai-text-scores.json (path -> score and date), which the review queue reads.
 * Pangram bills per started 1,000 words, so by default only changed files are checked.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const API = "https://text.external-api.pangram.com/task";
const KEY = process.env.PANGRAM_API_KEY;
const MAX_AI = Number(process.env.PANGRAM_MAX_AI ?? 0.5);
const ENFORCE = process.env.PANGRAM_ENFORCE === "true";
const SCORES = path.join(process.cwd(), "content", "ai-text-scores.json");
const CONTENT_DIRS = /^content\/(learn|guides|blog|compare|life-events|states|audiences)\/.*\.md$/;

if (!KEY) {
  console.log("ai-text-check: PANGRAM_API_KEY is not set, skipping. Nothing was sent.");
  process.exit(0);
}

function changedFiles() {
  try {
    execSync("git fetch -q origin main", { stdio: "ignore" });
  } catch {
    /* offline: compare against whatever origin/main is local */
  }
  const out = execSync("git diff --name-only --diff-filter=AM origin/main HEAD", { encoding: "utf8" });
  return out.split("\n").filter((f) => CONTENT_DIRS.test(f));
}

/** Body prose only: frontmatter, tables, code, HTML and link targets removed. */
function prose(file) {
  return fs
    .readFileSync(file, "utf8")
    .replace(/^---[\s\S]*?\n---/, "")
    .split("\n")
    .filter((l) => !/^\s*(\||```|<)/.test(l))
    .join("\n")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_`>]/g, "")
    .trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function classify(text) {
  const headers = { "x-api-key": KEY, "content-type": "application/json" };
  const created = await fetch(API, { method: "POST", headers, body: JSON.stringify({ text }) });
  if (!created.ok) throw new Error(`POST ${created.status}: ${(await created.text()).slice(0, 200)}`);
  const { task_id: id } = await created.json();
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`${API}/${id}`, { headers });
    if (!res.ok) throw new Error(`GET ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = await res.json();
    if (body.stage === "STAGE_SUCCESS") return body;
    if (body.stage === "STAGE_FAILED") throw new Error(`task ${id} failed`);
    await sleep(2000);
  }
  throw new Error(`task ${id} timed out`);
}

const files = process.argv.slice(2).length ? process.argv.slice(2) : changedFiles();
if (!files.length) {
  console.log("ai-text-check: no changed content files.");
  process.exit(0);
}

const scores = fs.existsSync(SCORES) ? JSON.parse(fs.readFileSync(SCORES, "utf8")) : {};
const over = [];
for (const f of files) {
  const text = prose(f);
  if (text.split(/\s+/).length < 100) continue;
  try {
    const r = await classify(text);
    scores[f] = { fraction_ai: r.fraction_ai, fraction_ai_assisted: r.fraction_ai_assisted, prediction: r.prediction_short, checked: new Date().toISOString().slice(0, 10) };
    const flag = r.fraction_ai > MAX_AI;
    if (flag) over.push(f);
    console.log(`${flag ? "REWRITE" : "ok     "}  ${r.fraction_ai.toFixed(2)} AI  ${f}`);
  } catch (e) {
    console.error(`error    ${f}: ${e.message}`);
    if (ENFORCE) process.exitCode = 1;
  }
}
fs.writeFileSync(SCORES, `${JSON.stringify(scores, null, 1)}\n`);
if (over.length) {
  console.log(`\n${over.length} page(s) read as mostly AI-written (over ${MAX_AI}). Send them to the attorney to rewrite in his own words.`);
  if (ENFORCE) process.exitCode = 1;
}
