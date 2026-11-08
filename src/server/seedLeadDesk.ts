/**
 * Development demo data for the leads desk (/admin/leads): a week of Illinois website and phone leads in
 * every state the desk shows (waiting on a reply, talking, consult booked, retained, closed). Only the
 * development runtime calls this, never tests or production. All names are fictional.
 */
import { randomUUID } from "node:crypto";
import { buildConsentRecord } from "@/lib/consent";
import type { LeadRecord } from "@/lib/crm";
import { scoreLead, segmentTags } from "@/lib/scoring";
import type { Db } from "@/server/db";
import { actorFor, DEMO_USERS } from "@/server/seed";
import { exitLead, ingestLead, recordConflictCheck, setStage } from "@/server/services/leads";
import type { Stage } from "@/server/types";

const HOUR = 3_600_000;

type Answers = LeadRecord["answers"];
type Plan = {
  first: string;
  last: string;
  hoursAgo: number;
  county: string;
  tool: string;
  resource?: string;
  page: string;
  utm?: string;
  answers: Answers;
  goals: string;
  /** What happened after it came in */
  then?: { reached?: boolean; stage?: Stage; consultInHours?: number; closed?: "unresponsive" | "not_a_fit"; outsideReferralDaysAgo?: number };
};

const PLANS: Plan[] = [
  { first: "Priya", last: "Natarajan", hoursAgo: 0.6, county: "DuPage", tool: "plan_finder", page: "/plan-finder", utm: "google", answers: { matterType: "new_plan", maritalStatus: "married", children: "minors", ownsHome: "yes", urgency: "this_month" }, goals: "Two kids under 6, no will yet." },
  { first: "Marcus", last: "Bell", hoursAgo: 3, county: "Kane", tool: "callback", page: "/probate/illinois", answers: { matterType: "after_death", urgency: "recent_death" }, goals: "Mom passed two weeks ago, house in St Charles." },
  { first: "Elena", last: "Sorensen", hoursAgo: 9, county: "Will", tool: "guide", resource: "illinois-probate-checklist", page: "/free/illinois-probate-checklist", utm: "google", answers: { matterType: "not_sure", urgency: "exploring" }, goals: "" },
  { first: "Dev", last: "Kapoor", hoursAgo: 26, county: "Cook", tool: "cost_calculator", page: "/tools/estate-plan-cost", answers: { matterType: "new_plan", maritalStatus: "married", children: "adults", ownsHome: "yes", assetRange: "1m_5m", urgency: "this_month" }, goals: "Want a trust so the kids skip probate." },
  { first: "Hannah", last: "Moreau", hoursAgo: 30, county: "DuPage", tool: "will_vs_trust", page: "/living-trusts", utm: "chatgpt.com", answers: { matterType: "new_plan", maritalStatus: "single", children: "none", ownsHome: "yes", urgency: "exploring" }, goals: "", then: { reached: true } },
  { first: "James", last: "Okoro", hoursAgo: 52, county: "Kane", tool: "phone_call", page: "phone", answers: { matterType: "update_plan", maritalStatus: "married", urgency: "this_month" }, goals: "Will from 2009, moved from Ohio.", then: { reached: true, stage: "qualified" } },
  { first: "Rosa", last: "Delgado", hoursAgo: 60, county: "Cook", tool: "intake", page: "/book", utm: "google", answers: { matterType: "elder_care", urgency: "health_event" }, goals: "Dad going into memory care next month.", then: { reached: true, stage: "consult_booked", consultInHours: 20 } },
  { first: "Tom", last: "Lindqvist", hoursAgo: 75, county: "DuPage", tool: "readiness_score", page: "/quizzes/estate-plan-readiness", answers: { matterType: "new_plan", maritalStatus: "partnered", children: "minors", urgency: "this_month" }, goals: "", then: { reached: true, stage: "consult_booked", consultInHours: -26 } },
  { first: "Grace", last: "Whitfield", hoursAgo: 96, county: "Lake", tool: "plan_finder", page: "/plan-finder", utm: "facebook", answers: { matterType: "new_plan", maritalStatus: "married", children: "both", ownsHome: "yes", ownsBusiness: "yes", urgency: "this_month" }, goals: "Business owner, blended family.", then: { reached: true, stage: "retainer_signed" } },
  { first: "Ahmed", last: "Siddiqui", hoursAgo: 120, county: "Kane", tool: "chat", page: "/estate-planning/st-charles", answers: { matterType: "new_plan", urgency: "exploring" }, goals: "", then: { reached: true, closed: "unresponsive" } },
  { first: "Nora", last: "Fitzgerald", hoursAgo: 140, county: "McHenry", tool: "guide", resource: "guardian-for-minor-children", page: "/free/guardian-for-minor-children", answers: { matterType: "new_plan", children: "minors", urgency: "this_month" }, goals: "", then: { reached: true, stage: "consult_held" } },
  { first: "Victor", last: "Han", hoursAgo: 24 * 21, county: "Cook", tool: "intake", page: "/business-succession", answers: { matterType: "new_plan", ownsBusiness: "yes", urgency: "this_month" }, goals: "Partnership buy-sell agreement.", then: { reached: true, stage: "qualified", outsideReferralDaysAgo: 18 } },
];

