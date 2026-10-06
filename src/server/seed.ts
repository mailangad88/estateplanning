/**
 * Demo data for local development and tests: one firm under the in-firm
 * structure, two attorneys, a paralegal, every staff role, and leads at
 * different points in the pipeline. All names are fictional.
 */
import { feeRules } from "@/config/fees";
import { firm as firmConfig } from "@/config/firm";
import { buildConsentRecord } from "@/lib/consent";
import type { LeadRecord } from "@/lib/crm";
import { scoreLead, segmentTags } from "@/lib/scoring";
import type { Db } from "@/server/db";
import { seedFeeRules } from "@/server/fees/admin";
import { ingestLead, recordConflictCheck, setStage, updateIntake } from "@/server/services/leads";
import { offerNext } from "@/server/services/routing";
import { FAMILY_PLAN_CONSENT_VERSION, familyPlanBodySchema, summarizePlan } from "@/lib/familyPlan";
import { encryptPlanBody, familyPlanConfigured, hashEmail } from "@/server/services/familyPlan";
import type { Actor, Lawyer, User } from "@/server/types";

export const DEMO_FIRM_ID = "firm-demo";

const lawyers: Lawyer[] = [
  {
    id: "lawyer-a",
    firmId: DEMO_FIRM_ID,
    name: "Avery Demo, Esq.",
    email: "avery@example.com",
    bio: "Estate planning and trust administration.",
    licensedStates: ["TX"],
    matterTypes: ["new_plan", "update_plan", "administration", "special_needs", "business_succession", "elder_law"],
    specialties: ["special_needs", "probate"],
    languages: ["English", "Spanish"],
    weeklyCapacity: 10,
    activeLeadCap: 25,
    acceptSlaMinutes: 30,
    onCall: true,
    active: true,
    stats: { avgAcceptMinutes: 12, showRate: 0.82, reviewScore: 4.9 },
  },
  {
    id: "lawyer-b",
    firmId: DEMO_FIRM_ID,
    name: "Jordan Sample, Esq.",
    email: "jordan@example.com",
    bio: "Business owners and blended families.",
    licensedStates: ["TX"],
    matterTypes: ["new_plan", "update_plan", "business_succession"],
    specialties: ["business_succession", "blended_family"],
    languages: ["English"],
    weeklyCapacity: 8,
    activeLeadCap: 20,
    acceptSlaMinutes: 30,
    active: true,
    stats: { avgAcceptMinutes: 20, showRate: 0.78, reviewScore: 4.8 },
  },
];

export const DEMO_USERS: User[] = [
  { id: "u-admin", email: "admin@example.com", name: "Pat Admin", role: "platform_admin", active: true },
  { id: "u-intake", email: "intake@example.com", name: "Sam Intake", role: "intake", active: true },
  { id: "u-marketing", email: "marketing@example.com", name: "Riley Marketing", role: "marketing", active: true },
  { id: "u-firmadmin", email: "office@example.com", name: "Morgan Office", role: "firm_admin", firmId: DEMO_FIRM_ID, active: true },
  { id: "u-lawyer-a", email: "avery@example.com", name: "Avery Demo", role: "attorney", firmId: DEMO_FIRM_ID, lawyerId: "lawyer-a", active: true },
  { id: "u-lawyer-b", email: "jordan@example.com", name: "Jordan Sample", role: "attorney", firmId: DEMO_FIRM_ID, lawyerId: "lawyer-b", active: true },
  { id: "u-paralegal", email: "para@example.com", name: "Casey Paralegal", role: "paralegal", firmId: DEMO_FIRM_ID, supportsLawyerIds: ["lawyer-a"], active: true },
];

export function actorFor(user: User, mfa = true): Actor {
  return { userId: user.id, role: user.role, firmId: user.firmId, lawyerId: user.lawyerId, supportsLawyerIds: user.supportsLawyerIds, personId: user.personId, mfa };
}

function demoRecord(id: string, first: string, last: string, answers: LeadRecord["answers"], goals: string, at: Date): LeadRecord {
  return {
    id,
    receivedAt: at.toISOString(),
    contact: { firstName: first, lastName: last, email: `${first.toLowerCase()}@example.com`, phone: `512555${id.slice(-4).padStart(4, "0")}`, state: "TX", county: "Travis", language: "English" },
    contactMethod: "phone",
    goals,
    answers,
    score: scoreLead({ state: "TX", servedStates: ["TX"], answers, goals, smsConsent: true }),
    segments: segmentTags(answers),
    source: { utmSource: "google", utmMedium: "cpc", utmCampaign: "trusts-austin", landingPage: "/plan-finder" },
    capture: { tool: "plan_finder" },
    priorTools: [],
    consent: buildConsentRecord({ smsConsent: true, acknowledgedNoRelationship: true, pageUrl: "/plan-finder", ip: null, userAgent: null, now: at }),
  };
}

