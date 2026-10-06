import { describe, expect, it } from "vitest";
import { createMemoryDb, type Db } from "@/server/db";
import { verifyAuditChain } from "@/server/audit/log";
import { ForbiddenError } from "@/server/auth/policy";
import { eligibleForClientChoice, rankLawyers, type RoutingInput } from "@/server/routing/engine";
import { acceptOffer, declineOffer, offerNext, recordClientChoice, sweepExpiredOffers } from "@/server/services/routing";
import type { Actor, Lawyer, Lead, Person } from "@/server/types";

const NOW = new Date("2026-03-02T15:00:00Z");
const mins = (m: number) => new Date(NOW.getTime() + m * 60_000);

function lawyer(id: string, over: Partial<Lawyer> = {}): Lawyer {
  return {
    id, firmId: "f1", name: `Lawyer ${id}`, email: `${id}@x.test`,
    licensedStates: ["TX"], matterTypes: ["new_plan"], specialties: [], languages: ["English"],
    weeklyCapacity: 5, activeLeadCap: 5, acceptSlaMinutes: 30, active: true,
    stats: { avgAcceptMinutes: 60, showRate: 0.8, reviewScore: 4.5 },
    ...over,
  };
}

function lead(id: string, over: Partial<Lead> = {}): Lead {
  return {
    id, personId: `p-${id}`, createdAt: NOW.toISOString(), stage: "qualified", stageHistory: [],
    matterType: "new_plan", state: "TX", urgent: false,
    score: { score: 70, tier: "hot", redFlags: [] }, segments: [], source: {},
    consent: {} as Lead["consent"], offerSummary: "Summary",
    conflictCard: { clientName: "A B", parties: [], matterType: "new_plan", state: "TX", clearance: "clear" },
    intake: { summary: "", redFlags: [], deadlines: [], household: { members: [] }, assets: {}, answers: {} },
    ...over,
  };
}

function person(id: string, over: Partial<Person> = {}): Person {
  return { id, firstName: "A", lastName: "B", email: "a@b.test", phone: "1", language: "English", state: "TX", ...over };
}

async function setup(lawyers: Lawyer[], leads: Lead[] = [lead("L1")]): Promise<Db> {
  const db = createMemoryDb();
  await db.firms.insert({ id: "f1", name: "Firm", structure: "in_firm" });
  for (const l of lawyers) await db.lawyers.insert(l);
  for (const l of leads) {
    if (!(await db.persons.get(l.personId))) await db.persons.insert(person(l.personId));
    await db.leads.insert(l);
  }
  return db;
}

async function input(db: Db, leadId = "L1", now = NOW): Promise<RoutingInput> {
  const l = (await db.leads.get(leadId))!;
  const p = (await db.persons.get(l.personId))!;
  return {
    lead: l, person: p, lawyers: await db.lawyers.list(), assignments: await db.assignments.list(),
    leads: await db.leads.list(), consults: await db.consults.list(), now,
    householdPersonIds: p.householdId ? (await db.persons.list((x) => x.householdId === p.householdId && x.id !== p.id)).map((x) => x.id) : [],
  };
}

const ids = async (db: Db, leadId = "L1") => rankLawyers(await input(db, leadId)).ranked.map((r) => r.lawyerId);
const why = async (db: Db, id: string, leadId = "L1") => rankLawyers(await input(db, leadId)).excluded.find((e) => e.lawyerId === id)?.reason;

const attorney = (lawyerId: string): Actor => ({ userId: `u-${lawyerId}`, role: "attorney", lawyerId, firmId: "f1", mfa: true });

