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
    consent: buildConsentRecord({ smsConsent: true, acknowledgedNoRelationship: true, pageUrl: "/plan-finder", ip: null, userAgent: null, now: at }),
  };
}

export function seedDemo(db: Db, now = new Date()): void {
  db.firms.insert({ id: DEMO_FIRM_ID, name: firmConfig.firmLegalName, structure: firmConfig.structure });
  for (const l of lawyers) db.lawyers.insert(l);
  for (const u of DEMO_USERS) db.users.insert(u);
  seedFeeRules(db, feeRules, firmConfig.structure);

  const intake = actorFor(DEMO_USERS[1]);
  const hour = 3_600_000;

  const a = ingestLead(
    db,
    demoRecord("lead-0001", "Taylor", "Rivera", { matterType: "new_plan", maritalStatus: "married", children: "minors", ownsHome: "yes", assetRange: "250k_1m", urgency: "this_month", specialNeeds: "no", blendedFamily: "no", ownsBusiness: "no", outOfStateProperty: "no", existingDocuments: "none" }, "We just had our second child and have nothing in place.", new Date(now.getTime() - 5 * hour)),
    new Date(now.getTime() - 5 * hour),
  );
  updateIntake(db, intake, a.id, {
    summary: "Married couple, two children under 5, own a home in Austin.\nNo existing documents.\nWant guardians named and a trust for the kids.\nBoth work full time; prefer evening video consult.\nNo red flags.",
    conflictParties: [{ name: "Jamie Rivera", relationship: "spouse" }],
    householdMembers: [{ name: "Jamie Rivera", relationship: "spouse" }, { name: "Child 1", relationship: "child", age: 4 }, { name: "Child 2", relationship: "child", age: 0 }],
  }, now);
  setStage(db, intake, a.id, "qualified", now);
  recordConflictCheck(db, intake, a.id, "clear", now);

  const b = ingestLead(
    db,
    demoRecord("lead-0002", "Morgan", "Lee", { matterType: "after_death", maritalStatus: "widowed", children: "adults", ownsHome: "yes", urgency: "recent_death" }, "My father passed last week and I am the executor.", new Date(now.getTime() - 2 * hour)),
    new Date(now.getTime() - 2 * hour),
  );
  updateIntake(db, intake, b.id, {
    summary: "Adult child, named executor in father's will.\nFather died last week in Travis County.\nHouse and a brokerage account; sibling may contest.\nNeeds to know first steps and deadlines.\nFlag: possible family dispute.",
    conflictParties: [{ name: "Robert Lee", relationship: "deceased" }, { name: "Chris Lee", relationship: "heir" }],
    redFlags: [...b.intake.redFlags, "Possible dispute between siblings"],
  }, now);
  setStage(db, intake, b.id, "qualified", now);
  recordConflictCheck(db, intake, b.id, "clear", now);
  offerNext(db, b.id, now);
}
