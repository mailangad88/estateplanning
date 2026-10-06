/**
 * Core data model for the intake, routing and lawyer portal backend.
 * Mirrors the "CRM data model and pipeline" section of the plan. The Postgres
 * schema in db/schema.sql has the same shape plus row-level security.
 */
import type { ConsentRecord } from "@/lib/consent";
import type { BusinessStructure } from "@/lib/fees";
import type { PartnerStatus, PartnerType, ReleaseStatus, ValueLinked } from "@/lib/partners";
import type { QuizAnswers } from "@/lib/quiz";
import type { PackageSelection, PaymentPlan } from "@/lib/retainerPlan";
import type { ScoreResult } from "@/lib/scoring";

export type Role =
  | "platform_admin"
  | "intake"
  | "marketing"
  | "firm_admin"
  | "attorney"
  | "paralegal"
  | "client";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  firmId?: string;
  /** Set for attorneys: the lawyer profile this user signs in as */
  lawyerId?: string;
  /** Set for paralegals: the attorneys they support */
  supportsLawyerIds?: string[];
  /** Set for clients: the person record they are */
  personId?: string;
  active: boolean;
}

/** The signed-in user as seen by policy checks. */
export interface Actor {
  userId: string;
  role: Role;
  firmId?: string;
  lawyerId?: string;
  supportsLawyerIds?: string[];
  personId?: string;
  /** True when the session passed a second factor. Portal access requires it outside development. */
  mfa: boolean;
}

export interface Firm {
  id: string;
  name: string;
  structure: BusinessStructure;
}

export type MatterType =
  | "new_plan"
  | "update_plan"
  | "administration"
  | "elder_law"
  | "special_needs"
  | "business_succession";

export type Specialty = "special_needs" | "business_succession" | "blended_family" | "tax" | "medicaid" | "probate";

export interface Lawyer {
  id: string;
  firmId: string;
  name: string;
  email: string;
  phone?: string;
  bio?: string;
  licensedStates: string[];
  matterTypes: MatterType[];
  specialties: Specialty[];
  languages: string[];
  /** Consults the lawyer can take per week */
  weeklyCapacity: number;
  /** Most open (accepted, not yet signed or closed) leads at once */
  activeLeadCap: number;
  /** Minutes the lawyer has to accept an offer */
  acceptSlaMinutes: number;
  office?: { lat: number; lng: number };
  onCall?: boolean;
  active: boolean;
  stats: { avgAcceptMinutes: number; showRate: number; reviewScore: number };
}

export const STAGES = [
  "new",
  "contacted",
  "qualified",
  "conflict_check",
  "offered",
  "accepted",
  "consult_booked",
  "consult_held",
  "proposal_sent",
  "retainer_signed",
  "paid",
  "drafting",
  "signing_scheduled",
  "plan_complete",
  "annual_review",
] as const;
export type Stage = (typeof STAGES)[number];

export type ExitReason =
  | "not_a_fit"
  | "unresponsive"
  | "chose_another_option"
  | "conflict"
  | "declined_by_all";

export type PartyRelationship = "spouse" | "partner" | "child" | "beneficiary" | "heir" | "deceased" | "adverse" | "other";

export interface ConflictParty {
  name: string;
  relationship: PartyRelationship;
}

/** The only part of a lead shared with a lawyer before they accept it. */
export interface ConflictCard {
  clientName: string;
  parties: ConflictParty[];
  matterType: MatterType;
  state: string;
  county?: string;
  clearance: "pending" | "clear" | "conflict";
}

export interface HouseholdMember {
  name: string;
  relationship: PartyRelationship;
  age?: number;
}

export interface Intake {
  /** Five-line summary written or checked by the intake team */
  summary: string;
  goals?: string;
  redFlags: string[];
  deadlines: { label: string; date: string }[];
  household: {
    maritalStatus?: QuizAnswers["maritalStatus"];
    children?: QuizAnswers["children"];
    members: HouseholdMember[];
  };
  assets: {
    range?: QuizAnswers["assetRange"];
    ownsHome?: boolean;
    ownsBusiness?: boolean;
    outOfStateProperty?: boolean;
    outOfStateStates?: string[];
    retirementAccounts?: boolean;
  };
  answers: Partial<QuizAnswers>;
  existingDocuments?: QuizAnswers["existingDocuments"];
  consultAvailability?: string;
  needsInPerson?: boolean;
  clientLocation?: { lat: number; lng: number };
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  language: string;
  state: string;
  county?: string;
  householdId?: string;
}

