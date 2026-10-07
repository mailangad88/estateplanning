/**
 * Words the studio's scripts must not use. This file names them on purpose, so
 * scripts/launch-check.mjs skips it (same as the launch check skipping itself).
 */

/** Attorney advertising risks, matching the BANNED list in scripts/launch-check.mjs. */
export const BANNED_PATTERNS: { re: RegExp; why: string }[] = [
  { re: /\bexperts?\b/i, why: "'expert' implies a credential" },
  { re: /\bspeciali[sz](t|ts|es|ed|ing)\b/i, why: "'specialist' claims need state certification" },
  { re: /\bguarantee(d|s)?\b/i, why: "no guaranteed outcomes" },
  { re: /#1\b|\bnumber one\b|\btop[- ]rated\b/i, why: "unverifiable comparative claim" },
  { re: /\bbest (estate|lawyer|attorney|firm|law|will|trust lawyer)/i, why: "unverifiable comparative claim" },
  { re: /\bfree (will|trust|consultation)\b/i, why: "'free' offers have state-specific rules" },
  { re: /\bact now\b|\bdon'?t wait\b|\bbefore it'?s too late\b/i, why: "pressure language" },
];

export const BANNED_TERMS = ["expert", "specialist", "guarantee", "best lawyer", "#1", "top-rated", "free consultation", "free will", "act now"];

/** Stock phrases that make scripts read as machine-written filler. */
export const SLOP_PHRASES = [
  "in today's fast-paced world",
  "in today's world",
  "let's dive in",
  "dive into",
  "delve",
  "navigate the complexities",
  "navigating the",
  "unlock",
  "game-changer",
  "it's important to note",
  "it is important to note",
  "tapestry",
  "ever-evolving",
  "landscape of",
  "embark on",
  "journey",
  "peace of mind is priceless",
  "look no further",
  "whether you're",
  "in conclusion",
  "at the end of the day",
  "rest assured",
  "seamless",
  "elevate",
  "smash that like",
];

/** Lines that read as advice to one viewer about their own case. */
export const PERSONAL_ADVICE = [/\bin your case\b/i, /\byou should definitely\b/i, /\byou must (sign|file|create|set up)\b/i, /\bthis is legal advice\b/i];
