import { describe, expect, it } from "vitest";
import { buildConsentRecord } from "@/lib/consent";
import { ForbiddenError } from "@/server/auth/policy";
import { verifyAuditChain } from "@/server/audit/log";
import { createMemoryDb, type Db } from "@/server/db";
import { rankLawyers } from "@/server/routing/engine";
import { acceptOffer, declineOffer, loadInput, offerNext } from "@/server/services/routing";
import { recordOutcome, referLead, referralReport, referralsForLead, referralTargets } from "@/server/services/referrals";
import type { Actor, Lawyer, Lead } from "@/server/types";

const T0 = new Date("2026-10-31T15:00:00Z");
const mins = (m: number) => new Date(T0.getTime() + m * 60_000);

const sargun: Actor = { userId: "u-sargun", role: "attorney", firmId: "f1", lawyerId: "sargun", mfa: true };
const avery: Actor = { userId: "u-avery", role: "attorney", firmId: "f2", lawyerId: "avery", mfa: true };
const jordan: Actor = { userId: "u-jordan", role: "attorney", firmId: "f2", lawyerId: "jordan", mfa: true };
const office: Actor = { userId: "u-office", role: "firm_admin", firmId: "f1", mfa: true };
const otherOffice: Actor = { userId: "u-office2", role: "firm_admin", firmId: "f2", mfa: true };
const platform: Actor = { userId: "u-admin", role: "platform_admin", mfa: true };
const marketing: Actor = { userId: "u-mkt", role: "marketing", mfa: true };
const intake: Actor = { userId: "u-intake", role: "intake", mfa: true };

function lawyer(id: string, firmId: string, name: string, more: Partial<Lawyer> = {}): Lawyer {
  return {
    id, firmId, name, email: `${id}@firm.test`, licensedStates: ["IL"], matterTypes: ["new_plan", "update_plan"], specialties: [],
    languages: ["en"], weeklyCapacity: 10, activeLeadCap: 10, acceptSlaMinutes: 60, active: true,
    // Sargun scores worst on purpose, so only the primary flag puts him first.
    stats: { avgAcceptMinutes: 10, showRate: 1, reviewScore: 5 }, ...more,
  };
}

function lead(id: string, more: Partial<Lead> = {}): Lead {
  return {
    id, personId: "p1", createdAt: T0.toISOString(), stage: "qualified", stageHistory: [{ stage: "qualified", at: T0.toISOString(), by: "system" }], matterType: "new_plan", state: "IL", urgent: false,
    score: { score: 80, tier: "hot", grade: "A", urgent: false, components: [], redFlags: [] }, segments: [], source: {},
    consent: buildConsentRecord({ smsConsent: true, acknowledgedNoRelationship: true, pageUrl: "/x", ip: null, userAgent: null, now: T0 }),
    offerSummary: "s",
    conflictCard: { clientName: "Pat Client", parties: [], matterType: "new_plan", state: "IL", clearance: "clear" },
    intake: { summary: "Married, two kids.", goals: "Guardians", redFlags: [], deadlines: [], household: { members: [] }, assets: {}, answers: {} },
    ...more,
  };
}

async function setup(): Promise<Db> {
  const db = createMemoryDb();
  await db.firms.insert({ id: "f1", name: "Sargun Singh Law", structure: "in_firm" });
  await db.firms.insert({ id: "f2", name: "Partner Firm LLP", structure: "in_firm" });
  await db.lawyers.insert(lawyer("sargun", "f1", "Sargun Singh", { primaryIntake: true, stats: { avgAcceptMinutes: 100, showRate: 0.1, reviewScore: 1 } }));
  await db.lawyers.insert(lawyer("avery", "f2", "Avery Demo"));
  await db.lawyers.insert(lawyer("jordan", "f2", "Jordan Sample", { matterTypes: ["update_plan"] }));
  await db.persons.insert({ id: "p1", firstName: "Pat", lastName: "Client", email: "pat@x.test", phone: "+15555550100", language: "en", state: "IL" });
  await db.leads.insert(lead("lead1"));
  return db;
}

/** Route lead1 to Sargun and have him accept it. */
async function sargunHasIt(db: Db, id = "lead1") {
  const { offered } = await offerNext(db, id, T0);
  await acceptOffer(db, sargun, offered!.id, mins(1));
}

