/**
 * Core data model for the intake, routing and lawyer portal backend.
 * Mirrors the "CRM data model and pipeline" section of the plan. The Postgres
 * schema in db/schema.sql has the same shape plus row-level security.
 */
import type { ConsentRecord } from "@/lib/consent";
import type { BusinessStructure } from "@/lib/fees";
import type { QuizAnswers } from "@/lib/quiz";
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
