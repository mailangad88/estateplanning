/**
 * The at-a-glance part of a lead: where it is on the lead-to-close journey (six phases), its status,
 * the open tasks and a short details list. Used by the lead's own page and by the slide-over panel on the
 * portal home and the pipeline. Built from a CaseView, so it never shows more than the viewer may see.
 */
import { buildJourney, CASE_PHASES, type CasePhase } from "@/lib/caseJourney";
import { questionnaireStage, QUESTIONNAIRE_STAGES } from "@/lib/intakeQuestionnaire";
import type { Db } from "@/server/db";
import type { CaseView } from "@/server/portal/caseView";
import type { Lead } from "@/server/types";

export type SnapTone = "good" | "warn" | "danger" | "neutral" | "info";

export interface LeadSnapshot {
  status: { label: string; tone: SnapTone };
  phaseLabel: string;
  phases: { key: CasePhase; label: string; state: "done" | "current" | "todo" | "stopped" }[];
  /** "On this step 4 days" / "Closed Nov 20, 2026" */
  stepNote: string;
  currentStep?: string;
  tasks: { id: string; title: string; due: string; overdue: boolean }[];
  details: { label: string; value: string }[];
}

const DAY = 86_400_000;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }) : "-");
const label = (s: string) => s.replaceAll("_", " ");

export async function leadSnapshot(db: Db, view: CaseView, lead: Lead | undefined, now = new Date()): Promise<LeadSnapshot> {
  const h = view.header;
  const full = view.access === "full";
  const j = lead ? buildJourney(lead, now) : undefined;
  const phaseIdx = j ? CASE_PHASES.findIndex((p) => p.key === j.phase) : 0;
  const stoppedAt = j?.exited ? Math.max(0, CASE_PHASES.findIndex((p) => p.key === j.steps[j.currentIndex]?.phase)) : -1;
  const phases = CASE_PHASES.map((p, i) => ({
    key: p.key as CasePhase,
    label: p.label,
    state: (j?.exited ? (i < stoppedAt ? "done" : i === stoppedAt ? "stopped" : "todo") : j?.closed ? "done" : i < phaseIdx ? "done" : i === phaseIdx ? "current" : "todo") as LeadSnapshot["phases"][number]["state"],
  }));
  const status: LeadSnapshot["status"] = j?.exited
    ? { label: "Closed early", tone: "neutral" }
    : j?.closed
      ? { label: "Closed", tone: "good" }
      : h.urgent
        ? { label: "Urgent", tone: "danger" }
        : j?.stale
          ? { label: `Stuck ${j.daysInStep}d`, tone: "danger" }
          : view.access === "conflict_card"
            ? { label: "New offer", tone: "warn" }
            : { label: "On track", tone: "good" };
  const stepNote = j?.exited
    ? `Closed early ${fmt(j.exited.at)}: ${label(j.exited.reason)}`
    : j?.closed
      ? `File closed ${fmt(j.steps.find((s) => s.key === "closed")?.at)}`
      : j
        ? `${j.current?.label ?? ""} · ${j.daysInStep === 0 ? "since today" : `${j.daysInStep} day${j.daysInStep === 1 ? "" : "s"} on this step`}`
        : "";

  const tasks = (view.sections.tasks ?? [])
    .filter((t) => !t.doneAt)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .map((t) => ({ id: t.id, title: t.title, due: fmt(t.dueAt), overdue: new Date(t.dueAt).getTime() < now.getTime() }));

  const details: LeadSnapshot["details"] = [
    { label: "Matter", value: h.matterType },
    { label: "Location", value: h.location },
    { label: "Score", value: `${h.score} (grade ${h.grade ?? h.tier})` },
    { label: "Attorney", value: h.assignedLawyer?.replace(/,?\s*Esq\.?$/i, "") ?? "Not matched yet" },
  ];
  if (full && lead) {
    const para = lead.assignedParalegalId ? await db.users.get(lead.assignedParalegalId).catch(() => undefined) : undefined;
    details.push({ label: "Paralegal", value: para?.name ?? (lead.assignedParalegalId ? "Assigned" : "Not assigned") });
    if (lead.assignedLawyerId) {
      const q = questionnaireStage(lead);
      details.push({ label: "Questionnaire", value: q === "not_started" ? "Not started" : QUESTIONNAIRE_STAGES.find((s) => s.key === q)?.label ?? "" });
    }
  }
  if (lead) {
    details.push({ label: "Came in", value: fmt(lead.createdAt) });
    const age = Math.floor((now.getTime() - new Date(lead.createdAt).getTime()) / DAY);
    details.push({ label: "Age", value: age === 0 ? "Today" : `${age} day${age === 1 ? "" : "s"}` });
  }
  const src = view.sections.source;
  const channel = src && (src.utm_source || src.source || src.channel || src.referrer);
  if (channel) details.push({ label: "Source", value: String(channel) });

  return {
    status,
    phaseLabel: j?.exited ? "Closed early" : CASE_PHASES[phaseIdx]?.label ?? "",
    phases,
    stepNote,
    currentStep: j?.current?.label,
    tasks,
    details,
  };
}
