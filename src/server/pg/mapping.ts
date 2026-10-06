/**
 * Column mapping between the TypeScript model (camelCase, ISO strings, nested objects)
 * and db/schema.sql (snake_case, timestamptz, jsonb). tests/pg.test.ts checks that
 * every column in schema.sql is covered here and the other way round.
 */

export type Kind = "text" | "int" | "bool" | "ts" | "date" | "jsonb" | "json" | "textarr";

export interface ColumnSpec {
  prop: string;
  col: string;
  kind: Kind;
  /** Nullable in the schema: absent in TS (undefined) <-> NULL in SQL */
  nullable?: boolean;
}

export interface TableSpec {
  table: string;
  columns: ColumnSpec[];
}

const t = (prop: string, col: string, nullable = false): ColumnSpec => ({ prop, col, kind: "text", nullable });
const n = (prop: string, col: string, nullable = false): ColumnSpec => ({ prop, col, kind: "int", nullable });
const b = (prop: string, col: string, nullable = false): ColumnSpec => ({ prop, col, kind: "bool", nullable });
const ts = (prop: string, col: string, nullable = false): ColumnSpec => ({ prop, col, kind: "ts", nullable });
const d = (prop: string, col: string, nullable = false): ColumnSpec => ({ prop, col, kind: "date", nullable });
const j = (prop: string, col: string, nullable = false): ColumnSpec => ({ prop, col, kind: "jsonb", nullable });
const a = (prop: string, col: string, nullable = false): ColumnSpec => ({ prop, col, kind: "textarr", nullable });

