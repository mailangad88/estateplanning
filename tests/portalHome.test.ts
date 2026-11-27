import { beforeEach, describe, expect, it } from "vitest";
import { activeHref } from "@/lib/navMatch";
import { isStaffPath } from "@/components/SiteChrome";
import { createMemoryDb, type Db } from "@/server/db";
import { portalHome } from "@/server/portal/home";
import { staffNav } from "@/server/portal/staffNav";
import { actorFor, DEMO_FIRM_ID, DEMO_USERS, seedDemo } from "@/server/seed";
import type { Actor, Lead } from "@/server/types";

const NOW = new Date("2026-11-26T15:00:00Z");
const DAY = 86_400_000;
const user = (id: string): Actor => actorFor(DEMO_USERS.find((u) => u.id === id)!, true);
let db: Db;

async function acceptedLead(id: string, stage: Lead["stage"], extra: Partial<Lead> = {}): Promise<Lead> {
  const base = (await db.leads.get("lead-0001"))!;
  return db.leads.insert({
    ...structuredClone(base), id, stage, firmId: DEMO_FIRM_ID, assignedLawyerId: "lawyer-a",
    stageHistory: [{ stage, at: new Date(NOW.getTime() - 20 * DAY).toISOString(), by: "u-intake" }], ...extra,
  });
}

beforeEach(async () => {
  db = createMemoryDb();
  await seedDemo(db, NOW);
  await db.users.insert({ id: "u-para-2", email: "para2@example.com", name: "Drew Paralegal", role: "paralegal", firmId: DEMO_FIRM_ID, supportsLawyerIds: ["lawyer-a"], active: true });
  await acceptedLead("case-mine", "paid", { assignedParalegalId: "u-paralegal" });
  await acceptedLead("case-theirs", "paid", { assignedParalegalId: "u-para-2" });
});

describe("staff sidebar", () => {
  it("groups pages by role: a paralegal gets only their own work", () => {
    const labels = staffNav(user("u-paralegal")).flatMap((g) => g.items.map((i) => i.href));
    expect(labels).toContain("/admin/cases");
    expect(labels).not.toContain("/admin/pipeline");
    expect(labels).not.toContain("/admin/analytics");
    const admin = staffNav(user("u-admin")).map((g) => g.label);
    expect(admin).toEqual(expect.arrayContaining(["Leads & cases", "Marketing", "Content review"]));
  });

  it("lights up the closest section and hides the marketing chrome only on staff pages", () => {
    expect(activeHref(["/portal", "/admin/cases", "/portal/queue"], "/admin/cases/case-1/intake")).toBe("/admin/cases");
    expect(activeHref(["/portal", "/portal/queue"], "/portal/queue")).toBe("/portal/queue");
    expect(isStaffPath("/portal")).toBe(true);
    expect(isStaffPath("/admin/cases")).toBe(true);
    expect(isStaffPath("/portals-guide")).toBe(false);
    expect(isStaffPath("/")).toBe(false);
  });
});

describe("portal home", () => {
  it("shows a paralegal only the cases assigned to them, by name", async () => {
    const home = await portalHome(db, user("u-paralegal"), NOW);
    expect(home.leads.map((l) => l.leadId)).toEqual(["case-mine"]);
    expect(home.work.every((w) => w.href.includes("case-mine"))).toBe(true);
    expect(home.leads[0].name).not.toMatch(/^[0-9a-f]{8}/);
    expect(home.kpis.find((k) => k.key === "open")?.value).toBe("1");
  });

  it("gives the office new leads to contact and cases without a paralegal", async () => {
    const home = await portalHome(db, user("u-firmadmin"), NOW);
    expect(home.kpis.map((k) => k.key)).toEqual(["new", "open", "stuck", "unassigned"]);
    expect(home.leads.length).toBeGreaterThan(0);
    expect(home.leads.every((l) => l.href.startsWith("/portal/leads/"))).toBe(true);
  });

  it("lists an attorney's own clients only and records the view", async () => {
    const home = await portalHome(db, user("u-lawyer-b"), NOW);
    expect(home.leads.map((l) => l.leadId)).not.toContain("case-mine");
    const log = await db.audit.list((e) => e.action === "portal.home");
    expect(log.length).toBe(1);
  });
});

describe("case list links", () => {
  it("keeps filters and drops one-off notices when opening a case", async () => {
    const { listHref } = await import("@/app/admin/cases/CaseList");
    expect(listHref({ q: "owen", group: "phase", updated: "drafted", error: "x" }, { open: "case-1" })).toBe("/admin/cases?q=owen&group=phase&open=case-1");
    expect(listHref({ open: "case-1" }, { open: undefined })).toBe("/admin/cases");
  });
});

describe("lead snapshot", () => {
  it("places a paid case in drafting, lists open tasks and names the paralegal", async () => {
    const { buildCaseView } = await import("@/server/portal/caseView");
    const { leadSnapshot } = await import("@/server/portal/leadSnapshot");
    await db.tasks.insert({ id: "t-1", leadId: "case-mine", title: "Call about the deed", ownerId: "u-paralegal", dueAt: new Date(NOW.getTime() - DAY).toISOString() });
    const view = await buildCaseView(db, user("u-lawyer-a"), "case-mine", NOW);
    const snap = await leadSnapshot(db, view, (await db.leads.get("case-mine"))!, NOW);
    expect(snap.phases.find((p) => p.state === "current")?.key).toBe("drafting");
    expect(snap.phases.filter((p) => p.state === "done").map((p) => p.key)).toEqual(["lead", "consult", "retainer"]);
    expect(snap.tasks).toEqual([expect.objectContaining({ title: "Call about the deed", overdue: true })]);
    expect(snap.details.find((d) => d.label === "Paralegal")?.value).toBe("Casey Paralegal");
  });
});
