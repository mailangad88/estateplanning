import { describe, expect, it } from "vitest";
import { createMemoryDb, type Db } from "@/server/db";
import type { Lead, Person, Stage } from "@/server/types";
import { buildConsentRecord } from "@/lib/consent";
import { SEQUENCES, LIFE_EVENT_SEGMENTS, getSequence, lifeEventSequenceId, stepOffsetMs } from "@/server/nurture/sequences";
import {
  BANNED_PHRASES,
  EDUCATIONAL_DISCLAIMER,
  STATE_TIMEZONE,
  applyOptOut,
  isOptOut,
  lintCopy,
  nextAllowedSendTime,
  sensitiveContentIssues,
  insideSendWindow,
} from "@/server/nurture/compliance";
import { dueSends, enroll, enrollForNewLead, evaluateSends, markSent, onExit, onStageChange, sweepQuietLeads } from "@/server/nurture/scheduler";

const T0 = new Date("2026-10-06T17:00:00Z"); // 10:00 PDT, 13:00 EDT
const MIN = 60_000;
const HOUR = 3_600_000;

function fixture(opts: { state?: string; sms?: boolean; segments?: string[]; answers?: Lead["intake"]["answers"]; capture?: Lead["capture"] } = {}) {
  const db = createMemoryDb();
  const state = opts.state ?? "CA";
  const person: Person = { id: "p1", firstName: "Dana", lastName: "Lee", email: "dana@example.com", phone: "+1 (555) 010-0100", language: "en", state };
  db.persons.insert(person);
  const lead: Lead = {
    id: "l1",
    personId: "p1",
    createdAt: T0.toISOString(),
    stage: "new",
    stageHistory: [{ stage: "new", at: T0.toISOString(), by: "system" }],
    matterType: "new_plan",
    state,
    urgent: false,
    score: { score: 60, tier: "warm", grade: "B", urgent: false, components: [], redFlags: [] },
    segments: opts.segments ?? [],
    source: {},
    consent: buildConsentRecord({ smsConsent: opts.sms ?? true, acknowledgedNoRelationship: true, pageUrl: "https://x.test", ip: null, userAgent: null, now: T0 }),
    offerSummary: "",
    conflictCard: { clientName: "Dana Lee", parties: [], matterType: "new_plan", state, clearance: "pending" },
    intake: {
      summary: "",
      redFlags: [],
      deadlines: [],
      household: { members: [] },
      assets: {},
      answers: opts.answers ?? {},
    },
    capture: opts.capture,
  };
  db.leads.insert(lead);
  return { db, lead, person };
}

function setStage(db: Db, stage: Stage) {
  db.leads.update("l1", { stage });
}

