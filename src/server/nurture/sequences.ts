/**
 * Nurture sequence definitions. This file holds structure and timing only: no
 * copy. Every step cites brain-file entries (the attorney-approved knowledge
 * base) and a template key whose body is written from those entries and
 * approved before use. Rule: no entry, no piece.
 */
import type { Stage } from "@/server/types";
import type { Channel } from "@/server/nurture/types";

export interface StepOffset {
  minutes?: number;
  hours?: number;
  days?: number;
}

export type StepAnchor = "enrollment" | "consult";

export interface SequenceStep {
  id: string;
  channel: Channel;
  /** Time from the anchor. Negative is allowed ("24h before consult"). */
  offset: StepOffset;
  /** Defaults to "enrollment". "consult" needs ctx.consultAt at send time. */
  anchor?: StepAnchor;
  templateKey: string;
  /** Placeholders ("bf-TODO-...") until the attorney's brain file has the entry. */
  brainFileEntryIds: string[];
  /** Nothing is sent until an attorney has approved the template. Always true. */
  requiresApproval: true;
  purpose: string;
  /** Send only when the lead has at least one of these segment tags. */
  onlySegments?: string[];
  /** Skip when the lead has any of these segment tags (lets variants branch without overlapping). */
  exceptSegments?: string[];
  /** Service message (confirmation, reminder, onboarding): exempt from marketing frequency caps. */
  transactional?: boolean;
  /** The email carries the track's video. */
  video?: boolean;
}

export type ExitCondition =
  | { kind: "stage_reached"; stage: Stage }
  | { kind: "exit_set" }
  | { kind: "unsubscribed" };

export type TriggerKind =
  | "lead_created"
  | "quiz_completed"
  | "segment_tag"
  | "stage"
  | "consult_no_show"
  | "unresponsive_or_quiet_60d"
  | "sequence_completed";

export interface Sequence {
  id: string;
  name: string;
  trigger: { kind: TriggerKind; stage?: Stage; segment?: string; description: string };
  goal: string;
  exitWhen: ExitCondition[];
  steps: SequenceStep[];
}

const BOOKED: ExitCondition = { kind: "stage_reached", stage: "consult_booked" };
const SIGNED: ExitCondition = { kind: "stage_reached", stage: "retainer_signed" };
const EXIT_SET: ExitCondition = { kind: "exit_set" };
const UNSUB: ExitCondition = { kind: "unsubscribed" };

function step(
  id: string,
  channel: Channel,
  offset: StepOffset,
  brain: string[],
  purpose: string,
  extra: Partial<SequenceStep> = {},
): SequenceStep {
  return { id, channel, offset, templateKey: id, brainFileEntryIds: brain, requiresApproval: true, purpose, ...extra };
}

const speedToLead: Sequence = {
  id: "speed_to_lead",
  name: "Speed to lead",
  trigger: { kind: "lead_created", description: "Any new lead" },
  goal: "First live conversation with the lead",
  exitWhen: [{ kind: "stage_reached", stage: "contacted" }, EXIT_SET, UNSUB],
  steps: [
    step("stl_sms_confirm", "sms", { minutes: 0 }, ["bf-TODO-intake-what-happens-next"], "Instant text confirming we got the request", { transactional: true }),
    step("stl_email_confirm", "email", { minutes: 0 }, ["bf-TODO-intake-what-happens-next"], "Instant email confirming the request and who will call", { transactional: true }),
    step("stl_call_1", "call_task", { minutes: 5 }, ["bf-TODO-intake-call-script"], "Call attempt 1 within 5 minutes"),
    step("stl_sms_after_1", "sms", { minutes: 30 }, ["bf-TODO-intake-missed-call"], "Text after the first missed call"),
    step("stl_call_2", "call_task", { hours: 4 }, ["bf-TODO-intake-call-script"], "Call attempt 2"),
    step("stl_call_3", "call_task", { days: 1 }, ["bf-TODO-intake-call-script"], "Call attempt 3"),
    step("stl_sms_d1", "sms", { days: 1, hours: 2 }, ["bf-TODO-intake-missed-call"], "Text between attempts 3 and 4"),
    step("stl_call_4", "call_task", { days: 2 }, ["bf-TODO-intake-call-script"], "Call attempt 4"),
    step("stl_sms_d3", "sms", { days: 3 }, ["bf-TODO-intake-missed-call"], "Text between attempts 4 and 5"),
    step("stl_call_5", "call_task", { days: 4 }, ["bf-TODO-intake-call-script"], "Call attempt 5"),
    step("stl_sms_d5", "sms", { days: 5 }, ["bf-TODO-intake-missed-call"], "Text between attempts 5 and 6"),
    step("stl_call_6", "call_task", { days: 7 }, ["bf-TODO-intake-call-script"], "Call attempt 6, last"),
    step("stl_sms_final", "sms", { days: 7, hours: 1 }, ["bf-TODO-intake-closing-the-loop"], "Closing-the-loop text with an easy way to book"),
  ],
};

