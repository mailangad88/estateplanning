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
  icon: "users" | "family" | "home" | "heart" | "shield" | "file" | "flag";
  fields: QuestionField[];
}

const YN = ["Yes", "No", "Not sure"];

export const QUESTIONNAIRE: QuestionSection[] = [
  {
    id: "client",
    title: "Client and contact",
    blurb: "Who the plan is for and how to reach them.",
    icon: "users",
    fields: [
      { id: "client_full_name", label: "Client's full legal name", type: "text", required: true, hint: "As it should appear on the documents" },
      { id: "client_other_names", label: "Other names used (maiden name, nickname on accounts)", type: "text" },
      { id: "client_dob", label: "Date of birth", type: "date" },
      { id: "client_phone", label: "Best phone number", type: "text", required: true },
      { id: "client_email", label: "Email", type: "text" },
      { id: "contact_preference", label: "Best way and time to reach them", type: "text", hint: "Text, call or email; mornings, evenings" },
      { id: "client_address", label: "Home address and county", type: "text", required: true },
      { id: "client_citizenship", label: "U.S. citizen?", type: "yesno", hint: "A non-citizen spouse changes the trust and tax planning" },
      { id: "client_occupation", label: "Occupation or retired", type: "text" },
    ],
  },
  {
    id: "family",
    title: "Spouse and family",
    blurb: "Marriage, children and anyone who depends on them.",
    icon: "family",
    fields: [
      { id: "marital_status", label: "Marital status", type: "select", options: ["Single", "Married", "Civil union", "Divorced", "Widowed", "Partnered, not married"], required: true },
      { id: "spouse_name", label: "Spouse or partner's full name", type: "text" },
      { id: "spouse_dob", label: "Spouse or partner's date of birth", type: "date" },
      { id: "spouse_citizenship", label: "Spouse a U.S. citizen?", type: "yesno" },
      { id: "joint_plan", label: "Planning together as a couple?", type: "yesno" },
      { id: "prior_marriages", label: "Prior marriages (either spouse), and any support or property orders", type: "textarea" },
      { id: "prenup", label: "Prenuptial or postnuptial agreement?", type: "yesno" },
      { id: "children", label: "Children (name, age, from this or a prior relationship)", type: "textarea", required: true, hint: "Write \"None\" if no children" },
      { id: "grandchildren", label: "Grandchildren", type: "textarea" },
      { id: "special_needs", label: "Anyone with special needs or on public benefits?", type: "yesno", hint: "If yes, note who and which benefits (SSI, Medicaid)" },
      { id: "child_concerns", label: "Concerns about a beneficiary (spending, addiction, divorce, creditors)", type: "textarea", hint: "Stays internal" },
      { id: "dependents", label: "Others who depend on them (parents, relatives)", type: "textarea" },
      { id: "pets", label: "Pets, and who should care for them", type: "text" },
    ],
  },
  {
    id: "assets",
    title: "Assets and debts",
    blurb: "Rough values are fine. The paralegal collects statements later.",
    icon: "home",
    fields: [
      { id: "home", label: "Home (address, how titled, rough value, mortgage)", type: "textarea", required: true, hint: "Write \"Rents\" if they do not own" },
      { id: "other_real_estate", label: "Other real estate, including out of state", type: "textarea", hint: "Out-of-state property may need its own probate without a trust" },
      { id: "bank_brokerage", label: "Bank and brokerage accounts (institution, rough value, joint or POD/TOD)", type: "textarea", required: true },
      { id: "retirement", label: "Retirement accounts and current beneficiaries", type: "textarea" },
      { id: "life_insurance", label: "Life insurance (carrier, face amount, beneficiary)", type: "textarea" },
      { id: "business", label: "Business interests (entity, ownership share, partners)", type: "textarea" },
      { id: "vehicles_other", label: "Vehicles, collectibles, firearms, other valuables", type: "textarea" },
      { id: "digital_assets", label: "Digital assets (crypto, online accounts, password manager)", type: "textarea" },
      { id: "debts", label: "Debts beyond the mortgage (loans, credit cards, judgments)", type: "textarea" },
      { id: "expected_inheritance", label: "Expecting an inheritance or a trust from someone else?", type: "yesno" },
      { id: "estimated_total", label: "Estimated total estate", type: "select", options: ["Under $250k", "$250k to $1M", "$1M to $4M", "Over $4M (Illinois estate tax)", "Not sure"], required: true, hint: "Include life insurance face amounts and retirement accounts" },
    ],
  },
  {
    id: "wishes",
    title: "Wishes and people",
    blurb: "Who inherits, who is in charge, who cares for the kids.",
    icon: "heart",
    fields: [
      { id: "beneficiaries", label: "Who should inherit, and in what shares", type: "textarea", required: true },
      { id: "contingent_beneficiaries", label: "If a beneficiary dies first (their children, the others, charity)", type: "textarea" },
      { id: "specific_gifts", label: "Specific gifts (items, charities)", type: "textarea" },
      { id: "executor", label: "Executor / successor trustee (first and backup)", type: "textarea", required: true },
      { id: "guardian", label: "Guardian for minor children (first and backup)", type: "textarea", hint: "Required when there are minor children" },
      { id: "age_of_distribution", label: "Age or stages for children to receive money", type: "text" },
      { id: "disinherit", label: "Anyone left out on purpose?", type: "yesno", hint: "If yes, note who and why (stays internal)" },
      { id: "funeral_wishes", label: "Funeral, burial or cremation wishes", type: "textarea" },
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
      { id: "hipaa", label: "HIPAA authorization so family can talk to doctors?", type: "yesno" },
      { id: "end_of_life_notes", label: "End-of-life or organ donation wishes", type: "textarea" },
      { id: "long_term_care", label: "Worried about nursing home costs or Medicaid?", type: "yesno", hint: "If yes, flag for the attorney: may change the plan" },
      { id: "health_notes", label: "Health or timing concerns (diagnosis, surgery, age)", type: "textarea", hint: "Stays internal" },
    ],
  },
  {
    id: "documents",
    title: "Plan and documents",
    blurb: "What the attorney recommended and what the client already has.",
    icon: "file",
    fields: [
      { id: "why_now", label: "What prompted planning now", type: "textarea" },
      { id: "package", label: "Package agreed", type: "select", options: ["Basic ($2,500)", "Second tier ($3,500)", "Custom (quoted)", "Not decided"], required: true },
      { id: "recommended_documents", label: "Documents to draft (will, revocable trust, pour-over will, POAs, deeds)", type: "textarea", required: true },
      { id: "existing_documents", label: "Existing documents, year signed, state, and where they are", type: "textarea" },
      { id: "documents_to_collect", label: "What the paralegal should collect from the client", type: "textarea", hint: "Deeds, statements, old will or trust, beneficiary forms, IDs" },
      { id: "funding_needed", label: "Trust funding needed (deeds, account retitling)?", type: "yesno" },
      { id: "signing_preference", label: "Signing preference", type: "select", options: ["At the office", "At the client's home", "Hospital or care facility", "Not decided"] },
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
export function prefillAnswers(lead: Pick<Lead, "intake" | "county">, person?: Pick<Person, "firstName" | "lastName" | "county"> & Partial<Pick<Person, "email" | "phone">>): Record<string, string> {
  const a: Record<string, string> = {};
  if (person) a.client_full_name = `${person.firstName} ${person.lastName}`.trim();
  if (person?.phone) a.client_phone = person.phone;
  if (person?.email) a.client_email = person.email;
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
  const i = lead.intake;
  const kidsAnswer: Record<string, string> = { none: "None", minors: "Minor children", adults: "Adult children", both: "Minor and adult children" };
  const ka = i?.household?.children;
  if (ka && !kids.length) a.children = ka === "none" ? "None" : `${kidsAnswer[ka]} (names and ages still to collect)`;
  const range = i?.assets?.range;
  if (range === "under_250k") a.estimated_total = "Under $250k";
  else if (range === "250k_1m") a.estimated_total = "$250k to $1M";
  if (i?.assets?.outOfStateProperty) a.other_real_estate = `Out of state${i.assets.outOfStateStates?.length ? `: ${i.assets.outOfStateStates.join(", ")}` : ""} (from the website intake)`;
  if (i?.assets?.ownsHome === false) a.home = "Rents (from the website intake)";
  const docs: Record<string, string> = { none: "None", will_only: "Has a will (from the website intake)", trust: "Has a trust (from the website intake)" };
  if (i?.existingDocuments && docs[i.existingDocuments]) a.existing_documents = docs[i.existingDocuments];
  if (i?.goals) {
    a.why_now = i.goals;
    a.attorney_notes = `Client's goal: ${i.goals}`;
  }
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