const toAvery = { target: { kind: "platform" as const, lawyerId: "avery" }, reason: "capacity" as const, note: "Full this week", clientAgreed: true };
const outside = { target: { kind: "outside" as const, name: "Dana Lopez", firm: "Lopez Elder Law", contact: "555-0199" }, reason: "practice_area" as const, clientAgreed: true };

describe("default routing", () => {
  it("offers every incoming lead to the primary intake attorney first, even when others score higher", async () => {
    const db = await setup();
    const r = rankLawyers(await loadInput(db, (await db.leads.get("lead1"))!, T0));
    expect(r.special).toBe("primary_intake");
    expect(r.ranked[0].lawyerId).toBe("sargun");
    const { offered } = await offerNext(db, "lead1", T0);
    expect(offered?.lawyerId).toBe("sargun");
    expect(offered?.routingReason).toMatch(/^Primary intake attorney/);
  });

  it("the client's own choice still wins, and a declined lead routes on to the next attorney", async () => {
    const db = await setup();
    await db.leads.update("lead1", { clientChoiceLawyerIds: ["avery"] });
    expect((await offerNext(db, "lead1", T0)).offered?.lawyerId).toBe("avery");

    await db.leads.insert(lead("lead2"));
    const first = await offerNext(db, "lead2", T0);
    const next = await declineOffer(db, sargun, first.offered!.id, "capacity", undefined, mins(1));
    expect("offered" in next && next.offered?.lawyerId).toBe("avery");
  });

  it("without a primary attorney, ranking is unchanged", async () => {
    const db = await setup();
    await db.lawyers.update("sargun", { primaryIntake: false });
    const r = rankLawyers(await loadInput(db, (await db.leads.get("lead1"))!, T0));
    expect(r.special).toBeUndefined();
    expect(r.ranked[0].lawyerId).not.toBe("sargun");
  });
});

