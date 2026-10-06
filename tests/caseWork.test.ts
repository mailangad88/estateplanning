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

beforeEach(async () => {
  db = createMemoryDb();
  await seedDemo(db, NOW);
  const a = (await db.assignments.list((x) => x.leadId === "lead-0002" && x.status === "offered"))[0];
  offeredLawyerId = a.lawyerId;
  attorney = actorFor(DEMO_USERS.find((u) => u.lawyerId === offeredLawyerId)!);
  otherAttorney = actorFor(DEMO_USERS.find((u) => u.lawyerId && u.lawyerId !== offeredLawyerId)!);
  await acceptOffer(db, attorney, a.id, NOW);
  const lead = (await db.leads.get("lead-0002"))!;
  await db.users.insert({ id: "u-client", email: "client@example.com", name: "Client", role: "client", personId: lead.personId, active: true });
  client = actorFor((await db.users.get("u-client"))!);
});

describe("comments", async () => {
  it("intake can post internal", async () => {
    const c = await addComment(db, intake, { leadId: "lead-0002", body: "note", visibility: "internal" }, NOW);
    expect(c.visibility).toBe("internal");
    expect((await addComment(db, intake, { leadId: "lead-0002", body: "default" }, NOW)).visibility).toBe("firm");
  });

  it("attorney cannot post internal", async () => {
    await expect(addComment(db, attorney, { leadId: "lead-0002", body: "x", visibility: "internal" }, NOW)).rejects.toThrow(ForbiddenError);
    expect((await addComment(db, attorney, { leadId: "lead-0002", body: "x", visibility: "firm" }, NOW)).visibility).toBe("firm");
  });

  it("client can only post client-visible", async () => {
    expect((await addComment(db, client, { leadId: "lead-0002", body: "hi" }, NOW)).visibility).toBe("client");
    await expect(addComment(db, client, { leadId: "lead-0002", body: "hi", visibility: "firm" }, NOW)).rejects.toThrow(ForbiddenError);
    await expect(addComment(db, client, { leadId: "lead-0002", body: "hi", visibility: "internal" }, NOW)).rejects.toThrow(ForbiddenError);
  });

  it("unrelated attorney, empty and oversize bodies are refused", async () => {
    await expect(addComment(db, otherAttorney, { leadId: "lead-0002", body: "x" }, NOW)).rejects.toThrow(ForbiddenError);
    await expect(addComment(db, intake, { leadId: "lead-0002", body: "   " }, NOW)).rejects.toThrow();
    await expect(addComment(db, intake, { leadId: "lead-0002", body: "a".repeat(10_001) }, NOW)).rejects.toThrow();
  });

  it("a reply cannot be more visible than its parent", async () => {
    const internal = await addComment(db, intake, { leadId: "lead-0002", body: "p", visibility: "internal" }, NOW);
    await expect(addComment(db, intake, { leadId: "lead-0002", body: "r", visibility: "firm", parentId: internal.id }, NOW)).rejects.toThrow(/more widely visible/);
    expect((await addComment(db, intake, { leadId: "lead-0002", body: "r", visibility: "internal", parentId: internal.id }, NOW)).parentId).toBe(internal.id);
    const firm = await addComment(db, intake, { leadId: "lead-0002", body: "p2", visibility: "firm" }, NOW);
    expect(await addComment(db, intake, { leadId: "lead-0002", body: "r2", visibility: "internal", parentId: firm.id }, NOW)).toBeTruthy();
    await expect(addComment(db, intake, { leadId: "lead-0002", body: "r", parentId: "missing" }, NOW)).rejects.toThrow(/Reply target/);
  });

  it("parses @[id] mentions and drops unknown ids", async () => {
    expect(await parseMentions(db, "hi @[u-intake] and @[u-intake] and @[ghost] @[u-admin]")).toEqual(["u-intake", "u-admin"]);
    const c = await addComment(db, intake, { leadId: "lead-0002", body: "ping @[u-intake] @[nope]" }, NOW);
    expect(c.mentions).toEqual(["u-intake"]);
  });
});