/** A demo "My family plan" organizer linked to a demo lead, so the portal's organizer summary has something to show. */
async function seedFamilyPlan(db: Db, leadId: string, email: string, now: Date): Promise<void> {
  const year = now.getUTCFullYear();
  const body = familyPlanBodySchema.parse({
    people: {
      homeState: "TX", maritalStatus: "married", spouseName: "Jamie Rivera", childrenStatus: "minors",
      children: [{ id: "c1", name: "Ava", birthYear: year - 4 }, { id: "c2", name: "Leo", birthYear: year }],
      executor: "Jamie Rivera",
    },
    assets: {
      items: [
        { id: "a1", type: "real_estate", label: "Our home", valueRange: "250k_1m", titling: "joint_spouse", beneficiary: "no" },
        { id: "a2", type: "retirement", label: "Work 401(k)", valueRange: "50k_250k", titling: "sole", beneficiary: "not_sure" },
        { id: "a3", type: "life_insurance", label: "Policy through work", valueRange: "250k_1m", titling: "sole", beneficiary: "yes", beneficiaryName: "Jamie" },
      ],
    },
    documents: { will: { has: "no" }, trust: { has: "no" }, healthcareDirective: { has: "no" } },
  });
  const summary = summarizePlan(body, year);
  const id = "fp_demo-0001";
  const at = now.toISOString();
  await db.familyPlans.insert({
    id, emailHash: hashEmail(email), leadId, summary, sectionsDone: summary.sectionsDone, gapCount: summary.gaps.length,
    consent: { version: FAMILY_PLAN_CONSENT_VERSION, at }, createdAt: at, updatedAt: at,
  });
  await db.familyPlanBodies.insert({ id, ciphertext: encryptPlanBody(id, body), updatedAt: at });
}

export async function seedDemo(db: Db, now = new Date()): Promise<void> {
  await db.firms.insert({ id: DEMO_FIRM_ID, name: firmConfig.firmLegalName, structure: firmConfig.structure });
  for (const l of lawyers) await db.lawyers.insert(l);
  for (const u of DEMO_USERS) await db.users.insert(u);
  await seedFeeRules(db, feeRules, firmConfig.structure);

  const intake = actorFor(DEMO_USERS[1]);
  const hour = 3_600_000;

  const a = await ingestLead(
    db,
    demoRecord("lead-0001", "Taylor", "Rivera", { matterType: "new_plan", maritalStatus: "married", children: "minors", ownsHome: "yes", assetRange: "250k_1m", urgency: "this_month", specialNeeds: "no", blendedFamily: "no", ownsBusiness: "no", outOfStateProperty: "no", existingDocuments: "none" }, "We just had our second child and have nothing in place.", new Date(now.getTime() - 5 * hour)),
    new Date(now.getTime() - 5 * hour),
  );
  await updateIntake(db, intake, a.id, {
    summary: "Married couple, two children under 5, own a home in Austin.\nNo existing documents.\nWant guardians named and a trust for the kids.\nBoth work full time; prefer evening video consult.\nNo red flags.",
    conflictParties: [{ name: "Jamie Rivera", relationship: "spouse" }],
    householdMembers: [{ name: "Jamie Rivera", relationship: "spouse" }, { name: "Child 1", relationship: "child", age: 4 }, { name: "Child 2", relationship: "child", age: 0 }],
  }, now);
  await setStage(db, intake, a.id, "qualified", now);
  await recordConflictCheck(db, intake, a.id, "clear", now);
  if (familyPlanConfigured()) await seedFamilyPlan(db, a.id, "taylor@example.com", now);

  const b = await ingestLead(
    db,
    demoRecord("lead-0002", "Morgan", "Lee", { matterType: "after_death", maritalStatus: "widowed", children: "adults", ownsHome: "yes", urgency: "recent_death" }, "My father passed last week and I am the executor.", new Date(now.getTime() - 2 * hour)),
    new Date(now.getTime() - 2 * hour),
  );
  await updateIntake(db, intake, b.id, {
    summary: "Adult child, named executor in father's will.\nFather died last week in Travis County.\nHouse and a brokerage account; sibling may contest.\nNeeds to know first steps and deadlines.\nFlag: possible family dispute.",
    conflictParties: [{ name: "Robert Lee", relationship: "deceased" }, { name: "Chris Lee", relationship: "heir" }],
    redFlags: [...b.intake.redFlags, "Possible dispute between siblings"],
  }, now);
  await setStage(db, intake, b.id, "qualified", now);
  await recordConflictCheck(db, intake, b.id, "clear", now);
  await offerNext(db, b.id, now);
}
