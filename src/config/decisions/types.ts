/**
 * A decision guide is a visual "which one should I pick?" page: a short picker, a map of the options,
 * a side-by-side matrix, a card per option, rules of thumb, steps and FAQs. Each guide is plain data
 * so new topics are added without new components. Copy follows content/STYLE.md and the launch-check
 * rules, and stays a draft (`reviewed: false`) until the attorney approves it.
 */
import type { Faq } from "@/lib/content";
import type { Tone } from "@/lib/visual-topic";

/** 0 = none, 3 = a lot. What "a lot" means is set by the dimension's label. */
export type Level = 0 | 1 | 2 | 3;

export interface DecisionDimension {
  id: string;
  label: string;
  /** One line under the label explaining what the row measures. */
  help?: string;
  /** More dots is a cost, not a benefit (shown in clay instead of green). */
  inverse?: boolean;
}

export interface DecisionOption {
  id: string;
  name: string;
  /** Shorter label for the map and matrix headers. */
  short?: string;
  /** Group id from `families`. */
  family: string;
  /** lucide-react icon name, mapped in components/decision/icons.ts. */
  icon: string;
  /** What it is, in one sentence. */
  what: string;
  bestFor: string[];
  watchOut: string[];
  /** One cell per dimension id. */
  cells: Record<string, { level: Level; text: string }>;
  /** Position on the decision map, 0 to 100 on each axis. */
  map: { x: number; y: number };
  learn?: { href: string; label: string };
}

export interface DecisionChoice {
  id: string;
  label: string;
  detail?: string;
  /** Points this answer gives each option. Negative points count against it. */
  weights: Record<string, number>;
  /** Why this answer points to an option, shown with the result. Falls back to the label. */
  reason?: string;
}

export interface DecisionQuestion {
  id: string;
  prompt: string;
  help?: string;
  /** Allow more than one answer. */
  multi?: boolean;
  choices: DecisionChoice[];
}

export interface DecisionGuide {
  slug: string;
  /** Title tag and breadcrumb. */
  title: string;
  h1: string;
  description: string;
  kicker: string;
  /** Hero illustration name in public/media/illustrations. */
  art: string;
  tone: Tone;
  updated: string;
  /** True only after attorney review. Never flip this in code review. */
  reviewed: boolean;
  /** Direct answer for featured snippets and AI answers, 40 to 70 words. */
  answer: string;
  takeaways: string[];
  /** Name for the options as a group, such as "trust" or "power of attorney". */
  noun: string;
  families: { id: string; name: string; text: string; tone: Tone }[];
  options: DecisionOption[];
  dimensions: DecisionDimension[];
  map: { x: { low: string; high: string }; y: { low: string; high: string }; title: string; lead: string };
  questions: DecisionQuestion[];
  /** Shown with every picker result, for example "most plans start with a revocable trust". */
  resultNote?: string;
  /** "If this, consider that" rules of thumb. */
  shortcuts: { when: string; pick: string }[];
  /** Registry name from components/visuals/diagrams, shown in the "how it works" band. */
  diagrams: string[];
  howTo: { name: string; steps: { name: string; text: string }[] };
  faqs: Faq[];
  related: { href: string; label: string }[];
}