export interface Lead {
  id: string;
  personId: string;
  createdAt: string;
  stage: Stage;
  stageHistory: { stage: Stage; at: string; by: string }[];
  exit?: { reason: ExitReason; at: string; note?: string };
  matterType: MatterType;
  state: string;
  county?: string;
  urgent: boolean;
  score: ScoreResult;
  segments: string[];
  source: Record<string, string | undefined>;
  consent: ConsentRecord;
  /** Non-confidential one-paragraph summary shown with an offer */
  offerSummary: string;
  conflictCard: ConflictCard;
  intake: Intake;
  /** Firm and lawyer who accepted the lead */
  firmId?: string;
  assignedLawyerId?: string;
  /** Routing special cases */
  previousLawyerId?: string;
  requestedLawyerId?: string;
  /** Lawyer ids the client picked from, when client choice is used */
  clientChoiceLawyerIds?: string[];
  crmId?: string;
  intakeOwnerId?: string;
  /** Which site tool or form captured the lead, the resource asked for, and the tool's figures */
  capture?: { tool: string; resource?: string; result?: Record<string, string | number | boolean> };
  /** Capture tools this visitor used before, oldest first */
  priorTools?: string[];
  /** Browser id used to merge repeat submissions into one person */
  visitorId?: string;
}

export type AssignmentStatus = "offered" | "accepted" | "declined" | "expired" | "withdrawn";
export type DeclineReason = "conflict" | "capacity" | "out_of_scope" | "other";

export interface Assignment {
  id: string;
  leadId: string;
  lawyerId: string;
  firmId: string;
  offeredAt: string;
  expiresAt: string;
  status: AssignmentStatus;
  respondedAt?: string;
  declineReason?: DeclineReason;
  note?: string;
  slaMet?: boolean;
  /** Why this lawyer was picked, for the audit trail */
  routingReason: string;
}

export type Visibility = "internal" | "firm" | "client";

export type DocumentKind =
  | "existing_will"
  | "deed"
  | "trust"
  | "beneficiary_form"
  | "engagement_signed"
  | "audit_certificate"
  | "payment_receipt"
  | "other";

export interface DocumentRecord {
  id: string;
  leadId: string;
  name: string;
  kind: DocumentKind;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedBy: string;
  uploadedAt: string;
  scanStatus: "pending" | "clean" | "infected";
  visibility: Visibility;
}

export interface Comment {
  id: string;
  leadId: string;
  parentId?: string;
  authorId: string;
  authorName: string;
  body: string;
  visibility: Visibility;
  mentions: string[];
  createdAt: string;
}

export interface Activity {
  id: string;
  leadId: string;
  kind: "call" | "sms" | "email" | "meeting" | "system";
  direction?: "inbound" | "outbound";
  at: string;
  summary: string;
  recordingUrl?: string;
  transcript?: string;
  byUserId?: string;
}

export interface Consult {
  id: string;
  leadId: string;
  lawyerId: string;
  at: string;
  type: "video" | "phone" | "office";
  status: "booked" | "held" | "no_show" | "cancelled";
  outcome?: "proposal" | "not_now" | "not_a_fit";
  notes?: string;
}

export type EngagementStatus = "draft" | "approved" | "sent" | "viewed" | "signed" | "paid" | "countersigned" | "voided";

export interface Engagement {
  id: string;
  leadId: string;
  firmId: string;
  lawyerId: string;
  packageId: string;
  feeCents: number;
  customScope?: string;
  status: EngagementStatus;
  provider: string;
  providerEnvelopeId?: string;
  /** Rendered engagement letter text the lawyer approved */
  letter?: string;
  approvedBy?: string;
  approvedAt?: string;
  history: { status: EngagementStatus; at: string }[];
  remindersSent: string[];
  documentIds: string[];
  /** Package tier, attorney-set prices and add-ons. Absent on engagements drafted before packages existed. */
  packageSelection?: PackageSelection;
  /** How the fee is paid and the status of each installment */
  paymentPlan?: PaymentPlan;
}

