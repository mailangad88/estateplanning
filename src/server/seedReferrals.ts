/**
 * Development demo data for referral tracking: leads over the past few months that the primary intake
 * attorney (Avery Demo in the demo firm) kept, referred to Jordan Sample, or referred outside the platform,
 * with outcomes. Only the development runtime calls this, never tests. All names are fictional.
 */
import type { Db } from "@/server/db";
import { actorFor, DEMO_USERS, demoRecord } from "@/server/seed";
import { ingestLead, recordConflictCheck, setStage } from "@/server/services/leads";
import { recordOutcome, referLead, type ReferInput } from "@/server/services/referrals";
import { acceptOffer, declineOffer, offerNext } from "@/server/services/routing";

const DAY = 86_400_000;

type Plan =
  | { kind: "kept"; stage?: "consult_booked" | "consult_held" }
  | { kind: "platform"; reason: ReferInput["reason"]; then?: "accepted" | "booked" | "retained" | "declined"; note?: string }
  | { kind: "outside"; reason: ReferInput["reason"]; name: string; firm: string; outcome?: "booked" | "retained" | "declined" | "no_response" };

const PEOPLE: [string, string, number, Plan][] = [
  ["Dana", "Okafor", 150, { kind: "kept", stage: "consult_held" }],
  ["Luis", "Ortega", 140, { kind: "outside", reason: "practice_area", name: "Maria Chen", firm: "Chen Elder Law", outcome: "retained" }],
  ["Hannah", "Weiss", 128, { kind: "kept" }],
  ["Omar", "Haddad", 118, { kind: "platform", reason: "capacity", then: "retained" }],
  ["Grace", "Kim", 104, { kind: "kept", stage: "consult_booked" }],
  ["Peter", "Novak", 96, { kind: "kept" }],
  ["Ruth", "Adeyemi", 88, { kind: "platform", reason: "conflict", then: "booked", note: "Knows the other side of the family" }],
  ["Ivan", "Petrov", 75, { kind: "outside", reason: "language", name: "Elena Sokolova", firm: "Sokolova Law", outcome: "booked" }],
  ["Mei", "Lin", 66, { kind: "kept", stage: "consult_held" }],
  ["Tom", "Becker", 58, { kind: "kept" }],
  ["Aisha", "Rahman", 47, { kind: "platform", reason: "capacity", then: "accepted" }],
  ["Ben", "Carter", 38, { kind: "outside", reason: "location", name: "Maria Chen", firm: "Chen Elder Law", outcome: "declined" }],
  ["Sofia", "Rossi", 29, { kind: "kept" }],
  ["Noah", "Fischer", 21, { kind: "platform", reason: "client_request", then: "declined" }],
  ["Lena", "Park", 12, { kind: "kept", stage: "consult_booked" }],
  ["Eli", "Brooks", 5, { kind: "platform", reason: "capacity" }],
  ["Zoe", "Martin", 3, { kind: "outside", reason: "practice_area", name: "Sam Patel", firm: "Patel Business Law" }],
];

export async function seedReferralDemo(db: Db, now = new Date()): Promise<void> {
  const intake = actorFor(DEMO_USERS[1]);
  const avery = actorFor(DEMO_USERS.find((u) => u.id === "u-lawyer-a")!);
  const jordan = actorFor(DEMO_USERS.find((u) => u.id === "u-lawyer-b")!);
  for (const [i, [first, last, daysAgo, plan]] of PEOPLE.entries()) {
    const at = new Date(now.getTime() - daysAgo * DAY);
    const t = (h: number) => new Date(at.getTime() + h * 3_600_000);
    const id = `lead-r${String(i + 1).padStart(2, "0")}`;
    await ingestLead(db, demoRecord(id, first, last, { matterType: "new_plan", maritalStatus: "married", children: "minors", ownsHome: "yes", assetRange: "250k_1m", urgency: "this_month" }, "Wills and a trust for the kids.", at), at);
    await setStage(db, intake, id, "qualified", t(1));
    await recordConflictCheck(db, intake, id, "clear", t(1));
    const { offered } = await offerNext(db, id, t(2));
    if (!offered) continue;
    await acceptOffer(db, avery, offered.id, t(2.2));
    if (plan.kind === "kept") {
      if (plan.stage) await setStage(db, intake, id, plan.stage, t(48));
      continue;
    }
    if (plan.kind === "platform") {
      const ref = await referLead(db, avery, id, { target: { kind: "platform", lawyerId: "lawyer-b" }, reason: plan.reason, note: plan.note, clientAgreed: true }, t(3));
      if (!plan.then) continue;
      if (plan.then === "declined") {
        await declineOffer(db, jordan, ref.assignmentId!, "capacity", undefined, t(3.2));
        continue;
      }
      await acceptOffer(db, jordan, ref.assignmentId!, t(3.2));
      if (plan.then === "booked" || plan.then === "retained") await setStage(db, intake, id, "consult_booked", t(30));
      if (plan.then === "retained") {
        await setStage(db, intake, id, "consult_held", t(60));
        await setStage(db, intake, id, "retainer_signed", t(80));
      }
      continue;
    }
    const ref = await referLead(db, avery, id, { target: { kind: "outside", name: plan.name, firm: plan.firm }, reason: plan.reason, clientAgreed: true }, t(3));
    if (plan.outcome) await recordOutcome(db, avery, ref.id, plan.outcome, undefined, t(72));
  }
}
