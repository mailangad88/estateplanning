import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DecisionGuide } from "@/config/decisions/types";
import { decisionPath, getDecision } from "@/config/decisions";
import { DecisionPicker } from "./DecisionPicker";
import { DecisionMatrix } from "./DecisionMatrix";
import { DecisionMap, OptionCards, Shortcuts } from "./DecisionVisuals";
import "./decision.css";

export type DecisionPart = "picker" | "map" | "table" | "cards" | "shortcuts";

const DEFAULT_TITLE: Record<DecisionPart, (g: DecisionGuide) => string> = {
  picker: (g) => `Which ${g.noun} fits you?`,
  map: (g) => g.map.title,
  table: () => "Side by side",
  cards: () => "Each option, in plain words",
  shortcuts: () => "If this sounds like you, start here",
};

/**
 * A guide limited to some options, for an article about two or three of them. Picker weights,
 * shortcuts and families that point only at dropped options fall away.
 */
export function subsetGuide(guide: DecisionGuide, ids: string[]): DecisionGuide {
  const keep = new Set(ids);
  const options = guide.options.filter((o) => keep.has(o.id));
  const families = guide.families.filter((f) => options.some((o) => o.family === f.id));
  const questions = guide.questions.map((q) => ({
    ...q,
    choices: q.choices.map((c) => ({ ...c, weights: Object.fromEntries(Object.entries(c.weights).filter(([k]) => keep.has(k))) })),
  }));
  return { ...guide, options, families, questions, shortcuts: guide.shortcuts.filter((s) => keep.has(s.pick)) };
}

/**
 * One piece of a decision guide, framed for use inside an article or landing page, with a link to the
 * full /decide page. Usage: <DecisionEmbed slug="types-of-trusts" part="map" />, or limit it to some
 * options with only={["revocable", "medicaid"]}. Card and map links jump to the full guide.
 * Server component; the picker and table hydrate on their own.
 */
export function DecisionEmbed({
  slug,
  part,
  only,
  title,
  lead,
}: {
  slug: string;
  part: DecisionPart;
  /** Option ids to show. Omit for all. */
  only?: string[];
  title?: string;
  lead?: string;
}) {
  const full = getDecision(slug);
  if (!full) return null;
  const guide = only?.length ? subsetGuide(full, only) : full;
  const href = decisionPath(slug);
  // Anchors inside the parts (#opt-…) only exist on the full page, so point them there.
  const anchorBase = part === "cards" ? "" : href;
  return (
    <section className="dg dg-embed" aria-label={title ?? DEFAULT_TITLE[part](guide)}>
      <header className="dg-embed__head">
        <p className="kicker">{full.kicker}</p>
        <h2>{title ?? DEFAULT_TITLE[part](guide)}</h2>
        {(lead ?? (part === "map" ? guide.map.lead : undefined)) && <p className="section-lead">{lead ?? guide.map.lead}</p>}
      </header>
      {part === "picker" && <DecisionPicker guide={guide} anchorBase={anchorBase} />}
      {part === "map" && <DecisionMap guide={guide} anchorBase={anchorBase} />}
      {part === "table" && <DecisionMatrix guide={guide} anchorBase={anchorBase} />}
      {part === "cards" && <OptionCards guide={guide} />}
      {part === "shortcuts" && <Shortcuts guide={guide} anchorBase={anchorBase} />}
      <p className="dg-embed__more">
        <Link href={href} className="arrow-link">
          {part === "picker" ? "See every option compared" : `Open the full guide: ${full.h1}`} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </p>
    </section>
  );
}
