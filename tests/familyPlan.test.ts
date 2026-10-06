import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIGURES } from "@/config/figures";
import {
  FAMILY_PLAN_CONSENT_VERSION,
  FAMILY_PLAN_DISCLAIMER,
  SENSITIVE_TEXT_MESSAGE,
  answersFromPlan,
  computeGaps,
  emptyPlan,
  familyPlanBodySchema,
  findSensitiveText,
  formatTotal,
  mergePlans,
  organizerSignals,
  prefillPlan,
  sectionStatuses,
  summarizePlan,
  validatePlan,
  type FamilyPlanInput,
} from "@/lib/familyPlan";
import { scoreLead } from "@/lib/scoring";
import { verifyAuditChain } from "@/server/audit/log";
import { canViewFamilyPlanSummary, leadAccess } from "@/server/auth/policy";
import { actorFromSession, issueSession } from "@/server/auth/session";
import { createMemoryDb, type Db } from "@/server/db";
import { EDUCATIONAL_DISCLAIMER } from "@/server/nurture/compliance";
import { buildCaseView } from "@/server/portal/caseView";
import { actorFor, DEMO_USERS, seedDemo } from "@/server/seed";
import { acceptInvite, inviteClient } from "@/server/services/clientPortal";
import {
  completePlanSignIn,
  configureFamilyPlan,
  consumeLink,
  decryptPlanBody,
  deleteOwnPlan,
  encryptPlanBody,
  familyPlanConfigured,
  hashEmail,
  linkPlanToNewLead,
  loadOwnPlan,
  organizerSummaryForLead,
  previewPlan,
  saveOwnPlan,
  startPlanSignIn,
} from "@/server/services/familyPlan";
import { resolvePlanSession } from "@/server/services/planAccount";
import { acceptOffer } from "@/server/services/routing";
import { signInPlan, tokenFrom } from "./planSignIn";
import type { Actor } from "@/server/types";

const NOW = new Date("2026-10-06T15:00:00Z");
const YEAR = 2026;
const plan = (input: FamilyPlanInput) => familyPlanBodySchema.parse(input);
const user = (id: string) => actorFor(DEMO_USERS.find((u) => u.id === id)!);

// ---------------------------------------------------------------------------
// Validation and the sensitive-text guard
// ---------------------------------------------------------------------------

describe("sensitive text is rejected", () => {
  it.each([
    ["an SSN", "My SSN is 123-45-6789"],
    ["an SSN without dashes", "ssn 123456789"],
    ["a card number", "Visa 4111 1111 1111 1111"],
    ["an account number", "Chase checking acct 000123456789"],
    ["a routing number with dots", "routing 021.000.021"],
    ["a phone number", "call my sister at 512-555-0199"],
    ["a full date of birth", "Ava, born 3/14/2019"],
    ["an ISO date of birth", "Leo 2019-03-14"],
    ["a written date of birth", "born March 14, 1980"],
    ["a password", "password: hunter2"],
    ["a passcode sentence", "my passcode is tulip7"],
    ["a PIN", "debit card PIN 4821"],
  ])("rejects %s", (_kind, text) => {
    expect(findSensitiveText(text)).not.toBeNull();
  });

  it.each([
    "Chase checking",
    "Work 401(k)",
    "fireproof box in the hall closet",
    "Wills from 2015-2018 are in the binder",
    "About $250,000",
    "Passwords are in the safe, ask Jamie",
    "Born in 1980",
    "Give Grandma's ring to Ava",
  ])("allows %j", (text) => {
    expect(findSensitiveText(text)).toBeNull();
  });

  it("names the field and gives the friendly message", () => {
    const v = validatePlan({ assets: { items: [{ id: "a1", type: "bank", label: "Chase 4111111111111111" }] }, wishes: { pets: "the dog goes to Sam" } });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.error).toBe(SENSITIVE_TEXT_MESSAGE);
    expect(Object.keys(v.fields)).toEqual(["assets.items.0.label"]);
    expect(SENSITIVE_TEXT_MESSAGE).toMatch(/never stores account, card or Social Security numbers/);
  });

  it("checks every free-text field, including names and locations", () => {
    for (const input of [
      { people: { guardian: "Sam 123-45-6789" } },
      { people: { children: [{ id: "c1", name: "Ava 03/14/2019" }] } },
      { papers: { location: "safe, combination 12345678" } },
      { assets: { items: [{ id: "a1", type: "life_insurance", label: "Policy", beneficiary: "yes", beneficiaryName: "Jamie pin: 1234" }] } },
    ]) {
      expect(validatePlan(input).ok, JSON.stringify(input)).toBe(false);
    }
  });

  it("rejects unknown enums, oversize text and too many items", () => {
    expect(validatePlan({ assets: { items: [{ id: "a1", type: "crypto_vault", label: "x" }] } }).ok).toBe(false);
    expect(validatePlan({ wishes: { funeral: "x".repeat(1001) } }).ok).toBe(false);
    expect(validatePlan({ assets: { items: Array.from({ length: 61 }, (_, i) => ({ id: `a${i}`, type: "other" })) } }).ok).toBe(false);
    expect(validatePlan({ people: { children: [{ id: "bad id!", name: "Ava" }] } }).ok).toBe(false);
  });

  it("accepts an empty plan and fills defaults", () => {
    const v = validatePlan({});
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.body).toEqual(emptyPlan());
  });

  it("uses the same disclaimer wording as the rest of the site", () => {
    expect(FAMILY_PLAN_DISCLAIMER).toBe(EDUCATIONAL_DISCLAIMER);
  });
});