describe("sequence definitions", () => {
  it("defines every planned sequence", () => {
    const ids = SEQUENCES.map((s) => s.id);
    for (const id of [
      "speed_to_lead", "quiz_follow_up", "consult_booked", "no_show_recovery", "consult_held_not_signed",
      "signed_onboarding", "plan_complete", "long_term", "annual_review", ...LIFE_EVENT_SEGMENTS.map(lifeEventSequenceId),
    ]) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every step cites the brain file, needs approval, and ids are unique per sequence", () => {
    for (const s of SEQUENCES) {
      expect(s.steps.length, s.id).toBeGreaterThan(0);
      expect(new Set(s.steps.map((x) => x.id)).size, s.id).toBe(s.steps.length);
      for (const st of s.steps) {
        expect(st.brainFileEntryIds.length, `${s.id}/${st.id}`).toBeGreaterThan(0);
        expect(st.requiresApproval).toBe(true);
      }
    }
  });

  it("life-event tracks are 6 to 8 emails within 30 days with one video", () => {
    for (const seg of LIFE_EVENT_SEGMENTS) {
      const s = getSequence(lifeEventSequenceId(seg))!;
      expect(s.steps.length).toBeGreaterThanOrEqual(6);
      expect(s.steps.length).toBeLessThanOrEqual(8);
      for (const st of s.steps) {
        expect(st.channel).toBe("email");
        expect(stepOffsetMs(st.offset)).toBeLessThanOrEqual(30 * 24 * HOUR);
      }
      expect(s.steps.filter((x) => x.video).length).toBe(1);
    }
  });

  it("speed_to_lead has a 5 minute call and 6 call attempts over 7 days", () => {
    const s = getSequence("speed_to_lead")!;
    const calls = s.steps.filter((x) => x.channel === "call_task");
    expect(calls.length).toBe(6);
    expect(stepOffsetMs(calls[0].offset)).toBe(5 * MIN);
    expect(Math.max(...calls.map((c) => stepOffsetMs(c.offset)))).toBeLessThanOrEqual(7 * 24 * HOUR);
  });

  it("consult reminders anchor 24h and 2h before the consult", () => {
    const s = getSequence("consult_booked")!;
    const r24 = s.steps.filter((x) => x.id.includes("24h"));
    const r2 = s.steps.filter((x) => x.id.includes("2h"));
    expect(r24.length).toBeGreaterThan(0);
    for (const st of r24) { expect(st.anchor).toBe("consult"); expect(stepOffsetMs(st.offset)).toBe(-24 * HOUR); }
    for (const st of r2) { expect(st.anchor).toBe("consult"); expect(stepOffsetMs(st.offset)).toBe(-2 * HOUR); }
  });

  it("quiz follow-up sends 5 emails over 14 days, branching by segment", () => {
    const { db } = fixture({ segments: ["new_parent", "homeowner"], answers: { children: "minors", ownsHome: "yes" } });
    const enr = enroll(db, "l1", "quiz_follow_up", T0);
    const out: { stepId: string; channel: string }[] = [];
    for (let day = 0; day <= 15; day++) {
      const now = new Date(T0.getTime() + day * 24 * HOUR + 5 * MIN);
      for (const d of dueSends(db, now)) {
        out.push(d);
        markSent(db, enr.id, d.stepId, now);
      }
    }
    expect(out.length).toBe(5);
    expect(out.every((d) => d.channel === "email")).toBe(true);
    expect(out.map((d) => d.stepId)).toContain("qz_2_guardianship");
    expect(out.map((d) => d.stepId)).not.toContain("qz_2_home");
  });
});

describe("copy lint", () => {
  it("catches banned phrases with positions", () => {
    const text = `We delve into it. Rest assured, it is seamless. ${EDUCATIONAL_DISCLAIMER}`;
    const r = lintCopy(text);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.phrase)).toEqual(expect.arrayContaining(["delve", "rest assured", "seamless"]));
    expect(r.issues.find((i) => i.phrase === "delve")!.index).toBe(3);
    expect(BANNED_PHRASES.length).toBeGreaterThan(8);
  });
  it("passes clean copy and flags a missing disclaimer or citation", () => {
    expect(lintCopy(`A will names a guardian. ${EDUCATIONAL_DISCLAIMER}`, { brainFileEntryIds: ["bf-1"] }).ok).toBe(true);
    expect(lintCopy("A will names a guardian.").issues[0].kind).toBe("missing_disclaimer");
    expect(lintCopy(`Fine. ${EDUCATIONAL_DISCLAIMER}`, { brainFileEntryIds: [] }).issues[0].kind).toBe("missing_citation");
  });
});

describe("sensitive content", () => {
  it("blocks sensitive facts in SMS bodies and email subjects only", () => {
    expect(sensitiveContentIssues("Sorry about your hospice diagnosis", "sms", "body").length).toBeGreaterThan(0);
    expect(sensitiveContentIssues("Your $750,000 estate", "email", "subject").length).toBeGreaterThan(0);
    expect(sensitiveContentIssues("Since your divorce", "sms", "body").length).toBeGreaterThan(0);
    expect(sensitiveContentIssues("About your special needs trust", "sms", "body").length).toBeGreaterThan(0);
    expect(sensitiveContentIssues("hospice diagnosis", "email", "body")).toEqual([]);
    expect(sensitiveContentIssues("Your consult is tomorrow at 10", "sms", "body")).toEqual([]);
  });
});

