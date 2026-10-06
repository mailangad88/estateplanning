import type { CoverPalette } from "./ResourceCover";
import type { CoverFormat } from "./motifs";

export type MagnetConfig = {
  /** Matches the file name in research/lead-magnets. */
  slug: string;
  title: string;
  subtitle: string;
  kicker: string;
  icon: string;
  palette: CoverPalette;
  calm?: boolean;
  format?: CoverFormat;
};

/** Cover content for the eight lead magnets. Copy follows each magnet's landing headline. */
export const magnets: MagnetConfig[] = [
  {
    slug: "estate-planning-checklist",
    format: "checklist",
    title: "The Estate Planning Checklist",
    subtitle: "Organized by where you are in life",
    kicker: "Free checklist",
    icon: "list",
    palette: "accent",
  },
  {
    slug: "what-happens-if-you-die-without-a-will",
    format: "guide",
    title: "If You Die Without a Will",
    subtitle: "What the state writes for you, and how to change it",
    kicker: "Free guide",
    icon: "will",
    palette: "clay",
  },
  {
    slug: "trust-funding-checklist",
    format: "checklist",
    title: "Is Your Trust Funded?",
    subtitle: "The asset-by-asset checklist",
    kicker: "Free checklist",
    icon: "trust",
    palette: "gold",
  },
  {
    slug: "executor-first-30-days-guide",
    format: "guide",
    title: "The First 30 Days",
    subtitle: "A calm, step-by-step guide for executors and families",
    kicker: "Free guide",
    icon: "sprout",
    palette: "sage",
    calm: true,
  },
  {
    slug: "guardian-for-your-kids-worksheet",
    format: "worksheet",
    title: "Who Would Raise Your Kids?",
    subtitle: "A worksheet to decide, together",
    kicker: "Free worksheet",
    icon: "child",
    palette: "accent",
  },
  {
    slug: "estate-plan-document-locator",
    format: "workbook",
    title: "Where Everything Is",
    subtitle: "An organizer that gives your family a map, not a mystery",
    kicker: "Free organizer",
    icon: "folder",
    palette: "sage",
  },
  {
    slug: "beneficiary-designation-audit",
    format: "workbook",
    title: "Beneficiary Designation Audit",
    subtitle: "Does your form match your plan? A 20-minute check",
    kicker: "Free audit sheet",
    icon: "check-circle",
    palette: "clay",
  },
  {
    slug: "questions-to-ask-an-estate-planning-attorney",
    format: "guide",
    title: "25 Questions to Ask an Estate Planning Attorney",
    subtitle: "Before you hire one",
    kicker: "Free question list",
    icon: "question-mark",
    palette: "gold",
  },
];

export function getMagnet(slug: string): MagnetConfig | undefined {
  return magnets.find((m) => m.slug === slug);
}