// ---------------------------------------------------------------------------
// Progress, gaps and the summary
// ---------------------------------------------------------------------------

describe("progress and gaps", () => {
  const codes = (input: FamilyPlanInput) => computeGaps(plan(input), YEAR).map((g) => g.code);

  it("an empty plan has no gaps and nothing done", () => {
    expect(codes({})).toEqual([]);
    expect(summarizePlan(emptyPlan(), YEAR).sectionsDone).toBe(0);
  });

  it("minor children without a guardian, then without a backup", () => {
    expect(codes({ people: { childrenStatus: "minors" } })).toContain("minor_no_guardian");
    expect(codes({ people: { children: [{ id: "c1", name: "Ava", birthYear: 2020 }] } })).toContain("minor_no_guardian");
    expect(codes({ people: { children: [{ id: "c1", name: "Ava", birthYear: 2020 }], guardian: "Sam" } })).toEqual(["minor_no_backup_guardian"]);
    expect(codes({ people: { children: [{ id: "c1", name: "Ava", birthYear: 2020 }], guardian: "Sam", backupGuardian: "Lee" } })).toEqual([]);
    expect(codes({ people: { children: [{ id: "c1", name: "Max", birthYear: 1990 }] } })).toEqual([]);
  });

  it("retirement and life insurance without a beneficiary, home in one name", () => {
    const g = computeGaps(plan({
      assets: {
        items: [
          { id: "r1", type: "retirement", label: "401k", beneficiary: "not_sure" },
          { id: "r2", type: "retirement", label: "IRA", beneficiary: "yes" },
          { id: "l1", type: "life_insurance", label: "Work policy", beneficiary: "no" },
          { id: "h1", type: "real_estate", label: "Home", titling: "sole" },
        ],
      },
    }), YEAR);
    const byCode = Object.fromEntries(g.map((x) => [x.code, x]));
    expect(byCode.retirement_no_beneficiary.assetIds).toEqual(["r1"]);
    expect(byCode.retirement_no_beneficiary.text).toMatch(/^One retirement account with no beneficiary named/);
    expect(byCode.life_insurance_no_beneficiary.assetIds).toEqual(["l1"]);
    expect(byCode.home_sole_probate.text).toBe("Home titled in your name alone: it may go through probate.");
    // a transfer-on-death beneficiary on the deed takes it out of that gap
    expect(codes({ assets: { items: [{ id: "h1", type: "real_estate", titling: "sole", beneficiary: "yes" }] } })).not.toContain("home_sole_probate");
  });

  it("documents: missing directive and POA, no will or trust, old will, will before a child or marriage, another state", () => {
    expect(codes({ documents: { healthcareDirective: { has: "no" }, financialPoa: { has: "not_sure" }, will: { has: "no" }, trust: { has: "no" } } })).toEqual(
      expect.arrayContaining(["no_healthcare_directive", "no_financial_poa", "no_will_or_trust"]),
    );
    // unanswered documents never produce a gap
    expect(codes({ documents: { will: { has: "yes" } } })).toEqual([]);
    expect(codes({ documents: { will: { has: "yes", yearSigned: 2018 } } })).toEqual(["will_older_than_5_years"]);
    expect(codes({ people: { children: [{ id: "c1", name: "Leo", birthYear: 2024 }], guardian: "a", backupGuardian: "b" }, documents: { will: { has: "yes", yearSigned: 2023 } } })).toEqual(["will_before_child"]);
    expect(codes({ people: { maritalStatus: "married", marriageYear: 2025 }, documents: { will: { has: "yes", yearSigned: 2022 } } })).toEqual(["will_before_marriage"]);
    const other = computeGaps(plan({ people: { homeState: "TX" }, documents: { will: { has: "yes", yearSigned: 2024, state: "NY" }, trust: { has: "yes", state: "TX" } } }), YEAR);
    expect(other.map((g) => g.code)).toEqual(["documents_other_state"]);
    expect(other[0].text).toContain("(NY)");
  });

  it("a trust with accounts outside it, unsure titling and the estate tax watch", () => {
    expect(codes({
      documents: { trust: { has: "yes" } },
      assets: { items: [{ id: "h1", type: "real_estate", titling: "trust" }, { id: "b1", type: "brokerage", titling: "sole" }] },
    })).toEqual(["trust_unfunded"]);
    expect(codes({ assets: { items: [{ id: "x", type: "bank", titling: "not_sure" }] } })).toEqual(["titling_not_sure"]);
    const big = Math.ceil((FIGURES.federalExemption * 0.8) / 5_000_000);
    expect(codes({ assets: { items: Array.from({ length: big }, (_, i) => ({ id: `b${i}`, type: "brokerage" as const, valueRange: "over_5m" as const, titling: "trust" as const })) } })).toContain("estate_tax_watch");
  });

  it("sections are done only when their key answers are in", () => {
    const b = plan({
      people: { homeState: "TX", maritalStatus: "single", childrenStatus: "none", executor: "Sam" },
      assets: { items: [{ id: "a", type: "bank", valueRange: "under_50k", titling: "sole" }] },
      documents: { will: { has: "no" }, trust: { has: "no" }, financialPoa: { has: "no" }, healthcareDirective: { has: "no" }, beneficiaryForms: { has: "yes" } },
      wishes: { pets: "Sam takes the cat" },
    });
    expect(sectionStatuses(b)).toEqual({ people: "done", assets: "done", documents: "done", wishes: "done", papers: "empty" });
    expect(sectionStatuses(plan({ assets: { items: [{ id: "a", type: "bank" }] } })).assets).toBe("started");
  });

  it("the summary carries counts and ranges, never names, labels or notes", () => {
    const b = plan({
      people: { homeState: "TX", maritalStatus: "married", spouseName: "Jamie Secretname", children: [{ id: "c1", name: "Avasecret", birthYear: 2020 }], guardian: "Guardiansecret" },
      assets: { items: [{ id: "a1", type: "bank", label: "Labelsecret checking", valueRange: "50k_250k", titling: "joint_spouse", beneficiary: "yes", beneficiaryName: "Beneficiarysecret" }, { id: "a2", type: "real_estate", label: "Home", valueRange: "250k_1m", titling: "sole" }] },
      wishes: { funeral: "Wishsecret" },
      papers: { location: "Papersecret" },
    });
    const s = summarizePlan(b, YEAR);
    expect(JSON.stringify(s)).not.toMatch(/secret/i);
    expect(s.household).toMatchObject({ children: 1, minors: 1, spouseNamed: true, guardianNamed: true, executorNamed: false });
    expect(s.assets).toMatchObject({ count: 2, totalLow: 300_000, totalHigh: 1_250_000, beneficiaryNamed: 1, titledAlone: 1, byType: { bank: 1, real_estate: 1 } });
    expect(formatTotal(s.assets.totalLow, s.assets.totalHigh)).toBe("$300,000 to $1.25 million");
    expect(formatTotal(5_000_000, null)).toBe("$5 million or more");
    expect(s.hasWishes && s.hasPapersLocation).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Prefill, intake answers and scoring signals
// ---------------------------------------------------------------------------

describe("prefill and the intake handoff", () => {
  it("maps plan finder answers, contact state and life game choices, and nothing else", () => {
    const p = prefillPlan({
      answers: { maritalStatus: "married", children: "minors", ownsHome: "yes", ownsBusiness: "yes", outOfStateProperty: "yes", existingDocuments: "will_only", urgency: "this_month" },
      state: "TX",
      lifeGameDocs: ["guardian", "will", "not a key!"],
    })!;
    expect(p.people).toMatchObject({ homeState: "TX", maritalStatus: "married", childrenStatus: "minors", children: [] });
    expect(p.assets.items.map((a) => a.type)).toEqual(["real_estate", "real_estate", "business"]);
    expect(p.assets.items.every((a) => a.valueRange === undefined && a.titling === undefined)).toBe(true);
    expect(p.documents).toEqual({ will: { has: "yes" }, trust: { has: "no" } });
    expect(p.prefill).toEqual({ sources: ["contact", "plan_finder", "life_game"], interests: ["guardian", "will"] });
    expect(validatePlan(p).ok).toBe(true);
    // the prefill alone already shows the guardian gap
    expect(computeGaps(p, YEAR).map((g) => g.code)).toContain("minor_no_guardian");
  });

  it("returns null when there is nothing to fill, and ignores unknown states", () => {
    expect(prefillPlan({})).toBeNull();
    expect(prefillPlan({ state: "ZZ" })).toBeNull();
    expect(prefillPlan({ answers: { existingDocuments: "none" } })!.documents).toEqual({ will: { has: "no" }, trust: { has: "no" } });
    expect(prefillPlan({ answers: { existingDocuments: "not_sure" } }, )!.documents).toEqual({ will: { has: "not_sure" } });
  });

  it("merging a device draft only fills sections the saved plan has not started", () => {
    const saved = plan({ people: { maritalStatus: "single" } });
    const device = plan({ people: { maritalStatus: "married" }, papers: { location: "desk drawer" } });
    const m = mergePlans(saved, device);
    expect(m.people.maritalStatus).toBe("single");
    expect(m.papers.location).toBe("desk drawer");
  });

  it("organizer answers and signals feed intake and scoring v2", () => {
    const b = plan({
      people: { maritalStatus: "married", children: [{ id: "c", name: "A", birthYear: 2021 }, { id: "d", name: "B", birthYear: 1999 }] },
      assets: { items: [
        { id: "h", type: "real_estate", valueRange: "1m_5m", titling: "sole" },
        { id: "r", type: "retirement", valueRange: "250k_1m", titling: "sole", beneficiary: "no" },
        { id: "b", type: "brokerage", valueRange: "250k_1m", titling: "sole" },
      ] },
      documents: { trust: { has: "yes" } },
    });
    const s = summarizePlan(b, YEAR);
    expect(answersFromPlan(b, s)).toMatchObject({ maritalStatus: "married", children: "both", ownsHome: "yes", ownsBusiness: "no", assetRange: "1m_5m", existingDocuments: "trust" });
    const signals = organizerSignals(s);
    expect(signals).toMatchObject({ estateValue: 1_500_000, beneficiaryGap: true, trustFunding: "partly", gapCount: s.gaps.length });
    expect(signals.estateTaxStatus).toBeUndefined();

    const score = scoreLead({ state: "TX", servedStates: ["TX"], answers: answersFromPlan(b, s), smsConsent: false, capture: { tool: "family_plan", result: signals } });
    const keys = score.components.map((c) => c.key);
    expect(keys).toEqual(expect.arrayContaining([
      "tool_signal:family_plan:completion", "tool_signal:family_plan:estate_value", "tool_signal:family_plan:trust_unfunded", "tool_signal:family_plan:beneficiary_gap",
    ]));
  });

  it("signals the estate tax only from the low end of the ranges", () => {
    const n = Math.ceil(FIGURES.federalExemption / 5_000_000);
    const b = plan({ assets: { items: Array.from({ length: n }, (_, i) => ({ id: `x${i}`, type: "brokerage" as const, valueRange: "over_5m" as const })) } });
    expect(organizerSignals(summarizePlan(b, YEAR)).estateTaxStatus).toBe("above");
  });
});

// ---------------------------------------------------------------------------
// Encryption at rest
// ---------------------------------------------------------------------------

describe("encryption", () => {
  afterEach(() => vi.unstubAllEnvs());
  const body = plan({ people: { spouseName: "Jamie Rivera" }, papers: { location: "hall closet" } });

  it("round-trips and keeps nothing readable", () => {
    const c = encryptPlanBody("fp_a", body);
    expect(c.startsWith("v1.")).toBe(true);
    expect(c).not.toContain("Jamie");
    expect(Buffer.from(c.split(".").slice(1).join(""), "base64url").toString("latin1")).not.toContain("Jamie");
    expect(decryptPlanBody("fp_a", c)).toEqual(body);
    // fresh IV each time
    expect(encryptPlanBody("fp_a", body)).not.toBe(c);
  });

  it("refuses a tampered ciphertext, one moved to another plan, or another key", () => {
    const c = encryptPlanBody("fp_a", body);
    const parts = c.split(".");
    const ct = Buffer.from(parts[3], "base64url");
    ct[0] ^= 1;
    const tampered = [...parts.slice(0, 3), ct.toString("base64url")].join(".");
    expect(() => decryptPlanBody("fp_a", tampered)).toThrow();
    expect(() => decryptPlanBody("fp_b", c)).toThrow();
    expect(() => decryptPlanBody("fp_a", "v2." + parts.slice(1).join("."))).toThrow(/key version/);
    expect(() => decryptPlanBody("fp_a", "v1.garbage")).toThrow();
    vi.stubEnv("FAMILY_PLAN_KEY", "a-different-key-that-is-at-least-32-chars");
    expect(() => decryptPlanBody("fp_a", c)).toThrow();
  });

  it("production refuses to save without FAMILY_PLAN_KEY", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FAMILY_PLAN_KEY", "");
    expect(familyPlanConfigured()).toBe(false);
    expect(() => encryptPlanBody("fp_a", body)).toThrow(/FAMILY_PLAN_KEY/);
    expect(() => hashEmail("a@b.test")).toThrow(/FAMILY_PLAN_KEY/);
    await expect(startPlanSignIn(createMemoryDb(), { email: "a@b.test", consent: true, consentVersion: FAMILY_PLAN_CONSENT_VERSION })).rejects.toThrow(/FAMILY_PLAN_KEY/);
    vi.stubEnv("FAMILY_PLAN_KEY", "x".repeat(32));
    expect(familyPlanConfigured()).toBe(true);
    expect(decryptPlanBody("fp_a", encryptPlanBody("fp_a", body))).toEqual(body);
  });
});

// ---------------------------------------------------------------------------
// Sign-in, saving, deleting, linking and who sees what
// ---------------------------------------------------------------------------

let db: Db;
let sent: { to: string; text: string }[];

const signIn = (email: string, now = NOW) => signInPlan(db, sent, email, now);
const planIdOf = async (token: string, now = NOW) => (await resolvePlanSession(db, token, now))?.planId ?? null;

beforeEach(async () => {
  db = createMemoryDb();
  await seedDemo(db, NOW);
  sent = [];
  configureFamilyPlan({ sendEmail: async (to, _s, text) => void sent.push({ to, text }), baseUrl: "https://site.test" });
});

describe("sign-in with an emailed link", () => {
  it("asks for consent, sends one link, and creates the plan on first use without storing the address", async () => {
    expect(await startPlanSignIn(db, { email: "new@x.test", consent: false, consentVersion: FAMILY_PLAN_CONSENT_VERSION }, NOW)).toMatchObject({ ok: false, status: 422 });
    expect(await startPlanSignIn(db, { email: "new@x.test", consent: true, consentVersion: "old" }, NOW)).toMatchObject({ ok: false });
    expect(await startPlanSignIn(db, { email: "not an email", consent: true, consentVersion: FAMILY_PLAN_CONSENT_VERSION }, NOW)).toMatchObject({ ok: false });
    expect(sent).toHaveLength(0);

    const done = await signIn("New@X.test");
    expect(sent[0].to).toBe("new@x.test");
    expect(sent[0].text).toContain("https://site.test/my-plan/open?token=");
    expect(done.created).toBe(true);
    const stored = (await db.familyPlans.get(done.planId))!;
    expect(stored.consent).toEqual({ version: FAMILY_PLAN_CONSENT_VERSION, at: NOW.toISOString() });
    expect(stored.emailHash).toBe(hashEmail("new@x.test"));
    expect(JSON.stringify(await db.familyPlans.list())).not.toContain("new@x.test");
    expect(await planIdOf(done.sessionToken)).toBe(done.planId);

    const actions = (await db.audit.list()).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["family_plan.link_requested", "family_plan.create", "family_plan.sign_in"]));
    const create = (await db.audit.list((e) => e.action === "family_plan.create"))[0];
    expect(create).toMatchObject({ actorRole: "planner", actorId: done.planId });
  });

  it("links work once, expire, and a second sign-in opens the same plan", async () => {
    const first = await signIn("again@x.test");
    const token = tokenFrom(sent[0].text);
    expect(await completePlanSignIn(db, token, NOW)).toBeNull();
    await startPlanSignIn(db, { email: "again@x.test", consent: true, consentVersion: FAMILY_PLAN_CONSENT_VERSION }, NOW);
    expect(await completePlanSignIn(db, tokenFrom(sent[1].text), new Date(NOW.getTime() + 31 * 60_000))).toBeNull();
    const second = await signIn("AGAIN@x.test", new Date(NOW.getTime() + 60_000));
    expect(second.planId).toBe(first.planId);
    expect(second.created).toBe(false);
    expect(await db.familyPlans.list()).toHaveLength(2); // this one and the seeded demo plan
  });

  it("a link id is consumed once, and stays used for a fresh instance sharing the store", async () => {
    expect(await consumeLink(db, "jti-1", NOW)).toBe(true);
    expect(await consumeLink(db, "jti-1", NOW)).toBe(false);
    expect(await db.planLinkUses.get("jti-1")).toEqual({ id: "jti-1", usedAt: NOW.toISOString() });

    await startPlanSignIn(db, { email: "multi@x.test", consent: true, consentVersion: FAMILY_PLAN_CONSENT_VERSION }, NOW);
    const token = tokenFrom(sent[0].text);
    expect(await completePlanSignIn(db, token, NOW)).not.toBeNull();
    // another instance: no in-process memory, same database
    configureFamilyPlan({ sendEmail: async () => undefined });
    expect(await completePlanSignIn(db, token, NOW)).toBeNull();
    expect(await db.audit.list((e) => e.action === "family_plan.link_rejected")).toHaveLength(1);
  });

  it("rate limits link emails per address", async () => {
    for (let i = 0; i < 7; i++) await startPlanSignIn(db, { email: "lim@x.test", consent: true, consentVersion: FAMILY_PLAN_CONSENT_VERSION }, NOW);
    expect(sent).toHaveLength(5);
  });

  it("prefills from the visitor's lead and links it when the email matches one", async () => {
    const done = await signIn("morgan@example.com");
    const own = (await loadOwnPlan(db, done.planId))!;
    expect(own.linkedToLead).toBe(true);
    expect((await db.familyPlans.get(done.planId))!.leadId).toBe("lead-0002");
    expect(own.body.people).toMatchObject({ homeState: "TX", maritalStatus: "widowed", childrenStatus: "adults" });
    expect(own.body.assets.items.map((a) => a.type)).toEqual(["real_estate"]);
    expect(own.prefilledFrom).toEqual(["lead"]);
  });
});

describe("saving and deleting your own plan", () => {
  it("saves, recomputes the summary, and never stores rejected text", async () => {
    const { planId } = await signIn("save@x.test");
    const ok = await saveOwnPlan(db, planId, { people: { childrenStatus: "minors" }, assets: { items: [{ id: "r1", type: "retirement", label: "401k", beneficiary: "no" }] } }, NOW);
    expect(ok.ok).toBe(true);
    const stored = (await db.familyPlans.get(planId))!;
    expect(stored.gapCount).toBe(2);
    expect(stored.summary.gaps.map((g) => g.code)).toEqual(["minor_no_guardian", "retirement_no_beneficiary"]);
    expect((await db.familyPlanBodies.get(planId))!.ciphertext).not.toContain("401k");

    const before = (await db.familyPlanBodies.get(planId))!.ciphertext;
    const bad = await saveOwnPlan(db, planId, { wishes: { other: "SSN 123-45-6789" } }, NOW);
    expect(bad).toMatchObject({ ok: false, fields: { "wishes.other": SENSITIVE_TEXT_MESSAGE } });
    expect((await db.familyPlanBodies.get(planId))!.ciphertext).toBe(before);
    const updates = await db.audit.list((e) => e.action === "family_plan.update");
    expect(updates).toHaveLength(1);
    expect(updates[0].detail).toEqual({ sectionsDone: 0, gapCount: 2 });
  });

  it("preview validates and computes without storing anything", async () => {
    const plans = (await db.familyPlans.list()).length;
    const r = previewPlan({ people: { childrenStatus: "both" } }, NOW);
    expect(r.ok && r.summary.gaps[0].code).toBe("minor_no_guardian");
    expect(previewPlan({ papers: { location: "card 4111111111111111" } }).ok).toBe(false);
    expect((await db.familyPlans.list()).length).toBe(plans);
  });

  it("delete removes the answers and the summary for good, and is audited", async () => {
    const { planId, sessionToken } = await signIn("del@x.test");
    await saveOwnPlan(db, planId, { papers: { location: "desk" } }, NOW);
    expect(await deleteOwnPlan(db, planId, NOW)).toBe(true);
    expect(await db.familyPlans.get(planId)).toBeUndefined();
    expect(await db.familyPlanBodies.get(planId)).toBeUndefined();
    expect(await planIdOf(sessionToken)).toBeNull();
    expect(await deleteOwnPlan(db, planId, NOW)).toBe(false);
    const del = await db.audit.list((e) => e.action === "family_plan.delete");
    expect(del).toEqual([expect.objectContaining({ resourceId: planId, actorRole: "planner" })]);
    expect(JSON.stringify(del)).not.toContain("desk");
    expect(verifyAuditChain(await db.audit.list())).toEqual({ ok: true });
  });
});

describe("permissions", () => {
  it("a plan session is not a portal session, and a portal session is not a plan session", async () => {
    const { sessionToken, planId } = await signIn("perm@x.test");
    expect(await actorFromSession(db, sessionToken, NOW)).toBeNull();
    const portal = issueSession("u-admin", true, NOW);
    expect(await planIdOf(portal)).toBeNull();
    expect(await planIdOf(sessionToken + "x")).toBeNull();
    expect(await planIdOf(sessionToken)).toBe(planId);
    expect(await planIdOf(sessionToken, new Date(NOW.getTime() + 8 * 86_400_000))).toBeNull();
  });

  it("a session opens only its own plan", async () => {
    const a = await signIn("a@x.test");
    const b = await signIn("b@x.test");
    expect(await planIdOf(a.sessionToken)).toBe(a.planId);
    expect((await loadOwnPlan(db, (await planIdOf(a.sessionToken))!))!.id).toBe(a.planId);
    expect(a.planId).not.toBe(b.planId);
    // a body copied onto another plan's row does not open there
    const bBody = (await db.familyPlanBodies.get(b.planId))!;
    await db.familyPlanBodies.update(a.planId, { ciphertext: bBody.ciphertext });
    await expect(loadOwnPlan(db, a.planId)).rejects.toThrow();
  });

  it("the case view shows the organizer summary only to staff with intake or full access", async () => {
    // lead-0001 has the seeded demo plan and is in the intake queue
    const intake = user("u-intake");
    const view = await buildCaseView(db, intake, "lead-0001", NOW);
    expect(view.sections.organizer?.summary.gaps.map((g) => g.code)).toEqual(
      expect.arrayContaining(["minor_no_guardian", "retirement_no_beneficiary", "no_will_or_trust", "no_healthcare_directive"]),
    );
    const json = JSON.stringify(view.sections.organizer);
    for (const secret of ["Jamie", "Ava", "Leo", "401(k)", "Our home", "Policy through work"]) expect(json).not.toContain(secret);
    expect(await db.audit.list((e) => e.action === "family_plan.staff_view" && e.leadId === "lead-0001")).toHaveLength(1);

    const admin = await buildCaseView(db, user("u-admin"), "lead-0001", NOW);
    expect(admin.sections.organizer).toBeDefined();
    for (const id of ["u-lawyer-a", "u-lawyer-b", "u-paralegal", "u-firmadmin"]) {
      await expect(buildCaseView(db, user(id), "lead-0001", NOW)).rejects.toThrow();
    }
  });

  it("an attorney sees it once they hold the case, not at the offer stage, and the client does not", async () => {
    const { planId } = await signIn("morgan@example.com"); // linked to lead-0002, which is on offer
    expect((await db.familyPlans.get(planId))!.leadId).toBe("lead-0002");
    const offer = (await db.assignments.list((a) => a.leadId === "lead-0002" && a.status === "offered"))[0];
    const attorney = actorFor(DEMO_USERS.find((u) => u.lawyerId === offer.lawyerId)!);
    const other = actorFor(DEMO_USERS.find((u) => u.role === "attorney" && u.lawyerId !== offer.lawyerId)!);
    const card = await buildCaseView(db, attorney, "lead-0002", NOW);
    expect(card.access).toBe("conflict_card");
    expect(card.sections.organizer).toBeUndefined();

    await acceptOffer(db, attorney, offer.id, NOW);
    const full = await buildCaseView(db, attorney, "lead-0002", NOW);
    expect(full.sections.organizer?.planId).toBe(planId);
    await expect(buildCaseView(db, other, "lead-0002", NOW)).rejects.toThrow();
    const lead = (await db.leads.get("lead-0002"))!;
    const assignments = await db.assignments.list(undefined, { leadId: lead.id });
    expect(await organizerSummaryForLead(db, other, lead, assignments, NOW)).toBeUndefined();
    expect(await organizerSummaryForLead(db, user("u-marketing"), lead, assignments, NOW)).toBeUndefined();

    const { token } = await inviteClient(db, attorney, "lead-0002", NOW);
    const { userId } = await acceptInvite(db, token, NOW);
    const client: Actor = actorFor((await db.users.get(userId))!);
    expect(leadAccess(client, lead, assignments, NOW)).toBe("client");
    expect(canViewFamilyPlanSummary(client, lead, assignments, NOW)).toBe(false);
    expect((await buildCaseView(db, client, "lead-0002", NOW)).sections.organizer).toBeUndefined();
  });

  it("a new lead links only to the signed-in visitor's plan with the same email", async () => {
    const { planId } = await signIn("book@x.test");
    expect(await linkPlanToNewLead(db, planId, { id: "lead-0001" }, "someone-else@x.test", NOW)).toBe(false);
    expect((await db.familyPlans.get(planId))!.leadId).toBeUndefined();
    expect(await linkPlanToNewLead(db, planId, { id: "lead-0001" }, "Book@X.test", NOW)).toBe(true);
    expect((await db.familyPlans.get(planId))!.leadId).toBe("lead-0001");
    expect(await db.audit.list((e) => e.action === "family_plan.link" && e.resourceId === planId)).toHaveLength(1);
  });
});