const quizFollowUp: Sequence = {
  id: "quiz_follow_up",
  name: "Quiz follow-up",
  trigger: { kind: "quiz_completed", description: "Quiz completed and no consult booked" },
  goal: "Book a consult",
  exitWhen: [BOOKED, EXIT_SET, UNSUB],
  steps: [
    step("qz_1_results", "email", { hours: 1 }, ["bf-TODO-quiz-results-explained"], "Explain what the quiz answers mean for this household"),
    // Day 2 branches on segment tag. The variants are mutually exclusive, so exactly one is sent.
    step("qz_2_guardianship", "email", { days: 2 }, ["bf-TODO-guardianship"], "Guardianship for minor children", { onlySegments: ["new_parent"] }),
    step("qz_2_home", "email", { days: 2 }, ["bf-TODO-home-and-probate"], "What happens to the house without a plan", { onlySegments: ["homeowner"], exceptSegments: ["new_parent"] }),
    step("qz_2_business", "email", { days: 2 }, ["bf-TODO-business-succession"], "What happens to the business without a plan", { onlySegments: ["business_owner"], exceptSegments: ["new_parent", "homeowner"] }),
    step("qz_2_general", "email", { days: 2 }, ["bf-TODO-will-vs-trust"], "Will versus trust, plainly", { exceptSegments: ["new_parent", "homeowner", "business_owner"] }),
    step("qz_3_cost", "email", { days: 5 }, ["bf-TODO-what-it-costs"], "What a plan costs and what drives the price"),
    step("qz_4_mistakes", "email", { days: 9 }, ["bf-TODO-common-mistakes"], "Mistakes the attorney sees most often"),
    step("qz_5_book", "email", { days: 14 }, ["bf-TODO-what-the-consult-covers"], "What the consult covers and how to book it"),
  ],
};

/** Segment tags (from segmentTags) that have a life-event track. */
export const LIFE_EVENT_SEGMENTS = [
  "new_parent",
  "homeowner",
  "blended_family",
  "business_owner",
  "caregiver",
  "widowed",
  "retiring",
] as const;
export type LifeEventSegment = (typeof LIFE_EVENT_SEGMENTS)[number];

export function lifeEventSequenceId(segment: string): string {
  return `life_event_${segment}`;
}

const LIFE_EVENT_TOPICS: Record<LifeEventSegment, string[]> = {
  new_parent: ["guardianship-basics", "if-both-parents-die", "choosing-a-guardian", "trust-for-minors", "who-manages-the-money", "beneficiary-forms", "next-step"],
  homeowner: ["house-and-probate", "deeds-and-trusts", "transfer-on-death-deeds", "property-tax-basics", "out-of-state-property", "keeping-the-house-in-the-family", "next-step"],
  blended_family: ["why-default-rules-fail", "spouse-versus-children", "trusts-for-blended-families", "naming-a-trustee", "avoiding-family-conflict", "beneficiary-forms", "next-step"],
  business_owner: ["what-happens-to-the-business", "buy-sell-agreements", "naming-a-successor", "business-and-trust", "valuation-basics", "key-person-risk", "next-step"],
  caregiver: ["power-of-attorney", "healthcare-directives", "long-term-care-costs", "medicaid-basics", "caregiver-authority", "records-to-gather", "next-step"],
  widowed: ["updating-after-a-loss", "beneficiary-forms-to-change", "new-power-of-attorney", "trust-or-will-now", "naming-new-fiduciaries", "talking-with-children", "next-step"],
  retiring: ["estate-plan-before-retirement", "retirement-account-beneficiaries", "power-of-attorney", "healthcare-directives", "avoiding-probate", "required-minimum-distributions-and-heirs", "next-step"],
};
/** Days from enrollment: 7 emails across 30 days, roughly twice a week at first and tapering. */
const LIFE_EVENT_DAYS = [0, 3, 7, 11, 16, 22, 29];