export type PaymentStatus = "pending" | "paid" | "failed";

/** One payment attempt against an engagement. Money goes straight to the firm's own account, never through the platform. */
export interface PaymentRecord {
  id: string;
  engagementId: string;
  leadId: string;
  firmId: string;
  /** Which installment in the plan this pays; absent for a one-off link */
  installmentNo?: number;
  amountCents: number;
  /** The firm account the payment was directed to when the link was made */
  account: "operating" | "trust";
  status: PaymentStatus;
  provider: string;
  /** The provider's id for the payment; webhooks are matched on it */
  providerPaymentId: string;
  linkUrl?: string;
  createdAt: string;
  paidAt?: string;
  /** Refunds the provider confirmed. Replays are matched on the refund id. */
  refunds: { id: string; amountCents: number; at: string; reason?: string }[];
}

export interface Task {
  id: string;
  leadId: string;
  title: string;
  ownerId: string;
  dueAt: string;
  doneAt?: string;
}

export interface AuditEvent {
  id: string;
  seq: number;
  at: string;
  actorId: string;
  actorRole: Role | "system";
  action: string;
  resourceType: string;
  resourceId: string;
  leadId?: string;
  detail?: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

/**
 * One record per website-to-middleware webhook delivery (src/lib/crm.ts). It carries ids, status and a
 * short error only: never the payload, so it holds no personal data. `id` is the idempotency key.
 * - delivered: the middleware answered 2xx
 * - failed: a retry could still work (network error, 5xx, 429); the cron sweep retries it
 * - abandoned: the middleware rejected it (other 4xx), or retries ran out; needs a person
 */
export type CrmDeliveryStatus = "delivered" | "failed" | "abandoned";

export interface CrmDelivery {
  id: string;
  leadId: string;
  event: string;
  status: CrmDeliveryStatus;
  httpStatus?: number;
  /** HTTP requests made across the first delivery and every retry */
  attempts: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt: string;
  deliveredAt?: string;
}

/** One seminar, webinar or community talk, with its costs and the counts entered after it (C17). */
export interface Seminar {
  id: string;
  /** Short code used as utm_campaign on invitations and registration links, and as a "seminar:<code>" lead tag */
  code: string;
  title: string;
  format: "in_person" | "webinar" | "library_talk";
  heldOn: string;
  venue?: string;
  /** Costs in cents by line item, for example venue, mail, ads, refreshments, materials */
  costs: Record<string, number>;
  mailPieces?: number;
  rsvps: number;
  attendees: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Referral partners (partner-kit): tracking only. The firm never pays for a referral.
// ---------------------------------------------------------------------------

export interface Partner {
  id: string;
  /** URL slug of the co-branded page, /partners/<slug> */
  slug: string;
  /** Contact person */
  name: string;
  org: string;
  type: PartnerType;
  /** Code carried in ?ref= links and QR codes, "ref-<slug>" by convention */
  refCode: string;
  status: PartnerStatus;
  /** Staff user who owns the relationship */
  ownerId?: string;
  firmId?: string;
  createdAt: string;
  /** YYYY-MM-DD the partner signed the referral partner policy */
  policySignedDate?: string;
  reciprocalAgreementOnFile: boolean;
  /** The reciprocal agreement is non-exclusive (Rule 7.2(b)(4)(i)). Must be true before a partner is active. */
  agreementNonexclusive: boolean;
  notes?: string;
}

export interface PartnerGift {
  id: string;
  partnerId: string;
  /** YYYY-MM-DD */
  date: string;
  description: string;
  valueCents: number;
  /** "flagged" gifts need the attorney's review; blocked gifts are never stored */
  status: "ok" | "flagged";
  /** The rule explanations that flagged it */
  flags: string[];
  loggedBy: string;
  reviewNote?: string;
}

export interface PartnerReferral {
  id: string;
  partnerId: string;
  refCode: string;
  /** The portal lead this referral created or was attributed to */
  leadId?: string;
  createdAt: string;
  /** partner_form: the partner submitted it. ref_link: the person arrived on a ?ref= link themselves. */
  origin: "partner_form" | "ref_link";
  /** The partner confirmed the person agreed to be referred. Always true for partner_form, never for ref_link. */
  clientConsent: boolean;
  /** The firm gave the client the Rule 7.2(b)(4) disclosure */
  disclosureGiven: boolean;
  disclosureAt?: string;
  disclosureVersion?: string;
  releaseStatus: ReleaseStatus;
  releaseUpdatedAt?: string;
  releaseUpdatedBy?: string;
  /** "Is anything of value linked to this referral?" Required before the matter can close. */
  valueLinked: ValueLinked;
  valueNote?: string;
}

export type ConversionProvider = "google_ads" | "meta";
export type ConversionType = "qualified_lead" | "consult_booked" | "consult_held" | "retainer_signed";
/**
 * - pending: due and not yet sent
 * - sent: accepted by the provider (or exported for a manual upload)
 * - failed: a retry could still work
 * - abandoned: retries ran out, or the provider rejected it; needs a person
 * - skipped: deliberately not sent (`reason` says why: consent, sensitive, too old, no identifier)
 */
export type ConversionStatus = "pending" | "sent" | "failed" | "abandoned" | "skipped";

/**
 * Conversions log: one row per lead, conversion type and provider, so an event is sent once.
 * Holds ids, times, status and the value only, never contact details (those are rebuilt from the lead at send time).
 * `id` is `${provider}:${type}:${leadId}`; `eventId` is the dedupe key sent to Meta.
 */
export interface ConversionEvent {
  id: string;
  leadId: string;
  provider: ConversionProvider;
  type: ConversionType;
  eventId: string;
  occurredAt: string;
  valueCents?: number;
  currency: string;
  status: ConversionStatus;
  reason?: string;
  attempts: number;
  /** "api", "mock" or "manual_csv" */
  channel?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}

/**
 * Review-request tracking, one row per client matter (the tracking sheet in gbp-posts-and-reviews.md 3.9).
 * It exists to prove every eligible client was asked. Exclusions use written, rule-based codes only.
 * `id` is `review-${leadId}`.
 */
export type ReviewExclusionCode = "GUARDIANSHIP" | "OPTOUT" | "UNIFORM_HOLD" | "DISPUTE_HOLD" | "SENSITIVE_TRACK";
export interface ReviewRequest {
  id: string;
  leadId: string;
  matterType: MatterType;
  /** Signing (or closing) date: the T+0 the offsets count from */
  anchorAt: string;
  eligible: boolean;
  exclusionCode?: ReviewExclusionCode;
  exclusionNote?: string;
  askedAt?: string;
  remindedAt?: string;
  reminderChannel?: "sms" | "email";
  optedOutAt?: string;
  /** Self-reported only. Never inferred. */
  postedAt?: string;
  createdAt: string;
}

/**
 * The attorney's approval of one site page for publication (src/server/content/pageApprovals.ts).
 * Append-only. It counts only while `contentHash` equals the sha256 of the page's content file as it reads
 * now; any edit to the file needs a new approval. scripts/apply-page-approvals.mjs turns approvals into the
 * `review: approved` / `reviewed: true` frontmatter flag in a normal commit.
 */
export interface PageApproval {
  id: string;
  /** Site path, e.g. /learn/wills/what-is-a-will */
  path: string;
  /** Content file relative to the repo root, e.g. content/learn/wills/what-is-a-will.md */
  file: string;
  /** sha256 of the content file's bytes at review time */
  contentHash: string;
  tier: "low" | "medium" | "high";
  approvedBy: string;
  /** Role of the approver at the time. Only attorney approvals are written into content files. */
  approverRole: Role;
  /** Display name for the byline record, from the approver's own user row */
  approverName: string;
  approvedAt: string;
  note: string;
  /** Pages approved together share a batch id. A single high-risk approval is a batch of one. */
  batchId: string;
  /** The pull request that carries the flag (and any edits) into git, when GitHub publishing is configured. */
  prUrl?: string;
  /** Set when the attorney edited the page in the portal: the hash of the file they opened. `contentHash` is then the edited file's. */
  editedFromHash?: string;
}
