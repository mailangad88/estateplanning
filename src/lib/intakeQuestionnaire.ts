/**
 * The attorney's intake questionnaire: what the attorney fills in during or after the first call, then
 * hands to the case's paralegal to complete. It is signed off as part of the attorney review step of the
 * case journey (src/lib/caseJourney.ts), after which it is locked.
 *
 * Pure: field definitions, prefill from the lead, validation and progress. Answers are plain strings
 * keyed by field id, kept on the lead as `questionnaire` (leads.questionnaire).
 */
import type { Lead, Person, QuestionnaireRecord } from "@/server/types";

export type FieldType = "text" | "textarea" | "yesno" | "select" | "date";

export interface QuestionField {
  id: string;
  label: string;
  type: FieldType;
  options?: string[];
  hint?: string;
  /** Counts toward "complete" for the section */
  required?: boolean;
}

export interface QuestionSection {
  id: string;
  title: string;
  /** One line under the title */
  blurb: string;
  icon: "users" | "home" | "heart" | "shield" | "file" | "flag";
  fields: QuestionField[];
}

const YN = ["Yes", "No", "Not sure"];

export const QUESTIONNAIRE: QuestionSection[] = [
  {
    id: "client",
    title: "Client and household",
    blurb: "Who the plan is for and who lives with them.",
    icon: "users",
    fields: [
      { id: "client_full_name", label: "Client's full legal name", type: "text", required: true },
      { id: "client_dob", label: "Date of birth", type: "date" },
      { id: "client_address", label: "Home address and county", type: "text", required: true },
      { id: "marital_status", label: "Marital status", type: "select", options: ["Single", "Married", "Civil union", "Divorced", "Widowed", "Partnered, not married"], required: true },
      { id: "spouse_name", label: "Spouse or partner's full name", type: "text" },
      { id: "joint_plan", label: "Planning together as a couple?", type: "yesno" },
      { id: "children", label: "Children (name, age, from this or a prior relationship)", type: "textarea", required: true },
      { id: "special_needs", label: "Anyone with special needs or on public benefits?", type: "yesno", hint: "If yes, note who and which benefits" },
    ],
  },
  {
    id: "assets",
    title: "Assets",
    blurb: "Rough values are fine. The paralegal collects statements later.",
    icon: "home",
    fields: [
      { id: "home", label: "Home (address, how titled, rough value, mortgage)", type: "textarea", required: true },
      { id: "other_real_estate", label: "Other real estate, including out of state", type: "textarea" },
      { id: "bank_brokerage", label: "Bank and brokerage accounts (institution, rough value)", type: "textarea", required: true },
      { id: "retirement", label: "Retirement accounts and current beneficiaries", type: "textarea" },
      { id: "life_insurance", label: "Life insurance (carrier, face amount, beneficiary)", type: "textarea" },
      { id: "business", label: "Business interests", type: "textarea" },
      { id: "estimated_total", label: "Estimated total estate", type: "select", options: ["Under $250k", "$250k to $1M", "$1M to $4M", "Over $4M (Illinois estate tax)", "Not sure"], required: true },
    ],
  },
  {
    id: "wishes",
    title: "Wishes and people",
    blurb: "Who inherits, who is in charge, who cares for the kids.",
    icon: "heart",
    fields: [
      { id: "beneficiaries", label: "Who should inherit, and in what shares", type: "textarea", required: true },
      { id: "specific_gifts", label: "Specific gifts (items, charities)", type: "textarea" },
      { id: "executor", label: "Executor / successor trustee (first and backup)", type: "textarea", required: true },
      { id: "guardian", label: "Guardian for minor children (first and backup)", type: "textarea" },
      { id: "age_of_distribution", label: "Age or stages for children to receive money", type: "text" },
      { id: "disinherit", label: "Anyone left out on purpose?", type: "yesno", hint: "If yes, note who and why (stays internal)" },
    ],
  },
  {
    id: "health",
    title: "Health care and powers of attorney",
    blurb: "Illinois statutory short forms unless the attorney says otherwise.",
    icon: "shield",
    fields: [
      { id: "poa_property_agent", label: "Power of attorney for property: agent and backup", type: "textarea", required: true },
      { id: "poa_health_agent", label: "Power of attorney for health care: agent and backup", type: "textarea", required: true },
      { id: "living_will", label: "Wants an Illinois living will declaration?", type: "yesno" },
      { id: "end_of_life_notes", label: "End-of-life or organ donation wishes", type: "textarea" },
    ],
  },
  {
    id: "documents",
    title: "Plan and documents",
    blurb: "What the attorney recommended and what the client already has.",
    icon: "file",
    fields: [
      { id: "package", label: "Package agreed", type: "select", options: ["Basic ($2,500)", "Second tier ($3,500)", "Custom (quoted)", "Not decided"], required: true },
      { id: "recommended_documents", label: "Documents to draft (will, revocable trust, pour-over will, POAs, deeds)", type: "textarea", required: true },
      { id: "existing_documents", label: "Existing documents and where they are", type: "textarea" },
      { id: "documents_to_collect", label: "What the paralegal should collect from the client", type: "textarea" },
      { id: "funding_needed", label: "Trust funding needed (deeds, account retitling)?", type: "yesno" },
    ],
  },
  {
    id: "flags",
    title: "Attorney notes",
    blurb: "Anything the paralegal must know before drafting.",
    icon: "flag",
    fields: [
      { id: "conflicts", label: "Conflict check notes", type: "textarea" },
      { id: "capacity_concerns", label: "Capacity or undue-influence concerns?", type: "yesno" },
      { id: "deadlines", label: "Deadlines (travel, surgery, closing date)", type: "textarea" },
      { id: "attorney_notes", label: "Instructions for the paralegal", type: "textarea", required: true },
    ],
  },
];

