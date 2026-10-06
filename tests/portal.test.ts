import { beforeEach, describe, expect, it } from "vitest";
import { verifyAuditChain } from "@/server/audit/log";
import { canOnLead, ForbiddenError, leadAccess } from "@/server/auth/policy";
import { createMemoryDb, type Db } from "@/server/db";
import { buildCaseView, lawyerDashboard, SECTION_ORDER, visibleLeads } from "@/server/portal/caseView";
import { actorFor, DEMO_USERS, seedDemo } from "@/server/seed";
import { addComment } from "@/server/services/caseWork";
import { acceptOffer } from "@/server/services/routing";
import type { Actor, Assignment } from "@/server/types";

const NOW = new Date("2026-10-06T15:00:00Z");
const user = (id: string, mfa = true): Actor => actorFor(DEMO_USERS.find((u) => u.id === id)!, mfa);

let db: Db;
let offer: Assignment;
let offered: Actor;
let other: Actor;

beforeEach(async () => {
  db = createMemoryDb();
  await seedDemo(db, NOW);
  offer = (await db.assignments.list((a) => a.leadId === "lead-0002" && a.status === "offered"))[0];
  offered = actorFor(DEMO_USERS.find((u) => u.lawyerId === offer.lawyerId)!);
  other = actorFor(DEMO_USERS.find((u) => u.role === "attorney" && u.lawyerId !== offer.lawyerId)!);
});

describe("lead access before acceptance", async () => {
  it("routes the urgent seeded lead to an attorney with an open offer", () => {
    expect(offer).toBeDefined();
  });

  it("shows the offered attorney only the conflict card and the non-confidential summary", async () => {
    const view = await buildCaseView(db, offered, "lead-0002", NOW);
    expect(view.access).toBe("conflict_card");
    expect(Object.keys(view.sections).sort()).toEqual(["conflict", "summary"]);
    expect(view.sections.summary?.summary).toBe("");
    expect(view.sections.summary?.goals).toBeUndefined();
    expect(view.header.name).toBe("Prospective client");
    expect(view.header.offerAssignmentId).toBe(offer.id);
    // The offer summary names no one and carries no case facts.
    expect(view.sections.summary?.offerSummary).not.toMatch(/Morgan|Lee|sibling|brokerage/);
  });

  it("gives an attorney without an offer no access at all", async () => {
    await expect(buildCaseView(db, other, "lead-0002", NOW)).rejects.toThrow(ForbiddenError);
    expect(await visibleLeads(db, other, NOW)).toHaveLength(0);
  });

  it("closes the conflict-card view once the offer window passes", async () => {
    const late = new Date(new Date(offer.expiresAt).getTime() + 1000);
    expect(leadAccess(offered, (await db.leads.get("lead-0002"))!, [offer], late)).toBe("none");
  });

  it("does not let an offered attorney comment or see documents", async () => {
    const lead = (await db.leads.get("lead-0002"))!;
    expect(canOnLead(offered, "comment", lead, [offer], NOW)).toBe(false);
    expect(canOnLead(offered, "view_documents", lead, [offer], NOW)).toBe(false);
    await expect(addComment(db, offered, { leadId: lead.id, body: "hi" }, NOW)).rejects.toThrow(ForbiddenError);
  });
});

describe("after acceptance", async () => {
  beforeEach(async () => {
    await acceptOffer(db, offered, offer.id, NOW);
  });

  it("unlocks the full case in the fixed section order", async () => {
    const view = await buildCaseView(db, offered, "lead-0002", NOW);
    expect(view.access).toBe("full");
    const present = Object.keys(view.sections);
    const expectedOrder = SECTION_ORDER.filter((k) => k !== "header" && k !== "audit" && present.includes(k));
    expect(present).toEqual(expectedOrder);
    expect(view.header.name).toBe("Morgan Lee");
    expect(view.sections.redFlags?.redFlags).toContain("Possible dispute between siblings");
  });

  it("lets the supporting paralegal in only when they support the assigned attorney", async () => {
    const para = user("u-paralegal");
    const access = (await buildCaseView(db, para, "lead-0002", NOW)).access;
    expect(access).toBe(para.supportsLawyerIds!.includes(offer.lawyerId) ? "full" : "none");
  });

  it("never lets a paralegal approve an engagement", async () => {
    const para = { ...user("u-paralegal"), supportsLawyerIds: [offer.lawyerId] };
    expect(canOnLead(para, "approve_engagement", (await db.leads.get("lead-0002"))!, await db.assignments.list(), NOW)).toBe(false);
    expect(canOnLead(offered, "approve_engagement", (await db.leads.get("lead-0002"))!, await db.assignments.list(), NOW)).toBe(true);
  });

  it("gives the firm admin the full case for their firm and the audit log", async () => {
    const view = await buildCaseView(db, user("u-firmadmin"), "lead-0002", NOW);
    expect(view.access).toBe("full");
    expect(view.sections.audit?.length).toBeGreaterThan(0);
  });

  it("keeps intake on intake fields: no engagement or documents after handoff", async () => {
    const view = await buildCaseView(db, user("u-intake"), "lead-0002", NOW);
    expect(view.access).toBe("intake");
    expect(view.sections.engagement).toBeUndefined();
    expect(view.sections.documents).toBeUndefined();
    expect(view.sections.audit).toBeUndefined();
  });
});

