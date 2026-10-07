/**
 * Studio settings that come from the environment. Publishing is off unless
 * STUDIO_PUBLISH_MODE says otherwise, and paid services stay off until their keys are set.
 */
import { firm } from "@/config/firm";
import { site } from "@/config/site";
import type { PublishMode, Series, StudioSettings, VideoFormat } from "./types";

export function publishMode(env: NodeJS.ProcessEnv = process.env): PublishMode {
  const v = env.STUDIO_PUBLISH_MODE;
  return v === "private" || v === "live" ? v : "off";
}

/** Writer for research and scripts: "anthropic" needs ANTHROPIC_API_KEY; "site-draft" works offline from our own pages. */
export function writerKind(env: NodeJS.ProcessEnv = process.env): "anthropic" | "site-draft" {
  return env.STUDIO_WRITER === "anthropic" && env.ANTHROPIC_API_KEY ? "anthropic" : "site-draft";
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const SHORT_TIMES = ["07:00", "11:00", "13:00", "16:00", "19:00", "21:00"];

// Angad's target: 1 to 2 long videos and 5 to 6 shorts a day, shorts on both YouTube and Instagram.
// On the hour, because the scheduled run (GitHub Actions, hourly) posts what is due.
export const DEFAULT_SERIES: Series[] = [
  { id: "youtube_long", name: "YouTube long videos", format: "long", platform: "youtube", enabled: true, recurrence: { start: "2026-10-08", everyWeeks: 1, days: EVERY_DAY, times: ["10:00", "18:00"], holdHours: 12 } },
  { id: "youtube_shorts", name: "YouTube Shorts", format: "short", platform: "youtube", enabled: true, recurrence: { start: "2026-10-08", everyWeeks: 1, days: EVERY_DAY, times: SHORT_TIMES, holdHours: 12 } },
  { id: "instagram_reels", name: "Instagram Reels", format: "short", platform: "instagram", enabled: true, recurrence: { start: "2026-10-08", everyWeeks: 1, days: EVERY_DAY, times: SHORT_TIMES, holdHours: 12 } },
];

export const DEFAULT_SETTINGS: StudioSettings = {
  id: "settings",
  timezone: "America/Chicago",
  series: DEFAULT_SERIES,
  bufferDays: 3,
  updatedAt: "2026-10-07T00:00:00.000Z",
};

export const DISCLAIMER = "General education, not legal advice. Laws change and vary by state.";

export function endCard() {
  return {
    url: site.url.replace(/^https?:\/\//, ""),
    firmName: firm.brandName,
    officeAddress: firm.officeAddress,
    advertisingLabel: "Attorney advertising.",
  };
}

/** Booking link with UTM tags, so leads from each video show up by source in /admin/analytics. */
export function trackedUrl(path: string, platform: "youtube" | "instagram", format: VideoFormat, videoId: string): string {
  const u = new URL(path, site.url);
  u.searchParams.set("utm_source", platform);
  u.searchParams.set("utm_medium", format === "long" ? "video" : "short");
  u.searchParams.set("utm_campaign", "studio");
  u.searchParams.set("utm_content", videoId);
  return u.toString();
}

/** Narration pace used to size scenes: about 150 spoken words a minute. */
export const WORDS_PER_SECOND = 2.5;

export const LENGTH = {
  long: { minWords: 700, maxWords: 2200 }, // about 5 to 15 minutes
  short: { minWords: 50, maxWords: 140 }, // about 20 to 55 seconds, under the 60 second Shorts limit
};
