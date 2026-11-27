import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, canOnLead } from "@/server/auth/policy";
import { createMemoryDb, type Db } from "@/server/db";
import { actorFor, DEMO_USERS, seedDemo } from "@/server/seed";
import { assignableLawyers, createManualLead, MANUAL_SEGMENT } from "@/server/services/manualLead";
import { questionnaireBrief } from "@/server/services/questionnaire";
import { prefillAnswers, QUESTIONNAIRE } from "@/lib/intakeQuestionnaire";
import type { Actor } from "@/server/types";

const NOW = new Date("2026-11-27T15:00:00Z");
const user = (id: string): Actor => actorFor(DEMO_USERS.find((u) => u.id === id)!, true);
let db: Db;

afterEach(() => vi.unstubAllEnvs());
beforeEach(async () => {
  vi.stubEnv("SERVED_STATES", "IL");
  db = createMemoryDb();
  await seedDemo(db, NOW);
});

const call = { firstName: "Robin", lastName: "Okafor", phone: "(630) 555-0142", email: "", county: "Kane", state: "IL", channel: "phone_call", matterType: "new_plan", maritalStatus: "married", children: "minors", ownsHome: "yes", assetRange: "250k_1m", notes: "Two kids, wants guardians named" };

describe("adding a lead by hand", () => {
  it("assigns an attorney's own entry to them, and they can open it and its intake form", async () => {
    const atty = user("u-lawyer-a");
    const lead = await createManualLead(db, atty, call, NOW);
    expect(lead.assignedLawyerId).toBe("lawyer-a");
    expect(lead.stage).toBe("accepted");
    expect(lead.stageHistory.map((s) => s.stage)).toEqual(["new", "contacted", "accepted"]);
    expect(lead.segments).toContain(MANUAL_SEGMENT);
    expect(lead.consent.smsConsent).toBe(false);
    const assignments = await db.assignments.list(undefined, { leadId: lead.id });
    expect(assignments.map((a) => a.status)).toEqual(["accepted"]);
    expect(canOnLead(atty, "view", lead, assignments, NOW)).toBe(true);
    const person = await db.persons.get(lead.personId);
    expect(person?.phone).toBe("6305550142");
    const brief = await questionnaireBrief(db, atty, lead, NOW);
    expect(brief?.answers.client_phone).toBe("6305550142");
    expect(brief?.answers.estimated_total).toBe("$250k to $1M");
    expect(brief?.canEdit).toBe(true);
    const comments = await db.comments.list(undefined, { leadId: lead.id });
    expect(comments[0]?.body).toMatch(/Entered by hand \(phone call\)[\s\S]*guardians/);
    expect((await db.audit.list((e) => e.action === "lead.manual_create")).length).toBe(1);
  });

  it("ignores another attorney picked by an attorney, and keeps a firm admin to their own firm", async () => {
    const lead = await createManualLead(db, user("u-lawyer-a"), { ...call, assignTo: "lawyer-b" }, NOW);
    expect(lead.assignedLawyerId).toBe("lawyer-a");
    const office = user("u-firmadmin");
    const choices = await assignableLawyers(db, office);
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.every((l) => l.firmId === office.firmId)).toBe(true);
    await expect(createManualLead(db, office, { ...call, email: "x@example.com", phone: "" }, NOW)).rejects.toThrow(/Pick an attorney/);
    await expect(createManualLead(db, office, { ...call, assignTo: "no-such-lawyer" }, NOW)).rejects.toThrow(ForbiddenError);
  });

  it("lets intake leave it in the queue, and refuses roles that cannot add leads", async () => {
    const lead = await createManualLead(db, user("u-intake"), { ...call, phone: "", email: "robin@example.com", channel: "referral", referredBy: "Dana CPA" }, NOW);
    expect(lead.assignedLawyerId).toBeUndefined();
    expect(lead.stage).toBe("new");
    expect(lead.source.referrer).toBe("Dana CPA");
    await expect(createManualLead(db, user("u-paralegal"), call, NOW)).rejects.toThrow(ForbiddenError);
    await expect(createManualLead(db, user("u-marketing"), call, NOW)).rejects.toThrow(ForbiddenError);
  });

  it("needs a name and a phone or email, and never matches two people on an empty email", async () => {
    await expect(createManualLead(db, user("u-intake"), { firstName: "", phone: "6305550142" }, NOW)).rejects.toThrow(/first name/);
    await expect(createManualLead(db, user("u-intake"), { firstName: "Al" }, NOW)).rejects.toThrow(/phone number or an email/);
    await expect(createManualLead(db, user("u-intake"), { firstName: "Al", phone: "123" }, NOW)).rejects.toThrow(/10-digit/);
    const a = await createManualLead(db, user("u-intake"), { firstName: "Al", phone: "6305550001" }, NOW);
    const b = await createManualLead(db, user("u-intake"), { firstName: "Bo", phone: "6305550002" }, NOW);
    expect(a.personId).not.toBe(b.personId);
  });

  it("logs an out-of-state lead as not a fit", async () => {
    const lead = await createManualLead(db, user("u-intake"), { ...call, state: "WI" }, NOW);
    expect(lead.exit?.reason).toBe("not_a_fit");
  });
});

describe("intake form questions", () => {
  it("has unique field ids across every section", () => {
    const ids = QUESTIONNAIRE.flatMap((s) => s.fields.map((f) => f.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(QUESTIONNAIRE.map((s) => s.id)).toEqual(["client", "family", "assets", "wishes", "health", "documents", "flags"]);
  });

  it("pre-fills contact details and what the website already asked", () => {
    const a = prefillAnswers(
      { county: "DuPage", intake: { summary: "", redFlags: [], deadlines: [], household: { members: [] }, assets: { range: "under_250k", ownsHome: false, outOfStateProperty: true, outOfStateStates: ["FL"] }, answers: {}, existingDocuments: "will_only", goals: "Protect the kids" } },
      { firstName: "Robin", lastName: "Okafor", phone: "6305550142", email: "robin@example.com" },
    );
    expect(a).toMatchObject({ client_full_name: "Robin Okafor", client_phone: "6305550142", client_email: "robin@example.com", client_address: "DuPage County", estimated_total: "Under $250k", home: "Rents (from the website intake)", existing_documents: "Has a will (from the website intake)", why_now: "Protect the kids" });
    expect(a.other_real_estate).toMatch(/FL/);
  });
});
