import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, chmodSync, chownSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { TABLES, type TableSpec } from "@/server/pg/mapping";
import { createPgDb, type PgDb, type PgSession } from "@/server/pg";
import { audit, verifyAuditChain } from "@/server/audit/log";
import { PgMfaStore } from "@/server/pg/mfa";
import { buildCaseView } from "@/server/portal/caseView";
import type {
  Activity, Assignment, Comment, Consult, CrmDelivery, DocumentRecord, Seminar, Engagement, Firm, Lawyer, Lead, Partner, PartnerGift, PartnerReferral, PaymentRecord, ConversionEvent, ReviewRequest, Person, Task, User,
} from "@/server/types";
import type { FeeRuleVersion, Invoice } from "@/server/fees/admin";
import type { BillableEvent } from "@/lib/fees";
import type { SequenceEnrollment, Suppression, TemplateApproval } from "@/server/nurture/types";
import type { PageApproval } from "@/server/types";
import type { AutomationState } from "@/server/db";
import type { FactVerification } from "@/lib/facts";
import { familyPlanBodySchema, summarizePlan } from "@/lib/familyPlan";
import type { FamilyPlan, FamilyPlanBodyRecord, PlanLinkUse, PlanMfaRecord, PlanSession, RetainerTemplate, SignatureRecord, StoredBlob } from "@/server/types";
import { configureFamilyPlan, consumeLink, saveOwnPlan } from "@/server/services/familyPlan";
import {
  deletePlanAccount, exportPlanAccount, listActivity, listDevices, regenerateRecoveryCodes, resolvePlanSession, revokePlanSession, verifyPlanSignIn,
} from "@/server/services/planAccount";
import { codeFor, signInPlan, useLink } from "./planSignIn";

const SCHEMA = readFileSync(join(__dirname, "../db/schema.sql"), "utf8");