describe("hard filters", async () => {
  it("excludes inactive lawyers", async () => {
    const db = await setup([lawyer("a"), lawyer("b", { active: false })]);
    expect(await ids(db)).toEqual(["a"]);
    expect(await why(db, "b")).toMatch(/active/i);
  });

  it("requires a licence in the client's state", async () => {
    const db = await setup([lawyer("a"), lawyer("b", { licensedStates: ["CA"] })]);
    expect(await ids(db)).toEqual(["a"]);
    expect(await why(db, "b")).toMatch(/licensed in TX/);
  });

  it("requires every property state for administration but not for other matters", async () => {
    const assets = { outOfStateStates: ["FL"] };
    const admin = lead("L1", { matterType: "administration", intake: { ...lead("x").intake, assets } });
    const db = await setup([lawyer("a", { matterTypes: ["administration"] }), lawyer("b", { matterTypes: ["administration"], licensedStates: ["TX", "FL"] })], [admin]);
    expect(await ids(db)).toEqual(["b"]);
    expect(await why(db, "a")).toMatch(/FL/);

    const plan = lead("L1", { intake: { ...lead("x").intake, assets } });
    expect(await ids(await setup([lawyer("a")], [plan]))).toEqual(["a"]);
  });

  it("requires the matter type", async () => {
    const db = await setup([lawyer("a"), lawyer("b", { matterTypes: ["elder_law"] })]);
    expect(await ids(db)).toEqual(["a"]);
  });

  it("excludes on conflict and skips lawyers who already declined or let it expire", async () => {
    const db = await setup([lawyer("a"), lawyer("b"), lawyer("c")]);
    for (const [lawyerId, status] of [["a", "declined"], ["b", "expired"]] as const) {
      await db.assignments.insert({ id: `as-${lawyerId}`, leadId: "L1", lawyerId, firmId: "f1", offeredAt: NOW.toISOString(), expiresAt: NOW.toISOString(), status, routingReason: "" });
    }
    expect(await ids(db)).toEqual(["c"]);
    await db.leads.update("L1", { conflictCard: { ...lead("x").conflictCard, clearance: "conflict" } });
    expect(await ids(db)).toEqual([]);
  });

  it("enforces the open lead cap, ignoring signed and exited leads", async () => {
    const mine = (id: string, over: Partial<Lead>) => lead(id, { assignedLawyerId: "a", ...over });
    const db = await setup(
      [lawyer("a", { activeLeadCap: 2 }), lawyer("b")],
      [lead("L1"), mine("O1", { stage: "accepted" }), mine("O2", { stage: "retainer_signed" }), mine("O3", { stage: "consult_held", exit: { reason: "unresponsive", at: "x" } })],
    );
    expect(await ids(db)).toContain("a"); // only one open lead
    await db.leads.insert(mine("O4", { stage: "proposal_sent" }));
    expect(await ids(db)).toEqual(["b"]);
    expect(await why(db, "a")).toMatch(/cap/);
  });

  it("enforces weekly consult capacity for the next 7 days only", async () => {
    const db = await setup([lawyer("a", { weeklyCapacity: 1 })]);
    await db.consults.insert({ id: "c1", leadId: "X", lawyerId: "a", at: mins(60 * 24 * 10).toISOString(), type: "video", status: "booked" });
    await db.consults.insert({ id: "c2", leadId: "X", lawyerId: "a", at: mins(60 * 24 * 2).toISOString(), type: "video", status: "cancelled" });
    expect(await ids(db)).toEqual(["a"]);
    await db.consults.insert({ id: "c3", leadId: "X", lawyerId: "a", at: mins(60 * 24 * 2).toISOString(), type: "video", status: "booked" });
    expect(await ids(db)).toEqual([]);
    expect(await why(db, "a")).toMatch(/weekly/);
  });

  it("matches non-English client language case-insensitively", async () => {
    const db = await setup([lawyer("a"), lawyer("b", { languages: ["English", "spanish"] })]);
    await db.persons.update("p-L1", { language: "Spanish" });
    expect(await ids(db)).toEqual(["b"]);
    expect(await why(db, "a")).toMatch(/Spanish/);
  });
});

