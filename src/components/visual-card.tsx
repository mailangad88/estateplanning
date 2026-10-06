import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import {
  ArrowRight, Baby, Briefcase, Calculator, CalendarCheck, CircleHelp, ClipboardCheck, ClipboardList, Download, FileText,
  Flower2, HandHeart, Heart, House, Landmark, ListChecks, Play, Receipt, Scale, ScrollText, ShieldCheck, Stethoscope, Sun,
  Users, type LucideIcon,
} from "lucide-react";
import { illustrationSrc, topicFor, type Tone } from "@/lib/visual-topic";
import { videos } from "@/components/visuals/video/videos";

export const ICON_MAP: Record<string, LucideIcon> = {
  Baby, Briefcase, Calculator, CalendarCheck, CircleHelp, ClipboardCheck, ClipboardList, Download, FileText, Flower2,
  HandHeart, Heart, House, Landmark, ListChecks, Receipt, Scale, ScrollText, ShieldCheck, Stethoscope, Sun, Users,
};

export type CardMedia = "auto" | "art" | "icon";
export interface CardItem {
  href: string;
  title: string;
  description?: string;
  tag?: string;
  /** Explicit image (path under /public). Otherwise one is picked from the link. */
  image?: string;
}

const PUBLIC = path.join(process.cwd(), "public");
const exists = (src: string) => {
  try {
    return fs.existsSync(path.join(PUBLIC, src));
  } catch {
    return false;
  }
};

type Media = { kind: "cover" | "poster" | "art"; src: string } | { kind: "icon"; icon: string };

function mediaFor(item: CardItem, mode: CardMedia): { media: Media; tone: Tone } {
  const t = topicFor(item.href, item.title);
  if (item.image) return { media: { kind: "art", src: item.image }, tone: t.tone };
  const [, section, slug] = item.href.split("/");
  if (section === "free" && slug) {
    const src = `/media/covers/${slug}-600.webp`;
    if (exists(src)) return { media: { kind: "cover", src }, tone: t.tone };
  }
  if (section === "videos" && slug) {
    const v = videos.find((x) => x.slug === slug);
    if (v?.poster) return { media: { kind: "poster", src: v.poster }, tone: t.tone };
  }
  if (section === "tools") return { media: { kind: "icon", icon: "Calculator" }, tone: t.tone };
  if (section === "quizzes") return { media: { kind: "icon", icon: "ListChecks" }, tone: t.tone };
  const artSections = new Set(["guides", "compare", "life-events", "estate-planning-for", "learn"]);
  if (mode === "art" || (mode === "auto" && artSections.has(section))) return { media: { kind: "art", src: illustrationSrc(t.art) }, tone: t.tone };
  return { media: { kind: "icon", icon: t.icon }, tone: t.tone };
}

/** Picture-first card grid. Covers for downloads, posters for videos, an illustration or a big icon for the rest. */
export function VisualCardGrid({ items, media = "auto" }: { items: CardItem[]; media?: CardMedia }) {
  return (
    <ul className={`vcards${items.length % 4 === 0 ? " vcards--4" : ""}`}>
      {items.map((item) => {
        const { media: m, tone } = mediaFor(item, media);
        const Icon = m.kind === "icon" ? (ICON_MAP[m.icon] ?? FileText) : null;
        return (
          <li key={item.href}>
            <Link href={item.href} className={`vcard vcard--${tone} vcard--${m.kind}`}>
              <span className="vcard__media" aria-hidden="true">
                {m.kind === "icon" && Icon ? (
                  <Icon size={44} strokeWidth={1.6} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={(m as { src: string }).src} alt="" loading="lazy" decoding="async" />
                )}
                {m.kind === "poster" && (
                  <span className="vcard__play">
                    <Play size={20} fill="currentColor" />
                  </span>
                )}
              </span>
              <span className="vcard__body">
                {item.tag && <span className="tag">{item.tag}</span>}
                <strong>{item.title}</strong>
                {item.description && <span className="card-desc">{item.description}</span>}
                <span className="vcard__go">
                  Open <ArrowRight size={15} aria-hidden="true" />
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