function lifeEvent(seg: LifeEventSegment): Sequence {
  const topics = LIFE_EVENT_TOPICS[seg];
  return {
    id: lifeEventSequenceId(seg),
    name: `Life event: ${seg.replace(/_/g, " ")}`,
    trigger: { kind: "segment_tag", segment: seg, description: `Lead carries the ${seg} segment tag` },
    goal: "Educate on the situation and book a consult",
    exitWhen: [BOOKED, EXIT_SET, UNSUB],
    steps: topics.map((slug, i) =>
      step(`le_${seg}_${i + 1}`, "email", { days: LIFE_EVENT_DAYS[i] }, [`bf-TODO-${seg}-${slug}`], `Educate: ${slug.replace(/-/g, " ")}`, {
        video: i === 2,
      }),
    ),
  };
}

const consultBooked: Sequence = {
  id: "consult_booked",
  name: "Consult booked",
  trigger: { kind: "stage", stage: "consult_booked", description: "Consult booked" },
  goal: "Lead shows up prepared",
  exitWhen: [{ kind: "stage_reached", stage: "consult_held" }, EXIT_SET, UNSUB],
  steps: [
    step("cb_confirm_email", "email", { minutes: 0 }, ["bf-TODO-consult-what-to-expect"], "Confirmation with date, attorney and how to join", { transactional: true }),
    step("cb_confirm_sms", "sms", { minutes: 0 }, ["bf-TODO-consult-what-to-expect"], "Text confirmation", { transactional: true }),
    step("cb_prep_checklist", "email", { hours: 1 }, ["bf-TODO-consult-prep-checklist"], "What to gather before the consult", { transactional: true }),
    step("cb_questionnaire", "email", { hours: 2 }, ["bf-TODO-pre-consult-questionnaire"], "Pre-consult questionnaire link", { transactional: true }),
    step("cb_remind_24h_email", "email", { hours: -24 }, ["bf-TODO-consult-what-to-expect"], "Reminder 24 hours before", { anchor: "consult", transactional: true }),
    step("cb_remind_24h_sms", "sms", { hours: -24 }, ["bf-TODO-consult-what-to-expect"], "Text reminder 24 hours before", { anchor: "consult", transactional: true }),
    step("cb_remind_2h_sms", "sms", { hours: -2 }, ["bf-TODO-consult-what-to-expect"], "Text reminder 2 hours before with join link", { anchor: "consult", transactional: true }),
  ],
};

const noShowRecovery: Sequence = {
  id: "no_show_recovery",
  name: "No-show recovery",
  trigger: { kind: "consult_no_show", description: "Consult marked no-show" },
  goal: "Rebook the consult",
  exitWhen: [{ kind: "stage_reached", stage: "consult_held" }, EXIT_SET, UNSUB],
  steps: [
    step("ns_call_same_day", "call_task", { minutes: 10 }, ["bf-TODO-no-show-call-script"], "Same-day call"),
    step("ns_sms_same_day", "sms", { minutes: 15 }, ["bf-TODO-no-show-recovery"], "Same-day text with reschedule link"),
    step("ns_email_d1", "email", { days: 1 }, ["bf-TODO-no-show-recovery"], "Touch 1: reschedule link, no guilt"),
    step("ns_call_d3", "call_task", { days: 3 }, ["bf-TODO-no-show-call-script"], "Touch 2: call"),
    step("ns_email_d7", "email", { days: 7 }, ["bf-TODO-no-show-recovery"], "Touch 3: last reschedule offer"),
  ],
};

