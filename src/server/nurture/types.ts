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
}

/** Opt-outs (STOP, unsubscribe, "don't call"). Keyed `${channel}:${address}`. */
export interface Suppression {
  id: string;
  channel: Channel | "all";
  address: string;
  reason: string;
  at: string;
}
