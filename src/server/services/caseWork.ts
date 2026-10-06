/**
 * Everyday work on a case: comments, documents, tasks and consults. Each call
 * checks the policy for the specific action, then writes an audit event.
 */
import { randomUUID } from "node:crypto";
import { audit } from "@/server/audit/log";
import { assertCan, canOnLead, defaultVisibility, ForbiddenError, writableVisibilities } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { setStage } from "@/server/services/leads";
import type { Actor, Comment, Consult, DocumentKind, DocumentRecord, Lead, Task, Visibility } from "@/server/types";

function load(db: Db, leadId: string): { lead: Lead; assignments: ReturnType<Db["assignments"]["list"]> } {
  const lead = db.leads.get(leadId);
  if (!lead) throw new Error("Lead not found");
  return { lead, assignments: db.assignments.list((a) => a.leadId === leadId) };
}

/** @mentions are user ids written as @[userId]. Unknown ids are dropped. */
export function parseMentions(db: Db, body: string): string[] {
  const ids = [...body.matchAll(/@\[([\w-]+)\]/g)].map((m) => m[1]);
  return [...new Set(ids)].filter((id) => db.users.get(id));
}

export function addComment(
  db: Db,
  actor: Actor,
  input: { leadId: string; body: string; visibility?: Visibility; parentId?: string },
  now = new Date(),
): Comment {
  const { lead, assignments } = load(db, input.leadId);
  assertCan(canOnLead(actor, "comment", lead, assignments, now));
  const body = input.body.trim();
  if (!body) throw new Error("Write a comment first");
  if (body.length > 10_000) throw new Error("Comment is too long");
  const visibility = input.visibility ?? defaultVisibility(actor);
  if (!writableVisibilities(actor).includes(visibility)) throw new ForbiddenError(`You cannot post ${visibility} comments`);
  if (input.parentId) {
    const parent = db.comments.get(input.parentId);
    if (!parent || parent.leadId !== lead.id) throw new Error("Reply target not found");
    // A reply can never be more visible than what it answers, or it would leak the thread.
    const rank: Record<Visibility, number> = { internal: 0, firm: 1, client: 2 };
    if (rank[visibility] > rank[parent.visibility]) throw new Error("A reply cannot be more widely visible than the comment it answers");
  }
  const user = db.users.get(actor.userId);
  const comment = db.comments.insert({
    id: randomUUID(),
    leadId: lead.id,
    parentId: input.parentId,
    authorId: actor.userId,
    authorName: user?.name ?? "Unknown",
    body,
    visibility,
    mentions: parseMentions(db, body),
    createdAt: now.toISOString(),
  });
  audit(db, actor, { action: "comment.create", resourceType: "comment", resourceId: comment.id, leadId: lead.id, detail: { visibility }, at: now });
  return comment;
}

export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/heic", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Virus scanning runs out of band; documents stay hidden until the scanner marks them clean. */
export interface VirusScanner {
  scan(storageKey: string): Promise<"clean" | "infected">;
}

export const mockScanner: VirusScanner = { scan: async () => "clean" };

export function registerDocument(
  db: Db,
  actor: Actor,
  input: { leadId: string; name: string; kind: DocumentKind; contentType: string; sizeBytes: number; visibility?: Visibility },
  now = new Date(),
): DocumentRecord {
  const { lead, assignments } = load(db, input.leadId);
  assertCan(canOnLead(actor, "upload_document", lead, assignments, now));
  if (!ALLOWED_UPLOAD_TYPES.includes(input.contentType)) throw new Error("Upload a PDF, Word document or photo");
  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_UPLOAD_BYTES) throw new Error("Files must be under 25 MB");
  const visibility = actor.role === "client" ? "client" : (input.visibility ?? "firm");
  const id = randomUUID();
  const doc = db.documents.insert({
    id,
    leadId: lead.id,
    name: input.name.slice(0, 200),
    kind: input.kind,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    storageKey: `leads/${lead.id}/documents/${id}`,
    uploadedBy: actor.userId,
    uploadedAt: now.toISOString(),
    scanStatus: "pending",
    visibility,
  });
  audit(db, actor, { action: "document.upload", resourceType: "document", resourceId: id, leadId: lead.id, detail: { kind: input.kind }, at: now });
  return doc;
}

