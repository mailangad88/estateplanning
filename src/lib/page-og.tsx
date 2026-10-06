import { renderOgImage, type OgVariant } from "@/lib/og";
import { allPages } from "@/lib/pages";
import { getMagnet } from "@/lib/magnets";
import { getVideo } from "@/components/visuals/video/videos";

/** Pages not listed in allPages() (not indexed, or owned outside the content system). */
const EXTRA: Record<string, { title: string; section: string }> = {
  "/legal/disclaimer": { title: "Disclaimer", section: "Legal" },
  "/legal/how-we-work": { title: "How we work", section: "Legal" },
  "/legal/privacy": { title: "Privacy policy", section: "Legal" },
  "/legal/sms-terms": { title: "Text message terms", section: "Legal" },
  "/editorial-policy": { title: "Editorial policy", section: "About" },
  "/not-in-your-state": { title: "Not in your state yet", section: "About" },
  "/videos": { title: "Estate planning, explained in a minute or two", section: "Videos" },
  "/visuals": { title: "Visual library", section: "Internal" },
};

/** Calm colours for grief and settlement topics, warm ones for family topics. */
function variantFor(path: string, section: string): OgVariant {
  if (/death|settling|executor|first-30|probate|grief|after-a/.test(path)) return "sage";
  if (/guardian|baby|married|children|family|kids/.test(path)) return "clay";
  if (/tool|checklist|calculator/.test(path) || section === "Tools" || section === "Checklists") return "gold";
  return "accent";
}

function humanize(slug: string): string {
  const s = slug.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Title and kicker for any path on the site. */
export function pageOgInfo(path: string): { title: string; kicker: string } {
  const page = allPages().find((p) => p.path === path);
  if (page) return { title: page.title, kicker: page.section === "Main" ? "Estate planning" : page.section };
  if (EXTRA[path]) return { title: EXTRA[path].title, kicker: EXTRA[path].section };
  const res = /^\/free\/([^/]+)/.exec(path);
  if (res) {
    const g = getMagnet(res[1]);
    if (g) return { title: g.title, kicker: "Free resource" };
  }
  const vid = /^\/videos\/([^/]+)/.exec(path);
  if (vid) {
    const v = getVideo(vid[1]);
    if (v) return { title: v.title, kicker: "Video" };
  }
  const last = path.split("/").filter(Boolean).pop() ?? "";
  return { title: last ? humanize(last) : "Estate planning with a real attorney", kicker: "Estate planning" };
}

/** Share image for a path, in the house style. Used by every route's opengraph-image.tsx. */
export function pageOgImage(path: string) {
  const { title, kicker } = pageOgInfo(path);
  return renderOgImage({ title, kicker, variant: variantFor(path, kicker) });
}

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";
