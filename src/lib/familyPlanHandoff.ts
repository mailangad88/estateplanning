"use client";

/**
 * Browser-side memory for "My family plan". Two keys, both on this device only:
 * - the handoff: what the plan finder or life game told us, written only when the visitor clicks
 *   through to the organizer, read once on their first visit there, then cleared
 * - the draft: the organizer itself before the visitor saves it with an emailed link. Once saved,
 *   the draft is sent to the server and removed from the device.
 */
import type { QuizAnswers } from "@/lib/quiz";

const HANDOFF_KEY = "fpl.planhandoff.v1";
const DRAFT_KEY = "fpl.familyplan.draft.v1";

export interface PlanHandoff {
  answers?: Partial<QuizAnswers>;
  state?: string;
  lifeGameDocs?: string[];
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage blocked: the organizer still works for this visit.
  }
}

function remove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Called from a link's click handler, so nothing is kept unless the visitor chooses to go on. */
export function handOffToPlan(h: PlanHandoff) {
  const prev = read<PlanHandoff>(HANDOFF_KEY) ?? {};
  write(HANDOFF_KEY, {
    answers: { ...prev.answers, ...h.answers },
    state: h.state ?? prev.state,
    lifeGameDocs: [...new Set([...(prev.lifeGameDocs ?? []), ...(h.lifeGameDocs ?? [])])].slice(0, 20),
  } satisfies PlanHandoff);
}

export function takeHandoff(): PlanHandoff | null {
  const h = read<PlanHandoff>(HANDOFF_KEY);
  remove(HANDOFF_KEY);
  return h;
}

export function loadDraft(): unknown {
  return read<unknown>(DRAFT_KEY);
}

export function saveDraft(body: unknown) {
  write(DRAFT_KEY, body);
}

export function clearDraft() {
  remove(DRAFT_KEY);
  remove(HANDOFF_KEY);
}
