import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { ArrowRight, Calculator, Download, ListChecks, Sparkles } from "lucide-react";
import { servedStates, US_STATES } from "@/config/firm";
import { PICKERS, TIMELINES, VISUAL_LABELS, type VisualSpec } from "@/config/visual-kit";
import { PLAN_DOCS, whatIfFor } from "@/config/what-if-scenarios";
import { learnHrefFor } from "@/config/life-game";
import { diagramRegistry } from "@/components/visuals/diagrams/registry";
import { ICON_MAP } from "@/components/visual-card";
import { topicFor } from "@/lib/visual-topic";
import { planVisuals, type PlanInput } from "@/lib/visual-sections";
import { WhatIfCard, type WhatIfData } from "./whatif-card";
import { MiniPickerView } from "./mini-picker";
import { ProbateSlider } from "./probate-slider";

export interface KitDownload { slug: string; title: string; promise: string; format?: string }
export interface KitLink { href: string; title: string; kind?: string }

export interface RichProseProps extends Omit<PlanInput, "downloads" | "tools" | "hasRelated"> {
  downloads?: KitDownload[];
  tools?: KitLink[];
  related?: KitLink[];
}

const coverExists = (slug: string) => fs.existsSync(path.join(process.cwd(), "public", "media", "covers", `${slug}-600.webp`));

function whatIfData(id: string): WhatIfData | null {
  const s = whatIfFor(id);
  if (!s) return null;
  const d = PLAN_DOCS[s.fix[0]];
  return { id: s.id, title: s.title, delay: s.delay, without: s.without, withPlan: s.withPlan, doc: { label: d.label, href: d.href }, learn: learnHrefFor(s.learn) };
}

function launchState() {
  const s = servedStates()[0];
  return (US_STATES as readonly string[]).includes(s) ? s : "IL";
}

/** One visual from the kit, with its small label above it. */
export function VisualEmbed({ v, props, n }: { v: VisualSpec; props: RichProseProps; n: number }) {
  const id = `vk-${n}`;
  let body: React.ReactNode = null;
  let label = VISUAL_LABELS[v.type];
  switch (v.type) {
    case "whatif": {
      const s = whatIfData(v.id);
      if (s) body = <WhatIfCard s={s} />;
      break;
    }
    case "whatif-strip": {
      const list = v.ids.map(whatIfData).filter((x): x is WhatIfData => x !== null);
      if (list.length) body = <div className="vk-strip">{list.map((s) => <WhatIfCard key={s.id} s={s} compact />)}</div>;
      break;
    }
    case "picker": {
      const p = PICKERS.find((x) => x.id === v.id);
      if (p) {
        const { match: _m, ...data } = p;
        body = <MiniPickerView picker={data} id={id} />;
      }
      break;
    }
    case "timeline": {
      const t = TIMELINES.find((x) => x.id === v.id);
      if (t) {
        label = t.title;
        body = (
          <ol className="vk-timeline">
            {t.steps.map((s) => (
              <li key={s.title}>
                <span className="vk-timeline__when">{s.when}</span>
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
        );
      }
      break;
    }
    case "slider":
      body = <ProbateSlider id={id} defaultState={launchState()} />;
      label = `${label}: what could probate cost?`;
      break;
    case "diagram": {
      const d = diagramRegistry.find((x) => x.name === v.name);
      if (d) {
        const D = d.component;
        body = <D />;
      }
      break;
    }
    case "download": {
      const m = props.downloads?.find((x) => x.slug === v.slug);
      if (m) {
        body = (
          <Link href={`/free/${m.slug}`} className="vk-download">
            {coverExists(m.slug) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/media/covers/${m.slug}-600.webp`} alt="" width={600} height={776} loading="lazy" decoding="async" />
            ) : (
              <span className="vk-download__icon"><Download size={28} aria-hidden="true" /></span>
            )}
            <span className="vk-download__text">
              <strong>{m.title}</strong>
              <span>{m.promise}</span>
              <span className="vk-download__cta">Get it free <ArrowRight size={14} aria-hidden="true" /></span>
            </span>
          </Link>
        );
      }
      break;
    }
    case "tool": {
      const t = props.tools?.find((x) => x.href === v.slug);
      if (t) {
        const Icon = t.href.startsWith("/checklists") ? ListChecks : Calculator;
        label = t.href.startsWith("/checklists") ? "Free checklist" : label;
        body = (
          <Link href={t.href} className="vk-tool">
            <span className="vk-tool__icon"><Icon size={26} aria-hidden="true" /></span>
            <span><strong>{t.title}</strong><span>{t.href.startsWith("/checklists") ? "Free and printable. Tick it off at your own pace." : "Free, takes a few minutes, and you see your answer right away."}</span></span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        );
      }
      break;
    }
    case "related": {
      const list = (props.related ?? []).slice(0, 4);
      if (list.length) {
        body = (
          <ul className="vk-related">
            {list.map((r) => {
              const t = topicFor(r.href, r.title);
              const Icon = ICON_MAP[t.icon] ?? Sparkles;
              return (
                <li key={r.href}>
                  <Link href={r.href} className={`vk-related__item vk-tone--${t.tone}`}>
                    <span className="vk-related__icon"><Icon size={20} aria-hidden="true" /></span>
                    <span>{r.kind && <span className="vk-related__kind">{r.kind}</span>}{r.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        );
      }
      break;
    }
  }
  if (!body) return null;
  return (
    <aside className={`vk vk--${v.type}`} aria-label={label}>
      <p className="vk__label">{label}</p>
      {body}
    </aside>
  );
}

/**
 * Article body with a visual between sections. Use in place of `<div className="prose" dangerouslySetInnerHTML>`.
 * Visuals sit outside the `.prose` blocks so article list and heading styles do not leak into them.
 */
export function RichProse(props: RichProseProps) {
  const segments = planVisuals({
    ...props,
    downloads: props.downloads?.map((d) => d.slug),
    tools: props.tools?.map((t) => t.href),
    hasRelated: Boolean(props.related?.length),
  });
  return (
    <div className="rich-prose">
      {segments.map((s, i) =>
        "html" in s ? <div key={i} className="prose" dangerouslySetInnerHTML={{ __html: s.html }} /> : <VisualEmbed key={i} v={s.visual} props={props} n={i} />,
      )}
    </div>
  );
}
