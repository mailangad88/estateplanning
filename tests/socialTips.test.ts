import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SOCIAL_TIPS, getSocialTip } from "@/config/social-tips";
import { TOOLS } from "@/config/tools";
import { getMagnet } from "@/lib/magnets";
import { BOOK_TOPICS, bookHref, parseBookParams } from "@/lib/book";
import { socialLink, tipBookingSource } from "@/lib/social-links";
import { loadCalendar, sceneSeconds } from "@/lib/social-calendar";
import { isSensitivePath } from "@/config/sensitive";

/** Internal links these pages use must resolve to something that exists. */
function resolves(href: string): boolean {
  const p = href.split(/[?#]/)[0];
  if (p === "/pricing" || p === "/book" || p === "/tips") return true;
  let m = p.match(/^\/learn\/([^/]+)\/([^/]+)$/);
  if (m) return fs.existsSync(path.join(process.cwd(), "content", "learn", m[1], `${m[2]}.md`));
  if ((m = p.match(/^\/free\/([^/]+)$/))) return !!getMagnet(m[1]);
  if ((m = p.match(/^\/tools\/([^/]+)$/))) return TOOLS.some((t) => t.slug === m![1]);
  if ((m = p.match(/^\/tips\/([^/]+)$/))) return !!getSocialTip(m[1]);
  return false;
}

// Claims the attorney has not approved, or that bar advertising rules restrict.
const BANNED = /\bguarantee|\bbest\b(?! (for|interest))|\bexpert\b|\bspecialist\b|free (consult|call|15)|same[- ]day|\bwe will win\b|\bno risk\b/i;

describe("social tip pages", () => {
  it("have unique slugs and valid topics", () => {
    const slugs = SOCIAL_TIPS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const t of SOCIAL_TIPS) {
      expect(t.slug).toMatch(/^[a-z0-9-]+$/);
      expect(BOOK_TOPICS.some((b) => b.id === t.bookTopic)).toBe(true);
      expect(t.facts.length).toBeGreaterThanOrEqual(2);
      expect(t.check.options.length).toBeGreaterThanOrEqual(2);
      for (const f of t.facts) expect(f.cite.length).toBeGreaterThan(3);
    }
  });

  it("link only to pages that exist", () => {
    const broken: string[] = [];
    for (const t of SOCIAL_TIPS) {
      const hrefs = [`/free/${t.magnet}`, ...(t.tool ? [`/tools/${t.tool}`] : []), ...t.related.map((r) => r.href), ...t.check.options.map((o) => o.next.href)];
      for (const h of hrefs) if (!resolves(h)) broken.push(`${t.slug} -> ${h}`);
    }
    expect(broken).toEqual([]);
  });

  it("make no promises or unapproved offers", () => {
    for (const t of SOCIAL_TIPS) expect(JSON.stringify(t)).not.toMatch(BANNED);
  });

  it("stay noindex until the attorney approves them", () => {
    // Flip reviewed only with the attorney's sign-off; this guards against a bulk edit.
    expect(SOCIAL_TIPS.every((t) => t.reviewed === false)).toBe(true);
  });

  it("mark illness and care-cost pages as sensitive for analytics", () => {
    for (const slug of ["parent-dementia-no-power-of-attorney", "will-medicaid-take-the-house"]) expect(isSensitivePath(`/tips/${slug}`)).toBe(true);
  });
});

describe("social links", () => {
  it("tag each platform and video", () => {
    expect(socialLink("who-gets-my-kids", "instagram", "v07")).toBe("/tips/who-gets-my-kids?utm_source=instagram&utm_medium=social-video&utm_campaign=tips-il-launch&utm_content=v07");
    expect(() => socialLink("Bad Slug", "youtube", "v01")).toThrow();
  });

  it("turn the platform into a booking source that /book accepts", () => {
    expect(tipBookingSource("who-gets-my-kids", "instagram")).toBe("ig-who-gets-my-kids");
    expect(tipBookingSource("who-gets-my-kids", "YouTube")).toBe("yt-who-gets-my-kids");
    expect(tipBookingSource("who-gets-my-kids", "newsletter")).toBe("tips-who-gets-my-kids");
    for (const t of SOCIAL_TIPS) {
      const from = tipBookingSource(t.slug, "facebook");
      const href = bookHref(from, t.bookTopic);
      expect(parseBookParams(href.split("?")[1])).toEqual({ from, topic: t.bookTopic });
    }
  });
});

describe("social video calendar", () => {
  const cal = loadCalendar();

  it("has unique ids on consecutive days, each pointing at a tip page", () => {
    const ids = cal.videos.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    cal.videos.forEach((v, i) => expect(v.day).toBe(i + 1));
    for (const v of cal.videos) expect(getSocialTip(v.tip), v.id).toBeTruthy();
  });

  it("ends every video on the tip URL card and keeps shorts under a minute", () => {
    for (const v of cal.videos) {
      const last = v.blender.scenes.at(-1)!;
      expect(last.type).toBe("end");
      expect(last.url).toBe(`familyfutureplanning.com/tips/${v.tip}`);
      expect(sceneSeconds(v)).toBeLessThanOrEqual(60);
      expect(v.voiceover.length).toBeGreaterThan(2);
    }
    expect(cal.defaults.disclaimer).toMatch(/Not legal advice/);
    expect(cal.defaults.disclaimer).toMatch(/Attorney advertising/);
  });

  it("waits for attorney review and makes no promises", () => {
    for (const v of cal.videos) {
      expect(v.review.status).toBe("pending");
      expect(JSON.stringify(v)).not.toMatch(BANNED);
    }
  });

  it("sends 3D house scenes to Blender and everything else to Remotion", () => {
    for (const v of cal.videos) {
      expect(["remotion", "blender"]).toContain(v.renderer);
      const hasHouse = v.blender.scenes.some((s) => s.type === "house");
      expect(hasHouse, v.id).toBe(v.renderer === "blender");
    }
    expect(cal.videos.filter((v) => v.renderer === "remotion").length).toBeGreaterThan(cal.videos.length / 2);
  });

  it("keeps AI b-roll to objects and places", () => {
    for (const v of cal.videos.filter((x) => x.seedance)) expect(v.seedance!.prompt).toMatch(/no people/i);
  });
});
