/**
 * Development demo data for the case board (/admin/cases): accepted cases spread across the whole
 * lead-to-close journey, a second paralegal, and paralegal assignments, so a paralegal sign-in shows only
 * their own cases. Only the development runtime calls this, never tests or production. Names are fictional.
 */
import type { Db } from "@/server/db";
import { actorFor, DEMO_FIRM_ID, DEMO_USERS, demoRecord } from "@/server/seed";
import { assignParalegal, updateCaseStep } from "@/server/services/caseBoard";
import { exitLead, ingestLead, setStage } from "@/server/services/leads";
import type { Actor, Stage } from "@/server/types";

const DAY = 86_400_000;
const PIPE: Stage[] = ["contacted", "qualified", "offered", "accepted", "consult_booked", "consult_held", "proposal_sent", "retainer_signed", "paid"];

export async function seedCaseDemo(db: Db, now = new Date()): Promise<void> {
  if (!(await db.users.get("u-paralegal-2"))) {
    await db.users.insert({ id: "u-paralegal-2", email: "drew@example.com", name: "Drew Paralegal", role: "paralegal", firmId: DEMO_FIRM_ID, supportsLawyerIds: ["lawyer-a", "lawyer-b"], active: true });
  }
  const sys = actorFor(DEMO_USERS[1]);
  const avery = actorFor(DEMO_USERS.find((u) => u.id === "u-lawyer-a")!);
  const jordan = actorFor(DEMO_USERS.find((u) => u.id === "u-lawyer-b")!);
  const casey: Actor = actorFor(DEMO_USERS.find((u) => u.id === "u-paralegal")!);
  const drew: Actor = { userId: "u-paralegal-2", role: "paralegal", firmId: DEMO_FIRM_ID, supportsLawyerIds: ["lawyer-a", "lawyer-b"], mfa: true };

  type Spec = {
    id: string; first: string; last: string; business?: boolean; lawyer: "lawyer-a" | "lawyer-b"; para?: Actor;
    /** pipeline stages walked, ending here */
    upTo: Stage; daysAgo: number;
    /** legal steps ticked off after payment, in order */
    legal?: [string, "done" | "skip", string?][];
    /** days since the last step, to make a case look stuck */
    idle?: number;
    exit?: "chose_another_option" | "unresponsive";
  };
  const specs: Spec[] = [
    { id: "case-0101", first: "Elena", last: "Brooks", lawyer: "lawyer-a", para: casey, upTo: "consult_booked", daysAgo: 4, idle: 2 },
    { id: "case-0102", first: "Marcus", last: "Hill", lawyer: "lawyer-b", para: drew, upTo: "consult_held", daysAgo: 9, idle: 6 },
    { id: "case-0103", first: "Nadia", last: "Patel", lawyer: "lawyer-a", upTo: "proposal_sent", daysAgo: 8, idle: 2 },
    { id: "case-0104", first: "Owen", last: "Carter", lawyer: "lawyer-a", para: casey, upTo: "paid", daysAgo: 12, idle: 3 },
    { id: "case-0105", first: "Grace", last: "Nguyen", lawyer: "lawyer-a", para: casey, upTo: "paid", daysAgo: 24, legal: [["documents_gathered", "done", "Deed, 401(k) and bank list in"]], idle: 11 },
    { id: "case-0106", first: "Ben", last: "Ortiz", business: true, lawyer: "lawyer-b", para: drew, upTo: "paid", daysAgo: 30, legal: [["documents_gathered", "done"], ["drafted", "done", "Trust, pour-over will, POAs"]], idle: 1 },
    { id: "case-0107", first: "Hannah", last: "Wells", lawyer: "lawyer-a", para: casey, upTo: "paid", daysAgo: 38, legal: [["documents_gathered", "done"], ["drafted", "done"], ["attorney_review", "done"], ["client_review", "done", "One revision: changed successor trustee"]], idle: 4 },
    { id: "case-0108", first: "Leo", last: "Fischer", lawyer: "lawyer-a", para: drew, upTo: "paid", daysAgo: 52, legal: [["documents_gathered", "done"], ["drafted", "done"], ["attorney_review", "done"], ["client_review", "done"], ["signed", "done", "Signed at the office with two witnesses"]], idle: 9 },
    { id: "case-0109", first: "Sofia", last: "Reyes", lawyer: "lawyer-b", para: casey, upTo: "paid", daysAgo: 70, legal: [["documents_gathered", "done"], ["drafted", "done"], ["attorney_review", "done"], ["client_review", "done"], ["signed", "done"], ["funded", "skip", "Will-only plan, nothing to fund"], ["closed", "done"]], idle: 5 },
    { id: "case-0110", first: "Isaac", last: "Moore", lawyer: "lawyer-a", upTo: "consult_held", daysAgo: 15, exit: "chose_another_option", idle: 7 },
  ];

  for (const s of specs) {
    if (await db.leads.get(s.id)) continue;
    const start = new Date(now.getTime() - s.daysAgo * DAY);
    const record = demoRecord(s.id, s.first, s.last, { matterType: "new_plan", ownsBusiness: s.business ? "yes" : "no", maritalStatus: "married", children: "minors", ownsHome: "yes", assetRange: "250k_1m", urgency: "this_month" }, "Wills, a trust and guardians for the kids.", start);
    record.contact.email = `${s.id}@example.com`; // its own person, not merged with another demo lead of the same first name
    const lead = await ingestLead(db, record, start);
    await db.leads.update(lead.id, { firmId: DEMO_FIRM_ID, assignedLawyerId: s.lawyer });
    const stages = PIPE.slice(0, PIPE.indexOf(s.upTo) + 1);
    const legal = s.legal ?? [];
    const steps = stages.length + legal.length;
    // spread the steps from the start date up to `idle` days ago
    const end = now.getTime() - (s.idle ?? 1) * DAY;
    const gap = Math.max(1, Math.floor((end - start.getTime()) / Math.max(1, steps)));
    let t = start.getTime();
    for (const st of stages) {
      t += gap;
      await setStage(db, sys, lead.id, st, new Date(Math.min(t, end)));
    }
    const lawyerActor = s.lawyer === "lawyer-a" ? avery : jordan;
    if (s.para) await assignParalegal(db, lawyerActor, lead.id, s.para.userId, new Date(Math.min(t, end)));
    for (const [step, action, note] of legal) {
      t += gap;
      const who = step === "attorney_review" ? lawyerActor : s.para ?? lawyerActor;
      await updateCaseStep(db, who, lead.id, step, action, note, new Date(Math.min(t, end)));
    }
    if (s.exit) await exitLead(db, sys, lead.id, s.exit, "Went with a family friend's attorney", new Date(end));
  }

  // The retainer demo's paid case belongs to Casey too, so the paralegal sign-in shows a mix.
  const paidDemo = await db.leads.get("lead-0005");
  if (paidDemo?.assignedLawyerId && !paidDemo.assignedParalegalId) await assignParalegal(db, avery, paidDemo.id, "u-paralegal", now);
}