describe("quiet hours", () => {
  it("covers all states and DC", () => {
    expect(Object.keys(STATE_TIMEZONE).length).toBe(51);
  });
  it("uses recipient local time, with FL and OK ending at 8pm", () => {
    const at = new Date("2026-10-07T00:30:00Z"); // 20:30 EDT, 19:30 CDT, 17:30 PDT
    expect(insideSendWindow("CA", at)).toBe(true);
    expect(insideSendWindow("FL", at)).toBe(false);
    expect(insideSendWindow("OK", at)).toBe(true); // 19:30 CDT
    expect(insideSendWindow("OK", new Date("2026-10-07T01:30:00Z"))).toBe(false); // 20:30 CDT
    const early = new Date("2026-10-06T12:30:00Z"); // 08:30 EDT, 05:30 PDT
    expect(insideSendWindow("FL", early)).toBe(true);
    expect(insideSendWindow("CA", early)).toBe(false);
  });
  it("finds the next allowed time", () => {
    const next = nextAllowedSendTime("CA", new Date("2026-10-07T04:30:00Z")); // 21:30 PDT
    expect(next.toISOString()).toBe("2026-10-07T15:00:00.000Z"); // 08:00 PDT
    const same = new Date("2026-10-06T17:00:00Z");
    expect(nextAllowedSendTime("CA", same)).toEqual(same);
  });
  it("defers an SMS in quiet hours instead of skipping it", () => {
    const { db } = fixture({ state: "CA" });
    const night = new Date("2026-10-07T04:30:00Z");
    const enr = enroll(db, "l1", "speed_to_lead", night);
    const ev = evaluateSends(db, night);
    expect(ev.due.some((d) => d.stepId === "stl_sms_confirm")).toBe(false);
    const def = ev.deferred.find((d) => d.stepId === "stl_sms_confirm")!;
    expect(def.reason).toBe("quiet_hours");
    expect(def.until).toBe("2026-10-07T15:00:00.000Z");
    expect(db.enrollments.get(enr.id)!.sentStepIds).not.toContain("stl_sms_confirm");
    // Email and the call task are not held back.
    expect(ev.due.some((d) => d.stepId === "stl_email_confirm")).toBe(true);
    expect(dueSends(db, new Date(def.until)).some((d) => d.stepId === "stl_sms_confirm")).toBe(true);
  });
});

describe("opt-out", () => {
  it("recognises opt-out wording and not ordinary use of the word stop", () => {
    for (const t of ["Stop", "STOP.", "stopall", "UNSUBSCRIBE", "cancel", "please stop texting me", "don't call me again", "Do not contact me", "quit", "revoke", "opt out"]) {
      expect(isOptOut(t), t).toBe(true);
    }
    for (const t of ["can you stop by Tuesday?", "Please cancel my Tuesday appointment", "thanks!", "when does the consult end?", ""]) {
      expect(isOptOut(t), t).toBe(false);
    }
  });
  it("suppression blocks SMS and is audited", () => {
    const { db } = fixture();
    enroll(db, "l1", "speed_to_lead", T0);
    const r = applyOptOut(db, { channel: "sms", address: "555-010-0100", text: "STOP", at: T0 })!;
    expect(r.suppressions[0].id).toBe("sms:5550100100".replace("5550100100", "5550100100"));
    expect(db.audit.list().some((e) => e.action === "nurture.opt_out")).toBe(true);
    const out = dueSends(db, new Date(T0.getTime() + HOUR));
    expect(out.some((d) => d.channel === "sms")).toBe(false);
    expect(out.some((d) => d.channel === "email")).toBe(true);
    expect(db.enrollments.list()[0].skipped?.some((s) => s.reason === "suppressed")).toBe(true);
  });
  it("do not contact suppresses everything for both addresses", () => {
    const { db } = fixture();
    enroll(db, "l1", "speed_to_lead", T0);
    applyOptOut(db, { channel: "sms", address: "+15550100100", text: "do not contact me", at: T0 });
    expect(dueSends(db, new Date(T0.getTime() + 8 * 24 * HOUR))).toEqual([]);
    expect(db.enrollments.list()[0].stoppedReason).toBe("exit:unsubscribed");
  });
  it("do not call blocks call tasks only", () => {
    const { db } = fixture();
    enroll(db, "l1", "speed_to_lead", T0);
    applyOptOut(db, { channel: "sms", address: "+15550100100", text: "don't call", at: T0 });
    const out = dueSends(db, new Date(T0.getTime() + HOUR));
    expect(out.some((d) => d.channel === "call_task")).toBe(false);
    expect(out.some((d) => d.channel === "sms")).toBe(true);
  });
  it("returns null for non opt-outs", () => {
    const { db } = fixture();
    expect(applyOptOut(db, { channel: "sms", address: "5550100100", text: "can you stop by Tuesday?", at: T0 })).toBeNull();
  });
});

