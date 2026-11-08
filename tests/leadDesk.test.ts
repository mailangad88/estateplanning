import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/server/auth/policy";
import { createMemoryDb, type Db } from "@/server/db";
import { actorFor, DEMO_USERS, seedDemo } from "@/server/seed";
import { seedLeadDeskDemo } from "@/server/seedLeadDesk";
import {
  callList,
  closeLead,
  createPhoneLead,
  decisions,
  deskLeads,
  deskStatus,
  exportLeads,
  filterLeads,
  leadsCsv,
  logContact,
  moveLead,
  pagePath,
  parseFilters,
  reopenLead,
  requestsByDay,
  statusCounts,
  todaySummary,
  updates,
} from "@/server/services/leadDesk";
import type { Actor } from "@/server/types";

const NOW = new Date("2026-11-08T18:00:00Z");
const user = (id: string): Actor => actorFor(DEMO_USERS.find((u) => u.id === id)!);
const admin = () => user("u-admin");

let db: Db;

beforeEach(async () => {
  db = createMemoryDb();
  await seedDemo(db, NOW);
  await seedLeadDeskDemo(db, NOW);
});

describe("leads desk rows", () => {
  it("maps stages to the five desk statuses", () => {
    expect(deskStatus({ stage: "new" }, false)).toBe("new");
    expect(deskStatus({ stage: "new" }, true)).toBe("talking");
    expect(deskStatus({ stage: "qualified" }, true)).toBe("talking");
    expect(deskStatus({ stage: "consult_held" }, true)).toBe("consult");
    expect(deskStatus({ stage: "paid" }, true)).toBe("retained");
    expect(deskStatus({ stage: "consult_booked", exit: { reason: "unresponsive", at: "" } }, true)).toBe("closed");
  });

  it("shows contact details, source page and tool for each lead", async () => {
    const rows = await deskLeads(db, admin(), NOW);
    const marcus = rows.find((r) => r.name === "Marcus Bell")!;
    expect(marcus.status).toBe("new");
    expect(marcus.toolLabel).toBe("Callback request");
    expect(marcus.sourcePage).toBe("/probate/illinois");
    expect(marcus.afterDeath).toBe(true);
    expect(marcus.waitingMinutes).toBe(180);
    expect(rows.find((r) => r.name === "Grace Whitfield")!.status).toBe("retained");
  });

  it("is for the office and platform admins only", async () => {
    await expect(deskLeads(db, user("u-marketing"), NOW)).rejects.toThrow(ForbiddenError);
    await expect(deskLeads(db, user("u-lawyer-a"), NOW)).rejects.toThrow(ForbiddenError);
    expect((await deskLeads(db, user("u-intake"), NOW)).length).toBeGreaterThan(0);
  });
});