describe("ranking", async () => {
  it("ranks closer lawyers first for in-person clients only", async () => {
    const base = lead("L1");
    const near = lawyer("near", { office: { lat: 30.27, lng: -97.74 } });
    const far = lawyer("far", { office: { lat: 32.78, lng: -96.8 } });
    const inPerson = lead("L1", { intake: { ...base.intake, needsInPerson: true, clientLocation: { lat: 30.3, lng: -97.7 } } });
    expect(await ids(await setup([far, near], [inPerson]))).toEqual(["near", "far"]);
    // Remote client: distance ignored, so a tie goes to id order.
    expect(await ids(await setup([far, near], [base]))).toEqual(["far", "near"]);
  });

  it("prefers specialty fit", async () => {
    const base = lead("L1");
    const l = lead("L1", { intake: { ...base.intake, answers: { specialNeeds: "yes" } } });
    const db = await setup([lawyer("a"), lawyer("b", { specialties: ["special_needs"] })], [l]);
    const r = rankLawyers(await input(db));
    expect(r.ranked.map((x) => x.lawyerId)).toEqual(["b", "a"]);
    expect(r.ranked[0].reason).toMatch(/special_needs/);
  });

  it("prefers faster, higher show rate and better reviewed lawyers, never retention", async () => {
    const db = await setup([
      lawyer("slow", { stats: { avgAcceptMinutes: 110, showRate: 0.5, reviewScore: 3 } }),
      lawyer("fast", { stats: { avgAcceptMinutes: 5, showRate: 0.9, reviewScore: 4.9 } }),
    ]);
    expect(await ids(db)).toEqual(["fast", "slow"]);
  });

  it("rotates among ties by least recent offer, then lawyer id", async () => {
    const db = await setup([lawyer("a"), lawyer("b"), lawyer("c")], [lead("L1"), lead("L0")]);
    await db.assignments.insert({ id: "as1", leadId: "L0", lawyerId: "a", firmId: "f1", offeredAt: mins(-10).toISOString(), expiresAt: mins(20).toISOString(), status: "accepted", routingReason: "" });
    await db.assignments.insert({ id: "as2", leadId: "L0", lawyerId: "b", firmId: "f1", offeredAt: mins(-100).toISOString(), expiresAt: mins(20).toISOString(), status: "accepted", routingReason: "" });
    expect(await ids(db)).toEqual(["c", "b", "a"]);
  });
});

describe("special cases", async () => {
  const three = () => [lawyer("a"), lawyer("b"), lawyer("c")];

  it("sends urgent leads to an on-call lawyer first", async () => {
    const db = await setup([lawyer("a"), lawyer("b"), lawyer("c", { onCall: true })], [lead("L1", { urgent: true })]);
    const r = rankLawyers(await input(db));
    expect(r.ranked[0].lawyerId).toBe("c");
    expect(r.special).toBe("urgent_on_call");
  });

  it("sends returning clients to their prior lawyer when eligible, else ranks normally", async () => {
    const db = await setup(three(), [lead("L1", { previousLawyerId: "c" })]);
    expect(rankLawyers(await input(db)).special).toBe("returning_client");
    expect((await ids(db))[0]).toBe("c");
    await db.lawyers.update("c", { active: false });
    expect(rankLawyers(await input(db)).special).toBeUndefined();
    expect((await ids(db))[0]).toBe("a");
  });

  it("honours a partner referral naming a lawyer", async () => {
    const db = await setup(three(), [lead("L1", { requestedLawyerId: "b" })]);
    expect(rankLawyers(await input(db)).special).toBe("requested_lawyer");
    expect((await ids(db))[0]).toBe("b");
  });

  it("keeps household members with the same lawyer", async () => {
    const db = await setup(three(), [lead("L1", { personId: "p1" }), lead("L2", { personId: "p2", assignedLawyerId: "c", stage: "accepted" })]);
    await db.persons.update("p1", { householdId: "h1" });
    await db.persons.update("p2", { householdId: "h1" });
    const r = rankLawyers(await input(db));
    expect(r.special).toBe("household");
    expect(r.ranked[0].lawyerId).toBe("c");
  });

  it("limits candidates to the client's choices, in their order, still hard-filtered", async () => {
    const db = await setup([...three(), lawyer("d", { active: false })], [lead("L1", { clientChoiceLawyerIds: ["d", "c", "b"] })]);
    const r = rankLawyers(await input(db));
    expect(r.ranked.map((x) => x.lawyerId)).toEqual(["c", "b"]);
    expect(r.excluded.map((x) => x.lawyerId)).toEqual(["d"]);
    expect(r.special).toBe("client_choice");
  });

  it("offers up to three eligible lawyers with name and bio for client choice", async () => {
    const db = await setup([lawyer("a", { bio: "Bio A" }), lawyer("b"), lawyer("c"), lawyer("d"), lawyer("e", { active: false })]);
    const options = eligibleForClientChoice(await input(db));
    expect(options).toHaveLength(3);
    expect(options[0]).toEqual({ lawyerId: "a", name: "Lawyer a", bio: "Bio A" });
  });
});