describe("scheduler", () => {
  it("never sends SMS without consent, but still sends email and call tasks", () => {
    const { db } = fixture({ sms: false });
    enroll(db, "l1", "speed_to_lead", T0);
    const out = dueSends(db, new Date(T0.getTime() + 8 * 24 * HOUR));
    expect(out.some((d) => d.channel === "sms")).toBe(false);
    expect(out.filter((d) => d.channel === "call_task").length).toBe(6);
    expect(db.enrollments.list()[0].skipped?.every((s) => s.reason === "no_sms_consent")).toBe(true);
  });

  it("enrollment is idempotent while active", () => {
    const { db } = fixture();
    const a = enroll(db, "l1", "speed_to_lead", T0);
    const b = enroll(db, "l1", "speed_to_lead", new Date(T0.getTime() + HOUR));
    expect(b.id).toBe(a.id);
    expect(db.enrollments.list().length).toBe(1);
  });

  it("enrollForNewLead picks sequences from quiz answers and segments", () => {
    const { db, lead } = fixture({ segments: ["new_parent", "tool:plan_finder"], answers: { children: "minors" } });
    const ids = enrollForNewLead(db, lead, T0).map((e) => e.sequenceId);
    expect(ids).toEqual(["speed_to_lead", "quiz_follow_up", "life_event_new_parent"]);
    const { db: db2, lead: lead2 } = fixture();
    expect(enrollForNewLead(db2, lead2, T0).map((e) => e.sequenceId)).toEqual(["speed_to_lead"]);
  });

  it("a guide download adds the guide follow-up", () => {
    const { db, lead } = fixture({ segments: ["tool:guide", "resource:new-parents-guide", "new_parent"] });
    expect(enrollForNewLead(db, lead, T0).map((e) => e.sequenceId)).toEqual(["speed_to_lead", "magnet_follow_up", "life_event_new_parent"]);
  });

  it("routes grieving families to the gentle track only, and never to long_term", () => {
    for (const overrides of [
      { segments: ["new_parent", "estate_administration"] },
      { segments: ["tool:guide", "resource:after-a-death-checklist"], capture: { tool: "guide", resource: "after-a-death-checklist" } },
      { segments: ["tool:cost_calculator"], capture: { tool: "cost_calculator", result: { mode: "heir" } } },
    ]) {
      const { db, lead } = fixture(overrides as Parameters<typeof fixture>[0]);
      expect(enrollForNewLead(db, lead, T0).map((e) => e.sequenceId)).toEqual(["grief_support"]);
      onExit(db, lead.id, "unresponsive", T0);
      expect(db.enrollments.list((e) => e.sequenceId === "long_term")).toHaveLength(0);
      expect(sweepQuietLeads(db, new Date(T0.getTime() + 90 * 86_400_000))).toEqual([]);
    }
  });

  it("stops the enrollment when the lead reaches an exit stage or is exited", () => {
    const { db } = fixture({ answers: { children: "minors" } });
    enroll(db, "l1", "quiz_follow_up", T0);
    setStage(db, "consult_booked");
    expect(dueSends(db, new Date(T0.getTime() + 20 * 24 * HOUR))).toEqual([]);
    expect(db.enrollments.list()[0]).toMatchObject({ status: "stopped", stoppedReason: "exit:stage_reached:consult_booked" });

    const f = fixture();
    enroll(f.db, "l1", "speed_to_lead", T0);
    f.db.leads.update("l1", { exit: { reason: "not_a_fit", at: T0.toISOString() } });
    expect(dueSends(f.db, new Date(T0.getTime() + HOUR))).toEqual([]);
    expect(f.db.enrollments.list()[0].stoppedReason).toBe("exit:exit_set:not_a_fit");
  });

  it("caps marketing texts at 3 per 24h in FL but not in CA", () => {
    for (const [state, expected] of [["FL", false], ["CA", true]] as const) {
      const { db } = fixture({ state });
      enroll(db, "l1", "speed_to_lead", T0);
      const now = new Date(T0.getTime() + 35 * MIN); // 35 min in; stl_sms_after_1 is due
      for (let i = 0; i < 3; i++) {
        db.activities.insert({ id: `a${i}`, leadId: "l1", kind: "sms", direction: "outbound", at: new Date(now.getTime() - (i + 1) * HOUR).toISOString(), summary: `nurture-marketing:x${i}` });
      }
      const ev = evaluateSends(db, now);
      expect(ev.due.some((d) => d.stepId === "stl_sms_after_1"), state).toBe(expected);
      if (!expected) expect(ev.deferred.find((d) => d.stepId === "stl_sms_after_1")?.reason).toBe("frequency_cap");
    }
  });

  it("markSent records the step, logs activity, creates call tasks and completes", () => {
    const { db } = fixture();
    const enr = enroll(db, "l1", "annual_review", T0);
    const later = new Date(T0.getTime() + 400 * 24 * HOUR);
    const out = dueSends(db, later);
    expect(out.map((d) => d.stepId)).toEqual(["ar_offer", "ar_sms"]);
    markSent(db, enr.id, "ar_offer", later);
    expect(markSent(db, enr.id, "ar_offer", later).sentStepIds).toEqual(["ar_offer"]);
    expect(db.enrollments.get(enr.id)!.status).toBe("active");
    markSent(db, enr.id, "ar_sms", later);
    expect(db.enrollments.get(enr.id)!.status).toBe("completed");
    expect(db.activities.list().length).toBe(2);

    const f = fixture();
    const e2 = enroll(f.db, "l1", "speed_to_lead", T0);
    markSent(f.db, e2.id, "stl_call_1", T0);
    expect(f.db.tasks.list()[0].title).toMatch(/^Call:/);
  });

  it("consult reminders wait for the consult time and skip when the window has passed", () => {
    const { db } = fixture();
    const consult = new Date(T0.getTime() + 30 * HOUR).toISOString();
    onStageChange(db, "l1", "consult_booked", T0);
    const now = new Date(T0.getTime() + 7 * HOUR); // 17:00Z + 7h = 00:00Z = 17:00 PDT
    expect(dueSends(db, now).some((d) => d.stepId.startsWith("cb_remind"))).toBe(false);
    const at24 = new Date(T0.getTime() + 6 * HOUR + 1); // 24h before the consult
    const ev = dueSends(db, at24, { consultAt: () => consult });
    expect(ev.some((d) => d.stepId === "cb_remind_24h_email")).toBe(true);

    // Booked 3h before the consult: the 24h reminder is skipped, not sent late.
    const g = fixture();
    const soon = new Date(T0.getTime() + 3 * HOUR).toISOString();
    onStageChange(g.db, "l1", "consult_booked", T0);
    const out = dueSends(g.db, new Date(T0.getTime() + 30 * MIN), { consultAt: () => soon });
    expect(out.some((d) => d.stepId === "cb_remind_24h_sms")).toBe(false);
    expect(g.db.enrollments.list()[0].skipped?.some((s) => s.stepId === "cb_remind_24h_sms" && s.reason === "window_passed")).toBe(true);
  });

  it("stage hooks stop pre-sale sequences and start the next ones", () => {
    const { db, lead } = fixture({ segments: ["homeowner"], answers: { ownsHome: "yes" } });
    enrollForNewLead(db, lead, T0);
    onStageChange(db, "l1", "consult_booked", T0);
    const active = () => db.enrollments.list((e) => e.status === "active").map((e) => e.sequenceId).sort();
    expect(active()).toEqual(["consult_booked"]);
    onStageChange(db, "l1", "retainer_signed", T0);
    expect(active()).toEqual(["signed_onboarding"]);
    onStageChange(db, "l1", "plan_complete", T0);
    expect(active()).toEqual(["annual_review", "plan_complete"]);
  });

  it("hands consult_held_not_signed off to long_term when it finishes", () => {
    const { db } = fixture();
    setStage(db, "consult_held");
    onStageChange(db, "l1", "consult_held", T0);
    const enr = db.enrollments.list()[0];
    for (const s of getSequence("consult_held_not_signed")!.steps) markSent(db, enr.id, s.id, T0);
    expect(db.enrollments.list((e) => e.sequenceId === "long_term" && e.status === "active").length).toBe(1);
  });
});
