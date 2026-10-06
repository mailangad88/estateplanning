import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryDb, type Db } from "@/server/db";
import { seedDemo } from "@/server/seed";
import { capacityReport, monthlyLeadCeiling } from "@/server/services/capacity";
import type { Lawyer } from "@/server/types";

const NOW = new Date("2026-10-06T15:00:00Z");
const day = (d: number, h = 0) => new Date(NOW.getTime() + d * 86_400_000 + h * 3_600_000).toISOString();

let db: Db;
let lawyers: Lawyer[];

async function book(lawyerId: string, dayOffset: number, n: number, status: "booked" | "held" = "booked") {
  for (let i = 0; i < n; i++) {
    await db.consults.insert({ id: `c-${lawyerId}-${dayOffset}-${i}-${status}`, leadId: "x", lawyerId, at: day(dayOffset, i % 8), type: "video", status });
  }
}

beforeEach(async () => {
  db = createMemoryDb();
  await seedDemo(db, NOW);
  for (const c of await db.consults.list()) await db.consults.update(c.id, { status: "cancelled" });
  lawyers = (await db.lawyers.list()).filter((l) => l.active);
});

describe("capacity planner", () => {
  it("matches the research ceiling: 10 consults a week is about 190 to 210 consult leads a month", () => {
    expect(monthlyLeadCeiling(10)).toBeGreaterThanOrEqual(190);
    expect(monthlyLeadCeiling(10)).toBeLessThanOrEqual(210);
    expect(monthlyLeadCeiling(0)).toBe(0);
  });

  it("advises scaling when this week has open slots and leads are well under the ceiling", async () => {
    const r = await capacityReport(db, NOW);
    expect(r.spendAdvice).toBe("scale");
    expect(r.firm.soonestSlotDays).toBe(0);
    expect(r.lawyers.every((l) => l.status === "open")).toBe(true);
  });

  it("finds the first week with a free slot and marks a lawyer filling, then booked out", async () => {
    const lw = lawyers[0];
    await book(lw.id, 1, lw.weeklyCapacity);
    let row = (await capacityReport(db, NOW)).lawyers.find((l) => l.lawyerId === lw.id)!;
    expect(row.waitlistDays).toBe(7);
    expect(row.status).toBe("filling");
    await book(lw.id, 8, lw.weeklyCapacity);
    row = (await capacityReport(db, NOW)).lawyers.find((l) => l.lawyerId === lw.id)!;
    expect(row.waitlistDays).toBe(14);
    expect(row.status).toBe("booked_out");
  });

  it("throttles only when every attorney is booked out, and holds while one is filling", async () => {
    for (const lw of lawyers) await book(lw.id, 1, lw.weeklyCapacity);
    expect((await capacityReport(db, NOW)).spendAdvice).toBe("hold");
    for (const lw of lawyers) await book(lw.id, 8, lw.weeklyCapacity);
    const r = await capacityReport(db, NOW);
    expect(r.spendAdvice).toBe("throttle");
    expect(r.reason).toMatch(/booked out at least 14 days/);
  });

  it("throttles when incoming leads exceed what the calendar can absorb", async () => {
    const r0 = await capacityReport(db, NOW);
    const lead = (await db.leads.list())[0];
    for (let i = 0; i < r0.firm.monthlyLeadCeiling + 1; i++) {
      await db.leads.insert({ ...lead, id: `bulk-${i}`, createdAt: day(-1), exit: undefined });
    }
    const r = await capacityReport(db, NOW);
    expect(r.firm.utilization).toBeGreaterThanOrEqual(1);
    expect(r.spendAdvice).toBe("throttle");
  });

  it("counts held consults and scopes to one firm for firm admins", async () => {
    const lw = lawyers[0];
    await book(lw.id, -2, 3, "held");
    const r = await capacityReport(db, NOW, lw.firmId);
    expect(r.lawyers.every((l) => lawyers.find((x) => x.id === l.lawyerId)!.firmId === lw.firmId)).toBe(true);
    expect(r.lawyers.find((l) => l.lawyerId === lw.id)!.heldLast7).toBe(3);
    expect((await capacityReport(db, NOW, "no-such-firm")).spendAdvice).toBe("throttle");
  });
});