describe("comments", async () => {
  it("hides intake-only comments from attorneys and firm comments from clients", async () => {
    await acceptOffer(db, offered, offer.id, NOW);
    await addComment(db, user("u-intake"), { leadId: "lead-0002", body: "Caller sounded rushed", visibility: "internal" }, NOW);
    await addComment(db, user("u-intake"), { leadId: "lead-0002", body: "Prefers mornings" }, NOW);
    const lawyerView = await buildCaseView(db, offered, "lead-0002", NOW);
    expect(lawyerView.sections.comments?.map((c) => c.body)).toEqual(["Prefers mornings"]);
    const intakeView = await buildCaseView(db, user("u-intake"), "lead-0002", NOW);
    expect(intakeView.sections.comments).toHaveLength(2);
  });

  it("threads replies under their parent", async () => {
    const root = await addComment(db, user("u-intake"), { leadId: "lead-0001", body: "Root" }, NOW);
    await addComment(db, user("u-admin"), { leadId: "lead-0001", body: "Reply", parentId: root.id }, NOW);
    const view = await buildCaseView(db, user("u-admin"), "lead-0001", NOW);
    expect(view.sections.comments?.[0].replies[0].body).toBe("Reply");
  });
});

describe("other roles", async () => {
  it("gives marketing no individual leads", async () => {
    expect(await visibleLeads(db, user("u-marketing"), NOW)).toHaveLength(0);
    await expect(buildCaseView(db, user("u-marketing"), "lead-0001", NOW)).rejects.toThrow(ForbiddenError);
  });

  it("shows a client their own matter without internal sections", async () => {
    const lead = (await db.leads.get("lead-0001"))!;
    const client: Actor = { userId: "u-client", role: "client", personId: lead.personId, mfa: true };
    const view = await buildCaseView(db, client, lead.id, NOW);
    expect(view.access).toBe("client");
    for (const k of ["redFlags", "conflict", "answers", "timeline", "tasks", "source", "audit"] as const) {
      expect(view.sections[k]).toBeUndefined();
    }
    const stranger: Actor = { ...client, personId: "someone-else" };
    await expect(buildCaseView(db, stranger, lead.id, NOW)).rejects.toThrow(ForbiddenError);
  });

  it("requires two-step sign-in in production", async () => {
    const prev = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = "production";
    try {
      await expect(buildCaseView(db, user("u-admin", false), "lead-0001", NOW)).rejects.toThrow(ForbiddenError);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prev;
    }
  });
});

describe("dashboard and audit", async () => {
  it("lists the open offer with its deadline on the offered attorney's dashboard", async () => {
    const dash = await lawyerDashboard(db, offered, NOW);
    expect(dash.offers.map((o) => o.assignmentId)).toEqual([offer.id]);
    expect(dash.offers[0].urgent).toBe(true);
  });

  it("logs every case view and keeps the audit chain intact", async () => {
    await buildCaseView(db, user("u-admin"), "lead-0001", NOW);
    const views = await db.audit.list((e) => e.action === "lead.view");
    expect(views).toHaveLength(1);
    expect(JSON.stringify(views[0].detail)).not.toMatch(/Taylor|Rivera/);
    expect(verifyAuditChain(await db.audit.list()).ok).toBe(true);
  });

  it("detects a tampered audit event", async () => {
    const events = await db.audit.list();
    events[1] = { ...events[1], action: "something.else" };
    expect(verifyAuditChain(events)).toEqual({ ok: false, brokenAtSeq: events[1].seq });
  });
});