const consultHeld: Sequence = {
  id: "consult_held_not_signed",
  name: "Consult held, not signed",
  trigger: { kind: "stage", stage: "consult_held", description: "Consult held without a signed retainer" },
  goal: "Retainer signed",
  exitWhen: [SIGNED, EXIT_SET, UNSUB],
  steps: [
    // The recap is written by the lawyer; the template is a shell for their text.
    step("ch_recap", "email", { hours: 2 }, ["bf-TODO-consult-recap-lawyer-written"], "Lawyer-written recap of the consult and the proposal"),
    step("ch_objection_cost", "email", { days: 3 }, ["bf-TODO-objection-cost"], "Touch 1: answer the cost question"),
    step("ch_call_d7", "call_task", { days: 7 }, ["bf-TODO-objection-call-script"], "Touch 2: intake check-in call"),
    step("ch_objection_timing", "email", { days: 14 }, ["bf-TODO-objection-not-now"], "Touch 3: answer 'not now'"),
    step("ch_close", "email", { days: 21 }, ["bf-TODO-objection-diy-docs"], "Touch 4: answer 'I'll do it myself', then hand off to long_term"),
  ],
};

const signedOnboarding: Sequence = {
  id: "signed_onboarding",
  name: "Signed onboarding",
  trigger: { kind: "stage", stage: "retainer_signed", description: "Retainer signed" },
  goal: "Documents gathered and portal activated",
  exitWhen: [{ kind: "stage_reached", stage: "plan_complete" }, UNSUB],
  steps: [
    step("so_welcome", "email", { minutes: 0 }, ["bf-TODO-onboarding-welcome"], "Welcome", { transactional: true }),
    step("so_doc_checklist", "email", { hours: 1 }, ["bf-TODO-onboarding-documents"], "Document-gathering checklist", { transactional: true }),
    step("so_portal_invite", "email", { hours: 2 }, ["bf-TODO-onboarding-portal"], "Portal invite", { transactional: true }),
    step("so_timeline", "email", { days: 1 }, ["bf-TODO-onboarding-timeline"], "What happens and when", { transactional: true }),
    step("so_docs_nudge", "sms", { days: 5 }, ["bf-TODO-onboarding-documents"], "Nudge to finish uploading documents", { transactional: true }),
  ],
};

const planComplete: Sequence = {
  id: "plan_complete",
  name: "Plan complete",
  trigger: { kind: "stage", stage: "plan_complete", description: "Plan signed and complete" },
  goal: "Trust funded, review left, referral made",
  exitWhen: [UNSUB],
  steps: [
    step("pc_funding_guide", "email", { days: 1 }, ["bf-TODO-trust-funding"], "Trust-funding guide", { transactional: true }),
    step("pc_review_request", "email", { days: 7 }, ["bf-TODO-review-request"], "Ask for a review"),
    // Referral ask is non-monetary. The firm must never pay or reward anyone for referrals
    // (fee-sharing and solicitation rules), so no incentive appears here or in the template.
    step("pc_referral_ask", "email", { days: 21 }, ["bf-TODO-referral-ask-nonmonetary"], "Referral ask, no payment or reward"),
  ],
};

const longTerm: Sequence = {
  id: "long_term",
  name: "Long-term nurture",
  trigger: { kind: "unresponsive_or_quiet_60d", description: "Not converted after 60 days, or exited as unresponsive, or handed off from consult_held_not_signed" },
  goal: "Stay useful until the lead is ready",
  // Deliberately no exit_set: these leads are often exited as "unresponsive".
  exitWhen: [BOOKED, UNSUB],
  steps: [
    ...Array.from({ length: 12 }, (_, i) =>
      step(`lt_newsletter_${i + 1}`, "email", { days: 30 * (i + 1) }, [`bf-TODO-newsletter-month-${i + 1}`], `Monthly newsletter ${i + 1}`),
    ),
    ...[75, 165, 255, 345].map((d, i) => step(`lt_webinar_${i + 1}`, "email", { days: d }, ["bf-TODO-webinar"], `Quarterly webinar invite ${i + 1}`)),
    step("lt_life_changed", "email", { days: 365 }, ["bf-TODO-life-changed-checkin"], "Annual 'has your life changed?' check"),
  ],
};

const annualReview: Sequence = {
  id: "annual_review",
  name: "Annual review",
  trigger: { kind: "stage", stage: "plan_complete", description: "Starts at plan completion and fires 12 months later" },
  goal: "Review booked",
  exitWhen: [UNSUB],
  steps: [
    step("ar_offer", "email", { days: 365 }, ["bf-TODO-annual-review"], "Offer the annual plan review"),
    step("ar_sms", "sms", { days: 372 }, ["bf-TODO-annual-review"], "Text follow-up on the review offer"),
  ],
};

