/**
 * Export the social content calendar (content/social/calendar.json) as a review sheet:
 *   exports/social/calendar.md   one section per video: hook, voiceover, caption, links per platform
 *   exports/social/calendar.csv  one row per video and platform, for a scheduler import
 *
 * Usage: npm run social:calendar [-- --start 2026-11-09]
 * With --start, each video gets a date (day 1 = start). Without it, rows show "Day N".
 */
import fs from "node:fs";
import path from "node:path";
import { SOCIAL_PLATFORMS, socialLink, type SocialPlatform } from "../../src/lib/social-links";
import { getSocialTip } from "../../src/config/social-tips";
import { loadCalendar } from "../../src/lib/social-calendar";

const SITE = "https://familyfutureplanning.com";
const args = process.argv.slice(2);
const startArg = args.includes("--start") ? args[args.indexOf("--start") + 1] : null;
const start = startArg ? new Date(`${startArg}T12:00:00Z`) : null;

function dateFor(day: number): string {
  if (!start) return `Day ${day}`;
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + day - 1);
  return d.toISOString().slice(0, 10);
}

const cal = loadCalendar();
const out = path.join(process.cwd(), "exports", "social");
fs.mkdirSync(out, { recursive: true });

const md: string[] = [`# ${cal.name}`, "", `Status: ${cal.status}`, "", cal.cadence, "", "## Rules", "", ...cal.rules.map((r) => `- ${r}`), ""];
const csv: string[] = ["date,id,platform,title,tip_url,caption,hashtags,review_status"];
const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;

for (const v of cal.videos) {
  const tip = getSocialTip(v.tip)!;
  md.push(`## ${dateFor(v.day)} · ${v.id} · ${v.title}`, "");
  md.push(`Pillar: ${v.pillar}. Page: /tips/${v.tip} (${tip.label}). Review: ${v.review.status}.${v.sensitive ? " Sensitive: no boosting, no urgency." : ""}`, "");
  md.push(`**Hook (first 2 seconds):** ${v.hook}`, "", "**Voiceover:**", "", ...v.voiceover.map((l) => `> ${l}`), "");
  md.push(`**Caption:** ${v.caption} ${v.hashtags.join(" ")}`, "");
  if (v.seedance) md.push(`**Seedance b-roll (${v.seedance.seconds}s, optional):** ${v.seedance.prompt}`, "");
  md.push("**Links:**", "");
  for (const p of Object.keys(SOCIAL_PLATFORMS) as SocialPlatform[]) {
    const link = `${SITE}${socialLink(v.tip, p, v.id)}`;
    md.push(`- ${SOCIAL_PLATFORMS[p].label}: ${link}`);
    csv.push([dateFor(v.day), v.id, p, esc(v.title), link, esc(v.caption), esc(v.hashtags.join(" ")), v.review.status].join(","));
  }
  md.push("");
}

fs.writeFileSync(path.join(out, "calendar.md"), md.join("\n"));
fs.writeFileSync(path.join(out, "calendar.csv"), csv.join("\n") + "\n");
console.log(`Wrote ${cal.videos.length} videos to exports/social/calendar.md and calendar.csv`);