export async function scanDocument(db: Db, scanner: VirusScanner, documentId: string, now = new Date()): Promise<DocumentRecord> {
  const doc = db.documents.get(documentId);
  if (!doc) throw new Error("Document not found");
  const result = await scanner.scan(doc.storageKey);
  const next = db.documents.update(documentId, { scanStatus: result });
  audit(db, "system", { action: "document.scan", resourceType: "document", resourceId: documentId, leadId: doc.leadId, detail: { result }, at: now });
  return next;
}

/**
 * Authorizes a download and audits it. Downloads are watermarked with the viewer
 * and time by the file service; this returns the text to stamp.
 */
export function authorizeDownload(db: Db, actor: Actor, documentId: string, now = new Date()): { doc: DocumentRecord; watermark: string } {
  const doc = db.documents.get(documentId);
  if (!doc) throw new Error("Document not found");
  const { lead, assignments } = load(db, doc.leadId);
  assertCan(canOnLead(actor, "view_documents", lead, assignments, now));
  if (actor.role === "client" && doc.visibility !== "client") throw new ForbiddenError();
  if (doc.scanStatus !== "clean") throw new Error("This file is still being checked for viruses");
  const user = db.users.get(actor.userId);
  audit(db, actor, { action: "document.download", resourceType: "document", resourceId: doc.id, leadId: doc.leadId, at: now });
  return { doc, watermark: `Confidential. Downloaded by ${user?.email ?? actor.userId} on ${now.toISOString()}` };
}

export function addTask(db: Db, actor: Actor, input: { leadId: string; title: string; ownerId: string; dueAt: string }, now = new Date()): Task {
  const { lead, assignments } = load(db, input.leadId);
  assertCan(canOnLead(actor, "manage_tasks", lead, assignments, now));
  if (!db.users.get(input.ownerId)) throw new Error("Task owner not found");
  const task = db.tasks.insert({ id: randomUUID(), leadId: lead.id, title: input.title.trim(), ownerId: input.ownerId, dueAt: input.dueAt });
  audit(db, actor, { action: "task.create", resourceType: "task", resourceId: task.id, leadId: lead.id, at: now });
  return task;
}

export function completeTask(db: Db, actor: Actor, taskId: string, now = new Date()): Task {
  const task = db.tasks.get(taskId);
  if (!task) throw new Error("Task not found");
  const { lead, assignments } = load(db, task.leadId);
  assertCan(canOnLead(actor, "manage_tasks", lead, assignments, now));
  const next = db.tasks.update(taskId, { doneAt: now.toISOString() });
  audit(db, actor, { action: "task.complete", resourceType: "task", resourceId: taskId, leadId: lead.id, at: now });
  return next;
}

export function bookConsult(db: Db, actor: Actor, input: { leadId: string; at: string; type: Consult["type"] }, now = new Date()): Consult {
  const { lead, assignments } = load(db, input.leadId);
  assertCan(canOnLead(actor, "book_consult", lead, assignments, now));
  if (!lead.assignedLawyerId) throw new Error("An attorney must accept the lead before a consult is booked");
  const consult = db.consults.insert({ id: randomUUID(), leadId: lead.id, lawyerId: lead.assignedLawyerId, at: input.at, type: input.type, status: "booked" });
  setStage(db, actor, lead.id, "consult_booked", now);
  audit(db, actor, { action: "consult.book", resourceType: "consult", resourceId: consult.id, leadId: lead.id, at: now });
  return consult;
}

export function recordConsultOutcome(
  db: Db,
  actor: Actor,
  consultId: string,
  input: { status: "held" | "no_show" | "cancelled"; outcome?: Consult["outcome"]; notes?: string },
  now = new Date(),
): Consult {
  const consult = db.consults.get(consultId);
  if (!consult) throw new Error("Consult not found");
  const { lead } = load(db, consult.leadId);
  assertCan(actor.role === "platform_admin" || (actor.role === "attorney" && actor.lawyerId === consult.lawyerId) || (actor.role === "paralegal" && !!actor.supportsLawyerIds?.includes(consult.lawyerId)));
  const next = db.consults.update(consultId, { status: input.status, outcome: input.outcome, notes: input.notes });
  if (input.status === "held") setStage(db, actor, lead.id, "consult_held", now);
  audit(db, actor, { action: "consult.outcome", resourceType: "consult", resourceId: consultId, leadId: lead.id, detail: { status: input.status, outcome: input.outcome }, at: now });
  return next;
}