// ---------------------------------------------------------------------------
// Mapping vs schema.sql (no database needed)
// ---------------------------------------------------------------------------
function parseTables(sql: string): Map<string, { col: string; type: string; nullable: boolean }[]> {
  const out = new Map<string, { col: string; type: string; nullable: boolean }[]>();
  const re = /CREATE TABLE (\w+) \(\n([\s\S]*?)\n\);/g;
  for (let m = re.exec(sql); m; m = re.exec(sql)) {
    const cols: { col: string; type: string; nullable: boolean }[] = [];
    for (const line of m[2].split("\n")) {
      const c = /^  (\w+)\s+(text\[\]|text|integer|bigint|boolean|timestamptz|date|jsonb|json)(?![\w\[])(.*)$/.exec(line);
      if (!c || ["CHECK", "UNIQUE", "PRIMARY"].includes(c[1].toUpperCase())) continue;
      const rest = c[3].toUpperCase();
      cols.push({ col: c[1], type: c[2], nullable: !rest.includes("NOT NULL") && !rest.includes("PRIMARY KEY") });
    }
    out.set(m[1], cols);
  }
  return out;
}

const KIND_FOR_TYPE: Record<string, string> = {
  text: "text", integer: "int", bigint: "int", boolean: "bool", timestamptz: "ts", date: "date", jsonb: "jsonb", json: "json", "text[]": "textarr",
};

describe("pg mapping covers schema.sql", () => {
  // user_mfa is read and written only by PgMfaStore (src/server/pg/mfa.ts), never through the Db mapping.
  const tables = new Map([...parseTables(SCHEMA)].filter(([t]) => t !== "user_mfa"));
  const specs = Object.values(TABLES) as TableSpec[];

  it("maps every table in the schema and no other", () => {
    expect(specs.map((s) => s.table).sort()).toEqual([...tables.keys()].sort());
  });

  for (const spec of specs) {
    it(`${spec.table}: columns, kinds and nullability match`, () => {
      const cols = tables.get(spec.table)!;
      expect(spec.columns.map((c) => c.col).sort()).toEqual(cols.map((c) => c.col).sort());
      for (const c of spec.columns) {
        const sc = cols.find((x) => x.col === c.col)!;
        expect(c.kind, `${spec.table}.${c.col} kind`).toBe(KIND_FOR_TYPE[sc.type]);
        // Columns that are NOT NULL with a default may be omitted in TS; those are not "nullable" here.
        expect(!!c.nullable, `${spec.table}.${c.col} nullable`).toBe(sc.nullable);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Fixtures: every TS field populated (Required<T> makes the compiler check coverage)
// ---------------------------------------------------------------------------
const T0 = "2026-10-06T12:00:00.123Z";
const FUTURE = new Date(Date.now() + 3600_000).toISOString();

const firm: Firm = { id: "f1", name: "Firm One", structure: "in_firm" };
const firm2: Firm = { id: "f2", name: "Firm Two", structure: "in_firm" };
const lawyer = (id: string, firmId: string): Required<Lawyer> => ({
  id, firmId, name: `Lawyer ${id}`, email: `${id}@x.test`, phone: "555", bio: "bio", licensedStates: ["CA", "NV"],
  matterTypes: ["new_plan", "elder_law"], specialties: ["tax"], languages: ["en", "es"], weeklyCapacity: 5,
  activeLeadCap: 10, acceptSlaMinutes: 30, office: { lat: 1.5, lng: -2.5 }, onCall: true, active: true,
  stats: { avgAcceptMinutes: 4, showRate: 0.8, reviewScore: 4.5 },
});
const person: Required<Person> = {
  id: "p1", firstName: "Ann", lastName: "Lee", email: "ann@x.test", phone: "555-0100", language: "en", state: "CA",
  county: "Marin", householdId: "h1",
};
const lead: Required<Lead> = {
  id: "l1", personId: "p1", createdAt: T0, stage: "offered",
  stageHistory: [{ stage: "new", at: T0, by: "system" }, { stage: "offered", at: T0, by: "u-intake" }],
  exit: { reason: "not_a_fit", at: T0, note: "n" }, matterType: "new_plan", state: "CA", county: "Marin", urgent: true,
  score: { score: 80, tier: "hot", grade: "A", urgent: true, components: [{ key: "matter", label: "Matter fit", points: 80 }], redFlags: ["a"], notFitReason: "none" }, segments: ["blended_family"],
  source: { utm_source: "google", utm_campaign: "x" },
  consent: {
    version: "v", smsConsent: true, smsConsentText: "t", acknowledgedNoRelationship: true, pageUrl: "/q", ip: null,
    userAgent: "ua", capturedAt: T0,
  },
  offerSummary: "A blended family wants a trust.",
  conflictCard: {
    clientName: "Ann Lee", parties: [{ name: "Bob Lee", relationship: "spouse" }], matterType: "new_plan", state: "CA",
    county: "Marin", clearance: "pending",
  },
  intake: {
    summary: "SECRET intake summary", goals: "g", redFlags: [], deadlines: [{ label: "x", date: "2026-11-01" }],
    household: { maritalStatus: "married", children: "yes", members: [{ name: "K", relationship: "child", age: 7 }] },
    assets: { range: "500k_1m", ownsHome: true, ownsBusiness: false, outOfStateProperty: true, outOfStateStates: ["NV"], retirementAccounts: true },
    answers: {}, existingDocuments: "none", consultAvailability: "evenings", needsInPerson: false,
    clientLocation: { lat: 3, lng: 4 },
  } as unknown as Lead["intake"],
  firmId: "f1", assignedLawyerId: "lw1", previousLawyerId: "lw2", requestedLawyerId: "lw1", clientChoiceLawyerIds: ["lw1", "lw2"],
  crmId: "crm-1", intakeOwnerId: "u-intake",
  capture: { tool: "estate-tax-calculator", resource: "guide", result: { a: 1, b: "x", c: true } }, priorTools: ["quiz"], visitorId: "v-1",
};
const offerLead: Lead = {
  ...lead, id: "l-offer", personId: "p2", firmId: undefined, assignedLawyerId: undefined, previousLawyerId: undefined,
  requestedLawyerId: undefined, clientChoiceLawyerIds: undefined, intakeOwnerId: undefined, state: "NV", urgent: false, county: undefined,
};
const user = (id: string, role: User["role"], more: Partial<User> = {}): Required<User> => ({
  id, email: `${id}@x.test`, name: id, role, firmId: "f1", lawyerId: "lw1", supportsLawyerIds: ["lw1"], personId: "p1", active: true, ...more,
});
const fixtures = {
  users: user("u-attorney", "attorney"),
  firms: firm,
  lawyers: lawyer("lw1", "f1"),
  persons: person,
  leads: lead,
  assignments: {
    id: "a1", leadId: "l1", lawyerId: "lw1", firmId: "f1", offeredAt: T0, expiresAt: FUTURE, status: "declined",
    respondedAt: T0, declineReason: "capacity", note: "n", slaMet: true, routingReason: "best fit",
  } satisfies Required<Assignment>,
  documents: {
    id: "d1", leadId: "l1", name: "will.pdf", kind: "existing_will", contentType: "application/pdf", sizeBytes: 12345,
    storageKey: "k", uploadedBy: "u1", uploadedAt: T0, scanStatus: "clean", visibility: "firm",
  } satisfies Required<DocumentRecord>,
  comments: {
    id: "c2", leadId: "l1", parentId: "c1", authorId: "u1", authorName: "U", body: "hi", visibility: "firm", mentions: ["u2"], createdAt: T0,
  } satisfies Required<Comment>,
  activities: {
    id: "ac1", leadId: "l1", kind: "call", direction: "inbound", at: T0, summary: "s", recordingUrl: "http://r", transcript: "t", byUserId: "u1",
  } satisfies Required<Activity>,
  consults: { id: "co1", leadId: "l1", lawyerId: "lw1", at: T0, type: "video", status: "held", outcome: "proposal", notes: "n" } satisfies Required<Consult>,
  engagements: {
    id: "e1", leadId: "l1", firmId: "f1", lawyerId: "lw1", packageId: "pk", feeCents: 250000, customScope: "cs", status: "approved",
    provider: "docusign", providerEnvelopeId: "env", letter: "L", approvedBy: "u1", approvedAt: T0,
    history: [{ status: "draft", at: T0 }], remindersSent: ["r1"], documentIds: ["d1"],
    packageSelection: { tierId: "complete", tierName: "Complete", tierPriceCents: 200000, addOns: [{ id: "pet_trust", name: "Pet trust", priceCents: 50000 }], totalCents: 250000 },
    paymentPlan: {
      mode: "plan", totalCents: 250000, account: "trust", activatedAt: T0,
      installments: [
        { n: 1, kind: "deposit", amountCents: 100000, dueOn: "2026-10-06", status: "paid", paymentId: "pay1", paidAt: T0 },
        { n: 2, kind: "installment", amountCents: 150000, dueOn: "2026-11-06", status: "late" },
      ],
    },
    templateId: "rt_1@1", spouseName: "Bob Lee",
    attachment: { name: "Standard terms.pdf", storageKey: "retainer-templates/f1/abc.pdf", sha256: "a".repeat(64), sizeBytes: 1234 },
    documentSha256: "d".repeat(64),
  } satisfies Required<Engagement>,
  retainerTemplates: {
    id: "rt_1@1", firmId: "f1", templateKey: "rt_1", version: 1, name: "Will package retainer", matterTypes: ["new_plan", "update_plan"],
    body: "Agreement for {{client_names}}", bodySha256: "b".repeat(64),
    pdf: { name: "Standard terms.pdf", storageKey: "retainer-templates/f1/abc.pdf", sha256: "a".repeat(64), sizeBytes: 1234 },
    status: "approved", defaultFor: ["new_plan"], createdBy: "u-attorney", createdAt: T0, approvedBy: "u-attorney", approvedByName: "Lawyer lw1", approvedAt: T0,
  } satisfies Required<RetainerTemplate>,
  signatures: {
    id: "sig1", engagementId: "e1", leadId: "l1", firmId: "f1", signerRole: "client", expectedName: "Ann Lee", typedName: "ann lee",
    signedByUserId: "u-client", signedAt: T0, ipPrefix: "203.0.113.0/24", userAgent: "Safari on iPhone", letterSha256: "c".repeat(64),
    attachmentSha256: "a".repeat(64), documentSha256: "d".repeat(64), consentVersion: "esign-consent-2026-10-v1", consentAt: T0, intent: true,
  } satisfies Required<SignatureRecord>,
  blobs: {
    id: "retainer-templates/f1/abc.pdf", sha256: "a".repeat(64), contentType: "application/pdf", sizeBytes: 9, data: Buffer.from("%PDF-1.4\n").toString("base64"),
    firmId: "f1", leadId: "l1", createdBy: "u-attorney", createdAt: T0,
  } satisfies Required<StoredBlob>,
  payments: {
    id: "pay1", engagementId: "e1", leadId: "l1", firmId: "f1", installmentNo: 1, amountCents: 100000, account: "trust", status: "paid",
    provider: "lawpay", providerPaymentId: "lp_1", linkUrl: "https://pay.example/lp_1", createdAt: T0, paidAt: T0,
    refunds: [{ id: "rf1", amountCents: 500, at: T0, reason: "adjustment" }],
  } satisfies Required<PaymentRecord>,
  tasks: { id: "t1", leadId: "l1", title: "call", ownerId: "u1", dueAt: T0, doneAt: T0 } satisfies Required<Task>,
  feeRuleVersions: {
    id: "r1@1", ruleId: "r1", version: 1,
    rule: { id: "r1", feeType: "percent_of_fee", percent: 50, capCents: 1_000_000, state: "CA", lawyerId: "lw1", effectiveFrom: "2026-01-01", effectiveTo: "2027-01-01", counselApprovedAt: "2026-02-01" },
    editedBy: "u1", editedAt: T0, reason: "init", billable: false, lockReason: "locked", counsel: { name: "C", opinionRef: "O-1" },
  } satisfies Required<FeeRuleVersion>,
  billableEvents: { id: "be1", type: "fee_collected", occurredAt: T0, state: "CA", lawyerId: "lw1", amountCents: 9_000_000_000 } satisfies Required<BillableEvent>,
  invoices: {
    id: "inv1", firmId: "f1", periodStart: "2026-09-01", periodEnd: "2026-10-01", structure: "in_firm",
    lines: [{ ruleId: "r1", eventId: "be1", feeType: "percent_of_fee", amountCents: 5, ruleVersionId: "r1@1" }], totalCents: 5,
    blockedRules: [{ ruleId: "r2", reason: "x" }], status: "approved", createdAt: T0, createdBy: "u1", approvedBy: "u2",
    credits: [{ eventId: "be1", reason: "r", amountCents: 1 }],
  } satisfies Required<Invoice>,
  enrollments: {
    id: "en1", leadId: "l1", sequenceId: "s1", enrolledAt: T0, status: "stopped", stoppedReason: "replied", sentStepIds: ["a", "b"],
    skipped: [{ stepId: "b", reason: "no sms", at: T0 }],
  } satisfies Required<SequenceEnrollment>,
  suppressions: { id: "email:a@x.test", channel: "email", address: "a@x.test", reason: "STOP", at: T0 } satisfies Required<Suppression>,
  factVerifications: { id: "state.CA.small_estate_threshold@1", factId: "state.CA.small_estate_threshold", version: 1, approvedValue: "$208,850", approvedBy: "u-admin", approvedAt: T0, note: "checked" } satisfies Required<FactVerification>,
  templateApprovals: { id: "qz_1_results@1", templateKey: "qz_1_results", version: 1, contentHash: "a".repeat(64), approvedBy: "u-admin", approvedAt: T0, note: "checked" } satisfies Required<TemplateApproval>,
  pageApprovals: {
    id: "pa_1", path: "/guides/what-is-a-will", file: "content/guides/what-is-a-will.md", contentHash: "b".repeat(64), tier: "low",
    approvedBy: "u-admin", approverRole: "platform_admin", approverName: "Admin", approvedAt: T0, note: "checked", batchId: "batch_1",
    prUrl: "https://github.com/o/r/pull/1", editedFromHash: "c".repeat(64),
  } satisfies Required<PageApproval>,
  crmDeliveries: {
    id: "l1", leadId: "l1", event: "lead.created", status: "failed", httpStatus: 503, attempts: 3, error: "HTTP 503",
    createdAt: T0, updatedAt: T0, lastAttemptAt: T0, deliveredAt: T0,
  } satisfies Required<CrmDelivery>,
  seminars: {
    id: "sem1", code: "trusts101-oct", title: "Trusts 101", format: "library_talk", heldOn: "2026-10-20", venue: "Main library",
    costs: { venue: 0, mail: 45000 }, mailPieces: 500, rsvps: 30, attendees: 21, notes: "n", createdBy: "u-admin", createdAt: T0, updatedAt: T0,
  } satisfies Required<Seminar>,
  partners: {
    id: "pt1", slug: "example-cpa", name: "Jordan Example", org: "Example CPA PLLC", type: "cpa", refCode: "ref-example-cpa",
    status: "active", ownerId: "u-attorney", firmId: "f1", createdAt: T0, policySignedDate: "2026-10-07",
    reciprocalAgreementOnFile: true, agreementNonexclusive: true, notes: "n",
  } satisfies Required<Partner>,
  partnerGifts: {
    id: "pg1", partnerId: "pt1", date: "2026-12-01", description: "Holiday card", valueCents: 500, status: "flagged",
    flags: ["f"], loggedBy: "u1", reviewNote: "ok",
  } satisfies Required<PartnerGift>,
  partnerReferrals: {
    id: "pr1", partnerId: "pt1", refCode: "ref-example-cpa", leadId: "l1", createdAt: T0, origin: "partner_form", clientConsent: true,
    disclosureGiven: true, disclosureAt: T0, disclosureVersion: "v1", releaseStatus: "granted", releaseUpdatedAt: T0,
    releaseUpdatedBy: "u1", valueLinked: "no", valueNote: "n",
  } satisfies Required<PartnerReferral>,
  conversionEvents: {
    id: "google_ads:retainer_signed:l1", leadId: "l1", provider: "google_ads", type: "retainer_signed", eventId: "ep-l1-retainer_signed",
    occurredAt: T0, valueCents: 250000, currency: "USD", status: "failed", reason: "HTTP 503", attempts: 2, channel: "api",
    createdAt: T0, updatedAt: T0, sentAt: T0,
  } satisfies Required<ConversionEvent>,
  reviewRequests: {
    id: "review-l1", leadId: "l1", matterType: "new_plan", anchorAt: T0, eligible: false, exclusionCode: "UNIFORM_HOLD", exclusionNote: "n",
    askedAt: T0, remindedAt: T0, reminderChannel: "sms", optedOutAt: T0, postedAt: T0, createdAt: T0,
  } satisfies Required<ReviewRequest>,
  automationState: { id: "automation", cursorSeq: 42, stages: { l1: "offered" }, exits: { l1: "x" } } satisfies Required<AutomationState>,
  familyPlans: {
    id: "fp_1", emailHash: "h".repeat(64), leadId: "l1", summary: summarizePlan(familyPlanBodySchema.parse({ people: { childrenStatus: "minors" } }), 2026),
    sectionsDone: 0, gapCount: 1, consent: { version: "family-plan-2026-10", at: T0 }, prefilledFrom: ["lead"], createdAt: T0, updatedAt: T0,
  } satisfies Required<FamilyPlan>,
  familyPlanBodies: { id: "fp_1", ciphertext: "v1.iv.tag.ct", updatedAt: T0 } satisfies Required<FamilyPlanBodyRecord>,
  planLinkUses: { id: "jti-fixture", usedAt: T0 } satisfies Required<PlanLinkUse>,
  planMfa: {
    id: "fp_1", totpSecretEnc: "v1.iv.tag.ct", pendingSecretEnc: "v1.iv2.tag2.ct2", lastUsedStep: 59_000_000, recoveryCodeHashes: ["salt:hash", "salt2:hash2"],
    enrolledAt: T0, failedAttempts: 1, lockedUntil: T0, createdAt: T0, updatedAt: T0,
  } satisfies Required<PlanMfaRecord>,
  planSessions: {
    id: "a".repeat(64), planId: "fp_1", createdAt: T0, lastSeenAt: T0, expiresAt: T0, userAgent: "Safari on iPhone", ipPrefix: "203.0.113.0/24", viaRecoveryCode: true,
  } satisfies Required<PlanSession>,
};

describe("every TS field maps to a column", () => {
  for (const [key, fx] of Object.entries(fixtures)) {
    it(key, () => {
      const spec = (TABLES as Record<string, TableSpec>)[key];
      expect(Object.keys(fx).sort()).toEqual(spec.columns.map((c) => c.prop).filter((p) => p in fx).sort());
      // props the fixture doesn't have must not exist in the mapping
      expect(spec.columns.map((c) => c.prop).sort()).toEqual(Object.keys(fx).sort());
    });
  }
});

// ---------------------------------------------------------------------------
// Throwaway Postgres cluster
// ---------------------------------------------------------------------------
const PGBIN = "/usr/lib/postgresql/16/bin";
let cluster: { dir: string; stop: () => void } | undefined;
let pgConfig: { connectionString?: string; host?: string; port?: number; user?: string; database?: string } | undefined;
let skipReason = "";

function startCluster(): void {
  if (process.env.PG_TEST_URL) {
    pgConfig = { connectionString: process.env.PG_TEST_URL };
    return;
  }
  if (!existsSync(`${PGBIN}/initdb`)) {
    skipReason = "no PG_TEST_URL and no postgres binaries";
    return;
  }
  const isRoot = process.getuid?.() === 0;
  let uid: number | undefined;
  if (isRoot) {
    const r = spawnSync("id", ["-u", "postgres"], { encoding: "utf8" });
    if (r.status !== 0) {
      skipReason = "running as root and no postgres user to run initdb";
      return;
    }
    uid = Number(r.stdout.trim());
  }
  const run = (cmd: string, args: string[]) =>
    isRoot ? execFileSync("runuser", ["-u", "postgres", "--", cmd, ...args], { stdio: "pipe" }) : execFileSync(cmd, args, { stdio: "pipe" });

  let base = tmpdir();
  let dir = mkdtempSync(join(base, "ep-pg-"));
  if (uid !== undefined) {
    chownSync(dir, uid, 0);
    chmodSync(dir, 0o700);
    if (spawnSync("runuser", ["-u", "postgres", "--", "test", "-x", dir]).status !== 0) {
      rmSync(dir, { recursive: true, force: true });
      base = "/tmp";
      dir = mkdtempSync(join(base, "ep-pg-"));
      chownSync(dir, uid, 0);
      chmodSync(dir, 0o700);
    }
  }
  const data = join(dir, "data");
  const port = 41000 + Math.floor(Math.random() * 20000);
  run(`${PGBIN}/initdb`, ["-D", data, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--no-sync"]);
  run(`${PGBIN}/pg_ctl`, [
    "-D", data, "-w", "-l", join(dir, "log"), "-o", `-p ${port} -k ${dir} -c listen_addresses= -c fsync=off`, "start",
  ]);
  cluster = {
    dir,
    stop: () => {
      try {
        run(`${PGBIN}/pg_ctl`, ["-D", data, "-m", "immediate", "stop"]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
  pgConfig = { host: dir, port, user: "postgres", database: "postgres" };
}

let admin: Pool; // superuser, for seeding schema and raw checks
let pool: Pool;
let service: PgDb;
const as = (s: PgSession) => createPgDb({ pool, session: s });
const platformRead = () => as({ userId: "u-admin", role: "platform_admin" });
const platformDb = {
  get feeRuleVersions() { return as({ userId: "u-admin", role: "platform_admin" }).feeRuleVersions; },
  get factVerifications() { return as({ userId: "u-admin", role: "platform_admin" }).factVerifications; },
  get templateApprovals() { return as({ userId: "u-admin", role: "platform_admin" }).templateApprovals; },
  get pageApprovals() { return as({ userId: "u-admin", role: "platform_admin" }).pageApprovals; },
};

beforeAll(async () => {
  try {
    startCluster();
  } catch (e) {
    skipReason = `could not start postgres: ${(e as Error).message}`;
  }
  if (!pgConfig) return;
  admin = new Pool({ ...pgConfig, max: 2 });
  await admin.query(SCHEMA);
  pool = new Pool({ ...pgConfig, max: 8 });
  service = createPgDb({ pool, session: "service" });
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await admin?.end();
  cluster?.stop();
});

const dbAvailable = () => !!pgConfig;
function suite(name: string, fn: () => void) {
  describe(name, () => {
    fn();
  });
}

suite("postgres integration", () => {
  const maybe = (name: string, fn: () => Promise<void>) =>
    it(name, async (ctx) => {
      if (!dbAvailable()) return ctx.skip();
      await fn();
    });

  maybe("seeds every collection with fully populated objects and reads them back unchanged", async () => {
    await service.firms.insert(firm);
    await service.firms.insert(firm2);
    await service.lawyers.insert(lawyer("lw1", "f1"));
    await service.lawyers.insert(lawyer("lw2", "f2"));
    await service.persons.insert(person);
    await service.persons.insert({ ...person, id: "p2", email: "p2@x.test", householdId: undefined });
    await service.users.insert(fixtures.users);
    await service.users.insert({ id: "u-intake", email: "intake@x.test", name: "Intake", role: "intake", active: true });
    await service.leads.insert(lead);
    await service.leads.insert(offerLead);
    await service.comments.insert({ ...fixtures.comments, id: "c1", parentId: undefined });
    for (const [key, fx] of Object.entries(fixtures)) {
      const coll = (service as unknown as Record<string, { get(id: string): Promise<unknown>; insert(x: unknown): Promise<unknown> }>)[key];
      if (!["users", "firms", "lawyers", "persons", "leads"].includes(key)) {
        // fee rules and fact approvals are written in a platform admin session only; app_service can read them
        await (key === "feeRuleVersions" ? platformDb.feeRuleVersions : key === "factVerifications" ? platformDb.factVerifications : key === "templateApprovals" ? platformDb.templateApprovals : key === "pageApprovals" ? platformDb.pageApprovals : coll).insert(fx as never);
      }
      expect(await coll.get((fx as { id: string }).id), key).toEqual(fx);
    }
  });

  maybe("lead nested jsonb survives update and patch semantics", async () => {
    const updated = await service.leads.update("l1", {
      stage: "accepted",
      exit: undefined,
      stageHistory: [...lead.stageHistory, { stage: "accepted", at: T0, by: "x" }],
      intake: { ...lead.intake, redFlags: ["flag"] },
    });
    expect(updated.stage).toBe("accepted");
    expect(updated.exit).toBeUndefined();
    expect(updated.stageHistory).toHaveLength(3);
    expect(updated.intake.household.members[0].age).toBe(7);
    expect(updated.createdAt).toBe(T0);
    await expect(service.leads.update("nope", { urgent: true })).rejects.toThrow(/not found/);
    await expect(service.leads.insert({ ...lead, id: "x", bogus: 1 } as unknown as Lead)).rejects.toThrow(/unknown field/);
    await service.leads.update("l1", { stage: "offered", exit: lead.exit, stageHistory: lead.stageHistory, intake: lead.intake });
  });

  maybe("fee rule versions: roundtrip, immutable", async () => {
    const v = await service.feeRuleVersions.get("r1@1");
    expect(v?.rule.percent).toBe(50);
    await expect(service.feeRuleVersions.update("r1@1", { reason: "x" })).rejects.toThrow();
    const platform = as({ userId: "u-admin", role: "platform_admin" });
    expect((await platform.feeRuleVersions.list(undefined, { ruleId: "r1" })).length).toBe(1);
    await platform.feeRuleVersions.insert({ ...fixtures.feeRuleVersions, id: "r1@2", version: 2, counsel: undefined, lockReason: undefined });
    expect((await platform.feeRuleVersions.get("r1@2"))?.counsel).toBeUndefined();
  });

  maybe("fact verifications: attorneys and admins approve as themselves, others see nothing, rows are immutable", async () => {
    const attorney = as({ userId: "u-attorney", role: "attorney", firmId: "f1", lawyerId: "lw1" });
    const next = { ...fixtures.factVerifications, id: "state.CA.small_estate_threshold@2", version: 2, approvedBy: "u-attorney" };
    await attorney.factVerifications.insert(next);
    // cannot approve in someone else's name
    await expect(attorney.factVerifications.insert({ ...next, id: "state.CA.small_estate_threshold@3", version: 3, approvedBy: "u-admin" })).rejects.toThrow();
    // one row per (fact, version)
    await expect(service.factVerifications.insert({ ...next, id: "dup" })).rejects.toThrow();
    expect((await attorney.factVerifications.list()).map((v) => v.version).sort()).toEqual([1, 2]);
    for (const role of ["intake", "marketing", "firm_admin", "paralegal"] as const) {
      const s = as({ userId: `u-${role}`, role, firmId: "f1", lawyerId: "lw1", supportsLawyerIds: ["lw1"] });
      expect(await s.factVerifications.list(), role).toEqual([]);
      await expect(s.factVerifications.insert({ ...next, id: `x-${role}@9`, factId: `x-${role}`, version: 9, approvedBy: `u-${role}` }), role).rejects.toThrow();
    }
    await expect(service.factVerifications.update(next.id, { note: "edited" })).rejects.toThrow();
  });

  maybe("template approvals: attorneys and admins approve as themselves, others see nothing, rows are immutable", async () => {
    const attorney = as({ userId: "u-attorney", role: "attorney", firmId: "f1", lawyerId: "lw1" });
    const next = { ...fixtures.templateApprovals, id: "qz_1_results@2", version: 2, approvedBy: "u-attorney" };
    await attorney.templateApprovals.insert(next);
    // cannot approve in someone else's name
    await expect(attorney.templateApprovals.insert({ ...next, id: "qz_1_results@3", version: 3, approvedBy: "u-admin" })).rejects.toThrow();
    // one row per (template, version)
    await expect(service.templateApprovals.insert({ ...next, id: "dup" })).rejects.toThrow();
    expect((await attorney.templateApprovals.list(undefined, { templateKey: "qz_1_results" })).map((v) => v.version).sort()).toEqual([1, 2]);
    // the sender reads approvals through the service role but cannot write them
    expect((await service.templateApprovals.list()).length).toBe(2);
    await expect(service.templateApprovals.insert({ ...next, id: "svc@1", templateKey: "svc", version: 1 })).rejects.toThrow();
    for (const role of ["intake", "marketing", "firm_admin", "paralegal"] as const) {
      const s = as({ userId: `u-${role}`, role, firmId: "f1", lawyerId: "lw1", supportsLawyerIds: ["lw1"] });
      expect(await s.templateApprovals.list(), role).toEqual([]);
      await expect(s.templateApprovals.insert({ ...next, id: `x-${role}@9`, templateKey: `x-${role}`, version: 9, approvedBy: `u-${role}` }), role).rejects.toThrow();
    }
    await expect(service.templateApprovals.update(next.id, { note: "edited" })).rejects.toThrow();
  });

  maybe("page approvals: attorneys and admins approve as themselves in their own role, others see nothing, rows are immutable", async () => {
    const attorney = as({ userId: "u-attorney", role: "attorney", firmId: "f1", lawyerId: "lw1" });
    const next: PageApproval = {
      ...fixtures.pageApprovals, id: "pa_2", contentHash: "d".repeat(64), approvedBy: "u-attorney", approverRole: "attorney",
      approverName: "Avery", prUrl: undefined, editedFromHash: undefined,
    };
    await attorney.pageApprovals.insert(next);
    expect(await attorney.pageApprovals.get("pa_2")).toEqual(next);
    // cannot approve in someone else's name, or claim another role
    await expect(attorney.pageApprovals.insert({ ...next, id: "pa_3", contentHash: "e".repeat(64), approvedBy: "u-admin" })).rejects.toThrow();
    await expect(attorney.pageApprovals.insert({ ...next, id: "pa_4", contentHash: "f".repeat(64), approverRole: "platform_admin" })).rejects.toThrow();
    // one approval per (path, content hash)
    await expect(attorney.pageApprovals.insert({ ...next, id: "pa_dup" })).rejects.toThrow();
    // the service role reads approvals but cannot write them
    expect((await service.pageApprovals.list()).length).toBe(2);
    await expect(service.pageApprovals.insert({ ...next, id: "svc", contentHash: "9".repeat(64) })).rejects.toThrow();
    for (const role of ["intake", "marketing", "firm_admin", "paralegal", "client"] as const) {
      const s = as({ userId: `u-${role}`, role, firmId: "f1", lawyerId: "lw1", supportsLawyerIds: ["lw1"] });
      expect(await s.pageApprovals.list(), role).toEqual([]);
      await expect(s.pageApprovals.insert({ ...next, id: `x-${role}`, contentHash: `${role}`.padEnd(64, "0"), approvedBy: `u-${role}`, approverRole: role }), role).rejects.toThrow();
    }
    await expect(service.pageApprovals.update(next.id, { note: "edited" })).rejects.toThrow();
    await expect(attorney.pageApprovals.update(next.id, { note: "edited" })).rejects.toThrow();
  });

  maybe("retainer templates: each firm sees and writes only its own; only its attorney approves, as themselves; wording is immutable", async () => {
    const attorney = as({ userId: "u-attorney", role: "attorney", firmId: "f1", lawyerId: "lw1" });
    const firmAdmin = as({ userId: "u-fa", role: "firm_admin", firmId: "f1" });
    const otherAttorney = as({ userId: "u-other", role: "attorney", firmId: "f2", lawyerId: "lw2" });
    const otherAdmin = as({ userId: "u-fa2", role: "firm_admin", firmId: "f2" });
    const draft: RetainerTemplate = {
      ...fixtures.retainerTemplates, id: "rt_1@2", version: 2, status: "draft", defaultFor: [], createdBy: "u-fa",
      approvedBy: undefined, approvedByName: undefined, approvedAt: undefined, pdf: undefined,
    };
    await firmAdmin.retainerTemplates.insert(draft);
    // another firm sees nothing and cannot write into this firm
    expect(await otherAttorney.retainerTemplates.list()).toEqual([]);
    expect(await otherAdmin.retainerTemplates.get("rt_1@1")).toBeUndefined();
    await expect(otherAdmin.retainerTemplates.insert({ ...draft, id: "rt_x@1", templateKey: "rt_x", version: 1, createdBy: "u-fa2" })).rejects.toThrow();
    await expect(otherAttorney.retainerTemplates.update("rt_1@2", { status: "retired" })).rejects.toThrow(/not found or not permitted/);
    // paralegals, intake, marketing, clients: no writes; only same-firm paralegals read
    expect((await as({ userId: "u-p", role: "paralegal", firmId: "f1", supportsLawyerIds: ["lw1"] }).retainerTemplates.list()).length).toBe(2);
    for (const role of ["intake", "marketing", "client"] as const) {
      const s = as({ userId: `u-${role}`, role, firmId: "f1", personId: "p1" });
      expect(await s.retainerTemplates.list(), role).toEqual([]);
    }
    // nobody inserts an already-approved row in a user session
    await expect(attorney.retainerTemplates.insert({ ...fixtures.retainerTemplates, id: "rt_1@9", version: 9, createdBy: "u-attorney" })).rejects.toThrow();
    // a firm admin cannot approve; an attorney cannot approve in someone else's name
    await expect(firmAdmin.retainerTemplates.update("rt_1@2", { status: "approved", approvedBy: "u-fa", approvedAt: T0 })).rejects.toThrow(/attorney/);
    await expect(attorney.retainerTemplates.update("rt_1@2", { status: "approved", approvedBy: "u-admin", approvedAt: T0 })).rejects.toThrow(/attorney/);
    // the wording of a saved version never changes, not even for the service role
    await expect(attorney.retainerTemplates.update("rt_1@2", { body: "changed" })).rejects.toThrow(/new version/);
    await expect(service.retainerTemplates.update("rt_1@1", { body: "changed" })).rejects.toThrow(/new version/);
    await expect(service.retainerTemplates.remove("rt_1@1")).rejects.toThrow();
    const approved = await attorney.retainerTemplates.update("rt_1@2", { status: "approved", approvedBy: "u-attorney", approvedByName: "Lawyer lw1", approvedAt: T0 });
    expect(approved.status).toBe("approved");
    // status only moves forward
    await expect(attorney.retainerTemplates.update("rt_1@2", { status: "draft" })).rejects.toThrow(/cannot move/);
    await attorney.retainerTemplates.update("rt_1@1", { status: "superseded" });
    expect((await platformRead().retainerTemplates.list()).length).toBe(2);
  });

  maybe("signature records and stored blobs are insert-only; clients read their own signatures, nobody reads blobs directly", async () => {
    await expect(service.signatures.update("sig1", { typedName: "someone else" })).rejects.toThrow(/permission denied/);
    // even the table owner is stopped by the trigger
    await expect(admin.query("UPDATE engagement_signatures SET typed_name = 'x'")).rejects.toThrow(/append-only/);
    await expect(admin.query("DELETE FROM stored_blobs")).rejects.toThrow(/append-only/);
    await expect(service.signatures.remove("sig1")).rejects.toThrow(/permission denied/);
    await expect(service.signatures.insert({ ...fixtures.signatures, id: "sig-dup" })).rejects.toThrow(); // one per signer role
    await expect(service.blobs.update("retainer-templates/f1/abc.pdf", { data: "eA==" })).rejects.toThrow(/permission denied/);
    const attorney = as({ userId: "u-attorney", role: "attorney", firmId: "f1", lawyerId: "lw1" });
    expect((await attorney.signatures.list()).map((s) => s.id)).toEqual(["sig1"]);
    await expect(attorney.signatures.insert({ ...fixtures.signatures, id: "sig2", signerRole: "spouse" })).rejects.toThrow();
    const client = as({ userId: "u-client", role: "client", personId: "p1" });
    expect((await client.signatures.list()).map((s) => s.id)).toEqual(["sig1"]);
    const otherClient = as({ userId: "u-c2", role: "client", personId: "p2" });
    expect(await otherClient.signatures.list()).toEqual([]);
    const other = as({ userId: "u-other", role: "attorney", firmId: "f2", lawyerId: "lw2" });
    expect(await other.signatures.list()).toEqual([]);
    for (const s of [attorney, client, as({ userId: "u-admin", role: "platform_admin" })]) {
      await expect(s.blobs.list()).rejects.toThrow(); // no grant at all for app_user
    }
    expect((await service.blobs.get("retainer-templates/f1/abc.pdf"))?.sha256).toBe("a".repeat(64));
  });

  maybe("where pushdown", async () => {
    expect((await service.leads.list(undefined, { state: "NV" })).map((l) => l.id)).toEqual(["l-offer"]);
    expect((await service.leads.list(undefined, { county: null })).map((l) => l.id)).toEqual(["l-offer"]);
    expect((await service.leads.list(undefined, { state: "CA", urgent: true })).map((l) => l.id)).toEqual(["l1"]);
    expect(await service.leads.list(undefined, { state: "ZZ" })).toEqual([]);
    expect((await service.leads.list((l) => l.id === "l1", { state: "CA" })).length).toBe(1);
    await expect(service.leads.list(undefined, { nope: 1 })).rejects.toThrow(/unknown field/);
    await expect(service.leads.list(undefined, { stageHistory: "x" })).rejects.toThrow(/scalar/);
    expect((await service.invoices.get("inv1"))?.periodStart).toBe("2026-09-01");
  });

  maybe("RLS: offer-stage attorney, other attorney, intake, marketing", async () => {
    await service.assignments.insert({
      id: "a-offer", leadId: "l-offer", lawyerId: "lw1", firmId: "f1", offeredAt: T0, expiresAt: FUTURE, status: "offered", routingReason: "x",
    });
    const attorney = as({ userId: "u-attorney", role: "attorney", firmId: "f1", lawyerId: "lw1" });
    expect(await attorney.leads.get("l-offer")).toBeUndefined();
    const card = await attorney.leadOfferCard("l-offer");
    expect(card?.offerSummary).toBe(lead.offerSummary);
    expect(card?.conflictCard.clientName).toBe("Ann Lee");
    expect(card).not.toHaveProperty("intake");
    expect((await attorney.leadOfferCards()).map((c) => c.id)).toEqual(["l-offer"]);
    expect(await attorney.persons.get("p2")).toBeUndefined();

    const other = as({ userId: "u-other", role: "attorney", firmId: "f2", lawyerId: "lw2" });
    expect(await other.leads.get("l-offer")).toBeUndefined();
    expect(await other.leadOfferCard("l-offer")).toBeUndefined();
    expect(await other.leads.list()).toEqual([]);

    const intake = as({ userId: "u-intake", role: "intake" });
    expect((await intake.leads.get("l-offer"))?.intake.summary).toBe("SECRET intake summary");
    expect(await intake.documents.list()).toEqual([]);
    expect((await intake.leads.list()).length).toBe(2); // l1 is owned by u-intake, l-offer unclaimed

    const marketing = as({ userId: "u-mkt", role: "marketing" });
    expect(await marketing.leads.list()).toEqual([]);
    expect(await marketing.leads.get("l1")).toBeUndefined();

    // accepted lead: assigned attorney sees everything incl. documents; unassigned attorney does not
    await service.leads.update("l-offer", { firmId: "f1", assignedLawyerId: "lw1" });
    expect((await attorney.leads.get("l-offer"))?.id).toBe("l-offer");
    expect(await other.leads.get("l-offer")).toBeUndefined();
    // a write the policy rejects throws
    await expect(attorney.leads.insert({ ...offerLead, id: "l-x" })).rejects.toThrow();
    // no session settings = nobody
    const nobody = as({ userId: "", role: "client" });
    expect(await nobody.leads.list()).toEqual([]);
  });

  maybe("audit appendWith: 10 concurrent appends keep one valid hash chain", async () => {
    const intake = as({ userId: "u-intake", role: "intake" });
    const calls = Array.from({ length: 10 }, (_, i) =>
      audit(i % 2 ? intake : service, i % 2 ? { userId: "u-intake", role: "intake" } : "system", {
        action: `test.${i}`, resourceType: "lead", resourceId: "l1", leadId: "l1",
        detail: { zeta: i, alpha: { y: 1, x: 2 }, list: [3, 1, 2], bb: "b", a: "a" },
      }),
    );
    const out = await Promise.all(calls);
    expect(out.map((e) => e.seq).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const all = await service.audit.list();
    expect(all).toHaveLength(10);
    expect(verifyAuditChain(all)).toEqual({ ok: true });
    expect(all[0].detail).toEqual({ zeta: expect.any(Number), alpha: { y: 1, x: 2 }, list: [3, 1, 2], bb: "b", a: "a" });
    expect((await service.audit.last())?.seq).toBe(10);
    expect(await service.audit.list(undefined, { leadId: "l1" })).toHaveLength(10);
  });

  maybe("case view through an offer-stage attorney's session shows only the conflict card", async () => {
    await service.leads.insert({ ...offerLead, id: "l-card", firmId: undefined, assignedLawyerId: undefined });
    await service.assignments.insert({
      id: "a-card", leadId: "l-card", lawyerId: "lw1", firmId: "f1", offeredAt: T0, expiresAt: FUTURE, status: "offered", routingReason: "x",
    });
    const actor = { userId: "u-attorney", role: "attorney" as const, firmId: "f1", lawyerId: "lw1", mfa: true };
    const attorney = as({ userId: actor.userId, role: actor.role, firmId: actor.firmId, lawyerId: actor.lawyerId });
    const view = await buildCaseView(attorney, actor, "l-card");
    expect(view.access).toBe("conflict_card");
    expect(Object.keys(view.sections).sort()).toEqual(["conflict", "summary"]);
    expect(view.header.offerAssignmentId).toBe("a-card");
    expect(JSON.stringify(view)).not.toContain("SECRET");
    const other = as({ userId: "u-other", role: "attorney", firmId: "f2", lawyerId: "lw2" });
    await expect(buildCaseView(other, { ...actor, userId: "u-other", firmId: "f2", lawyerId: "lw2" }, "l-card")).rejects.toThrow();
  });

  maybe("MFA secrets are stored encrypted and only the service role can read them", async () => {
    const store = new PgMfaStore(pool);
    await store.put("u-intake", { totpSecret: "JBSWY3DPEHPK3PXP", lastUsedStep: 7, recoveryCodeHashes: ["h1", "h2"], enrolledAt: T0 });
    expect(await store.get("u-intake")).toEqual({ totpSecret: "JBSWY3DPEHPK3PXP", lastUsedStep: 7, recoveryCodeHashes: ["h1", "h2"], enrolledAt: T0 });
    await store.put("u-intake", { totpSecret: "JBSWY3DPEHPK3PXP", lastUsedStep: 8, recoveryCodeHashes: ["h2"], enrolledAt: T0 });
    expect((await store.get("u-intake"))?.lastUsedStep).toBe(8);
    expect(await store.get("nobody")).toBeNull();
    const raw = await admin.query("SELECT totp_secret_enc FROM user_mfa WHERE user_id = 'u-intake'");
    expect(raw.rows[0].totp_secret_enc).not.toContain("JBSWY3DP");
    const c = await admin.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE app_user");
      await expect(c.query("SELECT * FROM user_mfa")).rejects.toThrow(/permission denied/);
    } finally {
      await c.query("ROLLBACK");
      c.release();
    }
  });

  maybe("crm_deliveries: admins read (firm admins only their leads), nobody else, app_user cannot write", async () => {
    // l1 belongs to f1 and is assigned; the seeding test already inserted the delivery for it.
    await service.crmDeliveries.insert({ ...fixtures.crmDeliveries, id: "ghost", leadId: "no-such-lead" });
    const ids = async (s: PgSession) => (await as(s).crmDeliveries.list()).map((d) => d.id).sort();
    expect(await ids({ userId: "u-admin", role: "platform_admin" })).toEqual(["ghost", "l1"]);
    expect(await ids({ userId: "u-fa", role: "firm_admin", firmId: "f1" })).toEqual(["l1"]);
    expect(await ids({ userId: "u-fa2", role: "firm_admin", firmId: "f2" })).toEqual([]);
    expect(await ids({ userId: "u-m", role: "marketing" })).toEqual([]);
    expect(await ids({ userId: "u-i", role: "intake" })).toEqual([]);
    await expect(as({ userId: "u-admin", role: "platform_admin" }).crmDeliveries.update("l1", { status: "delivered" })).rejects.toThrow();
    await expect(as({ userId: "u-admin", role: "platform_admin" }).crmDeliveries.insert({ ...fixtures.crmDeliveries, id: "x" })).rejects.toThrow();
    const updated = await service.crmDeliveries.update("l1", { status: "delivered", error: undefined, httpStatus: 200 });
    expect(updated.error).toBeUndefined();
  });

  maybe("RLS: seminars are marketing and platform admin data only", async () => {
    const marketing = as({ userId: "u-mkt", role: "marketing" });
    const attorney = as({ userId: "u-attorney", role: "attorney", firmId: "f1", lawyerId: "lw1" });
    const sem = { ...fixtures.seminars, id: "sem-rls", code: "rls-test" };
    await marketing.seminars.insert(sem);
    expect((await marketing.seminars.get("sem-rls"))?.code).toBe("rls-test");
    expect(await attorney.seminars.list()).toEqual([]);
    await expect(attorney.seminars.insert({ ...sem, id: "sem-x", code: "x-test" })).rejects.toThrow();
    await expect(service.seminars.insert({ ...sem, id: "sem-dup" })).rejects.toThrow(); // code is unique
  });

  maybe("partners: admins read and write their firm's partners, gifts are insert-only, nobody else sees them", async () => {
    await service.partners.insert({ ...fixtures.partners, id: "pt2", slug: "other", refCode: "ref-other", firmId: "f2", ownerId: undefined });
    const ids = async (s: PgSession) => (await as(s).partners.list()).map((p) => p.id).sort();
    expect(await ids({ userId: "u-admin", role: "platform_admin" })).toEqual(["pt1", "pt2"]);
    expect(await ids({ userId: "u-fa", role: "firm_admin", firmId: "f1" })).toEqual(["pt1"]);
    for (const role of ["marketing", "intake", "attorney", "paralegal", "client"] as const) {
      expect(await ids({ userId: `u-${role}`, role, firmId: "f1" }), role).toEqual([]);
      expect(await (as({ userId: `u-${role}`, role, firmId: "f1" }).partnerReferrals.list()), role).toEqual([]);
      expect(await (as({ userId: `u-${role}`, role, firmId: "f1" }).partnerGifts.list()), role).toEqual([]);
    }
    const fa = as({ userId: "u-fa", role: "firm_admin", firmId: "f1" });
    expect((await fa.partnerGifts.list()).map((g) => g.id)).toEqual(["pg1"]);
    expect((await fa.partnerReferrals.list()).map((r) => r.id)).toEqual(["pr1"]);
    await fa.partnerGifts.insert({ ...fixtures.partnerGifts, id: "pg2" });
    await expect(fa.partnerGifts.update("pg2", { valueCents: 1 })).rejects.toThrow();
    await expect(as({ userId: "u-fa2", role: "firm_admin", firmId: "f2" }).partnerGifts.insert({ ...fixtures.partnerGifts, id: "pg3" })).rejects.toThrow();
    const r = await fa.partnerReferrals.update("pr1", { releaseStatus: "revoked" });
    expect(r.releaseStatus).toBe("revoked");
    await expect(as({ userId: "u-fa2", role: "firm_admin", firmId: "f2" }).partnerReferrals.update("pr1", { releaseStatus: "granted" })).rejects.toThrow();
    await expect(fa.partnerReferrals.insert({ ...fixtures.partnerReferrals, id: "pr9", leadId: undefined })).rejects.toThrow();
    // a partner-submitted referral cannot exist without the client's consent
    await expect(service.partnerReferrals.insert({ ...fixtures.partnerReferrals, id: "pr8", leadId: undefined, clientConsent: false })).rejects.toThrow();
    await fa.partners.insert({ ...fixtures.partners, id: "pt3", slug: "third", refCode: "ref-third" });
    await expect(fa.partners.insert({ ...fixtures.partners, id: "pt4", slug: "fourth", refCode: "ref-fourth", firmId: "f2" })).rejects.toThrow();
  });

  maybe("payments: the case's attorney and the client read them, intake and other firms do not, app_user cannot write", async () => {
    const ids = async (s: PgSession) => (await as(s).payments.list()).map((p) => p.id);
    expect(await ids({ userId: "u-attorney", role: "attorney", firmId: "f1", lawyerId: "lw1" })).toEqual(["pay1"]);
    expect(await ids({ userId: "u-client", role: "client", personId: lead.personId })).toEqual(["pay1"]);
    expect(await ids({ userId: "u-intake", role: "intake" })).toEqual([]);
    expect(await ids({ userId: "u-other", role: "attorney", firmId: "f2", lawyerId: "lw2" })).toEqual([]);
    expect(await ids({ userId: "u-m", role: "marketing" })).toEqual([]);
    const att = as({ userId: "u-attorney", role: "attorney", firmId: "f1", lawyerId: "lw1" });
    await expect(att.payments.insert({ ...fixtures.payments, id: "x", providerPaymentId: "lp_x" })).rejects.toThrow();
    await expect(att.payments.update("pay1", { status: "failed" })).rejects.toThrow();
    // a paralegal cannot change the package prices or the plan on an engagement (attorney-set), same as the fee
    const para = as({ userId: "u-para", role: "paralegal", firmId: "f1", supportsLawyerIds: ["lw1"] });
    await expect(para.engagements.update("e1", { paymentPlan: undefined })).rejects.toThrow();
  });

  maybe("conversion_events: platform admin and marketing read, nobody else, app_user cannot write", async () => {
    const ids = async (s: PgSession) => (await as(s).conversionEvents.list()).map((d) => d.id).sort();
    expect(await ids({ userId: "u-admin", role: "platform_admin" })).toEqual(["google_ads:retainer_signed:l1"]);
    expect(await ids({ userId: "u-m", role: "marketing" })).toEqual(["google_ads:retainer_signed:l1"]);
    for (const [role, extra] of [["firm_admin", { firmId: "f1" }], ["intake", {}], ["attorney", { firmId: "f1", lawyerId: "lw1" }]] as const) {
      expect(await ids({ userId: "u-x", role, ...extra })).toEqual([]);
    }
    await expect(as({ userId: "u-admin", role: "platform_admin" }).conversionEvents.update("google_ads:retainer_signed:l1", { status: "sent" })).rejects.toThrow();
    const sent = await service.conversionEvents.update("google_ads:retainer_signed:l1", { status: "sent", reason: undefined });
    expect(sent.status).toBe("sent");
    expect(sent.reason).toBeUndefined();
  });

  maybe("review_requests: platform admin reads all, firm admin only their firm's leads, app_user cannot write", async () => {
    const ids = async (s: PgSession) => (await as(s).reviewRequests.list()).map((d) => d.id).sort();
    expect(await ids({ userId: "u-admin", role: "platform_admin" })).toEqual(["review-l1"]);
    expect(await ids({ userId: "u-fa", role: "firm_admin", firmId: "f1" })).toEqual(["review-l1"]);
    expect(await ids({ userId: "u-fa2", role: "firm_admin", firmId: "f2" })).toEqual([]);
    expect(await ids({ userId: "u-m", role: "marketing" })).toEqual([]);
    await expect(as({ userId: "u-admin", role: "platform_admin" }).reviewRequests.update("review-l1", { postedAt: T0 })).rejects.toThrow();
    const updated = await service.reviewRequests.update("review-l1", { eligible: true, exclusionCode: undefined, exclusionNote: undefined });
    expect(updated.exclusionCode).toBeUndefined();
    // eligible and excluded are mutually exclusive in the schema itself
    await expect(service.reviewRequests.update("review-l1", { exclusionCode: "OPTOUT" })).rejects.toThrow();
  });

  maybe("RLS: plan accounts. A planner sees and changes only its own second factor and devices; staff see none of it", async () => {
    // fp_1 (fixture) has a plan_mfa row and a session; fp_9 is another account
    await service.familyPlans.insert({ ...fixtures.familyPlans, id: "fp_9", emailHash: "z".repeat(64), leadId: undefined, prefilledFrom: undefined });
    await service.planMfa.insert({ ...fixtures.planMfa, id: "fp_9", pendingSecretEnc: undefined, lockedUntil: undefined });
    await service.planSessions.insert({ ...fixtures.planSessions, id: "9".repeat(64), planId: "fp_9" });
    await service.planSessions.insert({ ...fixtures.planSessions, id: "b".repeat(64), viaRecoveryCode: undefined });
    const planner = as({ userId: "fp_1", role: "planner" });
    expect((await planner.planMfa.list()).map((r) => r.id)).toEqual(["fp_1"]);
    expect(await planner.planMfa.get("fp_9")).toBeUndefined();
    expect((await planner.planSessions.list()).map((r) => r.id).sort()).toEqual(["a".repeat(64), "b".repeat(64)]);
    expect(await planner.planSessions.get("9".repeat(64))).toBeUndefined();
    // own rows: update and delete; other rows: nothing; never insert (sign-in does that as the service role)
    await planner.planMfa.update("fp_1", { failedAttempts: 2 });
    await expect(planner.planMfa.update("fp_9", { failedAttempts: 0 })).rejects.toThrow(/not found or not permitted/);
    await expect(planner.planSessions.update("9".repeat(64), { lastSeenAt: T0 })).rejects.toThrow(/not found or not permitted/);
    await expect(planner.planSessions.update("a".repeat(64), { planId: "fp_9" })).rejects.toThrow();
    expect(await planner.planSessions.remove("9".repeat(64))).toBe(false);
    expect(await planner.planMfa.remove("fp_9")).toBe(false);
    await expect(planner.planMfa.insert({ ...fixtures.planMfa, id: "fp_8" })).rejects.toThrow(/permission denied/);
    await expect(planner.planSessions.insert({ ...fixtures.planSessions, id: "c".repeat(64) })).rejects.toThrow(/permission denied/);
    expect(await planner.planSessions.remove("b".repeat(64))).toBe(true);
    expect(await service.planSessions.get("9".repeat(64))).toBeDefined();
    // another planner cannot see fp_1's rows
    const nine = as({ userId: "fp_9", role: "planner" });
    expect((await nine.planMfa.list()).map((r) => r.id)).toEqual(["fp_9"]);
    expect((await nine.planSessions.list()).map((r) => r.planId)).toEqual(["fp_9"]);
    // staff: no rows at all, whatever the role, and no writes
    for (const s of [
      { userId: "u-admin", role: "platform_admin" }, { userId: "u-fa", role: "firm_admin", firmId: "f1" }, { userId: "u-attorney", role: "attorney", firmId: "f1", lawyerId: "lw1" },
      { userId: "u-intake", role: "intake" }, { userId: "u-p", role: "paralegal", firmId: "f1" }, { userId: "u-m", role: "marketing" }, { userId: "u-client", role: "client", personId: "p1" },
    ] as const) {
      expect(await as(s).planMfa.list(), s.role).toEqual([]);
      expect(await as(s).planSessions.list(), s.role).toEqual([]);
      await expect(as(s).planMfa.update("fp_1", { failedAttempts: 0 })).rejects.toThrow();
      expect(await as(s).planSessions.remove("a".repeat(64))).toBe(false);
    }
    // a planner reads only its own account's audit events
    await audit(service, "system", { action: "family_plan.link", resourceType: "family_plan", resourceId: "fp_9" });
    await audit(service, "system", { action: "family_plan.link", resourceType: "family_plan", resourceId: "fp_1" });
    await audit(service, "system", { action: "x.other", resourceType: "lead", resourceId: "fp_1" });
    const seen = await planner.audit.list();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((e) => e.resourceType === "family_plan" && e.resourceId === "fp_1")).toBe(true);
    expect((await nine.audit.list()).every((e) => e.resourceId === "fp_9")).toBe(true);
    // deleting an account takes its second factor and sessions with it (FK cascade as a backstop)
    await service.familyPlans.remove("fp_9");
    expect(await service.planMfa.get("fp_9")).toBeUndefined();
    expect(await service.planSessions.get("9".repeat(64))).toBeUndefined();
    await service.planMfa.update("fp_1", { failedAttempts: fixtures.planMfa.failedAttempts });
  });

  maybe("plan accounts end to end through RLS: sign in, devices, activity, recovery codes, export, delete", async () => {
    const sent: { text: string }[] = [];
    configureFamilyPlan({ sendEmail: async (_to, _s, text) => void sent.push({ text }), baseUrl: "https://site.test" });
    const t0 = new Date();
    const a = await signInPlan(service, sent, "pg-account@x.test", t0);
    const b = await signInPlan(service, sent, "pg-other@x.test", t0);
    const ctx = (await resolvePlanSession(service, a.sessionToken, t0))!;
    expect(ctx.planId).toBe(a.planId);
    expect((ctx.db as PgDb).session).toEqual({ userId: a.planId, role: "planner" });
    await saveOwnPlan(ctx.db, a.planId, { papers: { location: "safe" } }, t0);
    expect((await listDevices(ctx, t0)).map((d) => d.device)).toEqual(["Safari on iPhone"]);
    const bCtx = (await resolvePlanSession(service, b.sessionToken, t0))!;
    expect(await revokePlanSession(ctx, bCtx.sessionId, t0)).toEqual({ ok: false, current: false });
    const activity = (await listActivity(ctx)).map((x) => x.text);
    expect(activity).toEqual(expect.arrayContaining(["Plan saved", "Signed in", "Two-step verification turned on", "Account created"]));
    const t1 = new Date(t0.getTime() + 60_000);
    expect((await regenerateRecoveryCodes(ctx, codeFor(a.planId, t1), t1)).ok).toBe(true);
    const exp = await exportPlanAccount(ctx, t1);
    expect(exp?.plan.body.papers.location).toBe("safe");
    // the code just used does not work again, even from a new sign-in
    const link = await useLink(service, sent, "pg-account@x.test", t1);
    expect(await verifyPlanSignIn(service, link.preauthToken, codeFor(a.planId, t1), {}, t1)).toMatchObject({ ok: false, reason: "bad_code" });
    const t2 = new Date(t0.getTime() + 120_000);
    expect(await deletePlanAccount(ctx, codeFor(a.planId, t2), t2)).toEqual({ ok: true });
    expect(await service.familyPlans.get(a.planId)).toBeUndefined();
    expect(await service.familyPlanBodies.get(a.planId)).toBeUndefined();
    expect(await service.planMfa.get(a.planId)).toBeUndefined();
    expect(await service.planSessions.list(undefined, { planId: a.planId })).toEqual([]);
    expect(await resolvePlanSession(service, a.sessionToken, t2)).toBeNull();
    expect(await resolvePlanSession(service, b.sessionToken, t2)).not.toBeNull();
    expect(await service.audit.list(undefined, { action: "family_plan.delete", resourceId: a.planId })).toHaveLength(1);
  });

  maybe("RLS: a planner sees only its own family plan and nothing else; staff see summaries of leads they hold, never the answers", async () => {
    // fp_1 is linked to l1 (assigned to lw1, firm f1, intake owner u-intake); fp_2 is not linked to anything
    await service.familyPlans.insert({ ...fixtures.familyPlans, id: "fp_2", emailHash: "i".repeat(64), leadId: undefined, prefilledFrom: undefined });
    await service.familyPlanBodies.insert({ id: "fp_2", ciphertext: "v1.other", updatedAt: T0 });
    const planner = as({ userId: "fp_1", role: "planner" });
    expect((await planner.familyPlans.list()).map((p) => p.id)).toEqual(["fp_1"]);
    expect((await planner.familyPlanBodies.list()).map((p) => p.id)).toEqual(["fp_1"]);
    expect(await planner.familyPlans.get("fp_2")).toBeUndefined();
    expect(await planner.familyPlanBodies.get("fp_2")).toBeUndefined();
    // nothing else in the database is visible to a planner session
    for (const key of ["users", "firms", "lawyers", "persons", "leads", "assignments", "documents", "comments", "activities", "consults",
      "engagements", "payments", "tasks", "invoices", "enrollments", "suppressions", "crmDeliveries", "seminars", "partners", "partnerGifts",
      "partnerReferrals", "conversionEvents", "reviewRequests", "factVerifications", "templateApprovals"] as const) {
      expect(await (planner[key] as { list(): Promise<unknown[]> }).list(), key).toEqual([]);
    }
    expect(await planner.leadOfferCards()).toEqual([]);
    // the audit log: only events about its own account
    expect((await planner.audit.list()).every((e) => e.resourceType === "family_plan" && e.resourceId === "fp_1")).toBe(true);
    // it may change its own plan, but not relink it to a lead or touch another plan
    await planner.familyPlans.update("fp_1", { gapCount: 2 });
    await planner.familyPlanBodies.update("fp_1", { ciphertext: "v1.new" });
    await expect(planner.familyPlans.update("fp_1", { leadId: "l-offer" })).rejects.toThrow(/only the server links/);
    await expect(planner.familyPlans.update("fp_1", { emailHash: "j".repeat(64) })).rejects.toThrow();
    await expect(planner.familyPlans.update("fp_2", { gapCount: 9 })).rejects.toThrow(/not found or not permitted/);
    await expect(planner.familyPlans.insert({ ...fixtures.familyPlans, id: "fp_3", emailHash: "k".repeat(64), leadId: undefined })).rejects.toThrow();
    const own = as({ userId: "fp_3", role: "planner" });
    await expect(own.familyPlans.insert({ ...fixtures.familyPlans, id: "fp_3", emailHash: "k".repeat(64) })).rejects.toThrow(/only the server links/);
    expect(await planner.familyPlans.remove("fp_2")).toBe(false);
    expect(await service.familyPlans.get("fp_2")).toBeDefined();
    await audit(planner, { userId: "fp_1", role: "planner" }, { action: "family_plan.update", resourceType: "family_plan", resourceId: "fp_1" });

    const ids = async (s: PgSession) => ({
      plans: (await as(s).familyPlans.list()).map((p) => p.id).sort(),
      bodies: (await as(s).familyPlanBodies.list()).map((p) => p.id),
    });
    expect(await ids({ userId: "u-attorney", role: "attorney", firmId: "f1", lawyerId: "lw1" })).toEqual({ plans: ["fp_1"], bodies: [] });
    expect(await ids({ userId: "u-intake", role: "intake" })).toEqual({ plans: ["fp_1"], bodies: [] });
    expect(await ids({ userId: "u-admin", role: "platform_admin" })).toEqual({ plans: ["fp_1"], bodies: [] });
    expect(await ids({ userId: "u-other", role: "attorney", firmId: "f2", lawyerId: "lw2" })).toEqual({ plans: [], bodies: [] });
    expect(await ids({ userId: "u-m", role: "marketing" })).toEqual({ plans: [], bodies: [] });
    expect(await ids({ userId: "u-client", role: "client", personId: "p1" })).toEqual({ plans: [], bodies: [] });
    // the case view reads the summary through the attorney's own session
    const actor = { userId: "u-attorney", role: "attorney" as const, firmId: "f1", lawyerId: "lw1", mfa: true };
    const view = await buildCaseView(as({ userId: actor.userId, role: actor.role, firmId: actor.firmId, lawyerId: actor.lawyerId }), actor, "l1");
    expect(view.sections.organizer?.planId).toBe("fp_1");
    await expect(as({ userId: "u-attorney", role: "attorney", firmId: "f1", lawyerId: "lw1" }).familyPlans.update("fp_1", { gapCount: 0 })).rejects.toThrow();

    // hard delete by the owner; the body goes with the plan
    expect(await planner.familyPlanBodies.remove("fp_1")).toBe(true);
    expect(await planner.familyPlans.remove("fp_1")).toBe(true);
    expect(await service.familyPlans.get("fp_1")).toBeUndefined();
    await service.familyPlans.remove("fp_2");
    expect(await service.familyPlanBodies.get("fp_2")).toBeUndefined(); // ON DELETE CASCADE
  });

  maybe("plan_link_uses: a link id is consumed once across connections; app_user cannot see or write it", async () => {
    expect(await consumeLink(service, "jti-pg", new Date())).toBe(true);
    const other = createPgDb({ pool, session: "service" }); // stands in for another app instance
    expect(await consumeLink(other, "jti-pg", new Date())).toBe(false);
    const racers = await Promise.all(Array.from({ length: 5 }, () => consumeLink(createPgDb({ pool, session: "service" }), "jti-race", new Date())));
    expect(racers.filter(Boolean)).toHaveLength(1);
    for (const s of [{ userId: "u-admin", role: "platform_admin" }, { userId: "fp_1", role: "planner" }] as const) {
      await expect(as(s).planLinkUses.list()).rejects.toThrow(/permission denied/);
      await expect(as(s).planLinkUses.insert({ id: "jti-x", usedAt: T0 })).rejects.toThrow(/permission denied/);
    }
    await expect(service.planLinkUses.update("jti-pg", { usedAt: T0 })).rejects.toThrow();
  });

  maybe("audit_events cannot be updated or deleted", async () => {
    await expect(admin.query("UPDATE audit_events SET action = 'x'")).rejects.toThrow(/append-only/);
    await expect(admin.query("DELETE FROM audit_events")).rejects.toThrow(/append-only/);
    await expect(admin.query("TRUNCATE audit_events")).rejects.toThrow(/append-only/);
    for (const role of ["app_service", "app_user"]) {
      const c = await admin.connect();
      try {
        await c.query("BEGIN");
        await c.query(`SET LOCAL ROLE ${role}`);
        await expect(c.query("DELETE FROM audit_events")).rejects.toThrow(/permission denied/);
      } finally {
        await c.query("ROLLBACK");
        c.release();
      }
    }
  });
});

if (skipReason) console.warn(`[pg.test] integration tests skipped: ${skipReason}`);