export const TABLES = {
  users: {
    table: "users",
    columns: [
      t("id", "id"), t("email", "email"), t("name", "name"), t("role", "role"),
      t("firmId", "firm_id", true), t("lawyerId", "lawyer_id", true),
      a("supportsLawyerIds", "supports_lawyer_ids", true), t("personId", "person_id", true), b("active", "active"),
    ],
  },
  firms: { table: "firms", columns: [t("id", "id"), t("name", "name"), t("structure", "structure")] },
  lawyers: {
    table: "lawyers",
    columns: [
      t("id", "id"), t("firmId", "firm_id"), t("name", "name"), t("email", "email"),
      t("phone", "phone", true), t("bio", "bio", true),
      a("licensedStates", "licensed_states"), a("matterTypes", "matter_types"), a("specialties", "specialties"), a("languages", "languages"),
      n("weeklyCapacity", "weekly_capacity"), n("activeLeadCap", "active_lead_cap"), n("acceptSlaMinutes", "accept_sla_minutes"),
      j("office", "office", true), b("onCall", "on_call"), b("active", "active"), j("stats", "stats"),
    ],
  },
  persons: {
    table: "persons",
    columns: [
      t("id", "id"), t("firstName", "first_name"), t("lastName", "last_name"), t("email", "email"), t("phone", "phone"),
      t("language", "language"), t("state", "state"), t("county", "county", true), t("householdId", "household_id", true),
    ],
  },
  leads: {
    table: "leads",
    columns: [
      t("id", "id"), t("personId", "person_id"), ts("createdAt", "created_at"), t("stage", "stage"),
      j("stageHistory", "stage_history"), j("exit", "exit", true), t("matterType", "matter_type"), t("state", "state"),
      t("county", "county", true), b("urgent", "urgent"), j("score", "score"), a("segments", "segments"), j("source", "source"),
      j("consent", "consent"), t("offerSummary", "offer_summary"), j("conflictCard", "conflict_card"), j("intake", "intake"),
      t("firmId", "firm_id", true), t("assignedLawyerId", "assigned_lawyer_id", true),
      t("previousLawyerId", "previous_lawyer_id", true), t("requestedLawyerId", "requested_lawyer_id", true),
      a("clientChoiceLawyerIds", "client_choice_lawyer_ids", true), t("crmId", "crm_id", true),
      t("intakeOwnerId", "intake_owner_id", true), j("capture", "capture", true), a("priorTools", "prior_tools", true),
      t("visitorId", "visitor_id", true),
    ],
  },
  assignments: {
    table: "assignments",
    columns: [
      t("id", "id"), t("leadId", "lead_id"), t("lawyerId", "lawyer_id"), t("firmId", "firm_id"),
      ts("offeredAt", "offered_at"), ts("expiresAt", "expires_at"), t("status", "status"),
      ts("respondedAt", "responded_at", true), t("declineReason", "decline_reason", true), t("note", "note", true),
      b("slaMet", "sla_met", true), t("routingReason", "routing_reason"),
    ],
  },
  documents: {
    table: "documents",
    columns: [
      t("id", "id"), t("leadId", "lead_id"), t("name", "name"), t("kind", "kind"), t("contentType", "content_type"),
      n("sizeBytes", "size_bytes"), t("storageKey", "storage_key"), t("uploadedBy", "uploaded_by"),
      ts("uploadedAt", "uploaded_at"), t("scanStatus", "scan_status"), t("visibility", "visibility"),
    ],
  },
  comments: {
    table: "comments",
    columns: [
      t("id", "id"), t("leadId", "lead_id"), t("parentId", "parent_id", true), t("authorId", "author_id"),
      t("authorName", "author_name"), t("body", "body"), t("visibility", "visibility"), a("mentions", "mentions"),
      ts("createdAt", "created_at"),
    ],
  },
  activities: {
    table: "activities",
    columns: [
      t("id", "id"), t("leadId", "lead_id"), t("kind", "kind"), t("direction", "direction", true), ts("at", "at"),
      t("summary", "summary"), t("recordingUrl", "recording_url", true), t("transcript", "transcript", true),
      t("byUserId", "by_user_id", true),
    ],
  },
  consults: {
    table: "consults",
    columns: [
      t("id", "id"), t("leadId", "lead_id"), t("lawyerId", "lawyer_id"), ts("at", "at"), t("type", "type"),
      t("status", "status"), t("outcome", "outcome", true), t("notes", "notes", true),
    ],
  },
  engagements: {
    table: "engagements",
    columns: [
      t("id", "id"), t("leadId", "lead_id"), t("firmId", "firm_id"), t("lawyerId", "lawyer_id"), t("packageId", "package_id"),
      n("feeCents", "fee_cents"), t("customScope", "custom_scope", true), t("status", "status"), t("provider", "provider"),
      t("providerEnvelopeId", "provider_envelope_id", true), t("letter", "letter", true), t("approvedBy", "approved_by", true),
      ts("approvedAt", "approved_at", true), j("history", "history"), a("remindersSent", "reminders_sent"),
      a("documentIds", "document_ids"),
    ],
  },
  tasks: {
    table: "tasks",
    columns: [
      t("id", "id"), t("leadId", "lead_id"), t("title", "title"), t("ownerId", "owner_id"), ts("dueAt", "due_at"),
      ts("doneAt", "done_at", true),
    ],
  },
  feeRuleVersions: {
    table: "fee_rule_versions",
    columns: [
      t("id", "id"), t("ruleId", "rule_id"), n("version", "version"), j("rule", "rule"), t("editedBy", "edited_by"),
      ts("editedAt", "edited_at"), t("reason", "reason"), b("billable", "billable"), t("lockReason", "lock_reason", true),
      j("counsel", "counsel", true),
    ],
  },
  billableEvents: {
    table: "billable_events",
    columns: [
      t("id", "id"), t("type", "type"), ts("occurredAt", "occurred_at"), t("state", "state", true),
      t("lawyerId", "lawyer_id", true), n("amountCents", "amount_cents", true),
    ],
  },
  invoices: {
    table: "invoices",
    columns: [
      t("id", "id"), t("firmId", "firm_id"), d("periodStart", "period_start"), d("periodEnd", "period_end"),
      t("structure", "structure"), j("lines", "lines"), n("totalCents", "total_cents"), j("blockedRules", "blocked_rules"),
      t("status", "status"), ts("createdAt", "created_at"), t("createdBy", "created_by"), t("approvedBy", "approved_by", true),
      j("credits", "credits"),
    ],
  },
  enrollments: {
    table: "sequence_enrollments",
    columns: [
      t("id", "id"), t("leadId", "lead_id"), t("sequenceId", "sequence_id"), ts("enrolledAt", "enrolled_at"),
      t("status", "status"), t("stoppedReason", "stopped_reason", true), a("sentStepIds", "sent_step_ids"),
      j("skipped", "skipped", true),
    ],
  },
  suppressions: {
    table: "suppressions",
    columns: [t("id", "id"), t("channel", "channel"), t("address", "address"), t("reason", "reason"), ts("at", "at")],
  },
  factVerifications: {
    table: "fact_verifications",
    columns: [
      t("id", "id"), t("factId", "fact_id"), n("version", "version"), t("approvedValue", "approved_value"),
      t("approvedBy", "approved_by"), ts("approvedAt", "approved_at"), t("note", "note"),
    ],
  },
  automationState: {
    table: "automation_state",
    columns: [n("cursorSeq", "cursor_seq"), j("stages", "stages"), j("exits", "exits"), t("id", "id")],
  },
  seminars: {
    table: "seminars",
    columns: [
      t("id", "id"), t("code", "code"), t("title", "title"), t("format", "format"), d("heldOn", "held_on"), t("venue", "venue", true),
      j("costs", "costs"), n("mailPieces", "mail_pieces", true), n("rsvps", "rsvps"), n("attendees", "attendees"), t("notes", "notes", true),
      t("createdBy", "created_by"), ts("createdAt", "created_at"), ts("updatedAt", "updated_at"),
    ],
  },
  crmDeliveries: {
    table: "crm_deliveries",
    columns: [
      t("id", "id"), t("leadId", "lead_id"), t("event", "event"), t("status", "status"), n("httpStatus", "http_status", true),
      n("attempts", "attempts"), t("error", "error", true), ts("createdAt", "created_at"), ts("updatedAt", "updated_at"),
      ts("lastAttemptAt", "last_attempt_at"), ts("deliveredAt", "delivered_at", true),
    ],
  },
  audit: {
    table: "audit_events",
    columns: [
      t("id", "id"), n("seq", "seq"), ts("at", "at"), t("actorId", "actor_id"), t("actorRole", "actor_role"),
      t("action", "action"), t("resourceType", "resource_type"), t("resourceId", "resource_id"),
      t("leadId", "lead_id", true), { prop: "detail", col: "detail", kind: "json", nullable: true },
      t("prevHash", "prev_hash"), t("hash", "hash"),
    ],
  },
} satisfies Record<string, TableSpec>;