export async function seedLeadDeskDemo(db: Db, now = new Date()): Promise<void> {
  const intake = actorFor(DEMO_USERS[1]);
  const lawyer = (await db.lawyers.list()).find((l) => l.primaryIntake) ?? (await db.lawyers.list())[0];
  for (const [i, p] of PLANS.entries()) {
    const at = new Date(now.getTime() - p.hoursAgo * HOUR);
    const t = (h: number) => new Date(Math.min(at.getTime() + h * HOUR, now.getTime() - 60_000));
    const id = `lead-d${String(i + 1).padStart(2, "0")}`;
    const record: LeadRecord = {
      id,
      receivedAt: at.toISOString(),
      contact: { firstName: p.first, lastName: p.last, email: `${p.first.toLowerCase()}.${p.last.toLowerCase()}@example.com`, phone: `630555${String(1000 + i * 37).slice(-4)}`, state: "IL", county: p.county, language: "English" },
      contactMethod: "phone",
      goals: p.goals || undefined,
      answers: p.answers,
      score: scoreLead({ state: "IL", servedStates: ["IL"], answers: p.answers, goals: p.goals, smsConsent: i % 2 === 0 }),
      segments: segmentTags(p.answers),
      source: { landingPage: p.page === "phone" ? "phone" : `https://familyfutureplanning.com${p.page}`, utmSource: p.utm },
      capture: { tool: p.tool, resource: p.resource } as LeadRecord["capture"],
      priorTools: [],
      consent: buildConsentRecord({ smsConsent: i % 2 === 0, acknowledgedNoRelationship: p.tool !== "phone_call", pageUrl: p.page, ip: null, userAgent: null, now: at }),
    };
    await ingestLead(db, record, at);
    const then = p.then;
    if (!then?.reached) continue;
    await db.activities.insert({ id: randomUUID(), leadId: id, kind: "call", direction: "outbound", at: t(0.3).toISOString(), summary: "Call: reached them. Walked through what they need.", byUserId: intake.userId });
    await setStage(db, intake, id, "contacted", t(0.3));
    if (then.closed) {
      await exitLead(db, intake, id, then.closed, undefined, t(30));
      continue;
    }
    if (!then.stage) continue;
    await setStage(db, intake, id, "qualified", t(1));
    await recordConflictCheck(db, intake, id, "clear", t(1));
    if (then.stage === "qualified" && !then.outsideReferralDaysAgo) continue;
    if (lawyer) await db.leads.update(id, { assignedLawyerId: lawyer.id, firmId: lawyer.firmId });
    if (then.outsideReferralDaysAgo !== undefined && lawyer) {
      const when = new Date(now.getTime() - then.outsideReferralDaysAgo * 24 * HOUR).toISOString();
      await db.leadReferrals.insert({ id: randomUUID(), leadId: id, fromLawyerId: lawyer.id, fromFirmId: lawyer.firmId, outsideName: "A business-law attorney", outsideFirm: "Outside the network", reason: "practice_area", clientAgreed: true, referredAt: when, referredBy: intake.userId, outcome: "pending" });
      continue;
    }
    for (const s of ["accepted", "consult_booked"] as Stage[]) await setStage(db, intake, id, s, t(2));
    if (then.consultInHours !== undefined && lawyer) {
      await db.consults.insert({ id: randomUUID(), leadId: id, lawyerId: lawyer.id, at: new Date(now.getTime() + then.consultInHours * HOUR).toISOString(), type: "video", status: "booked" });
    }
    if (then.stage === "consult_held" || then.stage === "retainer_signed") await setStage(db, intake, id, "consult_held", t(30));
    if (then.stage === "retainer_signed") await setStage(db, intake, id, "retainer_signed", t(50));
  }
}
