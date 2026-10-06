#!/usr/bin/env node
/**
 * Launch checks for attorney advertising copy.
 *
 * 1. Banned claims (always enforced): words that are risky in attorney advertising in
 *    nearly every state (expert, specialist, guaranteed, #1, best lawyer...).
 * 2. Placeholders (enforced for production deploys): unfilled firm facts or attorney
 *    slots must never publish. Runs before `next build`; fails only when
 *    VERCEL_ENV=production or LAUNCH_CHECK=strict, so previews still build.
 */
import fs from "node:fs";
import path from "node:path";

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
const ALLOW = [/specialists you see/i, /medical specialists?/i, /certified specialist/i];

const PLACEHOLDERS = [/\[(Firm|Attorney|Office|Bar number|Flat fee)[^\]]*\]/, /\[firm placeholder/i, /ATTORNEY TO CONFIRM/, /\[VERIFY[^\]]*\]/, /\[ATTORNEY[^\]]*\]/, /\[STATE\]/, /\bPLACEHOLDER\b/, /\(000\) 000-0000/];

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
const strict = process.env.VERCEL_ENV === "production" || process.env.LAUNCH_CHECK === "strict";
if (placeholders.length) {
  const msg = `Unfilled placeholders (${placeholders.length}). Production deploys are blocked until these are filled.`;
  if (strict) {
    console.error(`${msg}\n  ${placeholders.join("\n  ")}`);
    failed = true;
  } else {
    console.warn(`${msg} Run with LAUNCH_CHECK=strict to list them.`);
  }
}
if (failed) process.exit(1);
console.log("Launch check passed.");