export type TableKey = keyof typeof TABLES;

const CAST: Record<Kind, string> = {
  text: "", int: "", bool: "", ts: "::timestamptz", date: "::date", jsonb: "::jsonb", json: "::json", textarr: "::text[]",
};

export function quote(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}

/** SELECT / RETURNING list. Dates are formatted in SQL so the driver's local-time Date parsing never applies. */
export function selectList(spec: TableSpec): string {
  return spec.columns
    .map((c) => (c.kind === "date" ? `to_char(${quote(c.col)}, 'YYYY-MM-DD') AS ${quote(c.col)}` : quote(c.col)))
    .join(", ");
}

/** Converts a TS value to a driver parameter (null for absent). */
export function toParam(c: ColumnSpec, v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (c.kind === "jsonb" || c.kind === "json") return JSON.stringify(v);
  return v;
}

export function placeholder(c: ColumnSpec, idx: number): string {
  return `$${idx}${CAST[c.kind]}`;
}

export function fromRow<T>(spec: TableSpec, row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const c of spec.columns) {
    const v = row[c.col];
    if (v === null || v === undefined) continue;
    switch (c.kind) {
      case "ts":
        out[c.prop] = v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();
        break;
      case "int":
        out[c.prop] = Number(v);
        break;
      default:
        out[c.prop] = v;
    }
  }
  return out as T;
}

export function columnFor(spec: TableSpec, prop: string): ColumnSpec {
  const c = spec.columns.find((x) => x.prop === prop);
  if (!c) throw new Error(`${spec.table}: unknown field "${prop}"`);
  return c;
}
