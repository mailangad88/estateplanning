import { beforeEach, describe, expect, it } from "vitest";
import { verifyAuditChain } from "@/server/audit/log";
import { ForbiddenError } from "@/server/auth/policy";
import { createMemoryDb, type Db } from "@/server/db";
import { actorFor, DEMO_USERS, seedDemo } from "@/server/seed";
import {
  addComment,
  addTask,
  authorizeDownload,
  bookConsult,
  completeTask,
  MAX_UPLOAD_BYTES,
  mockScanner,
  parseMentions,
  recordConsultOutcome,
  registerDocument,
  scanDocument,
} from "@/server/services/caseWork";
import { acceptOffer } from "@/server/services/routing";
import type { Actor } from "@/server/types";

const NOW = new Date("2026-03-02T15:00:00Z");
const user = (id: string) => DEMO_USERS.find((u) => u.id === id)!;
const intake = actorFor(user("u-intake"));
const PDF = "application/pdf";

let db: Db;
let offeredLawyerId: string;
let attorney: Actor;
let otherAttorney: Actor;
let client: Actor;

beforeEach(() => {
  db = createMemoryDb();
  seedDemo(db, NOW);
  const a = db.assignments.list((x) => x.leadId === "lead-0002" && x.status === "offered")[0];
  offeredLawyerId = a.lawyerId;
  attorney = actorFor(DEMO_USERS.find((u) => u.lawyerId === offeredLawyerId)!);
  otherAttorney = actorFor(DEMO_USERS.find((u) => u.lawyerId && u.lawyerId !== offeredLawyerId)!);
  acceptOffer(db, attorney, a.id, NOW);
  const lead = db.leads.get("lead-0002")!;
  db.users.insert({ id: "u-client", email: "client@example.com", name: "Client", role: "client", personId: lead.personId, active: true });
  client = actorFor(db.users.get("u-client")!);
});

describe("comments", () => {
  it("intake can post internal", () => {
    const c = addComment(db, intake, { leadId: "lead-0002", body: "note", visibility: "internal" }, NOW);
    expect(c.visibility).toBe("internal");
    expect(addComment(db, intake, { leadId: "lead-0002", body: "default" }, NOW).visibility).toBe("firm");
  });

  it("attorney cannot post internal", () => {
    expect(() => addComment(db, attorney, { leadId: "lead-0002", body: "x", visibility: "internal" }, NOW)).toThrow(ForbiddenError);
    expect(addComment(db, attorney, { leadId: "lead-0002", body: "x", visibility: "firm" }, NOW).visibility).toBe("firm");
  });

  it("client can only post client-visible", () => {
    expect(addComment(db, client, { leadId: "lead-0002", body: "hi" }, NOW).visibility).toBe("client");
    expect(() => addComment(db, client, { leadId: "lead-0002", body: "hi", visibility: "firm" }, NOW)).toThrow(ForbiddenError);
    expect(() => addComment(db, client, { leadId: "lead-0002", body: "hi", visibility: "internal" }, NOW)).toThrow(ForbiddenError);
  });

  it("unrelated attorney, empty and oversize bodies are refused", () => {
    expect(() => addComment(db, otherAttorney, { leadId: "lead-0002", body: "x" }, NOW)).toThrow(ForbiddenError);
    expect(() => addComment(db, intake, { leadId: "lead-0002", body: "   " }, NOW)).toThrow();
    expect(() => addComment(db, intake, { leadId: "lead-0002", body: "a".repeat(10_001) }, NOW)).toThrow();
  });

  it("a reply cannot be more visible than its parent", () => {
    const internal = addComment(db, intake, { leadId: "lead-0002", body: "p", visibility: "internal" }, NOW);
    expect(() => addComment(db, intake, { leadId: "lead-0002", body: "r", visibility: "firm", parentId: internal.id }, NOW)).toThrow(/more widely visible/);
    expect(addComment(db, intake, { leadId: "lead-0002", body: "r", visibility: "internal", parentId: internal.id }, NOW).parentId).toBe(internal.id);
    const firm = addComment(db, intake, { leadId: "lead-0002", body: "p2", visibility: "firm" }, NOW);
    expect(addComment(db, intake, { leadId: "lead-0002", body: "r2", visibility: "internal", parentId: firm.id }, NOW)).toBeTruthy();
    expect(() => addComment(db, intake, { leadId: "lead-0002", body: "r", parentId: "missing" }, NOW)).toThrow(/Reply target/);
  });

  it("parses @[id] mentions and drops unknown ids", () => {
    expect(parseMentions(db, "hi @[u-intake] and @[u-intake] and @[ghost] @[u-admin]")).toEqual(["u-intake", "u-admin"]);
    const c = addComment(db, intake, { leadId: "lead-0002", body: "ping @[u-intake] @[nope]" }, NOW);
    expect(c.mentions).toEqual(["u-intake"]);
  });
});

