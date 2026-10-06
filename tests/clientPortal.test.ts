import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/server/auth/policy";
import { createMemoryDb, type Db } from "@/server/db";
import { actorFor, DEMO_USERS, seedDemo } from "@/server/seed";
import { addComment, registerDocument, scanDocument, mockScanner } from "@/server/services/caseWork";
import { acceptInvite, clientStatus, inviteClient, INVITE_TTL_MS, signInvite, verifyInvite } from "@/server/services/clientPortal";
import { acceptOffer } from "@/server/services/routing";
import { setStage } from "@/server/services/leads";
import type { Actor } from "@/server/types";

const NOW = new Date("2026-10-06T15:00:00Z");
const LEAD = "lead-0002";
const user = (id: string) => actorFor(DEMO_USERS.find((u) => u.id === id)!);

let db: Db;
let attorney: Actor;

async function setup(accept = true) {
  db = createMemoryDb();
  await seedDemo(db, NOW);
  const offer = (await db.assignments.list((a) => a.leadId === LEAD && a.status === "offered"))[0];
  attorney = actorFor(DEMO_USERS.find((u) => u.lawyerId === offer.lawyerId)!);
  if (accept) await acceptOffer(db, attorney, offer.id, NOW);
}

async function clientActor(): Promise<Actor> {
  const { token } = await inviteClient(db, attorney, LEAD, NOW);
  const { userId } = await acceptInvite(db, token, NOW);
  return actorFor((await db.users.get(userId))!);
}

describe("invite permissions", () => {
  beforeEach(() => setup());

  it("forbids intake, marketing and an unassigned attorney", async () => {
    const other = actorFor(DEMO_USERS.find((u) => u.role === "attorney" && u.lawyerId !== attorney.lawyerId)!);
    for (const a of [user("u-intake"), user("u-marketing"), other]) {
      await expect(inviteClient(db, a, LEAD, NOW)).rejects.toThrow(ForbiddenError);
    }
  });

  it("allows the assigned attorney and platform admin", async () => {
    const r = await inviteClient(db, attorney, LEAD, NOW);
    expect(r.link).toMatch(/^\/client\/welcome\?token=/);
    await expect(inviteClient(db, user("u-admin"), LEAD, NOW)).resolves.toBeDefined();
  });

  it("reuses the same client user and links it to the person", async () => {
    const a = await inviteClient(db, attorney, LEAD, NOW);
    const b = await inviteClient(db, attorney, LEAD, NOW);
    expect(a.userId).toBe(b.userId);
    const u = (await db.users.get(a.userId))!;
    expect(u.role).toBe("client");
    expect(u.personId).toBe((await db.leads.get(LEAD))!.personId);
  });

  it("is refused before the case is accepted", async () => {
    await setup(false);
    await expect(inviteClient(db, user("u-admin"), LEAD, NOW)).rejects.toThrow(/accepts/);
  });
});

describe("invite tokens", () => {
  beforeEach(() => setup());

  it("works once", async () => {
    const { token } = await inviteClient(db, attorney, LEAD, NOW);
    const r = await acceptInvite(db, token, NOW);
    expect(r.session).toBeTruthy();
    expect(r.mfa).toBe(false);
    await expect(acceptInvite(db, token, NOW)).rejects.toThrow(/already been used/);
  });

  it("expires after seven days", async () => {
    const { token } = await inviteClient(db, attorney, LEAD, NOW);
    await expect(acceptInvite(db, token, new Date(NOW.getTime() + INVITE_TTL_MS + 1000))).rejects.toThrow(/not valid/);
  });

  it("rejects a tampered token", async () => {
    const { token } = await inviteClient(db, attorney, LEAD, NOW);
    const [data, sig] = token.split(".");
    const p = JSON.parse(Buffer.from(data, "base64url").toString());
    const forged = `${Buffer.from(JSON.stringify({ ...p, uid: "u-admin" })).toString("base64url")}.${sig}`;
    expect(verifyInvite(forged, NOW)).toBeNull();
    await expect(acceptInvite(db, forged, NOW)).rejects.toThrow(/not valid/);
    expect(verifyInvite(signInvite({ ...p }), NOW)).not.toBeNull();
  });
});

describe("what the client sees", () => {
  beforeEach(() => setup());

  it("only client-visible comments and documents", async () => {
    const client = await clientActor();
    await addComment(db, attorney, { leadId: LEAD, body: "Internal strategy note", visibility: "firm" }, NOW);
    await addComment(db, attorney, { leadId: LEAD, body: "Welcome aboard", visibility: "client" }, NOW);
    await addComment(db, client, { leadId: LEAD, body: "Hello" }, NOW);
    const firmDoc = await registerDocument(db, attorney, { leadId: LEAD, name: "notes.pdf", kind: "other", contentType: "application/pdf", sizeBytes: 100, visibility: "firm" }, NOW);
    const clientDoc = await registerDocument(db, client, { leadId: LEAD, name: "deed.pdf", kind: "deed", contentType: "application/pdf", sizeBytes: 100 }, NOW);
    await scanDocument(db, mockScanner, firmDoc.id, NOW);
    const s = await clientStatus(db, client, LEAD, NOW);
    expect(s.comments.map((c) => c.body).sort()).toEqual(["Hello", "Welcome aboard"]);
    expect(s.comments.every((c) => c.visibility === "client")).toBe(true);
    expect(s.documents.map((d) => d.id)).toEqual([clientDoc.id]);
    expect(s.checklist.find((c) => c.key === "deeds")!.uploaded).toBe(1);
    expect(s.checklist.find((c) => c.key === "will_trust")!.uploaded).toBe(0);
  });

  it("posts client messages with client visibility, even if firm is asked for", async () => {
    const client = await clientActor();
    const c = await addComment(db, client, { leadId: LEAD, body: "Question" }, NOW);
    expect(c.visibility).toBe("client");
    await expect(addComment(db, client, { leadId: LEAD, body: "x", visibility: "firm" }, NOW)).rejects.toThrow(ForbiddenError);
  });

  it("cannot see another person's lead", async () => {
    const client = await clientActor();
    const otherLead = (await db.leads.list((l) => l.id !== LEAD))[0];
    await expect(clientStatus(db, client, otherLead.id, NOW)).rejects.toThrow(ForbiddenError);
  });

  it("builds the timeline from the stage", async () => {
    const client = await clientActor();
    let s = await clientStatus(db, client, LEAD, NOW);
    expect(s.steps.filter((x) => x.done).map((x) => x.label)).toEqual(["We received your request", "Your attorney accepted your case"]);
    expect(s.steps.find((x) => x.current)!.label).toBe("Your attorney accepted your case");
    await setStage(db, attorney, LEAD, "retainer_signed", NOW);
    s = await clientStatus(db, client, LEAD, NOW);
    expect(s.steps.filter((x) => x.done)).toHaveLength(5);
    expect(s.steps.find((x) => x.current)!.label).toBe("Signed");
    expect(s.steps[5].done).toBe(false);
  });
});