describe("filters and CSV", () => {
  it("parses only valid filters", () => {
    expect(parseFilters({ status: "nope", from: "2026-13", q: " bell " })).toEqual({ q: "bell", status: undefined, tool: undefined, page: undefined, from: undefined, to: undefined });
    expect(parseFilters({ status: "open", from: "2026-11-01" }).from).toBe("2026-11-01");
  });

  it("searches by name, email and phone digits and filters by tool, page and status", async () => {
    const rows = await deskLeads(db, admin(), NOW);
    expect(filterLeads(rows, { q: "bell" }).map((r) => r.name)).toEqual(["Marcus Bell"]);
    expect(filterLeads(rows, { q: "elena.sorensen@" }).length).toBe(1);
    const phone = rows.find((r) => r.name === "Dev Kapoor")!.phone;
    expect(filterLeads(rows, { q: `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}` }).map((r) => r.name)).toEqual(["Dev Kapoor"]);
    expect(filterLeads(rows, { tool: "guide" }).every((r) => r.tool === "guide")).toBe(true);
    expect(filterLeads(rows, { page: "/living-trusts" }).map((r) => r.name)).toEqual(["Hannah Moreau"]);
    expect(filterLeads(rows, { status: "open" }).some((r) => r.status === "closed")).toBe(false);
  });

  it("neutralises spreadsheet formulas and quotes commas", async () => {
    const rows = await deskLeads(db, admin(), NOW);
    const csv = leadsCsv([{ ...rows[0], name: "=HYPERLINK(\"x\")", county: "Kane, IL" }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(`"Kane, IL"`);
  });

  it("lets owners and office admins export, and audits it without the rows", async () => {
    const { count, csv } = await exportLeads(db, admin(), { status: "open" }, NOW);
    expect(csv.split("\r\n")[0]).toMatch(/^Received,Name,Email,Phone/);
    expect(count).toBeGreaterThan(5);
    const ev = (await db.audit.list()).find((e) => e.action === "lead.export")!;
    expect(ev.detail).toMatchObject({ count });
    expect(JSON.stringify(ev.detail)).not.toContain("@example.com");
    await expect(exportLeads(db, user("u-intake"), {}, NOW)).rejects.toThrow(ForbiddenError);
  });
});

describe("today", () => {
  it("puts people waiting on a reply first, urgent ones on top", async () => {
    const rows = await deskLeads(db, admin(), NOW);
    const items = decisions(rows, NOW);
    expect(items[0].title).toMatch(/Marcus Bell lost someone/);
    expect(items[0].action?.href).toMatch(/^tel:\+1630/);
    const kinds = items.map((i) => i.kind);
    expect(kinds.lastIndexOf("fix")).toBeLessThan(kinds.indexOf("yours"));
    expect(items.some((i) => i.title === "Record how Tom's consult went")).toBe(true);
    expect(items.some((i) => i.title === "Check how Victor's referral went")).toBe(true);
  });

  it("does not flag a lead in its first five minutes", async () => {
    const rows = await deskLeads(db, admin(), NOW);
    const fresh = { ...rows[0], waitingMinutes: 3, status: "new" as const };
    expect(decisions([fresh], NOW).filter((i) => i.kind === "fix")).toEqual([]);
  });

  it("summarises the last 24 hours and the week", async () => {
    const rows = await deskLeads(db, admin(), NOW);
    const s = await todaySummary(db, rows, decisions(rows, NOW), NOW);
    expect(s.waiting).toBe(4);
    expect(s.longestWaitMinutes).toBe(26 * 60);
    expect(s.automatic).toBeGreaterThan(0);
    const days = requestsByDay(rows, NOW);
    expect(days).toHaveLength(7);
    expect(days.at(-1)!.label).toBe("Today");
    const counts = statusCounts(rows);
    expect(counts.new).toBe(4);
    expect(counts.closed).toBeGreaterThanOrEqual(1);
    const news = await updates(db, rows, NOW);
    expect(news.some((u) => u.title === "Grace Whitfield signed and is now a client")).toBe(true);
  });

  it("call list holds people with a phone nobody has reached", async () => {
    const rows = await deskLeads(db, admin(), NOW);
    const list = callList(rows);
    expect(list[0].name).toBe("Marcus Bell");
    expect(list.every((r) => r.phone && r.status !== "closed")).toBe(true);
  });
});

describe("writes", () => {
  it("logging a reached call stops the reply clock and moves the lead to Talking", async () => {
    await logContact(db, admin(), "lead-d03", { kind: "call", result: "reached", note: "Call back Tuesday" }, NOW);
    const row = (await deskLeads(db, admin(), NOW)).find((r) => r.id === "lead-d03")!;
    expect(row.status).toBe("talking");
    expect(row.waitingMinutes).toBeNull();
    expect(row.attempts).toBe(1);
  });

  it("a voicemail counts as a try but keeps the status", async () => {
    await logContact(db, admin(), "lead-d01", { kind: "call", result: "voicemail" }, NOW);
    const lead = await db.leads.get("lead-d01");
    expect(lead!.stage).toBe("new");
  });

  it("moves, closes and reopens with audit events", async () => {
    await moveLead(db, admin(), "lead-d05", "qualified", NOW);
    expect((await db.leads.get("lead-d05"))!.stage).toBe("qualified");
    await expect(moveLead(db, admin(), "lead-d05", "plan_complete", NOW)).rejects.toThrow(/Pick a status/);
    await closeLead(db, admin(), "lead-d05", "chose_another_option", "Went with a family friend", NOW);
    expect((await db.leads.get("lead-d05"))!.exit?.reason).toBe("chose_another_option");
    await expect(moveLead(db, admin(), "lead-d05", "contacted", NOW)).rejects.toThrow(/Reopen/);
    await reopenLead(db, admin(), "lead-d05", NOW);
    expect((await db.leads.get("lead-d05"))!.exit).toBeUndefined();
    expect((await db.audit.list()).some((e) => e.action === "lead.reopen")).toBe(true);
  });

  it("only closes for reasons a person decides", async () => {
    await expect(closeLead(db, admin(), "lead-d05", "conflict", undefined, NOW)).rejects.toThrow(/reason/);
  });

  it("refuses roles without the desk", async () => {
    await expect(logContact(db, user("u-marketing"), "lead-d01", { kind: "call", result: "reached" }, NOW)).rejects.toThrow(ForbiddenError);
  });

  it("adds a phone-call lead that starts as Talking", async () => {
    process.env.SERVED_STATES = "IL";
    const lead = await createPhoneLead(db, user("u-intake"), { firstName: "Walter", lastName: "Nguyen", phone: "(630) 555-4412", state: "IL", county: "Kane", matterType: "new_plan", notes: "Trust for the lake house" }, NOW);
    expect(lead.capture?.tool).toBe("phone_call");
    expect(lead.stage).toBe("contacted");
    expect(lead.intakeOwnerId).toBe("u-intake");
    expect(lead.consent.smsConsent).toBe(false);
    const row = (await deskLeads(db, admin(), NOW)).find((r) => r.id === lead.id)!;
    expect(row.status).toBe("talking");
    expect(row.toolLabel).toBe("Phone call");
    await expect(createPhoneLead(db, admin(), { firstName: "X", phone: "123", state: "IL" }, NOW)).rejects.toThrow(/10-digit/);
    delete process.env.SERVED_STATES;
  });
});

it("pagePath strips host and query", () => {
  expect(pagePath("https://familyfutureplanning.com/probate/illinois?utm_source=x")).toBe("/probate/illinois");
  expect(pagePath(undefined)).toBe("");
});
