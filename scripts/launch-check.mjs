#!/usr/bin/env node
/**
 * Launch checks for attorney advertising copy.
 *
 * 1. Banned claims (always enforced): words that are risky in attorney advertising in
 *    nearly every state (expert, specialist, guaranteed, #1, best lawyer...).
 * 2. Placeholders (enforced for production deploys): unfilled firm facts or attorney
 *    slots must never publish. Runs before `next build`; fails only when
 *    VERCEL_ENV=production or LAUNCH_CHECK=strict, so previews still build.
 * 3. Advertising rules (enforced for production deploys): every served state
 *    (SERVED_STATES) needs an entry in src/config/compliance.ts with verified: true.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const DIRS = ["content", "src"];
const EXT = new Set([".md", ".json", ".ts", ".tsx"]);
const SKIP = new Set(["content/STYLE.md", "content/LEARN-STYLE.md", "content/states/_template.json", "scripts/launch-check.mjs"]);

const BANNED = [
  { re: /\bexperts?\b/i, why: "'expert' implies a credential" },
  { re: /\bspeciali[sz](t|ts|es|ed|ing)\b/i, why: "'specialist' claims need state certification" },
  { re: /\bguarantee(d|s)?\b/i, why: "no guaranteed outcomes" },
  { re: /#1\b|\bnumber one\b|\btop[- ]rated\b/i, why: "unverifiable comparative claim" },
  { re: /\bbest (estate|lawyer|attorney|firm|law|will|trust lawyer)/i, why: "unverifiable comparative claim" },
  { re: /\bfree (will|trust|consultation)\b/i, why: "'free' offers have state-specific rules" },
];
// Phrases that contain a banned word but are not advertising claims.
const ALLOW = [
  /specialists you see/i,
  /medical specialists?/i,
  /certified specialist/i,
  // Required outcome disclaimers (research/attorney-advertising-rules-by-state.md 1c).
  /does not constitute a guarantee, warranty, or prediction regarding the outcome/i,
  /past experience does not guarantee a similar result/i,
];

const PLACEHOLDERS = [/\[(Firm|Attorney|Office|Bar number|Flat fee)[^\]]*\]/, /\[firm placeholder/i, /ATTORNEY TO CONFIRM/, /\[VERIFY[^\]]*\]/, /\[ATTORNEY[^\]]*\]/, /\[STATE\]/, /\bPLACEHOLDER\b/, /\(000\) 000-0000/];

/** Loads STATE_RULES from the typed config (Node type stripping), falling back to a text parse. */
async function loadStateRules() {
  const file = path.join(ROOT, "src/config/compliance.ts");
  if (!fs.existsSync(file)) return null;
  try {
    process.removeAllListeners("warning"); // silence the module-type notice from type stripping
    const mod = await import(pathToFileURL(file).href);
    if (mod.STATE_RULES) return mod.STATE_RULES;
  } catch {
    // older Node without type stripping: fall through
  }
  const src = fs.readFileSync(file, "utf8");
  const body = src.slice(src.indexOf("export const STATE_RULES"));
  const out = {};
  const re = /^ {2}([A-Z]{2}): \{([\s\S]*?)^ {2}\},/gm;
  for (let m; (m = re.exec(body)); ) out[m[1]] = { verified: /^\s*verified: true,/m.test(m[2]) };
  return Object.keys(out).length ? out : null;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(e.name))) out.push(full);
  }
  return out;
}

const banned = [];
const placeholders = [];
for (const d of DIRS) {
  if (!fs.existsSync(path.join(ROOT, d))) continue;
  for (const file of walk(path.join(ROOT, d))) {
    const rel = path.relative(ROOT, file);
    if (SKIP.has(rel)) continue;
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const b of BANNED) if (b.re.test(line) && !ALLOW.some((a) => a.test(line))) banned.push(`${rel}:${i + 1} ${b.why}: ${line.trim().slice(0, 100)}`);
      for (const p of PLACEHOLDERS) if (p.test(line)) { placeholders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`); break; }
    });
  }
}

let failed = false;
if (banned.length) {
  console.error(`Banned advertising claims (${banned.length}):\n  ${banned.join("\n  ")}`);
  failed = true;
}
// A staging project (SITE_ENV=staging) builds with placeholders so the drafts can be reviewed;
// it is noindexed and carries a staging banner. Real production stays strict.
const staging = process.env.SITE_ENV === "staging";
const strict = (process.env.VERCEL_ENV === "production" && !staging) || process.env.LAUNCH_CHECK === "strict";
if (placeholders.length) {
  const msg = `Unfilled placeholders (${placeholders.length}). Production deploys are blocked until these are filled.`;
  if (strict) {
    console.error(`${msg}\n  ${placeholders.join("\n  ")}`);
    failed = true;
  } else {
    console.warn(`${msg} Run with LAUNCH_CHECK=strict to list them.`);
  }
}
// Advertising rules per served state (B21).
const served = (process.env.SERVED_STATES ?? process.env.NEXT_PUBLIC_SERVED_STATES ?? "XX")
  .split(",")
  .map((x) => x.trim().toUpperCase())
  .filter(Boolean);
const ruleProblems = [];
const stateRules = await loadStateRules();
if (!stateRules) ruleProblems.push("could not read src/config/compliance.ts");
else
  for (const st of served) {
    const r = stateRules[st];
    if (!r) ruleProblems.push(`${st}: no entry in src/config/compliance.ts (the conservative default is shown, but the state must be researched)`);
    else if (r.verified !== true) ruleProblems.push(`${st}: rules not verified by the attorney (verified: false)`);
  }
if (ruleProblems.length) {
  const msg = `Advertising rules not ready for served states (${served.join(", ")}).`;
  if (strict) {
    console.error(`${msg}\n  ${ruleProblems.join("\n  ")}`);
    failed = true;
  } else {
    console.warn(`${msg} ${ruleProblems.length} issue(s); run with LAUNCH_CHECK=strict to list them.`);
  }
}

if (failed) process.exit(1);
console.log("Launch check passed.");