describe("documents", async () => {
  const input = { leadId: "lead-0002", name: "will.pdf", kind: "existing_will" as const, contentType: PDF, sizeBytes: 1000 };

  it("rejects bad content type and oversize, stores pending", async () => {
    await expect(registerDocument(db, attorney, { ...input, contentType: "application/x-msdownload" }, NOW)).rejects.toThrow(/PDF/);
    await expect(registerDocument(db, attorney, { ...input, sizeBytes: MAX_UPLOAD_BYTES + 1 }, NOW)).rejects.toThrow(/25 MB/);
    await expect(registerDocument(db, attorney, { ...input, sizeBytes: 0 }, NOW)).rejects.toThrow();
    expect((await registerDocument(db, attorney, { ...input, sizeBytes: MAX_UPLOAD_BYTES }, NOW)).scanStatus).toBe("pending");
    const d = await registerDocument(db, attorney, input, NOW);
    expect(d.scanStatus).toBe("pending");
    expect(d.storageKey).toBe(`leads/lead-0002/documents/${d.id}`);
  });

  it("authorizeDownload: refuses pending, works once clean with watermark, refuses intake", async () => {
    const d = await registerDocument(db, attorney, input, NOW);
    await expect(authorizeDownload(db, attorney, d.id, NOW)).rejects.toThrow(/virus/);
    await scanDocument(db, mockScanner, d.id, NOW);
    expect((await db.documents.get(d.id))!.scanStatus).toBe("clean");
    const r = await authorizeDownload(db, attorney, d.id, NOW);
    expect(r.watermark).toContain(attorney.userId === "u-lawyer-a" ? "avery@example.com" : "jordan@example.com");
    expect(r.watermark).toContain(NOW.toISOString());
    await expect(authorizeDownload(db, intake, d.id, NOW)).rejects.toThrow(ForbiddenError);
    await expect(authorizeDownload(db, otherAttorney, d.id, NOW)).rejects.toThrow(ForbiddenError);
    expect(await db.audit.list((e) => e.action === "document.download")).toHaveLength(1);
  });

  it("infected files are not downloadable; firm-visibility docs are hidden from clients", async () => {
    const d = await registerDocument(db, attorney, input, NOW);
    await scanDocument(db, { scan: async () => "infected" }, d.id, NOW);
    await expect(authorizeDownload(db, attorney, d.id, NOW)).rejects.toThrow(/virus/);
    await scanDocument(db, mockScanner, d.id, NOW);
    await expect(authorizeDownload(db, client, d.id, NOW)).rejects.toThrow(ForbiddenError);
  });
});

describe("consults", async () => {
  it("bookConsult requires an accepted lawyer", async () => {
    await expect(bookConsult(db, intake, { leadId: "lead-0001", at: "2026-03-05T15:00:00Z", type: "video" }, NOW)).rejects.toThrow(/accept/);
  });

  it("books and moves stage to consult_booked", async () => {
    const c = await bookConsult(db, intake, { leadId: "lead-0002", at: "2026-03-05T15:00:00Z", type: "video" }, NOW);
    expect(c.status).toBe("booked");
    expect(c.lawyerId).toBe(offeredLawyerId);
    expect((await db.leads.get("lead-0002"))!.stage).toBe("consult_booked");
  });

  it("recordConsultOutcome: non-assigned attorney forbidden; assigned works and moves to consult_held", async () => {
    const c = await bookConsult(db, intake, { leadId: "lead-0002", at: "2026-03-05T15:00:00Z", type: "phone" }, NOW);
    await expect(recordConsultOutcome(db, otherAttorney, c.id, { status: "held" }, NOW)).rejects.toThrow(ForbiddenError);
    await expect(recordConsultOutcome(db, intake, c.id, { status: "held" }, NOW)).rejects.toThrow(ForbiddenError);
    const r = await recordConsultOutcome(db, attorney, c.id, { status: "held", outcome: "proposal" }, NOW);
    expect(r.outcome).toBe("proposal");
    expect((await db.leads.get("lead-0002"))!.stage).toBe("consult_held");
  });
});

describe("tasks", async () => {
  it("creates and completes", async () => {
    const t = await addTask(db, attorney, { leadId: "lead-0002", title: " Call back ", ownerId: "u-intake", dueAt: "2026-03-04T00:00:00Z" }, NOW);
    expect(t.title).toBe("Call back");
    expect(t.doneAt).toBeUndefined();
    expect((await completeTask(db, attorney, t.id, NOW)).doneAt).toBe(NOW.toISOString());
    await expect(addTask(db, attorney, { leadId: "lead-0002", title: "x", ownerId: "ghost", dueAt: "2026-03-04" }, NOW)).rejects.toThrow(/owner/);
    await expect(completeTask(db, otherAttorney, t.id, NOW)).rejects.toThrow(ForbiddenError);
  });

  it("audit chain verifies after case work", async () => {
    await addComment(db, intake, { leadId: "lead-0002", body: "x" }, NOW);
    expect(verifyAuditChain(await db.audit.list()).ok).toBe(true);
  });
});