describe("offer lifecycle", async () => {
  it("offers, then accepts", async () => {
    const db = await setup([lawyer("a", { acceptSlaMinutes: 15 })]);
    const { offered } = await offerNext(db, "L1", NOW);
    expect(offered).toMatchObject({ lawyerId: "a", firmId: "f1", status: "offered", expiresAt: mins(15).toISOString() });
    expect(offered!.routingReason).toMatch(/Rank 1/);
    expect((await db.leads.get("L1"))!.stage).toBe("offered");
    expect((await db.leads.get("L1"))!.stageHistory.at(-1)).toMatchObject({ stage: "offered", by: "system" });

    const updated = await acceptOffer(db, attorney("a"), offered!.id, mins(5));
    expect(updated).toMatchObject({ assignedLawyerId: "a", firmId: "f1", stage: "accepted" });
    expect(await db.assignments.get(offered!.id)).toMatchObject({ status: "accepted", slaMet: true });
    expect(verifyAuditChain(await db.audit.list()).ok).toBe(true);
    expect((await db.audit.list()).map((e) => e.action)).toEqual(["routing.offer", "routing.accept"]);
  });

  it("refuses a second offer while one is open, after acceptance, after exit and on conflict", async () => {
    const db = await setup([lawyer("a"), lawyer("b")]);
    const { offered } = await offerNext(db, "L1", NOW);
    await expect(offerNext(db, "L1", NOW)).rejects.toThrow(/open offer/);
    await acceptOffer(db, attorney("a"), offered!.id, NOW);
    await expect(offerNext(db, "L1", NOW)).rejects.toThrow(/accepted/);

    const db2 = await setup([lawyer("a")], [lead("L1", { exit: { reason: "unresponsive", at: "x" } })]);
    await expect(offerNext(db2, "L1", NOW)).rejects.toThrow(/exited/);
    const db3 = await setup([lawyer("a")], [lead("L1", { conflictCard: { ...lead("x").conflictCard, clearance: "conflict" } })]);
    await expect(offerNext(db3, "L1", NOW)).rejects.toThrow(/conflict/);
  });

  it("rejects acceptance by the wrong attorney or other roles", async () => {
    const db = await setup([lawyer("a"), lawyer("b")]);
    const { offered } = await offerNext(db, "L1", NOW);
    await expect(acceptOffer(db, attorney("b"), offered!.id, NOW)).rejects.toThrow(ForbiddenError);
    await expect(acceptOffer(db, { userId: "u", role: "firm_admin", lawyerId: "a", mfa: true }, offered!.id, NOW)).rejects.toThrow(ForbiddenError);
    expect((await db.assignments.get(offered!.id))!.status).toBe("offered");
  });

  it("rejects acceptance after expiry", async () => {
    const db = await setup([lawyer("a", { acceptSlaMinutes: 10 })]);
    const { offered } = await offerNext(db, "L1", NOW);
    await expect(acceptOffer(db, attorney("a"), offered!.id, mins(11))).rejects.toThrow(/expired/);
    expect((await db.leads.get("L1"))!.assignedLawyerId).toBeUndefined();
  });

  it("re-routes to the next lawyer on decline", async () => {
    const db = await setup([lawyer("a"), lawyer("b")]);
    const first = (await offerNext(db, "L1", NOW)).offered!;
    const res = await declineOffer(db, attorney(first.lawyerId), first.id, "capacity", "full", mins(2));
    expect(await db.assignments.get(first.id)).toMatchObject({ status: "declined", declineReason: "capacity" });
    expect(res.offered?.lawyerId).toBe(first.lawyerId === "a" ? "b" : "a");
    expect(verifyAuditChain(await db.audit.list()).ok).toBe(true);
  });

  it("stops routing when a decline reports a conflict", async () => {
    const db = await setup([lawyer("a"), lawyer("b")]);
    const first = (await offerNext(db, "L1", NOW)).offered!;
    const res = await declineOffer(db, attorney(first.lawyerId), first.id, "conflict", undefined, mins(1));
    expect(res.offered).toBeNull();
    expect((await db.leads.get("L1"))!.conflictCard.clearance).toBe("conflict");
    expect(await db.assignments.list((a) => a.status === "offered")).toHaveLength(0);
    expect((await db.activities.list((a) => a.leadId === "L1" && a.kind === "system"))[0].summary).toMatch(/attorney/);
    expect((await db.audit.list()).map((e) => e.action)).toContain("routing.conflict");
    await expect(offerNext(db, "L1", mins(2))).rejects.toThrow(/conflict/);
  });

  it("requires a decline reason", async () => {
    const db = await setup([lawyer("a")]);
    const o = (await offerNext(db, "L1", NOW)).offered!;
    await expect(declineOffer(db, attorney("a"), o.id, undefined as never, undefined, NOW)).rejects.toThrow(/reason/);
  });

  it("sweeps expired offers, logs the SLA miss and re-routes", async () => {
    const db = await setup([lawyer("a", { acceptSlaMinutes: 10 }), lawyer("b")]);
    const first = (await offerNext(db, "L1", NOW)).offered!;
    expect(await sweepExpiredOffers(db, mins(5))).toEqual({ expired: 0, reoffered: 0, exhausted: 0 });
    expect(await sweepExpiredOffers(db, mins(11))).toEqual({ expired: 1, reoffered: 1, exhausted: 0 });
    expect(await db.assignments.get(first.id)).toMatchObject({ status: "expired", slaMet: false });
    const open = await db.assignments.list((a) => a.status === "offered");
    expect(open).toHaveLength(1);
    expect(open[0].lawyerId).not.toBe(first.lawyerId);
    expect((await db.audit.list()).map((e) => e.action)).toContain("routing.timeout");
    expect(verifyAuditChain(await db.audit.list()).ok).toBe(true);
  });

  it("exits as declined_by_all after offers run out", async () => {
    const db = await setup([lawyer("a", { acceptSlaMinutes: 10 })]);
    await offerNext(db, "L1", NOW);
    expect(await sweepExpiredOffers(db, mins(11))).toEqual({ expired: 1, reoffered: 0, exhausted: 1 });
    expect((await db.leads.get("L1"))!.exit?.reason).toBe("declined_by_all");
  });

  it("handles nobody eligible on first routing", async () => {
    const db = await setup([lawyer("a", { licensedStates: ["CA"] })]);
    const res = await offerNext(db, "L1", NOW);
    expect(res).toEqual({ offered: null, nextStep: "refer_to_bar_referral_service_and_long_term_nurture" });
    expect((await db.leads.get("L1"))!.exit).toMatchObject({ reason: "not_a_fit", note: "No eligible attorney" });
    expect((await db.audit.list())[0].action).toBe("routing.no_eligible");
    expect(verifyAuditChain(await db.audit.list()).ok).toBe(true);
  });

  it("records the client's choice and routes within it", async () => {
    const db = await setup([lawyer("a"), lawyer("b"), lawyer("c")]);
    await recordClientChoice(db, "L1", ["c", "b"]);
    expect((await offerNext(db, "L1", NOW)).offered?.lawyerId).toBe("c");
    await expect(recordClientChoice(db, "L1", ["zz"])).rejects.toThrow(/not found/);
    expect(verifyAuditChain(await db.audit.list()).ok).toBe(true);
  });
});