export const ALL_FIELDS = QUESTIONNAIRE.flatMap((s) => s.fields);
const FIELD_IDS = new Set(ALL_FIELDS.map((f) => f.id));
export const MAX_ANSWER = 4000;

/** Keeps only known fields, trims, caps the length, and checks select values. */
export function cleanAnswers(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of ALL_FIELDS) {
    if (!(f.id in input)) continue;
    const v = String(input[f.id] ?? "").trim().slice(0, MAX_ANSWER);
    if (!v) continue;
    if (f.type === "yesno" && !YN.includes(v)) continue;
    if (f.type === "select" && !f.options!.includes(v)) continue;
    if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) continue;
    out[f.id] = v;
  }
  return out;
}

export const isQuestionField = (id: string) => FIELD_IDS.has(id);

/** Starting answers from what intake already knows, so the attorney is not retyping. */
export function prefillAnswers(lead: Pick<Lead, "intake" | "county">, person?: Pick<Person, "firstName" | "lastName" | "county">): Record<string, string> {
  const a: Record<string, string> = {};
  if (person) a.client_full_name = `${person.firstName} ${person.lastName}`.trim();
  const county = person?.county ?? lead.county;
  if (county) a.client_address = `${county} County`;
  const members = lead.intake?.household?.members ?? [];
  const spouse = members.find((m) => m.relationship === "spouse" || m.relationship === "partner");
  if (spouse) a.spouse_name = spouse.name;
  const kids = members.filter((m) => m.relationship === "child");
  if (kids.length) a.children = kids.map((k) => `${k.name}${k.age !== undefined ? `, age ${k.age}` : ""}`).join("\n");
  const ms = lead.intake?.household?.maritalStatus;
  const msMap: Record<string, string> = { married: "Married", single: "Single", divorced: "Divorced", widowed: "Widowed", partnered: "Partnered, not married" };
  if (ms && msMap[ms]) a.marital_status = msMap[ms];
  if (lead.intake?.goals) a.attorney_notes = `Client's goal: ${lead.intake.goals}`;
  return a;
}

export interface SectionProgress {
  id: string;
  filled: number;
  total: number;
  requiredLeft: number;
}

export function questionnaireProgress(answers: Record<string, string>): { sections: SectionProgress[]; filled: number; total: number; requiredLeft: number; percent: number } {
  const sections = QUESTIONNAIRE.map((s) => ({
    id: s.id,
    filled: s.fields.filter((f) => answers[f.id]).length,
    total: s.fields.length,
    requiredLeft: s.fields.filter((f) => f.required && !answers[f.id]).length,
  }));
  const filled = sections.reduce((n, s) => n + s.filled, 0);
  const total = sections.reduce((n, s) => n + s.total, 0);
  const required = ALL_FIELDS.filter((f) => f.required).length;
  const requiredLeft = sections.reduce((n, s) => n + s.requiredLeft, 0);
  return { sections, filled, total, requiredLeft, percent: Math.round(((required - requiredLeft) / required) * 100) };
}

export type QuestionnaireStage = "not_started" | "attorney" | "paralegal" | "ready_for_review" | "signed_off";

export const QUESTIONNAIRE_STAGES: { key: QuestionnaireStage; label: string }[] = [
  { key: "attorney", label: "Attorney fills in" },
  { key: "paralegal", label: "Paralegal completes" },
  { key: "ready_for_review", label: "Ready for attorney" },
  { key: "signed_off", label: "Attorney signed off" },
];

/** Where the questionnaire is, from its record and the case's journey steps. */
export function questionnaireStage(lead: Pick<Lead, "questionnaire" | "caseSteps" | "stage">): QuestionnaireStage {
  const q: QuestionnaireRecord | undefined = lead.questionnaire;
  if (lead.caseSteps?.attorney_review || lead.stage === "plan_complete" || lead.stage === "annual_review") return "signed_off";
  if (!q) return "not_started";
  if (q.readyAt) return "ready_for_review";
  if (q.sentAt) return "paralegal";
  return "attorney";
}