describe("documents", () => {
  const input = { leadId: "lead-0002", name: "will.pdf", kind: "existing_will" as const, contentType: PDF, sizeBytes: 1000 };

  it("rejects bad content type and oversize, stores pending", () => {
    expect(() => registerDocument(db, attorney, { ...input, contentType: "application/x-msdownload" }, NOW)).toThrow(/PDF/);
    expect(() => registerDocument(db, attorney, { ...input, sizeBytes: MAX_UPLOAD_BYTES + 1 }, NOW)).toThrow(/25 MB/);
    expect(() => registerDocument(db, attorney, { ...input, sizeBytes: 0 }, NOW)).toThrow();
    expect(registerDocument(db, attorney, { ...input, sizeBytes: MAX_UPLOAD_BYTES }, NOW).scanStatus).toBe("pending");
    const d = registerDocument(db, attorney, input, NOW);
    expect(d.scanStatus).toBe("pending");
    expect(d.storageKey).toBe(`leads/lead-0002/documents/${d.id}`);
  });

  it("authorizeDownload: refuses pending, works once clean with watermark, refuses intake", async () => {
    const d = registerDocument(db, attorney, input, NOW);
    expect(() => authorizeDownload(db, attorney, d.id, NOW)).toThrow(/virus/);
    await scanDocument(db, mockScanner, d.id, NOW);
    expect(db.documents.get(d.id)!.scanStatus).toBe("clean");
    const r = authorizeDownload(db, attorney, d.id, NOW);
    expect(r.watermark).toContain(attorney.userId === "u-lawyer-a" ? "avery@example.com" : "jordan@example.com");
    expect(r.watermark).toContain(NOW.toISOString());
    expect(() => authorizeDownload(db, intake, d.id, NOW)).toThrow(ForbiddenError);
    expect(() => authorizeDownload(db, otherAttorney, d.id, NOW)).toThrow(ForbiddenError);
    expect(db.audit.list((e) => e.action === "document.download")).toHaveLength(1);
  });

  it("infected files are not downloadable; firm-visibility docs are hidden from clients", async () => {
    const d = registerDocument(db, attorney, input, NOW);
    await scanDocument(db, { scan: async () => "infected" }, d.id, NOW);
    expect(() => authorizeDownload(db, attorney, d.id, NOW)).toThrow(/virus/);
    await scanDocument(db, mockScanner, d.id, NOW);
    expect(() => authorizeDownload(db, client, d.id, NOW)).toThrow(ForbiddenError);
  });
});

describe("consults", () => {
  it("bookConsult requires an accepted lawyer", () => {
    expect(() => bookConsult(db, intake, { leadId: "lead-0001", at: "2026-03-05T15:00:00Z", type: "video" }, NOW)).toThrow(/accept/);
  });

  it("books and moves stage to consult_booked", () => {
    const c = bookConsult(db, intake, { leadId: "lead-0002", at: "2026-03-05T15:00:00Z", type: "video" }, NOW);
    expect(c.status).toBe("booked");
    expect(c.lawyerId).toBe(offeredLawyerId);
    expect(db.leads.get("lead-0002")!.stage).toBe("consult_booked");
  });

  it("recordConsultOutcome: non-assigned attorney forbidden; assigned works and moves to consult_held", () => {
    const c = bookConsult(db, intake, { leadId: "lead-0002", at: "2026-03-05T15:00:00Z", type: "phone" }, NOW);
    expect(() => recordConsultOutcome(db, otherAttorney, c.id, { status: "held" }, NOW)).toThrow(ForbiddenError);
    expect(() => recordConsultOutcome(db, intake, c.id, { status: "held" }, NOW)).toThrow(ForbiddenError);
    const r = recordConsultOutcome(db, attorney, c.id, { status: "held", outcome: "proposal" }, NOW);
    expect(r.outcome).toBe("proposal");
    expect(db.leads.get("lead-0002")!.stage).toBe("consult_held");
  });
});

describe("tasks", () => {
  it("creates and completes", () => {
    const t = addTask(db, attorney, { leadId: "lead-0002", title: " Call back ", ownerId: "u-intake", dueAt: "2026-03-04T00:00:00Z" }, NOW);
    expect(t.title).toBe("Call back");
    expect(t.doneAt).toBeUndefined();
    expect(completeTask(db, attorney, t.id, NOW).doneAt).toBe(NOW.toISOString());
    expect(() => addTask(db, attorney, { leadId: "lead-0002", title: "x", ownerId: "ghost", dueAt: "2026-03-04" }, NOW)).toThrow(/owner/);
    expect(() => completeTask(db, otherAttorney, t.id, NOW)).toThrow(ForbiddenError);
  });

  it("audit chain verifies after case work", () => {
    addComment(db, intake, { leadId: "lead-0002", body: "x" }, NOW);
    expect(verifyAuditChain(db.audit.list()).ok).toBe(true);
  });
});