describe("referring a lead to a platform attorney", () => {
  it("withdraws Sargun's case, offers it to the new attorney and logs who, when and why", async () => {
    const db = await setup();
    await sargunHasIt(db);
    const ref = await referLead(db, sargun, "lead1", toAvery, mins(5));

    expect(ref).toMatchObject({ fromLawyerId: "sargun", toLawyerId: "avery", toFirmId: "f2", reason: "capacity", note: "Full this week", clientAgreed: true, outcome: "pending" });
    const l = (await db.leads.get("lead1"))!;
    expect(l.assignedLawyerId).toBeUndefined();
    expect(l.stage).toBe("offered");
    const offers = await db.assignments.list(undefined, { leadId: "lead1" });
    expect(offers.find((a) => a.lawyerId === "sargun")?.status).toBe("withdrawn");
    expect(offers.find((a) => a.id === ref.assignmentId)).toMatchObject({ lawyerId: "avery", status: "offered" });
    expect((await db.activities.list()).some((a) => /Sargun Singh referred this lead to Avery Demo/.test(a.summary))).toBe(true);
    expect((await db.audit.list()).some((e) => e.action === "referral.sent" && e.resourceId === ref.id)).toBe(true);
    expect(verifyAuditChain(await db.audit.list()).ok).toBe(true);
  });

  it("the outcome follows the offer and the lead: pending, accepted, booked, retained", async () => {
    const db = await setup();
    await sargunHasIt(db);
    const ref = await referLead(db, sargun, "lead1", toAvery, mins(5));
    const outcome = async () => (await referralsForLead(db, sargun, "lead1"))[0].effective;
    expect(await outcome()).toBe("pending");
    await acceptOffer(db, avery, ref.assignmentId!, mins(10));
    expect(await outcome()).toBe("accepted");
    const l = (await db.leads.get("lead1"))!;
    await db.leads.update("lead1", { stage: "consult_booked", stageHistory: [...l.stageHistory, { stage: "consult_booked", at: mins(20).toISOString(), by: "x" }] });
    expect(await outcome()).toBe("booked");
    const l2 = (await db.leads.get("lead1"))!;
    await db.leads.update("lead1", { stage: "retainer_signed", stageHistory: [...l2.stageHistory, { stage: "retainer_signed", at: mins(30).toISOString(), by: "x" }] });
    expect(await outcome()).toBe("retained");
    // Outcomes on platform referrals are never typed in by hand.
    await expect(recordOutcome(db, sargun, ref.id, "declined")).rejects.toThrow(/updates itself/);
  });

  it("if the new attorney passes, it routes on and never comes back to Sargun", async () => {
    const db = await setup();
    await sargunHasIt(db);
    const ref = await referLead(db, sargun, "lead1", toAvery, mins(5));
    await db.leads.update("lead1", { matterType: "update_plan" });
    const next = await declineOffer(db, avery, ref.assignmentId!, "capacity", undefined, mins(6));
    expect("offered" in next && next.offered?.lawyerId).toBe("jordan");
    expect((await referralsForLead(db, sargun, "lead1"))[0].effective).toBe("declined");
  });

  it("works from the offer stage too, before Sargun accepts", async () => {
    const db = await setup();
    await offerNext(db, "lead1", T0);
    const ref = await referLead(db, sargun, "lead1", toAvery, mins(2));
    expect(ref.toLawyerId).toBe("avery");
    expect((await db.assignments.list(undefined, { leadId: "lead1" })).filter((a) => a.status === "offered").map((a) => a.lawyerId)).toEqual(["avery"]);
  });

  it("refuses targets who can't take it, and lists why in the picker", async () => {
    const db = await setup();
    await sargunHasIt(db);
    const targets = await referralTargets(db, sargun, "lead1", mins(2));
    expect(targets.map((t) => t.lawyerId)).toEqual(["avery", "jordan"]);
    expect(targets.find((t) => t.lawyerId === "jordan")?.blockedBy).toMatch(/Does not handle new_plan/);
    await expect(referLead(db, sargun, "lead1", { ...toAvery, target: { kind: "platform", lawyerId: "jordan" } }, mins(3))).rejects.toThrow(/can't take this lead/);
    await expect(referLead(db, sargun, "lead1", { ...toAvery, target: { kind: "platform", lawyerId: "sargun" } }, mins(3))).rejects.toThrow(/someone other/);
  });
});

describe("referring a lead outside the platform", () => {
  it("takes the lead out of the pipeline and lets Sargun record what happened", async () => {
    const db = await setup();
    await sargunHasIt(db);
    const ref = await referLead(db, sargun, "lead1", outside, mins(5));
    expect(ref).toMatchObject({ outsideName: "Dana Lopez", outsideFirm: "Lopez Elder Law", outsideContact: "555-0199" });
    expect(ref.toLawyerId).toBeUndefined();
    expect((await db.leads.get("lead1"))?.exit?.reason).toBe("referred_out");
    await recordOutcome(db, sargun, ref.id, "retained", "Signed with Dana", mins(60));
    const [row] = await referralsForLead(db, sargun, "lead1");
    expect(row).toMatchObject({ effective: "retained", outcomeNote: "Signed with Dana", toName: "Dana Lopez, Lopez Elder Law", canUpdate: true });
    await recordOutcome(db, office, ref.id, "declined", undefined, mins(61));
    await expect(recordOutcome(db, otherOffice, ref.id, "booked")).rejects.toThrow(/not found/);
  });

  it("needs the whole case: an offer-stage attorney can only pass it to a platform attorney", async () => {
    const db = await setup();
    await offerNext(db, "lead1", T0);
    await expect(referLead(db, sargun, "lead1", outside, mins(2))).rejects.toThrow(/Accept the lead/);
  });
});

describe("guards", () => {
  it("needs the client's agreement, a reason and a holder", async () => {
    const db = await setup();
    await expect(referLead(db, platform, "lead1", toAvery, mins(1))).rejects.toThrow(/nothing to refer/);
    await sargunHasIt(db);
    await expect(referLead(db, sargun, "lead1", { ...toAvery, clientAgreed: false }, mins(2))).rejects.toThrow(/client agreed/);
    await expect(referLead(db, sargun, "lead1", { ...toAvery, reason: "money" as never }, mins(2))).rejects.toThrow(/Choose why/);
    await expect(referLead(db, sargun, "lead1", { ...outside, target: { kind: "outside", name: "  " } }, mins(2))).rejects.toThrow(/name/);
  });

  it("only the attorney holding it, their office or a platform admin can refer it", async () => {
    const db = await setup();
    await sargunHasIt(db);
    for (const a of [avery, jordan, otherOffice, marketing, intake]) {
      await expect(referLead(db, a, "lead1", toAvery, mins(2)), a.userId).rejects.toThrow(ForbiddenError);
    }
    expect((await referLead(db, office, "lead1", toAvery, mins(2))).referredBy).toBe("u-office");
  });

  it("not after the retainer is signed or once the lead has left", async () => {
    const db = await setup();
    await sargunHasIt(db);
    await db.leads.update("lead1", { stage: "retainer_signed" });
    await expect(referLead(db, sargun, "lead1", toAvery, mins(2))).rejects.toThrow(/already signed/);
    await db.leads.update("lead1", { stage: "accepted", exit: { reason: "unresponsive", at: T0.toISOString() } });
    await expect(referLead(db, sargun, "lead1", toAvery, mins(2))).rejects.toThrow(/left the pipeline/);
  });

  it("referral rows are visible to the sending and receiving side only", async () => {
    const db = await setup();
    await sargunHasIt(db);
    await referLead(db, sargun, "lead1", toAvery, mins(2));
    expect(await referralsForLead(db, avery, "lead1")).toHaveLength(1);
    expect(await referralsForLead(db, otherOffice, "lead1")).toHaveLength(1);
    expect(await referralsForLead(db, jordan, "lead1")).toHaveLength(0);
    expect(await referralsForLead(db, marketing, "lead1")).toHaveLength(0);
  });
});

describe("referral report", () => {
  it("splits leads into handled by Sargun, referred by Sargun and went elsewhere, and charts recipients, reasons and outcomes", async () => {
    const db = await setup();
    for (const id of ["lead2", "lead3", "lead4", "lead5"]) await db.leads.insert(lead(id, { createdAt: id === "lead5" ? "2026-09-15T12:00:00Z" : T0.toISOString() }));
    await sargunHasIt(db, "lead1"); // kept
    await sargunHasIt(db, "lead2");
    const r2 = await referLead(db, sargun, "lead2", toAvery, mins(5));
    await acceptOffer(db, avery, r2.assignmentId!, mins(6));
    await sargunHasIt(db, "lead3");
    await referLead(db, sargun, "lead3", outside, mins(5));
    const first = await offerNext(db, "lead4", T0); // Sargun declined it the ordinary way
    await declineOffer(db, sargun, first.offered!.id, "conflict", undefined, mins(1));
    await sargunHasIt(db, "lead5"); // kept, a month earlier

    const r = await referralReport(db, platform, { from: new Date("2026-09-01T00:00:00Z"), to: mins(120) });
    expect(r.primary?.name).toBe("Sargun Singh");
    expect({ routed: r.routed, handled: r.handledByPrimary, referred: r.referredByPrimary, elsewhere: r.wentElsewhere }).toEqual({ routed: 5, handled: 2, referred: 2, elsewhere: 1 });
    expect(r.byMonth).toEqual([
      { month: "2026-09", handled: 1, referred: 0, elsewhere: 0 },
      { month: "2026-10", handled: 1, referred: 2, elsewhere: 1 },
    ]);
    expect(r.byRecipient.map((x) => [x.name, x.outside, x.total])).toEqual([["Avery Demo", false, 1], ["Dana Lopez, Lopez Elder Law", true, 1]]);
    expect(r.byRecipient[0].outcomes.accepted).toBe(1);
    expect(r.byReason.map((x) => x.reason).sort()).toEqual(["capacity", "practice_area"]);
    expect(r.outcomes.find((o) => o.outcome === "accepted")?.total).toBe(1);
    expect(r.outcomes.find((o) => o.outcome === "pending")?.total).toBe(1);
    expect(r.byReferrer).toEqual([{ name: "Sargun Singh", total: 2 }]);
    expect(r.rows).toHaveLength(2);
    // No fee or payment field exists anywhere on a referral.
    expect(Object.keys(r.rows[0]).filter((k) => /fee|pay|amount|cents/i.test(k))).toEqual([]);
  });

  it("is for platform and firm admins only", async () => {
    const db = await setup();
    const range = { from: T0, to: mins(60) };
    for (const a of [sargun, marketing, intake]) await expect(referralReport(db, a, range)).rejects.toThrow(ForbiddenError);
    await expect(referralReport(db, office, range)).resolves.toBeDefined();
  });
});
