export type Channel = "email" | "sms" | "call_task";

export interface SequenceEnrollment {
  id: string;
  leadId: string;
  sequenceId: string;
  enrolledAt: string;
  status: "active" | "completed" | "stopped";
  stoppedReason?: string;
  /** Step ids already sent or skipped, in order */
  sentStepIds: string[];
  /** Steps passed over (no SMS consent, segment mismatch, anchor passed). They also appear in sentStepIds. */
  skipped?: SkippedStep[];
}

/** Opt-outs (STOP, unsubscribe, "don't call"). Keyed `${channel}:${address}`. */
export interface Suppression {
  id: string;
  channel: Channel | "all";
  address: string;
  reason: string;
  at: string;
}

/** Why a step was skipped instead of sent (recorded on the enrollment so the timeline can explain it). */
export interface SkippedStep {
  stepId: string;
  reason: string;
  at: string;
}
