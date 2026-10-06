import { beforeEach, describe, expect, it } from "vitest";
import { runAutomations } from "@/server/automation";
import { CrmSync } from "@/server/crm/sync";
import { MockCrmAdapter } from "@/server/crm/mock";
import { createMemoryDb, type Db } from "@/server/db";
import { actorFor, DEMO_USERS, seedDemo } from "@/server/seed";
import { addComment } from "@/server/services/caseWork";
import { exitLead, setStage } from "@/server/services/leads";

const NOW = new Date("2026-03-02T15:00:00Z");
const intake = actorFor(DEMO_USERS.find((u) => u.id === "u-intake")!);

let db: Db;
let adapter: MockCrmAdapter;
let crm: CrmSync;

const active = (leadId: string, seq: string) => db.enrollments.list((e) => e.leadId === leadId && e.sequenceId === seq && e.status === "active");

beforeEach(() => {
  db = createMemoryDb();
  seedDemo(db, NOW);
  adapter = new MockCrmAdapter();
  crm = new CrmSync(adapter, { sleep: async () => {} });
});

describe("runAutomations", () => {
  it("first run enrolls and syncs both leads", async () => {
    const r = await runAutomations(db, crm, NOW);
    expect(r.enrolled).toBeGreaterThanOrEqual(2);
    expect(r.crmSynced).toBe(2);
    expect(r.crmFailures).toBe(0);
    for (const id of ["lead-0001", "lead-0002"]) {
      expect(active(id, "speed_to_lead")).toHaveLength(1);
      expect(db.leads.get(id)!.crmId).toBeTruthy();
    }
    expect(adapter.count("upsertMatter")).toBe(2);
  });

  it("second run with no changes is a no-op", async () => {
    await runAutomations(db, crm, NOW);
    const enrollments = db.enrollments.list().length;
    const r = await runAutomations(db, crm, NOW);
    expect(r.enrolled).toBe(0);
    expect(r.stageChanges).toBe(0);
    expect(r.exits).toBe(0);
    expect(adapter.count("upsertMatter")).toBe(2);
    expect(adapter.count("upsertContact")).toBe(2);
    expect(adapter.count("setStage")).toBe(0);
    expect(db.enrollments.list()).toHaveLength(enrollments);
  });

  it("stage change runs onStageChange effects and syncStage", async () => {
    await runAutomations(db, crm, NOW);
    setStage(db, intake, "lead-0001", "consult_booked", NOW);
    const r = await runAutomations(db, crm, NOW);
    expect(r.stageChanges).toBe(1);
    expect(active("lead-0001", "consult_booked")).toHaveLength(1);
    expect(active("lead-0001", "speed_to_lead")).toHaveLength(0);
    const calls = adapter.calls.filter((c) => c.op === "setStage");
    expect(calls).toHaveLength(1);
    expect(calls[0].args[1]).toBe("consult_booked");
    // and it settles
    const again = await runAutomations(db, crm, NOW);
    expect(again.stageChanges).toBe(0);
    expect(adapter.count("setStage")).toBe(1);
  });

  it("exit unresponsive moves to long_term", async () => {
    await runAutomations(db, crm, NOW);
    exitLead(db, intake, "lead-0001", "unresponsive", undefined, NOW);
    const r = await runAutomations(db, crm, NOW);
    expect(r.exits).toBe(1);
    expect(active("lead-0001", "long_term")).toHaveLength(1);
    expect(active("lead-0001", "speed_to_lead")).toHaveLength(0);
    const set = adapter.calls.filter((c) => c.op === "setStage").at(-1)!;
    expect(set.args[2]).toBe("unresponsive");
  });

  it("exit not_a_fit stops all nurture without long_term", async () => {
    await runAutomations(db, crm, NOW);
    exitLead(db, intake, "lead-0001", "not_a_fit", undefined, NOW);
    await runAutomations(db, crm, NOW);
    expect(db.enrollments.list((e) => e.leadId === "lead-0001" && e.status === "active")).toHaveLength(0);
  });

  it("CRM failure is counted and does not throw", async () => {
    const orig = console.error;
    console.error = () => {};
    try {
      adapter.failWith = [new Error("net"), new Error("net"), new Error("net"), new Error("net")]; // exhausts 4 attempts on first lead
      const r = await runAutomations(db, crm, NOW);
      expect(r.crmFailures).toBe(1);
      expect(r.crmSynced).toBe(1);
      expect(r.enrolled).toBeGreaterThanOrEqual(2); // nurture unaffected
      expect(db.leads.get("lead-0001")!.crmId).toBeUndefined();
      expect(db.leads.get("lead-0002")!.crmId).toBeTruthy();
      expect(db.audit.list((e) => e.action === "crm.sync" && (e.detail as { ok: boolean }).ok === false)).toHaveLength(1);
      // The next run retries the lead whose first sync failed.
      await runAutomations(db, crm, NOW);
      expect(db.leads.get("lead-0001")!.crmId).toBeTruthy();
    } finally {
      console.error = orig;
    }
  });

  it("syncs firm-visible comments, not internal ones", async () => {
    await runAutomations(db, crm, NOW);
    addComment(db, intake, { leadId: "lead-0001", body: "visible to firm", visibility: "firm" }, NOW);
    addComment(db, intake, { leadId: "lead-0001", body: "secret", visibility: "internal" }, NOW);
    const r = await runAutomations(db, crm, NOW);
    expect(adapter.count("addNote")).toBe(1);
    expect(adapter.matters.get(db.leads.get("lead-0001")!.crmId!)!.notes).toEqual(["visible to firm"]);
    expect(r.crmFailures).toBe(0);
  });

  it("works with no CRM configured", async () => {
    const r = await runAutomations(db, null, NOW);
    expect(r.crmSynced).toBe(0);
    expect(r.enrolled).toBeGreaterThanOrEqual(2);
  });
});