/**
 * Sequence G: families handling an estate after a death. Human first, few messages,
 * long spacing, no sales cadence, one text at most. While it runs no other pre-sale
 * sequence starts, and the lead never moves to long_term marketing.
 */
const griefSupport: Sequence = {
  id: "grief_support",
  name: "After a death (estate administration)",
  trigger: { kind: "segment_tag", segment: "estate_administration", description: "Estate administration lead, after-a-death guide, or heir mode in a tool" },
  goal: "A calm first conversation when the family is ready",
  exitWhen: [BOOKED, EXIT_SET, UNSUB],
  steps: [
    step("g0_call", "call_task", { minutes: 0 }, ["bf-TODO-administration-first-call"], "Human call within the first hour; staff use the gentle script"),
    step("g1_condolence", "email", { minutes: 5 }, ["bf-TODO-administration-condolence"], "Condolence from the attorney and what happens next", { transactional: true }),
    step("g_sms_1", "sms", { hours: 2 }, ["bf-TODO-administration-condolence"], "One text after a missed call, never again unless they reply"),
    step("g2_first_weeks", "email", { days: 2 }, ["bf-TODO-administration-first-weeks"], "A short list of what usually matters in the first weeks"),
    step("g3_probate", "email", { days: 7 }, ["bf-TODO-probate-plain-language"], "Probate in plain language for this state"),
    step("g4_trust_vs_probate", "email", { days: 14 }, ["bf-TODO-trust-administration-vs-probate"], "Trust administration versus probate, and when each applies"),
    step("g5_check_in", "email", { days: 30 }, ["bf-TODO-administration-check-in"], "Gentle check-in and an offer to talk"),
    step("g6_deadlines", "email", { days: 60 }, ["bf-TODO-administration-deadlines-taxes"], "Deadlines and taxes: when to call a professional"),
    step("g7_last_note", "email", { days: 90 }, ["bf-TODO-administration-last-note"], "Last note, no ask"),
  ],
};

/** Sequence B: someone downloaded a guide or checklist. Deliver it, then invite the quiz and a consult. */
const magnetFollowUp: Sequence = {
  id: "magnet_follow_up",
  name: "Guide download follow-up",
  trigger: { kind: "segment_tag", segment: "resource:*", description: "A guide or checklist was requested (not the after-a-death guide)" },
  goal: "Turn the download into a quiz or a consult",
  exitWhen: [BOOKED, EXIT_SET, UNSUB],
  steps: [
    step("mg_1_delivery", "email", { minutes: 0 }, ["bf-TODO-magnet-how-to-use"], "Deliver the file and how to use it", { transactional: true }),
    step("mg_2_one_thing", "email", { days: 2 }, ["bf-TODO-magnet-highest-leverage-item"], "The single most useful item to do today"),
    step("mg_3_quiz", "email", { days: 5 }, ["bf-TODO-quiz-invite"], "Invite to the plan finder", { exceptSegments: ["tool:plan_finder"] }),
    step("mg_4_explainer", "email", { days: 9 }, ["bf-TODO-will-vs-trust"], "Probate versus a trust, with the short video", { video: true }),
    step("mg_5_consult", "email", { days: 14 }, ["bf-TODO-what-the-consult-covers"], "What a first meeting looks like and how to book it"),
  ],
};

export const SEQUENCES: Sequence[] = [
  speedToLead,
  quizFollowUp,
  griefSupport,
  magnetFollowUp,
  ...LIFE_EVENT_SEGMENTS.map(lifeEvent),
  consultBooked,
  noShowRecovery,
  consultHeld,
  signedOnboarding,
  planComplete,
  longTerm,
  annualReview,
];

const BY_ID = new Map(SEQUENCES.map((s) => [s.id, s]));

export function getSequence(id: string): Sequence | undefined {
  return BY_ID.get(id);
}

export function stepOffsetMs(o: StepOffset): number {
  return ((o.minutes ?? 0) + (o.hours ?? 0) * 60 + (o.days ?? 0) * 1440) * 60_000;
}
